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
