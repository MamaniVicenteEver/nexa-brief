"""History Tracker — persistencia append-only de eventos de pipeline.

A diferencia de `job_tracker.py` (que sobrescribe el registro de un job), acá
cada evento se AGREGA — nunca se modifica ni se borra un evento existente,
salvo al eliminar el job completo.

Persiste en la colección "history_events" del DataStore (una fila por
transición de stage, con `job_id` para filtrar). Cada función acá es la única
forma en que el resto del código toca el historial — mantener esta interfaz
angosta es lo que permite cambiar el backend sin tocar routers ni el pipeline.
"""

from __future__ import annotations

import json

from src.core.data import collection
from src.core.history import HistoryEvent
from src.core.job import JobStage


def _events():
    return collection("history_events")


async def append_event(event: HistoryEvent) -> None:
    """Agrega `event` a la línea de tiempo de su job. Nunca sobrescribe eventos previos."""
    await _events().insert(json.loads(event.model_dump_json()))


def list_job_events(job_id: str) -> list[HistoryEvent]:
    """Línea de tiempo completa de un job, en el orden en que ocurrieron."""
    events = [HistoryEvent(**r) for r in _events().list({"job_id": job_id})]
    events.sort(key=lambda e: e.created_at)
    return events


def list_events(
    *,
    stage: JobStage | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[HistoryEvent], int]:
    """Eventos de TODOS los jobs, más recientes primero. `stage` filtra por stage exacto."""
    where = {"stage": stage.value} if stage is not None else None
    events = [HistoryEvent(**r) for r in _events().list(where)]
    events.sort(key=lambda e: e.created_at, reverse=True)
    total = len(events)
    return events[offset : offset + limit], total


async def delete_job_history(job_id: str) -> bool:
    """Borra la línea de tiempo completa de un job. Retorna True si existía."""
    return bool(await _events().delete_where({"job_id": job_id}))
