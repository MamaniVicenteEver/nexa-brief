"""Lo que necesita atención ahora. Cada regla es una función chica: agregar una
alerta nueva = una función más en _RULES."""

from __future__ import annotations

from collections.abc import Callable, Iterable

from src.core.stats.context import StatsContext
from src.core.stats.models import Alert

_DAY = 86_400
_TOKEN_WARNING_SECONDS = _DAY          # avisar si vence en menos de 24 h y no se renueva solo
_RECENT_SECONDS = 7 * _DAY             # fallos más viejos ya no son "alerta"
_STUCK_SECONDS = 30 * 60               # mismo criterio que video_deletion._STALE_AFTER
_TERMINAL = {"packaged", "publishing", "published", "failed"}


def _reauth(ctx: StatsContext) -> Iterable[Alert]:
    for a in ctx.accounts:
        if a.get("status") == "requires_reauth":
            yield Alert(level="error", kind="reauth", platform=a["platform"], account_alias=a["alias"])


def _token_expiring(ctx: StatsContext) -> Iterable[Alert]:
    for a in ctx.accounts:
        expires = a.get("expires_in_seconds")
        if (
            a.get("status") == "ok"
            and not a.get("has_refresh_token")
            and expires is not None
            and 0 < expires <= _TOKEN_WARNING_SECONDS
        ):
            yield Alert(level="warning", kind="token_expiring", platform=a["platform"], account_alias=a["alias"])


def _publish_failed(ctx: StatsContext) -> Iterable[Alert]:
    """Último intento por (video, cuenta) fallido y reciente. Si ese video salió
    publicado en esa cuenta en CUALQUIER intento (ej. un reintento duplicado
    falló después de que el primero funcionó), no es alerta."""
    latest: dict[tuple[str, str, str], object] = {}
    published: set[tuple[str, str, str]] = set()
    for entry in sorted(ctx.queue_entries, key=lambda e: e.created_at):
        key = (entry.job_id, entry.platform, entry.account_alias)
        latest[key] = entry
        if entry.status.value == "published":
            published.add(key)
    for (job_id, platform, alias), entry in latest.items():
        if (job_id, platform, alias) in published:
            continue
        age = ctx.seconds_ago(entry.updated_at)
        if entry.status.value == "failed" and age is not None and age <= _RECENT_SECONDS:
            job = ctx.jobs_by_id.get(job_id, {})
            yield Alert(
                level="error", kind="publish_failed", platform=platform, account_alias=alias,
                job_id=job_id, title=job.get("title"), detail=entry.error,
            )


def _job_failed(ctx: StatsContext) -> Iterable[Alert]:
    for job in ctx.jobs:
        age = ctx.seconds_ago(job.get("updated_at"))
        if job.get("stage") == "failed" and age is not None and age <= _RECENT_SECONDS:
            errors = job.get("errors") or []
            yield Alert(
                level="error", kind="job_failed", job_id=job["job_id"],
                title=job.get("title"), detail=errors[-1] if errors else None,
            )


def _job_stuck(ctx: StatsContext) -> Iterable[Alert]:
    for job in ctx.jobs:
        age = ctx.seconds_ago(job.get("updated_at"))
        if job.get("stage") not in _TERMINAL and age is not None and age > _STUCK_SECONDS:
            yield Alert(level="warning", kind="job_stuck", job_id=job["job_id"], title=job.get("title"))


_RULES: list[Callable[[StatsContext], Iterable[Alert]]] = [
    _reauth, _token_expiring, _publish_failed, _job_failed, _job_stuck,
]


def collect(ctx: StatsContext) -> list[Alert]:
    alerts = [alert for rule in _RULES for alert in rule(ctx)]
    alerts.sort(key=lambda a: a.level != "error")  # errores primero, orden estable
    return alerts
