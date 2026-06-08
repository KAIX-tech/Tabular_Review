"""SQLAlchemy repository adapters for the document_db context."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.document_db.domain.models import (
    ColumnDataType,
    DocumentColumn,
    DocumentDb,
    DocumentDbSummary,
)
from app.domains.document_db.domain.ports import (
    DocumentColumnNotFoundError,
    DocumentColumnRepository,
    DocumentDbNotFoundError,
    DocumentDbRepository,
)
from app.domains.document_db.infrastructure.models import DocumentColumnOrm, DocumentDbOrm

# Fields that PATCH may change, per entity (guards the changes mapping).
_DB_UPDATABLE = {"name", "description"}
_COLUMN_UPDATABLE = {"name", "data_type", "prompt", "options"}


def _to_db(orm: DocumentDbOrm) -> DocumentDb:
    return DocumentDb(
        id=orm.id,
        name=orm.name,
        description=orm.description,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _to_column(orm: DocumentColumnOrm) -> DocumentColumn:
    return DocumentColumn(
        id=orm.id,
        document_db_id=orm.document_db_id,
        name=orm.name,
        data_type=ColumnDataType(orm.data_type),
        prompt=orm.prompt,
        options=orm.options,
        position=orm.position,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _coerce(value: Any) -> Any:
    return value.value if isinstance(value, ColumnDataType) else value


class SqlAlchemyDocumentDbRepository(DocumentDbRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_summaries(self) -> list[DocumentDbSummary]:
        col_counts = (
            select(
                DocumentColumnOrm.document_db_id.label("db_id"),
                func.count().label("cnt"),
            )
            .group_by(DocumentColumnOrm.document_db_id)
            .subquery()
        )
        stmt = (
            select(DocumentDbOrm, func.coalesce(col_counts.c.cnt, 0))
            .outerjoin(col_counts, DocumentDbOrm.id == col_counts.c.db_id)
            .order_by(DocumentDbOrm.updated_at.desc())
        )
        rows = (await self._session.execute(stmt)).all()
        # document_count is 0 until the ingestion context (Phase 2) adds documents.
        return [
            DocumentDbSummary(document_db=_to_db(orm), document_count=0, column_count=int(cnt))
            for orm, cnt in rows
        ]

    async def get(self, db_id: UUID) -> DocumentDb | None:
        orm = await self._session.get(DocumentDbOrm, db_id)
        return _to_db(orm) if orm is not None else None

    async def get_summary(self, db_id: UUID) -> DocumentDbSummary | None:
        orm = await self._session.get(DocumentDbOrm, db_id)
        if orm is None:
            return None
        column_count = (
            await self._session.execute(
                select(func.count()).where(DocumentColumnOrm.document_db_id == db_id)
            )
        ).scalar_one()
        # document_count is 0 until the ingestion context (Phase 2) adds documents.
        return DocumentDbSummary(
            document_db=_to_db(orm), document_count=0, column_count=int(column_count)
        )

    async def add(self, *, name: str, description: str | None) -> DocumentDb:
        orm = DocumentDbOrm(name=name, description=description)
        self._session.add(orm)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_db(orm)

    async def update(self, db_id: UUID, changes: dict[str, Any]) -> DocumentDb:
        orm = await self._session.get(DocumentDbOrm, db_id)
        if orm is None:
            raise DocumentDbNotFoundError(str(db_id))
        for key, value in changes.items():
            if key in _DB_UPDATABLE:
                setattr(orm, key, value)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_db(orm)

    async def delete(self, db_id: UUID) -> None:
        orm = await self._session.get(DocumentDbOrm, db_id)
        if orm is None:
            raise DocumentDbNotFoundError(str(db_id))
        await self._session.delete(orm)
        await self._session.flush()


class SqlAlchemyDocumentColumnRepository(DocumentColumnRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_db(self, db_id: UUID) -> list[DocumentColumn]:
        stmt = (
            select(DocumentColumnOrm)
            .where(DocumentColumnOrm.document_db_id == db_id)
            .order_by(DocumentColumnOrm.position)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_column(orm) for orm in rows]

    async def get(self, column_id: UUID) -> DocumentColumn | None:
        orm = await self._session.get(DocumentColumnOrm, column_id)
        return _to_column(orm) if orm is not None else None

    async def add(
        self,
        db_id: UUID,
        *,
        name: str,
        data_type: ColumnDataType,
        prompt: str,
        options: list[str] | None,
    ) -> DocumentColumn:
        max_pos = (
            await self._session.execute(
                select(func.coalesce(func.max(DocumentColumnOrm.position), -1)).where(
                    DocumentColumnOrm.document_db_id == db_id
                )
            )
        ).scalar_one()
        orm = DocumentColumnOrm(
            document_db_id=db_id,
            name=name,
            data_type=data_type.value,
            prompt=prompt,
            options=options,
            position=int(max_pos) + 1,
        )
        self._session.add(orm)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_column(orm)

    async def update(self, column_id: UUID, changes: dict[str, Any]) -> DocumentColumn:
        orm = await self._session.get(DocumentColumnOrm, column_id)
        if orm is None:
            raise DocumentColumnNotFoundError(str(column_id))
        for key, value in changes.items():
            if key in _COLUMN_UPDATABLE:
                setattr(orm, key, _coerce(value))
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_column(orm)

    async def delete(self, column_id: UUID) -> None:
        orm = await self._session.get(DocumentColumnOrm, column_id)
        if orm is None:
            raise DocumentColumnNotFoundError(str(column_id))
        await self._session.delete(orm)
        await self._session.flush()

    async def reorder(self, db_id: UUID, ordered_ids: list[UUID]) -> list[DocumentColumn]:
        stmt = select(DocumentColumnOrm).where(DocumentColumnOrm.document_db_id == db_id)
        by_id = {orm.id: orm for orm in (await self._session.execute(stmt)).scalars().all()}
        missing = [cid for cid in ordered_ids if cid not in by_id]
        if missing:
            raise DocumentColumnNotFoundError(str(missing[0]))
        for position, column_id in enumerate(ordered_ids):
            by_id[column_id].position = position
        await self._session.flush()
        return await self.list_by_db(db_id)
