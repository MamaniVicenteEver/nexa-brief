"""Schedule domain models — recurring publishing slots and the publish queue.

Pure Pydantic + stdlib, no FastAPI/adapters imports (see "Portabilidad" en el
plan) — hermano de `src/core/job_tracker.py`, pero para programación
recurrente + cola de publicación.

Por qué dos entidades y no tres: una ocurrencia de un horario recurrente
(día+hora concretos) nunca necesita persistirse como algo aparte — en el
momento en que se decide algo para esa ocurrencia (asignación manual o
auto-elección), esa decisión **es** un `QueueEntry` (job_id + platform +
account_alias + scheduled_at + status). `ScheduleSlot.slot_id` queda
referenciado en `QueueEntry.slot_id` (nullable) solo para
trazabilidad/agrupación en la UI.
"""

from __future__ import annotations

from enum import Enum

from typing import Literal

from pydantic import BaseModel, Field


class QueueStatus(str, Enum):
    QUEUED = "queued"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"
    # El post se eliminó de la plataforma desde Nexa Brief (ver core/video_deletion.py).
    REMOVED = "removed"
    OUTCOME_UNKNOWN = "outcome_unknown"


class QueueSource(str, Enum):
    MANUAL = "manual"
    AUTO = "auto"
    IMMEDIATE = "immediate"


class ScheduleSlot(BaseModel):
    """Horario recurrente: una plataforma+cuenta publica en ciertos días/horas."""

    slot_id: str
    platform: str
    account_alias: str
    days: list[int] = Field(default_factory=list)    # 0=lunes..6=domingo (datetime.weekday())
    times: list[str] = Field(default_factory=list)    # ["09:00", "21:00"], 24h, UTC
    enabled: bool = True
    niche_filter: str | None = None    # matchea job_tracker's "category"
    # Los slots viejos se interpretan como video; las franjas de imagen guardan
    # categoría y zona explícitas para resolver DST sin adivinar.
    content_kind: Literal["video", "image", "carousel", "reel"] = "video"
    category_id: str | None = None
    timezone: str = "UTC"
    created_at: str
    updated_at: str


class QueueEntry(BaseModel):
    """Una ocurrencia decidida (asignada a mano o auto-elegida) de publicación,
    o una publicación ad-hoc/inmediata sin horario recurrente asociado."""

    entry_id: str
    job_id: str | None = None
    platform: str
    account_alias: str
    format: str | None = None
    slot_id: str | None = None
    scheduled_at: str | None = None    # None = inmediato
    source: QueueSource
    status: QueueStatus = QueueStatus.QUEUED
    post_id: str | None = None
    url: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str
    processed_at: str | None = None
    lease_until: str | None = None
    content_kind: Literal["video", "image", "carousel", "reel"] = "video"
    content_id: str | None = None
    delivery_id: str | None = None
