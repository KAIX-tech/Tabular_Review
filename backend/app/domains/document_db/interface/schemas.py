"""HTTP DTOs for the document_db context.

Wire shape is **camelCase** to match the frontend Zod schemas
(docs/domain-design.md §7). Request bodies accept camelCase (via alias) and
responses serialize camelCase (FastAPI uses by_alias by default). Datetimes are
emitted as RFC3339 with a `Z` suffix so the frontend's `z.string().datetime()`
accepts them.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel

from app.domains.document_db.domain.models import (
    ColumnDataType,
    DocumentColumn,
    DocumentDbSummary,
)

IsoDatetime = Annotated[
    datetime,
    PlainSerializer(lambda dt: dt.isoformat().replace("+00:00", "Z"), return_type=str),
]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --- DocumentDb ------------------------------------------------------------
class DocumentDbCreate(CamelModel):
    name: str
    description: str | None = None


class DocumentDbUpdate(CamelModel):
    name: str | None = None
    description: str | None = None


class DocumentDbResponse(CamelModel):
    """Canonical DocumentDb wire shape — used for list, get, create, and update.

    Mirrors the frontend `documentDbSchema` (docs/domain-design.md §7), so one
    schema covers every DocumentDb response. `documentCount` is 0 until the
    ingestion context (Phase 2).
    """

    id: UUID
    name: str
    description: str | None
    document_count: int
    column_count: int
    updated_at: IsoDatetime

    @classmethod
    def from_domain(cls, summary: DocumentDbSummary) -> "DocumentDbResponse":
        db = summary.document_db
        return cls(
            id=db.id,
            name=db.name,
            description=db.description,
            document_count=summary.document_count,
            column_count=summary.column_count,
            updated_at=db.updated_at,
        )


# --- DocumentColumn --------------------------------------------------------
class ColumnCreate(CamelModel):
    name: str
    data_type: ColumnDataType
    prompt: str
    options: list[str] | None = None


class ColumnUpdate(CamelModel):
    name: str | None = None
    data_type: ColumnDataType | None = None
    prompt: str | None = None
    options: list[str] | None = None


class ColumnReorder(CamelModel):
    order: list[UUID]


class ColumnResponse(CamelModel):
    id: UUID
    document_db_id: UUID
    name: str
    data_type: ColumnDataType
    prompt: str
    options: list[str] | None
    position: int
    created_at: IsoDatetime
    updated_at: IsoDatetime

    @classmethod
    def from_domain(cls, column: DocumentColumn) -> "ColumnResponse":
        return cls(
            id=column.id,
            document_db_id=column.document_db_id,
            name=column.name,
            data_type=column.data_type,
            prompt=column.prompt,
            options=column.options,
            position=column.position,
            created_at=column.created_at,
            updated_at=column.updated_at,
        )
