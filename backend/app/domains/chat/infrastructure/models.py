"""SQLAlchemy ORM models for the chat context.

Map the domain to the `chat_session` / `chat_message` / `chat_source` tables
(docs/domain-design.md §5). They live in infrastructure; the domain layer never
imports them. Alembic discovers them via migrations/env.py.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ChatSessionOrm(Base):
    __tablename__ = "chat_session"

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    title: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'새 대화'"))
    scope_document_db_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("document_db.id", ondelete="SET NULL"),
        nullable=True,
    )
    # FK to app_user added when the identity context lands (docs §2.9, plan D6).
    created_by: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    messages: Mapped[list["ChatMessageOrm"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessageOrm.created_at",
    )


class ChatMessageOrm(Base):
    __tablename__ = "chat_message"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name="ck_chat_message_role"),
        Index("ix_chat_message_session_created", "session_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("chat_session.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Agent tool-call trace: [{step, tool, args, summary}] (docs §2.10).
    steps: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[ChatSessionOrm] = relationship(back_populates="messages")
    sources: Mapped[list["ChatSourceOrm"]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="ChatSourceOrm.rank",
    )


class ChatSourceOrm(Base):
    __tablename__ = "chat_source"
    __table_args__ = (
        # chunk = unstructured citation, cell = structured; at least one (docs §2.11).
        CheckConstraint(
            "chunk_id IS NOT NULL OR cell_id IS NOT NULL", name="ck_chat_source_target"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("chat_message.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("document_chunk.id", ondelete="SET NULL"),
        nullable=True,
    )
    cell_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("cell.id", ondelete="SET NULL"),
        nullable=True,
    )
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    message: Mapped[ChatMessageOrm] = relationship(back_populates="sources")
