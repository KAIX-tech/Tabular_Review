"""Alembic environment - async engine, metadata from the shared declarative Base.

The connection URL comes from application settings (single source of truth), and
``target_metadata`` is :class:`app.core.db.Base` metadata. Each bounded context's
ORM models must be imported here so Alembic autogenerate can see every table.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.db import Base

# --- Register ORM models so their tables attach to Base.metadata ---------------
# Import each context's models module for autogenerate. Add new contexts here as
# they gain persistence (e.g. extraction, chat, identity).
from app.domains.chat.infrastructure import models as _chat_models  # noqa: E402,F401
from app.domains.document_db.infrastructure import models as _document_db_models  # noqa: E402,F401
from app.domains.extraction.infrastructure import models as _extraction_models  # noqa: E402,F401
from app.domains.ingestion.infrastructure import models as _ingestion_models  # noqa: E402,F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject the app's database URL (overrides the empty alembic.ini value).
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


# pgvector indexes (hnsw/ivfflat) can't be introspected by Alembic, so autogenerate
# keeps flagging them for drop. Exclude them from comparison.
_AUTOGEN_IGNORED_INDEXES = {"ix_document_chunk_embedding_hnsw"}


def _include_object(obj, name, type_, reflected, compare_to) -> bool:
    if type_ == "index" and name in _AUTOGEN_IGNORED_INDEXES:
        return False
    return True


def _run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
