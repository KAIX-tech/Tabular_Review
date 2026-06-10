"""Domain models for the extraction context (docs/domain-design.md §2.6-2.8).

A Cell is the (Document x DocumentColumn) extraction result; CellSource grounds it
in chunks; ExtractionRun is one "Run" batch job. Framework-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ExtractionStatus(str, Enum):
    IDLE = "idle"
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


class ReviewStatus(str, Enum):
    UNREVIEWED = "unreviewed"
    VERIFIED = "verified"
    EDITED = "edited"
    REJECTED = "rejected"


class ExtractionMethod(str, Enum):
    FULL_CONTEXT = "full_context"
    RETRIEVAL_FALLBACK = "retrieval_fallback"


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass
class CellSource:
    id: UUID
    cell_id: UUID
    chunk_id: UUID | None
    quote: str
    page: int | None
    # Character offsets of `quote` within the document markdown (for highlighting).
    char_start: int | None = None
    char_end: int | None = None


@dataclass
class Cell:
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
    last_run_id: UUID | None
    created_at: datetime
    updated_at: datetime
    sources: list[CellSource] = field(default_factory=list)


@dataclass
class ExtractionRun:
    id: UUID
    document_db_id: UUID
    scope: dict[str, Any]
    model: str
    status: RunStatus
    total: int
    done: int
    failed: int
    created_at: datetime
    updated_at: datetime
