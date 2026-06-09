"""Ports (interfaces) for the LLM context."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domains.llm.domain.models import LlmResponse


class LlmUpstreamError(Exception):
    """Base error for upstream LLM failures."""


class LlmTimeoutError(LlmUpstreamError):
    """Upstream LLM call timed out."""


class LlmConnectionError(LlmUpstreamError):
    """Upstream LLM call could not be completed (network/transport)."""


class LlmClient(ABC):
    """Sends an OpenAI-compatible chat-completion request to the upstream model."""

    @abstractmethod
    async def chat_completions(self, payload: dict) -> LlmResponse:
        """Forward ``payload`` to the upstream chat-completions endpoint.

        Raises:
            LlmTimeoutError: upstream timed out.
            LlmConnectionError: transport-level failure.
        """
        raise NotImplementedError


class TextGenerationPort(ABC):
    """Higher-level structured generation (used by extraction, later chat).

    Distinct from the raw proxy `LlmClient`: callers describe the desired JSON
    shape in the prompt and receive a parsed object. Adapters: Gemini (dev),
    vLLM/GLM (on-prem).
    """

    @abstractmethod
    async def generate_json(
        self,
        *,
        system: str,
        user: str,
        max_output_tokens: int | None = None,
    ) -> dict:
        """Generate JSON-mode output and return it parsed.

        Raises:
            LlmUpstreamError: upstream failure or unparseable output.
        """
        raise NotImplementedError
