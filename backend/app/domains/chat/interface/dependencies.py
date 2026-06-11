"""FastAPI dependency providers for the chat context.

The service is composed per-request from the request-scoped DB session via the
factory installed on ``app.state`` by the composition root (``app.main``).
"""

from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.domains.chat.application.agent import ChatAgentRunner
from app.domains.chat.application.service import ChatService


def get_chat_service(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ChatService:
    return request.app.state.chat_service_factory(session)


def get_chat_agent_runner(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ChatAgentRunner:
    return request.app.state.chat_agent_runner_factory(session)
