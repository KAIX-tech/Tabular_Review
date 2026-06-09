"""HTTP DTOs for the extraction context (camelCase wire shape)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.schemas import CamelModel, IsoDatetime
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


# --- ExtractionRun ---------------------------------------------------------
class RunCreate(CamelModel):
    document_ids: list[UUID] | None = None
    column_ids: list[UUID] | None = None
    overwrite_reviewed: bool = False
    model: str | None = None


class ExtractionRunResponse(CamelModel):
    id: UUID
    document_db_id: UUID
    status: RunStatus
    total: int
    done: int
    failed: int
    created_at: IsoDatetime
    updated_at: IsoDatetime

    @classmethod
    def from_domain(cls, run: ExtractionRun) -> "ExtractionRunResponse":
        return cls(
            id=run.id,
            document_db_id=run.document_db_id,
            status=run.status,
            total=run.total,
            done=run.done,
            failed=run.failed,
            created_at=run.created_at,
            updated_at=run.updated_at,
        )


# --- Cell ------------------------------------------------------------------
class CellSourceResponse(CamelModel):
    chunk_id: UUID | None
    quote: str
    page: int | None

    @classmethod
    def from_domain(cls, src: CellSource) -> "CellSourceResponse":
        return cls(chunk_id=src.chunk_id, quote=src.quote, page=src.page)


class CellResponse(CamelModel):
    id: UUID
    document_id: UUID
    column_id: UUID
    value: str | None
    value_json: Any | None
    confidence: Confidence | None
    reasoning: str | None
    extraction_method: ExtractionMethod | None
    extraction_status: ExtractionStatus
    review_status: ReviewStatus
    sources: list[CellSourceResponse]
    created_at: IsoDatetime
    updated_at: IsoDatetime

    @classmethod
    def from_domain(cls, cell: Cell) -> "CellResponse":
        return cls(
            id=cell.id,
            document_id=cell.document_id,
            column_id=cell.column_id,
            value=cell.value,
            value_json=cell.value_json,
            confidence=cell.confidence,
            reasoning=cell.reasoning,
            extraction_method=cell.extraction_method,
            extraction_status=cell.extraction_status,
            review_status=cell.review_status,
            sources=[CellSourceResponse.from_domain(s) for s in cell.sources],
            created_at=cell.created_at,
            updated_at=cell.updated_at,
        )


class CellReview(CamelModel):
    value: str | None = None
    value_json: Any | None = None
    review_status: ReviewStatus
