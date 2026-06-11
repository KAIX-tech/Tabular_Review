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
