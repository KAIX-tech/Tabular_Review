"""Application service (request-scoped use cases) for ingestion.

Handles the synchronous document operations: create (store file + row), list,
get, content (markdown), original file download, delete (row + stored object).
The heavy convert/chunk/embed pipeline runs in the background - see
:class:`app.domains.ingestion.application.processor.DocumentProcessor`.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from app.core.logging import get_logger
from app.domains.ingestion.domain.models import Document
from app.domains.ingestion.domain.ports import DocumentNotFoundError, DocumentRepository
from app.domains.storage.domain.ports import StoragePort

logger = get_logger(__name__)


class IngestionService:
    def __init__(self, document_repo: DocumentRepository, storage: StoragePort) -> None:
        self._documents = document_repo
        self._storage = storage

    async def create_document(
        self,
        document_db_id: UUID,
        *,
        filename: str,
        mime_type: str,
        data: bytes,
    ) -> Document:
        # Storage key is independent of the (DB-generated) document id.
        key = f"{document_db_id}/{uuid4().hex}/{filename}"
        await self._storage.put(key, data, mime_type)
        logger.info("Stored upload key=%s size=%d", key, len(data))
        return await self._documents.add(
            document_db_id,
            name=filename,
            mime_type=mime_type,
            size_bytes=len(data),
            storage_uri=key,
        )

    async def list_documents(self, document_db_id: UUID) -> list[Document]:
        return await self._documents.list_by_db(document_db_id)

    async def get_document(self, document_id: UUID) -> Document:
        doc = await self._documents.get(document_id)
        if doc is None:
            raise DocumentNotFoundError(str(document_id))
        return doc

    async def get_content(self, document_id: UUID) -> str:
        await self.get_document(document_id)  # 404 if missing
        return await self._documents.get_markdown(document_id) or ""

    async def get_file(self, document_id: UUID) -> tuple[bytes, str, str]:
        doc = await self.get_document(document_id)
        data = await self._storage.get(doc.storage_uri)
        return data, doc.mime_type, doc.name

    async def delete_document(self, document_id: UUID) -> None:
        doc = await self._documents.delete(document_id)  # raises if missing; cascades chunks
        await self._storage.delete(doc.storage_uri)
