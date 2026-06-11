"""Chat session CRUD router tests over a minimal FastAPI app (no DB/LLM).

Builds a small app with just the chat router, the not-found handlers from the
composition root, and the service dependency overridden to use the in-memory
fake repository — verifying routes, status codes, and the camelCase wire shape.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.domains.chat.application.service import ChatService
from app.domains.chat.domain.ports import (
    ChatSessionNotFoundError,
    ScopeDocumentDbNotFoundError,
)
from app.domains.chat.interface.dependencies import get_chat_service
from app.domains.chat.interface.router import router as chat_router
from tests.chat.fake_repository import FakeChatRepository


@pytest.fixture
def repo() -> FakeChatRepository:
    return FakeChatRepository()


@pytest.fixture
def client(repo: FakeChatRepository) -> TestClient:
    app = FastAPI()
    app.include_router(chat_router)

    @app.exception_handler(ChatSessionNotFoundError)
    @app.exception_handler(ScopeDocumentDbNotFoundError)
    async def _not_found(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc) or "Not found"})

    service = ChatService(repo)
    app.dependency_overrides[get_chat_service] = lambda: service
    return TestClient(app)


def test_list_sessions_empty(client: TestClient) -> None:
    response = client.get("/chat/sessions")
    assert response.status_code == 200
    assert response.json() == []


def test_create_session_camel_case_wire_shape(client: TestClient) -> None:
    response = client.post("/chat/sessions", json={})
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "새 대화"
    assert body["scopeDocumentDbId"] is None
    # RFC3339 with Z suffix (frontend z.string().datetime()).
    assert body["createdAt"].endswith("Z")
    assert set(body) == {"id", "title", "scopeDocumentDbId", "createdAt", "updatedAt"}


def test_create_session_with_scope(client: TestClient, repo: FakeChatRepository) -> None:
    db_id = uuid4()
    repo.known_document_db_ids.add(db_id)
    response = client.post("/chat/sessions", json={"scopeDocumentDbId": str(db_id)})
    assert response.status_code == 201
    assert response.json()["scopeDocumentDbId"] == str(db_id)


def test_create_session_unknown_scope_404(client: TestClient) -> None:
    response = client.post("/chat/sessions", json={"scopeDocumentDbId": str(uuid4())})
    assert response.status_code == 404


def test_get_session_detail_includes_messages(client: TestClient) -> None:
    session_id = client.post("/chat/sessions", json={}).json()["id"]
    response = client.get(f"/chat/sessions/{session_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == session_id
    assert body["messages"] == []


def test_get_session_404(client: TestClient) -> None:
    assert client.get(f"/chat/sessions/{uuid4()}").status_code == 404


def test_rename_session(client: TestClient) -> None:
    session_id = client.post("/chat/sessions", json={}).json()["id"]
    response = client.patch(f"/chat/sessions/{session_id}", json={"title": "지배법 질의"})
    assert response.status_code == 200
    assert response.json()["title"] == "지배법 질의"


def test_delete_session_then_404(client: TestClient) -> None:
    session_id = client.post("/chat/sessions", json={}).json()["id"]
    assert client.delete(f"/chat/sessions/{session_id}").status_code == 204
    assert client.get(f"/chat/sessions/{session_id}").status_code == 404
    assert client.delete(f"/chat/sessions/{session_id}").status_code == 404
