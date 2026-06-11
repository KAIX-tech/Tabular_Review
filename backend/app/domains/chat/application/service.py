"""Application service (use cases) for the chat context — session CRUD.

Thin orchestration over the repository port. The agent run itself (tool loop,
SSE streaming, source finalize) lands in PR-B as a separate application module;
this service stays the single place for session/message persistence semantics.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.domains.chat.domain.models import (
    DEFAULT_SESSION_TITLE,
    ChatMessage,
    ChatSession,
    ChatSessionDetail,
    ChatSourceDraft,
    ChatStep,
)
from app.domains.chat.domain.ports import ChatRepository, ChatSessionNotFoundError


class ChatService:
    def __init__(self, repo: ChatRepository) -> None:
        self._repo = repo

    # --- sessions -----------------------------------------------------------
    async def list_sessions(self) -> list[ChatSession]:
        return await self._repo.list_sessions()

    async def get_session_detail(self, session_id: UUID) -> ChatSessionDetail:
        detail = await self._repo.get_session_detail(session_id)
        if detail is None:
            raise ChatSessionNotFoundError(str(session_id))
        return detail

    async def create_session(self, *, scope_document_db_id: UUID | None) -> ChatSession:
        return await self._repo.add_session(
            title=DEFAULT_SESSION_TITLE, scope_document_db_id=scope_document_db_id
        )

    async def update_session(self, session_id: UUID, changes: dict[str, Any]) -> ChatSession:
        if not changes:
            session = await self._repo.get_session(session_id)
            if session is None:
                raise ChatSessionNotFoundError(str(session_id))
            return session
        return await self._repo.update_session(session_id, changes)

    async def delete_session(self, session_id: UUID) -> None:
        await self._repo.delete_session(session_id)

    # --- messages (called by the agent runner, PR-B) -------------------------
    async def add_user_message(self, session_id: UUID, content: str) -> ChatMessage:
        return await self._repo.add_user_message(session_id, content)

    async def add_assistant_message(
        self,
        session_id: UUID,
        *,
        content: str,
        steps: list[ChatStep] | None,
        sources: list[ChatSourceDraft],
    ) -> ChatMessage:
        return await self._repo.add_assistant_message(
            session_id, content=content, steps=steps, sources=sources
        )
