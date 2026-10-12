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

import time
import urllib.parse
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from src.config.settings import settings
from src.presentation.api.oauth_pages import render_oauth_error, render_oauth_success
from src.adapters.publishing.token_storage import TokenStorage

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
    AccountDeleteResponse,
    AccountStatusResponse,
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


def _account_response(account: dict) -> AccountStatusResponse:
    videos = list_published_videos(account["platform"], account["alias"])
    return AccountStatusResponse(
        **account,
        published_count=len(videos),
        last_published_at=max((v.get("published_at") or 0 for v in videos), default=None) or None,
    )


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


async def _update_channels_json(platform: str, alias: str, name: str, target_id: str, avatar: str = "", status: str = "ok"):
    await collection("channels").upsert(
        {
            "platform": platform,
            "alias": alias,
            "name": name,
            "target_id": target_id,
            "avatar": avatar,
            "status": status,
            "last_checked": time.time(),
        },
        match=("platform", "alias"),
    )
    await get_event_bus().publish(
        RealtimeEvent(type="channel_status_changed", data={"platform": platform, "alias": alias, "status": status})
    )


async def _remove_from_channels_json(platform: str, alias: str) -> None:
    await collection("channels").delete_where({"platform": platform, "alias": alias})


# ── TIKTOK OAUTH ENDPOINTS ───────────────────────────────────────────────────

@router.get("/auth/tiktok/start", tags=["tiktok"])
async def tiktok_oauth_start(
    request: Request,
    alias: str = "cuenta_1",
    redirect_uri: str | None = None,
) -> RedirectResponse:
    """Redirect the browser to TikTok's OAuth consent screen.

    Args:
        request: The FastAPI request context.
        alias: Account alias to associate with the resulting tokens.
        redirect_uri: Optional override for the redirect callback URI.
    """
    client_key = settings.tiktok_client_id
    if not client_key:
        raise HTTPException(status_code=500, detail="TIKTOK_CLIENT_ID not configured in .env")

    # Default to dynamic callback based on current request host (great for ngrok / production)
    cb_url = redirect_uri or f"{request.base_url}api/v1/publish/auth/tiktok/callback"

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
    request: Request,
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
    cb_url = f"{request.base_url}api/v1/publish/auth/tiktok/callback"

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
    request: Request,
    alias: str = "canal_1",
    redirect_uri: str | None = None,
) -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen for YouTube."""
    client_id, _ = _load_google_credentials()
    cb_url = redirect_uri or f"{request.base_url}api/v1/publish/auth/youtube/callback"

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
    request: Request,
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
    cb_url = f"{request.base_url}api/v1/publish/auth/youtube/callback"

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

    # Fetch YouTube channel info (name, channel_id, avatar)
    channel_name = alias
    channel_id = alias
    avatar_url = ""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            ch_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if ch_resp.status_code == 200:
                ch_data = ch_resp.json().get("items", [])
                if ch_data:
                    snippet = ch_data[0].get("snippet", {})
                    channel_name = snippet.get("title", alias)
                    channel_id = ch_data[0].get("id", alias)
                    avatar_url = snippet.get("thumbnails", {}).get("default", {}).get("url", "")
    except Exception as exc:
        logger.warning("youtube_oauth_fetch_channel_info_failed", error=str(exc))

    try:
        encryption_key = settings.publisher_encryption_key
        if not encryption_key:
            raise ValueError("PUBLISHER_ENCRYPTION_KEY no configurada en .env")

        accounts_path = settings.accounts_json_path
        storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)

        storage.save_tokens(
            platform="youtube",
            alias=alias,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )

        storage._data.setdefault("youtube", {}).setdefault(alias, {}).update({
            "name": channel_name,
            "target_id": channel_id,
            "avatar": avatar_url,
        })
        storage._save()

        await _update_channels_json("youtube", alias, channel_name, channel_id, avatar=avatar_url)
    except Exception as exc:
        logger.error("youtube_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("No se pudo guardar la cuenta", "La autorización fue correcta, pero el servidor no pudo guardar los tokens.", detail=str(exc)), status_code=500)

    return HTMLResponse(_html_success("youtube", alias, name=channel_name, avatar=avatar_url, expires_in=expires_in, has_refresh_token=bool(refresh_token)))


# ── FACEBOOK OAUTH ENDPOINTS ─────────────────────────────────────────────────

@router.get("/auth/facebook/start", tags=["facebook"])
async def facebook_oauth_start(
    request: Request,
    alias: str = "pagina_1",
    redirect_uri: str | None = None,
) -> RedirectResponse:
    """Redirect the browser to Meta's OAuth consent screen for Facebook Page access."""
    app_id = settings.facebook_client_id
    if not app_id:
        raise HTTPException(status_code=500, detail="FACEBOOK_CLIENT_ID not configured in .env")

    cb_url = redirect_uri or f"{request.base_url}api/v1/publish/auth/facebook/callback"

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


@router.get("/auth/facebook/callback", response_class=HTMLResponse, tags=["facebook"])
async def facebook_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> HTMLResponse:
    """Receive authorization code from Meta and obtain/save Facebook Page tokens."""
    if error:
        logger.error("facebook_oauth_denied", error=error, description=error_description)
        return HTMLResponse(_html_error("Autorización cancelada", "Facebook no otorgó el permiso. Si fue un error, vuelve a intentarlo desde Canales.", detail=f"{error}: {error_description or ''}", platform="facebook"), status_code=400)

    if not code:
        return HTMLResponse(_html_error("Falta el código de autorización", "Facebook no devolvió el código necesario para completar la conexión.", platform="facebook"), status_code=400)

    alias = state or "pagina_1"
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

    cb_url = f"{request.base_url}api/v1/publish/auth/facebook/callback"

    logger.info("facebook_oauth_exchange", alias=alias, redirect_uri=cb_url)

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
                logger.error("facebook_oauth_user_token_failed", status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("Facebook rechazó la conexión", "El intercambio del código de autorización falló.", detail=resp.text[:400], platform="facebook"), status_code=502)

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
                logger.error("facebook_oauth_long_lived_user_failed", status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("No se obtuvo un token duradero", "Facebook rechazó el intercambio por un token de larga duración.", detail=resp.text[:400], platform="facebook"), status_code=502)

            long_lived_user_token = resp.json().get("access_token")

            # Step C: Get Pages
            resp = await client.get(
                "https://graph.facebook.com/v21.0/me/accounts",
                params={"access_token": long_lived_user_token}
            )
            if resp.status_code != 200:
                logger.error("facebook_oauth_pages_failed", status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("No pudimos leer tus páginas", "Facebook no devolvió la lista de páginas que administras.", detail=resp.text[:400], platform="facebook"), status_code=502)

            pages = resp.json().get("data", [])
            if not pages:
                return HTMLResponse(_html_error("No hay páginas para conectar", "Esta cuenta de Facebook no administra ninguna página. Crea una o pide acceso de administrador.", platform="facebook"), status_code=400)

    except Exception as exc:
        logger.error("facebook_oauth_network_error", error=str(exc))
        return HTMLResponse(_html_error("Sin conexión con Facebook", "No pudimos comunicarnos con Facebook. Revisa tu conexión e inténtalo de nuevo.", detail=str(exc), platform="facebook"), status_code=502)

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
