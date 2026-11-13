"""Historial router — línea de tiempo de eventos del pipeline por video.

Endpoints:
  GET /api/v1/history                    Eventos de todos los jobs, paginado
  GET /api/v1/videos/{job_id}/history     Línea de tiempo completa de un job
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.core import history_tracker, job_tracker
from src.core.job import JobStage
from src.presentation.api.schemas.history_schema import (
    HistoryEventResponse,
    HistoryListResponse,
    JobTimelineResponse,
)

router = APIRouter(tags=["history"])


@router.get("/history", response_model=HistoryListResponse)
async def list_history(stage: JobStage | None = None, limit: int = 20, offset: int = 0) -> HistoryListResponse:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    events, total = history_tracker.list_events(stage=stage, limit=limit, offset=offset)
    return HistoryListResponse(
        total=total, limit=limit, offset=offset,
        events=[HistoryEventResponse.from_event(e) for e in events],
    )


@router.get("/videos/{job_id}/history", response_model=JobTimelineResponse)
async def get_job_history(job_id: str) -> JobTimelineResponse:
    if job_tracker.get(job_id) is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    events = history_tracker.list_job_events(job_id)
    return JobTimelineResponse(
        job_id=job_id,
        events=[HistoryEventResponse.from_event(e) for e in events],
    )
