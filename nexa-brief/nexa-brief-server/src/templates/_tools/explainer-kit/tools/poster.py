#!/usr/bin/env python3
"""poster.py · portada (miniatura) de uno o varios videos: un cuadro 16:9 en render/poster.jpg.

La app la muestra en la tarjeta del video (/plantillas) en vez de cargar el motor en vivo;
el motor solo se carga al pasar el mouse o al abrir el modal.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/poster.py <video-id> [<video-id> …] [--t 6]
  .venv/bin/python src/templates/_tools/explainer-kit/tools/poster.py --all      # todos los que no tienen portada
"""
import argparse, asyncio, io, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from places import TEMPLATES, find_video, folders  # noqa: E402
from shoot import serve  # noqa: E402

from PIL import Image  # noqa: E402
import os

# En Docker se usa el Chromium del sistema (PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
# fuera de Docker, el que instala `playwright install chromium`.
CHROMIUM = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None

W, H = 960, 540


async def posters(video_dirs, t):
    from playwright.async_api import async_playwright
    srv = serve(TEMPLATES)
    base = f"http://127.0.0.1:{srv.server_port}"
    done = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROMIUM, args=["--autoplay-policy=no-user-gesture-required"])
        for d in video_dirs:
            pg = await b.new_page(viewport={"width": W, "height": H})
            rel = d.relative_to(TEMPLATES).as_posix()
            try:
                await pg.goto(f"{base}/{rel}/index.html?paused", wait_until="domcontentloaded", timeout=120000)
                await pg.wait_for_function("window.__promo", timeout=90000)
                # por defecto: el primer plano principal (el título) ya armado, como kit.py sheet
                at = t if t is not None else await pg.evaluate(
                    "(() => { const b = window.__promo.beats.find(b => b.layer === 'main');"
                    " return b ? +(b.t0 + Math.min(2.4, b.dur * 0.7)).toFixed(2) : 3; })()")
                await pg.evaluate(f"window.__promo.seek({at})")
                png = await pg.screenshot(type="png")
                out = d / "render" / "poster.jpg"
                out.parent.mkdir(exist_ok=True)
                Image.open(io.BytesIO(png)).convert("RGB").save(out, quality=82)
                done.append(out)
                print(f"✓ {out.relative_to(TEMPLATES)}", flush=True)
            except Exception as e:  # un video roto no frena a los demás
                print(f"✗ {rel}: {e}", flush=True)
            await pg.close()
        await b.close()
    srv.shutdown()
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true", help="todos los videos sin render/poster.jpg")
    ap.add_argument("--force", action="store_true", help="con --all: rehacer también las que ya existen")
    ap.add_argument("--t", type=float, default=None, help="segundo del cuadro (por defecto: el título armado)")
    a = ap.parse_args()
    if a.all:
        dirs = [d for f in folders() if (TEMPLATES / f).exists() for d in sorted((TEMPLATES / f).iterdir())
                if (d / "index.html").exists() and (a.force or not (d / "render" / "poster.jpg").exists())]
    else:
        dirs = [find_video(i) or sys.exit(f"no existe el video {i}") for i in a.ids]
    if not dirs:
        print("nada que hacer")
        return
    ok = asyncio.run(posters(dirs, a.t))
    sys.exit(0 if len(ok) == len(dirs) else 1)


if __name__ == "__main__":
    main()
