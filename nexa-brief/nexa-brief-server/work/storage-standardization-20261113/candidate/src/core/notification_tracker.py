"""Notification Tracker — persistencia CRUD de notificaciones del dashboard.

Persiste en la colección "notifications" del DataStore (`src/core/data.py`).

Esta es la única forma en que el resto del código toca las notificaciones —
mantener esta interfaz angosta es lo que permite reemplazar el backend de
almacenamiento por una base de datos real más adelante sin tocar routers,
el pipeline, o el scheduler de tokens.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import structlog

from src.core.data import collection
from src.core.notification import Notification
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)


def _notifications():
    return collection("notifications")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create(notification: Notification) -> Notification:
    await _notifications().insert(json.loads(notification.model_dump_json()))
    logger.info(
        "notification_created",
        notification_id=notification.notification_id,
        type=notification.type,
        job_id=notification.job_id,
        account_alias=notification.account_alias,
    )
    await get_event_bus().publish(
        RealtimeEvent(type="notification_created", data=json.loads(notification.model_dump_json()))
    )
    return notification


def list_notifications(
    *,
    unread_only: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Notification], int, int]:
    """Retorna (página, total, unread_count), más recientes primero."""
    records = _notifications().list()
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)

    unread_count = sum(1 for r in records if not r.get("read_at"))
    if unread_only:
        records = [r for r in records if not r.get("read_at")]

    total = len(records)
    page = [Notification(**r) for r in records[offset : offset + limit]]
    return page, total, unread_count


async def mark_read(notification_id: str) -> Notification | None:
    record = _notifications().get(notification_id)
    if record is None:
        return None
    if not record.get("read_at"):
        record = await _notifications().update(notification_id, {"read_at": _now_iso()}) or record
    return Notification(**record)


async def mark_all_read() -> int:
    """Marca todas las notificaciones no leídas como leídas. Retorna cuántas cambió."""
    return len(await _notifications().update_where({"read_at": None}, {"read_at": _now_iso()}))


async def delete(notification_id: str) -> bool:
    return await _notifications().delete(notification_id) is not None


async def delete_for_job(job_id: str) -> int:
    return len(await _notifications().delete_where({"job_id": job_id}))


def exists_unresolved(type: str, account_alias: str) -> bool:
    """True si ya existe una notificación sin leer de este tipo para esta cuenta.

    Usado por el scheduler de refresco de tokens para no crear una notificación
    nueva de "token_expired" en cada tick de 15 min mientras el token siga sin
    renovarse — solo se vuelve a notificar después de que el usuario la marque
    como leída (o de que el token se recupere y luego vuelva a vencer).
    """
    records = _notifications().list({"type": type, "account_alias": account_alias})
    return any(
        r.get("type") == type and r.get("account_alias") == account_alias and not r.get("read_at")
        for r in records
    )
