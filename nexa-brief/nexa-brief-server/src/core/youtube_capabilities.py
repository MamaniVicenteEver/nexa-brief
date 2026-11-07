"""Evidence about a channel, never inferred from another channel on the same login."""
from __future__ import annotations

import time
from src.core.data import collection


def thumbnail_capability(alias: str, channel_id: str) -> dict:
    channel = collection("channels").first({"platform": "youtube", "alias": alias}) or {}
    evidence = channel.get("youtube_thumbnail_capability") or {}
    if not channel_id or evidence.get("channel_id") != channel_id:
        return {"state": "unknown", "reason": "not_checked", "checked_at": None}
    return {k: evidence.get(k) for k in ("state", "reason", "checked_at")}


async def record_thumbnail_result(alias: str, channel_id: str, result: dict) -> None:
    if not isinstance(channel_id, str) or not channel_id:
        return
    previous = thumbnail_capability(alias, channel_id)
    # Authorization, quota, bad files and transport errors do not prove channel ineligibility.
    reason = result.get("reason", "unknown")
    state = "enabled" if result.get("status") == "applied" else previous["state"]
    if reason == "permissions":
        state = "unavailable"
    if state == "unavailable" and reason != "permissions":
        state = "unknown"
    await collection("channels").upsert({
        "platform": "youtube", "alias": alias,
        "youtube_thumbnail_capability": {
            "channel_id": channel_id, "state": state, "reason": reason, "checked_at": time.time(),
        },
    }, match=("platform", "alias"))


async def reset_thumbnail_capability(alias: str, channel_id: str) -> None:
    # A fresh authorization should allow a channel whose verification has just changed to retry.
    await collection("channels").upsert({
        "platform": "youtube", "alias": alias,
        "youtube_thumbnail_capability": {
            "channel_id": channel_id, "state": "unknown", "reason": "reconnected", "checked_at": None,
        },
    }, match=("platform", "alias"))


FEATURE_ACCESS_TTL = 6 * 60 * 60
_UNKNOWN_ACCESS_TTL = 15 * 60
_LONG_UPLOAD_STATES = {"allowed": "enabled", "eligible": "verification_required", "disallowed": "restricted"}


def feature_access(alias: str, channel_id: str) -> dict:
    """Report only the owner-authorized long-upload status, scoped to this channel ID.

    YouTube does not expose a general phone_verified or thumbnail-eligibility flag.
    This is an access indicator, not proof of every intermediate/advanced feature.
    """
    channel = collection("channels").first({"platform": "youtube", "alias": alias}) or {}
    evidence = channel.get("youtube_feature_access") or {}
    if not channel_id or evidence.get("channel_id") != channel_id:
        return {"state": "unknown", "long_uploads_status": None, "checked_at": None, "stale": False}
    raw = evidence.get("long_uploads_status")
    raw = raw if isinstance(raw, str) else None
    state = _LONG_UPLOAD_STATES.get(raw, "unknown")
    checked_at = evidence.get("checked_at")
    ttl = _UNKNOWN_ACCESS_TTL if state == "unknown" else FEATURE_ACCESS_TTL
    stale = not isinstance(checked_at, (int, float)) or time.time() - checked_at > ttl
    return {"state": state, "long_uploads_status": raw if raw in _LONG_UPLOAD_STATES else None,
            "checked_at": checked_at, "stale": stale}


def feature_access_needs_refresh(alias: str, channel_id: str) -> bool:
    access = feature_access(alias, channel_id)
    return access["checked_at"] is None or access["stale"]


async def record_feature_access(alias: str, channel_id: str, long_uploads_status: str | None) -> None:
    if not isinstance(channel_id, str) or not channel_id:
        return
    await collection("channels").upsert({
        "platform": "youtube", "alias": alias,
        "youtube_feature_access": {
            "channel_id": channel_id,
            "long_uploads_status": long_uploads_status if isinstance(long_uploads_status, str) and long_uploads_status in _LONG_UPLOAD_STATES else None,
            "checked_at": time.time(), "source": "youtube_api",
        },
    }, match=("platform", "alias"))
