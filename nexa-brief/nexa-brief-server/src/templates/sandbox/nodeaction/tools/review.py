#!/usr/bin/env python3
"""Revisión de una escena NodeAction: hoja de cuadros (16:9 y/o 9:16) + resumen compilado.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/nodeaction/tools/review.py <carpeta-escena> [--times 0.5,2,4] [--every 1.5]
        [--orient both|16x9|9x16] [--out hoja.png] [--thumb 360]

Imprime: duración, sobrevivientes, quién eliminó a quién, avisos del compilador y errores de consola.
La hoja queda en <escena>/work/review-<orient>.png (o --out).
"""
import argparse, asyncio, functools, http.server, io, json, pathlib, threading

from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve()
TEMPLATES = HERE.parents[3]          # src/templates/
ORIENT = {"16x9": (960, 540), "9x16": (540, 960)}


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass


def serve(root):
    h = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=str(root)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h


async def run(scene_dir: pathlib.Path, times, every, orients, thumb):
    from playwright.async_api import async_playwright
    srv = serve(TEMPLATES)
    url = f"http://127.0.0.1:{srv.server_port}/{scene_dir.resolve().relative_to(TEMPLATES).as_posix()}/index.html?paused"
    sheets, errors, summary = {}, [], None
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for o in orients:
            W, H = ORIENT[o]
            pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
            pg.on("console", lambda m: m.type in ("error", "warning") and errors.append(f"[{o}] {m.type}: {m.text}"))
            pg.on("pageerror", lambda e: errors.append(f"[{o}] pageerror: {e}"))
            await pg.goto(url)
            await pg.wait_for_function("window.__promo && window.__action", timeout=30000)
            total = await pg.evaluate("window.__promo.total")
            if summary is None:
                summary = await pg.evaluate("window.__action.compiled()")
            ts = list(times) if times else [round(i * every, 2) for i in range(int(total / every) + 1)]
            shots = []
            for t in ts:
                await pg.evaluate(f"window.__promo.seek({t})")
                png = await pg.screenshot()
                im = Image.open(io.BytesIO(png)).convert("RGB")
                im.thumbnail((thumb * W // max(W, H) * 2, thumb * H // max(W, H) * 2))
                d = ImageDraw.Draw(im)
                d.rectangle([0, 0, 64, 22], fill=(0, 0, 0))
                d.text((5, 5), f"{t:.2f}s", fill=(255, 255, 255))
                shots.append(im)
            await pg.close()
            cols = 4 if o == "16x9" else 6
            w, h = shots[0].size
            rows = (len(shots) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * w + (cols + 1) * 6, rows * h + (rows + 1) * 6), (40, 40, 40))
            for i, im in enumerate(shots):
                sheet.paste(im, (6 + (i % cols) * (w + 6), 6 + (i // cols) * (h + 6)))
            sheets[o] = sheet
        await b.close()
    srv.shutdown()
    return sheets, errors, summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--times", default="")
    ap.add_argument("--every", type=float, default=1.5)
    ap.add_argument("--orient", default="16x9")
    ap.add_argument("--out", default="")
    ap.add_argument("--thumb", type=int, default=360)
    a = ap.parse_args()
    scene = pathlib.Path(a.scene)
    if not (scene / "index.html").exists():
        scene = HERE.parents[1] / a.scene
    times = [float(x) for x in a.times.split(",") if x.strip()]
    orients = ["16x9", "9x16"] if a.orient == "both" else [a.orient]
    sheets, errors, summary = asyncio.run(run(scene, times, a.every, orients, a.thumb))
    (scene / "work").mkdir(exist_ok=True)
    for o, sh in sheets.items():
        out = pathlib.Path(a.out) if a.out and len(sheets) == 1 else scene / "work" / f"review-{o}.png"
        sh.save(out)
        print("hoja:", out)
    print(json.dumps({k: summary[k] for k in ("total", "survivors", "warnings")}, ensure_ascii=False))
    for act in summary["actors"]:
        if act["death"] is not None:
            print(f"  {act['id']:>10} cae en {act['death']:5.2f} s  (por {act['killedBy']})")
    print(f"  disparos: {len(summary['shots'])} · impactos: {sum(1 for s in summary['shots'] if s['hit'])}")
    for e in errors[:30]:
        print("  !", e)


if __name__ == "__main__":
    main()
