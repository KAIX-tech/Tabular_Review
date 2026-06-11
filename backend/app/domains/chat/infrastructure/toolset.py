"""AgentToolset adapter — read-only catalog tools over other contexts' ports.

Depends only on the *ports* of document_db / ingestion / extraction (plus the
embedding port); concrete repositories are injected by the composition root.
All payloads are JSON-serializable and capped per plan D11: text fields are
clipped, query_cells rows are capped, and get_document returns slices only.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.domains.chat.domain.ports import AgentToolset
from app.domains.document_db.domain.ports import (
    DocumentColumnRepository,
    DocumentDbRepository,
)
from app.domains.embedding.domain.ports import EmbeddingPort
from app.domains.extraction.domain.ports import CellRepository
from app.domains.ingestion.domain.ports import DocumentChunkRepository, DocumentRepository

# Char-per-token estimate shared with extraction (Korean-heavy legal text).
_CHARS_PER_TOKEN = 2.0
# Per-item clip for chunk quotes returned by search_chunks.
_QUOTE_MAX_CHARS = 600
# Row cap for query_cells (documents per response).
_MAX_GRID_ROWS = 50


def _clip(text: str, max_chars: int) -> tuple[str, bool]:
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars], True


class CatalogAgentToolset(AgentToolset):
    def __init__(
        self,
        *,
        db_repo: DocumentDbRepository,
        column_repo: DocumentColumnRepository,
        document_repo: DocumentRepository,
        chunk_repo: DocumentChunkRepository,
        cell_repo: CellRepository,
        embedder: EmbeddingPort,
        tool_result_max_tokens: int,
        search_k: int,
    ) -> None:
        self._db_repo = db_repo
        self._column_repo = column_repo
        self._document_repo = document_repo
        self._chunk_repo = chunk_repo
        self._cell_repo = cell_repo
        self._embedder = embedder
        self._max_chars = int(tool_result_max_tokens * _CHARS_PER_TOKEN)
        self._search_k = search_k

    async def list_document_dbs(self) -> list[dict[str, Any]]:
        summaries = await self._db_repo.list_summaries()
        return [
            {
                "id": str(s.document_db.id),
                "name": s.document_db.name,
                "description": s.document_db.description,
                "columnCount": s.column_count,
                "documentCount": s.document_count,
            }
            for s in summaries
        ]

    async def list_columns(self, document_db_id: UUID) -> list[dict[str, Any]]:
        columns = await self._column_repo.list_by_db(document_db_id)
        return [
            {
                "id": str(c.id),
                "name": c.name,
                "dataType": c.data_type.value,
                "prompt": c.prompt,
            }
            for c in columns
        ]

    async def list_documents(self, document_db_id: UUID) -> list[dict[str, Any]]:
        documents = await self._document_repo.list_by_db(document_db_id)
        return [
            {"id": str(d.id), "name": d.name, "status": d.status.value} for d in documents
        ]

    async def query_cells(
        self, document_db_id: UUID, column_ids: list[UUID] | None = None
    ) -> dict[str, Any]:
        columns = await self._column_repo.list_by_db(document_db_id)
        if column_ids is not None:
            wanted = set(column_ids)
            columns = [c for c in columns if c.id in wanted]
        documents = await self._document_repo.list_by_db(document_db_id)
        cells = await self._cell_repo.list_by_db(document_db_id)

        column_by_id = {c.id: c for c in columns}
        cells_by_doc: dict[UUID, dict[str, Any]] = {}
        for cell in cells:
            column = column_by_id.get(cell.column_id)
            if column is None:
                continue
            cells_by_doc.setdefault(cell.document_id, {})[column.name] = {
                "cellId": str(cell.id),
                "value": cell.value,
                "confidence": cell.confidence.value if cell.confidence else None,
                "reviewStatus": cell.review_status.value,
            }

        truncated = len(documents) > _MAX_GRID_ROWS
        rows = [
            {
                "documentId": str(d.id),
                "documentName": d.name,
                "cells": cells_by_doc.get(d.id, {}),
            }
            for d in documents[:_MAX_GRID_ROWS]
        ]
        return {
            "columns": [{"id": str(c.id), "name": c.name} for c in columns],
            "rows": rows,
            "truncated": truncated,
        }

    async def search_chunks(
        self,
        query: str,
        *,
        document_db_id: UUID | None = None,
        document_id: UUID | None = None,
        k: int | None = None,
    ) -> list[dict[str, Any]]:
        embedding = await self._embedder.embed_query(query)
        chunks = await self._chunk_repo.search_scoped(
            embedding,
            document_db_id=document_db_id,
            document_id=document_id,
            limit=k or self._search_k,
        )
        names: dict[UUID, str] = {}
        results: list[dict[str, Any]] = []
        for chunk in chunks:
            if chunk.document_id not in names:
                document = await self._document_repo.get(chunk.document_id)
                names[chunk.document_id] = document.name if document else "(unknown)"
            quote, _ = _clip(chunk.text, _QUOTE_MAX_CHARS)
            results.append(
                {
                    "chunkId": str(chunk.id),
                    "documentId": str(chunk.document_id),
                    "documentName": names[chunk.document_id],
                    "page": chunk.page,
                    "quote": quote,
                }
            )
        return results

    async def get_document(
        self, document_id: UUID, *, offset: int = 0, length: int | None = None
    ) -> dict[str, Any]:
        document = await self._document_repo.get(document_id)
        if document is None:
            return {"error": f"document {document_id} not found"}
        markdown = await self._document_repo.get_markdown(document_id) or ""
        offset = max(0, offset)
        requested = length if length is not None else self._max_chars
        # Slices only (D11): never return more than the tool-result cap.
        effective = min(requested, self._max_chars)
        text = markdown[offset : offset + effective]
        return {
            "documentId": str(document.id),
            "name": document.name,
            "totalChars": len(markdown),
            "offset": offset,
            "length": len(text),
            "truncated": offset + len(text) < len(markdown),
            "text": text,
        }
