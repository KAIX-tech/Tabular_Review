"""FastAPI dependency providers for the document conversion context.

The concrete service is built once in the composition root (`app.main`) and
stored on ``app.state``; these providers expose it to routers and allow tests to
override it via ``app.dependency_overrides``.
"""

from __future__ import annotations

from fastapi import Request

from app.domains.document_conversion.application.service import DocumentConversionService


def get_document_conversion_service(request: Request) -> DocumentConversionService:
    return request.app.state.document_conversion_service
