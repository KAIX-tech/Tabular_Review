"""Gemini structured-generation adapter (dev).

Implements TextGenerationPort with the google-genai SDK in JSON mode. The desired
JSON shape is described in the prompt (provider-portable); the response is parsed
and returned. Client is built lazily so the app boots without a key.
"""

from __future__ import annotations

import asyncio
import json

from google import genai
from google.genai import types

from app.core.logging import get_logger
from app.domains.llm.domain.ports import LlmUpstreamError, TextGenerationPort

logger = get_logger(__name__)

# Transient upstream conditions worth retrying with backoff.
_TRANSIENT_MARKERS = ("503", "unavailable", "429", "resource_exhausted", "overloaded")
_MAX_ATTEMPTS = 4


def _is_transient(error: Exception) -> bool:
    msg = str(error).lower()
    return any(marker in msg for marker in _TRANSIENT_MARKERS)


class GeminiLlm(TextGenerationPort):
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._client: genai.Client | None = None
        self._model = model

    def _get_client(self) -> genai.Client:
        if not self._api_key:
            raise LlmUpstreamError("GEMINI_API_KEY is not set")
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def generate_json(
        self,
        *,
        system: str,
        user: str,
        max_output_tokens: int | None = None,
    ) -> dict:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=0.0,
            max_output_tokens=max_output_tokens,
        )
        response = None
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                response = await self._get_client().aio.models.generate_content(
                    model=self._model, contents=user, config=config
                )
                break
            except Exception as error:  # SDK raises various exception types
                if _is_transient(error) and attempt < _MAX_ATTEMPTS:
                    delay = 2 ** (attempt - 1)
                    logger.warning("Gemini transient error (attempt %d), retrying in %ds", attempt, delay)
                    await asyncio.sleep(delay)
                    continue
                raise LlmUpstreamError(f"Gemini generation failed: {error}") from error

        text = response.text or ""
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as error:
            raise LlmUpstreamError(f"Gemini returned non-JSON output: {error}") from error
        if not isinstance(parsed, dict):
            raise LlmUpstreamError("Gemini JSON output was not an object")
        return parsed
