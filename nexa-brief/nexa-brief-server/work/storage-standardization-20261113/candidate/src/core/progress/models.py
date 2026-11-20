"""Wire format of a job's live progress (pushed as the `job_progress` realtime event)."""

from __future__ import annotations

import time
from typing import Literal

from pydantic import BaseModel, Field

ProgressStatus = Literal["queued", "running", "done", "failed"]


class JobProgress(BaseModel):
    job_id: str
    status: ProgressStatus = "queued"
    # Pipeline step currently RUNNING (e.g. "video_recorder") — unlike Job.stage,
    # which names the last step that FINISHED.
    step: str | None = None
    step_index: int = 0            # 1-based while running; 0 while queued
    step_count: int = 0
    percent: float = 0.0           # whole job, 0-100
    step_percent: float | None = None  # current step, when the step reports it (renders)
    queue_position: int | None = None  # 1-based, only while queued
    eta_seconds: int | None = None
    started_at: float | None = None
    updated_at: float = Field(default_factory=time.time)
