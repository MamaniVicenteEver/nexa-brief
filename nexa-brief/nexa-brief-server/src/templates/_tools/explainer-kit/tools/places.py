"""Dónde vive cada cosa del explainer-kit (la única fuente de rutas de las herramientas).

  src/templates/_tools/explainer-kit/   ← el motor (este kit)
  src/templates/<carpeta>/<video-id>/   ← los videos en producción, una carpeta por categoría:
                                          nodetech/, nodehistory/, nodepolitics/, nodeeconomy/
  src/templates/sandbox/<carpeta>/<id>/ ← casa de pruebas (ideas); `kit.py promote` los pasa a producción

La carpeta de cada categoría y qué diseños le tocan salen de niches.json → categories
(campos `folder` y `designs`). Un diseño sin categoría va a nodehistory/.
"""
from __future__ import annotations

import json
import pathlib
import sys

KIT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES = KIT.parents[1]                  # src/templates/
SERVER = KIT.parents[3]                     # nexa-brief-server/
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))
DEFAULT_FOLDER = "nodehistory"


def _categories() -> dict:
    try:
        return json.loads((SERVER / "niches.json").read_text()).get("categories", {})
    except Exception:
        return {}


def folders() -> list[str]:
    """Carpetas de video de las categorías con motor explainer."""
    out = [c["folder"] for c in _categories().values() if c.get("folder")]
    return out or [DEFAULT_FOLDER]


def folder_for_design(design: str) -> str:
    for c in _categories().values():
        if c.get("folder") and design in (c.get("designs") or []):
            return c["folder"]
    return DEFAULT_FOLDER


def find_video(video_id: str) -> pathlib.Path | None:
    """Busca primero en producción y después en la casa de pruebas (sandbox/)."""
    if not video_id or pathlib.Path(video_id).name != video_id or video_id in {".", ".."}:
        return None
    from src.config.content_paths import production_root, sandbox_root
    roots = [production_root() / f for f in folders()]
    roots += [sandbox_root() / f for f in folders()]
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    if layout_for_settings(settings).schema_version < 2:
        roots += [TEMPLATES / f for f in folders()]
        roots += [TEMPLATES / "sandbox" / f for f in folders()]
    for root in dict.fromkeys(roots):
        d = root / video_id
        if d.exists():
            return d
    return None


def is_sandbox(video_dir: pathlib.Path) -> bool:
    from src.config.content_paths import sandbox_root
    return sandbox_root() in video_dir.parents or (TEMPLATES / "sandbox") in video_dir.parents
