"""Slot Repository — CRUD de horarios recurrentes (colección "schedule_slots").

La persistencia la resuelve el DataStore (`src/core/data.py`); este módulo solo
arma y valida los `ScheduleSlot`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from src.core.data import collection
from src.core.schedule.models import ScheduleSlot

logger = structlog.get_logger(__name__)


def _slots():
    return collection("schedule_slots")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create(
    platform: str,
    account_alias: str,
    days: list[int],
    times: list[str],
    enabled: bool = True,
    niche_filter: str | None = None,
    content_kind: str = "video",
    category_id: str | None = None,
    timezone: str = "UTC",
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
        content_kind=content_kind,
        category_id=category_id,
        timezone=timezone,
        created_at=now,
        updated_at=now,
    )
    await _slots().insert(slot.model_dump())
    return slot


async def update(slot_id: str, **fields: Any) -> ScheduleSlot | None:
    """Update parcial de campos de un horario. Devuelve None si no existe."""
    current = _slots().get(slot_id)
    if current is None:
        return None
    # Validar con el modelo antes de persistir (mismo resultado que antes).
    slot = ScheduleSlot(**{**current, **fields, "updated_at": _now_iso()})
    await _slots().update(slot_id, slot.model_dump())
    return slot


async def delete(slot_id: str) -> bool:
    """Elimina un horario. Devuelve True si existía."""
    return await _slots().delete(slot_id) is not None


def get(slot_id: str) -> ScheduleSlot | None:
    """Lee un horario por id (lectura síncrona, igual que job_tracker.get)."""
    record = _slots().get(slot_id)
    return ScheduleSlot(**record) if record else None


def list_slots(
    platform: str | None = None,
    account_alias: str | None = None,
    enabled: bool | None = None,
) -> list[ScheduleSlot]:
    """Lista horarios, filtrando opcionalmente por plataforma/cuenta/estado."""
    slots = [ScheduleSlot(**r) for r in _slots().list()]
    if platform is not None:
        slots = [s for s in slots if s.platform == platform]
    if account_alias is not None:
        slots = [s for s in slots if s.account_alias == account_alias]
    if enabled is not None:
        slots = [s for s in slots if s.enabled == enabled]
    return slots
