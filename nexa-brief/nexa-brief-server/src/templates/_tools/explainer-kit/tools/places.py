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

KIT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES = KIT.parents[1]                  # src/templates/
SERVER = KIT.parents[3]                     # nexa-brief-server/
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
    for folder in [*folders(), *(f"sandbox/{f}" for f in folders())]:
        d = TEMPLATES / folder / video_id
        if d.exists():
            return d
    return None


def is_sandbox(video_dir: pathlib.Path) -> bool:
    return (TEMPLATES / "sandbox") in video_dir.parents
