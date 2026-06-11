"""Message-endpoint tests with a scripted fake runner (no LLM, no DB).

Covers the SSE framing (step → answer → done), the `error` event (D9), the
one-run-per-session 409 guard, and the non-streaming JSON fallback.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import AsyncIterator
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.domains.chat.application.agent import AnswerEvent, StepEvent
from app.domains.chat.application.service import ChatService
from app.domains.chat.domain.models import (
    ChatMessage,
    ChatRole,
    ChatSource,
    ChatStep,
)
from app.domains.chat.domain.ports import (
    AgentRunError,
    ChatSessionNotFoundError,
    ScopeDocumentDbNotFoundError,
    SessionBusyError,
)
from app.domains.chat.interface.dependencies import get_chat_agent_runner, get_chat_service
from app.domains.chat.interface.router import format_sse_event, router as chat_router
from tests.chat.fake_repository import FakeChatRepository

NOW = datetime(2026, 6, 11, tzinfo=timezone.utc)


def _assistant_message(session_id: UUID) -> ChatMessage:
    message_id = uuid4()
    return ChatMessage(
        id=message_id,
        session_id=session_id,
        role=ChatRole.ASSISTANT,
        content="ACME_MSA 계약이 가장 유리합니다.",
        steps=[ChatStep(step=1, tool="query_cells", args={}, summary="셀 조회")],
        sources=[
            ChatSource(
                id=uuid4(),
                message_id=message_id,
                chunk_id=uuid4(),
                cell_id=None,
                quote="18.2 ...",
                page=12,
                rank=1,
                created_at=NOW,
                document_name="ACME_MSA.pdf",
            )
        ],
        created_at=NOW,
    )


class FakeRunner:
    """Yields a scripted event sequence; optionally fails after the steps."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    async def run(self, session_id: UUID, content: str) -> AsyncIterator[StepEvent | AnswerEvent]:
        yield StepEvent(ChatStep(step=1, tool="list_document_dbs", args={}, summary="DB 탐색"))
        if self.fail:
            raise AgentRunError("boom")
        yield AnswerEvent(_assistant_message(session_id))


def _build_client(runner: FakeRunner) -> tuple[TestClient, UUID]:
    app = FastAPI()
    app.include_router(chat_router)

    @app.exception_handler(ChatSessionNotFoundError)
    @app.exception_handler(ScopeDocumentDbNotFoundError)
    async def _nf(_r: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(SessionBusyError)
    async def _busy(_r: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(AgentRunError)
    async def _failed(_r: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    repo = FakeChatRepository()
    service = ChatService(repo)
    app.dependency_overrides[get_chat_service] = lambda: service
    app.dependency_overrides[get_chat_agent_runner] = lambda: runner
    app.state.chat_active_sessions = set()

    client = TestClient(app)
    session_id = UUID(client.post("/chat/sessions", json={}).json()["id"])
    return client, session_id


def _events(body: str) -> list[tuple[str, str]]:
    events = []
    for frame in body.strip().split("\n\n"):
        lines = frame.split("\n")
        event = lines[0].removeprefix("event: ")
        data = lines[1].removeprefix("data: ")
        events.append((event, data))
    return events


def test_sse_step_answer_done_sequence() -> None:
    client, session_id = _build_client(FakeRunner())
    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": "질문"},
        headers={"Accept": "text/event-stream"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    names = [name for name, _ in _events(response.text)]
    assert names == ["step", "answer", "done"]
    assert '"sources"' in response.text and '"documentName"' in response.text


def test_sse_error_event_on_failure() -> None:
    client, session_id = _build_client(FakeRunner(fail=True))
    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": "질문"},
        headers={"Accept": "text/event-stream"},
    )
    names = [name for name, _ in _events(response.text)]
    assert names == ["step", "error"]
    # The busy guard is released after the failed run.
    assert client.app.state.chat_active_sessions == set()


def test_busy_session_returns_409() -> None:
    client, session_id = _build_client(FakeRunner())
    client.app.state.chat_active_sessions.add(session_id)
    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": "질문"},
        headers={"Accept": "text/event-stream"},
    )
    assert response.status_code == 409


def test_unknown_session_404_before_stream() -> None:
    client, _ = _build_client(FakeRunner())
    response = client.post(
        f"/chat/sessions/{uuid4()}/messages",
        json={"content": "질문"},
        headers={"Accept": "text/event-stream"},
    )
    assert response.status_code == 404


def test_non_streaming_fallback_returns_final_message() -> None:
    client, session_id = _build_client(FakeRunner())
    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": "질문"},
        headers={"Accept": "application/json"},
    )
    assert response.status_code == 200
    body = response.json()["message"]
    assert body["role"] == "assistant"
    assert body["sources"][0]["kind"] == "chunk"
    assert client.app.state.chat_active_sessions == set()


def test_non_streaming_failure_returns_502() -> None:
    client, session_id = _build_client(FakeRunner(fail=True))
    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": "질문"},
        headers={"Accept": "application/json"},
    )
    assert response.status_code == 502
    assert client.app.state.chat_active_sessions == set()


def test_format_sse_event_frame() -> None:
    frame = format_sse_event("step", {"step": 1, "tool": "query_cells"})
    assert frame == 'event: step\ndata: {"step": 1, "tool": "query_cells"}\n\n'


@pytest.mark.parametrize("accept", ["text/event-stream", "application/json"])
def test_empty_content_rejected(accept: str) -> None:
    client, session_id = _build_client(FakeRunner())
    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"content": ""},
        headers={"Accept": accept},
    )
    assert response.status_code == 422
