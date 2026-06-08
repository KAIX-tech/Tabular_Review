"""Database access primitives (async SQLAlchemy 2.0).

Infrastructure-level glue shared by every bounded context that needs
persistence. The composition root (`app.main`) builds the engine + session
factory from settings and stores them on ``app.state``; repositories receive an
``AsyncSession`` per request via the :func:`get_session` dependency.

The ORM models themselves live in each context's ``infrastructure/models.py`` and
register against :class:`Base`. Keeping a single declarative base here lets
Alembic discover all tables from one ``Base.metadata``.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from fastapi import Request


class Base(DeclarativeBase):
    """Declarative base for all ORM models across contexts."""


def create_engine(database_url: str, *, echo: bool = False) -> AsyncEngine:
    """Build the async engine. Called once in the composition root."""
    return create_async_engine(database_url, echo=echo, pool_pre_ping=True)


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: yield a request-scoped session, commit on success.

    Rolls back on any exception so a failed request never leaves a partial write.
    """
    sessionmaker: async_sessionmaker[AsyncSession] = request.app.state.sessionmaker
    async with sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
