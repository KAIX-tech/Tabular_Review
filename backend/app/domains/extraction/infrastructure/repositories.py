"""SQLAlchemy repository adapters for the extraction context."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import column, select, table
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.extraction.domain.models import (
    Cell,
    CellSource,
    Confidence,
    ExtractionMethod,
    ExtractionRun,
    ExtractionStatus,
    ReviewStatus,
    RunStatus,
)
from app.domains.extraction.domain.ports import (
    CellNotFoundError,
    CellRepository,
    ExtractionRunNotFoundError,
    ExtractionRunRepository,
    NewCellSource,
)
from app.domains.extraction.infrastructure.models import (
    CellOrm,
    CellSourceOrm,
    ExtractionRunOrm,
)

# Lightweight ref to ingestion's document table (avoid importing its ORM).
_document_tbl = table("document", column("id"), column("document_db_id"))


def _to_source(orm: CellSourceOrm) -> CellSource:
    return CellSource(
        id=orm.id, cell_id=orm.cell_id, chunk_id=orm.chunk_id, quote=orm.quote, page=orm.page,
        char_start=orm.char_start, char_end=orm.char_end,
    )


def _to_cell(orm: CellOrm) -> Cell:
    return Cell(
        id=orm.id,
        document_id=orm.document_id,
        column_id=orm.column_id,
        value=orm.value,
        value_json=orm.value_json,
        confidence=Confidence(orm.confidence) if orm.confidence else None,
        reasoning=orm.reasoning,
        extraction_method=ExtractionMethod(orm.extraction_method) if orm.extraction_method else None,
        extraction_status=ExtractionStatus(orm.extraction_status),
        review_status=ReviewStatus(orm.review_status),
        last_run_id=orm.last_run_id,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
        sources=[_to_source(s) for s in orm.sources],
    )


def _to_run(orm: ExtractionRunOrm) -> ExtractionRun:
    return ExtractionRun(
        id=orm.id,
        document_db_id=orm.document_db_id,
        scope=orm.scope,
        model=orm.model,
        status=RunStatus(orm.status),
        total=orm.total,
        done=orm.done,
        failed=orm.failed,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


class SqlAlchemyCellRepository(CellRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _get_orm(self, document_id: UUID, column_id: UUID) -> CellOrm | None:
        stmt = (
            select(CellOrm)
            .options(selectinload(CellOrm.sources))
            .where(CellOrm.document_id == document_id, CellOrm.column_id == column_id)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def list_by_db(self, document_db_id: UUID) -> list[Cell]:
        doc_ids = select(_document_tbl.c.id).where(
            _document_tbl.c.document_db_id == document_db_id
        )
        stmt = (
            select(CellOrm)
            .options(selectinload(CellOrm.sources))
            .where(CellOrm.document_id.in_(doc_ids))
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_cell(o) for o in rows]

    async def list_by_document(self, document_id: UUID) -> list[Cell]:
        stmt = (
            select(CellOrm)
            .options(selectinload(CellOrm.sources))
            .where(CellOrm.document_id == document_id)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_cell(o) for o in rows]

    async def get(self, cell_id: UUID) -> Cell | None:
        stmt = select(CellOrm).options(selectinload(CellOrm.sources)).where(CellOrm.id == cell_id)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return _to_cell(orm) if orm is not None else None

    async def set_running(self, document_id: UUID, column_id: UUID, run_id: UUID) -> None:
        # Atomic upsert keyed by uq_cell_doc_col: creates the cell row (or flips an
        # existing one to running) in one statement, avoiding a check-then-insert
        # race between concurrent runs. save_result/set_error always run after this.
        stmt = (
            pg_insert(CellOrm)
            .values(
                document_id=document_id,
                column_id=column_id,
                extraction_status=ExtractionStatus.RUNNING.value,
                review_status=ReviewStatus.UNREVIEWED.value,
                last_run_id=run_id,
            )
            .on_conflict_do_update(
                index_elements=["document_id", "column_id"],
                set_={
                    "extraction_status": ExtractionStatus.RUNNING.value,
                    "last_run_id": run_id,
                },
            )
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def save_result(
        self,
        document_id: UUID,
        column_id: UUID,
        *,
        value: str | None,
        value_json: Any | None,
        confidence: Confidence | None,
        reasoning: str | None,
        extraction_method: ExtractionMethod,
        run_id: UUID,
        sources: list[NewCellSource],
    ) -> Cell:
        orm = await self._get_orm(document_id, column_id)
        if orm is None:
            orm = CellOrm(document_id=document_id, column_id=column_id)
            self._session.add(orm)
        orm.value = value
        orm.value_json = value_json
        orm.confidence = confidence.value if confidence else None
        orm.reasoning = reasoning
        orm.extraction_method = extraction_method.value
        orm.extraction_status = ExtractionStatus.DONE.value
        orm.review_status = ReviewStatus.UNREVIEWED.value
        orm.last_run_id = run_id
        orm.sources = [
            CellSourceOrm(
                chunk_id=s.chunk_id, quote=s.quote, page=s.page,
                char_start=s.char_start, char_end=s.char_end,
            )
            for s in sources
        ]
        await self._session.flush()
        # Re-query with selectinload so `sources` is loaded async-safely for mapping.
        refreshed = await self._get_orm(document_id, column_id)
        return _to_cell(refreshed if refreshed is not None else orm)

    async def set_error(self, document_id: UUID, column_id: UUID, run_id: UUID) -> None:
        orm = await self._get_orm(document_id, column_id)
        if orm is None:
            orm = CellOrm(document_id=document_id, column_id=column_id)
            self._session.add(orm)
        orm.extraction_status = ExtractionStatus.ERROR.value
        orm.last_run_id = run_id
        await self._session.flush()

    async def update_review(
        self,
        cell_id: UUID,
        *,
        value: str | None,
        value_json: Any | None,
        review_status: ReviewStatus,
    ) -> Cell:
        stmt = select(CellOrm).options(selectinload(CellOrm.sources)).where(CellOrm.id == cell_id)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            raise CellNotFoundError(str(cell_id))
        if value is not None:
            orm.value = value
        if value_json is not None:
            orm.value_json = value_json
        orm.review_status = review_status.value
        await self._session.flush()
        return _to_cell(orm)


class SqlAlchemyExtractionRunRepository(ExtractionRunRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(
        self, document_db_id: UUID, *, scope: dict[str, Any], model: str, total: int
    ) -> ExtractionRun:
        orm = ExtractionRunOrm(
            document_db_id=document_db_id,
            scope=scope,
            model=model,
            total=total,
            status=RunStatus.QUEUED.value,
        )
        self._session.add(orm)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_run(orm)

    async def get(self, run_id: UUID) -> ExtractionRun | None:
        orm = await self._session.get(ExtractionRunOrm, run_id)
        return _to_run(orm) if orm is not None else None

    async def set_status(self, run_id: UUID, status: RunStatus) -> None:
        orm = await self._session.get(ExtractionRunOrm, run_id)
        if orm is None:
            raise ExtractionRunNotFoundError(str(run_id))
        orm.status = status.value
        await self._session.flush()

    async def bump(self, run_id: UUID, *, done: int = 0, failed: int = 0) -> None:
        orm = await self._session.get(ExtractionRunOrm, run_id)
        if orm is None:
            raise ExtractionRunNotFoundError(str(run_id))
        orm.done += done
        orm.failed += failed
        await self._session.flush()
