#!/usr/bin/env python3
"""Medidor de suavidad de cámara de una escena NodeAction (detecta tirones y golpes).

Muestrea la cámara a 30 cuadros/s y calcula velocidad, aceleración y "jerk" (cambio de la
aceleración) de x, y, z, zoom e inclinación. Un tirón visible = pico de aceleración/jerk.
Referencia medida (docs/investigaciones/nodeaction-escenas-de-accion-2026-10.md §8):
  cámara vieja: |a| máx 55 u/s², jerk p99 1545 → tirones;   cámara nueva: |a| máx < 8, jerk p99 < 30.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/nodeaction/tools/camcheck.py <carpeta-escena> [--limit-a 8] [--limit-jerk 40]
Sale con código 1 si algún eje supera los límites (y lista los segundos problemáticos).
"""
import argparse, asyncio, functools, http.server, json, pathlib, sys, threading

import numpy as np

HERE = pathlib.Path(__file__).resolve()
TEMPLATES = HERE.parents[3]


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass


async def samples(scene_dir):
    from playwright.async_api import async_playwright
    h = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=str(TEMPLATES)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{h.server_port}/{scene_dir.resolve().relative_to(TEMPLATES).as_posix()}/index.html?t=0"
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        await pg.goto(url)
        await pg.wait_for_function("window.__action", timeout=60000)
        data = await pg.evaluate("""(() => { const S = __action.S, out = [];
          for (let i = 0; i <= S.total * 30; i++) { const t = i / 30, c = S.camAt(t); out.push([t, c.x, c.y, c.z, c.zoom, c.pitch || 0, c.yaw || 0]); }
          return out; })()""")
        await b.close()
    h.shutdown()
    return np.array(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--limit-a", type=float, default=8.0)
    ap.add_argument("--limit-jerk", type=float, default=40.0)
    a = ap.parse_args()
    scene = pathlib.Path(a.scene)
    if not (scene / "index.html").exists():
        scene = HERE.parents[1] / a.scene
    d = asyncio.run(samples(scene))
    t = d[:, 0]
    bad = False
    for k, ax in ((1, "x"), (2, "y"), (3, "z"), (4, "zoom"), (5, "pitch"), (6, "yaw")):
        v = np.gradient(d[:, k], t); acc = np.gradient(v, t); j = np.gradient(acc, t)
        amax, jp = abs(acc).max(), np.percentile(abs(j), 99)
        flag = amax > a.limit_a or jp > a.limit_jerk
        bad |= flag
        print(f"{'✗' if flag else '✓'} {ax:>5}: |v| máx {abs(v).max():6.2f} · |a| máx {amax:6.2f} · jerk p99 {jp:7.2f}")
        if flag:
            where = t[abs(acc) > a.limit_a]
            print("        segundos con aceleración alta:", sorted({round(float(x), 1) for x in where})[:20])
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
