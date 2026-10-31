#!/usr/bin/env python3
"""Crea una escena NodeAction nueva copiando _escena-base/.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/nodeaction/tools/new.py <id-escena>   (minúsculas y guiones)
Después: editar <id>/assets/scene.json (ver AGENTS.md §3) y correr tools/sfx.py (deja song.mp3).
"""
import pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sid = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", sid):
    sys.exit("id inválido: minúsculas, números y guiones")
dest = ROOT / sid
if dest.exists():
    sys.exit(f"ya existe: {dest}")
shutil.copytree(ROOT / "_escena-base", dest)
for sub in ("work", "render", "assets/media"):
    (dest / sub).mkdir(parents=True, exist_ok=True)
print(f"✓ {dest}\n  siguiente: editar assets/scene.json · tools/review.py {sid} · tools/sfx.py {sid}")
