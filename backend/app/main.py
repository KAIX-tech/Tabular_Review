"""Composition root.

The single place that knows about concrete adapters. It reads settings, builds
infrastructure adapters, injects them into application services, and wires the
interface routers. Domain/application/interface layers never instantiate
infrastructure directly — they receive it from here.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging, get_logger
from app.domains.document_conversion.application.service import DocumentConversionService
from app.domains.document_conversion.domain.models import ConversionSettings, OcrSettings
from app.domains.document_conversion.infrastructure.docling_converter import (
    DoclingDocumentConverter,
)
from app.domains.document_conversion.infrastructure.huggingface_ssl import (
    configure_huggingface_ssl,
)
from app.domains.document_conversion.interface.router import router as conversion_router
from app.domains.llm.application.service import LlmProxyService
from app.domains.llm.infrastructure.vllm_client import VllmClient
from app.domains.llm.interface.router import router as llm_router

logger = get_logger(__name__)


def _build_document_conversion_service(settings: Settings) -> DocumentConversionService:
    # Configure HF TLS before the converter resolves any models.
    configure_huggingface_ssl(
        disable_ssl_verify=settings.docling_hf_disable_ssl_verify,
        trust_env=settings.docling_hf_trust_env,
    )
    conversion_settings = ConversionSettings(
        pdf_backend=settings.docling_pdf_backend,
        num_threads=settings.docling_num_threads,
        ocr=OcrSettings(
            enabled=settings.docling_ocr_enabled,
            force_full_page=settings.docling_ocr_force_full_page,
            langs=tuple(settings.docling_ocr_langs),
            fallback_on_decode_error=settings.docling_ocr_fallback_on_decode_error,
        ),
    )
    converter = DoclingDocumentConverter(conversion_settings)
    return DocumentConversionService(converter)


def _build_llm_proxy_service(settings: Settings) -> LlmProxyService:
    client = VllmClient(
        base_url=settings.vllm_base_url,
        api_key=settings.vllm_api_key,
        timeout_seconds=settings.vllm_timeout_seconds,
    )
    return LlmProxyService(client, default_model=settings.vllm_model)


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    settings = settings or get_settings()

    app = FastAPI(title="Tabular Review Backend")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Composition: build adapters + services, expose via app.state.
    app.state.document_conversion_service = _build_document_conversion_service(settings)
    app.state.llm_proxy_service = _build_llm_proxy_service(settings)

    app.include_router(conversion_router)
    app.include_router(llm_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
