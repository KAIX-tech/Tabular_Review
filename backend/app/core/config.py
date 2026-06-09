"""Application configuration.

Single source of truth for environment-driven settings. Each bounded context
receives the slice of configuration it needs through the composition root
(`app.main.create_app`), never by reading `os.environ` directly. This keeps the
domain and application layers free of infrastructure concerns.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import quote_plus

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _split_csv(raw: str | list[str]) -> list[str]:
    if isinstance(raw, list):
        return [item.strip() for item in raw if str(item).strip()]
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings(BaseSettings):
    """Environment-bound settings shared across bounded contexts."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # --- Database (PostgreSQL + pgvector, async driver) ---
    # Discrete connection components so production can point at shared/managed
    # infrastructure (just set POSTGRES_SERVER/PORT/...). The async SQLAlchemy URL
    # is assembled from these in `database_url`.
    postgres_server: str = Field(default="localhost", alias="POSTGRES_SERVER")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="kalex", alias="POSTGRES_DB")
    postgres_user: str = Field(default="kalex", alias="POSTGRES_USER")
    postgres_password: str = Field(default="kalex", alias="POSTGRES_PASSWORD")
    database_echo: bool = Field(default=False, alias="DATABASE_ECHO")

    @property
    def database_url(self) -> str:
        """Async SQLAlchemy URL assembled from the POSTGRES_* components.

        User/password are URL-encoded so special characters (e.g. in a managed-DB
        password) don't corrupt the DSN.
        """
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.postgres_server}:{self.postgres_port}/{self.postgres_db}"
        )

    # --- AI provider selection (embedding + generation adapters) ---
    # "gemini" (dev) or "onprem" (BGE-M3 + vLLM). The composition root picks adapters.
    ai_provider: Literal["gemini", "onprem"] = Field(default="gemini", alias="AI_PROVIDER")
    embedding_dim: int = Field(default=1024, alias="EMBEDDING_DIM")
    # Active LLM context window (tokens). Extraction sends the whole document when it
    # fits this budget, else falls back to retrieval (docs/domain-design.md §2.12).
    # Default = on-prem GLM (65k); Gemini dev has a much larger window.
    llm_context_tokens: int = Field(default=65000, alias="LLM_CONTEXT_TOKENS")

    # --- Gemini (dev embedding/generation) ---
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_embedding_model: str = Field(
        default="gemini-embedding-001", alias="GEMINI_EMBEDDING_MODEL"
    )
    gemini_llm_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_LLM_MODEL")

    # --- Langfuse (LLM call tracing; optional) ---
    # Tracing is enabled only when both keys are present (see `langfuse_enabled`).
    langfuse_secret_key: str = Field(default="", alias="LANGFUSE_SECRET_KEY")
    langfuse_public_key: str = Field(default="", alias="LANGFUSE_PUBLIC_KEY")
    # User-supplied var is LANGFUSE_BASE_URL; Langfuse's own SDK env is LANGFUSE_HOST.
    # We read BASE_URL here and pass it explicitly to the client (mapped to host).
    langfuse_base_url: str = Field(
        default="https://cloud.langfuse.com", alias="LANGFUSE_BASE_URL"
    )

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_secret_key and self.langfuse_public_key)

    # --- Object storage (MinIO / S3) for original uploaded files ---
    minio_endpoint: str = Field(default="localhost:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="kalex", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="kalexsecret", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="kalex-documents", alias="MINIO_BUCKET")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    # --- LLM (vLLM OpenAI-compatible upstream) ---
    vllm_base_url: str = Field(default="http://10.10.190.10:15006/v1", alias="VLLM_BASE_URL")
    vllm_api_key: str = Field(default="EMPTY", alias="VLLM_API_KEY")
    vllm_model: str = Field(default="glm-5", alias="VLLM_MODEL")
    vllm_timeout_seconds: float = Field(default=120.0, alias="VLLM_TIMEOUT_SECONDS")

    # --- Docling document conversion ---
    docling_ocr_enabled: bool = Field(default=True, alias="DOCLING_OCR_ENABLED")
    docling_ocr_force_full_page: bool = Field(default=False, alias="DOCLING_OCR_FORCE_FULL_PAGE")
    docling_ocr_langs: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["eng", "kor"], alias="DOCLING_OCR_LANGS"
    )
    docling_ocr_fallback_on_decode_error: bool = Field(
        default=True, alias="DOCLING_OCR_FALLBACK_ON_DECODE_ERROR"
    )
    docling_pdf_backend: str = Field(default="pypdfium2", alias="DOCLING_PDF_BACKEND")
    docling_num_threads: int = Field(default=4, alias="DOCLING_NUM_THREADS")

    # --- Hugging Face model download (Docling artifacts) ---
    docling_hf_disable_ssl_verify: bool = Field(default=False, alias="DOCLING_HF_DISABLE_SSL_VERIFY")
    docling_hf_trust_env: bool = Field(default=False, alias="DOCLING_HF_TRUST_ENV")

    # --- HTTP / CORS ---
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://10.10.190.4:13001",
        ],
        alias="CORS_ORIGINS",
    )

    @field_validator("docling_ocr_langs", "cors_origins", mode="before")
    @classmethod
    def _parse_csv_fields(cls, value: str | list[str]) -> list[str]:
        return _split_csv(value)


@lru_cache
def get_settings() -> Settings:
    """Cached settings provider (FastAPI dependency / composition root)."""
    return Settings()
