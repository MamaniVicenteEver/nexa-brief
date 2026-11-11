#!/usr/bin/env python3
"""sin-copias.py · garantiza que un episodio noticiero NO lleva copia del motor ni código propio.

    python3 <_atlas>/noticiero/tools/sin-copias.py <carpeta-del-episodio>

Un video es SOLO DATOS: assets/script.json, assets/scene.json, assets/config.json, assets/media/, assets/lyrics.json, audio.
El motor (`nodehistory/_atlas`), los componentes y `_proto/proto.js` son compartidos y se cargan por ruta relativa desde index.html.
Falla (código 1) si encuentra:
  E index.html distinto del wrapper de `plantilla/index.html` (otro <script>, <style> propio, rutas que no apunten al motor compartido)
  E archivos de código en el episodio (.js .mjs .ts .css .wasm) o carpetas de motor (_atlas, engine, vendor, node_modules, data/geo, noticiero)
  E copias de archivos del motor por nombre (hud.js, atlas.js, proto.js, update.js, camera.js, maplibre*)
  A scripts .py en work/ distintos de build_scene.py (código de un solo uso: justifícalo o bórralo)
Una pieza que falta se pide al catálogo (PIEZAS.md) o se crea UNA vez en el motor compartido, nunca dentro del episodio.
"""
import re, sys
from pathlib import Path

NOTICIERO = Path(__file__).resolve().parents[1]
CODIGO = {".js", ".mjs", ".cjs", ".ts", ".css", ".wasm"}
CARPETAS = {"_atlas", "engine", "vendor", "node_modules", "noticiero", "_proto", "geo"}
MOTOR = re.compile(r"^(hud|atlas|proto|update|camera|geo|overlays|animation|projection|style|sweep|flag-fill)\.m?js$|^maplibre", re.I)


def canon(html):
    html = re.sub(r"<title>.*?</title>", "<title></title>", html, flags=re.S)
    return re.sub(r"\s+", " ", html).strip()


def main():
    ep = Path(sys.argv[1]).resolve()
    E, A = [], []
    idx = ep / "index.html"
    base = (NOTICIERO / "plantilla" / "index.html").read_text()
    if not idx.is_file():
        E.append("falta index.html")
    elif canon(idx.read_text()) != canon(base):
        E.append("index.html no es el wrapper de plantilla/index.html (no se edita: el motor y los parámetros salen de assets/*.json)")
    for p in ep.rglob("*"):
        rel = p.relative_to(ep)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if p.is_dir() and p.name in CARPETAS:
            E.append(f"{rel}/: carpeta de motor dentro del episodio (se usa la compartida, no una copia)")
        elif p.is_file():
            if p.suffix.lower() in CODIGO:
                E.append(f"{rel}: código dentro del episodio (los videos son solo datos)")
            elif MOTOR.match(p.name):
                E.append(f"{rel}: copia de un archivo del motor")
            elif p.suffix == ".py" and rel.parts[0] == "work" and p.name != "build_scene.py":
                A.append(f"{rel}: script suelto en work/ (¿hace falta? el generador es build_scene.py)")
    for m in E:
        print("E ", m)
    for m in A:
        print("A ", m)
    print(f"sin-copias: {len(E)} errores · {len(A)} avisos")
    sys.exit(1 if E else 0)


if __name__ == "__main__":
    main()
