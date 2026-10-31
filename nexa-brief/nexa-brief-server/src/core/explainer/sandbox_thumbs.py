"""Generación serializada de miniaturas para páginas del sandbox."""

from __future__ import annotations

import asyncio
import os
import subprocess
import threading
from pathlib import Path
from urllib.parse import quote

from playwright.async_api import async_playwright

from src.config.settings import BASE_DIR, settings

THUMB_CACHE_DIR = BASE_DIR / "data" / "sandbox-thumbs"
_GENERATION_LOCK = threading.Lock()


def _valid_segment(value: str) -> bool:
    return bool(value) and not value.startswith((".", "_")) and ".." not in value and "/" not in value and "\\" not in value


async def _capture_page(page_url: str, output_path: Path) -> None:
    """Abre la página con la misma configuración de Chromium que el recorder."""
    async with async_playwright() as playwright:
        launch_options: dict = {
            "args": [
                "--autoplay-policy=no-user-gesture-required",
                "--disable-web-security",
                "--no-sandbox",
            ],
            "timeout": 6_000,
        }
        if settings.playwright_chromium_executable_path:
            launch_options["executable_path"] = settings.playwright_chromium_executable_path
        browser = await playwright.chromium.launch(**launch_options)
        try:
            page = await browser.new_page(viewport={"width": 1280, "height": 720})
            await page.goto(page_url, wait_until="domcontentloaded", timeout=8_000)
            await page.wait_for_timeout(2_000)
            await page.screenshot(path=str(output_path), type="jpeg", quality=85, timeout=3_000)
        finally:
            await browser.close()


def _capture_thumbnail(page_url: str, output_path: Path) -> None:
    """Adaptador síncrono para ejecutar Playwright dentro del hilo de captura."""
    asyncio.run(_capture_page(page_url, output_path))


def _needs_regeneration(index_path: Path, manifest_path: Path, thumbnail_path: Path) -> bool:
    if not thumbnail_path.is_file():
        return True
    thumbnail_mtime = thumbnail_path.stat().st_mtime_ns
    return any(
        source.is_file() and source.stat().st_mtime_ns > thumbnail_mtime
        for source in (index_path, manifest_path)
    )


def ensure_thumbnail(
    item_dir: Path,
    folder: str,
    item_id: str,
    page_url: str,
    *,
    cache_dir: Path | None = None,
    capture=None,
) -> Path:
    """Devuelve una miniatura fresca, generándola una sola vez por proceso."""
    if not _valid_segment(folder) or not _valid_segment(item_id):
        raise ValueError("segmento de sandbox inválido")

    item_dir = item_dir.resolve()
    index_path = item_dir / "index.html"
    manifest_path = item_dir / "manifest.json"
    if not item_dir.is_dir() or not index_path.is_file():
        raise FileNotFoundError("el elemento no tiene index.html")

    output_dir = (cache_dir or THUMB_CACHE_DIR) / folder
    output_path = output_dir / f"{item_id}.jpg"
    output_dir.mkdir(parents=True, exist_ok=True)

    with _GENERATION_LOCK:
        if not _needs_regeneration(index_path, manifest_path, output_path):
            return output_path

        temporary_path = output_dir / f".{item_id}.pending.jpg"
        temporary_path.unlink(missing_ok=True)
        try:
            (capture or _capture_thumbnail)(page_url, temporary_path)
            if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
                raise RuntimeError("Chromium no generó una miniatura")
            os.replace(temporary_path, output_path)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise

    return output_path


def ensure_reference_thumbnail(
    item_dir: Path,
    subcategory: str,
    item_id: str,
    *,
    cache_dir: Path | None = None,
) -> Path:
    """Extrae y cachea el primer cuadro de un video de referencia sin página HTML."""
    if not _valid_segment(subcategory) or not _valid_segment(item_id):
        raise ValueError("segmento de referencia inválido")

    item_dir = item_dir.resolve()
    videos = sorted(
        path for path in item_dir.glob("*.mp4") if path.is_file() and not path.name.startswith(".")
    )
    if not item_dir.is_dir() or not videos:
        raise FileNotFoundError("la referencia no tiene videos MP4")

    output_dir = (cache_dir or THUMB_CACHE_DIR) / "referencias" / subcategory
    output_path = output_dir / f"{item_id}.jpg"
    source = videos[0]
    output_dir.mkdir(parents=True, exist_ok=True)

    with _GENERATION_LOCK:
        if output_path.is_file() and output_path.stat().st_mtime_ns >= source.stat().st_mtime_ns:
            return output_path

        temporary_path = output_dir / f".{item_id}.pending.jpg"
        temporary_path.unlink(missing_ok=True)
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-ss",
                    "0.5",
                    "-i",
                    str(source),
                    "-frames:v",
                    "1",
                    "-vf",
                    "scale=960:-2",
                    "-q:v",
                    "3",
                    str(temporary_path),
                ],
                check=True,
                capture_output=True,
                timeout=20,
            )
            if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg no generó una miniatura")
            os.replace(temporary_path, output_path)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise

    return output_path


def sandbox_page_url(folder: str, item_id: str, *, explainer_kit: bool = False) -> str:
    """URL de la plantilla servida por la API local de previews."""
    page_url = (
        "http://127.0.0.1:8000/api/v1/explainer/files/sandbox/"
        f"{quote(folder, safe='')}/{quote(item_id, safe='')}/index.html"
    )
    return f"{page_url}?t=1" if explainer_kit else page_url
