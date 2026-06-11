"""SQLAlchemy repository adapter for the chat context."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any
from uuid import UUID

from sqlalchemy import column, func, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.domains.chat.infrastructure.models import (
    ChatMessageOrm,
    ChatSessionOrm,
    ChatSourceOrm,
)

# Lightweight references to other contexts' tables (scope validation + source
# display-name joins) without importing their ORM models — same decoupling
# pattern as document_db's `document` table reference.
_document_db_tbl = table("document_db", column("id"))
_document_tbl = table("document", column("id"), column("name"), column("document_db_id"))
_chunk_tbl = table("document_chunk", column("id"), column("document_id"))
_cell_tbl = table("cell", column("id"), column("document_id"), column("column_id"))
_column_tbl = table("document_column", column("id"), column("name"))

# Fields that PATCH may change (guards the changes mapping).
_SESSION_UPDATABLE = {"title"}


def _to_session(orm: ChatSessionOrm) -> ChatSession:
    return ChatSession(
        id=orm.id,
        title=orm.title,
        scope_document_db_id=orm.scope_document_db_id,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _to_source(orm: ChatSourceOrm) -> ChatSource:
    return ChatSource(
        id=orm.id,
        message_id=orm.message_id,
        chunk_id=orm.chunk_id,
        cell_id=orm.cell_id,
        quote=orm.quote,
        page=orm.page,
        rank=orm.rank,
        created_at=orm.created_at,
    )


def _to_message(orm: ChatMessageOrm) -> ChatMessage:
    steps = (
        [ChatStep(**raw) for raw in orm.steps] if orm.steps is not None else None
    )
    return ChatMessage(
        id=orm.id,
        session_id=orm.session_id,
        role=ChatRole(orm.role),
        content=orm.content,
        steps=steps,
        sources=[_to_source(s) for s in orm.sources],
        created_at=orm.created_at,
    )


class SqlAlchemyChatRepository(ChatRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # --- sessions -----------------------------------------------------------
    async def list_sessions(self) -> list[ChatSession]:
        stmt = select(ChatSessionOrm).order_by(ChatSessionOrm.updated_at.desc())
        rows = (await self._session.execute(stmt)).scalars().all()
        return [_to_session(orm) for orm in rows]

    async def get_session(self, session_id: UUID) -> ChatSession | None:
        orm = await self._session.get(ChatSessionOrm, session_id)
        return _to_session(orm) if orm is not None else None

    async def get_session_detail(self, session_id: UUID) -> ChatSessionDetail | None:
        stmt = (
            select(ChatSessionOrm)
            .where(ChatSessionOrm.id == session_id)
            .options(selectinload(ChatSessionOrm.messages).selectinload(ChatMessageOrm.sources))
        )
        orm = (await self._session.execute(stmt)).scalars().first()
        if orm is None:
            return None
        messages = [_to_message(m) for m in orm.messages]
        await self._enrich_source_names(messages)
        return ChatSessionDetail(session=_to_session(orm), messages=messages)

    async def _enrich_source_names(self, messages: list[ChatMessage]) -> None:
        """Fill document/column display names on sources (joined, not stored)."""
        sources = [s for m in messages for s in m.sources]
        chunk_ids = [s.chunk_id for s in sources if s.chunk_id is not None]
        cell_ids = [s.cell_id for s in sources if s.cell_id is not None]

        chunk_meta: dict[UUID, tuple[str, UUID, UUID]] = {}
        if chunk_ids:
            rows = await self._session.execute(
                select(
                    _chunk_tbl.c.id,
                    _document_tbl.c.name,
                    _document_tbl.c.id,
                    _document_tbl.c.document_db_id,
                )
                .select_from(
                    _chunk_tbl.join(
                        _document_tbl, _chunk_tbl.c.document_id == _document_tbl.c.id
                    )
                )
                .where(_chunk_tbl.c.id.in_(chunk_ids))
            )
            chunk_meta = {row[0]: (row[1], row[2], row[3]) for row in rows}

        cell_meta: dict[UUID, tuple[str, str, UUID, UUID, UUID]] = {}
        if cell_ids:
            rows = await self._session.execute(
                select(
                    _cell_tbl.c.id,
                    _document_tbl.c.name,
                    _column_tbl.c.name,
                    _cell_tbl.c.document_id,
                    _document_tbl.c.document_db_id,
                    _cell_tbl.c.column_id,
                )
                .select_from(
                    _cell_tbl.join(
                        _document_tbl, _cell_tbl.c.document_id == _document_tbl.c.id
                    ).join(_column_tbl, _cell_tbl.c.column_id == _column_tbl.c.id)
                )
                .where(_cell_tbl.c.id.in_(cell_ids))
            )
            cell_meta = {row[0]: (row[1], row[2], row[3], row[4], row[5]) for row in rows}

        for source in sources:
            if source.chunk_id is not None and source.chunk_id in chunk_meta:
                name, doc_id, db_id = chunk_meta[source.chunk_id]
                source.document_name = name
                source.document_id = doc_id
                source.document_db_id = db_id
            elif source.cell_id is not None and source.cell_id in cell_meta:
                doc_name, col_name, doc_id, db_id, col_id = cell_meta[source.cell_id]
                source.document_name = doc_name
                source.column_name = col_name
                source.document_id = doc_id
                source.document_db_id = db_id
                source.column_id = col_id

    async def add_session(
        self, *, title: str, scope_document_db_id: UUID | None
    ) -> ChatSession:
        if scope_document_db_id is not None:
            exists = (
                await self._session.execute(
                    select(_document_db_tbl.c.id).where(
                        _document_db_tbl.c.id == scope_document_db_id
                    )
                )
            ).first()
            if exists is None:
                raise ScopeDocumentDbNotFoundError(str(scope_document_db_id))
        orm = ChatSessionOrm(title=title, scope_document_db_id=scope_document_db_id)
        self._session.add(orm)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_session(orm)

    async def update_session(self, session_id: UUID, changes: dict[str, Any]) -> ChatSession:
        orm = await self._session.get(ChatSessionOrm, session_id)
        if orm is None:
            raise ChatSessionNotFoundError(str(session_id))
        for key, value in changes.items():
            if key in _SESSION_UPDATABLE:
                setattr(orm, key, value)
        await self._session.flush()
        await self._session.refresh(orm)
        return _to_session(orm)

    async def delete_session(self, session_id: UUID) -> None:
        orm = await self._session.get(ChatSessionOrm, session_id)
        if orm is None:
            raise ChatSessionNotFoundError(str(session_id))
        await self._session.delete(orm)
        await self._session.flush()

    # --- messages -------------------------------------------------------------
    async def _ensure_session_exists(self, session_id: UUID) -> None:
        if await self._session.get(ChatSessionOrm, session_id) is None:
            raise ChatSessionNotFoundError(str(session_id))

    async def _touch_session(self, session_id: UUID) -> None:
        # Adding a message counts as session activity (list orders by updated_at).
        await self._session.execute(
            update(ChatSessionOrm)
            .where(ChatSessionOrm.id == session_id)
            .values(updated_at=func.now())
        )

    async def _load_message(self, message_id: UUID) -> ChatMessage:
        """Re-select a just-flushed message with sources eagerly loaded.

        ``_to_message`` touches ``orm.sources``; on a fresh/refreshed instance
        that relationship is unloaded and a lazy load in an AsyncSession raises
        MissingGreenlet — so always come back through selectinload.
        """
        stmt = (
            select(ChatMessageOrm)
            .where(ChatMessageOrm.id == message_id)
            .options(selectinload(ChatMessageOrm.sources))
        )
        orm = (await self._session.execute(stmt)).scalars().one()
        return _to_message(orm)

    async def add_user_message(self, session_id: UUID, content: str) -> ChatMessage:
        await self._ensure_session_exists(session_id)
        orm = ChatMessageOrm(
            session_id=session_id, role=ChatRole.USER.value, content=content
        )
        self._session.add(orm)
        await self._touch_session(session_id)
        # D9: the question must survive a failed/cancelled agent run. The
        # request-scoped session only commits when the SSE stream completes, so
        # a client disconnect would otherwise roll the user message back —
        # commit it durably here (the run continues in a new transaction).
        await self._session.commit()
        return await self._load_message(orm.id)

    async def add_assistant_message(
        self,
        session_id: UUID,
        *,
        content: str,
        steps: list[ChatStep] | None,
        sources: list[ChatSourceDraft],
    ) -> ChatMessage:
        await self._ensure_session_exists(session_id)
        orm = ChatMessageOrm(
            session_id=session_id,
            role=ChatRole.ASSISTANT.value,
            content=content,
            steps=[asdict(s) for s in steps] if steps is not None else None,
        )
        orm.sources = [
            ChatSourceOrm(
                chunk_id=draft.chunk_id,
                cell_id=draft.cell_id,
                quote=draft.quote,
                page=draft.page,
                rank=draft.rank,
            )
            for draft in sources
        ]
        self._session.add(orm)
        await self._touch_session(session_id)
        await self._session.flush()
        return await self._load_message(orm.id)
