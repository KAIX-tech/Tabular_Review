"""In-memory fake ChatRepository for unit tests (no DB).

Mirrors the SQLAlchemy adapter's semantics: ordering by updated_at desc,
not-found errors, scope validation against a configurable set of known
DocumentDB ids, and updated_at bumps on message writes.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from app.domains.chat.domain.models import (
    ChatMessage,
    ChatRole,
    ChatSession,
    ChatSessionDetail,
    ChatSource,
    ChatSourceDraft,
    ChatStep,
)
from app.domains.chat.domain.ports import (
    ChatRepository,
    ChatSessionNotFoundError,
    ScopeDocumentDbNotFoundError,
)


class FakeChatRepository(ChatRepository):
    def __init__(self, known_document_db_ids: set[UUID] | None = None) -> None:
        self.known_document_db_ids = known_document_db_ids or set()
        self._sessions: dict[UUID, ChatSession] = {}
        self._messages: dict[UUID, list[ChatMessage]] = {}
        self._clock = datetime(2026, 6, 11, tzinfo=timezone.utc)

    def _tick(self) -> datetime:
        self._clock += timedelta(seconds=1)
        return self._clock

    # --- sessions -----------------------------------------------------------
    async def list_sessions(self) -> list[ChatSession]:
        return sorted(self._sessions.values(), key=lambda s: s.updated_at, reverse=True)

    async def get_session(self, session_id: UUID) -> ChatSession | None:
        return self._sessions.get(session_id)

    async def get_session_detail(self, session_id: UUID) -> ChatSessionDetail | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        return ChatSessionDetail(session=session, messages=list(self._messages[session_id]))

    async def add_session(
        self, *, title: str, scope_document_db_id: UUID | None
    ) -> ChatSession:
        if (
            scope_document_db_id is not None
            and scope_document_db_id not in self.known_document_db_ids
        ):
            raise ScopeDocumentDbNotFoundError(str(scope_document_db_id))
        now = self._tick()
        session = ChatSession(
            id=uuid4(),
            title=title,
            scope_document_db_id=scope_document_db_id,
            created_at=now,
            updated_at=now,
        )
        self._sessions[session.id] = session
        self._messages[session.id] = []
        return session

    async def update_session(self, session_id: UUID, changes: dict[str, Any]) -> ChatSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise ChatSessionNotFoundError(str(session_id))
        if "title" in changes:
            session.title = changes["title"]
        session.updated_at = self._tick()
        return session

    async def delete_session(self, session_id: UUID) -> None:
        if session_id not in self._sessions:
            raise ChatSessionNotFoundError(str(session_id))
        del self._sessions[session_id]
        del self._messages[session_id]

    # --- messages -------------------------------------------------------------
    def _require_session(self, session_id: UUID) -> ChatSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise ChatSessionNotFoundError(str(session_id))
        return session

    async def add_user_message(self, session_id: UUID, content: str) -> ChatMessage:
        session = self._require_session(session_id)
        message = ChatMessage(
            id=uuid4(),
            session_id=session_id,
            role=ChatRole.USER,
            content=content,
            steps=None,
            sources=[],
            created_at=self._tick(),
        )
        self._messages[session_id].append(message)
        session.updated_at = message.created_at
        return message

    async def add_assistant_message(
        self,
        session_id: UUID,
        *,
        content: str,
        steps: list[ChatStep] | None,
        sources: list[ChatSourceDraft],
    ) -> ChatMessage:
        session = self._require_session(session_id)
        message_id = uuid4()
        now = self._tick()
        message = ChatMessage(
            id=message_id,
            session_id=session_id,
            role=ChatRole.ASSISTANT,
            content=content,
            steps=steps,
            sources=[
                ChatSource(
                    id=uuid4(),
                    message_id=message_id,
                    chunk_id=d.chunk_id,
                    cell_id=d.cell_id,
                    quote=d.quote,
                    page=d.page,
                    rank=d.rank,
                    created_at=now,
                )
                for d in sources
            ],
            created_at=now,
        )
        self._messages[session_id].append(message)
        session.updated_at = now
        return message
