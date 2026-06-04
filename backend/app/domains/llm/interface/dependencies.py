"""FastAPI dependency providers for the LLM context."""

from __future__ import annotations

from fastapi import Request

from app.domains.llm.application.service import LlmProxyService


def get_llm_proxy_service(request: Request) -> LlmProxyService:
    return request.app.state.llm_proxy_service
