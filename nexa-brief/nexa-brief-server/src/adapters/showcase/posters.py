"""Generate small, profile-scoped, disposable showcase posters on demand."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

_running: dict[str, asyncio.Task] = {}
_failed: set[str] = set()
_gate = asyncio.Semaphore(1)


def poster_path(cache: Path, design: str, revision: str, entry: str, aspect: str, target: str) -> Path:
    key = json.dumps(["poster-v1", design, revision, entry, aspect, target], ensure_ascii=False)
    return cache / "showcase-posters" / (hashlib.sha256(key.encode()).hexdigest() + ".jpg")


def enqueue(path: Path, target: str, aspect: str, port: int, executable: str | None) -> None:
    key = str(path)
    if key in _running or key in _failed or len(_running) >= 24:
        return
    task = asyncio.create_task(_capture(path, target, aspect, port, executable))
    _running[key] = task
    def finished(done):
        _running.pop(key, None)
        if not done.cancelled() and done.exception() is not None:
            _failed.add(key)
    task.add_done_callback(finished)


async def _capture(path: Path, target: str, aspect: str, port: int, executable: str | None) -> None:
    if not target.startswith("/api/v1/") or target.startswith("//"):
        raise ValueError("Invalid preview target")
    width, height = ((640, 360) if aspect == "16x9" else (360, 640))
    async with _gate, async_playwright() as playwright:
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = await playwright.chromium.launch(**options)
        try:
            page = await browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            async def restrict(route):
                url = urlsplit(route.request.url)
                if url.scheme == "http" and url.hostname == "127.0.0.1" and url.port == port and url.path.startswith("/api/v1/"):
                    await route.continue_()
                else:
                    await route.abort()
            await page.route("**/*", restrict)
            # Some engines send readiness only to their own origin. Establish
            # that origin before building the isolated parent document.
            await page.goto(f"http://127.0.0.1:{port}/api/v1/__showcase_poster_origin__", wait_until="domcontentloaded")
            await page.set_content("<style>html,body,iframe{margin:0;border:0;width:100%;height:100%;overflow:hidden}</style><iframe></iframe><script>window.addEventListener('message',e=>{if(e.data?.type==='nexa-template-ready'){e.source.postMessage({type:'nexa-template-volume',muted:true,volume:0},'*');e.source.postMessage({type:'nexa-template-seek',time:0.35},'*');e.source.postMessage({type:'nexa-template-playback',playing:true},'*')} if(['nexa-template-ready','nexa-animation-ready'].includes(e.data?.type))window.previewReady=true})</script>")
            await page.locator("iframe").evaluate("(frame, url) => frame.src = url", f"http://127.0.0.1:{port}{target}")
            await page.wait_for_function("window.previewReady === true", timeout=30000)
            await page.wait_for_timeout(500)
            image = await page.screenshot(type="jpeg", quality=75)
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            fd, name = tempfile.mkstemp(prefix=".poster-", dir=path.parent)
            try:
                with os.fdopen(fd, "wb") as stream:
                    stream.write(image)
                os.replace(name, path)
            finally:
                Path(name).unlink(missing_ok=True)
        finally:
            await browser.close()


def status(path: Path) -> str:
    if path.is_file():
        return "ready"
    if str(path) in _failed:
        return "failed"
    return "pending"
