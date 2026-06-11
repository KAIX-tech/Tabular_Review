"""chat_session, chat_message, chat_source

Revision ID: f2d8c1a47e90
Revises: 34afb6206cf6
Create Date: 2026-06-11 10:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f2d8c1a47e90'
down_revision: str | None = '34afb6206cf6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('chat_session',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('title', sa.Text(), server_default=sa.text("'새 대화'"), nullable=False),
    sa.Column('scope_document_db_id', sa.UUID(), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['scope_document_db_id'], ['document_db.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('chat_message',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.Text(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('steps', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("role IN ('user', 'assistant')", name='ck_chat_message_role'),
    sa.ForeignKeyConstraint(['session_id'], ['chat_session.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_message_session_created', 'chat_message', ['session_id', 'created_at'], unique=False)
    op.create_table('chat_source',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('message_id', sa.UUID(), nullable=False),
    sa.Column('chunk_id', sa.UUID(), nullable=True),
    sa.Column('cell_id', sa.UUID(), nullable=True),
    sa.Column('quote', sa.Text(), nullable=False),
    sa.Column('page', sa.Integer(), nullable=True),
    sa.Column('rank', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('chunk_id IS NOT NULL OR cell_id IS NOT NULL', name='ck_chat_source_target'),
    sa.ForeignKeyConstraint(['cell_id'], ['cell.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['chunk_id'], ['document_chunk.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['message_id'], ['chat_message.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_source_message_id'), 'chat_source', ['message_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_chat_source_message_id'), table_name='chat_source')
    op.drop_table('chat_source')
    op.drop_index('ix_chat_message_session_created', table_name='chat_message')
    op.drop_table('chat_message')
    op.drop_table('chat_session')
