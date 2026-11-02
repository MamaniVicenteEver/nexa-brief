#!/usr/bin/env python3
"""Perfila la reproducción REAL (reloj de audio, requestAnimationFrame) de una plantilla del explainer-kit.

Uso: perfilar.py <url> <segundos> <salida.json> [--controls] [--size 1280x720] [--cpu N]
Registra por fotograma: marca de rAF, duración del render, audio.currentTime y si el audio está en pausa.
No modifica ningún archivo del proyecto.
"""
import argparse
import asyncio
import json
import os

from playwright.async_api import async_playwright

INIT = """
(() => {
  window.__prof = { frames: [], long: [], marks: [] }; window.__kitTrace = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => {
    const a = performance.now(); cb(ts); const d = performance.now() - a;
    const au = document.getElementById('audio');
    window.__prof.frames.push([ts, d, au ? au.currentTime : -1, au ? (au.paused ? 1 : 0) : -1]);
  });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__prof.long.push([e.startTime, e.duration]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
})();
"""


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url"); ap.add_argument("secs", type=float); ap.add_argument("out")
    ap.add_argument("--size", default="1280x720"); ap.add_argument("--controls", action="store_true"); ap.add_argument("--cpu", type=float, default=1)
    a = ap.parse_args()
    w, h = (int(x) for x in a.size.split("x"))
    chromium = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=chromium, args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
        page = await ctx.new_page()
        await page.add_init_script(INIT)
        msgs = []
        page.on("console", lambda m: msgs.append(m.text[:200]) if m.type in ("error", "warning") else None)
        if a.cpu > 1:
            cdp = await ctx.new_cdp_session(page)
            await cdp.send("Emulation.setCPUThrottlingRate", {"rate": a.cpu})
        url = a.url + ("&controls=1" if a.controls and "?" in a.url else ("?controls=1" if a.controls else ""))
        await page.goto(url)
        await page.wait_for_function("window.__promo && window.__promo.beats", timeout=120000)
        if a.controls:
            await page.evaluate("document.getElementById('audio').play().catch(()=>{})")
        await page.wait_for_timeout(int(a.secs * 1000))
        data = await page.evaluate("window.__prof"); data["trace"] = await page.evaluate("window.__kitTrace")
        data["console"] = msgs[:30]
        await b.close()
    json.dump(data, open(a.out, "w"))
    print("fotogramas", len(data["frames"]), "longtasks", len(data["long"]))


asyncio.run(main())
