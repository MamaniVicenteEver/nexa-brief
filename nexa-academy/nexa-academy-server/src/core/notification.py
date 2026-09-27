"""Notification — alerta persistida para el dashboard (token vencido, fallo de
publicación, video listo). Ver `src/core/notification_tracker.py` para el CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

NotificationType = Literal["video_ready", "video_failed", "token_expired"]
NotificationSeverity = Literal["info", "warning", "error"]


class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    type: NotificationType
    severity: NotificationSeverity
    title: str
    message: str
    job_id: str | None = None
    account_alias: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    read_at: str | None = None
