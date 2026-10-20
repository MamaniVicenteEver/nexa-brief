#!/usr/bin/env python3
"""thumbnail.py · miniatura de YouTube a partir de la intro del diseño (<diseño>.introv1 / introv2).

La miniatura es una captura del componente de intro armado (no una imagen aparte): así lo que se
ve en el feed y lo que abre el video son lo mismo. Captura 1280×720 (lo que pide YouTube), JPEG.

Uso (desde nexa-brief-server/; lo llama el backend, src/core/explainer/thumbnails.py):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/thumbnail.py OUT.jpg \
      --design binary --component binary.introv2 --params '{"text": "…", "src": "/nodetech/<id>/assets/media/x.jpg"}' [--t 3]
Las imágenes del componente van con ruta absoluta desde src/templates/ ("/<carpeta>/<id>/assets/media/…").
"""
from __future__ import annotations

import argparse, asyncio, io, json, pathlib, sys, urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import shoot  # noqa: E402
from PIL import Image  # noqa: E402

KIT = pathlib.Path(__file__).resolve().parents[1]
W, H = 1280, 720
DUR = 6.0


# Control de calidad: desde el segundo pedido se prueban momentos cada 0,2 s hasta 1,2 s después y se
# toma el primero quieto (casi sin cambio en 0,1 s) y con contenido. Así una intro que todavía está
# escribiendo el texto o entrando (Periódico, Pop…) no queda a medio armar en la miniatura.
_STEP, _SPAN, _PROBE = 0.2, 1.2, 0.1
_STILL = 1.2          # cambio medio de brillo (0–255) por debajo del cual el cuadro está quieto
_MIN_CONTRAST = 6.0   # por debajo: cuadro casi liso (negro, fundido)


async def _gray(page, at: float) -> Image.Image:
    await page.evaluate(f"window.__promo.seek({at})")
    png = await page.screenshot(type="png")
    return Image.open(io.BytesIO(png)).convert("L").resize((160, 90))


async def stable_moment(page, t: float) -> float:
    from PIL import ImageChops, ImageStat

    best, best_motion = t, None
    k = 0
    while k * _STEP <= _SPAN + 1e-6 and t + k * _STEP + _PROBE < DUR:
        at = t + k * _STEP
        a, b = await _gray(page, at), await _gray(page, at + _PROBE)
        motion = ImageStat.Stat(ImageChops.difference(a, b)).mean[0]
        k += 1
        if ImageStat.Stat(a).stddev[0] < _MIN_CONTRAST:
            continue
        if motion < _STILL:
            return at
        if best_motion is None or motion < best_motion:
            best, best_motion = at, motion
    return best


async def capture(out: pathlib.Path, design: str, component: str, params: dict, t: float) -> list[str]:
    from playwright.async_api import async_playwright
    srv = shoot.serve(shoot.SANDBOX)
    q = {"d": design, "c": component, "p": json.dumps(params, ensure_ascii=False), "paused": "1", "dur": str(DUR), "solo": "1"}
    url = f"http://127.0.0.1:{srv.server_port}/{KIT.relative_to(shoot.SANDBOX).as_posix()}/showcase/stage.html?" + urllib.parse.urlencode(q)
    errors: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shoot.CHROMIUM)
        page = await browser.new_page(viewport={"width": W, "height": H})
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(url, wait_until="domcontentloaded", timeout=120000)
        await page.wait_for_function("window.__promo", timeout=60000)
        await page.evaluate("document.fonts.ready")
        chosen = await stable_moment(page, t)
        await page.evaluate(f"window.__promo.seek({chosen})")
        png = await page.screenshot(type="png")
        await browser.close()
    print(f"· cuadro elegido: {chosen:.2f} s (pedido {t:.2f} s)")
    srv.shutdown()
    out.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(io.BytesIO(png)).convert("RGB")
    image.save(out, "JPEG", quality=90, optimize=True)   # YouTube: ≤ 2 MB
    image.save(out.with_suffix(".webp"), "WEBP", quality=80, method=6)   # copia liviana para la web
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("out", type=pathlib.Path)
    ap.add_argument("--design", required=True)
    ap.add_argument("--component", required=True)
    ap.add_argument("--params", default="{}")
    # 4,5 s: las intros con sello o texto tipeado (acuarela, periódico…) terminan de revelarse después de los 3 s
    ap.add_argument("--t", type=float, default=4.5, help="segundo del componente (ya armado)")
    a = ap.parse_args()
    errors = asyncio.run(capture(a.out, a.design, a.component, json.loads(a.params), a.t))
    for e in errors:
        print(f"⚠ {e[:300]}", file=sys.stderr)
    print(f"✓ {a.out} ({W}×{H})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
