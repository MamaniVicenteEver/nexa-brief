"""Pydantic schemas for the Historial (pipeline event log) endpoints."""

from __future__ import annotations

from pydantic import BaseModel

from src.core.history import HistoryEvent


class HistoryEventResponse(BaseModel):
    event_id: str
    job_id: str
    stage: str
    status: str
    message: str | None = None
    created_at: str

    @classmethod
    def from_event(cls, event: HistoryEvent) -> "HistoryEventResponse":
        return cls(
            event_id=event.event_id,
            job_id=event.job_id,
            stage=event.stage.value,
            status=event.status,
            message=event.message,
            created_at=event.created_at,
        )


class JobTimelineResponse(BaseModel):
    job_id: str
    events: list[HistoryEventResponse]


class HistoryListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    events: list[HistoryEventResponse]
