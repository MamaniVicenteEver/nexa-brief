"""Queue Repository — CRUD de la cola de publicación (colección "queue_entries").

La persistencia la resuelve el DataStore (`src/core/data.py`); este módulo solo
aplica las reglas de la cola (transiciones de status, dedup por ocurrencia de
slot, recuperación ante crash) y avisa por WebSocket de cada cambio.

Esta es la única fuente de verdad de "¿se publicó este job, a qué cuenta,
cuándo, con qué resultado?" — `job_tracker` nunca se toca desde acá (solo se
lee, ver `engine.py`).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from src.core.data import collection
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.core.schedule import slot_repository
from src.core.schedule.models import QueueEntry, QueueSource, QueueStatus

logger = structlog.get_logger(__name__)


def _entries():
    return collection("queue_entries")


def _dump(entry: QueueEntry) -> dict[str, Any]:
    return entry.model_dump(mode="json")


async def _publish_event(entry: QueueEntry) -> None:
    """Empuja el estado actualizado de una entry por WebSocket — reemplaza el
    polling de 15s que tenía `useQueueEntries` en el frontend (ver
    features/schedule/hooks/useQueueEntries.ts)."""
    await get_event_bus().publish(
        RealtimeEvent(type="queue_entry_changed", data=json.loads(entry.model_dump_json()))
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Create ───────────────────────────────────────────────────────────────────

async def create(
    job_id: str,
    platform: str,
    account_alias: str,
    scheduled_at: str | None = None,
    source: QueueSource = QueueSource.MANUAL,
    slot_id: str | None = None,
    format: str | None = None,
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
        format=format,
        source=source,
        status=QueueStatus.QUEUED,
        created_at=now,
        updated_at=now,
    )
    await _entries().insert(_dump(entry))
    await _publish_event(entry)
    return entry


async def start_direct(
    job_id: str, platform: str, account_alias: str, *, format: str | None = None
) -> QueueEntry:
    """Record an explainer upload already handled by its recorder.

    It starts in PUBLISHING, so the scheduler cannot pick it up and duplicate
    the upload; the recorder marks the final result on the same entry.
    """
    now = _now_iso()
    entry = QueueEntry(
        entry_id=uuid.uuid4().hex[:8], job_id=job_id, platform=platform,
        account_alias=account_alias, format=format, source=QueueSource.IMMEDIATE,
        status=QueueStatus.PUBLISHING, created_at=now, updated_at=now,
    )
    await _entries().insert(_dump(entry))
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

    now = _now_iso()
    existing = _entries().first({"slot_id": slot_id, "scheduled_at": scheduled_at})
    if existing is not None:
        updated = await _entries().update(
            existing["entry_id"],
            {"job_id": job_id, "source": source.value, "updated_at": now},
            only_if={"status": QueueStatus.QUEUED.value},
        )
        if updated is None:
            raise ValueError(
                f"Cannot reassign occurrence slot_id={slot_id} scheduled_at={scheduled_at}: "
                f"entry '{existing.get('entry_id')}' already has status={existing.get('status')}."
            )
        entry = QueueEntry(**updated)
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
        await _entries().insert(_dump(entry))
    await _publish_event(entry)
    return entry


# ── Status transitions ──────────────────────────────────────────────────────

async def _update_status(entry_id: str, status: QueueStatus, **extra: Any) -> QueueEntry | None:
    record = await _entries().update(
        entry_id, {**extra, "status": status.value, "updated_at": _now_iso()}
    )
    if record is None:
        return None
    entry = QueueEntry(**record)
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
    current = _entries().get(entry_id)
    if current is None:
        raise LookupError(f"QueueEntry '{entry_id}' not found.")
    now = _now_iso()
    record = await _entries().update(
        entry_id,
        {"status": QueueStatus.CANCELLED.value, "updated_at": now, "processed_at": now},
        only_if={"status": QueueStatus.QUEUED.value},
    )
    if record is None:
        raise ValueError(
            f"QueueEntry '{entry_id}' cannot be cancelled (status={current.get('status')})."
        )
    entry = QueueEntry(**record)
    await _publish_event(entry)
    return entry


async def mark_removed_by_post(platform: str, account_alias: str, post_id: str) -> int:
    """Marca `removed` las entries publicadas de ese post (se borró de la plataforma)."""
    changed = await _entries().update_where(
        {
            "platform": platform,
            "account_alias": account_alias,
            "post_id": post_id,
            "status": QueueStatus.PUBLISHED.value,
        },
        {"status": QueueStatus.REMOVED.value, "updated_at": _now_iso()},
    )
    for record in changed:
        await _publish_event(QueueEntry(**record))
    return len(changed)


async def delete_for_job(job_id: str) -> int:
    """Borra todas las entries de un job (al eliminar el video de Biblioteca)."""
    removed = await _entries().delete_where({"job_id": job_id})
    for record in removed:
        await _publish_event(QueueEntry(**record))
    return len(removed)


async def recover_stale_publishing(older_than_seconds: int = 600) -> int:
    """Recuperación ante crash: entries atascadas en `publishing` (el proceso
    murió a mitad de un upload) se marcan `failed` para no bloquear la cola
    para siempre. Devuelve cuántas entries se recuperaron."""
    now_dt = datetime.now(timezone.utc)
    recovered = 0
    for record in _entries().list({"status": QueueStatus.PUBLISHING.value}):
        updated_at = record.get("updated_at")
        try:
            updated_dt = datetime.fromisoformat(updated_at) if updated_at else None
        except ValueError:
            updated_dt = None
        if updated_dt is not None and (now_dt - updated_dt).total_seconds() < older_than_seconds:
            continue
        now_iso = now_dt.isoformat()
        entry = await _update_status(
            record["entry_id"],
            QueueStatus.FAILED,
            error="Recovered from crash: stuck in 'publishing' state.",
            processed_at=now_iso,
        )
        recovered += entry is not None
    return recovered


# ── Reads ────────────────────────────────────────────────────────────────────

def get(entry_id: str) -> QueueEntry | None:
    record = _entries().get(entry_id)
    return QueueEntry(**record) if record else None


def list_entries(
    status: str | None = None,
    platform: str | None = None,
    account_alias: str | None = None,
    job_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[QueueEntry], int]:
    """Lista entries de cola, más recientes primero. Devuelve (página, total)."""
    filters = {"status": status, "platform": platform, "account_alias": account_alias, "job_id": job_id}
    where = {k: v for k, v in filters.items() if v is not None}
    entries = [QueueEntry(**r) for r in _entries().list(where)]
    entries.sort(key=lambda e: e.created_at, reverse=True)
    total = len(entries)
    return entries[offset : offset + limit], total


def find_pending_for_slot_occurrence(slot_id: str, scheduled_at: str) -> QueueEntry | None:
    """Devuelve la entry (de cualquier status) ya decidida para esta ocurrencia
    concreta de un slot, o None si la ocurrencia todavía no tiene ninguna
    entry asociada."""
    record = _entries().first({"slot_id": slot_id, "scheduled_at": scheduled_at})
    return QueueEntry(**record) if record else None


def find_due(now_iso: str) -> list[QueueEntry]:
    """Entries `queued` con `scheduled_at` ya vencido (<= now), listas para publicar."""
    now_dt = datetime.fromisoformat(now_iso)
    due: list[QueueEntry] = []
    for record in _entries().list({"status": QueueStatus.QUEUED.value}):
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
    where = {"job_id": job_id, "platform": platform, "account_alias": account_alias}
    return _entries().first(where) is not None
