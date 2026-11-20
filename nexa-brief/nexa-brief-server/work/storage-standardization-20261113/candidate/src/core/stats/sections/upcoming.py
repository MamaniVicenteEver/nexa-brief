from __future__ import annotations

from datetime import datetime

from src.core.stats.context import StatsContext
from src.core.stats.models import UpcomingPublication

LIMIT = 5


def collect(ctx: StatsContext) -> list[UpcomingPublication]:
    upcoming = []
    for entry in ctx.queue_entries:
        if entry.status.value != "queued" or not entry.scheduled_at:
            continue
        try:
            if datetime.fromisoformat(entry.scheduled_at) < ctx.now:
                continue
        except ValueError:
            continue
        job = ctx.jobs_by_id.get(entry.job_id, {})
        upcoming.append(UpcomingPublication(
            entry_id=entry.entry_id,
            job_id=entry.job_id,
            title=job.get("title") or entry.job_id,
            platform=entry.platform,
            account_alias=entry.account_alias,
            scheduled_at=entry.scheduled_at,
        ))
    upcoming.sort(key=lambda u: u.scheduled_at)
    return upcoming[:LIMIT]
