"""HTTP router for the ingestion context (docs/domain-design.md §6.3).

Upload stores the file + a Document row synchronously, then schedules the
convert/chunk/embed pipeline as a background task. Missing-document errors map to
404 via handlers in the composition root.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.domains.document_db.application.service import DocumentDbService
from app.domains.document_db.interface.dependencies import get_document_db_service
from app.domains.ingestion.application.processor import DocumentProcessor
from app.domains.ingestion.application.service import IngestionService
from app.domains.ingestion.interface.dependencies import (
    get_document_processor,
    get_ingestion_service,
)
from app.domains.ingestion.interface.schemas import DocumentContentResponse, DocumentResponse

router = APIRouter(tags=["ingestion"])


@router.post(
    "/document-dbs/{db_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    db_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    service: IngestionService = Depends(get_ingestion_service),
    processor: DocumentProcessor = Depends(get_document_processor),
    db_service: DocumentDbService = Depends(get_document_db_service),
) -> DocumentResponse:
    await db_service.get_document_db(db_id)  # 404 if the DB is missing
    data = await file.read()
    document = await service.create_document(
        db_id,
        filename=file.filename or "untitled",
        mime_type=file.content_type or "application/octet-stream",
        data=data,
    )
    # Commit now so the row is durable/visible before the background task (which
    # uses its own session) reads it — the request session's teardown commit
    # would otherwise race the task.
    await session.commit()
    # Run convert -> chunk -> embed after the response is sent.
    background_tasks.add_task(processor.process, document.id)
    return DocumentResponse.from_domain(document)


@router.get("/document-dbs/{db_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    db_id: UUID,
    service: IngestionService = Depends(get_ingestion_service),
) -> list[DocumentResponse]:
    docs = await service.list_documents(db_id)
    return [DocumentResponse.from_domain(d) for d in docs]


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    service: IngestionService = Depends(get_ingestion_service),
) -> DocumentResponse:
    return DocumentResponse.from_domain(await service.get_document(document_id))


@router.get("/documents/{document_id}/content", response_model=DocumentContentResponse)
async def get_document_content(
    document_id: UUID,
    service: IngestionService = Depends(get_ingestion_service),
) -> DocumentContentResponse:
    return DocumentContentResponse(markdown=await service.get_content(document_id))


@router.get("/documents/{document_id}/file")
async def download_document(
    document_id: UUID,
    service: IngestionService = Depends(get_ingestion_service),
) -> Response:
    data, mime_type, name = await service.get_file(document_id)
    return Response(
        content=data,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{name}"'},
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    service: IngestionService = Depends(get_ingestion_service),
) -> None:
    await service.delete_document(document_id)
