"""Published-videos log — flat JSON append-log of successful publishes.

Neither the manual `POST /publish/` endpoint nor the pipeline's auto-publish
stage (Stage 9, `social_publisher.py`) persisted "which video went to which
channel" anywhere queryable — `PublishVideoResult`/`PublishResult` were built
and then discarded. This module is the one place both call into, so the
record exists regardless of which path published the video.

Same style as `token_storage.py`: plain read-modify-write JSON, no database.
Not meant for a high write-frequency path — publishes are infrequent enough
that no locking/atomic-rename is needed here, unlike token writes.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

PUBLISHED_VIDEOS_PATH = Path("data/canales/published_videos.json")


def record_published_video(platform: str, alias: str, post_id: str, url: str, title: str) -> None:
    """Append one entry to the published-videos log."""
    PUBLISHED_VIDEOS_PATH.parent.mkdir(parents=True, exist_ok=True)

    data = []
    if PUBLISHED_VIDEOS_PATH.exists():
        try:
            data = json.loads(PUBLISHED_VIDEOS_PATH.read_text(encoding="utf-8"))
        except Exception:
            data = []

    data.append({
        "platform": platform,
        "alias": alias,
        "post_id": post_id,
        "url": url,
        "title": title,
        "published_at": time.time(),
    })

    PUBLISHED_VIDEOS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def list_published_videos(platform: str | None = None, alias: str | None = None) -> list[dict]:
    """Return logged publishes, optionally filtered by platform and/or alias."""
    if not PUBLISHED_VIDEOS_PATH.exists():
        return []
    try:
        data = json.loads(PUBLISHED_VIDEOS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    if platform is not None:
        data = [item for item in data if item.get("platform") == platform]
    if alias is not None:
        data = [item for item in data if item.get("alias") == alias]
    return data
