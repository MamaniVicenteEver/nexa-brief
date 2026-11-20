"""Which piece of the generated copy goes to which platform.

Single source for both publish paths (pipeline Stage 9 in social_publisher.py
and the scheduler in core/schedule/engine.py), which used to duplicate it.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from src.core.job import VideoSummary


@dataclass(frozen=True)
class PlatformCopy:
    title: str
    description: str
    tags: list[str]
    language: str | None


def copy_for_platform(summary: VideoSummary | Mapping[str, Any], platform: str) -> PlatformCopy:
    """Accepts the in-memory VideoSummary or the dict read back from 08_resumen_final.json."""
    data = summary.model_dump() if isinstance(summary, VideoSummary) else dict(summary)
    language = data.get("language") or None

    copy = (data.get("platform_copies") or {}).get(platform)
    if copy:
        return PlatformCopy(copy.get("title") or "", copy.get("description") or "", list(copy.get("tags") or []), language)

    # Summaries written before platform_copies existed.
    if platform == "tiktok":
        caption = data.get("tiktok_caption") or ""
        return PlatformCopy(caption, caption, list(data.get("tiktok_hashtags") or []), language)

    # Facebook and Instagram reuse the YouTube copy when no platform copy exists.
    return PlatformCopy(
        data.get("youtube_title") or "",
        data.get("youtube_description") or "",
        list(data.get("youtube_tags") or []),
        language,
    )
