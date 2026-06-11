"""Unit tests for the agent's pure helpers (no LangChain runtime, no LLM)."""

from __future__ import annotations

from uuid import uuid4

from app.domains.chat.application.agent import (
    SourceRegistry,
    make_session_title,
    parse_source_markers,
    resolve_sources,
)

CHUNK_A = str(uuid4())
CHUNK_B = str(uuid4())
CELL_A = str(uuid4())


def _registry() -> SourceRegistry:
    registry = SourceRegistry()
    registry.add_chunk(CHUNK_A, quote="18.2 Governing Law...", page=12, document_name="ACME_MSA.pdf")
    registry.add_chunk(CHUNK_B, quote="MFN clause...", page=4, document_name="Beta_NDA.pdf")
    registry.add_cell(CELL_A, quote="MFN조항 = 있음", column_name="MFN조항", document_name="ACME_MSA.pdf")
    return registry


def test_parse_markers_dedup_in_order() -> None:
    content = f"답변 [chunk:{CHUNK_A}] 그리고 [cell:{CELL_A}] 또 [chunk:{CHUNK_A}]."
    cleaned, refs = parse_source_markers(content)
    assert refs == [("chunk", CHUNK_A.lower()), ("cell", CELL_A.lower())]
    assert "[chunk:" not in cleaned and "[cell:" not in cleaned


def test_parse_markers_ignores_invalid_ids() -> None:
    cleaned, refs = parse_source_markers("값 [chunk:not-a-uuid] [cell:123]")
    assert refs == []
    assert "[chunk:not-a-uuid]" in cleaned  # left as-is, not silently dropped


def test_resolve_cited_sources_ranked_by_appearance() -> None:
    refs = [("cell", CELL_A.lower()), ("chunk", CHUNK_B.lower())]
    drafts = resolve_sources(refs, _registry(), max_sources=5)
    assert [d.rank for d in drafts] == [1, 2]
    assert drafts[0].cell_id is not None and drafts[0].column_name == "MFN조항"
    assert drafts[1].chunk_id is not None and drafts[1].page == 4


def test_resolve_drops_hallucinated_ids() -> None:
    refs = [("chunk", str(uuid4())), ("chunk", CHUNK_A.lower())]
    drafts = resolve_sources(refs, _registry(), max_sources=5)
    assert len(drafts) == 1
    assert str(drafts[0].chunk_id) == CHUNK_A.lower()


def test_resolve_fallback_most_recent_first_when_no_markers() -> None:
    drafts = resolve_sources([], _registry(), max_sources=2)
    assert len(drafts) == 2  # capped
    assert str(drafts[0].chunk_id) == CHUNK_B  # most recently seen chunk first


def test_resolve_caps_at_max_sources() -> None:
    refs = [
        ("chunk", CHUNK_A.lower()),
        ("chunk", CHUNK_B.lower()),
        ("cell", CELL_A.lower()),
    ]
    drafts = resolve_sources(refs, _registry(), max_sources=2)
    assert len(drafts) == 2


def test_make_session_title_truncates_and_collapses_whitespace() -> None:
    assert make_session_title("  MFN   조항이\n가장 유리한 계약은? ") == "MFN 조항이 가장 유리한 계약은?"
    assert len(make_session_title("가" * 100)) == 40
