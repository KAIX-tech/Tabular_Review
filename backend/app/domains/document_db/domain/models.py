"""Domain models for the document_db context.

Framework-agnostic entities/value objects (no SQLAlchemy, FastAPI, or HTTP).
A DocumentDB is the aggregate root: a document type/domain that owns an
extraction schema (its DocumentColumns) and - from Phase 2 - its documents.
See docs/domain-design.md §2.2-2.3.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class ColumnDataType(str, Enum):
    """Extraction column value type. Mirrors docs/domain-design.md §2.3."""

    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    LIST = "list"
    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"


@dataclass
class DocumentDb:
    """A document type/domain - owns columns (and later documents)."""

    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


@dataclass
class DocumentDbSummary:
    """A DocumentDb plus aggregate counts for list views."""

    document_db: DocumentDb
    document_count: int
    column_count: int


@dataclass
class DocumentColumn:
    """One column of the extraction grid, scoped to a DocumentDb."""

    id: UUID
    document_db_id: UUID
    name: str
    data_type: ColumnDataType
    prompt: str
    options: list[str] | None
    position: int
    created_at: datetime
    updated_at: datetime


@dataclass
class ColumnTemplate:
    """A reusable column definition (Column Library).

    A firm-wide, un-parented column config: same fields as DocumentColumn minus
    DB scoping/position. Selecting one creates a real DocumentColumn. Global in
    v1 (no identity yet); see docs/domain-design.md §2.3a / §9 #19.
    """

    id: UUID
    name: str
    data_type: ColumnDataType
    prompt: str
    category: str | None
    options: list[str] | None
    created_at: datetime


@dataclass
class ColumnTemplateDraft:
    """An unsaved template (bulk add: JSON import + localStorage migration)."""

    name: str
    data_type: ColumnDataType
    prompt: str
    category: str | None = None
    options: list[str] | None = None
