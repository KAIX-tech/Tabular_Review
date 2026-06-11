"""CatalogAgentToolset unit tests with fake ports (no DB, no TEI) — D11 caps."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.domains.chat.infrastructure.toolset import CatalogAgentToolset
from app.domains.document_db.domain.models import ColumnDataType, DocumentColumn
from app.domains.extraction.domain.models import (
    Cell,
    Confidence,
    ExtractionStatus,
    ReviewStatus,
)
from app.domains.ingestion.domain.models import Document, DocumentChunk, DocumentStatus

NOW = datetime(2026, 6, 11, tzinfo=timezone.utc)
DB_ID = uuid4()
DOC_ID = uuid4()
COL_ID = uuid4()


def _document(doc_id: UUID = DOC_ID, name: str = "ACME_MSA.pdf") -> Document:
    return Document(
        id=doc_id,
        document_db_id=DB_ID,
        name=name,
        mime_type="application/pdf",
        size_bytes=1,
        storage_uri="s3://x",
        page_count=None,
        status=DocumentStatus.READY,
        error=None,
        created_at=NOW,
        updated_at=NOW,
    )


class FakeDocumentRepo:
    def __init__(self, markdown: str = "", documents: list[Document] | None = None) -> None:
        self.markdown = markdown
        self.documents = documents if documents is not None else [_document()]

    async def list_by_db(self, document_db_id):
        return self.documents

    async def get(self, document_id):
        return next((d for d in self.documents if d.id == document_id), None)

    async def get_markdown(self, document_id):
        return self.markdown


class FakeColumnRepo:
    def __init__(self, columns):
        self.columns = columns

    async def list_by_db(self, db_id):
        return self.columns


class FakeCellRepo:
    def __init__(self, cells):
        self.cells = cells

    async def list_by_db(self, db_id):
        return self.cells


class FakeChunkRepo:
    def __init__(self, chunks):
        self.chunks = chunks
        self.last_scope = None

    async def search_scoped(self, embedding, *, document_db_id=None, document_id=None, limit):
        self.last_scope = (document_db_id, document_id, limit)
        return self.chunks[:limit]


class FakeEmbedder:
    dimension = 4

    async def embed_query(self, text):
        return [0.0] * 4

    async def embed_documents(self, texts):
        return [[0.0] * 4 for _ in texts]


def _toolset(**overrides) -> CatalogAgentToolset:
    defaults = dict(
        db_repo=None,
        column_repo=FakeColumnRepo([]),
        document_repo=FakeDocumentRepo(),
        chunk_repo=FakeChunkRepo([]),
        cell_repo=FakeCellRepo([]),
        embedder=FakeEmbedder(),
        tool_result_max_tokens=100,  # → 200 chars cap
        search_k=8,
    )
    defaults.update(overrides)
    return CatalogAgentToolset(**defaults)


async def test_get_document_returns_capped_slice_with_truncated_flag() -> None:
    markdown = "가" * 1000
    toolset = _toolset(document_repo=FakeDocumentRepo(markdown=markdown))
    result = await toolset.get_document(DOC_ID, offset=0, length=999999)
    assert result["length"] == 200  # capped by tool_result_max_tokens * 2 chars
    assert result["truncated"] is True
    assert result["totalChars"] == 1000

    tail = await toolset.get_document(DOC_ID, offset=900, length=200)
    assert tail["length"] == 100
    assert tail["truncated"] is False


async def test_get_document_unknown_id_returns_error_payload() -> None:
    toolset = _toolset(document_repo=FakeDocumentRepo(documents=[]))
    result = await toolset.get_document(uuid4())
    assert "error" in result


async def test_query_cells_caps_rows_and_filters_columns() -> None:
    documents = [_document(uuid4(), name=f"doc-{i}.pdf") for i in range(60)]
    column = DocumentColumn(
        id=COL_ID,
        document_db_id=DB_ID,
        name="지배법",
        data_type=ColumnDataType.TEXT,
        prompt="governing law?",
        options=None,
        position=0,
        created_at=NOW,
        updated_at=NOW,
    )
    other = DocumentColumn(
        id=uuid4(),
        document_db_id=DB_ID,
        name="계약일",
        data_type=ColumnDataType.DATE,
        prompt="date?",
        options=None,
        position=1,
        created_at=NOW,
        updated_at=NOW,
    )
    cell = Cell(
        id=uuid4(),
        document_id=documents[0].id,
        column_id=COL_ID,
        value="뉴욕주",
        value_json=None,
        confidence=Confidence.HIGH,
        reasoning=None,
        extraction_method=None,
        extraction_status=ExtractionStatus.DONE,
        review_status=ReviewStatus.UNREVIEWED,
        last_run_id=None,
        created_at=NOW,
        updated_at=NOW,
    )
    toolset = _toolset(
        document_repo=FakeDocumentRepo(documents=documents),
        column_repo=FakeColumnRepo([column, other]),
        cell_repo=FakeCellRepo([cell]),
    )
    grid = await toolset.query_cells(DB_ID, column_ids=[COL_ID])
    assert grid["truncated"] is True
    assert len(grid["rows"]) == 50
    assert [c["name"] for c in grid["columns"]] == ["지배법"]
    first_cells = grid["rows"][0]["cells"]
    assert first_cells["지배법"]["value"] == "뉴욕주"
    assert first_cells["지배법"]["cellId"] == str(cell.id)


async def test_search_chunks_maps_names_and_clips_quotes() -> None:
    chunk = DocumentChunk(
        id=uuid4(), document_id=DOC_ID, index=0, text="조항 " * 500, page=3
    )
    chunk_repo = FakeChunkRepo([chunk])
    toolset = _toolset(chunk_repo=chunk_repo)
    results = await toolset.search_chunks("MFN", document_db_id=DB_ID, k=5)
    assert chunk_repo.last_scope == (DB_ID, None, 5)
    assert results[0]["documentName"] == "ACME_MSA.pdf"
    assert results[0]["chunkId"] == str(chunk.id)
    assert len(results[0]["quote"]) <= 600
