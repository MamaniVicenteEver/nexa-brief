"""Post and verify the first TikTok video comment without blind duplicate sends."""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from pathlib import Path

from playwright.async_api import BrowserContext, Locator, Page

from nexa_tiktok.adapters.browser_playwright.selectors import (
    COMMENT_INPUTS,
    COMMENT_SEND_BUTTONS,
    PROCESSING_TEXTS,
    first_visible,
)
from nexa_tiktok.adapters.browser_playwright.uploader import (
    TikTokUploadError,
    _detect_manual_intervention,
    _secure_shots_dir,
    capture_failure,
    capture_step,
)

PROCESSING_TIMEOUT_SECONDS = 10 * 60
COMMENT_TEXT_LIMIT = 120


@dataclass
class CommentOutcome:
    text: str
    verified: bool
    attempts: int
    status: str


def comment_is_visible(comment_text: str, visible_text: str) -> bool:
    """Match a comment exactly after whitespace normalization."""
    def normalize(value: str) -> str:
        return " ".join(value.split())

    expected = normalize(comment_text)
    return bool(expected) and normalize(visible_text) == expected


async def _human_pause() -> None:
    await asyncio.sleep(random.uniform(0.8, 3.0))


async def _move_and_click(page: Page, locator: Locator) -> None:
    await locator.scroll_into_view_if_needed(timeout=3_000)
    box = await locator.bounding_box()
    if not box:
        raise TikTokUploadError("No se pudo localizar el control visible del comentario.")
    x = box["x"] + box["width"] * random.uniform(0.35, 0.65)
    y = box["y"] + box["height"] * random.uniform(0.35, 0.65)
    await page.mouse.move(x, y, steps=random.randint(10, 22))
    await asyncio.sleep(random.uniform(0.2, 0.6))
    await page.mouse.click(x, y)


async def _body_text(page: Page) -> str:
    try:
        return await page.locator("body").inner_text(timeout=2_000)
    except Exception:
        return ""


async def _video_is_processing(page: Page) -> bool:
    text = (await _body_text(page)).casefold()
    return any(marker.casefold() in text for marker in PROCESSING_TEXTS)


async def _wait_until_ready(page: Page, shots_dir: Path) -> None:
    deadline = asyncio.get_running_loop().time() + PROCESSING_TIMEOUT_SECONDS
    check = 0
    while await _video_is_processing(page):
        await _detect_manual_intervention(page)
        if asyncio.get_running_loop().time() >= deadline:
            raise TikTokUploadError("El video siguió procesándose durante diez minutos; no se envió el comentario.", code="video_processing_timeout")
        if check == 0 or check % 12 == 0:
            await capture_step(page, shots_dir, 70 + check // 12, "video-procesando")
        await asyncio.sleep(random.uniform(7.0, 12.0))
        await page.reload(wait_until="domcontentloaded", timeout=30_000)
        check += 1


async def _find_comment(page: Page, text: str, username: str) -> Locator | None:
    # Restrict evidence to a comment item with an explicit link to the verified author.
    # If TikTok changes the DOM, fail closed and require manual review.
    if not username:
        return None
    try:
        items = page.locator('[data-e2e="comment-item"]')
        for index in range(min(await items.count(), 200)):
            item = items.nth(index)
            if not await item.is_visible():
                continue
            author = item.locator('a[href^="/@"]').first
            href = await author.get_attribute('href')
            if not href or href.split('?', 1)[0].rstrip('/').casefold() != ('/@' + username).casefold():
                continue
            content = item.locator('[data-e2e="comment-level-1"]')
            if await content.count() and comment_is_visible(text, await content.first.inner_text()):
                return item
    except Exception:
        return None
    return None


async def post_first_comment(
    context: BrowserContext,
    video_url: str,
    text: str,
    *,
    shots_dir: Path,
    before_click,
    username: str = "",
) -> CommentOutcome:
    """Open the posted video, send one comment and confirm it appears in the list."""
    text = " ".join(text.split())
    if not text or len(text) > COMMENT_TEXT_LIMIT:
        raise TikTokUploadError("El comentario debe tener entre 1 y 120 caracteres.", code="invalid_comment")
    _secure_shots_dir(shots_dir)
    page = context.pages[0] if context.pages else await context.new_page()
    attempts = 0
    try:
        await page.goto(video_url, wait_until="domcontentloaded", timeout=45_000)
        if "/login" in page.url.casefold():
            raise TikTokUploadError("TikTok pidió iniciar sesión al abrir el video para comentar.", code="requires_reauth")
        await _detect_manual_intervention(page)
        await page.wait_for_timeout(1_000)
        await capture_step(page, shots_dir, 60, "video-abierto-para-comentar")
        await _wait_until_ready(page, shots_dir)

        if await _find_comment(page, text, username):
            await capture_step(page, shots_dir, 61, "comentario-ya-visible")
            return CommentOutcome(text, True, attempts, "ya visible")

        input_box = await first_visible(page, COMMENT_INPUTS, timeout_ms=700)
        if input_box is None:
            raise TikTokUploadError("No se encontró el campo de comentarios del video.", code="comment_unavailable")
        await _move_and_click(page, input_box)
        await page.keyboard.type(text, delay=random.randint(40, 110))
        await capture_step(page, shots_dir, 62, "comentario-escrito")
        await _human_pause()
        send = await first_visible(page, COMMENT_SEND_BUTTONS, timeout_ms=500)
        if send is None:
            raise TikTokUploadError("No se encontró el control para enviar el comentario.", code="comment_unavailable")
        await before_click()
        await _move_and_click(page, send)
        attempts = 1

        deadline = asyncio.get_running_loop().time() + 25
        while asyncio.get_running_loop().time() < deadline:
            await _detect_manual_intervention(page)
            if await _find_comment(page, text, username):
                await capture_step(page, shots_dir, 63, "comentario-confirmado")
                return CommentOutcome(text, True, attempts, "publicado y visible")
            await asyncio.sleep(1.5)

        return CommentOutcome(text, False, attempts, "enviado, pero no confirmado")
    except Exception as exc:
        await capture_failure(page, shots_dir, exc, after_publish_click=False)
        raise

