"""HTTP DTOs for the document conversion context."""

from __future__ import annotations

from pydantic import BaseModel


class ConvertResponse(BaseModel):
    markdown: str
