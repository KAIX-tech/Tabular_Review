"""HTTP router for the chat context — session CRUD (docs/domain-design.md §6.5).

The message endpoint (`POST /chat/sessions/{sid}/messages`, agent run + SSE)
lands in PR-B. Domain "not found" errors are translated to HTTP 404 by exception
handlers registered in the composition root.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.domains.chat.application.service import ChatService
from app.domains.chat.interface.dependencies import get_chat_service
from app.domains.chat.interface.schemas import (
    ChatSessionCreate,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    ChatSessionUpdate,
)

router = APIRouter(tags=["chat"])


@router.get("/chat/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    service: ChatService = Depends(get_chat_service),
) -> list[ChatSessionResponse]:
    sessions = await service.list_sessions()
    return [ChatSessionResponse.from_domain(s) for s in sessions]


@router.post(
    "/chat/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED
)
async def create_session(
    payload: ChatSessionCreate,
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionResponse:
    session = await service.create_session(scope_document_db_id=payload.scope_document_db_id)
    return ChatSessionResponse.from_domain(session)


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_session(
    session_id: UUID,
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionDetailResponse:
    detail = await service.get_session_detail(session_id)
    return ChatSessionDetailResponse.from_detail(detail)


@router.patch("/chat/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: UUID,
    payload: ChatSessionUpdate,
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionResponse:
    session = await service.update_session(session_id, payload.model_dump(exclude_unset=True))
    return ChatSessionResponse.from_domain(session)


@router.delete("/chat/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    service: ChatService = Depends(get_chat_service),
) -> None:
    await service.delete_session(session_id)
