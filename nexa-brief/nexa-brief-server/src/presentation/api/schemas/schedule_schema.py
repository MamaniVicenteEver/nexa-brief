"""Pydantic schemas for the /api/v1/schedule router.

Wire-shape for `ScheduleSlot`/`QueueEntry`, kept separate from
`src.core.schedule.models` (the domain layer) so that layer stays free of
FastAPI/response concerns and the HTTP shape can evolve independently — same
separation already used by `library_schema.py` vs `asset_library.py`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from src.core.schedule.models import QueueSource, QueueStatus


# ── Slots ─────────────────────────────────────────────────────────────────────

class ScheduleSlotCreateRequest(BaseModel):
    platform: str = Field(..., description="'tiktok' | 'youtube' | 'facebook'")
    account_alias: str = Field(..., description="Alias en accounts.json, e.g. 'cuenta_1'")
    days: list[int] = Field(default_factory=list, description="0=lunes..6=domingo (datetime.weekday())")
    times: list[str] = Field(default_factory=list, description='["09:00", "21:00"], 24h, UTC')
    enabled: bool = True
    niche_filter: str | None = Field(
        default=None, description="Matchea job_tracker's 'category'; None = cualquier nicho."
    )


class ScheduleSlotUpdateRequest(BaseModel):
    """Update parcial — solo los campos provistos (no None) se modifican."""

    platform: str | None = None
    account_alias: str | None = None
    days: list[int] | None = None
    times: list[str] | None = None
    enabled: bool | None = None
    niche_filter: str | None = None


class ScheduleSlotResponse(BaseModel):
    slot_id: str
    platform: str
    account_alias: str
    days: list[int]
    times: list[str]
    enabled: bool
    niche_filter: str | None
    created_at: str
    updated_at: str


class AssignVideoRequest(BaseModel):
    """Asigna un video a una ocurrencia concreta (fecha+hora) de un horario.
    `time` debe ser uno de `slot.times`."""

    occurrence_date: str = Field(..., description="YYYY-MM-DD")
    time: str = Field(..., description="HH:MM, debe estar en slot.times")
    job_id: str


# ── Queue ─────────────────────────────────────────────────────────────────────

class QueueCreateRequest(BaseModel):
    """Programación ad-hoc: encola un job sin pasar por un horario recurrente."""

    job_id: str
    platform: str
    account_alias: str
    scheduled_at: str | None = Field(
        default=None, description="ISO 8601 UTC; None = publicar en el próximo tick."
    )


class PublishNowRequest(BaseModel):
    job_id: str
    platform: str
    account_alias: str


class QueueEntryResponse(BaseModel):
    entry_id: str
    job_id: str
    platform: str
    account_alias: str
    slot_id: str | None
    scheduled_at: str | None
    source: QueueSource
    status: QueueStatus
    post_id: str | None
    url: str | None
    error: str | None
    created_at: str
    updated_at: str
    processed_at: str | None


class QueueListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    entries: list[QueueEntryResponse]
