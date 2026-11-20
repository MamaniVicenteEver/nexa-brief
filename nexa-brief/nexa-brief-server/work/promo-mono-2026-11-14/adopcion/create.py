"""Crea el prototipo promo-mono-adopcion en el Sandbox del perfil con la fachada de NodeMotion."""
import json, sys
from pathlib import Path
from src.config.settings import settings
from src.core.nodemotion import service
W = Path(sys.argv[1])
root = Path(settings.sandbox_dir) / "nodemotion" / "promo-mono-adopcion"
if root.exists():
    raise SystemExit(f"ya existe {root}")
ids = json.loads((W / "asset-ids.json").read_text())
assets = {"song.mp3": service.asset_ref("music", ids["song"])}
for name, v in ids.items():
    if name == "song":
        continue
    assets[f"media/{name}.mp4"] = service.asset_ref("video", v["video"])
    assets[f"media/{name}-1.jpg"] = service.asset_ref("image", v["poster"])
timeline = json.loads((W / "project/timeline.json").read_text())
project = service.create_project(root, "promo-mono", assets, timeline=timeline, policy="stable")
(root / "assets").mkdir(exist_ok=True)
(root / "assets/config.json").write_text((W / "project/config.json").read_text())
info = {"version": 1, "id": "promo-mono-adopcion", "title": "Patas Libres · adopción (prototipo promo-mono)",
        "summary": "Campaña de adopción de un refugio ficticio hecha con el diseño promo-mono: mismas 15 escenas, otros textos, perros reales de Pixabay, música CC BY y Outro v2.",
        "engine": "promo-mono", "based_on": "promo-mono", "is_new_design": False, "created_at": "2026-11-14",
        "reference": "Sin referencia propia: prueba de reutilización del diseño promo-mono.",
        "libraries": [], "inputs": {"timeline": "assets/timeline.json", "config": "assets/config.json", "media": "project.json (referencias de la biblioteca)"},
        "status": "lista para revisar", "state": "lista para revisar",
        "notes": "Proyecto de datos: el motor es el compartido de promo-mono; no hay copia de motor ni de medios. Música: «Carefree», Kevin MacLeod (CC BY 4.0, atribución obligatoria)."}
(root / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n")
print(root)
print(json.dumps({k: project[k] for k in ("design_id", "engine", "content_prefix")}, ensure_ascii=False), len(project["assets"]), "recursos")
