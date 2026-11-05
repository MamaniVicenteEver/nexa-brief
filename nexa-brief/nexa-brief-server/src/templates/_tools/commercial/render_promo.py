#!/usr/bin/env python3
"""Render CUADRO A CUADRO de una plantilla promo-* → mp4 fluido con audio.

Por qué: grabar en tiempo real (Playwright) depende de cuántos fps logre el
navegador; en Chrome headless sin GPU, componer video + texto + grano a 1080p
da 10–40 fps según la escena → el video grabado sale entrecortado. Estas
plantillas son deterministas y buscables (window.__promo.seek(t) posiciona
todas las animaciones y espera a que cada <video> llegue a su cuadro), así que
se captura cada instante exacto y ffmpeg arma el mp4 a fps constantes. Tarda
más que tiempo real, pero el resultado no depende de la potencia del equipo.

Uso (rutas de página relativas a src/templates/):
  python3 _tools/commercial/render_promo.py nodemotion/commercial/promo-trendy/index.html out.mp4
  python3 _tools/commercial/render_promo.py nodemotion/lyrics/lyrics-grunge/index.html out.mp4 [--fps 30] [--size 1920x1080] [--from 0] [--to END] [--workers 3]
Requiere: playwright (chromium) y ffmpeg. Levanta su propio servidor HTTP.
"""
import argparse, asyncio, functools, http.server, json, pathlib, subprocess, threading
import os
import sys
import signal

# En Docker se usa el Chromium del sistema (PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
# fuera de Docker, el que instala `playwright install chromium`.
CHROMIUM = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None

HERE = pathlib.Path(__file__).resolve().parents[2]   # src/templates/

sys.path.insert(0, str(HERE / "_tools"))
from http_media import MediaRequestHandler as _Quiet
sys.path.insert(0, str(HERE.parent.parent))
from src.adapters.recorder.infrastructure.render_workspace import render_workspace

def serve(root):
    handler = functools.partial(_Quiet, directory=str(root))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

async def worker(b, url, W, H, frames, fps, t0, outdir, tag, progress, progress_lock, total_frames):
    pg = await b.new_page(viewport={"width": W, "height": H})
    await pg.goto(url)
    await pg.wait_for_function("window.__promo && window.__promo.scenes().length > 0", timeout=60000)
    for n, i in enumerate(frames):
        t = t0 + i / fps
        await pg.evaluate(f"window.__promo.seek({t:.5f})")
        (outdir / f"{i:06d}.jpg").write_bytes(await pg.screenshot(type="jpeg", quality=92))
        async with progress_lock:
            progress["done"] += 1
            now = asyncio.get_running_loop().time()
            if now - progress["last_emit"] >= 1 or progress["done"] == total_frames:
                print(f"@@progress {progress['done']} {total_frames}", flush=True)
                progress["last_emit"] = now
        if n % (fps * 3) == 0: print(f"  [{tag}] {t:6.2f}s", flush=True)
    await pg.close()

async def render(args):
    from playwright.async_api import async_playwright
    W, H = map(int, args.size.lower().split("x"))
    output = pathlib.Path(args.out).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    page = pathlib.Path(args.page)
    folder = HERE / page.parent
    cands = [folder / "assets" / (page.stem + ".config.json"), folder / "assets" / "config.json"]
    cfg_file = next(c for c in cands if c.exists())
    cfg = json.loads(cfg_file.read_text())["configs"][0]
    httpd = serve(HERE)
    try:
        url = f"http://127.0.0.1:{httpd.server_address[1]}/{args.page}?t=0&headless=1"
        with render_workspace(output.parent, "promo") as outdir:
            async with async_playwright() as p:
                browser = await p.chromium.launch(executable_path=CHROMIUM)
                tasks = []
                try:
                    probe = await browser.new_page()
                    try:
                        await probe.goto(url)
                        await probe.wait_for_function("window.__promo && window.__promo.scenes().length > 0", timeout=60000)
                        end = await probe.evaluate("(() => { const s = window.__promo.scenes(); return s[s.length - 1].t1; })()")
                    finally:
                        await probe.close()
                    t_end = args.to if args.to is not None else end
                    n = int(round((t_end - args.frm) * args.fps))
                    if n <= 0:
                        raise ValueError("El render debe contener al menos un cuadro")
                    k = max(1, args.workers)
                    progress = {"done": 0, "last_emit": 0.0}
                    progress_lock = asyncio.Lock()
                    tasks = [asyncio.create_task(worker(
                        browser, url, W, H, range(j, n, k), args.fps, args.frm,
                        outdir, f"w{j}", progress, progress_lock, n)) for j in range(k)]
                    await asyncio.gather(*tasks)
                finally:
                    for task in tasks:
                        if not task.done(): task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    await browser.close()
            print("@@phase encode", flush=True)
            staged = outdir / "complete.mp4"
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-v", "error", "-framerate", str(args.fps), "-i", str(outdir / "%06d.jpg"),
                "-ss", str(args.frm), "-t", str(t_end - args.frm), "-i", str(folder / cfg["audio"]["src"]),
                "-map", "0:v", "-map", "1:a", "-vf", "scale=out_range=tv,format=yuv420p",
                "-c:v", "libx264", "-preset", args.preset, "-crf", "23", "-maxrate", "6M", "-bufsize", "12M",
                "-pix_fmt", "yuv420p", "-color_range", "tv",
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
                "-shortest", "-movflags", "+faststart", str(staged))
            try:
                code = await proc.wait()
            finally:
                if proc.returncode is None:
                    proc.kill()
                    await proc.wait()
            if code != 0 or not staged.is_file() or staged.stat().st_size == 0:
                raise RuntimeError(f"Falló ffmpeg ({code}); se conserva el video anterior")
            os.replace(staged, output)
    finally:
        httpd.shutdown()
        httpd.server_close()
    print("listo:", args.out)


async def render_with_signals(args):
    task = asyncio.current_task()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, task.cancel)
    try:
        await render(args)
    finally:
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.remove_signal_handler(sig)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("page"); ap.add_argument("out")
    # veryfast: benchmark 2026-10-11 → ~38% menos tiempo de codificación que medium,
    # misma calidad a la vista (SSIM 0,9987 vs 0,9991) y archivo algo más chico.
    ap.add_argument("--preset", default="veryfast")
    ap.add_argument("--fps", type=int, default=30); ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--from", dest="frm", type=float, default=0.0); ap.add_argument("--to", type=float, default=None)
    ap.add_argument("--workers", type=int, default=3)
    asyncio.run(render_with_signals(ap.parse_args()))
