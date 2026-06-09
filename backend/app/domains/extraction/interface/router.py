"""HTTP router for the extraction context (docs/domain-design.md §6.4).

Creating a run persists it and schedules the convert/generate pipeline as a
background task. The grid reads cells via GET /document-dbs/{id}/cells.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.domains.document_db.application.service import DocumentDbService
from app.domains.document_db.interface.dependencies import get_document_db_service
from app.domains.extraction.application.processor import ExtractionProcessor
from app.domains.extraction.application.service import ExtractionService
from app.domains.extraction.interface.dependencies import (
    get_extraction_processor,
    get_extraction_service,
)
from app.domains.extraction.interface.schemas import (
    CellResponse,
    CellReview,
    ExtractionRunResponse,
    RunCreate,
)

router = APIRouter(tags=["extraction"])


@router.post(
    "/document-dbs/{db_id}/runs",
    response_model=ExtractionRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_run(
    db_id: UUID,
    payload: RunCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    service: ExtractionService = Depends(get_extraction_service),
    processor: ExtractionProcessor = Depends(get_extraction_processor),
    db_service: DocumentDbService = Depends(get_document_db_service),
    settings: Settings = Depends(get_settings),
) -> ExtractionRunResponse:
    await db_service.get_document_db(db_id)  # 404 if the DB is missing
    default_model = (
        settings.gemini_llm_model if settings.ai_provider == "gemini" else settings.vllm_model
    )
    run = await service.create_run(
        db_id,
        document_ids=payload.document_ids,
        column_ids=payload.column_ids,
        overwrite_reviewed=payload.overwrite_reviewed,
        model=payload.model or default_model,
    )
    # Commit before scheduling so the background task (own session) sees the run.
    await session.commit()
    background_tasks.add_task(processor.process, run.id)
    return ExtractionRunResponse.from_domain(run)


@router.get("/runs/{run_id}", response_model=ExtractionRunResponse)
async def get_run(
    run_id: UUID,
    service: ExtractionService = Depends(get_extraction_service),
) -> ExtractionRunResponse:
    return ExtractionRunResponse.from_domain(await service.get_run(run_id))


@router.get("/document-dbs/{db_id}/cells", response_model=list[CellResponse])
async def list_cells(
    db_id: UUID,
    service: ExtractionService = Depends(get_extraction_service),
) -> list[CellResponse]:
    cells = await service.list_cells(db_id)
    return [CellResponse.from_domain(c) for c in cells]


@router.get("/cells/{cell_id}", response_model=CellResponse)
async def get_cell(
    cell_id: UUID,
    service: ExtractionService = Depends(get_extraction_service),
) -> CellResponse:
    return CellResponse.from_domain(await service.get_cell(cell_id))


@router.patch("/cells/{cell_id}", response_model=CellResponse)
async def review_cell(
    cell_id: UUID,
    payload: CellReview,
    service: ExtractionService = Depends(get_extraction_service),
) -> CellResponse:
    cell = await service.update_review(
        cell_id,
        value=payload.value,
        value_json=payload.value_json,
        review_status=payload.review_status,
    )
    return CellResponse.from_domain(cell)
