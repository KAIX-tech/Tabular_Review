"""In-memory ColumnTemplateRepository for fast, DB-free tests."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.domains.document_db.domain.models import (
    ColumnDataType,
    ColumnTemplate,
    ColumnTemplateDraft,
)
from app.domains.document_db.domain.ports import (
    ColumnTemplateNotFoundError,
    ColumnTemplateRepository,
)


class FakeColumnTemplateRepository(ColumnTemplateRepository):
    def __init__(self) -> None:
        self._items: dict[UUID, ColumnTemplate] = {}
        self._seq = 0

    def _now(self) -> datetime:
        # Monotonic-ish timestamps so created_at ordering is deterministic.
        self._seq += 1
        return datetime(2026, 1, 1, tzinfo=timezone.utc).replace(microsecond=self._seq)

    async def list_all(self) -> list[ColumnTemplate]:
        return sorted(self._items.values(), key=lambda t: t.created_at)

    async def add(
        self, *, name: str, data_type: ColumnDataType, prompt: str, category: str | None
    ) -> ColumnTemplate:
        template = ColumnTemplate(
            id=uuid4(),
            name=name,
            data_type=data_type,
            prompt=prompt,
            category=category,
            created_at=self._now(),
        )
        self._items[template.id] = template
        return template

    async def add_many(self, drafts: list[ColumnTemplateDraft]) -> list[ColumnTemplate]:
        created = []
        for d in drafts:
            created.append(
                await self.add(
                    name=d.name, data_type=d.data_type, prompt=d.prompt, category=d.category
                )
            )
        return created

    async def delete(self, template_id: UUID) -> None:
        if template_id not in self._items:
            raise ColumnTemplateNotFoundError(str(template_id))
        del self._items[template_id]
