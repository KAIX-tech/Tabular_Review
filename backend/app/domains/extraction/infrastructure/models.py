"""SQLAlchemy ORM models for the extraction context (docs/domain-design.md §5)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

_RUN_STATUSES = ("queued", "running", "completed", "failed", "canceled")
_EXTRACTION_STATUSES = ("idle", "queued", "running", "done", "error")
_REVIEW_STATUSES = ("unreviewed", "verified", "edited", "rejected")
_CONFIDENCES = ("high", "medium", "low")
_METHODS = ("full_context", "retrieval_fallback")


class ExtractionRunOrm(Base):
    __tablename__ = "extraction_run"
    __table_args__ = (
        CheckConstraint("status IN " + str(_RUN_STATUSES), name="ck_extraction_run_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    document_db_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("document_db.id", ondelete="CASCADE"), nullable=False
    )
    scope: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued")
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    done: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CellOrm(Base):
    __tablename__ = "cell"
    __table_args__ = (
        UniqueConstraint("document_id", "column_id", name="uq_cell_doc_col"),
        CheckConstraint("confidence IN " + str(_CONFIDENCES), name="ck_cell_confidence"),
        CheckConstraint("extraction_method IN " + str(_METHODS), name="ck_cell_method"),
        CheckConstraint(
            "extraction_status IN " + str(_EXTRACTION_STATUSES), name="ck_cell_extraction_status"
        ),
        CheckConstraint("review_status IN " + str(_REVIEW_STATUSES), name="ck_cell_review_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("document.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("document_column.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_json: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_status: Mapped[str] = mapped_column(Text, nullable=False, default="idle")
    review_status: Mapped[str] = mapped_column(Text, nullable=False, default="unreviewed")
    last_run_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("extraction_run.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sources: Mapped[list["CellSourceOrm"]] = relationship(
        back_populates="cell", cascade="all, delete-orphan", order_by="CellSourceOrm.created_at"
    )


class CellSourceOrm(Base):
    __tablename__ = "cell_source"

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    cell_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("cell.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("document_chunk.id", ondelete="SET NULL"),
        nullable=True,
    )
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cell: Mapped[CellOrm] = relationship(back_populates="sources")
