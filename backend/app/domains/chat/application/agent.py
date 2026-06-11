"""Agentic Search runner (docs/domain-design.md §2.13, phase-4 plan §2.2, D9-D11).

LangChain/LangGraph usage is confined to this application module (plus the
composition root); the domain layer sees only ports and dataclasses.

Flow per question (D9): persist the user message *before* the run → stream the
ReAct loop (`langchain.agents.create_agent`) emitting one StepEvent per tool
call → on success, finalize sources from `[chunk:<id>]`/`[cell:<id>]` markers
(D10) and persist the assistant message. Failures raise AgentRunError — the
question is already saved, nothing else is.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, AsyncIterator
from uuid import UUID

from langchain.agents import create_agent
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langchain_core.tools import StructuredTool
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.domains.chat.application.service import ChatService
from app.domains.chat.domain.models import ChatMessage, ChatSourceDraft, ChatStep
from app.domains.chat.domain.ports import AgentRunError, AgentToolset

logger = get_logger(__name__)

_TITLE_MAX_CHARS = 40
_MARKER_RE = re.compile(
    r"\[(chunk|cell):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
    r"-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]"
)

_STEP_LABELS = {
    "list_document_dbs": "DB 탐색",
    "list_columns": "컬럼 확인",
    "list_documents": "문서 목록 조회",
    "query_cells": "셀 조회",
    "search_chunks": "원문 검색",
    "get_document": "문서 열람",
}

_SYSTEM_PROMPT = """\
당신은 법률사무소 문서 지식베이스 "Kalex"의 검색 에이전트다. 사용자의 질문에 답하기 위해
읽기 전용 도구로 카탈로그를 단계적으로 탐색한다 — 먼저 어떤 Document DB가 적합한지 찾고
(list_document_dbs), 그 DB의 추출 스키마를 확인한 뒤(list_columns), 정형 질의는 query_cells
(추출 그리드 값), 비정형 질의는 search_chunks(원문 시맨틱 검색)·get_document(원문 슬라이스)
로 근거를 모은다.

규칙:
- 근거 없이 추측하지 말 것. 도구 결과에 없는 내용은 모른다고 답한다.
- 결과에 truncated 표시가 있으면 범위를 좁혀 다시 조회한다.
- 최종 답변은 한국어로, 간결하고 정확하게.
- **출처 인용(필수)**: 답변 본문에서 근거로 사용한 도구 결과의 id를 그 자리에
  [chunk:<chunkId>] 또는 [cell:<cellId>] 마커로 인용한다. 도구 결과에 실제로 존재하는
  id만 사용한다.
{scope_note}"""


# --- pure helpers (unit-tested without LangChain runtime) ---------------------


@dataclass
class SourceRegistry:
    """Chunk/cell entries seen in tool results during one run.

    Insertion-ordered; used to validate cited ids (no hallucinated citations)
    and as the fallback citation order (most recent first) when the model
    didn't emit markers (D10).
    """

    chunks: dict[str, dict[str, Any]] = field(default_factory=dict)
    cells: dict[str, dict[str, Any]] = field(default_factory=dict)

    def add_chunk(
        self,
        chunk_id: str,
        *,
        quote: str,
        page: int | None,
        document_name: str | None,
        document_id: str | None = None,
        document_db_id: str | None = None,
    ) -> None:
        self.chunks[chunk_id] = {
            "quote": quote,
            "page": page,
            "document_name": document_name,
            "document_id": document_id,
            "document_db_id": document_db_id,
        }

    def add_cell(
        self,
        cell_id: str,
        *,
        quote: str,
        column_name: str | None,
        document_name: str | None,
        document_id: str | None = None,
        document_db_id: str | None = None,
        column_id: str | None = None,
    ) -> None:
        self.cells[cell_id] = {
            "quote": quote,
            "column_name": column_name,
            "document_name": document_name,
            "document_id": document_id,
            "document_db_id": document_db_id,
            "column_id": column_id,
        }


def parse_source_markers(content: str) -> tuple[str, list[tuple[str, str]]]:
    """Extract `[chunk:<id>]`/`[cell:<id>]` markers from the answer body.

    Returns the cleaned content and the cited (kind, id) pairs, deduplicated in
    order of first appearance (appearance order = rank, D10).
    """
    refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for kind, raw_id in _MARKER_RE.findall(content):
        key = (kind, raw_id.lower())
        if key not in seen:
            seen.add(key)
            refs.append(key)
    cleaned = _MARKER_RE.sub("", content)
    # Collapse doubled spaces left behind by removed markers; keep newlines.
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned).strip()
    return cleaned, refs


def resolve_sources(
    refs: list[tuple[str, str]], registry: SourceRegistry, max_sources: int
) -> list[ChatSourceDraft]:
    """Turn cited refs into drafts, dropping ids absent from tool results (D10).

    Falls back to the registry in most-recent-first order when nothing valid
    was cited; caps at ``max_sources`` either way.
    """
    drafts: list[ChatSourceDraft] = []

    def _uuid(value: str | None) -> UUID | None:
        return UUID(value) if value else None

    def add(kind: str, source_id: str) -> None:
        if len(drafts) >= max_sources:
            return
        if kind == "chunk" and source_id in registry.chunks:
            entry = registry.chunks[source_id]
            drafts.append(
                ChatSourceDraft(
                    chunk_id=UUID(source_id),
                    cell_id=None,
                    quote=entry["quote"],
                    page=entry["page"],
                    rank=len(drafts) + 1,
                    document_name=entry["document_name"],
                    document_id=_uuid(entry.get("document_id")),
                    document_db_id=_uuid(entry.get("document_db_id")),
                )
            )
        elif kind == "cell" and source_id in registry.cells:
            entry = registry.cells[source_id]
            drafts.append(
                ChatSourceDraft(
                    chunk_id=None,
                    cell_id=UUID(source_id),
                    quote=entry["quote"],
                    page=None,
                    rank=len(drafts) + 1,
                    document_name=entry["document_name"],
                    column_name=entry["column_name"],
                    document_id=_uuid(entry.get("document_id")),
                    document_db_id=_uuid(entry.get("document_db_id")),
                    column_id=_uuid(entry.get("column_id")),
                )
            )

    for kind, source_id in refs:
        add(kind, source_id)
    if not drafts:
        # Heuristic fallback: most recently fetched evidence first.
        for source_id in reversed(list(registry.chunks)):
            add("chunk", source_id)
        for source_id in reversed(list(registry.cells)):
            add("cell", source_id)
    return drafts


def make_session_title(question: str) -> str:
    title = " ".join(question.split())
    return title[:_TITLE_MAX_CHARS] or "새 대화"


# --- streaming events ---------------------------------------------------------


@dataclass
class StepEvent:
    step: ChatStep


@dataclass
class DeltaEvent:
    """A token chunk of the model's text as it is generated (SSE `delta`).

    Cosmetic stream only — the terminal AnswerEvent carries the authoritative
    content (markers stripped, sources resolved) and replaces it. A StepEvent
    after deltas means that text belonged to a tool-calling round; the client
    discards the draft then.
    """

    text: str


@dataclass
class AnswerEvent:
    message: ChatMessage


# --- runner --------------------------------------------------------------------


class ChatAgentRunner:
    """Runs one agent turn for a session, streaming step/answer events."""

    def __init__(
        self,
        *,
        service: ChatService,
        toolset: AgentToolset,
        chat_model: BaseChatModel,
        max_steps: int,
        max_sources: int,
        callbacks: list[BaseCallbackHandler] | None = None,
    ) -> None:
        self._service = service
        self._toolset = toolset
        self._model = chat_model
        self._max_steps = max_steps
        self._max_sources = max_sources
        self._callbacks = callbacks or []

    async def run(
        self, session_id: UUID, content: str
    ) -> AsyncIterator[StepEvent | DeltaEvent | AnswerEvent]:
        detail = await self._service.get_session_detail(session_id)  # 404 first
        scope_id = detail.session.scope_document_db_id

        # D9: the question survives any failure below. Title first so the
        # durable commit inside add_user_message covers both.
        if not detail.messages:
            await self._service.update_session(
                session_id, {"title": make_session_title(content)}
            )
        await self._service.add_user_message(session_id, content)

        registry = SourceRegistry()
        tools = _build_tools(self._toolset, registry, scope_id)
        agent = create_agent(
            self._model,
            tools=tools,
            system_prompt=_SYSTEM_PROMPT.format(scope_note=_scope_note(scope_id)),
        )

        history: list[Any] = []
        for message in detail.messages:
            cls = HumanMessage if message.role.value == "user" else AIMessage
            history.append(cls(content=message.content))
        history.append(HumanMessage(content=content))

        config = {
            # model node + tools node each count as one LangGraph step.
            "recursion_limit": 2 * self._max_steps + 1,
            "callbacks": self._callbacks,
        }

        steps: list[ChatStep] = []
        final_text = ""
        hit_step_limit = False
        try:
            # "updates" drives the authoritative loop (tool calls, final text);
            # "messages" taps the model's token stream for the live-typing feel.
            async for mode, payload in agent.astream(
                {"messages": history}, config=config, stream_mode=["updates", "messages"]
            ):
                if mode == "messages":
                    chunk, _metadata = payload
                    if isinstance(chunk, AIMessageChunk):
                        token = _message_text(chunk)
                        if token:
                            yield DeltaEvent(token)
                    continue
                update = payload
                for node_output in update.values():
                    for msg in (node_output or {}).get("messages", []):
                        if isinstance(msg, AIMessage):
                            if msg.tool_calls:
                                for call in msg.tool_calls:
                                    step = ChatStep(
                                        step=len(steps) + 1,
                                        tool=call["name"],
                                        args=dict(call.get("args") or {}),
                                        summary=_STEP_LABELS.get(call["name"], call["name"]),
                                    )
                                    steps.append(step)
                                    yield StepEvent(step)
                            elif _message_text(msg):
                                final_text = _message_text(msg)
        except GraphRecursionError:
            hit_step_limit = True
            logger.warning("chat agent hit step limit (session=%s)", session_id)
        except Exception as exc:  # noqa: BLE001 — surfaced as SSE error (D9)
            logger.exception("chat agent run failed (session=%s)", session_id)
            raise AgentRunError(str(exc)) from exc

        if not final_text:
            if hit_step_limit:
                final_text = (
                    "탐색 단계 상한에 도달해 지금까지의 근거로는 확정적인 답을 드리기 "
                    "어렵습니다. 질문 범위를 좁혀 다시 시도해 주세요."
                )
            else:
                raise AgentRunError("agent finished without an answer")

        try:
            cleaned, refs = parse_source_markers(final_text)
            drafts = resolve_sources(refs, registry, self._max_sources)
            assistant = await self._service.add_assistant_message(
                session_id,
                content=cleaned,
                steps=steps or None,
                sources=drafts,
            )
        except Exception as exc:  # noqa: BLE001 — finalize failure is a run failure (D9)
            logger.exception("chat finalize failed (session=%s)", session_id)
            raise AgentRunError(str(exc)) from exc
        # Overlay display names from drafts (storage keeps ids only; rank-aligned).
        by_rank = {d.rank: d for d in drafts}
        for source in assistant.sources:
            draft = by_rank.get(source.rank)
            if draft is not None:
                source.document_name = draft.document_name
                source.column_name = draft.column_name
                source.document_id = draft.document_id
                source.document_db_id = draft.document_db_id
                source.column_id = draft.column_id
        yield AnswerEvent(assistant)


def _message_text(message: AIMessage) -> str:
    """Plain text of an AIMessage (content may be a string or content parts)."""
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


def _scope_note(scope_id: UUID | None) -> str:
    if scope_id is None:
        return "- 세션 스코프: 전역. 적합한 Document DB를 직접 골라 탐색한다."
    return (
        f"- 세션 스코프: Document DB {scope_id} 로 한정. 다른 DB는 조회하지 않는다 "
        "(도구도 이 DB로 강제된다)."
    )


# --- LangChain tool bindings ----------------------------------------------------


class _ListColumnsArgs(BaseModel):
    document_db_id: str = Field(description="Document DB id (UUID)")


class _ListDocumentsArgs(BaseModel):
    document_db_id: str = Field(description="Document DB id (UUID)")


class _QueryCellsArgs(BaseModel):
    document_db_id: str = Field(description="Document DB id (UUID)")
    column_ids: list[str] | None = Field(
        default=None, description="조회할 컬럼 id 목록(생략 시 전체)"
    )


class _SearchChunksArgs(BaseModel):
    query: str = Field(description="시맨틱 검색 질의")
    document_db_id: str | None = Field(default=None, description="DB 스코프(선택)")
    document_id: str | None = Field(default=None, description="문서 스코프(선택)")
    k: int | None = Field(default=None, description="결과 수(선택)")


class _GetDocumentArgs(BaseModel):
    document_id: str = Field(description="문서 id (UUID)")
    offset: int = Field(default=0, description="시작 문자 오프셋")
    length: int | None = Field(default=None, description="가져올 문자 수(상한 적용)")


def _parse_uuid(value: str, label: str) -> UUID:
    try:
        return UUID(value)
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValueError(f"invalid {label}: {value!r}") from exc


def _build_tools(
    toolset: AgentToolset, registry: SourceRegistry, scope_id: UUID | None
) -> list[StructuredTool]:
    """Bind the read-only toolset for one run.

    Wrappers enforce the session scope (D7) and record every chunk/cell id the
    agent saw into ``registry`` (citation validation + fallback, D10).
    """

    def _effective_db(document_db_id: str | None) -> UUID | None:
        if scope_id is not None:
            return scope_id  # scoped session: ignore whatever the model passed
        return _parse_uuid(document_db_id, "document_db_id") if document_db_id else None

    async def list_document_dbs() -> Any:
        dbs = await toolset.list_document_dbs()
        if scope_id is not None:
            dbs = [db for db in dbs if db["id"] == str(scope_id)]
        return dbs

    async def list_columns(document_db_id: str) -> Any:
        db_id = _effective_db(document_db_id)
        assert db_id is not None
        return await toolset.list_columns(db_id)

    async def list_documents(document_db_id: str) -> Any:
        db_id = _effective_db(document_db_id)
        assert db_id is not None
        return await toolset.list_documents(db_id)

    async def query_cells(document_db_id: str, column_ids: list[str] | None = None) -> Any:
        db_id = _effective_db(document_db_id)
        assert db_id is not None
        parsed_columns = (
            [_parse_uuid(c, "column_id") for c in column_ids] if column_ids else None
        )
        grid = await toolset.query_cells(db_id, parsed_columns)
        for row in grid.get("rows", []):
            for column_name, cell in (row.get("cells") or {}).items():
                if cell.get("cellId"):
                    registry.add_cell(
                        cell["cellId"],
                        quote=f"{column_name} = {cell.get('value')}",
                        column_name=column_name,
                        document_name=row.get("documentName"),
                        document_id=row.get("documentId"),
                        document_db_id=grid.get("documentDbId"),
                        column_id=cell.get("columnId"),
                    )
        return grid

    async def search_chunks(
        query: str,
        document_db_id: str | None = None,
        document_id: str | None = None,
        k: int | None = None,
    ) -> Any:
        results = await toolset.search_chunks(
            query,
            document_db_id=_effective_db(document_db_id),
            document_id=_parse_uuid(document_id, "document_id") if document_id else None,
            k=k,
        )
        for item in results:
            registry.add_chunk(
                item["chunkId"],
                quote=item["quote"],
                page=item.get("page"),
                document_name=item.get("documentName"),
                document_id=item.get("documentId"),
                document_db_id=item.get("documentDbId"),
            )
        return results

    async def get_document(
        document_id: str, offset: int = 0, length: int | None = None
    ) -> Any:
        return await toolset.get_document(
            _parse_uuid(document_id, "document_id"), offset=offset, length=length
        )

    return [
        StructuredTool.from_function(
            coroutine=list_document_dbs,
            name="list_document_dbs",
            description="모든 Document DB(워크스페이스) 목록과 문서/컬럼 수를 조회한다.",
        ),
        StructuredTool.from_function(
            coroutine=list_columns,
            name="list_columns",
            description="한 Document DB의 추출 스키마(컬럼 정의: 이름/타입/프롬프트)를 조회한다.",
            args_schema=_ListColumnsArgs,
        ),
        StructuredTool.from_function(
            coroutine=list_documents,
            name="list_documents",
            description="한 Document DB에 들어있는 문서 목록(이름/상태)을 조회한다.",
            args_schema=_ListDocumentsArgs,
        ),
        StructuredTool.from_function(
            coroutine=query_cells,
            name="query_cells",
            description=(
                "한 Document DB의 추출 그리드 값(문서×컬럼 셀)을 조회한다. "
                "정형 비교/집계 질문에 사용. 결과의 cellId는 [cell:<id>]로 인용 가능."
            ),
            args_schema=_QueryCellsArgs,
        ),
        StructuredTool.from_function(
            coroutine=search_chunks,
            name="search_chunks",
            description=(
                "원문 청크를 시맨틱 검색한다. 비정형 질문(조항 내용/원문 근거)에 사용. "
                "결과의 chunkId는 [chunk:<id>]로 인용 가능."
            ),
            args_schema=_SearchChunksArgs,
        ),
        StructuredTool.from_function(
            coroutine=get_document,
            name="get_document",
            description="문서 markdown의 슬라이스(offset/length)를 읽는다. 전문 반환은 불가.",
            args_schema=_GetDocumentArgs,
        ),
    ]
