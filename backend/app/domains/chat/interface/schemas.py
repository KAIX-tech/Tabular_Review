"""HTTP DTOs for the chat context.

Wire shape is **camelCase** to match the frontend Zod schemas
(docs/domain-design.md §7). The frontend's legacy `role: "model"` maps to the
standard `assistant` in its adapter; the API only speaks user/assistant.

Display metadata for sources (documentName/documentDb/column label) is joined
in PR-B together with the agent — until then sources are returned with ids only.
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from app.core.schemas import CamelModel, IsoDatetime
from app.domains.chat.domain.models import (
    ChatMessage,
    ChatRole,
    ChatSession,
    ChatSessionDetail,
    ChatSource,
    ChatStep,
)


class ChatSessionCreate(CamelModel):
    scope_document_db_id: UUID | None = None


class ChatSessionUpdate(CamelModel):
    title: str | None = None


class ChatStepResponse(CamelModel):
    step: int
    tool: str
    args: dict[str, Any]
    summary: str

    @classmethod
    def from_domain(cls, step: ChatStep) -> "ChatStepResponse":
        return cls(step=step.step, tool=step.tool, args=step.args, summary=step.summary)


class ChatSourceResponse(CamelModel):
    id: UUID
    kind: Literal["chunk", "cell"]
    chunk_id: UUID | None
    cell_id: UUID | None
    quote: str
    page: int | None
    rank: int

    @classmethod
    def from_domain(cls, source: ChatSource) -> "ChatSourceResponse":
        return cls(
            id=source.id,
            # chunk wins when both are somehow present; the DB constraint only
            # guarantees at least one target.
            kind="chunk" if source.chunk_id is not None else "cell",
            chunk_id=source.chunk_id,
            cell_id=source.cell_id,
            quote=source.quote,
            page=source.page,
            rank=source.rank,
        )


class ChatMessageResponse(CamelModel):
    id: UUID
    role: ChatRole
    content: str
    steps: list[ChatStepResponse] | None
    sources: list[ChatSourceResponse]
    created_at: IsoDatetime

    @classmethod
    def from_domain(cls, message: ChatMessage) -> "ChatMessageResponse":
        return cls(
            id=message.id,
            role=message.role,
            content=message.content,
            steps=(
                [ChatStepResponse.from_domain(s) for s in message.steps]
                if message.steps is not None
                else None
            ),
            sources=[ChatSourceResponse.from_domain(s) for s in message.sources],
            created_at=message.created_at,
        )


class ChatSessionResponse(CamelModel):
    id: UUID
    title: str
    scope_document_db_id: UUID | None
    created_at: IsoDatetime
    updated_at: IsoDatetime

    @classmethod
    def from_domain(cls, session: ChatSession) -> "ChatSessionResponse":
        return cls(
            id=session.id,
            title=session.title,
            scope_document_db_id=session.scope_document_db_id,
            created_at=session.created_at,
            updated_at=session.updated_at,
        )


class ChatSessionDetailResponse(ChatSessionResponse):
    messages: list[ChatMessageResponse]

    @classmethod
    def from_detail(cls, detail: ChatSessionDetail) -> "ChatSessionDetailResponse":
        session = detail.session
        return cls(
            id=session.id,
            title=session.title,
            scope_document_db_id=session.scope_document_db_id,
            created_at=session.created_at,
            updated_at=session.updated_at,
            messages=[ChatMessageResponse.from_domain(m) for m in detail.messages],
        )
