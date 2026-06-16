"""HTTP router for the Column Library (reusable column templates).

Global (firm-wide) templates — no DB scoping, no auth yet (D6). Selecting a
template client-side creates a real DocumentColumn via the existing column
endpoint. See docs/domain-design.md §6.2a / §2.3a.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.domains.document_db.application.column_template_service import ColumnTemplateService
from app.domains.document_db.domain.models import ColumnTemplateDraft
from app.domains.document_db.interface.dependencies import get_column_template_service
from app.domains.document_db.interface.schemas import (
    ColumnTemplateCreate,
    ColumnTemplateImport,
    ColumnTemplateResponse,
)

router = APIRouter(tags=["column-template"])


@router.get("/column-templates", response_model=list[ColumnTemplateResponse])
async def list_column_templates(
    service: ColumnTemplateService = Depends(get_column_template_service),
) -> list[ColumnTemplateResponse]:
    templates = await service.list_templates()
    return [ColumnTemplateResponse.from_domain(t) for t in templates]


@router.post(
    "/column-templates",
    response_model=ColumnTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_column_template(
    payload: ColumnTemplateCreate,
    service: ColumnTemplateService = Depends(get_column_template_service),
) -> ColumnTemplateResponse:
    template = await service.create_template(
        name=payload.name,
        data_type=payload.data_type,
        prompt=payload.prompt,
        category=payload.category,
        options=payload.options,
    )
    return ColumnTemplateResponse.from_domain(template)


@router.post(
    "/column-templates:import",
    response_model=list[ColumnTemplateResponse],
    status_code=status.HTTP_201_CREATED,
)
async def import_column_templates(
    payload: ColumnTemplateImport,
    service: ColumnTemplateService = Depends(get_column_template_service),
) -> list[ColumnTemplateResponse]:
    drafts = [
        ColumnTemplateDraft(
            name=t.name,
            data_type=t.data_type,
            prompt=t.prompt,
            category=t.category,
            options=t.options,
        )
        for t in payload.templates
    ]
    created = await service.create_many(drafts)
    return [ColumnTemplateResponse.from_domain(t) for t in created]


@router.delete("/column-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column_template(
    template_id: UUID,
    service: ColumnTemplateService = Depends(get_column_template_service),
) -> None:
    await service.delete_template(template_id)
