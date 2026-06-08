"""Docling adapter implementing the DocumentConverter port.

Encapsulates every Docling-specific detail: accelerator selection (MPS on Apple
Silicon, otherwise auto), OCR pipeline options, PDF backend choice, and the
UTF-8-decode fallback that retries with OCR disabled. None of this leaks into the
domain or application layers.
"""

from __future__ import annotations

import platform

from docling.backend.docling_parse_backend import DoclingParseDocumentBackend
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
from docling.document_converter import DocumentConverter as DoclingConverter
from docling.document_converter import PdfFormatOption

from app.core.logging import get_logger
from app.domains.document_conversion.domain.models import (
    ConversionSettings,
    ConvertedChunk,
    ConvertedDocument,
)
from app.domains.document_conversion.domain.ports import DocumentConversionError, DocumentConverter

logger = get_logger(__name__)

_PDF_BACKENDS = {
    "docling_parse": DoclingParseDocumentBackend,
    "pypdfium2": PyPdfiumDocumentBackend,
}


def _is_utf8_decode_error(error: Exception) -> bool:
    message = str(error).lower()
    return "utf-8" in message and "codec can't decode" in message


def _chunk_page(chunk) -> int | None:
    """Smallest source page number across a chunk's provenance, if any."""
    pages: list[int] = []
    for item in getattr(getattr(chunk, "meta", None), "doc_items", []) or []:
        for prov in getattr(item, "prov", []) or []:
            page_no = getattr(prov, "page_no", None)
            if isinstance(page_no, int):
                pages.append(page_no)
    return min(pages) if pages else None


class DoclingDocumentConverter(DocumentConverter):
    """Converts PDF/DOCX to Markdown via Docling."""

    def __init__(self, settings: ConversionSettings) -> None:
        self._settings = settings
        self._converter = self._build_converter(ocr_enabled=settings.ocr.enabled)
        # Lazily built only if an OCR run fails with a UTF-8 decode error.
        self._converter_without_ocr: DoclingConverter | None = None

    def _build_converter(self, ocr_enabled: bool) -> DoclingConverter:
        if platform.system() == "Darwin":
            logger.info("Detected macOS - enabling MPS (Metal) GPU acceleration")
            device = AcceleratorDevice.MPS
        else:
            logger.info("Running on CPU/AUTO accelerator (MPS not available)")
            device = AcceleratorDevice.AUTO

        pdf_pipeline_options = PdfPipelineOptions()
        pdf_pipeline_options.accelerator_options = AcceleratorOptions(
            device=device, num_threads=self._settings.num_threads
        )
        pdf_pipeline_options.do_ocr = ocr_enabled
        if ocr_enabled:
            logger.info(
                "Docling OCR enabled langs=%s force_full_page=%s",
                self._settings.ocr.langs,
                self._settings.ocr.force_full_page,
            )
            pdf_pipeline_options.ocr_options = TesseractCliOcrOptions(
                lang=list(self._settings.ocr.langs),
                force_full_page_ocr=self._settings.ocr.force_full_page,
            )
        else:
            logger.info("Docling OCR disabled")

        backend = _PDF_BACKENDS.get(self._settings.pdf_backend)
        if backend is None:
            available = ", ".join(sorted(_PDF_BACKENDS))
            raise RuntimeError(
                f"Unsupported DOCLING_PDF_BACKEND={self._settings.pdf_backend}. "
                f"Available values: {available}"
            )
        logger.info("Docling PDF backend=%s", self._settings.pdf_backend)

        return DoclingConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pdf_pipeline_options,
                    backend=backend,
                )
            }
        )

    def _should_retry_without_ocr(self, error: Exception) -> bool:
        return (
            self._settings.ocr.enabled
            and self._settings.ocr.fallback_on_decode_error
            and _is_utf8_decode_error(error)
        )

    def _run(self, file_path: str):
        """Run Docling with the OCR-decode-failure retry; return the Docling result."""
        try:
            return self._converter.convert(file_path)
        except Exception as error:  # noqa: BLE001 - re-raised as domain error below
            if not self._should_retry_without_ocr(error):
                raise DocumentConversionError(str(error)) from error
            logger.warning(
                "Docling OCR failed with UTF-8 decode error; retrying with OCR disabled"
            )
            if self._converter_without_ocr is None:
                self._converter_without_ocr = self._build_converter(ocr_enabled=False)
            try:
                return self._converter_without_ocr.convert(file_path)
            except Exception as retry_error:  # noqa: BLE001
                raise DocumentConversionError(str(retry_error)) from retry_error

    def convert(self, file_path: str, source_filename: str | None = None) -> ConvertedDocument:
        result = self._run(file_path)
        markdown = result.document.export_to_markdown()
        return ConvertedDocument(markdown=markdown, source_filename=source_filename)

    def convert_and_chunk(
        self, file_path: str, source_filename: str | None = None
    ) -> ConvertedDocument:
        result = self._run(file_path)
        document = result.document
        markdown = document.export_to_markdown()

        # HierarchicalChunker splits along document structure and carries page
        # provenance, without needing a tokenizer download. (Token-balanced
        # HybridChunker is a future refinement.)
        from docling.chunking import HierarchicalChunker

        chunks: list[ConvertedChunk] = []
        try:
            for index, chunk in enumerate(HierarchicalChunker().chunk(dl_doc=document)):
                chunks.append(
                    ConvertedChunk(index=index, text=chunk.text, page=_chunk_page(chunk))
                )
        except Exception as error:  # noqa: BLE001
            raise DocumentConversionError(f"Chunking failed: {error}") from error

        page_count = None
        try:
            page_count = len(document.pages) or None
        except Exception:  # noqa: BLE001 - page_count is best-effort metadata
            page_count = None

        return ConvertedDocument(
            markdown=markdown,
            source_filename=source_filename,
            chunks=tuple(chunks),
            page_count=page_count,
        )
