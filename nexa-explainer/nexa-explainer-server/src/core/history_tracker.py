"""History Tracker — persistencia append-only de eventos de pipeline.

Mismo patrón de concurrencia que `job_tracker.py` (asyncio.Lock por archivo +
escritura atómica vía `tmp.replace(path)`), pero a diferencia de ese módulo
(que sobrescribe el registro de un job), acá cada evento se AGREGA — nunca se
modifica ni se borra un evento existente.

Layout en disco:
  data/historial/{job_id}.json  — lista de HistoryEvent (uno por transición
                                   de stage) de ESE job, más recientes al final.
  data/historial/_index.json    — lista plana [{job_id, last_event_at}], para
                                   poder paginar `list_events()` sin abrir
                                   todos los archivos por job.

Cada función acá es la única forma en que el resto del código toca estos
archivos — mantener esta interfaz angosta es lo que permite reemplazar el
backend de almacenamiento por una base de datos real más adelante sin tocar
routers ni el pipeline.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from src.config.settings import settings
from src.core.history import HistoryEvent
from src.core.job import JobStage

logger = structlog.get_logger(__name__)

_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)


def _lock_for(path: Path) -> asyncio.Lock:
    return _locks[path]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _job_events_path(job_id: str) -> Path:
    return settings.historial_dir / f"{job_id}.json"


def _index_path() -> Path:
    return settings.historial_dir / "_index.json"


def _read_json_list(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("history_tracker_file_corrupt", path=str(path))
        return []


def _write_json_list(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


async def _touch_index(job_id: str) -> None:
    path = _index_path()
    async with _lock_for(path):
        data = _read_json_list(path)
        index = next((i for i, r in enumerate(data) if r.get("job_id") == job_id), None)
        record = {"job_id": job_id, "last_event_at": _now_iso()}
        if index is None:
            data.append(record)
        else:
            data[index] = record
        _write_json_list(path, data)


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def append_event(event: HistoryEvent) -> None:
    """Agrega `event` a la línea de tiempo de su job. Nunca sobrescribe eventos previos."""
    path = _job_events_path(event.job_id)
    async with _lock_for(path):
        data = _read_json_list(path)
        data.append(json.loads(event.model_dump_json()))
        _write_json_list(path, data)
    await _touch_index(event.job_id)


def list_job_events(job_id: str) -> list[HistoryEvent]:
    """Línea de tiempo completa de un job, en el orden en que ocurrieron."""
    return [HistoryEvent(**r) for r in _read_json_list(_job_events_path(job_id))]


def list_events(
    *,
    stage: JobStage | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[HistoryEvent], int]:
    """Eventos de TODOS los jobs, más recientes primero. `stage` filtra por stage exacto."""
    index = _read_json_list(_index_path())
    index.sort(key=lambda r: r.get("last_event_at", ""), reverse=True)

    all_events: list[HistoryEvent] = []
    for entry in index:
        all_events.extend(list_job_events(entry["job_id"]))
    all_events.sort(key=lambda e: e.created_at, reverse=True)

    if stage is not None:
        all_events = [e for e in all_events if e.stage == stage]

    total = len(all_events)
    return all_events[offset : offset + limit], total


async def delete_job_history(job_id: str) -> bool:
    """Borra la línea de tiempo completa de un job. Retorna True si existía."""
    path = _job_events_path(job_id)
    async with _lock_for(path):
        existed = path.exists()
        if existed:
            path.unlink()

    index_path = _index_path()
    async with _lock_for(index_path):
        data = _read_json_list(index_path)
        filtered = [r for r in data if r.get("job_id") != job_id]
        if len(filtered) != len(data):
            _write_json_list(index_path, filtered)

    return existed
