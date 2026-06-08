"""Ports (repository interfaces) + domain errors for the document_db context.

The application service depends on these abstractions; infrastructure provides the
SQLAlchemy adapters. Partial updates are expressed as a ``changes`` mapping so the
PATCH semantics (only provided fields change) live in one place.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

from app.domains.document_db.domain.models import (
    ColumnDataType,
    DocumentColumn,
    DocumentDb,
    DocumentDbSummary,
)


class DocumentDbNotFoundError(Exception):
    """Raised when a DocumentDb does not exist."""


class DocumentColumnNotFoundError(Exception):
    """Raised when a DocumentColumn does not exist."""


class InvalidColumnOrderError(Exception):
    """Raised when a reorder payload is not an exact permutation of a DB's columns."""


class DocumentDbRepository(ABC):
    @abstractmethod
    async def list_summaries(self) -> list[DocumentDbSummary]:
        raise NotImplementedError

    @abstractmethod
    async def get(self, db_id: UUID) -> DocumentDb | None:
        raise NotImplementedError

    @abstractmethod
    async def get_summary(self, db_id: UUID) -> DocumentDbSummary | None:
        raise NotImplementedError

    @abstractmethod
    async def add(self, *, name: str, description: str | None) -> DocumentDb:
        raise NotImplementedError

    @abstractmethod
    async def update(self, db_id: UUID, changes: dict[str, Any]) -> DocumentDb:
        """Apply provided fields. Raises DocumentDbNotFoundError if absent."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, db_id: UUID) -> None:
        """Delete (cascades to columns). Raises DocumentDbNotFoundError if absent."""
        raise NotImplementedError


class DocumentColumnRepository(ABC):
    @abstractmethod
    async def list_by_db(self, db_id: UUID) -> list[DocumentColumn]:
        raise NotImplementedError

    @abstractmethod
    async def get(self, column_id: UUID) -> DocumentColumn | None:
        raise NotImplementedError

    @abstractmethod
    async def add(
        self,
        db_id: UUID,
        *,
        name: str,
        data_type: ColumnDataType,
        prompt: str,
        options: list[str] | None,
    ) -> DocumentColumn:
        """Append a column (position = current max + 1)."""
        raise NotImplementedError

    @abstractmethod
    async def update(self, column_id: UUID, changes: dict[str, Any]) -> DocumentColumn:
        """Apply provided fields. Raises DocumentColumnNotFoundError if absent."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, column_id: UUID) -> None:
        """Raises DocumentColumnNotFoundError if absent."""
        raise NotImplementedError

    @abstractmethod
    async def reorder(self, db_id: UUID, ordered_ids: list[UUID]) -> list[DocumentColumn]:
        """Set positions to match ``ordered_ids`` order; returns columns in new order."""
        raise NotImplementedError
