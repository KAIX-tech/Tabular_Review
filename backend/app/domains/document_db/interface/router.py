"""HTTP router for the document_db context (docs/domain-design.md §6.1–6.2).

Domain "not found" errors are translated to HTTP 404 by exception handlers
registered in the composition root, so handlers stay focused on the happy path.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.domains.document_db.application.service import DocumentDbService
from app.domains.document_db.interface.dependencies import get_document_db_service
from app.domains.document_db.interface.schemas import (
    ColumnCreate,
    ColumnReorder,
    ColumnResponse,
    ColumnUpdate,
    DocumentDbCreate,
    DocumentDbResponse,
    DocumentDbUpdate,
)

router = APIRouter(tags=["document-db"])


# --- DocumentDb ------------------------------------------------------------
@router.get("/document-dbs", response_model=list[DocumentDbResponse])
async def list_document_dbs(
    service: DocumentDbService = Depends(get_document_db_service),
) -> list[DocumentDbResponse]:
    summaries = await service.list_document_dbs()
    return [DocumentDbResponse.from_domain(s) for s in summaries]


@router.post(
    "/document-dbs", response_model=DocumentDbResponse, status_code=status.HTTP_201_CREATED
)
async def create_document_db(
    payload: DocumentDbCreate,
    service: DocumentDbService = Depends(get_document_db_service),
) -> DocumentDbResponse:
    summary = await service.create_document_db(name=payload.name, description=payload.description)
    return DocumentDbResponse.from_domain(summary)


@router.get("/document-dbs/{db_id}", response_model=DocumentDbResponse)
async def get_document_db(
    db_id: UUID,
    service: DocumentDbService = Depends(get_document_db_service),
) -> DocumentDbResponse:
    summary = await service.get_document_db(db_id)
    return DocumentDbResponse.from_domain(summary)


@router.patch("/document-dbs/{db_id}", response_model=DocumentDbResponse)
async def update_document_db(
    db_id: UUID,
    payload: DocumentDbUpdate,
    service: DocumentDbService = Depends(get_document_db_service),
) -> DocumentDbResponse:
    summary = await service.update_document_db(db_id, payload.model_dump(exclude_unset=True))
    return DocumentDbResponse.from_domain(summary)


@router.delete("/document-dbs/{db_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_db(
    db_id: UUID,
    service: DocumentDbService = Depends(get_document_db_service),
) -> None:
    await service.delete_document_db(db_id)


# --- DocumentColumn --------------------------------------------------------
@router.get("/document-dbs/{db_id}/columns", response_model=list[ColumnResponse])
async def list_columns(
    db_id: UUID,
    service: DocumentDbService = Depends(get_document_db_service),
) -> list[ColumnResponse]:
    columns = await service.list_columns(db_id)
    return [ColumnResponse.from_domain(c) for c in columns]


@router.post(
    "/document-dbs/{db_id}/columns",
    response_model=ColumnResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_column(
    db_id: UUID,
    payload: ColumnCreate,
    service: DocumentDbService = Depends(get_document_db_service),
) -> ColumnResponse:
    column = await service.add_column(
        db_id,
        name=payload.name,
        data_type=payload.data_type,
        prompt=payload.prompt,
        options=payload.options,
    )
    return ColumnResponse.from_domain(column)


@router.post("/document-dbs/{db_id}/columns:reorder", response_model=list[ColumnResponse])
async def reorder_columns(
    db_id: UUID,
    payload: ColumnReorder,
    service: DocumentDbService = Depends(get_document_db_service),
) -> list[ColumnResponse]:
    columns = await service.reorder_columns(db_id, payload.order)
    return [ColumnResponse.from_domain(c) for c in columns]


@router.patch("/columns/{column_id}", response_model=ColumnResponse)
async def update_column(
    column_id: UUID,
    payload: ColumnUpdate,
    service: DocumentDbService = Depends(get_document_db_service),
) -> ColumnResponse:
    column = await service.update_column(column_id, payload.model_dump(exclude_unset=True))
    return ColumnResponse.from_domain(column)


@router.delete("/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    column_id: UUID,
    service: DocumentDbService = Depends(get_document_db_service),
) -> None:
    await service.delete_column(column_id)
