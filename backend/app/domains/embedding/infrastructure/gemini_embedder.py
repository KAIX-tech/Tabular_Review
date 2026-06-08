"""Gemini embedding adapter (dev).

Wraps the google-genai SDK. Forces `output_dimensionality` to the configured
dimension (default 1024) so vectors fit the shared pgvector column, and
L2-normalizes them - Gemini only returns normalized vectors at the native 3072
dim, so truncated dims must be normalized for correct cosine distance.

Document and query embeddings use distinct task types for retrieval quality.
"""

from __future__ import annotations

import math

from google import genai
from google.genai import types

from app.core.logging import get_logger
from app.domains.embedding.domain.ports import EmbeddingError, EmbeddingPort

logger = get_logger(__name__)

# Gemini embed_content accepts a batch of contents per call; keep batches modest.
_BATCH_SIZE = 100


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0.0:
        return vector
    return [v / norm for v in vector]


class GeminiEmbedder(EmbeddingPort):
    def __init__(self, *, api_key: str, model: str, dimension: int) -> None:
        # Client is built lazily so the app boots even without a key; embedding
        # then fails per-request (the document is marked failed) instead of at boot.
        self._api_key = api_key
        self._client: genai.Client | None = None
        self._model = model
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def _get_client(self) -> genai.Client:
        if not self._api_key:
            raise EmbeddingError("GEMINI_API_KEY is not set")
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def _embed(self, texts: list[str], task_type: str) -> list[list[float]]:
        if not texts:
            return []
        out: list[list[float]] = []
        for start in range(0, len(texts), _BATCH_SIZE):
            batch = texts[start : start + _BATCH_SIZE]
            try:
                response = await self._get_client().aio.models.embed_content(
                    model=self._model,
                    contents=batch,
                    config=types.EmbedContentConfig(
                        task_type=task_type,
                        output_dimensionality=self._dimension,
                    ),
                )
            except Exception as error:  # SDK raises various exception types
                raise EmbeddingError(f"Gemini embedding failed: {error}") from error
            out.extend(_l2_normalize(list(e.values)) for e in response.embeddings)
        return out

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_DOCUMENT")

    async def embed_query(self, text: str) -> list[float]:
        result = await self._embed([text], "RETRIEVAL_QUERY")
        return result[0]
