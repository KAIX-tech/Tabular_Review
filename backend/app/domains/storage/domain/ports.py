"""Port for binary object storage (generic infra context).

Stores original uploaded files off the database (docs/domain-design.md §2.4:
"base64를 DB/프론트에 싣지 않는다"). The concrete adapter (MinIO/S3) lives in
infrastructure. `put` returns the stable object key used as `Document.storage_uri`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class StorageError(Exception):
    """Raised when an object store operation fails."""


class StoragePort(ABC):
    @abstractmethod
    async def put(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes under `key`; returns the key (Document.storage_uri)."""
        raise NotImplementedError

    @abstractmethod
    async def get(self, key: str) -> bytes:
        """Fetch the object bytes. Raises StorageError if missing."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Remove the object (idempotent)."""
        raise NotImplementedError
