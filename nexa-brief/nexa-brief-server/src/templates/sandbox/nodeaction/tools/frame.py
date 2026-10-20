#!/usr/bin/env python3
"""Un cuadro de una escena NodeAction a tamaño completo (para revisar detalles de cerca).

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/nodeaction/tools/frame.py <escena> <t> [<t> …] [--orient 16x9|9x16]
        [--crop x,y,w,h] (en píxeles del cuadro 1920×1080 / 1080×1920) [--out carpeta]
Deja <escena>/work/frame-<t>.png (o en --out).
"""
import argparse, asyncio, functools, http.server, pathlib, threading

HERE = pathlib.Path(__file__).resolve()
TEMPLATES = HERE.parents[3]
SIZE = {"16x9": (1920, 1080), "9x16": (1080, 1920)}


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass


async def run(scene, times, orient, crop, out):
    from playwright.async_api import async_playwright
    h = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=str(TEMPLATES)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    W, H = SIZE[orient]
    url = f"http://127.0.0.1:{h.server_port}/{scene.resolve().relative_to(TEMPLATES).as_posix()}/index.html?paused"
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": W, "height": H})
        await pg.goto(url)
        await pg.wait_for_function("window.__promo && window.__action", timeout=60000)
        for t in times:
            await pg.evaluate(f"window.__promo.seek({t})")
            kw = {"path": str(out / f"frame-{t:g}{'-' + orient if orient != '16x9' else ''}.png")}
            if crop:
                x, y, w, hh = crop
                kw["clip"] = {"x": x, "y": y, "width": w, "height": hh}
            await pg.screenshot(**kw)
            print("→", kw["path"])
        await b.close()
    h.shutdown()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene"); ap.add_argument("times", nargs="+", type=float)
    ap.add_argument("--orient", default="16x9"); ap.add_argument("--crop", default=""); ap.add_argument("--out", default="")
    a = ap.parse_args()
    scene = pathlib.Path(a.scene)
    if not (scene / "index.html").exists():
        scene = HERE.parents[1] / a.scene
    out = pathlib.Path(a.out) if a.out else scene / "work"
    out.mkdir(parents=True, exist_ok=True)
    crop = [int(v) for v in a.crop.split(",")] if a.crop else None
    asyncio.run(run(scene, a.times, a.orient, crop, out))


if __name__ == "__main__":
    main()
