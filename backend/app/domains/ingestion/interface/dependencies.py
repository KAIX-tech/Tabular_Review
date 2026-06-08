"""FastAPI dependency providers for the ingestion context."""

from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.domains.ingestion.application.processor import DocumentProcessor
from app.domains.ingestion.application.service import IngestionService


def get_ingestion_service(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> IngestionService:
    return request.app.state.ingestion_service_factory(session)


def get_document_processor(request: Request) -> DocumentProcessor:
    return request.app.state.document_processor
