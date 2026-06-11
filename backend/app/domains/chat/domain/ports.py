"""Ports (repository interface) + domain errors for the chat context.

The application service depends on these abstractions; infrastructure provides
the SQLAlchemy adapter. Message-write methods exist alongside session CRUD
because the agent runner (Phase 4 PR-B) persists the user message *before* the
run and the assistant message only on success (plan D9).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

from app.domains.chat.domain.models import (
    ChatMessage,
    ChatSession,
    ChatSessionDetail,
    ChatSourceDraft,
    ChatStep,
)


class ChatSessionNotFoundError(Exception):
    """Raised when a ChatSession does not exist."""


class ScopeDocumentDbNotFoundError(Exception):
    """Raised when a session's scope references a DocumentDB that does not exist."""


class SessionBusyError(Exception):
    """Raised when a session already has an agent run in flight (HTTP 409, D9)."""


class AgentRunError(Exception):
    """Raised when an agent run fails — surfaced as the SSE `error` event (D9).

    The user message is already persisted by then; no assistant message is saved.
    """


class AgentToolset(ABC):
    """Read-only catalog tools the chat agent can call (docs §2.13, plan §2.1).

    Implementations adapt other contexts' read ports (document_db / ingestion /
    extraction) — composed in main.py; chat never imports their infrastructure.
    Every method returns JSON-serializable payloads, already capped per D11
    (tool-result token cap, get_document slicing, query_cells row caps); ids in
    payloads are the strings the agent may cite as `[chunk:<id>]`/`[cell:<id>]`.
    """

    @abstractmethod
    async def list_document_dbs(self) -> list[dict[str, Any]]:
        """[{id, name, description, columnCount, documentCount}]"""
        raise NotImplementedError

    @abstractmethod
    async def list_columns(self, document_db_id: UUID) -> list[dict[str, Any]]:
        """Extraction schema of one DB: [{id, name, dataType, prompt}]"""
        raise NotImplementedError

    @abstractmethod
    async def list_documents(self, document_db_id: UUID) -> list[dict[str, Any]]:
        """[{id, name, status}]"""
        raise NotImplementedError

    @abstractmethod
    async def query_cells(
        self, document_db_id: UUID, column_ids: list[UUID] | None = None
    ) -> dict[str, Any]:
        """Extraction grid values: {columns, rows:[{documentId, documentName,
        cells:{columnName:{cellId, value, confidence, reviewStatus}}}], truncated}.
        """
        raise NotImplementedError

    @abstractmethod
    async def search_chunks(
        self,
        query: str,
        *,
        document_db_id: UUID | None = None,
        document_id: UUID | None = None,
        k: int | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic chunk search (§2.12 pipeline): [{chunkId, documentId,
        documentName, page, quote}]."""
        raise NotImplementedError

    @abstractmethod
    async def get_document(
        self, document_id: UUID, *, offset: int = 0, length: int | None = None
    ) -> dict[str, Any]:
        """A slice of the document markdown (full-text returns are forbidden,
        D11): {documentId, name, totalChars, offset, length, truncated, text}."""
        raise NotImplementedError


class ChatRepository(ABC):
    # --- sessions -----------------------------------------------------------
    @abstractmethod
    async def list_sessions(self) -> list[ChatSession]:
        """All sessions, most recently active first (updated_at desc)."""
        raise NotImplementedError

    @abstractmethod
    async def get_session(self, session_id: UUID) -> ChatSession | None:
        raise NotImplementedError

    @abstractmethod
    async def get_session_detail(self, session_id: UUID) -> ChatSessionDetail | None:
        """Session + messages (with steps/sources) in chronological order."""
        raise NotImplementedError

    @abstractmethod
    async def add_session(
        self, *, title: str, scope_document_db_id: UUID | None
    ) -> ChatSession:
        """Create a session. Raises ScopeDocumentDbNotFoundError on unknown scope."""
        raise NotImplementedError

    @abstractmethod
    async def update_session(self, session_id: UUID, changes: dict[str, Any]) -> ChatSession:
        """Apply provided fields. Raises ChatSessionNotFoundError if absent."""
        raise NotImplementedError

    @abstractmethod
    async def delete_session(self, session_id: UUID) -> None:
        """Delete (cascades to messages/sources). Raises ChatSessionNotFoundError."""
        raise NotImplementedError

    # --- messages (used by the agent runner, PR-B) ---------------------------
    @abstractmethod
    async def add_user_message(self, session_id: UUID, content: str) -> ChatMessage:
        """Persist the user's question; bumps session updated_at.

        Raises ChatSessionNotFoundError if the session is absent.
        """
        raise NotImplementedError

    @abstractmethod
    async def add_assistant_message(
        self,
        session_id: UUID,
        *,
        content: str,
        steps: list[ChatStep] | None,
        sources: list[ChatSourceDraft],
    ) -> ChatMessage:
        """Persist the agent's answer with its trace + citations; bumps updated_at.

        Raises ChatSessionNotFoundError if the session is absent.
        """
        raise NotImplementedError
