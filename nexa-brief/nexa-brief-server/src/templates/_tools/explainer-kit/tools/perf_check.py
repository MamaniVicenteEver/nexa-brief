#!/usr/bin/env python3
"""Mide la FLUIDEZ de la reproducción real de un video del explainer-kit (tirones de cámara y pausas).

Abre el video en Chromium headless con el audio sonando (reloj real, requestAnimationFrame) y registra por fotograma el
tiempo que usa el motor y cuánto tarda en dibujar. Informa:
  · uniformidad del tiempo: velocidad con que avanza el tiempo del motor de un cuadro a otro (1,00 = continuo; la desviación
    es lo que el ojo ve como tirón en los zooms y vuelos lentos);
  · pausas: cuadros que tardan más de 60 ms y en qué segundo del audio ocurren.

Uso (desde nexa-brief-server/, con el Python del proyecto):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/perf_check.py <url-del-index.html> [--secs 60] [--size 1280x720]
      [--orig DIR]        compara contra el motor ORIGINAL: DIR debe tener kit.js.orig y _imperio.js.orig (copias previas a un cambio)
      [--json salida.json]

Ejemplo:
  .venv/bin/python src/templates/_tools/explainer-kit/tools/perf_check.py \
      http://127.0.0.1:8000/api/v1/explainer/files/sandbox/nodepolitics/imperio-demo/index.html --secs 60

Ojo: en un servidor SIN GPU (headless con render por software) los tiempos de dibujo son mucho mayores que en un equipo
con GPU; sirven para comparar antes/después, no como cifra absoluta. Requiere el motor con el gancho `window.__kitTrace`
(engine/kit.js); sin él, usa audio.currentTime como reloj (que es lo que hacía el motor anterior).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics as st

from playwright.async_api import async_playwright

INIT = """
(() => { window.__fr = []; window.__kitTrace = []; const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const a = performance.now(); cb(ts); const d = performance.now() - a;
    const au = document.getElementById('audio'); window.__fr.push([a, d, au ? au.currentTime : -1, au && au.paused ? 1 : 0]); }); })();
"""


async def capture(url: str, secs: float, size: tuple[int, int], orig: str | None) -> dict:
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None,
                                    args=["--autoplay-policy=no-user-gesture-required"])
        page = await (await b.new_context(viewport={"width": size[0], "height": size[1]})).new_page()
        await page.add_init_script(INIT)
        if orig:
            async def serve(route, name):
                await route.fulfill(status=200, content_type="application/javascript", body=open(os.path.join(orig, name)).read())
            await page.route("**/engine/kit.js*", lambda r: serve(r, "kit.js.orig"))
            await page.route("**/components/_imperio.js*", lambda r: serve(r, "_imperio.js.orig"))
        await page.goto(url)
        await page.wait_for_function("window.__promo && window.__promo.beats", timeout=180000)
        await page.wait_for_timeout(int(secs * 1000))
        data = {"fr": await page.evaluate("window.__fr"), "trace": await page.evaluate("window.__kitTrace")}
        await b.close()
    return data


def pct(a, q):
    a = sorted(a)
    return a[min(len(a) - 1, int(len(a) * q))]


def report(data: dict, label: str) -> dict:
    tr = [x for x in data["trace"] if x[1] > 0.5]
    if not tr:  # motor anterior: el tiempo de dibujo era audio.currentTime
        g = {round(a, 2): au for a, d, au, pa in data["fr"] if pa == 0 and au > 0.5}
        tr = [[k, v, v] for k, v in sorted(g.items())]
    dn = [b[0] - a[0] for a, b in zip(tr, tr[1:])]
    da = [(b[1] - a[1]) * 1000 for a, b in zip(tr, tr[1:])]
    v = [x / y for x, y in zip(da, dn) if 8 < y < 100]
    long_ = [(round(au, 1), round(d)) for a, d, au, pa in data["fr"] if d > 60]
    out = {"desv_tiempo": round(st.pstdev(v), 3), "fuera_0.6_1.5_pct": round(100 * sum(1 for x in v if x < 0.6 or x > 1.5) / len(v), 1),
           "pausas_gt60": len(long_), "pausas_gt100": sum(1 for _, d in long_ if d > 100), "pausa_max_ms": max([d for _, d in long_] or [0]),
           "pausas": long_[:20]}
    print(f"{label:9s} | tiempo del motor: desv. típica {out['desv_tiempo']:.2f} (ideal 0) · fuera de 0.6–1.5×: {out['fuera_0.6_1.5_pct']:4.1f} %"
          f" | cuadros > 60 ms: {out['pausas_gt60']:2d} (> 100 ms: {out['pausas_gt100']:2d}) · peor {out['pausa_max_ms']} ms")
    if long_:
        print("          pausas (segundo de audio, ms):", long_[:12])
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url")
    ap.add_argument("--secs", type=float, default=60)
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--orig", default="")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    size = tuple(int(x) for x in a.size.split("x"))
    res = {}
    if a.orig:
        res["original"] = report(asyncio.run(capture(a.url, a.secs, size, a.orig)), "ORIGINAL")
    res["actual"] = report(asyncio.run(capture(a.url, a.secs, size, None)), "ACTUAL")
    if a.json:
        json.dump(res, open(a.json, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
