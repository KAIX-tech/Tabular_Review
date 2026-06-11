"""HTTP router for the chat context (docs/domain-design.md §6.5).

Session CRUD + the agent message endpoint. Message flow (plan D4/D9): SSE
`step` per tool call → `answer` (assistant message incl. sources) → `done`;
failures emit `error` instead. Clients that don't accept text/event-stream get
a non-streaming JSON fallback with just the final message. One run per session
at a time (409); a client disconnect cancels the run mid-stream (the generator
is torn down with the response), leaving only the already-saved user message.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse

from app.core.logging import get_logger
from app.domains.chat.application.agent import AnswerEvent, ChatAgentRunner, StepEvent
from app.domains.chat.application.service import ChatService
from app.domains.chat.domain.ports import AgentRunError, SessionBusyError
from app.domains.chat.interface.dependencies import get_chat_agent_runner, get_chat_service
from app.domains.chat.interface.schemas import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    ChatSessionUpdate,
    ChatStepResponse,
)

router = APIRouter(tags=["chat"])
logger = get_logger(__name__)


def format_sse_event(event: str, data: Any) -> str:
    """One SSE frame: `event:` + single-line JSON `data:` + blank line."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


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


# --- agent message endpoint (SSE) -------------------------------------------
def _answer_payload(event: AnswerEvent) -> dict[str, Any]:
    message = ChatMessageResponse.from_domain(event.message)
    return message.model_dump(mode="json", by_alias=True)


@router.post("/chat/sessions/{session_id}/messages")
async def send_message(
    session_id: UUID,
    payload: ChatMessageCreate,
    request: Request,
    service: ChatService = Depends(get_chat_service),
    runner: ChatAgentRunner = Depends(get_chat_agent_runner),
) -> Any:
    active: set[UUID] = request.app.state.chat_active_sessions
    if session_id in active:
        raise SessionBusyError(f"session {session_id} already has a run in flight")
    # 404 must be an HTTP status, not a mid-stream error → check before streaming.
    await service.get_session_detail(session_id)

    wants_sse = "text/event-stream" in (request.headers.get("accept") or "")
    active.add(session_id)

    if not wants_sse:
        # Non-streaming fallback (plan §4): run to completion, return the message.
        try:
            answer: AnswerEvent | None = None
            async for event in runner.run(session_id, payload.content):
                if isinstance(event, AnswerEvent):
                    answer = event
            if answer is None:
                raise AgentRunError("agent finished without an answer")
            return {"message": _answer_payload(answer)}
        finally:
            active.discard(session_id)

    async def stream() -> AsyncIterator[str]:
        try:
            async for event in runner.run(session_id, payload.content):
                if isinstance(event, StepEvent):
                    step = ChatStepResponse.from_domain(event.step)
                    yield format_sse_event("step", step.model_dump(mode="json", by_alias=True))
                elif isinstance(event, AnswerEvent):
                    data = _answer_payload(event)
                    yield format_sse_event(
                        "answer", {"content": data["content"], "sources": data["sources"]}
                    )
                    yield format_sse_event("done", {"messageId": data["id"]})
        except AgentRunError as exc:
            # D9: the user message is saved; the client shows an error + retry.
            yield format_sse_event("error", {"message": str(exc) or "agent run failed"})
        except Exception as exc:  # noqa: BLE001 — never leave the stream without a terminal event
            logger.exception("unexpected error in chat message stream")
            yield format_sse_event("error", {"message": str(exc) or "internal error"})
        finally:
            active.discard(session_id)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
