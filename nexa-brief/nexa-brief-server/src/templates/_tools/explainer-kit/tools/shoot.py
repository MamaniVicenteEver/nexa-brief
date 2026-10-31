#!/usr/bin/env python3
"""Capturas de control de componentes (galería) → hoja de contacto PNG.

Abre showcase/stage.html?c=<componente>&p=<params> en Chromium headless, busca varios
instantes con window.__promo.seek(t) y arma una hoja con todas las capturas.
Sirve para REVISAR A OJO cada componente en 9:16 y 16:9 antes de usarlo.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/shoot.py OUT.png \
      binary.counter binary.cipher:'{"plain":"HOLA"}' --times 1.2,2.5,4 --orient both
  Cada componente puede llevar params JSON después de ':'; sin params usa su `example`.
  --prev componente   forma previa (para ver la transición)
  --page RUTA   otra página relativa al kit (p. ej. ../explainer-videos/<id>/index.html) con --times absolutos o 'beats'
"""
import argparse, asyncio, functools, io, http.server, json, pathlib, threading, urllib.parse
from PIL import Image, ImageDraw, ImageFont
import os

# En Docker se usa el Chromium del sistema (PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
# fuera de Docker, el que instala `playwright install chromium`.
CHROMIUM = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None

KIT = pathlib.Path(__file__).resolve().parents[1]
SANDBOX = KIT.parents[1]                     # src/templates/ (videos y kit)

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass

    def send_head(self):
        self._range_left = None
        path = self.translate_path(self.path)
        if not path.lower().endswith(".mp4") or not os.path.isfile(path):
            return super().send_head()
        source = open(path, "rb")
        size = os.fstat(source.fileno()).st_size
        request = self.headers.get("Range", "")
        start, end = 0, size - 1
        if request.startswith("bytes="):
            bounds = request[6:].split(",", 1)[0].split("-", 1)
            try:
                if bounds[0]:
                    start = int(bounds[0])
                    end = min(int(bounds[1]), size - 1) if bounds[1] else size - 1
                else:
                    start = max(0, size - int(bounds[1]))
            except (ValueError, IndexError):
                source.close()
                self.send_error(416, "Rango inválido")
                return None
            if start >= size or end < start:
                source.close()
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return None
        self._range_left = end - start + 1
        self.send_response(206 if request.startswith("bytes=") else 200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(self._range_left))
        self.send_header("Accept-Ranges", "bytes")
        if request.startswith("bytes="):
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        source.seek(start)
        return source

    def copyfile(self, source, output):
        if self._range_left is None:
            return super().copyfile(source, output)
        while self._range_left > 0:
            data = source.read(min(64 * 1024, self._range_left))
            if not data:
                break
            output.write(data)
            self._range_left -= len(data)

def serve(root):
    h = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=str(root)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h

FULL = False
WORDS = ""
JS = ""
BEATS = False
ORIENT = {"9x16": (540, 960), "16x9": (960, 540)}

async def shoot(specs, times, orients, prev, page, dur):
    from playwright.async_api import async_playwright
    srv = serve(SANDBOX)
    base = f"http://127.0.0.1:{srv.server_port}/{KIT.relative_to(SANDBOX).as_posix()}/"
    shots, errors = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROMIUM, args=["--autoplay-policy=no-user-gesture-required"])
        for o in orients:
            W, H = ORIENT[o]
            for name, params in specs:
                pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
                pg.on("console", lambda m, n=name: m.type in ("error", "warning") and errors.append(f"[{n}] {m.type}: {m.text}"))
                pg.on("pageerror", lambda e, n=name: errors.append(f"[{n}] pageerror: {e}"))
                if page:
                    url = base + page + ("&" if "?" in page else "?") + "paused"
                else:
                    q = {"c": name, "paused": "1", "dur": str(dur)}
                    if params: q["p"] = params
                    if prev: q["prev"] = prev
                    if WORDS: q["words"] = WORDS
                    if JS: q["js"] = JS
                    url = base + "showcase/stage.html?" + urllib.parse.urlencode(q)
                await pg.goto(url, wait_until="domcontentloaded", timeout=120000)
                await pg.wait_for_function("window.__promo", timeout=60000)
                ts = times
                if BEATS:   # un cuadro por beat principal, cuando ya está armado (≈70% o 2,4 s)
                    ts = await pg.evaluate("window.__promo.beats.filter(b => b.layer === 'main').map(b => +(b.t0 + Math.min(2.4, b.dur * 0.7)).toFixed(2))")
                for t in ts:
                    await pg.evaluate(f"window.__promo.seek({t})")
                    png = await pg.screenshot(type="png", full_page=FULL)
                    shots.append((o, name, t, Image.open(io.BytesIO(png)).convert("RGB")))
                await pg.close()
        await b.close()
    srv.shutdown()
    return shots, errors

def sheet(shots, out, thumb_h=480):
    font = ImageFont.load_default()
    rows = {}
    for o, name, t, im in shots: rows.setdefault((o, name), []).append((t, im))
    tiles = []
    for (o, name), items0 in rows.items():
      per = 12 if o == "9x16" else 6
      for c0 in range(0, len(items0), per):
        items = items0[c0:c0 + per]
        ims = []
        for t, im in items:
            k = thumb_h / im.height; th = im.resize((int(im.width * k), thumb_h))
            d = ImageDraw.Draw(th); d.rectangle([0, 0, th.width, 14], fill=(200, 30, 30)); d.text((4, 2), f"{name} {o} t={t}", fill="white", font=font)
            ims.append(th)
        w = sum(i.width for i in ims) + 6 * (len(ims) - 1)
        row = Image.new("RGB", (w, thumb_h), (60, 60, 60)); x = 0
        for i in ims: row.paste(i, (x, 0)); x += i.width + 6
        tiles.append(row)
    W = max(r.width for r in tiles); H = sum(r.height for r in tiles) + 6 * (len(tiles) - 1)
    S = Image.new("RGB", (W, H), (60, 60, 60)); y = 0
    for r in tiles: S.paste(r, (0, y)); y += r.height + 6
    S.save(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("specs", nargs="+")
    ap.add_argument("--times", default="1.0,2.6,4.5"); ap.add_argument("--orient", default="both")
    ap.add_argument("--prev", default=""); ap.add_argument("--page", default=""); ap.add_argument("--dur", default="7")
    ap.add_argument("--thumb", type=int, default=480); ap.add_argument("--full", action="store_true"); ap.add_argument("--words", default=""); ap.add_argument("--js", default="")
    a = ap.parse_args()
    global FULL, WORDS, JS, BEATS; FULL = a.full; WORDS = a.words; JS = a.js; BEATS = a.times == "beats"
    specs = []
    for s in a.specs:
        name, _, params = s.partition(":")
        if params: json.loads(params)  # valida
        specs.append((name, params))
    orients = ["9x16", "16x9"] if a.orient == "both" else [a.orient]
    times = [] if a.times == "beats" else [float(x) for x in a.times.split(",")]
    shots, errors = asyncio.run(shoot(specs, times, orients, a.prev, a.page, a.dur))
    sheet(shots, a.out, a.thumb)
    print(f"✓ {len(shots)} capturas → {a.out}")
    for e in dict.fromkeys(errors): print("  ⚠", e[:300])

if __name__ == "__main__":
    main()
