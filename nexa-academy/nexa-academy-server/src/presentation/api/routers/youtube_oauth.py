"""YouTube OAuth 2.0 callback router.

This router implements the server-side OAuth 2.0 flow for YouTube using the
"web" type OAuth client registered in Google Cloud Console.

Flow:
  1. GET /api/oauth/youtube/start?alias=canal_1
       → Builds the Google authorization URL and redirects the browser to it.

  2. Google redirects back to:
     GET /api/oauth/youtube/callback?code=...&state=canal_1
       → Exchanges the authorization code for access + refresh tokens.
       → Saves both tokens (encrypted) into accounts.json via TokenStorage.
       → Returns a JSON success response with token metadata.

How to use:
  1. Start the server: uv run uvicorn src.presentation.main:app --reload
  2. Open in browser: http://localhost:8000/api/oauth/youtube/start?alias=canal_1
  3. Authorize with your Google account
  4. Tokens are saved automatically — the pipeline is ready.
"""

from __future__ import annotations

import json
import urllib.parse
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from src.config.settings import settings
from src.adapters.publishing.token_storage import TokenStorage

router = APIRouter(prefix="/api/oauth/youtube", tags=["youtube"])
logger = structlog.get_logger(__name__)

# ── Load OAuth client credentials from client_secret.json ────────────────────
_SECRET_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "client_secret.json"

_GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl"

# The redirect_uri MUST match exactly what is in client_secret.json AND
# in Google Cloud Console → Authorized redirect URIs.
_REDIRECT_URI = "http://localhost:8000/api/oauth/youtube/callback"


def _load_client_credentials() -> tuple[str, str]:
    """Load client_id and client_secret from client_secret.json."""
    if not _SECRET_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=(
                f"client_secret.json not found at {_SECRET_PATH}. "
                "Download it from Google Cloud Console → Credentials → your OAuth Client ID → DOWNLOAD JSON, "
                "rename it to client_secret.json and place it in the project root."
            ),
        )
    try:
        raw = json.loads(_SECRET_PATH.read_text())
        app_type = "web" if "web" in raw else "installed"
        info = raw[app_type]
        return info["client_id"], info["client_secret"]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cannot parse client_secret.json: {exc}") from exc


# ── STEP 1: Start OAuth flow ──────────────────────────────────────────────────

@router.get("/start")
async def youtube_oauth_start(alias: str = "canal_1") -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen.

    Args:
        alias: Account alias to associate with the resulting tokens.
               Must be one of: canal_1, canal_2.

    Example:
        Open in browser: http://localhost:8000/api/oauth/youtube/start?alias=canal_1
    """
    client_id, _ = _load_client_credentials()

    params = {
        "client_id": client_id,
        "redirect_uri": _REDIRECT_URI,
        "response_type": "code",
        "scope": _SCOPES,
        "access_type": "offline",      # Request a refresh_token
        "prompt": "consent",           # Force consent screen to always get refresh_token
        "state": alias,                # Pass alias through the OAuth round-trip
    }

    auth_url = f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    logger.info(
        "youtube_oauth_start",
        alias=alias,
        client_id=client_id[:20] + "...",
    )

    return RedirectResponse(url=auth_url)


# ── STEP 2: Handle callback ───────────────────────────────────────────────────

@router.get("/callback", response_class=HTMLResponse)
async def youtube_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> HTMLResponse:
    """Receive the authorization code from Google and exchange it for tokens.

    This endpoint is called automatically by Google after the user authorizes.
    The redirect_uri must be: http://localhost:8000/api/oauth/youtube/callback
    """
    # ── Handle user denial ────────────────────────────────────────────────────
    if error:
        logger.error("youtube_oauth_denied", error=error, description=error_description)
        return HTMLResponse(_html_error(
            title="Autorización Denegada",
            message=f"Google devolvió error: <strong>{error}</strong><br>{error_description or ''}",
        ), status_code=400)

    if not code:
        return HTMLResponse(_html_error(
            title="Código Faltante",
            message="Google no devolvió un código de autorización. Intenta de nuevo.",
        ), status_code=400)

    alias = state or "canal_1"
    client_id, client_secret = _load_client_credentials()

    logger.info("youtube_oauth_callback_received", alias=alias, has_code=True)

    # ── Exchange code for tokens ──────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": _REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
    except Exception as exc:
        logger.error("youtube_oauth_token_exchange_failed", error=str(exc))
        return HTMLResponse(_html_error(
            title="Error de Red",
            message=f"No se pudo contactar a Google: {exc}",
        ), status_code=502)

    if resp.status_code != 200:
        logger.error("youtube_oauth_token_exchange_error", status=resp.status_code, body=resp.text[:300])
        return HTMLResponse(_html_error(
            title=f"Error HTTP {resp.status_code}",
            message=f"Google rechazó el intercambio de código:<br><code>{resp.text[:400]}</code>",
        ), status_code=502)

    token_data = resp.json()

    if "error" in token_data:
        err = token_data["error"]
        desc = token_data.get("error_description", "")
        logger.error("youtube_oauth_token_error", error=err, description=desc)
        return HTMLResponse(_html_error(
            title="Error de Token",
            message=f"<strong>{err}</strong>: {desc}",
        ), status_code=400)

    access_token  = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token")
    expires_in    = token_data.get("expires_in", 3600)

    if not access_token:
        return HTMLResponse(_html_error(
            title="Token Faltante",
            message="Google no devolvió un access_token en la respuesta.",
        ), status_code=502)

    # ── Save encrypted tokens in accounts.json ────────────────────────────────
    try:
        encryption_key = settings.publisher_encryption_key
        if not encryption_key:
            raise ValueError("PUBLISHER_ENCRYPTION_KEY no está configurada en .env")

        accounts_path = settings.accounts_json_path
        storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)

        storage.save_tokens(
            platform="youtube",
            alias=alias,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )

        # Persist client credentials per-account for future auto-refresh
        storage._data.setdefault("youtube", {}).setdefault(alias, {}).update({
            "name": alias,
            "target_id": alias,
            "client_id": client_id,
            "client_secret": client_secret,
        })
        storage._save()

    except Exception as exc:
        logger.error("youtube_oauth_save_failed", alias=alias, error=str(exc))
        return HTMLResponse(_html_error(
            title="Error al Guardar Tokens",
            message=str(exc),
        ), status_code=500)

    logger.info(
        "youtube_oauth_success",
        alias=alias,
        has_refresh_token=bool(refresh_token),
        expires_in=expires_in,
    )

    return HTMLResponse(_html_success(
        alias=alias,
        has_refresh_token=bool(refresh_token),
        expires_in=expires_in,
    ))


# ── HTML helpers ──────────────────────────────────────────────────────────────

def _html_success(alias: str, has_refresh_token: bool, expires_in: int) -> str:
    refresh_warn = "" if has_refresh_token else (
        "<p style='color:#f97316'><strong>⚠️ No se obtuvo refresh_token.</strong><br>"
        "Esto ocurre si la cuenta ya fue autorizada antes. Revoca el acceso en "
        "<a href='https://myaccount.google.com/permissions' target='_blank'>myaccount.google.com/permissions</a> "
        "y vuelve a autorizar.</p>"
    )
    return f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>✅ YouTube Configurado — Nexa Brief</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.box{{background:#161b22;border:1px solid #30363d;border-radius:12px;
padding:2rem 2.5rem;max-width:500px;text-align:center}}
h1{{color:#3fb950;font-size:1.8rem;margin-bottom:0.5rem}}
code{{background:#21262d;padding:0.2em 0.5em;border-radius:4px;font-size:0.9rem}}
a{{color:#58a6ff}}</style></head><body><div class="box">
<h1>🎉 ¡YouTube Configurado!</h1>
<p>Los tokens de <code>youtube:{alias}</code> fueron guardados y cifrados en <code>accounts.json</code>.</p>
<p>✅ <strong>access_token</strong>: obtenido (expira en {expires_in // 3600}h)<br>
{'✅' if has_refresh_token else '❌'} <strong>refresh_token</strong>: {'presente — el sistema lo renovará automáticamente' if has_refresh_token else 'ausente'}</p>
{refresh_warn}
<hr style="border-color:#30363d;margin:1.5rem 0">
<p>El pipeline ya puede publicar en YouTube.<br>
Activa en <code>.env</code>:<br>
<code>ACTIVE_ACCOUNT=youtube:{alias}</code></p>
<p><a href="/docs#/publisher/manual_publish_api_v1_publish__post">→ Ir a la API de publicación</a></p>
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
<p><a href="/api/oauth/youtube/start">← Intentar de nuevo</a></p>
</div></body></html>"""
