"""Publisher router — manual CRUD endpoints for social-media video management.

All routes require the publishing component to be configured (accounts.json +
PUBLISHER_ENCRYPTION_KEY in .env).  They work independently of whether
ENABLE_AUTO_PUBLISHING is enabled — the manual API is always available.

Endpoints:
  POST   /api/v1/publish/                                     Manual publish
  GET    /api/v1/publish/{platform}/{alias}/{video_id}        Read video metadata
  PUT    /api/v1/publish/{platform}/{alias}/{video_id}        Update video metadata
  DELETE /api/v1/publish/{platform}/{alias}/{video_id}        Delete video
  GET    /api/v1/publish/accounts                             List all configured accounts
  DELETE /api/v1/publish/accounts/{platform}/{alias}          Disconnect a channel
  GET    /api/v1/publish/accounts/{platform}/{alias}/videos   List videos published to a channel

Error handling:
  All PublisherError subclasses are mapped to HTTP status codes:
    - PublishingDisabledError  → 403
    - TokenExpiredError        → 401
    - VideoNotFoundError       → 404
    - QuotaExceededError       → 429
    - UnsupportedOperationError→ 422
    - PlatformAPIError         → 502 (Bad Gateway)
    - PublisherError (base)    → 500
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import mimetypes
import re
import secrets
import time
import urllib.parse
from dataclasses import asdict
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from src.config.settings import settings
from src.presentation.api.oauth_pages import render_oauth_error, render_oauth_success
from src.presentation.api.oauth_urls import public_url
from src.presentation.api.file_streaming import serve_file_with_range
from src.adapters.publishing.instagram_media_url import resolve_signed_media_token
from src.adapters.publishing.token_storage import TokenStorage
from src.adapters.publishing.youtube_adapter import YouTubeChannelProfile

from src.config.exceptions import (
    PlatformAPIError,
    PublisherError,
    QuotaExceededError,
    TokenExpiredError,
    UnsupportedOperationError,
    VideoNotFoundError,
)
from src.adapters.publishing.factory import get_publisher_facade
from src.core.publish_log import list_published_videos, record_published_video
from src.core.realtime.event_bus import get_event_bus
from src.core.data import collection
from src.core.realtime.events import RealtimeEvent
from src.modules import video_deletion
from src.presentation.api.schemas.publisher_schema import (
    ChannelStatsResponse,
    ChannelSyncResponse,
    AccountDeleteResponse,
    AccountStatusResponse,
    ChannelHealthResponse,
    DeleteResponse,
    ManualPublishRequest,
    PublishedVideoResponse,
    PublishResponse,
    UpdateAccountRequest,
    UpdateVideoRequest,
    VideoMetadataResponse,
)

router = APIRouter(prefix="/publish", tags=["publisher"])
logger = structlog.get_logger(__name__)


def _get_facade():
    """Get the publisher facade; raises 500 if not configured."""
    try:
        return get_publisher_facade()
    except Exception as exc:
        logger.error("publisher_facade_unavailable", error=str(exc))
        raise HTTPException(
            status_code=500,
            detail=f"Publisher not configured: {exc}. Check PUBLISHER_ENCRYPTION_KEY and accounts.json.",
        ) from exc


def _map_publisher_error(exc: PublisherError) -> HTTPException:
    """Convert typed PublisherError to the appropriate HTTP status."""
    if isinstance(exc, TokenExpiredError):
        return HTTPException(status_code=401, detail=str(exc))
    if isinstance(exc, VideoNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, QuotaExceededError):
        return HTTPException(status_code=429, detail=str(exc))
    if isinstance(exc, UnsupportedOperationError):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, PlatformAPIError):
        return HTTPException(
            status_code=502,
            detail=f"Platform API error [{exc.platform}] HTTP {exc.status_code}: {str(exc)}",
        )
    return HTTPException(status_code=500, detail=str(exc))


# ── POST /publish/ — Manual publish ──────────────────────────────────────────

@router.post("/", response_model=PublishResponse, status_code=201)
async def manual_publish(request: ManualPublishRequest) -> PublishResponse:
    """Manually publish a video to a social-media platform.

    This endpoint is for **manual publishing** independent of the pipeline.
    It works even when ENABLE_AUTO_PUBLISHING=false.

    - Use `account_selector` to target a specific account (e.g. 'youtube:canal_2').
    - If `account_selector` is empty, the value from `ACTIVE_ACCOUNT` in .env is used.
    - For TikTok, provide the 9:16 vertical clip (tiktok_video.mp4).
    - For YouTube / Facebook, provide the full-quality horizontal video.
    """
    facade = _get_facade()
    video_path = Path(request.video_path)

    logger.info(
        "api_manual_publish_request",
        video_path=str(video_path),
        account_selector=request.account_selector or "(active_account from .env)",
        platform_hint=request.account_selector.split(":")[0] if ":" in request.account_selector else "default",
        title=request.title[:60],
    )

    if not video_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Video file not found: {video_path}. Provide an absolute path or a path relative to the project root.",
        )

    extra_kwargs = {}
    title = request.title
    selector = request.account_selector or settings.active_account
    if ":" in selector:
        platform, alias = selector.split(":", 1)
        if platform == "facebook":
            extra_kwargs["publish_as_reel"] = request.facebook_publish_as_reel
        elif platform == "youtube":
            if request.youtube_publish_as_short:
                if "#Shorts" not in title:
                    title = f"{title} #Shorts"

    try:
        result = await facade.publish_video(
            video_path=video_path,
            title=title,
            description=request.description,
            tags=request.tags,
            account_selector=request.account_selector or None,
            privacy=request.privacy,
            **extra_kwargs,
        )

        # Check if YouTube playlist needs to be linked
        if ":" in selector:
            platform, alias = selector.split(":", 1)
            if platform == "youtube" and request.youtube_playlist_id:
                try:
                    logger.info("api_manual_youtube_playlist_add_start", playlist_id=request.youtube_playlist_id, video_id=result.post_id)
                    yt_adapter = facade._adapters["youtube"]
                    await yt_adapter.add_video_to_playlist(result.post_id, request.youtube_playlist_id, alias)
                    logger.info("api_manual_youtube_playlist_add_success", playlist_id=request.youtube_playlist_id)
                except Exception as pl_exc:
                    logger.error("api_manual_youtube_playlist_add_failed", error=str(pl_exc))

    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    logger.info(
        "api_manual_publish_success",
        post_id=result.post_id,
        url=result.url,
        platform=result.platform,
        account=result.account_alias,
    )

    await record_published_video(
        platform=result.platform,
        alias=result.account_alias,
        post_id=result.post_id,
        url=result.url,
        title=title,
    )

    return PublishResponse(
        post_id=result.post_id,
        url=result.url,
        platform=result.platform,
        account_alias=result.account_alias,
    )


# ── GET /publish/accounts — List all configured accounts ─────────────────────

@router.get("/accounts", response_model=list[AccountStatusResponse])
async def list_accounts() -> list[AccountStatusResponse]:
    """List all configured social-media accounts and their token status.

    Returns account metadata WITHOUT any tokens or secrets.
    The `status` field indicates whether the account needs re-authentication:
      - 'ok'              → token is valid (or doesn't expire for Facebook).
      - 'requires_reauth' → the token has expired and must be manually refreshed.
    """
    facade = _get_facade()

    try:
        accounts = facade.list_accounts()
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    logger.info("api_list_accounts", total=len(accounts))
    return [_account_response(a) for a in accounts]


def _provider_error_code(response: httpx.Response) -> str | int | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    error = payload.get("error")
    if isinstance(error, dict):
        return error.get("code") or error.get("type")
    data = payload.get("data")
    if isinstance(data, dict):
        return data.get("error_code")
    return error if isinstance(error, (str, int)) else None


def _health_response(
    platform: str, alias: str, status: str, reason: str
) -> ChannelHealthResponse:
    return ChannelHealthResponse(
        platform=platform,
        alias=alias,
        status=status,
        reason=reason,
        checked_at=time.time(),
    )


async def _check_meta_channel(platform: str, target_id: str, token: str) -> tuple[bool, str]:
    fields = "id,name" if platform == "facebook" else "id,username"
    url = f"https://graph.facebook.com/{settings.meta_graph_api_version}/{urllib.parse.quote(target_id, safe='')}"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            url,
            params={"fields": fields},
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code != 200:
        code = _provider_error_code(response)
        if response.status_code == 401 or str(code) == "190":
            return False, "reauth_required"
        if response.status_code == 403 or str(code) in {"10", "200"}:
            return False, "permissions"
        return False, "unavailable"

    profile = response.json()
    if str(profile.get("id") or "") != str(target_id):
        return False, "identity_mismatch"
    return True, "connected"


async def _check_tiktok_channel(target_id: str, token: str) -> tuple[bool, str]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://open.tiktokapis.com/v2/user/info/",
            params={"fields": "open_id,display_name"},
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code != 200:
        code = _provider_error_code(response)
        if response.status_code == 401 or str(code).lower() in {"access_token_invalid", "invalid_token"}:
            return False, "reauth_required"
        if response.status_code == 403 or str(code).lower() == "scope_not_authorized":
            return False, "permissions"
        return False, "unavailable"

    payload = response.json()
    error = payload.get("error") or {}
    error_code = str(error.get("code") or "ok").lower() if isinstance(error, dict) else str(error).lower()
    if error_code not in {"", "ok"}:
        if error_code in {"access_token_invalid", "invalid_token"}:
            return False, "reauth_required"
        if error_code == "scope_not_authorized":
            return False, "permissions"
        return False, "unavailable"

    user = (payload.get("data") or {}).get("user") or {}
    if str(user.get("open_id") or "") != str(target_id):
        return False, "identity_mismatch"
    return True, "connected"


@router.post(
    "/accounts/{platform}/{alias}/verify",
    response_model=ChannelHealthResponse,
)
async def verify_account_connection(platform: str, alias: str) -> ChannelHealthResponse:
    """Check OAuth validity and account identity with a harmless profile read."""
    supported = {"youtube", "facebook", "instagram", "tiktok"}
    if platform not in supported:
        raise HTTPException(status_code=422, detail="Unsupported platform.")

    facade = _get_facade()
    account = next(
        (item for item in facade.list_accounts() if item["platform"] == platform and item["alias"] == alias),
        None,
    )
    if account is None:
        raise HTTPException(status_code=404, detail=f"No account found for '{platform}:{alias}'.")

    storage = facade._token_manager._storage
    try:
        token = await facade._token_manager.get_valid_token(platform, alias)
    except TokenExpiredError:
        return _health_response(platform, alias, "requires_reauth", "reauth_required")
    except Exception as exc:
        logger.warning("channel_health_token_check_failed", platform=platform, alias=alias, error_type=type(exc).__name__)
        return _health_response(platform, alias, "attention", "check_failed")

    try:
        if platform == "youtube":
            adapter = facade._adapters["youtube"]
            expected_id = account.get("target_id")
            profile = await adapter.get_channel_profile(
                alias,
                expected_channel_id=(expected_id if expected_id and expected_id != alias else None),
            )
            if profile is None:
                return _health_response(platform, alias, "attention", "identity_mismatch")
        elif platform in {"facebook", "instagram"}:
            valid, reason = await _check_meta_channel(platform, account.get("target_id") or "", token)
            if not valid:
                if reason == "reauth_required":
                    await storage.mark_requires_reauth(platform, alias, reason="platform rejected the OAuth token")
                    return _health_response(platform, alias, "requires_reauth", reason)
                return _health_response(platform, alias, "attention", reason)
        else:
            valid, reason = await _check_tiktok_channel(account.get("target_id") or "", token)
            if not valid:
                if reason == "reauth_required":
                    await storage.mark_requires_reauth(platform, alias, reason="platform rejected the OAuth token")
                    return _health_response(platform, alias, "requires_reauth", reason)
                return _health_response(platform, alias, "attention", reason)
    except PlatformAPIError as exc:
        if exc.status_code == 401:
            await storage.mark_requires_reauth(platform, alias, reason="platform rejected the OAuth token")
            return _health_response(platform, alias, "requires_reauth", "reauth_required")
        if exc.status_code == 403:
            return _health_response(platform, alias, "attention", "permissions")
        logger.warning(
            "channel_health_provider_check_failed",
            platform=platform,
            alias=alias,
            status_code=exc.status_code,
        )
        return _health_response(platform, alias, "attention", "unavailable")
    except httpx.HTTPError as exc:
        logger.warning("channel_health_network_error", platform=platform, alias=alias, error_type=type(exc).__name__)
        return _health_response(platform, alias, "attention", "unavailable")
    except Exception as exc:
        logger.exception("channel_health_check_failed", platform=platform, alias=alias, error_type=type(exc).__name__)
        return _health_response(platform, alias, "attention", "check_failed")

    return _health_response(platform, alias, "ok", "connected")


def _account_response(account: dict) -> AccountStatusResponse:
    platform, alias = account["platform"], account["alias"]
    videos = list_published_videos(platform, alias)
    channel = collection("channels").first({"platform": platform, "alias": alias}) or {}
    return AccountStatusResponse(
        **account,
        published_count=len(videos),
        last_published_at=max((v.get("published_at") or 0 for v in videos), default=None) or None,
        stats=channel.get("stats"),
        synced_at=channel.get("synced_at"),
        can_sync=_get_facade().catalog_for(platform) is not None,
    )


# ── POST /publish/accounts/{platform}/{alias}/sync — Sincronizar con la plataforma ──

@router.post("/accounts/{platform}/{alias}/sync", response_model=ChannelSyncResponse)
async def sync_account(platform: str, alias: str) -> ChannelSyncResponse:
    """Trae de la plataforma los videos que la cuenta ya tiene y sus totales.

    Agrega al registro los que falten (origin="imported") y actualiza los números de los que ya
    estaban; nunca duplica. Ver src/core/channel_sync.py."""
    try:
        summary = await _get_facade().sync_channel(platform, alias)
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc
    await get_event_bus().publish(
        RealtimeEvent(type="channel_status_changed", data={"platform": platform, "alias": alias, "status": "synced"})
    )
    return ChannelSyncResponse(
        platform=summary.platform, alias=summary.alias, remote_total=summary.remote_total,
        imported=summary.imported, updated=summary.updated,
        stats=ChannelStatsResponse(**asdict(summary.stats)), synced_at=summary.synced_at,
    )


# Mismo motivo que en videos.py: asyncio.create_task no retiene la Task.
_sync_tasks: set[asyncio.Task] = set()


def _spawn_channel_sync(platform: str, alias: str) -> None:
    """Sincroniza en segundo plano una cuenta recién conectada (su lista de videos no se pierde)."""
    if _get_facade().catalog_for(platform) is None:
        return

    async def run() -> None:
        try:
            await sync_account(platform, alias)
        except Exception as exc:  # noqa: BLE001 - conectar la cuenta ya funcionó; la sync se reintenta luego
            logger.warning("channel_sync_on_connect_failed", platform=platform, alias=alias, error=str(exc))

    task = asyncio.create_task(run())
    _sync_tasks.add(task)
    task.add_done_callback(_sync_tasks.discard)


# ── PATCH /publish/accounts/{platform}/{alias} — Edit label/notes ────────────

@router.patch("/accounts/{platform}/{alias}", response_model=AccountStatusResponse)
async def update_account(platform: str, alias: str, body: UpdateAccountRequest) -> AccountStatusResponse:
    """Update the user-facing label and notes of a connected account (no tokens touched)."""
    facade = _get_facade()
    if not facade.update_account_metadata(platform, alias, label=body.label, notes=body.notes):
        raise HTTPException(status_code=404, detail=f"No account found for '{platform}:{alias}'.")

    account = next(
        (a for a in facade.list_accounts() if a["platform"] == platform and a["alias"] == alias),
        None,
    )
    if account is None:
        raise HTTPException(status_code=404, detail=f"No account found for '{platform}:{alias}'.")

    await get_event_bus().publish(
        RealtimeEvent(type="channel_status_changed", data={"platform": platform, "alias": alias, "status": "updated"})
    )
    return _account_response(account)


@router.post("/accounts/{platform}/{alias}/refresh-profile", response_model=AccountStatusResponse)
async def refresh_account_profile(platform: str, alias: str) -> AccountStatusResponse:
    """Refresh public YouTube profile fields; the Nexa alias and usage notes stay unchanged."""
    facade = _get_facade()
    if platform == "instagram":
        account = next(
            (item for item in facade.list_accounts() if item["platform"] == "instagram" and item["alias"] == alias),
            None,
        )
        if account is None:
            raise HTTPException(status_code=404, detail=f"No account found for 'instagram:{alias}'.")
        storage = facade._token_manager._storage
        try:
            token_state = storage.get_state("instagram", alias)
            access_token = storage.decrypt(token_state.encrypted_access_token)
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(
                    f"https://graph.facebook.com/v21.0/{urllib.parse.quote(account['target_id'], safe='')}",
                    params={
                        "fields": "id,username,name,profile_picture_url,biography,website",
                        "access_token": access_token,
                    },
                )
            if response.status_code != 200:
                logger.warning("instagram_profile_refresh_failed", alias=alias, status=response.status_code)
                raise HTTPException(
                    status_code=502,
                    detail="Meta no pudo actualizar el perfil. Revisa instagram_basic y el vínculo con la página.",
                )
            profile = response.json()
            synced_at = time.time()
            name = profile.get("name") or profile.get("username") or account["name"]
            handle = profile.get("username") or account.get("handle")
            profile_url = f"https://www.instagram.com/{handle}" if handle else account.get("custom_url")
            avatar = profile.get("profile_picture_url") or account.get("avatar")
            biography = profile.get("biography") or ""
            saved = storage.update_channel_profile(
                "instagram",
                alias,
                name=name,
                target_id=profile.get("id") or account["target_id"],
                handle=handle,
                description=biography,
                custom_url=profile_url,
                avatar=avatar,
                profile_synced_at=synced_at,
            )
            if not saved:
                raise HTTPException(status_code=404, detail=f"No account found for 'instagram:{alias}'.")
            await _update_channels_json(
                "instagram",
                alias,
                name,
                profile.get("id") or account["target_id"],
                avatar=avatar or "",
                handle=handle,
                description=biography,
                custom_url=profile_url,
                profile_synced_at=synced_at,
                linked_page_name=account.get("linked_page_name"),
                linked_page_id=account.get("linked_page_id"),
            )
            updated = next(
                (item for item in facade.list_accounts() if item["platform"] == "instagram" and item["alias"] == alias),
                None,
            )
            if updated is None:
                raise HTTPException(status_code=404, detail=f"No account found for 'instagram:{alias}'.")
            return _account_response(updated)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("instagram_profile_refresh_error", alias=alias, error=str(exc))
            raise HTTPException(status_code=502, detail="No se pudo consultar el perfil de Instagram.") from exc

    if platform != "youtube":
        raise HTTPException(status_code=422, detail="Profile refresh is supported for YouTube and Instagram.")

    try:
        profile = await facade.refresh_youtube_profile(alias)
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="YouTube did not return this account's channel profile. Reconnect the account and try again.",
        )

    await _update_channels_json(
        "youtube",
        alias,
        profile["name"],
        profile["channel_id"],
        avatar=profile["avatar"] or "",
        handle=profile["handle"],
        description=profile["description"],
        custom_url=profile["custom_url"],
        profile_synced_at=profile["profile_synced_at"],
    )

    updated = next(
        (item for item in facade.list_accounts() if item["platform"] == "youtube" and item["alias"] == alias),
        None,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail=f"No account found for 'youtube:{alias}'.")
    return _account_response(updated)


# ── DELETE /publish/accounts/{platform}/{alias} — Disconnect a channel ───────
# Registered before the video-CRUD routes below: both are 3-segment paths
# ("/accounts/{platform}/{alias}" vs "/{platform}/{alias}/{video_id}"), so
# route order decides which one a request matches first.

@router.delete("/accounts/{platform}/{alias}", response_model=AccountDeleteResponse)
async def disconnect_account(platform: str, alias: str) -> AccountDeleteResponse:
    """Disconnect a channel: deletes its stored tokens and removes it from the
    public channels listing. This does not revoke the token on the platform
    itself — reconnecting later requires going through OAuth again."""
    facade = _get_facade()

    logger.info("api_disconnect_account_request", platform=platform, alias=alias)

    try:
        removed = facade.remove_account(platform, alias)
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"No account found for '{platform}:{alias}'.",
        )

    await _remove_from_channels_json(platform, alias)

    await get_event_bus().publish(
        RealtimeEvent(type="channel_status_changed", data={"platform": platform, "alias": alias, "status": "disconnected"})
    )

    logger.info("api_disconnect_account_success", platform=platform, alias=alias)
    return AccountDeleteResponse(platform=platform, alias=alias, deleted=True)


# ── GET /publish/accounts/{platform}/{alias}/videos — Videos published here ──

@router.get("/accounts/{platform}/{alias}/videos", response_model=list[PublishedVideoResponse])
async def list_channel_videos(platform: str, alias: str) -> list[PublishedVideoResponse]:
    """List every video published to this channel (newest first).

    Backed by data/canales/published_videos.json, appended to on each
    successful POST /publish/ call — not a live query to the platform."""
    videos = list_published_videos(platform, alias)
    videos.sort(key=lambda v: v.get("published_at", 0), reverse=True)
    return [PublishedVideoResponse(**v) for v in videos]


# ── CHANNELS DIRECTORY ────────────────────────────────────────────────────────
# Espejo público de las cuentas conectadas (sin tokens), colección "channels":
# el frontend puede mostrar nombre/avatar sin PUBLISHER_ENCRYPTION_KEY.
# accounts.json (tokens cifrados) sigue siendo la fuente de verdad de auth.


async def _update_channels_json(
    platform: str,
    alias: str,
    name: str,
    target_id: str,
    avatar: str = "",
    status: str = "ok",
    *,
    handle: str | None = None,
    description: str = "",
    custom_url: str | None = None,
    profile_synced_at: float | None = None,
    linked_page_name: str | None = None,
    linked_page_id: str | None = None,
):
    await collection("channels").upsert(
        {
            "platform": platform,
            "alias": alias,
            "name": name,
            "target_id": target_id,
            "avatar": avatar,
            "handle": handle,
            "description": description,
            "custom_url": custom_url,
            "profile_synced_at": profile_synced_at,
            "linked_page_name": linked_page_name,
            "linked_page_id": linked_page_id,
            "status": status,
            "last_checked": time.time(),
        },
        match=("platform", "alias"),
    )
    await get_event_bus().publish(
        RealtimeEvent(type="channel_status_changed", data={"platform": platform, "alias": alias, "status": status})
    )
    if status == "ok":
        _spawn_channel_sync(platform, alias)


async def _remove_from_channels_json(platform: str, alias: str) -> None:
    await collection("channels").delete_where({"platform": platform, "alias": alias})


# ── TIKTOK OAUTH ENDPOINTS ───────────────────────────────────────────────────

@router.get("/auth/tiktok/start", tags=["tiktok"])
async def tiktok_oauth_start(
    alias: str = "cuenta_1",
) -> RedirectResponse:
    """Redirect the browser to TikTok's OAuth consent screen.

    Args:
        alias: Internal account identifier to associate with the resulting tokens.
    """
    client_key = settings.tiktok_client_id
    if not client_key:
        raise HTTPException(status_code=500, detail="TIKTOK_CLIENT_ID not configured in .env")

    # All providers use the same canonical public origin from PUBLIC_APP_URL.
    cb_url = public_url("/api/v1/publish/auth/tiktok/callback")

    params = {
        "client_key": client_key,
        "scope": "user.info.basic,video.upload,video.publish",
        "response_type": "code",
        "redirect_uri": cb_url,
        "state": alias,
    }

    auth_url = f"https://www.tiktok.com/v2/auth/authorize/?{urllib.parse.urlencode(params)}"
    logger.info("tiktok_oauth_start", alias=alias, redirect_uri=cb_url)
    return RedirectResponse(url=auth_url)


@router.get("/auth/tiktok/callback", response_class=HTMLResponse, tags=["tiktok"])
async def tiktok_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> HTMLResponse:
    """Receive the authorization code from TikTok and exchange it for tokens."""
    if error:
        logger.error("tiktok_oauth_denied", error=error, description=error_description)
        return HTMLResponse(_html_error("Autorización cancelada", "TikTok no otorgó el permiso. Si fue un error, vuelve a intentarlo desde Canales.", detail=f"{error}: {error_description or ''}", platform="tiktok"), status_code=400)

    if not code:
        return HTMLResponse(_html_error("Falta el código de autorización", "TikTok no devolvió el código necesario para completar la conexión.", platform="tiktok"), status_code=400)

    alias = state or "cuenta_1"
    client_key = settings.tiktok_client_id
    client_secret = settings.tiktok_client_secret

    if not client_key or not client_secret:
        return HTMLResponse(_html_error("Configuración incompleta", "Faltan las credenciales de la app de TikTok en el servidor.", detail="TIKTOK_CLIENT_ID / TIKTOK_CLIENT_SECRET no configurados en .env", platform="tiktok"), status_code=500)

    # Reconstruct the exact redirect_uri sent during oauth start
    cb_url = public_url("/api/v1/publish/auth/tiktok/callback")

    logger.info("tiktok_oauth_exchange", alias=alias, redirect_uri=cb_url)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": client_key,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": cb_url,
                }
            )
    except Exception as exc:
        logger.error("tiktok_oauth_network_error", error=str(exc))
        return HTMLResponse(_html_error("Sin conexión con TikTok", "No pudimos comunicarnos con TikTok. Revisa tu conexión e inténtalo de nuevo.", detail=str(exc), platform="tiktok"), status_code=502)

    if resp.status_code != 200:
        logger.error("tiktok_oauth_exchange_failed", status=resp.status_code, body=resp.text)
        return HTMLResponse(_html_error("TikTok rechazó la conexión", "El intercambio del código de autorización falló.", detail=f"HTTP {resp.status_code}\n{resp.text[:400]}", platform="tiktok"), status_code=502)

    data = resp.json()
    error_code = data.get("error") or data.get("data", {}).get("error_code")
    if error_code:
        logger.error("tiktok_oauth_error_response", response=data)
        return HTMLResponse(_html_error("TikTok devolvió un error", "La respuesta de TikTok no permitió completar la conexión.", detail=str(data), platform="tiktok"), status_code=400)

    token_info = data.get("data", {})
    if not token_info:
        token_info = data

    access_token = token_info.get("access_token")
    refresh_token = token_info.get("refresh_token")
    expires_in = token_info.get("expires_in", 86400)
    refresh_expires_in = token_info.get("refresh_expires_in", 31536000)
    open_id = token_info.get("open_id")

    if not access_token:
        return HTMLResponse(_html_error("Token no recibido", "TikTok no devolvió un token de acceso.", platform="tiktok"), status_code=502)

    try:
        encryption_key = settings.publisher_encryption_key
        if not encryption_key:
            raise ValueError("PUBLISHER_ENCRYPTION_KEY no configurada en .env")

        accounts_path = settings.accounts_json_path
        storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)

        storage.save_tokens(
            platform="tiktok",
            alias=alias,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            refresh_expires_in=refresh_expires_in,
        )

        storage._data.setdefault("tiktok", {}).setdefault(alias, {}).update({
            "name": alias,
            "target_id": open_id or alias,
            "avatar": "",
        })
        storage._save()

        await _update_channels_json("tiktok", alias, alias, open_id or alias, avatar="")
    except Exception as exc:
        logger.error("tiktok_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("No se pudo guardar la cuenta", "La autorización fue correcta, pero el servidor no pudo guardar los tokens.", detail=str(exc)), status_code=500)

    return HTMLResponse(_html_success("tiktok", alias, expires_in=expires_in, has_refresh_token=bool(refresh_token)))


# ── YOUTUBE OAUTH ENDPOINTS ──────────────────────────────────────────────────

def _load_google_credentials() -> tuple[str, str]:
    import json
    # Primero el .env (YOUTUBE_CLIENT_ID/SECRET); client_secret.json queda como respaldo.
    if settings.youtube_client_id and settings.youtube_client_secret:
        return settings.youtube_client_id, settings.youtube_client_secret
    path = Path("client_secret.json")
    if not path.exists():
        raise HTTPException(status_code=500, detail="client_secret.json not found in workspace root")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        app_key = "web" if "web" in data else "installed"
        client_info = data[app_key]
        return client_info["client_id"], client_info["client_secret"]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse client_secret.json: {exc}")


@router.get("/auth/youtube/start", tags=["youtube"])
async def youtube_oauth_start(
    alias: str = "canal_1",
) -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen for YouTube."""
    client_id, _ = _load_google_credentials()
    cb_url = public_url("/api/v1/publish/auth/youtube/callback")

    params = {
        "client_id": client_id,
        "redirect_uri": cb_url,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl",
        "state": alias,
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    logger.info("youtube_oauth_start", alias=alias, redirect_uri=cb_url)
    return RedirectResponse(url=auth_url)


@router.get("/auth/youtube/callback", response_class=HTMLResponse, tags=["youtube"])
async def youtube_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    """Receive authorization code from Google and exchange it for YouTube tokens."""
    if error:
        logger.error("youtube_oauth_denied", error=error)
        return HTMLResponse(_html_error("Autorización cancelada", "Google no otorgó el permiso. Si fue un error, vuelve a intentarlo desde Canales.", detail=error, platform="youtube"), status_code=400)

    if not code:
        return HTMLResponse(_html_error("Falta el código de autorización", "Google no devolvió el código necesario para completar la conexión.", platform="youtube"), status_code=400)

    alias = state or "canal_1"
    client_id, client_secret = _load_google_credentials()
    cb_url = public_url("/api/v1/publish/auth/youtube/callback")

    logger.info("youtube_oauth_exchange", alias=alias, redirect_uri=cb_url)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": cb_url,
                }
            )
    except Exception as exc:
        logger.error("youtube_oauth_network_error", error=str(exc))
        return HTMLResponse(_html_error("Sin conexión con Google", "No pudimos comunicarnos con Google. Revisa tu conexión e inténtalo de nuevo.", detail=str(exc), platform="youtube"), status_code=502)

    if resp.status_code != 200:
        logger.error("youtube_oauth_exchange_failed", status=resp.status_code, body=resp.text)
        return HTMLResponse(_html_error("Google rechazó la conexión", "El intercambio del código de autorización falló.", detail=f"HTTP {resp.status_code}\n{resp.text[:400]}", platform="youtube"), status_code=502)

    token_info = resp.json()
    access_token = token_info.get("access_token")
    refresh_token = token_info.get("refresh_token")
    expires_in = token_info.get("expires_in", 3600)

    if not access_token:
        return HTMLResponse(_html_error("Token no recibido", "Google no devolvió un token de acceso.", platform="youtube"), status_code=502)

    try:
        encryption_key = settings.publisher_encryption_key
        if not encryption_key:
            raise ValueError("PUBLISHER_ENCRYPTION_KEY no configurada en el servidor")
        storage = TokenStorage(path=settings.accounts_json_path, encryption_key=encryption_key)
        existing = next(
            (
                item
                for item in storage.list_accounts()
                if item["platform"] == "youtube" and item["alias"] == alias
            ),
            {},
        )
    except Exception as exc:
        logger.error("youtube_oauth_storage_unavailable", error_type=type(exc).__name__)
        return HTMLResponse(
            _html_error("No se pudo comprobar la cuenta", "Google autorizó el acceso, pero no pudimos leer la cuenta guardada. No se cambió la conexión.", platform="youtube"),
            status_code=500,
        )

    # Al reconectar un alias existente, conservar su mismo canal de YouTube.
    # Una cuenta de Google puede administrar varios canales; no hay que reemplazar
    # el canal guardado por el primer resultado que devuelva la API.
    expected_channel_id = existing.get("target_id")
    if not expected_channel_id or expected_channel_id == alias:
        expected_channel_id = None

    # Read public channel profile once at connection time; the internal alias remains Nexa's key.
    profile: YouTubeChannelProfile | None = None
    profile_fetch_failed = False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            ch_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true", "maxResults": 50},
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if ch_resp.status_code == 200:
            channel_items = ch_resp.json().get("items") or []
            if channel_items:
                channel = next(
                    (item for item in channel_items if item.get("id") == expected_channel_id),
                    None,
                ) if expected_channel_id else channel_items[0]
                if channel is not None:
                    profile = YouTubeChannelProfile.from_resource(channel)
        else:
            profile_fetch_failed = True
            logger.warning(
                "youtube_oauth_fetch_channel_info_failed",
                status_code=ch_resp.status_code,
            )
    except Exception as exc:
        profile_fetch_failed = True
        logger.warning("youtube_oauth_fetch_channel_info_failed", error=str(exc))

    if expected_channel_id and profile is None:
        if profile_fetch_failed:
            return HTMLResponse(
                _html_error(
                    "No se pudo confirmar el canal",
                    "Google autorizó el acceso, pero YouTube no permitió confirmar el canal asociado a este alias. No se cambiaron los tokens guardados; inténtalo de nuevo.",
                    platform="youtube",
                ),
                status_code=502,
            )
        return HTMLResponse(
            _html_error(
                "El canal no coincide",
                "La cuenta de Google elegida no tiene el canal de YouTube guardado para este alias. Vuelve atrás y autoriza con la cuenta que administra ese canal. La conexión guardada no se cambió.",
                platform="youtube",
            ),
            status_code=409,
        )

    try:
        channel_name = profile.title if profile else existing.get("name", alias)
        channel_id = profile.channel_id if profile else existing.get("target_id", "")
        handle = profile.handle if profile else existing.get("handle")
        description = profile.description if profile else existing.get("description", "")
        custom_url = profile.custom_url if profile else existing.get("custom_url")
        avatar_url = profile.avatar if profile else existing.get("avatar") or ""
        profile_synced_at = time.time() if profile else existing.get("profile_synced_at")

        storage.save_tokens(
            platform="youtube",
            alias=alias,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )
        storage.update_channel_profile(
            "youtube",
            alias,
            name=channel_name,
            target_id=channel_id,
            handle=handle,
            description=description,
            custom_url=custom_url,
            avatar=avatar_url or None,
            profile_synced_at=profile_synced_at,
        )

        await _update_channels_json(
            "youtube",
            alias,
            channel_name,
            channel_id,
            avatar=avatar_url,
            handle=handle,
            description=description,
            custom_url=custom_url,
            profile_synced_at=profile_synced_at,
        )
    except Exception as exc:
        logger.error("youtube_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("No se pudo guardar la cuenta", "La autorización fue correcta, pero el servidor no pudo guardar los tokens.", detail=str(exc)), status_code=500)

    return HTMLResponse(_html_success("youtube", alias, name=channel_name, avatar=avatar_url, expires_in=expires_in, has_refresh_token=bool(refresh_token)))


# ── FACEBOOK OAUTH ENDPOINTS ─────────────────────────────────────────────────

@router.get("/auth/instagram/start", tags=["instagram"])
async def instagram_oauth_start(alias: str = "instagram_1") -> RedirectResponse:
    """Authorize Facebook Pages and discover linked Instagram professional accounts."""
    if not re.fullmatch(r"[a-z0-9_-]{1,32}", alias):
        raise HTTPException(status_code=422, detail="Invalid Instagram alias.")
    app_id = settings.facebook_client_id
    signing_key = settings.publisher_encryption_key
    if not app_id:
        raise HTTPException(status_code=500, detail="FACEBOOK_CLIENT_ID not configured in .env")
    if not signing_key:
        raise HTTPException(status_code=500, detail="PUBLISHER_ENCRYPTION_KEY not configured in .env")

    callback_path = "/api/v1/publish/auth/instagram/callback"
    callback_url = public_url(callback_path)
    nonce = secrets.token_urlsafe(24)
    expires_at = int(time.time()) + 600
    state_payload = f"instagram:{alias}:{expires_at}:{nonce}"
    signature = hmac.new(signing_key.encode(), state_payload.encode(), hashlib.sha256).hexdigest()
    params = {
        "client_id": app_id,
        "redirect_uri": callback_url,
        "scope": "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish",
        "state": f"{state_payload}:{signature}",
        "response_type": "code",
    }
    auth_url = f"https://www.facebook.com/v21.0/dialog/oauth?{urllib.parse.urlencode(params)}"
    logger.info("instagram_oauth_start", alias=alias, redirect_uri=callback_url)
    redirect = RedirectResponse(url=auth_url)
    redirect.set_cookie(
        "nexa_ig_oauth_state",
        nonce,
        max_age=600,
        httponly=True,
        secure=callback_url.startswith("https://"),
        samesite="lax",
        path=callback_path,
    )
    return redirect


@router.get("/auth/facebook/start", tags=["facebook"])
async def facebook_oauth_start(
    alias: str = "pagina_1",
) -> RedirectResponse:
    """Redirect the browser to Meta's OAuth consent screen for Facebook Page access."""
    app_id = settings.facebook_client_id
    if not app_id:
        raise HTTPException(status_code=500, detail="FACEBOOK_CLIENT_ID not configured in .env")

    cb_url = public_url("/api/v1/publish/auth/facebook/callback")

    params = {
        "client_id": app_id,
        "redirect_uri": cb_url,
        "scope": "pages_manage_posts,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging",
        "state": alias,
        "response_type": "code",
    }

    auth_url = f"https://www.facebook.com/v21.0/dialog/oauth?{urllib.parse.urlencode(params)}"
    logger.info("facebook_oauth_start", alias=alias, redirect_uri=cb_url)
    return RedirectResponse(url=auth_url)


@router.get("/auth/instagram/callback", response_class=HTMLResponse, tags=["instagram"])
@router.get("/auth/facebook/callback", response_class=HTMLResponse, tags=["facebook"])
async def facebook_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> HTMLResponse:
    """Receive Meta authorization for Facebook Pages or their linked Instagram profiles."""
    state = state or ""
    is_instagram = state.startswith("instagram:") or request.url.path.endswith("/auth/instagram/callback")
    platform = "instagram" if is_instagram else "facebook"
    alias = "pagina_1"
    if is_instagram:
        try:
            state_payload, received_signature = state.rsplit(":", 1)
            state_platform, alias, expires_at_raw, nonce = state_payload.split(":", 3)
            expected_signature = hmac.new(
                settings.publisher_encryption_key.encode(),
                state_payload.encode(),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(received_signature, expected_signature):
                raise ValueError("Invalid OAuth state signature")
            if state_platform != "instagram" or not re.fullmatch(r"[a-z0-9_-]{1,32}", alias):
                raise ValueError("Invalid Instagram account alias")
            expires_at = int(expires_at_raw)
            now = int(time.time())
            if expires_at < now or expires_at > now + 600:
                raise ValueError("Expired or invalid OAuth state")
            if not hmac.compare_digest(request.cookies.get("nexa_ig_oauth_state", ""), nonce):
                raise ValueError("OAuth state does not belong to this browser")
        except Exception:
            return HTMLResponse(
                _html_error("Conexión caducada", "No se pudo validar esta autorización. Vuelve a conectar Instagram desde Canales.", platform="instagram"),
                status_code=400,
            )
    else:
        alias = state or "pagina_1"

    if error:
        logger.error("meta_oauth_denied", platform=platform, error=error, description=error_description)
        return HTMLResponse(
            _html_error("Autorización cancelada", f"Meta no otorgó los permisos para conectar {platform}.", detail=f"{error}: {error_description or ''}", platform=platform),
            status_code=400,
        )

    if not code:
        return HTMLResponse(
            _html_error("Falta el código de autorización", "Meta no devolvió el código necesario para completar la conexión.", platform=platform),
            status_code=400,
        )

    app_id = settings.facebook_client_id

    fb_secret = getattr(settings, "facebook_client_secret", None)
    if not fb_secret:
        try:
            for line in Path(".env").read_text().splitlines():
                if line.startswith("FACEBOOK_CLIENT_SECRET="):
                     fb_secret = line.split("=", 1)[1].strip().strip('"').strip("'")
                     break
        except Exception:
            pass

    if not app_id or not fb_secret:
        return HTMLResponse(_html_error("Configuración incompleta", "Faltan las credenciales de la app de Facebook en el servidor.", detail="FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET no configurados en .env", platform="facebook"), status_code=500)

    callback_path = f"/api/v1/publish/auth/{platform}/callback"
    cb_url = public_url(callback_path)

    logger.info("meta_oauth_exchange", platform=platform, alias=alias, redirect_uri=cb_url)

    try:
        # Step A: Get User Access Token
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://graph.facebook.com/v21.0/oauth/access_token",
                params={
                    "client_id": app_id,
                    "redirect_uri": cb_url,
                    "client_secret": fb_secret,
                    "code": code,
                }
            )
            if resp.status_code != 200:
                logger.error("meta_oauth_user_token_failed", platform=platform, status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("Meta rechazó la conexión", "El intercambio del código de autorización falló.", detail=resp.text[:400], platform=platform), status_code=400)

            user_token = resp.json().get("access_token")

            # Step B: Exchange for Long-Lived User Token (60 days)
            resp = await client.get(
                "https://graph.facebook.com/v21.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": fb_secret,
                    "fb_exchange_token": user_token,
                }
            )
            if resp.status_code != 200:
                logger.error("meta_oauth_long_lived_user_failed", platform=platform, status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("No se obtuvo un token duradero", "Meta rechazó el intercambio por un token de larga duración.", detail=resp.text[:400], platform=platform), status_code=400)

            long_lived_user_token = resp.json().get("access_token")

            # Step C: Get Pages
            pages_params = {"access_token": long_lived_user_token}
            if is_instagram:
                pages_params["fields"] = (
                    "id,name,access_token,instagram_business_account{"
                    "id,username,name,profile_picture_url,biography,website}"
                )
            resp = await client.get(
                "https://graph.facebook.com/v21.0/me/accounts",
                params=pages_params,
            )
            if resp.status_code != 200:
                logger.error("meta_oauth_pages_failed", platform=platform, status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("No pudimos leer tus páginas", "Meta no devolvió la lista de páginas que administras.", detail=resp.text[:400], platform=platform), status_code=400)

            pages = resp.json().get("data", [])
            if not pages:
                return HTMLResponse(
                    _html_error("No hay páginas para conectar", "La cuenta de Facebook autorizada no administra ninguna página. Asigna acceso a una página y vuelve a intentarlo.", platform=platform),
                    status_code=400,
                )
            if is_instagram and not any(page.get("instagram_business_account") for page in pages):
                return HTMLResponse(
                    _html_error(
                        "No encontramos Instagram profesional vinculado",
                        "Nexa recibió tus páginas, pero ninguna expone una cuenta de Instagram profesional vinculada. Cambia Instagram a Empresa o Creador, vincúlalo a la página correcta y confirma instagram_basic en Meta.",
                        platform="instagram",
                    ),
                    status_code=400,
                )

    except Exception as exc:
        logger.error("facebook_oauth_network_error", error=str(exc))
        return HTMLResponse(_html_error("Sin conexión con Facebook", "No pudimos comunicarnos con Facebook. Revisa tu conexión e inténtalo de nuevo.", detail=str(exc), platform="facebook"), status_code=502)

    if is_instagram:
        try:
            encryption_key = settings.publisher_encryption_key
            if not encryption_key:
                raise ValueError("PUBLISHER_ENCRYPTION_KEY no configurada en .env")
            storage = TokenStorage(path=settings.accounts_json_path, encryption_key=encryption_key)
            existing_accounts = storage._data.get("instagram", {})
            used_aliases = set(existing_accounts)
            connected: list[tuple[dict, dict, str]] = []

            def next_instagram_alias() -> str:
                index = 1
                while f"instagram_{index}" in used_aliases:
                    index += 1
                return f"instagram_{index}"

            for page in pages:
                profile = page.get("instagram_business_account")
                if not profile or not page.get("access_token"):
                    continue
                instagram_id = str(profile.get("id") or "")
                if not instagram_id:
                    continue
                existing_alias = next(
                    (
                        existing_alias
                        for existing_alias, entry in existing_accounts.items()
                        if str(entry.get("target_id") or "") == instagram_id
                    ),
                    None,
                )
                if existing_alias:
                    account_alias = existing_alias
                elif not connected and alias not in used_aliases:
                    account_alias = alias
                else:
                    account_alias = next_instagram_alias()
                used_aliases.add(account_alias)
                connected.append((page, profile, account_alias))

            if not connected:
                return HTMLResponse(
                    _html_error("No encontramos perfiles conectables", "Meta no devolvió perfiles de Instagram vinculados a tus páginas. Revisa que el perfil sea profesional y que las páginas estén autorizadas.", platform="instagram"),
                    status_code=400,
                )

            first_name = ""
            first_avatar = ""
            for page, profile, account_alias in connected:
                username = profile.get("username") or account_alias
                account_name = profile.get("name") or username
                avatar_url = profile.get("profile_picture_url") or ""
                page_id = str(page.get("id") or "")
                page_name = page.get("name") or page_id
                instagram_id = str(profile["id"])
                profile_url = f"https://www.instagram.com/{username}"
                biography = profile.get("biography") or ""
                storage.save_tokens(
                    platform="instagram",
                    alias=account_alias,
                    access_token=page["access_token"],
                    expires_in=None,
                )
                storage.update_channel_profile(
                    "instagram",
                    account_alias,
                    name=account_name,
                    target_id=instagram_id,
                    handle=username,
                    description=biography,
                    custom_url=profile_url,
                    avatar=avatar_url or None,
                    profile_synced_at=time.time(),
                )
                storage._data["instagram"][account_alias].update({
                    "linked_page_name": page_name,
                    "linked_page_id": page_id,
                })
                storage._save()
                await _update_channels_json(
                    "instagram",
                    account_alias,
                    account_name,
                    instagram_id,
                    avatar=avatar_url,
                    handle=username,
                    description=biography,
                    custom_url=profile_url,
                    profile_synced_at=storage._data["instagram"][account_alias].get("profile_synced_at"),
                    linked_page_name=page_name,
                    linked_page_id=page_id,
                )
                if not first_name:
                    first_name = account_name
                    first_avatar = avatar_url

            success = HTMLResponse(
                _html_success(
                    "instagram",
                    connected[0][2],
                    name=first_name,
                    avatar=first_avatar,
                    extra_accounts=len(connected) - 1,
                )
            )
            success.delete_cookie("nexa_ig_oauth_state", path="/api/v1/publish/auth/instagram/callback")
            return success
        except Exception as exc:
            logger.exception("instagram_oauth_save_failed", error=str(exc))
            return HTMLResponse(
                _html_error("No se pudo guardar Instagram", "La autorización fue correcta, pero el servidor no pudo guardar el perfil y su token cifrado.", detail=str(exc), platform="instagram"),
                status_code=500,
            )

    try:
        encryption_key = settings.publisher_encryption_key
        if not encryption_key:
            raise ValueError("PUBLISHER_ENCRYPTION_KEY no configurada en .env")

        accounts_path = settings.accounts_json_path
        storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)

        # Save first page with requested alias, and all pages for complete CRUD listing
        for idx, page in enumerate(pages):
            page_name = page.get("name")
            page_id = page.get("id")
            page_token = page.get("access_token")
            page_alias = alias if idx == 0 else f"pagina_{idx + 1}"
            avatar_url = f"https://graph.facebook.com/{page_id}/picture?type=large"

            storage.save_tokens(
                platform="facebook",
                alias=page_alias,
                access_token=page_token,
                expires_in=None,
            )

            storage._data.setdefault("facebook", {}).setdefault(page_alias, {}).update({
                "name": page_name,
                "target_id": page_id,
                "avatar": avatar_url,
            })
            storage._save()

            await _update_channels_json("facebook", page_alias, page_name, page_id, avatar=avatar_url)

    except Exception as exc:
        logger.error("facebook_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("No se pudo guardar la cuenta", "La autorización fue correcta, pero el servidor no pudo guardar los tokens.", detail=str(exc)), status_code=500)

    return HTMLResponse(_html_success("facebook", alias, name=pages[0].get("name"), avatar=f"https://graph.facebook.com/{pages[0].get('id')}/picture?type=large", extra_accounts=len(pages) - 1))


# ── YOUTUBE PLAYLISTS ENDPOINT ────────────────────────────────────────────────

@router.get("/youtube/{alias}/playlists", response_model=list[dict[str, str]], tags=["youtube"])
async def list_youtube_playlists(alias: str) -> list[dict[str, str]]:
    """List playlists for a configured YouTube channel."""
    facade = _get_facade()
    try:
        yt_adapter = facade._adapters.get("youtube")
        if not yt_adapter:
            raise HTTPException(status_code=500, detail="YouTube adapter not found")
        playlists = await yt_adapter.list_playlists(alias)
        return playlists
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc
    except Exception as exc:
        logger.exception("list_youtube_playlists_failed", alias=alias)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/instagram/media/{token}", tags=["instagram"], include_in_schema=False)
async def get_instagram_upload_media(token: str, request: Request) -> Response:
    """Public, short-lived, HMAC-protected MP4 URL fetched by Meta during Reel publishing."""
    try:
        path = resolve_signed_media_token(token)
    except ValueError:
        raise HTTPException(status_code=404, detail="Media URL is invalid or expired.") from None

    return serve_file_with_range(
        path,
        request.headers.get("range"),
        mimetypes.guess_type(str(path))[0] or "video/mp4",
        if_none_match=request.headers.get("if-none-match"),
        if_modified_since=request.headers.get("if-modified-since"),
        if_range=request.headers.get("if-range"),
        cache_control="public, max-age=300",
    )


# ── GET /publish/{platform}/{alias}/{video_id} — Read video ───────────────────

@router.get("/{platform}/{alias}/{video_id}", response_model=VideoMetadataResponse)
async def get_video(platform: str, alias: str, video_id: str) -> VideoMetadataResponse:
    """Fetch current metadata and status for a published video.

    Args:
        platform: 'tiktok' | 'youtube' | 'facebook'
        alias:    Account alias (e.g. 'cuenta_1', 'canal_2')
        video_id: Platform-assigned video ID (returned by publish endpoint)
    """
    facade = _get_facade()
    account_selector = f"{platform}:{alias}"

    logger.info("api_get_video_request", platform=platform, alias=alias, video_id=video_id)

    try:
        meta = await facade.get_video(video_id=video_id, account_selector=account_selector)
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    return VideoMetadataResponse(
        video_id=meta.video_id,
        title=meta.title,
        description=meta.description,
        tags=meta.tags,
        status=meta.status,
        platform=meta.platform,
        raw_response=meta.raw_response,
    )


# ── PUT /publish/{platform}/{alias}/{video_id} — Update video ─────────────────

@router.put("/{platform}/{alias}/{video_id}", response_model=VideoMetadataResponse)
async def update_video(
    platform: str,
    alias: str,
    video_id: str,
    body: UpdateVideoRequest,
) -> VideoMetadataResponse:
    """Update the metadata of a published video.

    Only provided fields are updated — omit a field to leave it unchanged.

    **Note on TikTok:** TikTok does NOT allow editing metadata after publishing.
    This endpoint will return HTTP 422 for TikTok videos.
    """
    facade = _get_facade()
    account_selector = f"{platform}:{alias}"

    logger.info(
        "api_update_video_request",
        platform=platform,
        alias=alias,
        video_id=video_id,
        fields=body.model_dump(exclude_none=True),
    )

    try:
        meta = await facade.update_video(
            video_id=video_id,
            account_selector=account_selector,
            title=body.title,
            description=body.description,
            tags=body.tags,
            privacy=body.privacy,
        )
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    return VideoMetadataResponse(
        video_id=meta.video_id,
        title=meta.title,
        description=meta.description,
        tags=meta.tags,
        status=meta.status,
        platform=meta.platform,
        raw_response=meta.raw_response,
    )


# ── DELETE /publish/{platform}/{alias}/{video_id} — Delete video ──────────────

@router.delete("/{platform}/{alias}/{video_id}", response_model=DeleteResponse)
async def delete_video(platform: str, alias: str, video_id: str) -> DeleteResponse:
    """Permanently delete a published video from the platform.

    ⚠️  This action cannot be undone.  The video will be removed from the platform.
    Also drops it from published_videos.json and marks its queue entries
    `removed`, so Canales/Biblioteca stop showing it as published. A 404 from
    the platform (already deleted) counts as success for that cleanup.
    The local output files are NOT deleted (see DELETE /videos/jobs/{job_id}).
    """
    logger.info("api_delete_video_request", platform=platform, alias=alias, video_id=video_id)

    result = await video_deletion.delete_publication(platform, alias, video_id)
    if result.status == "unsupported":
        raise HTTPException(status_code=422, detail=result.error)
    if result.status == "failed":
        raise HTTPException(status_code=502, detail=result.error)

    logger.info("api_delete_video_success", platform=platform, alias=alias, video_id=video_id, status=result.status)
    return DeleteResponse(
        video_id=video_id,
        platform=platform,
        account_alias=alias,
        deleted=True,
        message=(
            "Video deleted successfully."
            if result.status == "deleted"
            else "Video no longer existed on the platform; local records cleaned up."
        ),
    )


# ── HTML HELPERS ─────────────────────────────────────────────────────────────
# Aliases kept short for the many call sites above; markup lives in oauth_pages.py.
_html_success = render_oauth_success
_html_error = render_oauth_error
