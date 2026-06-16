"""ColumnTemplateService use-case tests over the in-memory fake repository."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.domains.document_db.application.column_template_service import ColumnTemplateService
from app.domains.document_db.domain.models import ColumnDataType, ColumnTemplateDraft
from app.domains.document_db.domain.ports import ColumnTemplateNotFoundError
from tests.document_db.fake_repository import FakeColumnTemplateRepository


@pytest.fixture
def service() -> ColumnTemplateService:
    return ColumnTemplateService(FakeColumnTemplateRepository())


async def test_create_then_list(service: ColumnTemplateService) -> None:
    created = await service.create_template(
        name="준거법", data_type=ColumnDataType.TEXT, prompt="준거법 조항", category="법률", options=None
    )
    assert created.name == "준거법"
    templates = await service.list_templates()
    assert [t.id for t in templates] == [created.id]


async def test_list_orders_by_created_at(service: ColumnTemplateService) -> None:
    first = await service.create_template(
        name="A", data_type=ColumnDataType.TEXT, prompt="p", category=None, options=None
    )
    second = await service.create_template(
        name="B", data_type=ColumnDataType.NUMBER, prompt="p", category=None, options=None
    )
    assert [t.id for t in await service.list_templates()] == [first.id, second.id]


async def test_create_many_bulk(service: ColumnTemplateService) -> None:
    drafts = [
        ColumnTemplateDraft(name="A", data_type=ColumnDataType.LIST, prompt="p"),
        ColumnTemplateDraft(
            name="B", data_type=ColumnDataType.MULTI_SELECT, prompt="p", category="c"
        ),
    ]
    created = await service.create_many(drafts)
    assert len(created) == 2
    assert len(await service.list_templates()) == 2


async def test_create_many_empty_is_noop(service: ColumnTemplateService) -> None:
    assert await service.create_many([]) == []


async def test_options_round_trip(service: ColumnTemplateService) -> None:
    opts = ["Manufacturing > Automotive > Auto Parts", "Finance > Banking", "Others"]
    created = await service.create_template(
        name="산업분류",
        data_type=ColumnDataType.SINGLE_SELECT,
        prompt="문서의 산업 카테고리",
        category="M&A",
        options=opts,
    )
    assert created.options == opts
    [listed] = await service.list_templates()
    assert listed.options == opts


async def test_delete_then_gone(service: ColumnTemplateService) -> None:
    created = await service.create_template(
        name="X", data_type=ColumnDataType.BOOLEAN, prompt="p", category=None, options=None
    )
    await service.delete_template(created.id)
    assert await service.list_templates() == []


async def test_delete_missing_raises(service: ColumnTemplateService) -> None:
    with pytest.raises(ColumnTemplateNotFoundError):
        await service.delete_template(uuid4())
