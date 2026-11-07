"""Canales conectados. Lo público es nombre, avatar, enlace y cuántos videos
lleva; el estado del token y demás detalles solo van al dashboard."""

from __future__ import annotations

from hashlib import sha256

from src.core.stats.context import StatsContext
from src.core.stats.models import ChannelDetail, ChannelStats, PublicChannel


def public_url(platform: str, target_id: str | None, handle: str | None = None) -> str | None:
    """Enlace público al canal; TikTok no expone un @usuario al autorizar."""
    if platform == "instagram" and handle:
        return f"https://www.instagram.com/{handle.lstrip('@').strip('/')}"
    if not target_id:
        return None
    if platform == "youtube":
        return f"https://www.youtube.com/channel/{target_id}"
    if platform == "facebook":
        return f"https://www.facebook.com/{target_id}"
    return None


def _published_by_account(ctx: StatsContext) -> dict[tuple[str, str], list[float]]:
    counts: dict[tuple[str, str], list[float]] = {}
    for pub in ctx.publications:
        counts.setdefault((pub.get("platform"), pub.get("alias")), []).append(pub.get("published_at") or 0)
    return counts


def summary(ctx: StatsContext) -> ChannelStats:
    platforms = sorted({a["platform"] for a in ctx.accounts})
    return ChannelStats(total=len(ctx.accounts), platforms=platforms)


def details(ctx: StatsContext) -> list[ChannelDetail]:
    published = _published_by_account(ctx)
    result = []
    for account in ctx.accounts:
        times = published.get((account["platform"], account["alias"]), [])
        account_platform = account["platform"]
        account_alias = account["alias"]
        result.append(ChannelDetail(
            id=sha256(f'{account_platform}:{account_alias}'.encode()).hexdigest()[:24],
            platform=account_platform,
            alias=account_alias,
            name=account.get("name") or account["alias"],
            avatar=account.get("avatar"),
            public_url=public_url(account["platform"], account.get("target_id"), account.get("handle")),
            published_count=len(times),
            label=account.get("label", ""),
            status=account.get("status", "ok"),
            expires_in_seconds=account.get("expires_in_seconds"),
            has_refresh_token=bool(account.get("has_refresh_token")),
            last_published_at=max(times) if times else None,
        ))
    result.sort(key=lambda c: (-c.published_count, c.platform, c.name))
    return result


def public_list(ctx: StatsContext) -> list[PublicChannel]:
    return [PublicChannel(**c.model_dump(include=set(PublicChannel.model_fields))) for c in details(ctx)]
