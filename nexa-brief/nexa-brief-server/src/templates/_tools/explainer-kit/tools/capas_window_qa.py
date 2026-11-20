#!/usr/bin/env python3
"""Recorre 60 escenas distintas y una demo existente sin editar sus datos.

El HTTP aislado resuelve medios sintéticos en memoria y, con --baseline, sirve
los tres archivos originales desde Git. No inicia ni reinicia la API.
"""
import argparse
import asyncio
from functools import partial
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import threading
import time
from urllib.parse import unquote, urlsplit

from playwright.async_api import async_playwright

from capas_qa import KIT, idle, memory, processes

REPO = KIT.parents[4]
TEMPLATES = KIT.parents[1]


def summary(values):
    return {"mean": statistics.mean(values), "median": statistics.median(values),
            "p95": sorted(values)[int(len(values) * .95)], "max": max(values)}


def host_memory():
    values = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
    vm = dict(line.split() for line in Path("/proc/vmstat").read_text().splitlines())
    return {**{key: int(values[key].split()[0]) for key in ["MemAvailable", "SwapFree", "SwapTotal"]},
            **{key: int(vm[key]) for key in ["pswpin", "pswpout"]}}


class Handler(http.server.SimpleHTTPRequestHandler):
    baseline = {}
    demo = None

    def log_message(self, *args):
        pass

    def translate_path(self, path):
        path = unquote(urlsplit(path).path)
        stress = re.fullmatch(r"/_tools/explainer-kit/capas/tests/fixtures/stress/scene-\d+/(original(?:\.(?:cuerpo|corbata))?\.png)", path)
        if stress:
            return str(KIT / "capas/tests/fixtures/assets/ejecutivo" / stress[1])
        if self.demo and path.startswith("/sandbox/nodeeconomy/titanes-ibm/"):
            target = (self.demo / path.removeprefix("/sandbox/nodeeconomy/titanes-ibm/")).resolve()
            if target.is_relative_to(self.demo):
                return str(target)
        return super().translate_path(path)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in self.baseline:
            body = self.baseline[path]
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


async def sample(page, cdp, label):
    rows = await processes(cdp)
    return {"label": label, "heap": await memory(page), "processes": rows,
            "rss_kib": sum(row["rss_kib"] or 0 for row in rows),
            "cpu_seconds": sum(row["cpu_seconds"] for row in rows),
            "cache": await page.evaluate("Kit.capas.stats?.() || null"), "host": host_memory()}


async def stress(browser, cdp, base, output, baseline, name, size, passes):
    context = await browser.new_context(viewport={"width": size[0], "height": size[1]}, device_scale_factor=1)
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    session = await context.new_cdp_session(page)
    try:
        start = time.monotonic()
        await page.goto(base + "/_tools/explainer-kit/capas/tests/window.html?t=0")
        await page.evaluate("qaReady")
        result = {"startup_ms": (time.monotonic() - start) * 1000, "samples": [], "passes": passes}
        result["idle_before"] = await idle(cdp)
        result["samples"].append(await sample(page, cdp, "initial"))
        await page.evaluate("__promo.seek(1.5)")
        result["reference_frame_sha256"] = hashlib.sha256((await page.locator(".k-main").evaluate("c=>c.toDataURL()")).encode()).hexdigest()
        result["warm_frame_ms"] = summary(await page.evaluate("""() => {
          const inst=[...qa.instances][0], times=[];
          for(let i=0;i<150;i++){const start=performance.now();inst.render(.1+2.8*i/149);times.push(performance.now()-start);}
          return times;
        }"""))
        elapsed = []
        for sweep in range(passes):
            for i in range(60):
                elapsed.append(await page.evaluate("""async t => {
                  const start=performance.now();await __promo.seek(t);return performance.now()-start;
                }""", i * 4 + 1.5))
                if i % 10 == 9:
                    item = await sample(page, cdp, f"pass-{sweep+1}-scene-{i+1}")
                    # Se conservan RSS/heap previos al GC y se mide también el heap vivo.
                    await session.send("HeapProfiler.collectGarbage")
                    item["heap_after_gc"] = await memory(page)
                    result["samples"].append(item)
        result["seek_ms"] = summary(elapsed)
        result["draw_ms"] = summary(await page.evaluate("qa.draw"))
        result["valid_draw_ms"] = summary(await page.evaluate("qa.validDraw"))
        result["budget_errors"] = await page.evaluate("qa.errors")
        result["created"] = await page.evaluate("qa.created")
        if baseline:
            assert any("presupuesto" in error for error in result["budget_errors"]), "El control debe reproducir el fallo anterior"
        else:
            assert not result["budget_errors"], result["budget_errors"]
            for item in result["samples"]:
                assert item["cache"]["mediaBytes"] <= 54 * 1024 * 1024, item
                assert item["cache"]["scenes"] <= 3, item
            hashes = {}
            for i in [0, 1, 17, 37, 59]:
                await page.evaluate("t=>__promo.seek(t)", i*4+1.5)
                hashes[i] = await page.locator(".k-main").evaluate("c=>c.toDataURL()")
            for i in [37, 0, 59, 1, 17, 0, 37, 17, 59]:
                await page.evaluate("t=>__promo.seek(t)", i*4+1.5)
                assert await page.locator(".k-main").evaluate("c=>c.toDataURL()") == hashes[i], f"Seek no determinista: {i}"
            result["unordered_seek_equal_pixels"] = True
            await page.screenshot(path=output / f"60-scenes-{name}.png")
            await page.evaluate("__promo.dispose()")
            result["after_dispose"] = await sample(page, cdp, "disposed")
            assert result["after_dispose"]["cache"]["mediaBytes"] == 0
            assert result["after_dispose"]["cache"]["instances"] == 0
            assert await page.evaluate("[...qa.instances].every(i=>!i.stats || i.stats().surfaces===0)")
            assert await page.evaluate("qa.disposedSurfaces.every(n=>n===0)")
            result["idle_after_dispose"] = await idle(cdp)
        assert not errors, errors
        result["console_errors"] = errors
        return result
    finally:
        await session.detach()
        await context.close()


async def demo_check(browser, cdp, base, output, demo):
    protected = [demo / "assets/storyboard.json", demo / "assets/config.json"]
    hashes = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in protected}
    result = {"protected_hashes_before": hashes, "formats": {}}
    for name, size in [("16x9", (1280, 720)), ("9x16", (720, 1280))]:
        context = await browser.new_context(viewport={"width": size[0], "height": size[1]})
        page = await context.new_page()
        errors = []
        await page.add_init_script("""window.capasCards=[];
          const original=CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText=function(text,...args){
            if(String(text).includes('ESCENA DE CAPAS INVÁLIDA')) capasCards.push(String(text));
            return original.call(this,text,...args);
          };""")
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            await page.goto(base + "/sandbox/nodeeconomy/titanes-ibm/index.html?controls=1&paused=1")
            await page.evaluate("KitReady")
            assert await page.evaluate("__promo.beats.length") == 183
            frames = await page.evaluate("""async () => {
              const frames=[];
              for(const beat of __promo.beats){
                const t=beat.t0+Math.min(.7,(beat.t1-beat.t0)/2), start=performance.now();
                await __promo.seek(t);
                frames.push({i:beat.i,use:beat.use,t,ms:performance.now()-start,cache:Kit.capas.stats()});
              }
              return frames;
            }""")
            assert not await page.evaluate("capasCards"), "Tarjetas de error en demo"
            assert not errors, errors
            # Dos escenas de capas distantes, recuperación tras seek y cambio de formato.
            layer_frames = [frame for frame in frames if frame["use"] == "common.capas"]
            for frame in layer_frames[:1] + layer_frames[-1:]:
                await page.evaluate("t=>__promo.seek(t)", frame["t"])
                first = await page.locator(".k-main").evaluate("c=>c.toDataURL()")
                await page.evaluate("__promo.seek(0)")
                await page.evaluate("t=>__promo.seek(t)", frame["t"])
                assert first == await page.locator(".k-main").evaluate("c=>c.toDataURL()")
            await page.screenshot(path=output / f"ibm-{name}.png")
            result["formats"][name] = {"beats": len(frames), "capas_beats": len(layer_frames), "frames": frames,
                                         "seek_ms": summary([frame["ms"] for frame in frames]), "error_cards": 0,
                                         "console_errors": errors, "memory": await sample(page, cdp, "demo-end")}
            await page.evaluate("__promo.dispose()")
        finally:
            await context.close()
    result["protected_hashes_after"] = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in protected}
    assert result["protected_hashes_before"] == result["protected_hashes_after"]
    return result


async def run(args, base):
    report = {"baseline": args.baseline, "host_before": host_memory(), "formats": {}}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None,
            args=["--disable-dev-shm-usage"])
        cdp = await browser.new_browser_cdp_session()
        ids = set()
        try:
            report["idle_browser"] = await idle(cdp)
            for name, size in [("16x9", (1280, 720)), ("9x16", (720, 1280))]:
                report["formats"][name] = await stress(browser, cdp, base, args.output, args.baseline, name, size, args.passes)
                report["formats"][name]["idle_after_close"] = await idle(cdp)
                (args.output / "metrics.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
                print(f"{name}: {args.passes} recorridos completos", flush=True)
            if args.demo:
                report["demo"] = await demo_check(browser, cdp, base, args.output, args.demo)
            ids = {row["pid"] for row in await processes(cdp)}
        finally:
            await cdp.detach()
            await browser.close()
        report["remaining_owned_pids"] = [pid for pid in ids if Path(f"/proc/{pid}").exists()]
    report["host_after"] = host_memory()
    (args.output / "metrics.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"baseline": args.baseline, "formats": {
        name: {key: data[key] for key in ["startup_ms", "draw_ms", "seek_ms"]}
        for name, data in report["formats"].items()}}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--passes", type=int, default=3)
    parser.add_argument("--demo", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.demo:
        args.demo = args.demo.resolve()
    Handler.demo = args.demo
    if args.baseline:
        for file in ["engine/kit.js", "capas/runtime/capas.js", "designs/common/capas.js"]:
            path = KIT / file
            Handler.baseline["/_tools/explainer-kit/" + file] = subprocess.check_output(
                ["git", "show", "HEAD:./" + str(path.relative_to(REPO))], cwd=REPO)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(TEMPLATES)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        asyncio.run(run(args, f"http://127.0.0.1:{server.server_port}"))
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()
