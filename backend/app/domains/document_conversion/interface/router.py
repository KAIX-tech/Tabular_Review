"""HTTP router for the document conversion context."""

from __future__ import annotations

import os
import shutil
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.logging import get_logger
from app.domains.document_conversion.application.service import DocumentConversionService
from app.domains.document_conversion.domain.ports import DocumentConversionError
from app.domains.document_conversion.interface.dependencies import (
    get_document_conversion_service,
)
from app.domains.document_conversion.interface.schemas import ConvertResponse

logger = get_logger(__name__)

router = APIRouter(tags=["document-conversion"])


@router.post("/convert", response_model=ConvertResponse)
async def convert_document(
    file: UploadFile = File(...),
    service: DocumentConversionService = Depends(get_document_conversion_service),
) -> ConvertResponse:
    # Docling needs a real file path, so buffer the upload to a temp file.
    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        converted = service.convert(tmp_path, source_filename=file.filename)
        return ConvertResponse(markdown=converted.markdown)
    except DocumentConversionError as error:
        logger.error("Error converting file: %s", error)
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
