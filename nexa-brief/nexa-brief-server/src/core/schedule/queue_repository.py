"""Queue Repository — CRUD de la cola de publicación → data/programacion/queue.json.

Mismo patrón que `src/core/job_tracker.py`: índice JSON plano con un
`asyncio.Lock` por archivo, lectura tolerante a archivo corrupto/vacío (nunca
lanza, loggea y devuelve `[]`), escritura atómica (`.tmp` → `Path.replace`).

Esta es la única fuente de verdad de "¿se publicó este job, a qué cuenta,
cuándo, con qué resultado?" — `job_tracker` nunca se toca desde acá (solo se
lee, ver `engine.py`).
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
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.core.schedule import slot_repository
from src.core.schedule.models import QueueEntry, QueueSource, QueueStatus

logger = structlog.get_logger(__name__)

_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)


def _lock_for(path: Path) -> asyncio.Lock:
    return _locks[path]


async def _publish_event(entry: QueueEntry) -> None:
    """Empuja el estado actualizado de una entry por WebSocket — reemplaza el
    polling de 15s que tenía `useQueueEntries` en el frontend (ver
    features/schedule/hooks/useQueueEntries.ts)."""
    await get_event_bus().publish(
        RealtimeEvent(type="queue_entry_changed", data=json.loads(entry.model_dump_json()))
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _queue_path() -> Path:
    return settings.programacion_dir / "queue.json"


def _read(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("queue_repository_index_corrupt", path=str(path))
        return []


def _write(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


# ── Create ───────────────────────────────────────────────────────────────────

async def create(
    job_id: str,
    platform: str,
    account_alias: str,
    scheduled_at: str | None = None,
    source: QueueSource = QueueSource.MANUAL,
    slot_id: str | None = None,
) -> QueueEntry:
    """Crea una entry de cola nueva (ad-hoc, inmediata, o auto-fill de un slot).

    Para ocurrencias de un `ScheduleSlot` que necesitan dedup por
    (slot_id, scheduled_at) usar `upsert_for_slot_occurrence` en su lugar
    (usada por el endpoint de asignación manual)."""
    now = _now_iso()
    entry = QueueEntry(
        entry_id=uuid.uuid4().hex[:8],
        job_id=job_id,
        platform=platform,
        account_alias=account_alias,
        slot_id=slot_id,
        scheduled_at=scheduled_at,
        source=source,
        status=QueueStatus.QUEUED,
        created_at=now,
        updated_at=now,
    )
    path = _queue_path()
    async with _lock_for(path):
        data = _read(path)
        data.append(entry.model_dump())
        _write(path, data)
    await _publish_event(entry)
    return entry


async def upsert_for_slot_occurrence(
    slot_id: str,
    scheduled_at: str,
    job_id: str,
    source: QueueSource,
) -> QueueEntry:
    """Asigna (a mano o automáticamente) un job a una ocurrencia concreta de un slot.

    Dedup por `(slot_id, scheduled_at)`: si ya hay una entry `queued` para esa
    ocurrencia, reemplaza su `job_id`; si ya está en `publishing`/`published`/
    `failed`, lanza `ValueError` (esa ocurrencia ya fue procesada, no se puede
    reasignar).
    """
    slot = slot_repository.get(slot_id)
    if slot is None:
        raise ValueError(f"ScheduleSlot '{slot_id}' not found.")

    path = _queue_path()
    async with _lock_for(path):
        data = _read(path)
        index = next(
            (
                i for i, r in enumerate(data)
                if r.get("slot_id") == slot_id and r.get("scheduled_at") == scheduled_at
            ),
            None,
        )
        now = _now_iso()
        if index is not None:
            existing = data[index]
            if existing.get("status") != QueueStatus.QUEUED.value:
                raise ValueError(
                    f"Cannot reassign occurrence slot_id={slot_id} scheduled_at={scheduled_at}: "
                    f"entry '{existing.get('entry_id')}' already has status={existing.get('status')}."
                )
            existing = {**existing, "job_id": job_id, "source": source.value, "updated_at": now}
            entry = QueueEntry(**existing)
            data[index] = entry.model_dump()
        else:
            entry = QueueEntry(
                entry_id=uuid.uuid4().hex[:8],
                job_id=job_id,
                platform=slot.platform,
                account_alias=slot.account_alias,
                slot_id=slot_id,
                scheduled_at=scheduled_at,
                source=source,
                status=QueueStatus.QUEUED,
                created_at=now,
                updated_at=now,
            )
            data.append(entry.model_dump())
        _write(path, data)
    await _publish_event(entry)
    return entry


# ── Status transitions ──────────────────────────────────────────────────────

async def _update_status(entry_id: str, status: QueueStatus, **extra: Any) -> QueueEntry | None:
    path = _queue_path()
    async with _lock_for(path):
        data = _read(path)
        index = next((i for i, r in enumerate(data) if r.get("entry_id") == entry_id), None)
        if index is None:
            return None
        record = {**data[index], **extra, "status": status.value, "updated_at": _now_iso()}
        entry = QueueEntry(**record)
        data[index] = entry.model_dump()
        _write(path, data)
    await _publish_event(entry)
    return entry


async def mark_publishing(entry_id: str) -> QueueEntry | None:
    return await _update_status(entry_id, QueueStatus.PUBLISHING)


async def mark_published(entry_id: str, post_id: str, url: str) -> QueueEntry | None:
    return await _update_status(
        entry_id, QueueStatus.PUBLISHED, post_id=post_id, url=url, processed_at=_now_iso()
    )


async def mark_failed(entry_id: str, error: str) -> QueueEntry | None:
    return await _update_status(entry_id, QueueStatus.FAILED, error=error, processed_at=_now_iso())


async def cancel(entry_id: str) -> QueueEntry:
    """Cancela una entry en cola. Solo permitido si `status == queued`.

    Raises:
        LookupError: no existe una entry con ese id (el router mapea → 404).
        ValueError: la entry existe pero no está en status 'queued' (→ 409).
    """
    path = _queue_path()
    async with _lock_for(path):
        data = _read(path)
        index = next((i for i, r in enumerate(data) if r.get("entry_id") == entry_id), None)
        if index is None:
            raise LookupError(f"QueueEntry '{entry_id}' not found.")
        record = data[index]
        if record.get("status") != QueueStatus.QUEUED.value:
            raise ValueError(
                f"QueueEntry '{entry_id}' cannot be cancelled (status={record.get('status')})."
            )
        now = _now_iso()
        record = {**record, "status": QueueStatus.CANCELLED.value, "updated_at": now, "processed_at": now}
        entry = QueueEntry(**record)
        data[index] = entry.model_dump()
        _write(path, data)
    await _publish_event(entry)
    return entry


async def recover_stale_publishing(older_than_seconds: int = 600) -> int:
    """Recuperación ante crash: entries atascadas en `publishing` (el proceso
    murió a mitad de un upload) se marcan `failed` para no bloquear la cola
    para siempre. Devuelve cuántas entries se recuperaron."""
    path = _queue_path()
    recovered_entries: list[QueueEntry] = []
    async with _lock_for(path):
        data = _read(path)
        now_dt = datetime.now(timezone.utc)
        for record in data:
            if record.get("status") != QueueStatus.PUBLISHING.value:
                continue
            updated_at = record.get("updated_at")
            try:
                updated_dt = datetime.fromisoformat(updated_at) if updated_at else None
            except ValueError:
                updated_dt = None
            stale = updated_dt is None or (now_dt - updated_dt).total_seconds() >= older_than_seconds
            if not stale:
                continue
            now_iso = now_dt.isoformat()
            record["status"] = QueueStatus.FAILED.value
            record["error"] = "Recovered from crash: stuck in 'publishing' state."
            record["updated_at"] = now_iso
            record["processed_at"] = now_iso
            recovered_entries.append(QueueEntry(**record))
        if recovered_entries:
            _write(path, data)
    for entry in recovered_entries:
        await _publish_event(entry)
    return len(recovered_entries)


# ── Reads ────────────────────────────────────────────────────────────────────

def get(entry_id: str) -> QueueEntry | None:
    for record in _read(_queue_path()):
        if record.get("entry_id") == entry_id:
            return QueueEntry(**record)
    return None


def list_entries(
    status: str | None = None,
    platform: str | None = None,
    account_alias: str | None = None,
    job_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[QueueEntry], int]:
    """Lista entries de cola, más recientes primero. Devuelve (página, total)."""
    entries = [QueueEntry(**r) for r in _read(_queue_path())]
    if status is not None:
        entries = [e for e in entries if e.status.value == status]
    if platform is not None:
        entries = [e for e in entries if e.platform == platform]
    if account_alias is not None:
        entries = [e for e in entries if e.account_alias == account_alias]
    if job_id is not None:
        entries = [e for e in entries if e.job_id == job_id]
    entries.sort(key=lambda e: e.created_at, reverse=True)
    total = len(entries)
    return entries[offset : offset + limit], total


def find_pending_for_slot_occurrence(slot_id: str, scheduled_at: str) -> QueueEntry | None:
    """Devuelve la entry (de cualquier status) ya decidida para esta ocurrencia
    concreta de un slot, o None si la ocurrencia todavía no tiene ninguna
    entry asociada."""
    for record in _read(_queue_path()):
        if record.get("slot_id") == slot_id and record.get("scheduled_at") == scheduled_at:
            return QueueEntry(**record)
    return None


def find_due(now_iso: str) -> list[QueueEntry]:
    """Entries `queued` con `scheduled_at` ya vencido (<= now), listas para publicar."""
    now_dt = datetime.fromisoformat(now_iso)
    due: list[QueueEntry] = []
    for record in _read(_queue_path()):
        if record.get("status") != QueueStatus.QUEUED.value:
            continue
        scheduled_at = record.get("scheduled_at")
        if not scheduled_at:
            continue
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_at)
        except ValueError:
            continue
        if scheduled_dt <= now_dt:
            due.append(QueueEntry(**record))
    return due


def has_any_entry_for_target(job_id: str, platform: str, account_alias: str) -> bool:
    """True si ya existe CUALQUIER entry (en cualquier status) para este job en
    esta plataforma+cuenta — evita que el auto-fill reintente infinitamente un
    job que ya falló para esa cuenta; un fallo requiere re-encolar a mano."""
    for record in _read(_queue_path()):
        if (
            record.get("job_id") == job_id
            and record.get("platform") == platform
            and record.get("account_alias") == account_alias
        ):
            return True
    return False
