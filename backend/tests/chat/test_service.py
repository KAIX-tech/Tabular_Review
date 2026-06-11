"""ChatService unit tests against the in-memory fake repository (no DB/LLM)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.domains.chat.application.service import ChatService
from app.domains.chat.domain.models import (
    DEFAULT_SESSION_TITLE,
    ChatRole,
    ChatSourceDraft,
    ChatStep,
)
from app.domains.chat.domain.ports import (
    ChatSessionNotFoundError,
    ScopeDocumentDbNotFoundError,
)
from tests.chat.fake_repository import FakeChatRepository


@pytest.fixture
def repo() -> FakeChatRepository:
    return FakeChatRepository()


@pytest.fixture
def service(repo: FakeChatRepository) -> ChatService:
    return ChatService(repo)


async def test_create_session_defaults(service: ChatService) -> None:
    session = await service.create_session(scope_document_db_id=None)
    assert session.title == DEFAULT_SESSION_TITLE
    assert session.scope_document_db_id is None


async def test_create_session_with_unknown_scope_raises(service: ChatService) -> None:
    with pytest.raises(ScopeDocumentDbNotFoundError):
        await service.create_session(scope_document_db_id=uuid4())


async def test_create_session_with_known_scope(repo: FakeChatRepository) -> None:
    db_id = uuid4()
    repo.known_document_db_ids.add(db_id)
    session = await ChatService(repo).create_session(scope_document_db_id=db_id)
    assert session.scope_document_db_id == db_id


async def test_list_sessions_ordered_by_recent_activity(service: ChatService) -> None:
    first = await service.create_session(scope_document_db_id=None)
    second = await service.create_session(scope_document_db_id=None)
    assert [s.id for s in await service.list_sessions()] == [second.id, first.id]

    # Activity on the older session moves it to the front.
    await service.add_user_message(first.id, "질문")
    assert [s.id for s in await service.list_sessions()] == [first.id, second.id]


async def test_get_session_detail_missing_raises(service: ChatService) -> None:
    with pytest.raises(ChatSessionNotFoundError):
        await service.get_session_detail(uuid4())


async def test_rename_session(service: ChatService) -> None:
    session = await service.create_session(scope_document_db_id=None)
    renamed = await service.update_session(session.id, {"title": "MFN 비교"})
    assert renamed.title == "MFN 비교"


async def test_update_with_no_changes_returns_current(service: ChatService) -> None:
    session = await service.create_session(scope_document_db_id=None)
    unchanged = await service.update_session(session.id, {})
    assert unchanged.title == session.title


async def test_delete_session(service: ChatService) -> None:
    session = await service.create_session(scope_document_db_id=None)
    await service.delete_session(session.id)
    with pytest.raises(ChatSessionNotFoundError):
        await service.get_session_detail(session.id)
    with pytest.raises(ChatSessionNotFoundError):
        await service.delete_session(session.id)


async def test_message_roundtrip_with_steps_and_sources(service: ChatService) -> None:
    session = await service.create_session(scope_document_db_id=None)
    await service.add_user_message(session.id, "MFN 조항이 가장 유리한 계약은?")
    chunk_id = uuid4()
    await service.add_assistant_message(
        session.id,
        content="ACME_MSA 계약이 가장 유리합니다.",
        steps=[ChatStep(step=1, tool="list_document_dbs", args={}, summary="DB 탐색")],
        sources=[
            ChatSourceDraft(chunk_id=chunk_id, cell_id=None, quote="18.2 ...", page=12, rank=1)
        ],
    )

    detail = await service.get_session_detail(session.id)
    assert [m.role for m in detail.messages] == [ChatRole.USER, ChatRole.ASSISTANT]
    assistant = detail.messages[1]
    assert assistant.steps is not None and assistant.steps[0].tool == "list_document_dbs"
    assert assistant.sources[0].chunk_id == chunk_id


async def test_user_message_on_missing_session_raises(service: ChatService) -> None:
    with pytest.raises(ChatSessionNotFoundError):
        await service.add_user_message(uuid4(), "질문")


def test_source_draft_requires_target() -> None:
    with pytest.raises(ValueError):
        ChatSourceDraft(chunk_id=None, cell_id=None, quote="q", page=None, rank=1)
