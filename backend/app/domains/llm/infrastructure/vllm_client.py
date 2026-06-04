"""httpx adapter implementing the LlmClient port against a vLLM server."""

from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.domains.llm.domain.models import LlmResponse
from app.domains.llm.domain.ports import LlmClient, LlmConnectionError, LlmTimeoutError

logger = get_logger(__name__)


class VllmClient(LlmClient):
    def __init__(self, base_url: str, api_key: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        # Only attach Authorization when a real key is configured; vLLM started
        # without --api-key rejects an empty bearer token.
        if self._api_key and self._api_key.upper() != "EMPTY":
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    async def chat_completions(self, payload: dict) -> LlmResponse:
        url = f"{self._base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=self._headers())
        except httpx.TimeoutException as error:
            raise LlmTimeoutError("Timed out while calling vLLM") from error
        except httpx.RequestError as error:
            raise LlmConnectionError(f"Failed to call vLLM: {error}") from error

        logger.info("vLLM response status=%s", response.status_code)
        return LlmResponse(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
