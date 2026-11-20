"""Cadencia gradual y conversión de franjas locales a UTC."""

from __future__ import annotations

import hashlib
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def daily_image_limit(
    rollout_started_at: datetime, now: datetime, *, stable: bool = True
) -> int:
    """Semanas 1–2: una imagen; semanas 3+ permiten dos si la canary sigue sana."""
    start = rollout_started_at.astimezone(timezone.utc)
    current = now.astimezone(timezone.utc)
    elapsed_days = max(0, (current.date() - start.date()).days)
    rollout_week = elapsed_days // 7 + 1
    return 2 if rollout_week >= 3 and stable else 1


def delivery_idempotency_key(
    post_id: str, revision: int, platform: str, account_alias: str,
    placement: str, occurrence_utc: str,
) -> str:
    content = "".join((post_id, str(revision), platform, account_alias, placement, occurrence_utc))
    return hashlib.sha256(content.encode()).hexdigest()


def local_occurrence_to_utc(
    occurrence_date: date, hhmm: str, timezone_name: str
) -> datetime | None:
    """Convierte una hora local; horas inexistentes por DST no generan slot."""
    try:
        zone = ZoneInfo(timezone_name)
        hour, minute = map(int, hhmm.split(":"))
        local = datetime.combine(occurrence_date, time(hour=hour, minute=minute))
        candidate = local.replace(tzinfo=zone, fold=0)
        roundtrip = candidate.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None)
        if roundtrip != local:
            return None
        return candidate.astimezone(timezone.utc)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError(f"Zona horaria u hora inválida: {timezone_name} {hhmm}") from None


def occurrence_key(slot_id: str, scheduled_at: datetime) -> str:
    return f"{slot_id}:{scheduled_at.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')}"


def stable_plan_choice(plan_ids: list[str], category_id: str, local_date: date) -> str | None:
    """Rotación reproducible para slots: el mismo día no cambia entre procesos."""
    if not plan_ids:
        return None
    digest = hashlib.sha256(f"{category_id}:{local_date.isoformat()}".encode()).digest()
    return sorted(plan_ids)[int.from_bytes(digest[:4], "big") % len(plan_ids)]
