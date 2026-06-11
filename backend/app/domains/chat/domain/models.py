"""Domain models for the chat context.

Framework-agnostic entities/value objects (no SQLAlchemy, FastAPI, LangChain).
A ChatSession is the aggregate root: an Agentic Search conversation that owns
its messages; assistant messages carry the agent's tool-call trace (steps) and
citations (sources). See docs/domain-design.md §2.9-2.11 and
docs/phase-4-chat-plan.md (D3-D5, D9-D10).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

DEFAULT_SESSION_TITLE = "새 대화"


class ChatRole(str, Enum):
    """Message author. The frontend's legacy "model" role maps to ASSISTANT."""

    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class ChatStep:
    """One agent tool call in an assistant message's trace (§2.10 ``steps``)."""

    step: int
    tool: str
    args: dict[str, Any]
    summary: str


@dataclass
class ChatSourceDraft:
    """A citation to attach to an assistant message being persisted.

    Exactly which target is set decides the kind: ``chunk_id`` = unstructured
    (original passage), ``cell_id`` = structured (extracted grid value). At
    least one must be present (mirrors the chat_source check constraint).
    """

    chunk_id: UUID | None
    cell_id: UUID | None
    quote: str
    page: int | None
    rank: int

    def __post_init__(self) -> None:
        if self.chunk_id is None and self.cell_id is None:
            raise ValueError("ChatSourceDraft requires chunk_id or cell_id")


@dataclass
class ChatSource:
    """A persisted citation of an assistant message (§2.11)."""

    id: UUID
    message_id: UUID
    chunk_id: UUID | None
    cell_id: UUID | None
    quote: str
    page: int | None
    rank: int
    created_at: datetime


@dataclass
class ChatMessage:
    """A message in a session. ``steps``/``sources`` are assistant-only."""

    id: UUID
    session_id: UUID
    role: ChatRole
    content: str
    steps: list[ChatStep] | None
    sources: list[ChatSource] = field(default_factory=list)
    created_at: datetime | None = None


@dataclass
class ChatSession:
    """A conversation, optionally scoped to one DocumentDB (null = global)."""

    id: UUID
    title: str
    scope_document_db_id: UUID | None
    created_at: datetime
    updated_at: datetime


@dataclass
class ChatSessionDetail:
    """A session plus its full message history (steps + sources)."""

    session: ChatSession
    messages: list[ChatMessage]
