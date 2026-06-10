"""On-prem structured-generation adapter (vLLM / GLM, OpenAI-compatible).

Implements TextGenerationPort by calling the vLLM chat-completions endpoint and
parsing a JSON object from the response: temperature 0, retry with backoff on
transient upstream conditions, and optional Langfuse tracing.

Used for both LLM_PROVIDER=onprem (vLLM/GLM) and LLM_PROVIDER=openrouter (dev
GLM) — both OpenAI-compatible. Reuses VllmClient for transport/auth.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import nullcontext
from typing import TYPE_CHECKING, Any

from app.core.logging import get_logger
from app.domains.llm.domain.ports import (
    LlmUpstreamError,
    TextGenerationPort,
)
from app.domains.llm.infrastructure.vllm_client import VllmClient

if TYPE_CHECKING:
    from langfuse import Langfuse

logger = get_logger(__name__)

_MAX_ATTEMPTS = 4
_TRANSIENT_STATUS = {429, 500, 502, 503, 504}


def _usage_details(data: dict) -> dict[str, int]:
    """Map an OpenAI-style usage block to Langfuse usage_details (best-effort)."""
    usage = data.get("usage") or {}
    details: dict[str, int] = {}
    for src, dst in (
        ("prompt_tokens", "input"),
        ("completion_tokens", "output"),
        ("total_tokens", "total"),
    ):
        value = usage.get(src)
        if isinstance(value, int):
            details[dst] = value
    return details


def _strip_code_fence(text: str) -> str:
    """Remove a leading/trailing ```json ... ``` fence some models add."""
    stripped = text.strip()
    if stripped.startswith("```"):
        # drop the first fence line (``` or ```json) and a trailing fence
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


class VllmTextGeneration(TextGenerationPort):
    def __init__(
        self,
        *,
        client: VllmClient,
        model: str,
        json_object_mode: bool = True,
        tracer: Langfuse | None = None,
    ) -> None:
        self._client = client
        self._model = model
        self._json_object_mode = json_object_mode
        self._tracer = tracer

    async def generate_json(
        self,
        *,
        system: str,
        user: str,
        max_output_tokens: int | None = None,
    ) -> dict:
        span_cm = (
            self._tracer.start_as_current_observation(
                name="vllm.generate_json",
                as_type="generation",
                model=self._model,
                input={"system": system, "user": user},
                model_parameters={
                    "temperature": 0.0,
                    "max_output_tokens": max_output_tokens,
                },
            )
            if self._tracer is not None
            else nullcontext()
        )
        with span_cm as generation:
            try:
                data = await self._invoke(
                    system=system, user=user, max_output_tokens=max_output_tokens
                )
                parsed = self._parse(data)
            except Exception as error:
                if generation is not None:
                    generation.update(level="ERROR", status_message=str(error))
                raise
            if generation is not None:
                generation.update(output=parsed, usage_details=_usage_details(data))
            return parsed

    async def _invoke(
        self, *, system: str, user: str, max_output_tokens: int | None
    ) -> dict:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.0,
        }
        if max_output_tokens is not None:
            payload["max_tokens"] = max_output_tokens
        if self._json_object_mode:
            payload["response_format"] = {"type": "json_object"}

        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                response = await self._client.chat_completions(payload)
            except LlmUpstreamError as error:
                # Transport-level (timeout/connection): retry, then give up.
                if attempt < _MAX_ATTEMPTS:
                    await self._backoff(attempt, str(error))
                    continue
                raise

            if response.status_code == 200:
                try:
                    return json.loads(response.content)
                except json.JSONDecodeError as error:
                    raise LlmUpstreamError(
                        f"vLLM returned non-JSON envelope: {error}"
                    ) from error

            body = response.content[:500].decode("utf-8", "replace")
            if response.status_code in _TRANSIENT_STATUS and attempt < _MAX_ATTEMPTS:
                await self._backoff(attempt, f"HTTP {response.status_code}")
                continue
            raise LlmUpstreamError(
                f"vLLM generation failed: HTTP {response.status_code}: {body}"
            )

        raise LlmUpstreamError("vLLM generation failed: exhausted retries")

    @staticmethod
    async def _backoff(attempt: int, reason: str) -> None:
        delay = 2 ** (attempt - 1)
        logger.warning("vLLM transient error (%s, attempt %d); retrying in %ds", reason, attempt, delay)
        await asyncio.sleep(delay)

    @staticmethod
    def _parse(data: dict) -> dict:
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LlmUpstreamError(f"vLLM response missing message content: {error}") from error
        text = _strip_code_fence(content or "")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as error:
            raise LlmUpstreamError(f"vLLM returned non-JSON output: {error}") from error
        if not isinstance(parsed, dict):
            raise LlmUpstreamError("vLLM JSON output was not an object")
        return parsed
