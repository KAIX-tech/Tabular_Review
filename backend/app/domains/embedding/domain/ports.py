"""Port for text embedding (generic infra context).

Consumers (ingestion, extraction, chat) depend on this abstraction; the concrete
adapter (BGE-M3 via HF TEI) lives in infrastructure. All adapters MUST emit
vectors of `dimension` length so they share one pgvector column
(docs/domain-design.md §2.5, §2.12).

Documents and queries are embedded separately because retrieval models score
query-vs-document pairs asymmetrically.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class EmbeddingError(Exception):
    """Raised when embedding fails."""


class EmbeddingPort(ABC):
    @property
    @abstractmethod
    def dimension(self) -> int:
        """Vector length every embedding from this adapter has."""
        raise NotImplementedError

    @abstractmethod
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed chunk/document texts for indexing. Order matches the input."""
        raise NotImplementedError

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Embed a search query."""
        raise NotImplementedError
