"""On-prem embedding adapter (HF Text-Embeddings-Inference / BGE-M3).

Calls a TEI server's ``POST /embed`` endpoint (https://github.com/huggingface/
text-embeddings-inference). TEI hosts a single model, so no model name is sent;
``normalize=true`` returns L2-normalized vectors suited to cosine distance.

The single embedding adapter (BGE-M3 / 1024d). Vectors must be `dimension` long
to fit the shared pgvector column (docs/domain-design.md §2.5, §2.12).
"""

from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.domains.embedding.domain.ports import EmbeddingError, EmbeddingPort

logger = get_logger(__name__)

# TEI's default max client batch size is 32; keep batches within that.
_BATCH_SIZE = 32


class TeiEmbedder(EmbeddingPort):
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        dimension: int,
        timeout_seconds: float = 60.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._dimension = dimension
        self._timeout_seconds = timeout_seconds

    @property
    def dimension(self) -> int:
        return self._dimension

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key and self._api_key.upper() != "EMPTY":
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self._base_url:
            raise EmbeddingError("EMBEDDING_BASE_URL is not set")

        url = f"{self._base_url}/embed"
        out: list[list[float]] = []
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                for start in range(0, len(texts), _BATCH_SIZE):
                    batch = texts[start : start + _BATCH_SIZE]
                    response = await client.post(
                        url,
                        json={"inputs": batch, "normalize": True, "truncate": True},
                        headers=self._headers(),
                    )
                    if response.status_code != 200:
                        raise EmbeddingError(
                            f"TEI embedding failed: HTTP {response.status_code}: "
                            f"{response.text[:300]}"
                        )
                    vectors = response.json()
                    out.extend(vectors)
        except httpx.HTTPError as error:
            raise EmbeddingError(f"TEI embedding request failed: {error}") from error

        # Guard against a misconfigured TEI model emitting the wrong dimension
        # (it would otherwise fail opaquely at the pgvector insert).
        if out and len(out[0]) != self._dimension:
            raise EmbeddingError(
                f"TEI returned {len(out[0])}-dim vectors, expected {self._dimension} "
                "(check EMBEDDING_DIM vs the served model)"
            )
        return out

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts)

    async def embed_query(self, text: str) -> list[float]:
        result = await self._embed([text])
        return result[0]
