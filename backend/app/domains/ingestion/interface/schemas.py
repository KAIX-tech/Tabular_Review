"""HTTP DTOs for the ingestion context (camelCase wire shape)."""

from __future__ import annotations

from uuid import UUID

from app.core.schemas import CamelModel, IsoDatetime
from app.domains.ingestion.domain.models import Document, DocumentStatus


class DocumentResponse(CamelModel):
    id: UUID
    document_db_id: UUID
    name: str
    mime_type: str
    size_bytes: int
    page_count: int | None
    status: DocumentStatus
    error: str | None
    created_at: IsoDatetime
    updated_at: IsoDatetime

    @classmethod
    def from_domain(cls, doc: Document) -> "DocumentResponse":
        return cls(
            id=doc.id,
            document_db_id=doc.document_db_id,
            name=doc.name,
            mime_type=doc.mime_type,
            size_bytes=doc.size_bytes,
            page_count=doc.page_count,
            status=doc.status,
            error=doc.error,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )


class DocumentContentResponse(CamelModel):
    markdown: str
