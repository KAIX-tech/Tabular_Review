"""Ports + errors for the ingestion context."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.domains.ingestion.domain.models import Document, DocumentChunk, DocumentStatus


class DocumentNotFoundError(Exception):
    """Raised when a Document does not exist."""


@dataclass(frozen=True)
class NewChunk:
    """A chunk ready to persist: text + page provenance + embedding vector."""

    index: int
    text: str
    page: int | None
    embedding: list[float]


class DocumentRepository(ABC):
    @abstractmethod
    async def add(
        self,
        document_db_id: UUID,
        *,
        name: str,
        mime_type: str,
        size_bytes: int,
        storage_uri: str,
    ) -> Document:
        """Create a Document in status=uploaded."""
        raise NotImplementedError

    @abstractmethod
    async def list_by_db(self, document_db_id: UUID) -> list[Document]:
        raise NotImplementedError

    @abstractmethod
    async def get(self, document_id: UUID) -> Document | None:
        raise NotImplementedError

    @abstractmethod
    async def count_by_db(self, document_db_id: UUID) -> int:
        raise NotImplementedError

    @abstractmethod
    async def set_status(
        self,
        document_id: UUID,
        status: DocumentStatus,
        *,
        error: str | None = None,
        page_count: int | None = None,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def set_markdown(self, document_id: UUID, markdown: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_markdown(self, document_id: UUID) -> str | None:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, document_id: UUID) -> Document:
        """Delete (cascades to chunks); returns the removed Document for cleanup.

        Raises DocumentNotFoundError if absent.
        """
        raise NotImplementedError


class DocumentChunkRepository(ABC):
    @abstractmethod
    async def replace_for_document(self, document_id: UUID, chunks: list[NewChunk]) -> None:
        """Delete any existing chunks for the document, then insert the new set."""
        raise NotImplementedError

    @abstractmethod
    async def list_by_document(self, document_id: UUID) -> list[DocumentChunk]:
        """All chunks for a document, ordered by index (for quote->chunk mapping)."""
        raise NotImplementedError

    @abstractmethod
    async def search_in_document(
        self, document_id: UUID, embedding: list[float], limit: int
    ) -> list[DocumentChunk]:
        """Top-`limit` chunks of a document by cosine similarity to `embedding`
        (retrieval fallback for long documents)."""
        raise NotImplementedError
