from __future__ import annotations

from src.core.stats.context import StatsContext
from src.core.stats.models import VideoStats

_RENDERED = {"packaged", "publishing", "published"}


def collect(ctx: StatsContext) -> VideoStats:
    stats = VideoStats(total=len(ctx.jobs))
    for job in ctx.jobs:
        stage = job.get("stage")
        if stage == "failed":
            stats.failed += 1
        elif stage not in _RENDERED:
            stats.processing += 1
        elif job["job_id"] in ctx.published_job_ids:
            stats.published += 1
        else:
            stats.ready += 1
        if stage in _RENDERED:
            stats.video_seconds += float(job.get("duration_seconds") or 0)
    stats.video_seconds = round(stats.video_seconds, 1)
    return stats
