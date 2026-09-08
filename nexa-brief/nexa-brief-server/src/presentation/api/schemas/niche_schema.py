"""Response schema for GET /api/v1/niches."""

from __future__ import annotations

from pydantic import BaseModel


class NicheResponse(BaseModel):
    id: str
    display_name: str
    description: str
    pipeline_type: str
    active: bool
    recorder_engine: str
