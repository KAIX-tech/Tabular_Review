"""Application service (use case) for document conversion.

Orchestrates the conversion use case. Deliberately thin: it depends only on the
:class:`DocumentConverter` port, so it is fully unit-testable with a fake
converter and has no knowledge of Docling or FastAPI.
"""

from __future__ import annotations

from app.core.logging import get_logger
from app.domains.document_conversion.domain.models import ConvertedDocument
from app.domains.document_conversion.domain.ports import DocumentConverter

logger = get_logger(__name__)


class DocumentConversionService:
    def __init__(self, converter: DocumentConverter) -> None:
        self._converter = converter

    def convert(self, file_path: str, source_filename: str | None = None) -> ConvertedDocument:
        logger.info("Converting document filename=%s", source_filename)
        return self._converter.convert(file_path, source_filename)
