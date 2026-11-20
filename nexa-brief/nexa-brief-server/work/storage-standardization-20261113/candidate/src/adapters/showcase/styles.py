"""Estilos públicos del motor: una definición compartida, independiente de su estado."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from pathlib import Path

from src.adapters.showcase.filesystem import _id, _read, _safe
from src.core.showcase.ports import ShowcaseInvalid, ShowcaseNotFound


def merge(base: dict, override: dict) -> dict:
    result = deepcopy(base)
    for key, value in override.items():
        if key in {"__proto__", "prototype", "constructor"}:
            raise ShowcaseInvalid("Clave de estilo inválida")
        result[key] = (
            merge(result[key], value)
            if isinstance(result.get(key), dict) and isinstance(value, dict)
            else deepcopy(value)
        )
    return result


def resolve_design(
    repository, ident: str, folder: str | None = None, episode: str | None = None
):
    _id(ident)
    if folder is not None:
        _id(folder)
    raw = repository.get_design(ident)
    if raw is not None:
        if episode and not any(e["id"] == episode for e in raw.get("episodes", [])):
            raise ShowcaseNotFound("Episodio no encontrado en este perfil")
        return raw, episode
    matches = []
    for design in repository.list_designs():
        for item in design.get("episodes", []):
            url = item.get("preview_url") or ""
            if item["id"] == ident and (not folder or f"/{folder}/{ident}/" in url):
                matches.append(design)
    if len(matches) != 1:
        raise ShowcaseNotFound("Diseño o episodio no encontrado en este perfil")
    return matches[0], ident


def _source(repository, design):
    declaration = design.get("visual_styles")
    if not declaration:
        return None, {}
    index = declaration.get("index") if isinstance(declaration, dict) else None
    if not isinstance(index, str) or not index.endswith("/index.json"):
        raise ShowcaseInvalid("Declaración de estilos inválida")
    path = _safe(repository.templates, *index.split("/"))
    payload = _read(path)
    rows = payload.get("estilos", [])
    if not isinstance(rows, list) or len(rows) > 32:
        raise ShowcaseInvalid("Índice de estilos inválido")
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or _id(row.get("id")) in seen:
            raise ShowcaseInvalid("Estilo inválido o duplicado")
        seen.add(row["id"])
    if payload.get("default") not in seen:
        raise ShowcaseInvalid("El estilo predeterminado no existe")
    return path, payload


def list_styles(repository, ident, folder=None, episode=None):
    design, episode = resolve_design(repository, ident, folder, episode)
    path, source = _source(repository, design)
    rows = [
        {
            "id": row["id"],
            "name": row.get("nombre", row["id"]),
            "idea": row.get("idea", ""),
            "formats": row.get("formatos", ["movil", "escritorio"]),
            "unavailable_components": design.get("visual_styles", {}).get("unavailable_components", {}).get(row["id"], []),
        }
        for row in source.get("estilos", [])
    ]
    for row in rows:
        row["revision"] = hashlib.sha256(
            _safe(path.parent, row["id"] + ".json").read_bytes()
        ).hexdigest()[:16]
    default = source.get("default")
    defaults = design.get("visual_styles", {}).get("episode_defaults", {})
    if episode and defaults.get(episode) in {row["id"] for row in rows}:
        default = defaults[episode]
    if episode:
        from urllib.parse import urlsplit

        row = next((e for e in design.get("episodes", []) if e["id"] == episode), {})
        url = urlsplit(row.get("preview_url") or "").path
        prefix = "/api/v1/explainer/files/"
        parts = url.removeprefix(prefix).split("/")
        if url.startswith(prefix) and len(parts) == 4 and parts[-1] == "index.html":
            namespace, folder_name, episode_id, _ = parts
            root = (
                getattr(repository, "sandbox", None)
                if namespace == "sandbox"
                else getattr(repository, "root", Path("/nonexistent")) / "productions"
                if namespace == "productions"
                else None
            )
            if root is not None:
                scene = _safe(root, folder_name, episode_id, "assets", "scene.json")
                if scene.is_file():
                    saved = _read(scene).get("estilo")
                    if saved in {row["id"] for row in rows}:
                        default = saved
    return {
        "schema_version": 1,
        "design_id": design["id"],
        "default": default,
        "styles": rows,
        "options": source.get("opciones", []),
        "revision": hashlib.sha256(
            json.dumps(rows, sort_keys=True).encode()
        ).hexdigest()[:16]
        if path
        else None,
        "contract_url": f"/api/v1/showcase/designs/{design['id']}/catalog",
        "guide_url": "/api/v1/showcase/designs/" + design["id"] + "/production-guide",
    }


def get_style(repository, ident, style, format="16x9"):
    if format not in {"9x16", "16x9"}:
        raise ShowcaseInvalid("Formato inválido")
    design, _ = resolve_design(repository, ident)
    path, source = _source(repository, design)
    _id(style)
    row = next((r for r in source.get("estilos", []) if r["id"] == style), None)
    if row is None or path is None:
        raise ShowcaseInvalid("Estilo inválido")
    selected = _safe(path.parent, style + ".json")
    raw = _read(selected)
    if raw.get("id") != style:
        raise ShowcaseInvalid("Identidad de estilo incoherente")
    native_format = "movil" if format == "9x16" else "escritorio"
    if native_format not in row.get("formatos", ["movil", "escritorio"]):
        raise ShowcaseInvalid("El estilo no admite este formato")
    result = merge(raw, raw.get("formatos", {}).get(native_format, {}))
    result.pop("formatos", None)
    return {
        "id": style,
        "name": row.get("nombre", style),
        "format": format,
        "revision": hashlib.sha256(selected.read_bytes()).hexdigest()[:16],
        "tokens": result,
        "unavailable_components": design.get("visual_styles", {}).get("unavailable_components", {}).get(style, []),
    }


class PublicStyleDefinitions:
    """Referencia pública para el host, sin episodios ni estado de otros perfiles."""

    def __init__(self, templates):
        self.templates = Path(templates)

    def get_design(self, ident):
        _id(ident)
        path = _safe(
            self.templates, "_tools", "design-definitions", ident, "design.json"
        )
        return _read(path) if path.is_file() else None

    def list_designs(self):
        return []

    def get_catalog(self, ident):
        _id(ident)
        path = _safe(
            self.templates, "_tools", "design-definitions", ident, "catalog.json"
        )
        catalog = _read(path) if path.is_file() else None
        if catalog is not None and ident == 'atlas-en-movimiento':
            from src.adapters.showcase.atlas_catalog import atlas_engine_catalog
            catalog = atlas_engine_catalog(self.templates, catalog)
        return catalog

    def get_styles(self, ident, folder=None, episode=None):
        return list_styles(self, ident, folder, episode)

    def get_style(self, ident, estilo, format="16x9"):
        return get_style(self, ident, estilo, format)
