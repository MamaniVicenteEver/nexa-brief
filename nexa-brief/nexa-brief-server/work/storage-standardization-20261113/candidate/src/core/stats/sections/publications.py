from __future__ import annotations

from src.core.stats.context import StatsContext
from src.core.stats.models import PlatformPublications, PublicationStats

_PLATFORMS = ("youtube", "facebook", "tiktok", "instagram")
_DAY = 86_400


def collect(ctx: StatsContext) -> PublicationStats:
    by_platform = {p: PlatformPublications(platform=p) for p in _PLATFORMS}
    stats = PublicationStats(total=len(ctx.publications))
    for pub in ctx.publications:
        age = ctx.seconds_ago(pub.get("published_at"))
        recent_30 = age is not None and age <= 30 * _DAY
        stats.last_30_days += recent_30
        platform = by_platform.get(pub.get("platform"))
        if platform is None:
            continue
        platform.total += 1
        platform.last_7_days += age is not None and age <= 7 * _DAY
    stats.by_platform = list(by_platform.values())
    return stats
