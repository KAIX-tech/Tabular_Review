"""Application service (use case) for proxying LLM chat completions."""

from __future__ import annotations

from app.core.logging import get_logger
from app.domains.llm.domain.models import LlmResponse
from app.domains.llm.domain.ports import LlmClient

logger = get_logger(__name__)


class LlmProxyService:
    def __init__(self, client: LlmClient, default_model: str) -> None:
        self._client = client
        self._default_model = default_model

    async def chat_completions(self, payload: dict) -> LlmResponse:
        # Guarantee a model is always set, defaulting to the deployment model.
        payload = {**payload, "model": payload.get("model") or self._default_model}
        logger.info("Proxying LLM chat completion model=%s", payload["model"])
        return await self._client.chat_completions(payload)
