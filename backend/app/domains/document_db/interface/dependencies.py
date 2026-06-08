"""FastAPI dependency providers for the document_db context.

The service is composed per-request from the request-scoped DB session via the
factory installed on ``app.state`` by the composition root (``app.main``). This
keeps the concrete adapter choice in main.py while binding a fresh session to
each request.
"""

from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.domains.document_db.application.service import DocumentDbService


def get_document_db_service(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> DocumentDbService:
    return request.app.state.document_db_service_factory(session)
