"""SQLAlchemy repository adapters for the ingestion context."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.ingestion.domain.models import Document, DocumentChunk, DocumentStatus
from app.domains.ingestion.domain.ports import (
    DocumentChunkRepository,
    DocumentNotFoundError,
    DocumentRepository,
    NewChunk,
)
from app.domains.ingestion.infrastructure.models import DocumentChunkOrm, DocumentOrm


def _to_chunk(orm: DocumentChunkOrm) -> DocumentChunk:
    return DocumentChunk(
        id=orm.id,
        document_id=orm.document_id,
        index=orm.index,
        text=orm.text,
        page=orm.page,
    )


def _to_document(orm: DocumentOrm) -> Document:
    return Document(
        id=orm.id,
        document_db_id=orm.document_db_id,
        name=orm.name,
        mime_type=orm.mime_type,
        size_bytes=orm.size_bytes,
        storage_uri=orm.storage_uri,
        page_count=orm.page_count,
        status=DocumentStatus(orm.status),
        error=orm.error,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


class SqlAlchemyDocumentRepository(DocumentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(
        self,
        document_db_id: UUID,
        *,
        name: str,
        mime_type: str,
        size_bytes: int,
        storage_uri: str,
    ) -> Document:
        orm = DocumentOrm(
            document_db_id=document_db_id,
            name=name,
            mime_type=mime_type,
            size_bytes=size_bytes,
            storage_uri=storage_uri,
            status=DocumentStatus.UPLOADED.value,
        )
        self._session.add(orm)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_document(orm)

    async def list_by_db(self, document_db_id: UUID) -> list[Document]:
        stmt = (
            select(DocumentOrm)
            .where(DocumentOrm.document_db_id == document_db_id)
            .order_by(DocumentOrm.created_at.desc())
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_document(orm) for orm in rows]

    async def get(self, document_id: UUID) -> Document | None:
        orm = await self._session.get(DocumentOrm, document_id)
        return _to_document(orm) if orm is not None else None

    async def count_by_db(self, document_db_id: UUID) -> int:
        stmt = select(func.count()).where(DocumentOrm.document_db_id == document_db_id)
        return int((await self._session.execute(stmt)).scalar_one())

    async def set_status(
        self,
        document_id: UUID,
        status: DocumentStatus,
        *,
        error: str | None = None,
        page_count: int | None = None,
    ) -> None:
        orm = await self._session.get(DocumentOrm, document_id)
        if orm is None:
            raise DocumentNotFoundError(str(document_id))
        orm.status = status.value
        orm.error = error
        if page_count is not None:
            orm.page_count = page_count
        await self._session.flush()

    async def set_markdown(self, document_id: UUID, markdown: str) -> None:
        orm = await self._session.get(DocumentOrm, document_id)
        if orm is None:
            raise DocumentNotFoundError(str(document_id))
        orm.markdown = markdown
        await self._session.flush()

    async def get_markdown(self, document_id: UUID) -> str | None:
        stmt = select(DocumentOrm.markdown).where(DocumentOrm.id == document_id)
        result = (await self._session.execute(stmt)).first()
        return result[0] if result is not None else None

    async def delete(self, document_id: UUID) -> Document:
        orm = await self._session.get(DocumentOrm, document_id)
        if orm is None:
            raise DocumentNotFoundError(str(document_id))
        document = _to_document(orm)
        await self._session.delete(orm)
        await self._session.flush()
        return document


class SqlAlchemyDocumentChunkRepository(DocumentChunkRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def replace_for_document(self, document_id: UUID, chunks: list[NewChunk]) -> None:
        await self._session.execute(
            delete(DocumentChunkOrm).where(DocumentChunkOrm.document_id == document_id)
        )
        for chunk in chunks:
            self._session.add(
                DocumentChunkOrm(
                    document_id=document_id,
                    index=chunk.index,
                    text=chunk.text,
                    page=chunk.page,
                    embedding=chunk.embedding,
                )
            )
        await self._session.flush()

    async def list_by_document(self, document_id: UUID) -> list[DocumentChunk]:
        stmt = (
            select(DocumentChunkOrm)
            .where(DocumentChunkOrm.document_id == document_id)
            .order_by(DocumentChunkOrm.index)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_chunk(o) for o in rows]

    async def search_in_document(
        self, document_id: UUID, embedding: list[float], limit: int
    ) -> list[DocumentChunk]:
        stmt = (
            select(DocumentChunkOrm)
            .where(
                DocumentChunkOrm.document_id == document_id,
                DocumentChunkOrm.embedding.is_not(None),
            )
            .order_by(DocumentChunkOrm.embedding.cosine_distance(embedding))
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_chunk(o) for o in rows]

    async def search_scoped(
        self,
        embedding: list[float],
        *,
        document_db_id: UUID | None = None,
        document_id: UUID | None = None,
        limit: int,
    ) -> list[DocumentChunk]:
        stmt = select(DocumentChunkOrm).where(DocumentChunkOrm.embedding.is_not(None))
        if document_id is not None:
            stmt = stmt.where(DocumentChunkOrm.document_id == document_id)
        elif document_db_id is not None:
            stmt = stmt.join(
                DocumentOrm, DocumentChunkOrm.document_id == DocumentOrm.id
            ).where(DocumentOrm.document_db_id == document_db_id)
        stmt = stmt.order_by(DocumentChunkOrm.embedding.cosine_distance(embedding)).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_chunk(o) for o in rows]
