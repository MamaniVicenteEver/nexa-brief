"""In-memory QR login state machine for TikTok browser profiles."""

from __future__ import annotations

import asyncio
import base64
import secrets
import time
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

import structlog
from playwright.async_api import BrowserContext, Page

from nexa_tiktok.adapters.browser_playwright.profiles import (
    BROWSER_SEMAPHORE,
    open_browser,
    promote_profile,
    validate_alias,
)
from nexa_tiktok.adapters.browser_playwright.session import (
    capture_diagnostics,
    export_state,
    save_browser_identity,
    verify_page,
)

logger = structlog.get_logger(__name__)
QR_TTL_SECONDS = 180
QR_START_TIMEOUT_SECONDS = 60
QR_START_TIMEOUT_MESSAGE = (
    "La conexión QR tardó más de 60 segundos en preparar el código. Intenta generar otro."
)
_sessions: dict[str, QRLoginSession] = {}


@dataclass
class QRLoginSession:
    session_id: str
    alias: str
    state: str = "starting"
    qr_png_b64: str | None = None
    identity: dict[str, str | None] | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.monotonic)
    task: asyncio.Task[None] | None = None
    page: Page | None = None
    context: BrowserContext | None = None
    cancelled: bool = False


async def _capture_qr(page: Page) -> str | None:
    candidates = [
        '[class*="DivCodeImage"] canvas',
        '[data-e2e*="qrcode"]',
        '[class*="qrcode"]',
        '[class*="qrCode"]',
        'img[src*="qr"]',
        "canvas",
    ]
    for selector in candidates:
        locator = page.locator(selector).first
        try:
            if await locator.is_visible(timeout=300):
                payload = await locator.screenshot(type="png", timeout=3_000)
                return base64.b64encode(payload).decode("ascii")
        except Exception:
            continue
    return None


async def _qr_visible(page: Page) -> bool:
    for selector in ('[class*="DivCodeImage"] canvas', '[data-e2e*="qrcode"]', "canvas", 'img[src*="qr"]'):
        try:
            locator = page.locator(selector).first
            if await locator.is_visible(timeout=300):
                return True
        except Exception:
            continue
    return False


async def _has_session(context: BrowserContext) -> bool:
    cookies = await context.cookies("https://www.tiktok.com")
    return any(cookie.get("name") == "sessionid" and cookie.get("value") for cookie in cookies)


async def _fail_start_if_too_slow(session: QRLoginSession) -> None:
    remaining = session.created_at + QR_START_TIMEOUT_SECONDS - time.monotonic()
    await asyncio.sleep(max(0, remaining))
    if session.state not in {"queued", "starting"}:
        return
    session.state = "failed"
    session.error = QR_START_TIMEOUT_MESSAGE
    task = session.task
    if task is not None and task is not asyncio.current_task() and not task.done():
        task.cancel()


async def _run(session: QRLoginSession) -> None:
    start_timeout_task = asyncio.create_task(
        _fail_start_if_too_slow(session),
        name=f"tiktok-qr-timeout-{session.session_id}",
    )

    def mark_queued() -> None:
        if not session.cancelled and session.state in {"queued", "starting"}:
            session.state = "queued"

    def mark_starting() -> None:
        if not session.cancelled and session.state in {"queued", "starting"}:
            session.state = "starting"

    staging_alias = "qr_" + secrets.token_hex(10)
    try:
        async with open_browser(
            staging_alias,
            replace_profile=True,
            on_queued=mark_queued,
            on_acquired=mark_starting,
        ) as context:
            session.context = context
            page = await context.new_page()
            session.page = page
            await page.goto("https://www.tiktok.com/login/qrcode", wait_until="domcontentloaded", timeout=45_000)
            session.state = "waiting_qr"
            deadline = time.monotonic() + QR_TTL_SECONDS
            seen_qr = False
            missing_qr_checks = 0
            next_qr_capture_at = 0.0
            while not session.cancelled and time.monotonic() < deadline:
                if await _has_session(context) and "/login" not in page.url.lower():
                    session.state = "logged_in"
                    identity = await verify_page(page, context)
                    await export_state(staging_alias, context)
                    session.identity = identity
                    break

                if await _qr_visible(page):
                    seen_qr = True
                    missing_qr_checks = 0
                    session.state = "waiting_qr"
                    if time.monotonic() >= next_qr_capture_at:
                        qr_png_b64 = await _capture_qr(page)
                        if qr_png_b64:
                            session.qr_png_b64 = qr_png_b64
                        next_qr_capture_at = time.monotonic() + 1.5
                else:
                    missing_qr_checks += 1
                    session.state = "scanned" if seen_qr and missing_qr_checks >= 2 else "waiting_qr"
                sleep_seconds = 1.0
                if seen_qr and missing_qr_checks == 0 and next_qr_capture_at > 0:
                    until_next_capture = max(0.05, next_qr_capture_at - time.monotonic())
                    sleep_seconds = min(sleep_seconds, until_next_capture)
                await asyncio.sleep(sleep_seconds)

            if session.identity:
                pass
            elif session.cancelled:
                session.state = "cancelled"
            else:
                session.state = "expired"
                session.error = "El código QR venció. Inicia una conexión nueva."
        if session.identity and not session.cancelled:
            await promote_profile(staging_alias, session.alias)
            save_browser_identity(session.alias, session.identity)
            session.state = "done"
    except asyncio.CancelledError:
        if session.cancelled:
            session.state = "cancelled"
        elif session.state != "failed":
            session.state = "failed"
            session.error = "La conexión QR se interrumpió."
        raise
    except Exception as exc:  # noqa: BLE001 - surfaced as a readable state to the UI
        session.state = "failed"
        session.error = "No se pudo iniciar la sesión QR."
        if session.page is not None and session.context is not None:
            await capture_diagnostics(session.page, session.context, session.alias, str(exc))
        logger.warning("tiktok_qr_login_failed", alias=session.alias, error_type=type(exc).__name__)
    finally:
        start_timeout_task.cancel()
        with suppress(asyncio.CancelledError):
            await start_timeout_task
        session.page = None
        session.context = None
        session.qr_png_b64 = None
        import shutil

        from nexa_tiktok.adapters.browser_playwright.profiles import profile_dir
        shutil.rmtree(profile_dir(staging_alias).parent, ignore_errors=True)


async def _cancel_session(session: QRLoginSession) -> None:
    session.cancelled = True
    task = session.task
    if task is not None and task is not asyncio.current_task() and not task.done():
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    session.state = "cancelled"
    session.qr_png_b64 = None


async def _replace_previous_and_run(
    session: QRLoginSession,
    previous_sessions: list[QRLoginSession],
) -> None:
    try:
        for previous in previous_sessions:
            await _cancel_session(previous)
        if not session.cancelled:
            await _run(session)
    except asyncio.CancelledError:
        session.cancelled = True
        session.state = "cancelled"
        raise


def start_qr_login(alias: str) -> str:
    validate_alias(alias)
    cutoff = time.monotonic() - 3600
    for session_id, old in list(_sessions.items()):
        if old.created_at < cutoff and old.state in {"done", "failed", "expired", "cancelled"} and (not old.task or old.task.done()):
            del _sessions[session_id]
    active_states = {"queued", "starting", "waiting_qr", "scanned", "logged_in"}
    previous_sessions = [
        existing
        for existing in _sessions.values()
        if existing.alias == alias
        and (existing.state in active_states or (existing.task is not None and not existing.task.done()))
    ]
    for previous in previous_sessions:
        previous.cancelled = True
        previous.state = "cancelled"
        if previous.task is not None and not previous.task.done():
            previous.task.cancel()
    session_id = secrets.token_urlsafe(18)
    state = "queued" if previous_sessions or BROWSER_SEMAPHORE.locked() else "starting"
    session = QRLoginSession(session_id=session_id, alias=alias, state=state)
    _sessions[session_id] = session
    session.task = asyncio.create_task(
        _replace_previous_and_run(session, previous_sessions),
        name=f"tiktok-qr-{session_id}",
    )
    return session_id


async def get_qr_login(session_id: str) -> dict[str, Any]:
    session = _sessions.get(session_id)
    if not session:
        return {"state": "failed", "error": "La sesión QR no existe o ya venció."}
    result: dict[str, Any] = {"state": session.state}
    if session.qr_png_b64:
        result["qr_png_b64"] = session.qr_png_b64
    if session.identity:
        result["identity"] = session.identity
    if session.error:
        result["error"] = session.error
    return result


async def cancel_qr_login(session_id: str) -> bool:
    session = _sessions.get(session_id)
    if not session or session.state in {"done", "failed", "expired", "cancelled"}:
        return False
    session.cancelled = True
    task = session.task
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    session.state = "cancelled"
    session.qr_png_b64 = None
    return True

