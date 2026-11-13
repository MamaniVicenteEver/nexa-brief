"""Contratos pequeños de apariencia para el agente, sin leer el motor."""

from __future__ import annotations

from copy import deepcopy


def _at(data, path):
    for key in path.split("."):
        data = data.get(key) if isinstance(data, dict) else None
    return data


def appearance(entry: str, style: dict) -> dict:
    tokens = style["tokens"]
    if tokens.get("family") == "atlas-news":
        kind = entry.removeprefix("noticiero.")
        return {"id": style["id"], "revision": style["revision"], "format": style["format"],
                "enabled": tokens.get("enabled", False),
                "defaults": deepcopy(tokens.get("components", {}).get(kind, {})),
                "typography": tokens.get("fonts", {}), "colors": tokens.get("colors", {}),
                "layout": tokens.get("layout", {}),
                "override": "news; portrait/landscape. Se respetan mínimos de lectura y zonas seguras.",
                "capacity": "No acumular mensajes ilimitados: dividirlos en ventanas por anclas. Consultar __newsHud.layout().overflow en la revisión."}
    if "layers" in tokens:
        kind = entry.removeprefix("map.layer.")
        values = tokens.get("layers", {}).get(kind, {})
        if entry == "proto.captions":
            values = tokens.get("captions", {})
        return {
            "id": style["id"],
            "revision": style["revision"],
            "format": style["format"],
            "defaults": deepcopy(values),
            "typography": tokens.get("text", {}),
            "safeMargin": tokens.get("safeMargin", 24),
        }
    component = tokens.get("componentes", {}).get(entry, {})
    paths = component.get("usa", [])
    return {
        "id": style["id"],
        "revision": style["revision"],
        "format": style["format"],
        "uses": {path: _at(tokens, path) for path in paths},
        "slots": tokens.get("ranuras", {}),
        "fonts": tokens.get("fuentes", {}),
        "fixed": any(
            entry == p or entry.startswith(p[:-1])
            for p in tokens.get("fijos", [])
            if isinstance(p, str)
        ),
        "migration_pending": not bool(paths),
    }


def styled_entry(entry, style):
    result = entry.model_copy(deep=True)
    result.appearance = appearance(entry.name, style)
    for key, value in result.appearance.get("defaults", {}).items():
        if key in result.params:
            result.params[key] = {**result.params[key], "default": value}
    return result
