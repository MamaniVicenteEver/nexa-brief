"""HistoryEvent — un registro inmutable de una transición de stage de un Job.

A diferencia de `job_tracker.py` (que sobrescribe el estado actual de un job),
cada `HistoryEvent` se agrega, nunca se modifica — es la línea de tiempo
completa de las 8+1 etapas del pipeline para un video, usada por la sección
Historial del dashboard.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from src.core.job import Job, JobStage

EventStatus = Literal["started", "completed", "failed"]


class HistoryEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    job_id: str
    stage: JobStage
    status: EventStatus
    message: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @classmethod
    def from_job(cls, job: Job) -> "HistoryEvent":
        """Construye el evento correspondiente al stage actual de `job`.

        `job.stage == FAILED` se traduce a status="failed" (con el último error
        como mensaje); cualquier otro stage se traduce a status="completed"
        (el stage ya terminó de correr cuando `on_stage` se invoca — ver
        `pipeline.run`).
        """
        if job.stage == JobStage.FAILED:
            return cls(
                job_id=job.job_id,
                stage=job.stage,
                status="failed",
                message=job.errors[-1] if job.errors else None,
            )
        return cls(job_id=job.job_id, stage=job.stage, status="completed")
