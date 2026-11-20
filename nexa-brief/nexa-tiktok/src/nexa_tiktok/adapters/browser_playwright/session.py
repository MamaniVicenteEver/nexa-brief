"""Import, verify, back up and restore TikTok browser sessions."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import structlog
from cryptography.fernet import Fernet
from playwright.async_api import BrowserContext, Page

from nexa_tiktok.adapters.browser_playwright.profiles import (
    ensure_profile,
    open_browser,
    profile_dir,
    promote_profile,
    state_path,
)
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Account

logger = structlog.get_logger(__name__)


class RequiresReauth(RuntimeError):
    """The browser presented clear evidence that the session is no longer valid."""


def normalize_cookies(chrome_cookies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert Chrome cookies to Playwright cookies, keeping TikTok domains only."""
    if not isinstance(chrome_cookies, list):
        raise ValueError("La extensión no envió una lista de cookies válida.")  # noqa: TRY004 - API contract

    normalized: list[dict[str, Any]] = []
    has_session = False
    same_site = {
        "no_restriction": None,
        "lax": "Lax",
        "strict": "Strict",
        "unspecified": "Lax",
    }
    for cookie in chrome_cookies:
        if not isinstance(cookie, dict):
            continue
        raw_domain = str(cookie.get("domain") or "").strip().lower()
        domain = raw_domain.lstrip(".")
        if domain != "tiktok.com" and not domain.endswith(".tiktok.com"):
            continue
        name = str(cookie.get("name") or "")
        value = cookie.get("value")
        if not name or not isinstance(value, str):
            continue

        host_only_value = cookie.get("hostOnly")
        host_only = bool(host_only_value) if isinstance(host_only_value, bool) else not raw_domain.startswith(".")
        playwright_domain = domain if host_only else f".{domain}"
        item: dict[str, Any] = {
            "name": name,
            "value": value,
            "domain": playwright_domain,
            "path": str(cookie.get("path") or "/"),
            "secure": bool(cookie.get("secure", True)),
            "httpOnly": bool(cookie.get("httpOnly", False)),
        }
        expiration = cookie.get("expirationDate")
        if isinstance(expiration, (int, float)) and expiration > 0:
            item["expires"] = float(expiration)
        same_site_value = str(cookie.get("sameSite") or "unspecified").lower()
        mapped_same_site = same_site.get(same_site_value)
        if mapped_same_site is None and same_site_value not in same_site:
            mapped_same_site = "Lax"
        if mapped_same_site is not None:
            item["sameSite"] = mapped_same_site
        normalized.append(item)
        if name == "sessionid" and value:
            has_session = True

    if not has_session:
        raise ValueError("No se encontró la cookie sessionid de TikTok. Inicia sesión y vuelve a detectar.")
    return normalized


def _fernet() -> Fernet:
    key = settings.nexa_tiktok_encryption_key
    if not key:
        raise RuntimeError("NEXA_TIKTOK_ENCRYPTION_KEY no está configurada.")
    return Fernet(key.encode("utf-8"))


async def export_state(alias: str, context: BrowserContext | None = None) -> Path:
    """Encrypt Playwright storage state using the publisher Fernet key."""
    if context is None:
        async with open_browser(alias) as opened:
            return await export_state(alias, opened)
    state = await context.storage_state()
    encrypted = _fernet().encrypt(json.dumps(state, separators=(",", ":")).encode("utf-8"))
    destination = state_path(alias)
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination.parent.chmod(0o700)
    if destination.exists():
        old = destination.read_bytes()
        try:
            _fernet().decrypt(old)
        except Exception as exc:  # noqa: BLE001 - preserve the last valid previous snapshot
            logger.warning("tiktok_browser_previous_state_preserved", alias=alias, error_type=type(exc).__name__)
        else:
            _replace_private(destination.with_suffix(destination.suffix + ".previous"), old)
    _replace_private(destination, encrypted)
    return destination


def _replace_private(destination: Path, payload: bytes) -> None:
    """Create with mode 600, fsync and atomically replace even previous states."""
    fd, name = tempfile.mkstemp(prefix='.state-', dir=destination.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, destination)
        directory_fd = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        Path(name).unlink(missing_ok=True)


async def restore_state(alias: str) -> bool:
    """Recreate a missing persistent profile from its encrypted storage-state backup."""
    target = profile_dir(alias)
    backup = state_path(alias)
    if target.exists():
        return True
    payload = None
    for candidate in (backup, backup.with_suffix(backup.suffix + '.previous')):
        if not candidate.is_file():
            continue
        try:
            value = json.loads(_fernet().decrypt(candidate.read_bytes()).decode("utf-8"))
            if not isinstance(value, dict) or not isinstance(value.get('cookies'), list):
                raise TypeError('Estado de sesión inválido.')
            payload = value
            break
        except Exception as exc:  # noqa: BLE001 - try the previous encrypted state without exposing contents
            logger.warning("tiktok_browser_state_restore_failed", alias=alias, error_type=type(exc).__name__)
    if payload is None:
        return False

    ensure_profile(alias)
    async with open_browser(alias) as context:
        cookies = payload.get("cookies")
        if isinstance(cookies, list) and cookies:
            await context.add_cookies(cookies)
        for origin in payload.get("origins", []):
            if not isinstance(origin, dict) or not isinstance(origin.get("origin"), str):
                continue
            hostname = urlsplit(origin["origin"]).hostname or ""
            if hostname != "tiktok.com" and not hostname.endswith(".tiktok.com"):
                continue
            page = await context.new_page()
            try:
                await page.goto(origin["origin"], wait_until="domcontentloaded", timeout=20_000)
                local_storage = origin.get("localStorage", [])
                if isinstance(local_storage, list):
                    await page.evaluate(
                        "items => items.forEach(item => localStorage.setItem(item.name, item.value))",
                        local_storage,
                    )
            finally:
                await page.close()
        await export_state(alias, context)
    return True


def _identity_candidates(value: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[int] = set()

    def walk(node: Any, depth: int = 0) -> None:
        if depth > 8 or id(node) in seen:
            return
        if isinstance(node, dict):
            seen.add(id(node))
            username = node.get("uniqueId") or node.get("username") or node.get("unique_id")
            nickname = node.get("nickname") or node.get("displayName") or node.get("name")
            avatar = node.get("avatarLarger") or node.get("avatarMedium") or node.get("avatarThumb") or node.get("avatar_url")
            if username or (nickname and avatar):
                candidates.append({"username": username, "nickname": nickname, "avatar_url": avatar})
            for child in node.values():
                walk(child, depth + 1)
        elif isinstance(node, list):
            seen.add(id(node))
            for child in node[:200]:
                walk(child, depth + 1)

    walk(value)
    return candidates


async def read_identity(page: Page) -> dict[str, str | None]:
    """Read account identity from TikTok's account endpoint, embedded state or DOM."""
    result = await page.evaluate(
        """async () => {
          const found = [];
          try {
            const response = await fetch('/api/user/detail/?aid=1988', {credentials: 'include'});
            if (response.ok) found.push(await response.json());
          } catch (_) {}
          for (const key of ['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE']) {
            if (window[key]) found.push(window[key]);
          }
          const links = [...document.querySelectorAll('a[href^="/@"]')];
          const profileLink = links.find(link => /^[/]@[^/?#]+/.test(link.getAttribute('href') || ''));
          if (profileLink) {
            const match = (profileLink.getAttribute('href') || '').match(/^[/]@([^/?#]+)/);
            if (match) found.push({uniqueId: match[1], nickname: profileLink.textContent?.trim()});
          }
          return found;
        }"""
    )
    candidates = _identity_candidates(result)
    identity: dict[str, str | None] = {"username": None, "nickname": None, "avatar_url": None}
    for candidate in candidates:
        if candidate.get("username"):
            identity["username"] = str(candidate["username"]).lstrip("@")
            identity["nickname"] = str(candidate.get("nickname") or candidate["username"])
            identity["avatar_url"] = str(candidate["avatar_url"]) if candidate.get("avatar_url") else None
            break

    if not identity["username"]:
        fallback = await page.evaluate(
            """() => {
              const link = [...document.querySelectorAll('a[href^="/@"]')]
                .find(item => /^[/]@[^/?#]+/.test(item.getAttribute('href') || ''));
              const match = link?.getAttribute('href')?.match(/^[/]@([^/?#]+)/);
              const img = [...document.querySelectorAll('img')]
                .find(item => item.getAttribute('alt') && /profile|perfil|avatar/i.test(item.getAttribute('alt')));
              return {
                username: match?.[1] || null,
                nickname: link?.textContent?.trim() || null,
                avatar_url: img?.currentSrc || img?.src || null
              };
            }"""
        )
        if fallback.get("username"):
            identity = fallback
    if not identity["username"]:
        raise RuntimeError("TikTok aceptó la sesión, pero no se pudo leer la identidad de la cuenta.")
    return identity


async def verify_page(page: Page, context: BrowserContext, expected_username: str | None = None) -> dict[str, str | None]:
    cookies = await context.cookies("https://www.tiktok.com")
    if not any(cookie.get("name") == "sessionid" and cookie.get("value") for cookie in cookies):
        raise RequiresReauth("TikTok no recibió una cookie sessionid válida.")
    response = await page.goto("https://www.tiktok.com/tiktokstudio", wait_until="domcontentloaded", timeout=45_000)
    del response
    try:
        await page.wait_for_load_state("networkidle", timeout=8_000)
    except Exception as exc:  # noqa: BLE001 - networkidle is only a best-effort wait
        logger.debug("tiktok_network_idle_unavailable", error_type=type(exc).__name__)
    if "/login" in urlsplit(page.url).path.lower():
        raise RequiresReauth("La sesión de TikTok fue rechazada y redirigió al login.")
    identity = await read_identity(page)
    expected = (expected_username or "").strip().lstrip("@").lower()
    if expected and str(identity["username"]).lower() != expected:
        raise RuntimeError(
            f"La cuenta del navegador es @{identity['username']}, pero se esperaba @{expected_username.lstrip('@')}."
        )
    if identity.get("avatar_url"):
        identity["avatar_url"] = _safe_url(str(identity["avatar_url"]))
    return identity


def _safe_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


async def capture_diagnostics(page: Page, context: BrowserContext, alias: str, error: str) -> None:
    # Full-page masking prevents accidental credentials appearing in diagnostics.
    directory = settings.nexa_tiktok_data_dir / "logs" / alias
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        await page.screenshot(path=str(directory / "challenge.png"), mask=[page.locator("body")], timeout=5000)
        (directory / "challenge.png").chmod(0o600)
    except Exception as exc:  # noqa: BLE001 - diagnostics must not mask the original failure
        logger.debug("tiktok_diagnostics_unavailable", error_type=type(exc).__name__)


def save_browser_identity(alias: str, identity: dict[str, str | None]) -> dict[str, Any]:
    store = JsonStore(settings.nexa_tiktok_data_dir)
    account = store.get_account(alias) or Account(alias=alias).model_dump()
    account["identity"] = identity
    store.put_account(alias, account)
    return account


async def import_session(
    alias: str,
    cookies: list[dict[str, Any]],
    expected_username: str,
) -> dict[str, str | None]:
    import secrets
    import shutil

    normalized = normalize_cookies(cookies)
    staging_alias = "import_" + secrets.token_hex(10)
    try:
        async with open_browser(staging_alias) as context:
            await context.add_cookies(normalized)
            page = await context.new_page()
            identity = await verify_page(page, context, expected_username)
            await export_state(staging_alias, context)
        await promote_profile(staging_alias, alias)
        save_browser_identity(alias, identity)
        return identity
    finally:
        shutil.rmtree(profile_dir(staging_alias).parent, ignore_errors=True)


async def check_session(alias: str) -> dict[str, str | None] | None:
    if not await restore_state(alias):
        return None
    page: Page | None = None
    async with open_browser(alias) as context:
        try:
            page = await context.new_page()
            identity = await verify_page(page, context)
            await export_state(alias, context)
        except RequiresReauth as exc:
            if page is not None:
                await capture_diagnostics(page, context, alias, str(exc))
            logger.info("tiktok_browser_session_check_failed", alias=alias, error_type=type(exc).__name__)
            return None
    save_browser_identity(alias, identity)
    return identity

