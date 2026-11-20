"""Últimos acontecimientos: videos terminados (o fallidos) y publicaciones."""

from __future__ import annotations

from datetime import datetime, timezone

from src.core.stats.context import StatsContext
from src.core.stats.models import ActivityItem

LIMIT = 10


def collect(ctx: StatsContext) -> list[ActivityItem]:
    items: list[ActivityItem] = []
    for event in ctx.history_events:
        if event.stage.value not in ("packaged", "failed"):
            continue
        job = ctx.jobs_by_id.get(event.job_id)
        if job is None:
            continue
        items.append(ActivityItem(
            kind="video_ready" if event.stage.value == "packaged" else "video_failed",
            at=event.created_at,
            job_id=event.job_id,
            title=job.get("title") or job.get("category", ""),
        ))
    for pub in ctx.publications:
        if not pub.get("published_at"):
            continue
        items.append(ActivityItem(
            kind="published",
            at=datetime.fromtimestamp(pub["published_at"], timezone.utc).isoformat(),
            job_id=pub.get("job_id"),
            title=pub.get("title") or "",
            platform=pub.get("platform"),
            url=pub.get("url"),
        ))
    items.sort(key=lambda i: i.at, reverse=True)
    return items[:LIMIT]
