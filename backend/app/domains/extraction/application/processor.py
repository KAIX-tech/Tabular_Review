"""Background extraction pipeline (docs/domain-design.md §2.12).

Per document in the run scope:
  - default: send the whole Markdown + the scoped columns to the LLM in one call
    (full context — no retrieval miss);
  - fallback: only if the document exceeds the context budget, retrieve relevant
    chunks per column and extract from those (extraction_method=retrieval_fallback).

Re-extraction preserves human-edited/verified cells unless overwriteReviewed.
The returned quote is mapped back to a chunk for the CellSource (citation jump).

This processor owns its session lifecycle (background task), so concrete repos
are supplied as per-session factories injected by the composition root (main.py).
It depends only on domain ports, never on infrastructure.
"""

from __future__ import annotations

import json
import re
from uuid import UUID

from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import get_logger
from app.domains.document_db.domain.models import ColumnDataType, DocumentColumn
from app.domains.document_db.domain.ports import DocumentColumnRepository
from app.domains.embedding.domain.ports import EmbeddingError, EmbeddingPort
from app.domains.extraction.domain.models import (
    Confidence,
    ExtractionMethod,
    ReviewStatus,
    RunStatus,
)
from app.domains.extraction.domain.ports import (
    CellRepository,
    ExtractionRunRepository,
    NewCellSource,
)
from app.domains.ingestion.domain.models import DocumentChunk
from app.domains.ingestion.domain.ports import DocumentChunkRepository, DocumentRepository
from app.domains.llm.domain.ports import LlmUpstreamError, TextGenerationPort

logger = get_logger(__name__)

# Repository factories bind a port implementation to a given session. The concrete
# SQLAlchemy classes are injected by the composition root (main.py), so this
# application module depends only on domain ports.
CellRepoFactory = Callable[[AsyncSession], CellRepository]
RunRepoFactory = Callable[[AsyncSession], ExtractionRunRepository]
DocumentRepoFactory = Callable[[AsyncSession], DocumentRepository]
ColumnRepoFactory = Callable[[AsyncSession], DocumentColumnRepository]
ChunkRepoFactory = Callable[[AsyncSession], DocumentChunkRepository]

_CHARS_PER_TOKEN = 2.0  # conservative estimate (Korean-heavy legal text)
_MAX_OUTPUT_TOKENS = 4096

_SYSTEM_PROMPT = (
    "당신은 법률 문서에서 정보를 추출하는 정밀한 도우미입니다. 각 요청 컬럼에 대해 "
    "문서 내용에서만 근거를 찾아 답하세요. 반드시 다음 형태의 JSON 객체로만 응답합니다: "
    '{"columns":[{"columnId":"...","value":"...","confidence":"high|medium|low",'
    '"quote":"...","reasoning":"..."}]}. '
    "값을 찾지 못하면 value는 빈 문자열, confidence는 low로. "
    'list/multi_select 타입 컬럼의 value는 JSON 배열로 반환하세요 (예: ["항목1","항목2"]). '
    "single_select 타입 컬럼은 제공된 '선택지' 중에서 정확히 하나만 골라 그 값을 "
    "문자열로 반환하세요(배열 아님). 어느 선택지에도 해당하지 않으면 가장 가까운 "
    "추정값을 value에 넣되 confidence는 반드시 low로 표시하세요. "
    "quote는 문서에서 그대로 발췌한 근거 스니펫이어야 합니다."
)


def _parse_confidence(value: object) -> Confidence | None:
    try:
        return Confidence(str(value).lower())
    except ValueError:
        return None


def _normalize_value(
    raw: object, data_type: ColumnDataType, options: list[str] | None = None
) -> tuple[str | None, object | None, bool]:
    """Split the model's value into display text + structured value_json.

    Returns (value_text, value_json, force_low_confidence).

    - single_select: a **scalar** string (not a list). Validated against the
      column's options — if the model returns something not in the set, the raw
      value is kept (no silent snapping) but confidence is forced to low so it
      surfaces for human review.
    - list/multi_select: a JSON array (real array or array serialized into the
      value string) → value_json (the UI renders list cells from it) + value as
      newline-joined display text.
    """
    if data_type == ColumnDataType.SINGLE_SELECT:
        # Scalar choice; if the model wrongly returned an array, take the first.
        if isinstance(raw, list):
            raw = raw[0] if raw else ""
        text = (str(raw or "")).strip()
        if not text:
            return None, None, True
        if options and text not in options:
            return text, None, True  # off-taxonomy → keep, flag for review
        return text, None, False

    if isinstance(raw, list):
        items = [str(v).strip() for v in raw if str(v).strip()]
        return ("\n".join(items) or None), (items or None), False
    text = (str(raw or "")).strip()
    if not text:
        return None, None, False
    listish = data_type in (ColumnDataType.LIST, ColumnDataType.MULTI_SELECT)
    if (listish or text.startswith("[")) and text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
        except ValueError:
            return text, None, False
        if isinstance(parsed, list):
            items = [str(v).strip() for v in parsed if str(v).strip()]
            return ("\n".join(items) or None), (items or None), False
    return text, None, False


def _match_chunk(quote: str, chunks: list[DocumentChunk]) -> DocumentChunk | None:
    needle = " ".join(quote.split())[:40]
    if not needle:
        return None
    for chunk in chunks:
        hay = " ".join(chunk.text.split())
        if needle in hay or hay[:40] in " ".join(quote.split()):
            return chunk
    return None


def _locate_quote(text: str, quote: str) -> tuple[int | None, int | None]:
    """Character offsets of `quote` within `text` (the document markdown).

    Tries an exact match first, then a whitespace-tolerant match (the model's
    quote and the markdown can differ in spacing/newlines). Returns (None, None)
    when not locatable so we never store wrong offsets.
    """
    q = quote.strip()
    if not q or not text:
        return (None, None)
    idx = text.find(q)
    if idx >= 0:
        return (idx, idx + len(q))
    match = re.search(r"\s+".join(re.escape(w) for w in q.split()), text)
    if match:
        return (match.start(), match.end())
    return (None, None)


class ExtractionProcessor:
    def __init__(
        self,
        *,
        sessionmaker: async_sessionmaker[AsyncSession],
        cell_repo_factory: CellRepoFactory,
        run_repo_factory: RunRepoFactory,
        document_repo_factory: DocumentRepoFactory,
        column_repo_factory: ColumnRepoFactory,
        chunk_repo_factory: ChunkRepoFactory,
        text_generation: TextGenerationPort,
        embedder: EmbeddingPort,
        context_token_budget: int,
        fallback_top_n: int = 8,
    ) -> None:
        self._sessionmaker = sessionmaker
        self._cell_repo_factory = cell_repo_factory
        self._run_repo_factory = run_repo_factory
        self._document_repo_factory = document_repo_factory
        self._column_repo_factory = column_repo_factory
        self._chunk_repo_factory = chunk_repo_factory
        self._llm = text_generation
        self._embedder = embedder
        self._budget = context_token_budget
        self._fallback_top_n = fallback_top_n

    async def process(self, run_id: UUID) -> None:
        async with self._sessionmaker() as session:
            cells = self._cell_repo_factory(session)
            runs = self._run_repo_factory(session)
            documents = self._document_repo_factory(session)
            columns_repo = self._column_repo_factory(session)
            chunks = self._chunk_repo_factory(session)

            run = await runs.get(run_id)
            if run is None:
                logger.warning("Extraction skipped: run %s missing", run_id)
                return
            try:
                await runs.set_status(run_id, RunStatus.RUNNING)
                await session.commit()

                doc_ids = [UUID(x) for x in run.scope.get("documentIds", [])]
                col_ids = [UUID(x) for x in run.scope.get("columnIds", [])]
                overwrite = bool(run.scope.get("overwriteReviewed", False))
                columns = [c for c in [await columns_repo.get(cid) for cid in col_ids] if c]

                for doc_id in doc_ids:
                    await self._process_document(
                        session, run_id, doc_id, columns, overwrite,
                        cells=cells, runs=runs, documents=documents, chunks=chunks,
                    )

                await runs.set_status(run_id, RunStatus.COMPLETED)
                await session.commit()
                logger.info("Extraction run completed run=%s", run_id)
            except Exception:  # noqa: BLE001 - record failure, don't crash the task
                logger.exception("Extraction run failed run=%s", run_id)
                await session.rollback()
                await runs.set_status(run_id, RunStatus.FAILED)
                await session.commit()

    async def _process_document(
        self,
        session: AsyncSession,
        run_id: UUID,
        doc_id: UUID,
        columns: list[DocumentColumn],
        overwrite: bool,
        *,
        cells: CellRepository,
        runs: ExtractionRunRepository,
        documents: DocumentRepository,
        chunks: DocumentChunkRepository,
    ) -> None:
        doc = await documents.get(doc_id)
        if doc is None:
            await runs.bump(run_id, failed=len(columns))
            await session.commit()
            return

        existing = {c.column_id: c for c in await cells.list_by_document(doc_id)}
        preserved = (ReviewStatus.EDITED, ReviewStatus.VERIFIED)
        to_process: list[DocumentColumn] = []
        for col in columns:
            ex = existing.get(col.id)
            if ex and ex.review_status in preserved and not overwrite:
                await runs.bump(run_id, done=1)  # skipped (preserved) still completes progress
            else:
                to_process.append(col)
        if not to_process:
            await session.commit()
            return

        markdown = await documents.get_markdown(doc_id) or ""
        if not markdown.strip():
            for col in to_process:
                await cells.set_error(doc_id, col.id, run_id)
                await runs.bump(run_id, failed=1)
            await session.commit()
            return

        doc_chunks = await chunks.list_by_document(doc_id)

        # Budget check must account for the prompt (system + column spec) and the
        # reserved output, not just the document — else near-threshold inputs
        # overflow in full-context mode instead of taking the fallback.
        overhead = self._estimate_tokens(_SYSTEM_PROMPT + self._column_spec(to_process))
        estimated = self._estimate_tokens(markdown) + overhead + _MAX_OUTPUT_TOKENS
        if estimated <= self._budget:
            await self._extract_full_context(
                session, run_id, doc_id, to_process, markdown, doc_chunks, cells, runs
            )
        else:
            await self._extract_fallback(
                session, run_id, doc_id, to_process, doc_chunks, cells, runs, chunks, markdown
            )

    async def _extract_full_context(self, session, run_id, doc_id, columns, markdown, doc_chunks, cells, runs) -> None:
        for col in columns:
            await cells.set_running(doc_id, col.id, run_id)
        await session.commit()
        try:
            results = await self._generate(markdown, columns)
        except LlmUpstreamError:
            logger.exception("Full-context extraction failed doc=%s", doc_id)
            for col in columns:
                await cells.set_error(doc_id, col.id, run_id)
                await runs.bump(run_id, failed=1)
            await session.commit()
            return
        for col in columns:
            await self._save(cells, doc_id, col, results.get(str(col.id)),
                             ExtractionMethod.FULL_CONTEXT, run_id, doc_chunks, markdown)
            await runs.bump(run_id, done=1)
        await session.commit()

    async def _extract_fallback(self, session, run_id, doc_id, columns, doc_chunks, cells, runs, chunks, markdown) -> None:
        for col in columns:
            await cells.set_running(doc_id, col.id, run_id)
            await session.commit()
            try:
                query_emb = await self._embedder.embed_query(col.prompt)
                ctx_chunks = await chunks.search_in_document(doc_id, query_emb, self._fallback_top_n)
                context = "\n\n".join(c.text for c in ctx_chunks)
                results = await self._generate(context, [col])
                await self._save(cells, doc_id, col, results.get(str(col.id)),
                                 ExtractionMethod.RETRIEVAL_FALLBACK, run_id, ctx_chunks, markdown)
                await runs.bump(run_id, done=1)
            except (LlmUpstreamError, EmbeddingError):
                logger.exception("Fallback extraction failed doc=%s col=%s", doc_id, col.id)
                await cells.set_error(doc_id, col.id, run_id)
                await runs.bump(run_id, failed=1)
            await session.commit()

    @staticmethod
    def _column_spec(columns: list[DocumentColumn]) -> str:
        lines: list[str] = []
        for c in columns:
            line = f"- columnId={c.id} | label={c.name} | type={c.data_type.value} | 질문: {c.prompt}"
            if (
                c.data_type in (ColumnDataType.SINGLE_SELECT, ColumnDataType.MULTI_SELECT)
                and c.options
            ):
                line += f"\n  선택지(이 중에서만 선택): [{' | '.join(c.options)}]"
            lines.append(line)
        return "\n".join(lines)

    async def _generate(self, content: str, columns: list[DocumentColumn]) -> dict[str, dict]:
        user = f"문서 내용:\n{content}\n\n추출할 컬럼:\n{self._column_spec(columns)}"
        out = await self._llm.generate_json(
            system=_SYSTEM_PROMPT, user=user, max_output_tokens=_MAX_OUTPUT_TOKENS
        )
        items = out.get("columns", []) if isinstance(out, dict) else []
        return {str(item.get("columnId")): item for item in items if isinstance(item, dict)}

    async def _save(self, cells, doc_id, col, result, method, run_id, candidate_chunks, markdown="") -> None:
        if not result:
            await cells.save_result(
                doc_id, col.id, value=None, value_json=None, confidence=Confidence.LOW,
                reasoning="모델이 해당 컬럼 값을 반환하지 않음", extraction_method=method,
                run_id=run_id, sources=[],
            )
            return
        value, value_json, force_low = _normalize_value(
            result.get("value"), col.data_type, col.options
        )
        quote = (str(result.get("quote") or "")).strip()
        sources: list[NewCellSource] = []
        if quote:
            match = _match_chunk(quote, candidate_chunks)
            char_start, char_end = _locate_quote(markdown, quote)
            sources = [
                NewCellSource(
                    chunk_id=match.id if match else None,
                    quote=quote,
                    page=match.page if match else None,
                    char_start=char_start,
                    char_end=char_end,
                )
            ]
        confidence = Confidence.LOW if force_low else _parse_confidence(result.get("confidence"))
        await cells.save_result(
            doc_id, col.id,
            value=value,
            value_json=value_json,
            confidence=confidence,
            reasoning=result.get("reasoning"),
            extraction_method=method,
            run_id=run_id,
            sources=sources,
        )

    def _estimate_tokens(self, text: str) -> int:
        return int(len(text) / _CHARS_PER_TOKEN)
