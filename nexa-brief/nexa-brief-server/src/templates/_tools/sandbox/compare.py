#!/usr/bin/env python3
"""Compara cuadros de un prototipo con los de un MP4 de referencia.

Uso (desde nexa-brief-server/):
  python src/templates/_tools/sandbox/compare.py nodehistory/mi-idea \
      --ref src/templates/sandbox/referencias/nodehistory/idea/video.mp4
  --times auto elige instantes repartidos por el video; también acepta 2,5,8.2.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import functools
import http.server
import json
import math
import os
import shutil
import socket
import subprocess
import sys
import threading
import urllib.parse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TOOL_DIR = Path(__file__).resolve().parent
TEMPLATES_ROOT = TOOL_DIR.parents[1]
SANDBOX_ROOT = TEMPLATES_ROOT / "sandbox"
SERVER_ROOT = TOOL_DIR.parents[3]
sys.path.insert(0, str(SERVER_ROOT))


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Servidor estático efímero sin una línea de log por archivo."""

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


@contextlib.contextmanager
def serve_templates():
    """Sirve templates por HTTP para que fetch() y rutas relativas funcionen."""
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    handler = functools.partial(_QuietHandler, directory=str(TEMPLATES_ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def auto_times(duration: float, max_count: int = 6) -> list[float]:
    """Calcula instantes automáticos repartidos por el MP4.

    Ejemplo: auto_times(10) devuelve tres instantes y no captura en el borde.
    """
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("La duración debe ser un número positivo")
    if max_count < 1:
        raise ValueError("max_count debe ser al menos 1")
    count = min(max_count, max(3, math.ceil(duration / 12)))
    if count == 1:
        return [round(duration / 2, 2)]
    margin = min(1.0, duration * 0.05)
    start, end = margin, max(margin, duration - margin)
    if count == 1 or abs(end - start) < 0.01:
        return [round(duration / 2, 2)]
    return [round(start + (end - start) * index / (count - 1), 2) for index in range(count)]


def _safe_item(value: str) -> Path:
    """Resuelve category/id dentro del sandbox sin permitir traversal."""
    parts = Path(value).parts
    if len(parts) != 2 or any(part in {"", ".", ".."} or part.startswith(".") for part in parts):
        raise ValueError("Usá el formato visible <categoría>/<id>")
    if "\\" in value or Path(value).is_absolute():
        raise ValueError("La ruta debe ser relativa a sandbox/")
    path = (SANDBOX_ROOT / parts[0] / parts[1]).resolve()
    if not path.is_relative_to(SANDBOX_ROOT.resolve()):
        raise ValueError("La plantilla debe permanecer dentro de sandbox/")
    if not (path / "index.html").is_file():
        raise FileNotFoundError(f"No existe index.html para {value}")
    return path


def _duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise RuntimeError((result.stderr or "ffprobe falló").strip())
    return float(json.loads(result.stdout)["format"]["duration"])


def _reference_frame(path: Path, second: float) -> Image.Image:
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{second:.3f}",
            "-i", str(path), "-frames:v", "1", "-vf", "scale=600:-2",
            "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1",
        ], capture_output=True, check=False,
    )
    if result.returncode or not result.stdout:
        raise RuntimeError((result.stderr.decode("utf-8", "replace") or "No pude extraer cuadro de referencia")[-1200:])
    from io import BytesIO
    return Image.open(BytesIO(result.stdout)).convert("RGB")


def _font(size: int) -> ImageFont.ImageFont:
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(path, size) if path.is_file() else ImageFont.load_default()


def _comparison_sheet(rows: list[tuple[float, Image.Image, Image.Image]]) -> Image.Image:
    """Compone cada instante con referencia a la izquierda y prototipo a la derecha."""
    cell_w, cell_h, heading, gap, margin = 600, 360, 38, 10, 12
    sheet = Image.new(
        "RGB", (margin * 2 + cell_w * 2 + gap, margin * 2 + len(rows) * (cell_h + heading) + max(0, len(rows) - 1) * gap),
        (20, 23, 27),
    )
    draw = ImageDraw.Draw(sheet)
    font = _font(19)
    for index, (second, reference, prototype) in enumerate(rows):
        y = margin + index * (cell_h + heading + gap)
        for column, (label, frame) in enumerate((("Referencia", reference), ("Prototipo", prototype))):
            x = margin + column * (cell_w + gap)
            draw.rectangle((x, y, x + cell_w - 1, y + heading - 1), fill=(43, 51, 60))
            draw.text((x + 10, y + 8), f"{label} · t={second:.2f}s", fill="white", font=font)
            thumb = frame.convert("RGB").copy()
            thumb.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
            tx = x + (cell_w - thumb.width) // 2
            ty = y + heading + (cell_h - thumb.height) // 2
            sheet.paste(thumb, (tx, ty))
    return sheet


def _chromium_path() -> str | None:
    """Usa el ejecutable configurado para el recorder o Playwright local."""
    value = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
    if value:
        return value
    try:
        from src.config.settings import settings
        return settings.playwright_chromium_executable_path or None
    except Exception:
        return None


async def _capture_template(item: Path, times: list[float]) -> tuple[list[Image.Image], list[str]]:
    from playwright.async_api import async_playwright

    errors: list[str] = []
    shots: list[Image.Image] = []
    with serve_templates() as base:
        route = item.relative_to(TEMPLATES_ROOT).as_posix() + "/index.html"
        async with async_playwright() as playwright:
            options = {"args": ["--autoplay-policy=no-user-gesture-required", "--disable-web-security", "--no-sandbox"]}
            chromium = _chromium_path()
            if chromium:
                options["executable_path"] = chromium
            browser = await playwright.chromium.launch(**options)
            try:
                page = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
                page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
                page.on("console", lambda message: errors.append(f"console: {message.text}") if message.type == "error" else None)
                for second in times:
                    query = urllib.parse.urlencode({"controls": "1", "t": f"{second:.3f}"})
                    await page.goto(f"{base}/{route}?{query}", wait_until="domcontentloaded", timeout=45000)
                    # El bridge escucha el protocolo del reproductor; ?t también cubre motores simples.
                    await page.evaluate(
                        """t => {
                          window.postMessage({type: 'nexa-template-seek', time: t}, '*');
                          if (window.__promo && typeof window.__promo.seek === 'function') window.__promo.seek(t);
                        }""",
                        second,
                    )
                    await page.wait_for_timeout(180)
                    from io import BytesIO
                    shots.append(Image.open(BytesIO(await page.screenshot(type="png"))).convert("RGB"))
                await page.close()
            finally:
                await browser.close()
    return shots, errors


def compare(item_arg: str, reference: Path, times_arg: str = "auto", out: Path | None = None) -> Path:
    """Captura y guarda compare.jpg/compare.json para un prototipo y referencia."""
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("Se necesitan ffmpeg y ffprobe en PATH")
    item = _safe_item(item_arg)
    reference = reference.expanduser().resolve()
    if not reference.is_file() or reference.suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}:
        raise ValueError("--ref debe ser un archivo de video existente")
    duration = _duration(reference)
    if times_arg == "auto":
        times = auto_times(duration)
    else:
        try:
            times = sorted({float(part.strip()) for part in times_arg.split(",")})
        except ValueError as error:
            raise ValueError("--times acepta auto o segundos separados por coma") from error
        if not times or any(not math.isfinite(value) or value < 0 or value >= duration for value in times):
            raise ValueError(f"Los tiempos deben estar entre 0 y {duration:.2f} s")
    out_dir = (out or (item / "work" / "compare")).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    prototype_images, page_errors = asyncio.run(_capture_template(item, times))
    rows = [
        (second, _reference_frame(reference, second), prototype)
        for second, prototype in zip(times, prototype_images)
    ]
    image = _comparison_sheet(rows)
    image.save(out_dir / "compare.jpg", quality=90)
    payload = {
        "prototype": item.relative_to(SANDBOX_ROOT).as_posix(),
        "reference": str(reference), "reference_duration": round(duration, 3),
        "times": times, "viewport": {"width": 1280, "height": 720},
        "page_errors": page_errors,
    }
    (out_dir / "compare.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out_dir / "compare.jpg"


def main(argv: list[str] | None = None) -> int:
    """Interfaz CLI de la comparación visual."""
    parser = argparse.ArgumentParser(description="Comparar un prototipo con cuadros de referencia.")
    parser.add_argument("prototype", help="<categoría>/<id>")
    parser.add_argument("--ref", required=True, type=Path, help="Archivo mp4 de referencia")
    parser.add_argument("--times", default="auto", help="auto o segundos separados por coma")
    parser.add_argument("--out", type=Path, help="Carpeta de salida (por defecto work/compare)")
    args = parser.parse_args(argv)
    try:
        result = compare(args.prototype, args.ref, args.times, args.out)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(f"Comparación lista: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
