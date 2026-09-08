"""Slot Repository — CRUD de horarios recurrentes → data/programacion/slots.json.

Mismo patrón que `src/core/job_tracker.py`: índice JSON plano con un
`asyncio.Lock` por archivo, lectura tolerante a archivo corrupto/vacío (nunca
lanza, loggea y devuelve `[]`), escritura atómica (`.tmp` → `Path.replace`).
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from src.config.settings import settings
from src.core.schedule.models import ScheduleSlot

logger = structlog.get_logger(__name__)

_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)


def _lock_for(path: Path) -> asyncio.Lock:
    return _locks[path]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slots_path() -> Path:
    return settings.programacion_dir / "slots.json"


def _read(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("slot_repository_index_corrupt", path=str(path))
        return []


def _write(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


async def create(
    platform: str,
    account_alias: str,
    days: list[int],
    times: list[str],
    enabled: bool = True,
    niche_filter: str | None = None,
) -> ScheduleSlot:
    """Crea un nuevo horario recurrente."""
    now = _now_iso()
    slot = ScheduleSlot(
        slot_id=uuid.uuid4().hex[:8],
        platform=platform,
        account_alias=account_alias,
        days=days,
        times=times,
        enabled=enabled,
        niche_filter=niche_filter,
        created_at=now,
        updated_at=now,
    )
    path = _slots_path()
    async with _lock_for(path):
        data = _read(path)
        data.append(slot.model_dump())
        _write(path, data)
    return slot


async def update(slot_id: str, **fields: Any) -> ScheduleSlot | None:
    """Update parcial de campos de un horario. Devuelve None si no existe."""
    path = _slots_path()
    async with _lock_for(path):
        data = _read(path)
        index = next((i for i, r in enumerate(data) if r.get("slot_id") == slot_id), None)
        if index is None:
            return None
        record = {**data[index], **fields, "updated_at": _now_iso()}
        slot = ScheduleSlot(**record)
        data[index] = slot.model_dump()
        _write(path, data)
    return slot


async def delete(slot_id: str) -> bool:
    """Elimina un horario. Devuelve True si existía."""
    path = _slots_path()
    async with _lock_for(path):
        data = _read(path)
        new_data = [r for r in data if r.get("slot_id") != slot_id]
        if len(new_data) == len(data):
            return False
        _write(path, new_data)
    return True


def get(slot_id: str) -> ScheduleSlot | None:
    """Lee un horario por id (lectura síncrona, igual que job_tracker.get)."""
    for record in _read(_slots_path()):
        if record.get("slot_id") == slot_id:
            return ScheduleSlot(**record)
    return None


def list_slots(
    platform: str | None = None,
    account_alias: str | None = None,
    enabled: bool | None = None,
) -> list[ScheduleSlot]:
    """Lista horarios, filtrando opcionalmente por plataforma/cuenta/estado."""
    slots = [ScheduleSlot(**r) for r in _read(_slots_path())]
    if platform is not None:
        slots = [s for s in slots if s.platform == platform]
    if account_alias is not None:
        slots = [s for s in slots if s.account_alias == account_alias]
    if enabled is not None:
        slots = [s for s in slots if s.enabled == enabled]
    return slots
