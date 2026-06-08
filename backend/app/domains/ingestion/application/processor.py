"""Background ingestion pipeline: convert -> chunk -> embed -> persist.

Runs after the upload response (FastAPI BackgroundTasks). It owns its own DB
session (the request session is already closed) and advances the Document through
its status machine, committing after each transition so the UI can show progress.

Docling conversion is synchronous and CPU/GPU-heavy, so it runs in a worker
thread to keep the event loop responsive.

Note (layering): because this processor owns its own session lifecycle for the
background task, it instantiates infrastructure repositories directly here -- an
intentional composition-root-style exception to the "application depends only on
ports" rule, scoped to this background pipeline.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import get_logger
from app.domains.document_conversion.application.service import DocumentConversionService
from app.domains.embedding.domain.ports import EmbeddingPort
from app.domains.ingestion.domain.models import DocumentStatus
from app.domains.ingestion.domain.ports import NewChunk
from app.domains.ingestion.infrastructure.repositories import (
    SqlAlchemyDocumentChunkRepository,
    SqlAlchemyDocumentRepository,
)
from app.domains.storage.domain.ports import StoragePort

logger = get_logger(__name__)


class DocumentProcessor:
    def __init__(
        self,
        *,
        sessionmaker: async_sessionmaker[AsyncSession],
        conversion: DocumentConversionService,
        embedder: EmbeddingPort,
        storage: StoragePort,
    ) -> None:
        self._sessionmaker = sessionmaker
        self._conversion = conversion
        self._embedder = embedder
        self._storage = storage

    async def process(self, document_id: UUID) -> None:
        async with self._sessionmaker() as session:
            documents = SqlAlchemyDocumentRepository(session)
            chunks = SqlAlchemyDocumentChunkRepository(session)

            doc = await documents.get(document_id)
            if doc is None:
                logger.warning("Ingestion skipped: document %s missing", document_id)
                return

            try:
                await documents.set_status(document_id, DocumentStatus.CONVERTING)
                await session.commit()

                data = await self._storage.get(doc.storage_uri)
                converted = await asyncio.to_thread(self._convert, data, doc.name)

                await documents.set_markdown(document_id, converted.markdown)
                await documents.set_status(
                    document_id, DocumentStatus.CHUNKING, page_count=converted.page_count
                )
                await session.commit()

                texts = [c.text for c in converted.chunks]
                vectors = await self._embedder.embed_documents(texts)
                # strict=True: a chunk/vector count mismatch must fail loudly, not
                # silently drop chunks (which would store text without embeddings).
                new_chunks = [
                    NewChunk(index=c.index, text=c.text, page=c.page, embedding=v)
                    for c, v in zip(converted.chunks, vectors, strict=True)
                ]
                await chunks.replace_for_document(document_id, new_chunks)

                await documents.set_status(document_id, DocumentStatus.READY)
                await session.commit()
                logger.info("Ingestion ready doc=%s chunks=%d", document_id, len(new_chunks))
            except Exception as error:  # noqa: BLE001 - record failure, don't crash the task
                logger.exception("Ingestion failed doc=%s", document_id)
                await session.rollback()
                await documents.set_status(
                    document_id, DocumentStatus.FAILED, error=str(error)[:1000]
                )
                await session.commit()

    def _convert(self, data: bytes, filename: str):
        """Buffer bytes to a temp file (Docling needs a path) and convert+chunk."""
        suffix = os.path.splitext(filename)[1]
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            tmp.write(data)
            tmp.close()
            return self._conversion.convert_and_chunk(tmp.name, filename)
        finally:
            if os.path.exists(tmp.name):
                os.remove(tmp.name)
