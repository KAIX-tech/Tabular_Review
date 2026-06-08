"""MinIO (S3-compatible) object storage adapter.

The `minio` client is synchronous, so blocking calls run in a worker thread to
keep the event loop free. Bucket creation is lazy (on first use) so the
constructor does no network I/O and app startup never blocks on MinIO.
"""

from __future__ import annotations

import asyncio
import io
import threading

from minio import Minio
from minio.error import S3Error

from app.core.logging import get_logger
from app.domains.storage.domain.ports import StorageError, StoragePort

logger = get_logger(__name__)


class MinioStorage(StoragePort):
    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False,
    ) -> None:
        self._client = Minio(
            endpoint, access_key=access_key, secret_key=secret_key, secure=secure
        )
        self._bucket = bucket
        self._bucket_ready = False
        self._bucket_lock = threading.Lock()

    def _ensure_bucket(self) -> None:
        """Create the bucket once, on first use. Runs inside a worker thread."""
        if self._bucket_ready:
            return
        with self._bucket_lock:
            if self._bucket_ready:
                return
            try:
                if not self._client.bucket_exists(self._bucket):
                    self._client.make_bucket(self._bucket)
                    logger.info("Created MinIO bucket %s", self._bucket)
            except S3Error as error:
                raise StorageError(f"Bucket init failed: {error}") from error
            self._bucket_ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        def _put() -> None:
            self._ensure_bucket()
            self._client.put_object(
                self._bucket, key, io.BytesIO(data), length=len(data), content_type=content_type
            )

        try:
            await asyncio.to_thread(_put)
        except S3Error as error:
            raise StorageError(f"put {key} failed: {error}") from error
        return key

    async def get(self, key: str) -> bytes:
        def _get() -> bytes:
            self._ensure_bucket()
            response = None
            try:
                response = self._client.get_object(self._bucket, key)
                return response.read()
            finally:
                if response is not None:
                    response.close()
                    response.release_conn()

        try:
            return await asyncio.to_thread(_get)
        except S3Error as error:
            raise StorageError(f"get {key} failed: {error}") from error

    async def delete(self, key: str) -> None:
        def _delete() -> None:
            self._ensure_bucket()
            self._client.remove_object(self._bucket, key)

        try:
            await asyncio.to_thread(_delete)
        except S3Error as error:
            raise StorageError(f"delete {key} failed: {error}") from error
