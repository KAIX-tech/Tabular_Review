"""Ports (interfaces) for the document conversion context.

The application layer depends on this abstraction; infrastructure provides the
concrete adapter (Docling). This is the dependency-inversion seam that keeps the
Docling library out of the domain/application layers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domains.document_conversion.domain.models import ConvertedDocument


class DocumentConversionError(Exception):
    """Raised when a document cannot be converted to Markdown."""


class DocumentConverter(ABC):
    """Converts a source document on disk into clean Markdown."""

    @abstractmethod
    def convert(self, file_path: str, source_filename: str | None = None) -> ConvertedDocument:
        """Convert the file at ``file_path`` to a :class:`ConvertedDocument`.

        Raises:
            DocumentConversionError: if conversion fails.
        """
        raise NotImplementedError
