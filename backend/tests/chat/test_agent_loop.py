"""Offline end-to-end tests of the agent loop (fake tool-calling model, no LLM).

Drives the real `create_agent` graph with a scripted model to verify the run
semantics of plan D9/D10: step events, marker-based source resolution, title
auto-generation, and question-survives-failure persistence.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from langchain_core.language_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage

from app.domains.chat.application.agent import AnswerEvent, ChatAgentRunner, StepEvent
from app.domains.chat.application.service import ChatService
from app.domains.chat.domain.ports import AgentRunError
from tests.chat.fake_repository import FakeChatRepository

CHUNK_ID = str(uuid4())


class FakeToolCallingModel(FakeMessagesListChatModel):
    """Scripted chat model that accepts tool binding (returns itself)."""

    def bind_tools(self, tools: Any, **kwargs: Any) -> "FakeToolCallingModel":
        return self


class ExplodingModel(FakeToolCallingModel):
    def _generate(self, *args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("upstream LLM down")


class FakeToolset:
    async def list_document_dbs(self) -> list[dict]:
        return [{"id": str(uuid4()), "name": "계약서"}]

    async def list_columns(self, document_db_id) -> list[dict]:
        return []

    async def list_documents(self, document_db_id) -> list[dict]:
        return []

    async def query_cells(self, document_db_id, column_ids=None) -> dict:
        return {"columns": [], "rows": [], "truncated": False}

    async def search_chunks(self, query, *, document_db_id=None, document_id=None, k=None):
        return [
            {
                "chunkId": CHUNK_ID,
                "documentId": str(uuid4()),
                "documentName": "ACME_MSA.pdf",
                "page": 12,
                "quote": "18.2 Governing Law ...",
            }
        ]

    async def get_document(self, document_id, *, offset=0, length=None) -> dict:
        return {}


def _runner(model: FakeMessagesListChatModel, service: ChatService) -> ChatAgentRunner:
    return ChatAgentRunner(
        service=service,
        toolset=FakeToolset(),
        chat_model=model,
        max_steps=8,
        max_sources=5,
    )


@pytest.fixture
def service() -> ChatService:
    return ChatService(FakeChatRepository())


async def test_full_loop_steps_sources_title(service: ChatService) -> None:
    model = FakeToolCallingModel(
        responses=[
            AIMessage(
                content="",
                tool_calls=[{"name": "search_chunks", "args": {"query": "MFN"}, "id": "c1"}],
            ),
            AIMessage(content=f"ACME 계약이 가장 유리합니다 [chunk:{CHUNK_ID}]"),
        ]
    )
    session = await service.create_session(scope_document_db_id=None)
    events = [e async for e in _runner(model, service).run(session.id, "MFN 비교해줘")]

    assert [type(e).__name__ for e in events] == ["StepEvent", "AnswerEvent"]
    step = events[0].step
    assert step.tool == "search_chunks" and step.summary == "원문 검색"

    answer = events[-1].message
    assert "[chunk:" not in answer.content  # marker stripped
    assert str(answer.sources[0].chunk_id) == CHUNK_ID  # exact id mapping
    assert answer.sources[0].document_name == "ACME_MSA.pdf"

    detail = await service.get_session_detail(session.id)
    assert detail.session.title == "MFN 비교해줘"  # truncate-title from first question
    assert [m.role.value for m in detail.messages] == ["user", "assistant"]
    assert detail.messages[-1].steps and detail.messages[-1].steps[0].tool == "search_chunks"


async def test_failure_preserves_user_message_only(service: ChatService) -> None:
    session = await service.create_session(scope_document_db_id=None)
    runner = _runner(ExplodingModel(responses=[]), service)

    with pytest.raises(AgentRunError):
        async for _ in runner.run(session.id, "질문"):
            pass

    detail = await service.get_session_detail(session.id)
    assert [m.role.value for m in detail.messages] == ["user"]  # D9


async def test_hallucinated_marker_falls_back_to_tool_results(service: ChatService) -> None:
    fake_id = str(uuid4())
    model = FakeToolCallingModel(
        responses=[
            AIMessage(
                content="",
                tool_calls=[{"name": "search_chunks", "args": {"query": "q"}, "id": "c1"}],
            ),
            AIMessage(content=f"답변 [chunk:{fake_id}]"),  # id not in any tool result
        ]
    )
    session = await service.create_session(scope_document_db_id=None)
    events = [e async for e in _runner(model, service).run(session.id, "질문")]
    answer = events[-1].message
    # Hallucinated id rejected → fallback cites what the agent actually saw.
    assert str(answer.sources[0].chunk_id) == CHUNK_ID
