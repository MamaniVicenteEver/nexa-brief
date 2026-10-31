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
import hashlib
import fcntl
import uuid
import asyncio
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any
from pathlib import Path

import structlog

from src.adapters.data.layout import COLLECTIONS
from src.config.settings import settings
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


# Entries que ESTE proceso está publicando ahora mismo. Una subida a YouTube puede esperar varios
# minutos a que la plataforma procese la HD (youtube_adapter.publish), así que el tiempo en
# `publishing` no prueba que el proceso murió: solo se recuperan las que nadie está atendiendo.
# Tras un reinicio el set arranca vacío y la recuperación por crash sigue funcionando igual.
_in_flight: set[str] = set()
_immediate_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _queue_claim_lock():
    """Serializa alta/reclamo de imágenes entre workers con JSON compartido."""
    relative_path, _ = COLLECTIONS["queue_entries"]
    lock_path = settings.data_dir / Path(relative_path).parent / ".queue-claim.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


# ── Create ───────────────────────────────────────────────────────────────────

async def create_immediate_once(
    job_id: str, platform: str, account_alias: str, format: str | None, key: str,
) -> tuple[QueueEntry, bool]:
    """Persist the client attempt before scheduling any remote operation."""
    async with _immediate_lock:
        with _queue_claim_lock():
            existing = _entries().first({"idempotency_key": key})
            if existing:
                entry = QueueEntry(**existing)
                if (entry.job_id, entry.platform, entry.account_alias, entry.format) != (
                    job_id, platform, account_alias, format,
                ):
                    raise ValueError("La clave ya corresponde a otra publicación.")
                return entry, False
            now = _now_iso()
            entry = QueueEntry(
                entry_id=uuid.uuid4().hex, job_id=job_id, platform=platform,
                account_alias=account_alias, format=format, source=QueueSource.IMMEDIATE,
                status=QueueStatus.QUEUED, created_at=now, updated_at=now,
                idempotency_key=key,
            )
            await _entries().insert(_dump(entry))
    await _publish_event(entry)
    return entry, True


async def create(
    job_id: str | None,
    platform: str,
    account_alias: str,
    scheduled_at: str | None = None,
    source: QueueSource = QueueSource.MANUAL,
    slot_id: str | None = None,
    format: str | None = None,
    content_kind: str = "video",
    content_id: str | None = None,
    delivery_id: str | None = None,
) -> QueueEntry:
    """Crea una entry de cola nueva (ad-hoc, inmediata, o auto-fill de un slot).

    Para ocurrencias de un `ScheduleSlot` que necesitan dedup por
    (slot_id, scheduled_at) usar `upsert_for_slot_occurrence` en su lugar
    (usada por el endpoint de asignación manual)."""
    if content_kind == "video" and not job_id:
        raise ValueError("Las entradas de video requieren job_id")
    if content_kind != "video" and (not content_id or not delivery_id):
        raise ValueError("Las entradas de imagen requieren content_id y delivery_id")
    now = _now_iso()
    entry_id = hashlib.sha256(delivery_id.encode()).hexdigest()[:16] if delivery_id else uuid.uuid4().hex[:8]
    entry = QueueEntry(
        entry_id=entry_id,
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
        content_kind=content_kind,
        content_id=content_id,
        delivery_id=delivery_id,
    )
    if delivery_id:
        with _queue_claim_lock():
            existing = _entries().first({"delivery_id": delivery_id})
            if existing:
                return QueueEntry(**existing)
            stored = await _entries().upsert(_dump(entry), match=["delivery_id"])
            entry = QueueEntry(**stored)
    else:
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
    _in_flight.add(entry.entry_id)
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

async def _update_status(
    entry_id: str, status: QueueStatus, *, only_if: dict[str, Any] | None = None, **extra: Any
) -> QueueEntry | None:
    record = await _entries().update(
        entry_id, {**extra, "status": status.value, "updated_at": _now_iso()}, only_if=only_if
    )
    if record is None:
        return None
    entry = QueueEntry(**record)
    await _publish_event(entry)
    return entry


async def mark_publishing(entry_id: str) -> QueueEntry | None:
    with _queue_claim_lock():
        entry = await _update_status(
            entry_id, QueueStatus.PUBLISHING,
            only_if={"status": QueueStatus.QUEUED.value},
            lease_until=(datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z"),
        )
    if entry:
        _in_flight.add(entry_id)
    return entry


async def mark_published(entry_id: str, post_id: str, url: str) -> QueueEntry | None:
    _in_flight.discard(entry_id)
    return await _update_status(
        entry_id, QueueStatus.PUBLISHED, post_id=post_id, url=url, processed_at=_now_iso(), lease_until=None
    )


async def mark_failed(entry_id: str, error: str) -> QueueEntry | None:
    _in_flight.discard(entry_id)
    return await _update_status(
        entry_id, QueueStatus.FAILED, error=error, processed_at=_now_iso(), lease_until=None
    )


async def mark_outcome_unknown(entry_id: str, error: str) -> QueueEntry | None:
    _in_flight.discard(entry_id)
    return await _update_status(
        entry_id, QueueStatus.OUTCOME_UNKNOWN, error=error, processed_at=_now_iso(), lease_until=None
    )


async def heartbeat(entry_id: str, *, lease_until: datetime | None = None) -> QueueEntry | None:
    """Renueva una publicación activa de forma visible para los demás workers."""
    renewed = lease_until or datetime.now(timezone.utc) + timedelta(minutes=2)
    return await _update_status(
        entry_id,
        QueueStatus.PUBLISHING,
        only_if={"status": QueueStatus.PUBLISHING.value},
        lease_until=renewed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    )


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


async def reschedule(entry_id: str, scheduled_at: str | None) -> QueueEntry | None:
    """Cambia la hora de una entrada pendiente, incluida la publicación inmediata."""
    with _queue_claim_lock():
        record = await _entries().update(
            entry_id,
            {"scheduled_at": scheduled_at, "updated_at": _now_iso()},
            only_if={"status": QueueStatus.QUEUED.value},
        )
    if record is None:
        return None
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


async def delete_for_delivery(delivery_id: str) -> int:
    """Purga la referencia local de cola tras asegurar que no está publicando."""
    with _queue_claim_lock():
        entry = find_for_delivery(delivery_id)
        if entry is None:
            return 0
        if entry.status == QueueStatus.PUBLISHING:
            raise ValueError("No se puede purgar una entrega mientras un worker la publica")
        removed = await _entries().delete_where({"delivery_id": delivery_id})
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
        if record["entry_id"] in _in_flight:
            continue  # sigue subiéndose (p. ej. esperando la HD de YouTube): no está atascada
        expected_lease = record.get("lease_until")
        try:
            lease_dt = datetime.fromisoformat(expected_lease.replace("Z", "+00:00")) if expected_lease else None
        except ValueError:
            lease_dt = None
        if lease_dt is not None and lease_dt > now_dt:
            continue
        updated_at = record.get("updated_at")
        try:
            updated_dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00")) if updated_at else None
        except ValueError:
            updated_dt = None
        if updated_dt is not None and (now_dt - updated_dt).total_seconds() < older_than_seconds:
            continue
        now_iso = now_dt.isoformat()
        status = QueueStatus.OUTCOME_UNKNOWN if record.get("content_kind", "video") != "video" else QueueStatus.FAILED
        error = (
            "Image delivery requires remote reconciliation after worker interruption."
            if status == QueueStatus.OUTCOME_UNKNOWN
            else "Recovered from crash: stuck in 'publishing' state."
        )
        entry = await _update_status(
            record["entry_id"],
            status,
            only_if={"status": QueueStatus.PUBLISHING.value, "lease_until": expected_lease},
            error=error,
            processed_at=now_iso,
            lease_until=None,
        )
        recovered += entry is not None
    return recovered


# ── Reads ────────────────────────────────────────────────────────────────────

def get(entry_id: str) -> QueueEntry | None:
    record = _entries().get(entry_id)
    return QueueEntry(**record) if record else None


def find_for_delivery(delivery_id: str) -> QueueEntry | None:
    record = _entries().first({"delivery_id": delivery_id})
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
    now_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    due: list[QueueEntry] = []
    for record in _entries().list({"status": QueueStatus.QUEUED.value}):
        scheduled_at = record.get("scheduled_at")
        if not scheduled_at:
            continue
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
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
