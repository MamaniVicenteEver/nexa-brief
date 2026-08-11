"""Publisher router — manual CRUD endpoints for social-media video management.

All routes require the publishing component to be configured (accounts.json +
PUBLISHER_ENCRYPTION_KEY in .env).  They work independently of whether
ENABLE_AUTO_PUBLISHING is enabled — the manual API is always available.

Endpoints:
  POST   /api/v1/publish/                              Manual publish
  GET    /api/v1/publish/{platform}/{alias}/{video_id} Read video metadata
  PUT    /api/v1/publish/{platform}/{alias}/{video_id} Update video metadata
  DELETE /api/v1/publish/{platform}/{alias}/{video_id} Delete video
  GET    /api/v1/publish/accounts                      List all configured accounts

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

import urllib.parse
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from src.config.settings import settings
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
from src.presentation.api.schemas.publisher_schema import (
    AccountStatusResponse,
    DeleteResponse,
    ManualPublishRequest,
    PublishResponse,
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
    return [AccountStatusResponse(**a) for a in accounts]



# ── CHANNELS DATABASE HELPER ──────────────────────────────────────────────────

def _update_channels_json(platform: str, alias: str, name: str, target_id: str, avatar: str = "", status: str = "ok"):
    import json
    import time
    channels_path = Path("data/channels.json")
    channels_path.parent.mkdir(parents=True, exist_ok=True)
    
    data = []
    if channels_path.exists():
        try:
            data = json.loads(channels_path.read_text(encoding="utf-8"))
        except Exception:
            data = []
            
    # Remove any existing channel with same platform + alias
    data = [item for item in data if not (item.get("platform") == platform and item.get("alias") == alias)]
    
    data.append({
        "platform": platform,
        "alias": alias,
        "name": name,
        "target_id": target_id,
        "avatar": avatar,
        "status": status,
        "last_checked": time.time()
    })
    
    channels_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


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
        return HTMLResponse(_html_error("Autorización Denegada", f"TikTok devolvió error: <strong>{error}</strong><br>{error_description or ''}"), status_code=400)
        
    if not code:
        return HTMLResponse(_html_error("Código Faltante", "No se recibió código de autorización de TikTok."), status_code=400)
        
    alias = state or "cuenta_1"
    client_key = settings.tiktok_client_id
    client_secret = settings.tiktok_client_secret
    
    if not client_key or not client_secret:
        return HTMLResponse(_html_error("Falta Configuración", "TIKTOK_CLIENT_ID o TIKTOK_CLIENT_SECRET no están configurados en el .env"), status_code=500)
        
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
        return HTMLResponse(_html_error("Error de Red", f"No se pudo conectar a TikTok: {exc}"), status_code=502)
        
    if resp.status_code != 200:
        logger.error("tiktok_oauth_exchange_failed", status=resp.status_code, body=resp.text)
        return HTMLResponse(_html_error(f"Error HTTP {resp.status_code}", f"TikTok rechazó el intercambio de código:<br><code>{resp.text[:400]}</code>"), status_code=502)
        
    data = resp.json()
    error_code = data.get("error") or data.get("data", {}).get("error_code")
    if error_code:
        logger.error("tiktok_oauth_error_response", response=data)
        return HTMLResponse(_html_error("Error de TikTok", f"Respuesta de error: <code>{data}</code>"), status_code=400)
        
    token_info = data.get("data", {})
    if not token_info:
        token_info = data
        
    access_token = token_info.get("access_token")
    refresh_token = token_info.get("refresh_token")
    expires_in = token_info.get("expires_in", 86400)
    refresh_expires_in = token_info.get("refresh_expires_in", 31536000)
    open_id = token_info.get("open_id")
    
    if not access_token:
        return HTMLResponse(_html_error("Token Faltante", "TikTok no devolvió access_token."), status_code=502)
        
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
        
        _update_channels_json("tiktok", alias, alias, open_id or alias, avatar="")
    except Exception as exc:
        logger.error("tiktok_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("Error de Almacenamiento", f"No se pudieron guardar los tokens en accounts.json: {exc}"), status_code=500)
        
    return HTMLResponse(_html_success("tiktok", alias, expires_in))


# ── YOUTUBE OAUTH ENDPOINTS ──────────────────────────────────────────────────

def _load_google_credentials() -> tuple[str, str]:
    import json
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
        return HTMLResponse(_html_error("Autorización Denegada", f"Google devolvió error: <strong>{error}</strong>"), status_code=400)
        
    if not code:
        return HTMLResponse(_html_error("Código Faltante", "No se recibió código de autorización de Google."), status_code=400)
        
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
        return HTMLResponse(_html_error("Error de Red", f"No se pudo conectar a Google: {exc}"), status_code=502)
        
    if resp.status_code != 200:
        logger.error("youtube_oauth_exchange_failed", status=resp.status_code, body=resp.text)
        return HTMLResponse(_html_error(f"Error HTTP {resp.status_code}", f"Google rechazó el intercambio de código:<br><code>{resp.text[:400]}</code>"), status_code=502)
        
    token_info = resp.json()
    access_token = token_info.get("access_token")
    refresh_token = token_info.get("refresh_token")
    expires_in = token_info.get("expires_in", 3600)
    
    if not access_token:
        return HTMLResponse(_html_error("Token Faltante", "Google no devolvió access_token."), status_code=502)
        
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
        
        _update_channels_json("youtube", alias, channel_name, channel_id, avatar=avatar_url)
    except Exception as exc:
        logger.error("youtube_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("Error de Almacenamiento", f"No se pudieron guardar los tokens en accounts.json: {exc}"), status_code=500)
        
    return HTMLResponse(_html_success("youtube", alias, expires_in))


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
        return HTMLResponse(_html_error("Autorización Denegada", f"Facebook devolvió error: <strong>{error}</strong><br>{error_description or ''}"), status_code=400)
        
    if not code:
        return HTMLResponse(_html_error("Código Faltante", "No se recibió código de autorización de Facebook."), status_code=400)
        
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
        return HTMLResponse(_html_error("Falta Configuración", "FACEBOOK_CLIENT_ID o FACEBOOK_CLIENT_SECRET no están configurados en el .env"), status_code=500)
        
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
                return HTMLResponse(_html_error("Intercambio Fallido", f"Facebook rechazó el código de usuario: {resp.text}"), status_code=502)
                
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
                return HTMLResponse(_html_error("Intercambio de Larga Duración Fallido", f"Facebook rechazó long-lived token: {resp.text}"), status_code=502)
                
            long_lived_user_token = resp.json().get("access_token")
            
            # Step C: Get Pages
            resp = await client.get(
                "https://graph.facebook.com/v21.0/me/accounts",
                params={"access_token": long_lived_user_token}
            )
            if resp.status_code != 200:
                logger.error("facebook_oauth_pages_failed", status=resp.status_code, body=resp.text)
                return HTMLResponse(_html_error("Error al Obtener Páginas", f"No se pudo consultar me/accounts: {resp.text}"), status_code=502)
                
            pages = resp.json().get("data", [])
            if not pages:
                return HTMLResponse(_html_error("Sin Páginas", "No se encontraron páginas de Facebook administradas por este usuario."), status_code=400)
                
    except Exception as exc:
        logger.error("facebook_oauth_network_error", error=str(exc))
        return HTMLResponse(_html_error("Error de Red", f"Fallo al conectar con Facebook: {exc}"), status_code=502)
        
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
            
            _update_channels_json("facebook", page_alias, page_name, page_id, avatar=avatar_url)
            
    except Exception as exc:
        logger.error("facebook_oauth_save_failed", error=str(exc))
        return HTMLResponse(_html_error("Error de Almacenamiento", f"No se pudieron guardar los tokens en accounts.json: {exc}"), status_code=500)
        
    return HTMLResponse(_html_success("facebook", alias, 0))


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
    The local output files (youtube_video.mp4, tiktok_video.mp4) are NOT deleted.
    """
    facade = _get_facade()
    account_selector = f"{platform}:{alias}"

    logger.info(
        "api_delete_video_request",
        platform=platform,
        alias=alias,
        video_id=video_id,
    )

    try:
        deleted = await facade.delete_video(video_id=video_id, account_selector=account_selector)
    except PublisherError as exc:
        raise _map_publisher_error(exc) from exc

    logger.info("api_delete_video_success", platform=platform, alias=alias, video_id=video_id)

    return DeleteResponse(
        video_id=video_id,
        platform=platform,
        account_alias=alias,
        deleted=deleted,
    )


# ── HTML HELPERS ─────────────────────────────────────────────────────────────

def _html_success(platform: str, alias: str, expires_in: int) -> str:
    expires_str = f"expira en {expires_in // 3600}h" if expires_in > 0 else "permanente (NUNCA EXPIRA)"
    refresh_str = "guardado (se renovará automáticamente)" if expires_in > 0 else "no requerido (token permanente)"
    return f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>✅ {platform.capitalize()} Configurado — Nexa Brief</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.box{{background:#161b22;border:1px solid #30363d;border-radius:12px;
padding:2rem 2.5rem;max-width:500px;text-align:center}}
h1{{color:#3fb950;font-size:1.8rem;margin-bottom:0.5rem}}
code{{background:#21262d;padding:0.2em 0.5em;border-radius:4px;font-size:0.9rem}}
a{{color:#58a6ff}}</style></head><body><div class="box">
<h1>🎉 ¡{platform.capitalize()} Configurado!</h1>
<p>Los tokens de <code>{platform}:{alias}</code> fueron guardados y cifrados en <code>accounts.json</code>.</p>
<p>✅ <strong>access_token</strong>: obtenido ({expires_str})<br>
✅ <strong>refresh_token</strong>: {refresh_str}</p>
<hr style="border-color:#30363d;margin:1.5rem 0">
<p>El pipeline ya puede publicar en {platform.capitalize()}.<br>
Activa en <code>.env</code>:<br>
<code>ACTIVE_ACCOUNT={platform}:{alias}</code></p>
<p><a href="/docs">→ Ir a la documentación interactiva de la API</a></p>
</div></body></html>"""


def _html_error(title: str, message: str) -> str:
    return f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>❌ {title} — Nexa Brief</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.box{{background:#161b22;border:1px solid #30363d;border-radius:12px;
padding:2rem 2.5rem;max-width:540px;text-align:center}}
h1{{color:#f85149;font-size:1.6rem}} code{{background:#21262d;padding:0.2em 0.5em;border-radius:4px}}
a{{color:#58a6ff}}</style></head><body><div class="box">
<h1>❌ {title}</h1><p>{message}</p>
<p>Por favor verifica tu configuración de red o credenciales en <code>.env</code> e intenta de nuevo.</p>
</div></body></html>"""
