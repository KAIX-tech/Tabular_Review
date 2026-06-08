"""Composition root.

The single place that knows about concrete adapters. It reads settings, builds
infrastructure adapters, injects them into application services, and wires the
interface routers. Domain/application/interface layers never instantiate
infrastructure directly - they receive it from here.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.db import create_engine, create_sessionmaker
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
from app.domains.document_db.application.service import DocumentDbService
from app.domains.document_db.domain.ports import (
    DocumentColumnNotFoundError,
    DocumentDbNotFoundError,
    InvalidColumnOrderError,
)
from app.domains.document_db.infrastructure.repositories import (
    SqlAlchemyDocumentColumnRepository,
    SqlAlchemyDocumentDbRepository,
)
from app.domains.document_db.interface.router import router as document_db_router
from app.domains.embedding.domain.ports import EmbeddingPort
from app.domains.embedding.infrastructure.gemini_embedder import GeminiEmbedder
from app.domains.extraction.application.processor import ExtractionProcessor
from app.domains.extraction.application.service import ExtractionService
from app.domains.extraction.domain.ports import CellNotFoundError, ExtractionRunNotFoundError
from app.domains.extraction.infrastructure.repositories import (
    SqlAlchemyCellRepository,
    SqlAlchemyExtractionRunRepository,
)
from app.domains.extraction.interface.router import router as extraction_router
from app.domains.ingestion.application.processor import DocumentProcessor
from app.domains.ingestion.application.service import IngestionService
from app.domains.ingestion.domain.ports import DocumentNotFoundError
from app.domains.ingestion.infrastructure.repositories import SqlAlchemyDocumentRepository
from app.domains.ingestion.interface.router import router as ingestion_router
from app.domains.llm.application.service import LlmProxyService
from app.domains.llm.domain.ports import TextGenerationPort
from app.domains.llm.infrastructure.gemini_llm import GeminiLlm
from app.domains.llm.infrastructure.vllm_client import VllmClient
from app.domains.llm.interface.router import router as llm_router
from app.domains.storage.infrastructure.minio_storage import MinioStorage

logger = get_logger(__name__)

# Reserved tokens (prompt/instructions + model output) subtracted from the LLM
# context window to get the document budget for full-context extraction (§2.12).
_CONTEXT_RESERVE_TOKENS = 12000


def _build_document_db_service(session: AsyncSession) -> DocumentDbService:
    return DocumentDbService(
        SqlAlchemyDocumentDbRepository(session),
        SqlAlchemyDocumentColumnRepository(session),
    )


def _build_extraction_service(session: AsyncSession) -> ExtractionService:
    return ExtractionService(
        SqlAlchemyCellRepository(session),
        SqlAlchemyExtractionRunRepository(session),
        SqlAlchemyDocumentRepository(session),
        SqlAlchemyDocumentColumnRepository(session),
    )


def _build_embedder(settings: Settings) -> EmbeddingPort:
    if settings.ai_provider == "gemini":
        return GeminiEmbedder(
            api_key=settings.gemini_api_key,
            model=settings.gemini_embedding_model,
            dimension=settings.embedding_dim,
        )
    # onprem (BGE-M3) adapter lands later; fail clearly if selected now.
    raise NotImplementedError(
        f"AI_PROVIDER={settings.ai_provider!r} embedding adapter not implemented yet"
    )


def _build_text_generation(settings: Settings) -> TextGenerationPort:
    if settings.ai_provider == "gemini":
        return GeminiLlm(api_key=settings.gemini_api_key, model=settings.gemini_llm_model)
    # onprem (GLM/vLLM) structured-generation adapter lands later.
    raise NotImplementedError(
        f"AI_PROVIDER={settings.ai_provider!r} generation adapter not implemented yet"
    )


def _build_storage(settings: Settings) -> MinioStorage:
    return MinioStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        bucket=settings.minio_bucket,
        secure=settings.minio_secure,
    )


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

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Database: build the async engine + session factory once per process.
        engine = create_engine(settings.database_url, echo=settings.database_echo)
        app.state.db_engine = engine
        app.state.sessionmaker = create_sessionmaker(engine)
        # Background ingestion pipeline needs the session factory, so build it here.
        app.state.document_processor = DocumentProcessor(
            sessionmaker=app.state.sessionmaker,
            conversion=app.state.document_conversion_service,
            embedder=app.state.embedder,
            storage=app.state.storage,
        )
        app.state.extraction_processor = ExtractionProcessor(
            sessionmaker=app.state.sessionmaker,
            text_generation=app.state.text_generation,
            embedder=app.state.embedder,
            context_token_budget=max(1000, settings.llm_context_tokens - _CONTEXT_RESERVE_TOKENS),
        )
        logger.info("Database engine + ingestion/extraction processors initialized")
        try:
            yield
        finally:
            await engine.dispose()
            logger.info("Database engine disposed")

    app = FastAPI(title="Tabular Review Backend", lifespan=lifespan)

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
    app.state.embedder = _build_embedder(settings)
    app.state.text_generation = _build_text_generation(settings)
    app.state.storage = _build_storage(settings)
    # Session-scoped services: store factories; dependencies bind a request session.
    app.state.document_db_service_factory = _build_document_db_service
    storage = app.state.storage
    app.state.ingestion_service_factory = lambda session: IngestionService(
        SqlAlchemyDocumentRepository(session), storage
    )
    app.state.extraction_service_factory = _build_extraction_service

    app.include_router(conversion_router)
    app.include_router(llm_router)
    app.include_router(document_db_router)
    app.include_router(ingestion_router)
    app.include_router(extraction_router)

    @app.exception_handler(DocumentDbNotFoundError)
    @app.exception_handler(DocumentColumnNotFoundError)
    @app.exception_handler(DocumentNotFoundError)
    @app.exception_handler(CellNotFoundError)
    @app.exception_handler(ExtractionRunNotFoundError)
    async def _not_found_handler(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc) or "Not found"})

    @app.exception_handler(InvalidColumnOrderError)
    async def _invalid_order_handler(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc) or "Invalid order"})

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
