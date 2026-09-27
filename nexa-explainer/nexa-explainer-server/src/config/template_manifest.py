"""Manifest único por template_id: nombre público, descripción, y TODAS las
rutas de archivo (index.html, prompts, config de ejemplo).

Fuente de verdad: src/templates/templates.json. `folder` (nombre físico en
disco) vive solo acá, desacoplado de `template_id` (el identificador lógico
estable, usado por remotion_adapter.py/frontend/data/template_configs — no
cambia aunque se renombre la carpeta). niches.json ya no tiene rutas
hardcodeadas: ver get_template_paths(). Cacheado en memoria: el archivo no
cambia en runtime, solo se lee una vez por proceso.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from src.config.settings import settings


@lru_cache(maxsize=1)
def _load_manifest() -> dict:
    """Merge the Explainer catalog with the isolated legacy catalog.

    Legacy templates remain addressable for existing niches, but are no longer
    mixed into ``src/templates`` where the Explainer catalog is authored.
    """
    manifest_paths = (
        settings.templates_dir / "templates.json",
        settings.templates_dir.parent / "legacy-templates" / "templates.json",
    )
    merged: dict = {}
    for manifest_path in manifest_paths:
        if manifest_path.exists():
            merged.update(json.loads(manifest_path.read_text(encoding="utf-8")).get("templates", {}))
    return merged


def get_template_display_name(template_id: str, fallback: str) -> str:
    entry = _load_manifest().get(template_id)
    return entry["display_name"] if entry and "display_name" in entry else fallback


def get_template_description(template_id: str, fallback: str) -> str:
    entry = _load_manifest().get(template_id)
    return entry["description"] if entry and "description" in entry else fallback


def get_template_native_orientation(template_id: str, fallback: str = "any") -> str:
    entry = _load_manifest().get(template_id)
    return entry["native_orientation"] if entry and "native_orientation" in entry else fallback


def get_template_paths(template_id: str) -> dict[str, Path | None]:
    """Rutas absolutas resueltas para un template_id. Cualquier campo ausente
    en el manifest (ej. vision_prompt=null en los templates de letras, que no
    hacen extracción de visión) devuelve None."""
    entry = _load_manifest().get(template_id, {})
    return {
        key: (settings.templates_dir / entry[key]) if entry.get(key) else None
        for key in ("index_html", "config_json", "vision_prompt", "config_prompt")
    }
