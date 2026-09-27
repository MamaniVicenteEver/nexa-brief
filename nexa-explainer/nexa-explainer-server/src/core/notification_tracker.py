"""Notification Tracker — persistencia CRUD de notificaciones del dashboard.

Mismo patrón que `job_tracker.py`: índice JSON plano en
`data/notificaciones/_index.json`, con un `asyncio.Lock` por archivo para
serializar el read-modify-write y escritura atómica (`tmp.replace(path)`).

Esta es la única forma en que el resto del código toca este archivo —
mantener esta interfaz angosta es lo que permite reemplazar el backend de
almacenamiento por una base de datos real más adelante sin tocar routers,
el pipeline, o el scheduler de tokens.
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
from src.core.notification import Notification
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)

_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)


def _lock_for(path: Path) -> asyncio.Lock:
    return _locks[path]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _index_path() -> Path:
    return settings.notificaciones_dir / "_index.json"


def _read_index(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("notification_tracker_index_corrupt", path=str(path))
        return []


def _write_index(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create(notification: Notification) -> Notification:
    path = _index_path()
    async with _lock_for(path):
        data = _read_index(path)
        data.append(json.loads(notification.model_dump_json()))
        _write_index(path, data)
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
    records = _read_index(_index_path())
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)

    unread_count = sum(1 for r in records if not r.get("read_at"))
    if unread_only:
        records = [r for r in records if not r.get("read_at")]

    total = len(records)
    page = [Notification(**r) for r in records[offset : offset + limit]]
    return page, total, unread_count


async def mark_read(notification_id: str) -> Notification | None:
    path = _index_path()
    async with _lock_for(path):
        data = _read_index(path)
        index = next((i for i, r in enumerate(data) if r.get("notification_id") == notification_id), None)
        if index is None:
            return None
        if not data[index].get("read_at"):
            data[index]["read_at"] = _now_iso()
            _write_index(path, data)
        return Notification(**data[index])


async def mark_all_read() -> int:
    """Marca todas las notificaciones no leídas como leídas. Retorna cuántas cambió."""
    path = _index_path()
    async with _lock_for(path):
        data = _read_index(path)
        now = _now_iso()
        changed = 0
        for record in data:
            if not record.get("read_at"):
                record["read_at"] = now
                changed += 1
        if changed:
            _write_index(path, data)
        return changed


async def delete(notification_id: str) -> bool:
    path = _index_path()
    async with _lock_for(path):
        data = _read_index(path)
        filtered = [r for r in data if r.get("notification_id") != notification_id]
        if len(filtered) == len(data):
            return False
        _write_index(path, filtered)
        return True


def exists_unresolved(type: str, account_alias: str) -> bool:
    """True si ya existe una notificación sin leer de este tipo para esta cuenta.

    Usado por el scheduler de refresco de tokens para no crear una notificación
    nueva de "token_expired" en cada tick de 15 min mientras el token siga sin
    renovarse — solo se vuelve a notificar después de que el usuario la marque
    como leída (o de que el token se recupere y luego vuelva a vencer).
    """
    records = _read_index(_index_path())
    return any(
        r.get("type") == type and r.get("account_alias") == account_alias and not r.get("read_at")
        for r in records
    )
