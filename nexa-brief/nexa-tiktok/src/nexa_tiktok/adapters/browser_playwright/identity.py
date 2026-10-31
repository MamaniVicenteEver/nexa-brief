"""Read and verify a signed-in TikTok browser identity without session-storage dependencies."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

from playwright.async_api import BrowserContext, Page


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
    """Verify a live TikTok session and optionally require an exact account handle."""
    cookies = await context.cookies("https://www.tiktok.com")
    if not any(cookie.get("name") == "sessionid" and cookie.get("value") for cookie in cookies):
        raise RuntimeError("TikTok no recibió una cookie sessionid válida.")
    response = await page.goto("https://www.tiktok.com/tiktokstudio", wait_until="domcontentloaded", timeout=45_000)
    del response
    try:
        await page.wait_for_load_state("networkidle", timeout=8_000)
    except Exception:
        pass
    if "/login" in urlsplit(page.url).path.lower():
        raise RuntimeError("La sesión de TikTok fue rechazada y redirigió al login.")
    identity = await read_identity(page)
    expected = (expected_username or "").strip().lstrip("@").lower()
    if expected and str(identity["username"]).lower() != expected:
        raise RuntimeError(
            f"La cuenta del navegador es @{identity['username']}, pero se esperaba @{expected_username.lstrip('@')}."
        )
    return identity
