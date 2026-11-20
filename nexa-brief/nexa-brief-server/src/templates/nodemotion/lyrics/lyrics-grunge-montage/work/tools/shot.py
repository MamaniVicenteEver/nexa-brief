#!/usr/bin/env python3
"""Capturas de la replica en el navegador (Playwright local) y hoja lado a lado con la referencia.
Uso: shot.py OUT.jpg T1 T2 ...   (T en segundos de la REFERENCIA; se resta timeOffsetSec)"""
import asyncio, subprocess, sys, pathlib, tempfile, threading, http.server, socketserver, functools, json, os
from PIL import Image, ImageDraw, ImageFont
PROJ = pathlib.Path(__file__).resolve().parents[2]
REF = pathlib.Path(os.environ.get("REF_PROXY", "/tmp/claude-1000/-home-university-Documentos-Proyectos-nexa-brief/2eaa7984-42c1-4de7-9882-e389feb106ad/scratchpad/ref/proxy.mp4"))
OFF = 0.22
PORT = int(os.environ.get("PORT", 8765))
W, H = int(os.environ.get("SW", 640)), int(os.environ.get("SH", 360))
def serve(port):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(PROJ))
    class Q(h.func):
        def log_message(self, *a): pass
    h2 = functools.partial(Q, directory=str(PROJ))
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", port), h2); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv
async def main(out, times):
    from playwright.async_api import async_playwright
    srv = serve(PORT)
    tmp = pathlib.Path(tempfile.mkdtemp())
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 1280, "height": 720})
        msgs = []
        pg.on("console", lambda m: msgs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?headless=1&t=0", wait_until="load")
        await pg.wait_for_function("window.__promo", timeout=60000)
        for i, t in enumerate(times):
            await pg.evaluate(f"__promo.seek({max(0, t - OFF)})")
            await pg.wait_for_timeout(120)
            await pg.screenshot(path=str(tmp / f"m{i}.png"))
        await b.close()
    srv.shutdown()
    for m in dict.fromkeys(msgs): print(m[:300])
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    cols = int(os.environ.get("COLS", 1))
    cells = []
    for i, t in enumerate(times):
        rf = tmp / f"r{i}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(REF), "-frames:v", "1", "-vf", f"scale={W}:{H}", str(rf)], check=True)
        a = Image.open(rf).convert("RGB"); m = Image.open(tmp / f"m{i}.png").convert("RGB").resize((W, H))
        cell = Image.new("RGB", (W * 2 + 6, H), (255, 0, 255)); cell.paste(a, (0, 0)); cell.paste(m, (W + 6, 0))
        d = ImageDraw.Draw(cell); d.rectangle([0, 0, 70, 24], fill=(255, 255, 0)); d.text((4, 2), f"{t:.2f}", fill=(0, 0, 0), font=font)
        cells.append(cell)
    rows = (len(cells) + cols - 1) // cols
    cw, ch = cells[0].size
    sheet = Image.new("RGB", (cw * cols, ch * rows), (40, 40, 40))
    for i, c in enumerate(cells): sheet.paste(c, ((i % cols) * cw, (i // cols) * ch))
    sheet.save(out, quality=85); print("ok", out, sheet.size)
asyncio.run(main(sys.argv[1], [float(x) for x in sys.argv[2:]]))
