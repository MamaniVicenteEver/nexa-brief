"""La publicación más reciente, para "Ver una publicación real" en la landing."""

from __future__ import annotations

from pathlib import Path

from src.core.stats.context import StatsContext
from src.core.stats.models import ShowcasePublication

# YouTube primero: su enlace siempre es público; TikTok sin auditar publica en privado.
_PLATFORM_PREFERENCE = {"youtube": 0, "facebook": 1, "tiktok": 2}


def _playable_file(ctx: StatsContext, job_id: str | None) -> str | None:
    job = ctx.jobs_by_id.get(job_id or "")
    path = (job or {}).get("file_paths", {}).get("youtube")
    if path and Path(path).exists():
        return f"/api/v1/videos/jobs/{job_id}/file/youtube"
    return None


def collect(ctx: StatsContext) -> ShowcasePublication | None:
    if not ctx.publications:
        return None
    pub = max(
        ctx.publications,
        key=lambda p: (-_PLATFORM_PREFERENCE.get(p.get("platform"), 9), p.get("published_at") or 0),
    )
    return ShowcasePublication(
        title=pub.get("title") or "",
        platform=pub["platform"],
        url=pub.get("url"),
        published_at=pub.get("published_at"),
        video_url=_playable_file(ctx, pub.get("job_id")),
    )
