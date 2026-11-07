#!/usr/bin/env python3
"""Renderiza los showcases NodeMotion y guarda un fotograma de la intro en WebP."""

from __future__ import annotations

import argparse
import asyncio
import sys
from io import BytesIO
from pathlib import Path
from urllib.parse import quote

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from PIL import Image  # noqa: E402
from playwright.async_api import async_playwright  # noqa: E402
from playwright.async_api import TimeoutError as PlaywrightTimeoutError  # noqa: E402

from src.config.settings import settings  # noqa: E402
from src.config.template_manifest import get_template_asset_dir, get_template_paths, list_template_catalog  # noqa: E402

MAX_EDGE = 960
WEBP_QUALITY = 80
SHOWCASE_VIEWPORT = {"width": 960, "height": 582}
NODEMOTION_ROOT = (settings.templates_dir / "nodemotion").resolve()


async def capture_template_intro(
    page,
    template_id: str,
    index_path: Path,
    asset_dir: Path,
    base_url: str,
    intro_seconds: float,
    background_seconds: float | None,
) -> Image.Image:
    """Renderiza la plantilla completa y captura su intro en el showcase real."""
    relative_html = index_path.resolve().relative_to(asset_dir.parent.resolve()).as_posix()
    url = (
        f"{base_url.rstrip('/')}/api/v1/templates/{quote(template_id, safe='-')}/showcase/"
        f"{quote(relative_html, safe='/')}?muted=1&preview=card"
    )
    await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    try:
        await page.wait_for_function("document.readyState === 'complete'", timeout=12_000)
    except PlaywrightTimeoutError:
        # Algunos videos secundarios tardan; el documento y su escena ya se renderizaron.
        pass

    # El bridge de preview deja terminar su reset de carga antes de iniciar el render.
    await page.wait_for_timeout(1_300)
    await page.evaluate(
        "() => window.postMessage({ type: 'nexa-template-reset' }, '*')"
    )
    # El reset dibuja el cuadro inicial en el siguiente rAF. Esperarlo permite
    # fijar el tiempo exacto de la escena antes de capturar, sin dejar avanzar el audio.
    await page.wait_for_timeout(120)
    await page.evaluate(
        """({ introSeconds, backgroundSeconds }) => {
          const media = [...document.querySelectorAll('audio, video')];
          media.forEach((element) => element.pause());
          const audio = media.find((element) => element.tagName === 'AUDIO');
          const videos = media.filter((element) => element.tagName === 'VIDEO');
          try { if (audio) audio.currentTime = Math.max(0, Number(introSeconds) || 0); } catch (_) {}
          videos.forEach((video) => {
            const target = backgroundSeconds === null ? introSeconds : backgroundSeconds;
            try { video.currentTime = Math.max(0, Number(target) || 0); } catch (_) {}
          });
        }""",
        {"introSeconds": intro_seconds, "backgroundSeconds": background_seconds},
    )
    # Hacer un ciclo corto de reproducción para que el bridge reactive el rAF
    # de la tarjeta; luego pausar en el último cuadro del intro.
    await page.wait_for_timeout(200)
    await page.evaluate(
        "() => window.postMessage({ type: 'nexa-template-preview', playing: true }, '*')"
    )
    await page.wait_for_timeout(100)
    await page.evaluate(
        "() => window.postMessage({ type: 'nexa-template-preview', playing: false }, '*')"
    )
    await page.wait_for_timeout(80)
    screenshot = await page.screenshot(type="png", full_page=False)
    with Image.open(BytesIO(screenshot)) as frame:
        frame.load()
        return frame.convert("RGB")


def save_webp(frame: Image.Image, destination: Path) -> None:
    """Reduce la captura a 960 px y la escribe como WebP optimizado."""
    frame.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    temporary = destination.with_name(f"{destination.stem}.tmp.webp")
    frame.save(temporary, format="WEBP", quality=WEBP_QUALITY, method=6)
    temporary.replace(destination)


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="regenera también las portadas existentes")
    parser.add_argument(
        "--template-id", action="append", dest="template_ids",
        help="limita la captura a una plantilla; se puede repetir para procesar un lote",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="URL base de la API")
    parser.add_argument(
        "--intro-seconds", type=float, default=2.5,
        help="tiempo de audio que se representa en la portada",
    )
    parser.add_argument(
        "--background-seconds", type=float, default=None,
        help="tiempo para el video de fondo; por defecto usa el tiempo del audio",
    )
    args = parser.parse_args()

    entries = []
    for template_id, _entry in list_template_catalog():
        asset_dir = get_template_asset_dir(template_id)
        index_path = get_template_paths(template_id)["index_html"]
        if (
            asset_dir is None
            or index_path is None
            or not asset_dir.resolve().is_relative_to(NODEMOTION_ROOT)
        ):
            continue
        entries.append((template_id, asset_dir, index_path))

    if args.template_ids:
        requested = set(args.template_ids)
        known = {template_id for template_id, _, _ in entries}
        missing = requested - known
        if missing:
            parser.error("IDs de plantilla desconocidos: " + ", ".join(sorted(missing)))
        entries = [entry for entry in entries if entry[0] in requested]

    created = skipped = failed = 0
    async with async_playwright() as playwright:
        launch_options = {"headless": True}
        if settings.playwright_chromium_executable_path:
            launch_options["executable_path"] = settings.playwright_chromium_executable_path
        browser = await playwright.chromium.launch(**launch_options)
        page = await browser.new_page(viewport=SHOWCASE_VIEWPORT, device_scale_factor=1)

        for index, (template_id, asset_dir, index_path) in enumerate(entries, start=1):
            destination = asset_dir / "card-poster.webp"
            is_current = (
                destination.exists()
                and destination.stat().st_mtime_ns >= index_path.stat().st_mtime_ns
            )
            if is_current and not args.force:
                skipped += 1
                print(f"[{index}/{len(entries)}] existente  {template_id}", flush=True)
                continue

            try:
                frame = await capture_template_intro(
                    page, template_id, index_path, asset_dir, args.base_url,
                    args.intro_seconds, args.background_seconds,
                )
                original_size = frame.size
                save_webp(frame, destination)
                size_kb = destination.stat().st_size / 1024
                print(
                    f"[{index}/{len(entries)}] intro  {template_id} → {destination.name} "
                    f"({original_size[0]}×{original_size[1]}, {size_kb:.1f} KB)",
                    flush=True,
                )
                created += 1
            except Exception as exc:
                failed += 1
                print(f"[{index}/{len(entries)}] error  {template_id}: {exc}", file=sys.stderr, flush=True)

        await browser.close()

    print(f"Listo: {created} portadas de intros; {skipped} omitidas; {failed} errores.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
