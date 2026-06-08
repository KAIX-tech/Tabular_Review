"""Ports + errors for the extraction context."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.domains.extraction.domain.models import (
    Cell,
    Confidence,
    ExtractionMethod,
    ExtractionRun,
    ReviewStatus,
    RunStatus,
)


class CellNotFoundError(Exception):
    """Raised when a Cell does not exist."""


class ExtractionRunNotFoundError(Exception):
    """Raised when an ExtractionRun does not exist."""


@dataclass(frozen=True)
class NewCellSource:
    chunk_id: UUID | None
    quote: str
    page: int | None


class CellRepository(ABC):
    @abstractmethod
    async def list_by_db(self, document_db_id: UUID) -> list[Cell]:
        """All cells (with sources) for the DB's documents — for the grid."""
        raise NotImplementedError

    @abstractmethod
    async def list_by_document(self, document_id: UUID) -> list[Cell]:
        raise NotImplementedError

    @abstractmethod
    async def get(self, cell_id: UUID) -> Cell | None:
        raise NotImplementedError

    @abstractmethod
    async def set_running(self, document_id: UUID, column_id: UUID, run_id: UUID) -> None:
        """Upsert the cell to extraction_status=running (keeps any prior value)."""
        raise NotImplementedError

    @abstractmethod
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
        """Persist an extraction result (status=done, review_status=unreviewed) and
        replace the cell's sources."""
        raise NotImplementedError

    @abstractmethod
    async def set_error(self, document_id: UUID, column_id: UUID, run_id: UUID) -> None:
        raise NotImplementedError

    @abstractmethod
    async def update_review(
        self,
        cell_id: UUID,
        *,
        value: str | None,
        value_json: Any | None,
        review_status: ReviewStatus,
    ) -> Cell:
        """Human verification/edit (PATCH). Raises CellNotFoundError if absent."""
        raise NotImplementedError


class ExtractionRunRepository(ABC):
    @abstractmethod
    async def add(
        self, document_db_id: UUID, *, scope: dict[str, Any], model: str, total: int
    ) -> ExtractionRun:
        raise NotImplementedError

    @abstractmethod
    async def get(self, run_id: UUID) -> ExtractionRun | None:
        raise NotImplementedError

    @abstractmethod
    async def set_status(self, run_id: UUID, status: RunStatus) -> None:
        raise NotImplementedError

    @abstractmethod
    async def bump(self, run_id: UUID, *, done: int = 0, failed: int = 0) -> None:
        """Increment progress counters."""
        raise NotImplementedError
