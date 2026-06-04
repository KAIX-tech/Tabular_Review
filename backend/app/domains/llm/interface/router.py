"""HTTP router for the LLM proxy context."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.logging import get_logger
from app.domains.llm.application.service import LlmProxyService
from app.domains.llm.domain.ports import LlmConnectionError, LlmTimeoutError
from app.domains.llm.interface.dependencies import get_llm_proxy_service

logger = get_logger(__name__)

router = APIRouter(tags=["llm"])


@router.post("/llm/chat/completions")
async def proxy_llm_chat_completions(
    request: Request,
    service: LlmProxyService = Depends(get_llm_proxy_service),
) -> Response:
    payload = await request.json()
    try:
        result = await service.chat_completions(payload)
    except LlmTimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
    except LlmConnectionError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return Response(
        content=result.content,
        status_code=result.status_code,
        media_type=result.media_type,
    )
