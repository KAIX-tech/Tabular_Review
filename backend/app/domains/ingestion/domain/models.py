"""Domain models for the ingestion context (docs/domain-design.md §2.4-2.5, §3.1).

Framework-agnostic. A Document is an uploaded file that moves through a
conversion/chunking/embedding pipeline; DocumentChunk is the retrieval unit.
Large fields (markdown text, embedding vectors) are not carried on these entities
- they are fetched/written through dedicated repository methods.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    CONVERTING = "converting"
    CHUNKING = "chunking"
    READY = "ready"
    FAILED = "failed"


@dataclass
class Document:
    id: UUID
    document_db_id: UUID
    name: str
    mime_type: str
    size_bytes: int
    storage_uri: str
    page_count: int | None
    status: DocumentStatus
    error: str | None
    created_at: datetime
    updated_at: datetime


@dataclass
class DocumentChunk:
    id: UUID
    document_id: UUID
    index: int
    text: str
    page: int | None
