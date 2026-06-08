"""Application service (use cases) for the document_db context.

Thin orchestration over the repository ports. Enforces aggregate invariants
(e.g. a column always belongs to an existing DocumentDb) and translates "missing"
into domain errors the interface layer maps to HTTP 404.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.logging import get_logger
from app.domains.document_db.domain.models import (
    ColumnDataType,
    DocumentColumn,
    DocumentDbSummary,
)
from app.domains.document_db.domain.ports import (
    DocumentColumnNotFoundError,
    DocumentColumnRepository,
    DocumentDbNotFoundError,
    DocumentDbRepository,
)

logger = get_logger(__name__)


class DocumentDbService:
    def __init__(
        self,
        db_repo: DocumentDbRepository,
        column_repo: DocumentColumnRepository,
    ) -> None:
        self._db_repo = db_repo
        self._column_repo = column_repo

    # --- DocumentDb ---------------------------------------------------------
    async def list_document_dbs(self) -> list[DocumentDbSummary]:
        return await self._db_repo.list_summaries()

    async def get_document_db(self, db_id: UUID) -> DocumentDbSummary:
        summary = await self._db_repo.get_summary(db_id)
        if summary is None:
            raise DocumentDbNotFoundError(str(db_id))
        return summary

    async def create_document_db(
        self, *, name: str, description: str | None
    ) -> DocumentDbSummary:
        logger.info("Creating DocumentDb name=%s", name)
        db = await self._db_repo.add(name=name, description=description)
        # A new DB has no columns/documents yet.
        return DocumentDbSummary(document_db=db, document_count=0, column_count=0)

    async def update_document_db(
        self, db_id: UUID, changes: dict[str, Any]
    ) -> DocumentDbSummary:
        if changes:
            await self._db_repo.update(db_id, changes)  # 404 if missing
        return await self.get_document_db(db_id)

    async def delete_document_db(self, db_id: UUID) -> None:
        await self._db_repo.delete(db_id)

    async def _ensure_db_exists(self, db_id: UUID) -> None:
        if await self._db_repo.get(db_id) is None:
            raise DocumentDbNotFoundError(str(db_id))

    # --- DocumentColumn -----------------------------------------------------
    async def list_columns(self, db_id: UUID) -> list[DocumentColumn]:
        await self._ensure_db_exists(db_id)
        return await self._column_repo.list_by_db(db_id)

    async def add_column(
        self,
        db_id: UUID,
        *,
        name: str,
        data_type: ColumnDataType,
        prompt: str,
        options: list[str] | None,
    ) -> DocumentColumn:
        await self._ensure_db_exists(db_id)
        return await self._column_repo.add(
            db_id, name=name, data_type=data_type, prompt=prompt, options=options
        )

    async def update_column(self, column_id: UUID, changes: dict[str, Any]) -> DocumentColumn:
        if not changes:
            column = await self._column_repo.get(column_id)
            if column is None:
                raise DocumentColumnNotFoundError(str(column_id))
            return column
        return await self._column_repo.update(column_id, changes)

    async def delete_column(self, column_id: UUID) -> None:
        await self._column_repo.delete(column_id)

    async def reorder_columns(
        self, db_id: UUID, ordered_ids: list[UUID]
    ) -> list[DocumentColumn]:
        await self._ensure_db_exists(db_id)
        return await self._column_repo.reorder(db_id, ordered_ids)
