"""Application configuration.

Single source of truth for environment-driven settings. Each bounded context
receives the slice of configuration it needs through the composition root
(`app.main.create_app`), never by reading `os.environ` directly. This keeps the
domain and application layers free of infrastructure concerns.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _split_csv(raw: str | list[str]) -> list[str]:
    if isinstance(raw, list):
        return [item.strip() for item in raw if str(item).strip()]
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings(BaseSettings):
    """Environment-bound settings shared across bounded contexts."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

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
