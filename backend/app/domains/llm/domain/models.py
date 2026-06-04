"""Domain models for the LLM context.

The backend acts as a thin proxy in front of an OpenAI-compatible vLLM server
(keeping the API key server-side and avoiding browser CORS). The payload stays
provider-shaped (OpenAI chat-completions); we model only what the application
layer needs to reason about.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LlmResponse:
    """Raw upstream response, passed back to the client verbatim."""

    content: bytes
    status_code: int
    media_type: str = "application/json"
