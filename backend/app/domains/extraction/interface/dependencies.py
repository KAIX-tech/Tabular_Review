"""FastAPI dependency providers for the extraction context."""

from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.domains.extraction.application.processor import ExtractionProcessor
from app.domains.extraction.application.service import ExtractionService


def get_extraction_service(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ExtractionService:
    return request.app.state.extraction_service_factory(session)


def get_extraction_processor(request: Request) -> ExtractionProcessor:
    return request.app.state.extraction_processor
