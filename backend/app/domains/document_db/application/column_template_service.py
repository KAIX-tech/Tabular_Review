"""Application service for the Column Library (reusable column templates).

Thin orchestration over ColumnTemplateRepository. Templates are global (no DB
scoping, no aggregate invariant) so this stays separate from DocumentDbService.
See docs/domain-design.md §2.3a / §9 #19.
"""

from __future__ import annotations

from uuid import UUID

from app.domains.document_db.domain.models import (
    ColumnDataType,
    ColumnTemplate,
    ColumnTemplateDraft,
)
from app.domains.document_db.domain.ports import ColumnTemplateRepository


class ColumnTemplateService:
    def __init__(self, repo: ColumnTemplateRepository) -> None:
        self._repo = repo

    async def list_templates(self) -> list[ColumnTemplate]:
        return await self._repo.list_all()

    async def create_template(
        self, *, name: str, data_type: ColumnDataType, prompt: str, category: str | None
    ) -> ColumnTemplate:
        return await self._repo.add(
            name=name, data_type=data_type, prompt=prompt, category=category
        )

    async def create_many(self, drafts: list[ColumnTemplateDraft]) -> list[ColumnTemplate]:
        if not drafts:
            return []
        return await self._repo.add_many(drafts)

    async def delete_template(self, template_id: UUID) -> None:
        await self._repo.delete(template_id)
