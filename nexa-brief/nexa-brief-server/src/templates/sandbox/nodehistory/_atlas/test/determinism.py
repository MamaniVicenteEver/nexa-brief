"""Prueba de determinismo (manual, con Chromium+SwiftShader): el mismo instante debe dar píxeles idénticos
aunque se visite en otro orden. Uso: python determinism.py [escena.json] [t1,t2,...]
Salta a otros instantes entre visitas (adelante y atrás). Imprime px distintos por instante (debe ser 0)."""
import base64, functools, io, socketserver, sys, threading
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import smoke
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
import numpy as np
R = HERE.parents[3]
scene = sys.argv[1] if len(sys.argv) > 1 else "assets/scene.json"
ts = [float(x) for x in (sys.argv[2] if len(sys.argv) > 2 else "0.5,3.4,6.5,12.5,17,20.4,21.5").split(",")]
server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(smoke.Handler, directory=str(R)))
threading.Thread(target=server.serve_forever, daemon=True).start()
def img(d): return Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert("RGB")
bad = 0
TOL = 8   # diferencia máxima por canal tolerada (ruido de rasterización sub-visible); se informa también el máximo real
def cmp(a, b):
    arr = np.asarray(ImageChops.difference(a, b)).max(axis=2); return int((arr > 0).sum()), int((arr > TOL).sum()), int(arr.max())
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 960, 'height': 540}, device_scale_factor=1)
    pg.goto(f"http://127.0.0.1:{server.server_address[1]}/sandbox/nodehistory/atlas-cinematico/index.html?preload=0&scene={scene}")
    pg.wait_for_function('window.__promo && window.__atlas', timeout=90000)
    def grab(t):
        pg.evaluate('t=>window.__promo.seek(t)', t)
        return img(pg.evaluate("document.querySelector('#stage canvas').toDataURL('image/png')"))
    first = {t: grab(t) for t in ts}                       # orden creciente
    for t in reversed(ts):                                  # orden inverso
        n, big, mx = cmp(first[t], grab(t)); bad += big > 0
        print(f"t={t}: {n} px distintos, {big} por encima de {TOL}, max {mx} (inverso)")
    for t in ts[::2] + ts[1::2]:                            # orden salteado
        n, big, mx = cmp(first[t], grab(t)); bad += big > 0
        print(f"t={t}: {n} px distintos, {big} por encima de {TOL}, max {mx} (salteado)")
    b.close()
print("DETERMINISTA" if not bad else f"FALLA: {bad} instantes difieren")
