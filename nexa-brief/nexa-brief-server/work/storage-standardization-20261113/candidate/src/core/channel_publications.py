"""Published Page content, keyed by platform identity rather than mutable account aliases."""

from __future__ import annotations

import time
from src.core.data import collection
from src.core.publish_log import list_published_videos


def cached_publications(target_id: str, alias: str) -> list[dict]:
    return [
        {**row, "alias": alias}
        for row in collection("channel_publications").list({"platform": "facebook", "target_id": target_id})
        if row.get("visible", True)
    ]


async def sync_publications(alias: str, target_id: str, fetch) -> list[dict]:
    remote = await fetch(alias)  # Complete all remote pages before changing the cache.
    known = {r["post_id"]: r for r in cached_publications(target_id, alias)}
    nexa_ids = {
        str(r["post_id"]) for r in list_published_videos("facebook", alias) if r.get("origin", "nexa") == "nexa"
    }
    now = time.time()
    for post in remote:
        key = str(post["post_id"])
        existing = known.get(key, {})
        row = {
            **post,
            "platform": "facebook",
            "target_id": target_id,
            "alias": alias,
            "origin": "nexa" if key in nexa_ids or existing.get("origin") == "nexa" else "imported",
            "synced_at": now,
            "visible": True,
        }
        await collection("channel_publications").upsert(row, match=("platform", "target_id", "post_id"))
    ids = {str(p["post_id"]) for p in remote}
    for key in known.keys() - ids:
        await collection("channel_publications").update_where(
            {"platform": "facebook", "target_id": target_id, "post_id": key}, {"visible": False}
        )
    await collection("channels").update_where(
        {"platform": "facebook", "alias": alias, "target_id": target_id},
        {
            "publication_count": len(ids),
            "posts_synced_at": now,
            "last_post_at": max((p.get("published_at") or 0 for p in remote), default=0),
        },
    )
    return cached_publications(target_id, alias)


def local_image_publications(target_id: str, alias: str) -> list[dict]:
    # Confirmed image receipts appear immediately, even before Facebook's feed catches up.
    from src.adapters.data.publication_factory import get_publication_components

    service = get_publication_components().service
    rows = []
    for summary in service._all_summaries({"platform": "facebook", "delivery_status": "published"}):
        record = service.get(summary["publication_id"])
        if not record:
            continue
        for delivery in record.deliveries:
            if (
                delivery.platform != "facebook"
                or delivery.target_id != target_id
                or delivery.status.value != "published"
                or not delivery.remote.post_id
            ):
                continue
            rows.append(
                {
                    "platform": "facebook",
                    "alias": alias,
                    "post_id": delivery.remote.post_id,
                    "url": delivery.remote.permalink or f"https://www.facebook.com/{delivery.remote.post_id}",
                    "title": record.editorial.title,
                    "published_at": delivery.published_at.timestamp() if delivery.published_at else 0,
                    "origin": "nexa",
                    "kind": "carousel"
                    if delivery.placement == "carousel"
                    else "reel"
                    if delivery.placement == "reel"
                    else "photo",
                    "image_count": len(record.technical.slides),
                    "source_publication_id": record.publication_id,
                }
            )
    return rows


def merge_local_publications(remote: list[dict], local: list[dict], *, now: float | None = None) -> list[dict]:
    now = time.time() if now is None else now
    rows = {p["post_id"]: dict(p) for p in remote}
    object_ids = {p.get("remote_object_id"): p["post_id"] for p in remote if p.get("remote_object_id")}
    for post in local:
        key = post["post_id"] if post["post_id"] in rows else object_ids.get(post["post_id"])
        if key:
            rows[key] = {**rows[key], **post, "post_id": key}
        elif post.get("published_at", 0) > now - 300:
            rows[post["post_id"]] = post
    return sorted(rows.values(), key=lambda p: p.get("published_at", 0), reverse=True)
