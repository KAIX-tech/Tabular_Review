"""Application service (request-scoped) for the extraction context.

Creates extraction runs (resolving scope), serves the grid's cells, and applies
human verification. The heavy convert/generate work runs in the background — see
:class:`app.domains.extraction.application.processor.ExtractionProcessor`.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.logging import get_logger
from app.domains.document_db.domain.ports import DocumentColumnRepository
from app.domains.extraction.domain.models import Cell, ExtractionRun, ReviewStatus
from app.domains.extraction.domain.ports import (
    CellNotFoundError,
    CellRepository,
    ExtractionRunNotFoundError,
    ExtractionRunRepository,
)
from app.domains.ingestion.domain.models import DocumentStatus
from app.domains.ingestion.domain.ports import DocumentRepository

logger = get_logger(__name__)


class ExtractionService:
    def __init__(
        self,
        cell_repo: CellRepository,
        run_repo: ExtractionRunRepository,
        document_repo: DocumentRepository,
        column_repo: DocumentColumnRepository,
    ) -> None:
        self._cells = cell_repo
        self._runs = run_repo
        self._documents = document_repo
        self._columns = column_repo

    async def list_cells(self, document_db_id: UUID) -> list[Cell]:
        return await self._cells.list_by_db(document_db_id)

    async def get_run(self, run_id: UUID) -> ExtractionRun:
        run = await self._runs.get(run_id)
        if run is None:
            raise ExtractionRunNotFoundError(str(run_id))
        return run

    async def create_run(
        self,
        document_db_id: UUID,
        *,
        document_ids: list[UUID] | None,
        column_ids: list[UUID] | None,
        overwrite_reviewed: bool,
        model: str,
    ) -> ExtractionRun:
        # Resolve scope: only READY documents are extractable.
        all_docs = await self._documents.list_by_db(document_db_id)
        ready = {d.id for d in all_docs if d.status == DocumentStatus.READY}
        doc_ids = [d for d in (document_ids or list(ready)) if d in ready]

        all_cols = await self._columns.list_by_db(document_db_id)
        col_set = {c.id for c in all_cols}
        col_ids = [c for c in (column_ids or list(col_set)) if c in col_set]

        total = len(doc_ids) * len(col_ids)
        run = await self._runs.add(
            document_db_id,
            scope={
                "documentIds": [str(d) for d in doc_ids],
                "columnIds": [str(c) for c in col_ids],
                "overwriteReviewed": overwrite_reviewed,
            },
            model=model,
            total=total,
        )
        logger.info("Created extraction run=%s docs=%d cols=%d", run.id, len(doc_ids), len(col_ids))
        return run

    async def update_review(
        self,
        cell_id: UUID,
        *,
        value: str | None,
        value_json: Any | None,
        review_status: ReviewStatus,
    ) -> Cell:
        return await self._cells.update_review(
            cell_id, value=value, value_json=value_json, review_status=review_status
        )

    async def get_cell(self, cell_id: UUID) -> Cell:
        cell = await self._cells.get(cell_id)
        if cell is None:
            raise CellNotFoundError(str(cell_id))
        return cell
