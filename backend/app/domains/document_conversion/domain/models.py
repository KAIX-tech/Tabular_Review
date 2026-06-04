"""Domain models for the document conversion context.

These are framework-agnostic value objects. They carry no knowledge of FastAPI,
Docling, or HTTP. The application and interface layers translate to/from them.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class OcrSettings:
    """OCR configuration as a value object."""

    enabled: bool = True
    force_full_page: bool = False
    langs: tuple[str, ...] = ("eng", "kor")
    fallback_on_decode_error: bool = True


@dataclass(frozen=True)
class ConversionSettings:
    """How a source document should be converted to Markdown."""

    pdf_backend: str = "pypdfium2"
    num_threads: int = 4
    ocr: OcrSettings = field(default_factory=OcrSettings)


@dataclass(frozen=True)
class ConvertedDocument:
    """Result of converting a source document to clean Markdown."""

    markdown: str
    source_filename: str | None = None
