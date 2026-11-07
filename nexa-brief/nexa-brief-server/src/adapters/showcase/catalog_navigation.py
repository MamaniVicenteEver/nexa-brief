"""Restore public native navigation without changing versioned render contracts.

The initial v3 export omitted native families, tabs and sprite sections. Read
only the four known repository catalogues as a compatibility layer. New standard
catalogues can declare family/section/groups directly. Never inspect episodes,
private work directories or another profile to build navigation.
"""
from __future__ import annotations

from pathlib import Path

from src.adapters.showcase.filesystem import _read, _safe
from src.adapters.showcase.preview_availability import _gallery_index
from src.core.showcase.ports import ShowcaseInvalid

_SOURCES = {
    "atlas-en-movimiento": "sandbox/nodehistory/atlas-en-movimiento/engine/tactico/components.json",
    "atlas-cinematico": "sandbox/nodehistory/_atlas/components.json",
    "cara-a-cara": "sandbox/nodeaction/cara-a-cara/showcase/components.json",
    "vida-en-escena": "sandbox/nodeaction/_vida/showcase/components.json",
}
_DECLARATIONS = {
    "atlas-en-movimiento": "sandbox/nodehistory/atlas-en-movimiento/info.json",
    "cara-a-cara": "sandbox/nodeaction/cara-a-cara/info.json",
}


def catalog_navigation(templates: Path, design_id: str, catalog: dict) -> dict:
    source_path = _SOURCES.get(design_id)
    source = _gallery_index(templates, *source_path.split("/")) if source_path else {}
    entries = []
    for row in catalog["entries"]:
        entry = dict(row)
        native = source.get(entry["name"], {})
        sprite = entry["id"].startswith("sprite-")
        entry.setdefault("section", "sprites" if sprite else "workflows" if entry["kind"] == "workflow" else "components")
        metadata = entry.get("data") if sprite else native
        family = metadata.get("family") if isinstance(metadata, dict) else None
        if not isinstance(family, str) or not family:
            family = entry["name"].split(".", 1)[0] if source_path and not sprite else ""
        entry.setdefault("family", family)
        entries.append(entry)
    groups = catalog.get("groups", [])
    declaration_path = _DECLARATIONS.get(design_id)
    if not groups and declaration_path:
        info = _read(_safe(templates, *declaration_path.split("/")))
        tabs = info.get("catalog", {}).get("tabs", []) if isinstance(info, dict) else []
        if not isinstance(tabs, list):
            raise ShowcaseInvalid("Grupos del catálogo inválidos")
        groups = []
        for tab in tabs:
            if (not isinstance(tab, dict)
                    or not all(isinstance(tab.get(key), str) and tab[key] for key in ("id", "label"))
                    or any(not isinstance(tab.get(key, []), list)
                           or any(not isinstance(value, str) for value in tab.get(key, []))
                           for key in ("families", "components"))):
                raise ShowcaseInvalid("Grupo del catálogo inválido")
            groups.append({key: tab.get(key, []) for key in ("id", "label", "families", "components")})
    return {**catalog, "entries": entries, "groups": groups}
