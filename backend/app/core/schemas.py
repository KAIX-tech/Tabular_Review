"""Shared HTTP DTO helpers (interface layer).

camelCase wire shape to match the frontend Zod schemas, and an ISO datetime
serializer that emits RFC3339 with a `Z` suffix (UTC-normalized).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel

IsoDatetime = Annotated[
    datetime,
    PlainSerializer(
        lambda dt: dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        return_type=str,
    ),
]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
