"""Wire schemas de la galería global de publicaciones archivadas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PublicationListResponse(StrictSchema):
    items: list[dict[str, Any]]
    next_cursor: str | None = None
    as_of: datetime


class SignedAssetResponse(StrictSchema):
    url: str
    expires_at: datetime
    mime: str
    sha256: str
