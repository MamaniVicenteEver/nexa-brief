"""Read-only normalisation of legacy Sandbox design catalogues.

Only the selected Sandbox is scanned; schema v1 also sees the historical
repository Sandbox. No profile data or engines are moved by these adapters.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote, urlencode

from src.core.showcase.ports import ShowcaseConflict

_ID = re.compile(r"^[a-z][a-z0-9_-]{0,127}$")
_ENTRY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_PREFIX = "/api/v1/explainer/files"
_RESERVED = {"designs", "referencias", "nuevos", "assets", "engine", "work", "render", "logs"}


def _identifier(value: str) -> str:
    if _ENTRY.fullmatch(value) and ".." not in value:
        return value
    return "legacy-" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


def _inside(root: Path, relative: str) -> Path | None:
    if not isinstance(relative, str) or not relative or "\\" in relative:
        return None
    parts = relative.split("/")
    if any(not p or p.startswith(".") or "%" in p or ":" in p or "?" in p or "#" in p
           or p.lower() in {"work", "logs", "connections", "browser_profiles", "accounts.json", "users.json", "access.json"}
           or p.lower().startswith(("client_secret", "token", "credential", "secret", "session", "oauth")) for p in parts):
        return None
    path = root
    if root.is_symlink():
        return None
    for part in parts:
        path = path / part
        if path.is_symlink():
            return None
    try:
        return path if path.resolve().is_relative_to(root.resolve()) else None
    except OSError:
        return None


def _json(root: Path, relative: str):
    path = _inside(root, relative)
    if path is None or not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _roots(adapter):
    result = []
    repo_root = adapter.templates / "sandbox"
    owned = adapter.schema_version == 1 and callable(getattr(adapter, "allow_legacy_repo", None)) and adapter.allow_legacy_repo()
    for root in [adapter.sandbox, *([repo_root] if owned else [])]:
        root = Path(root)
        if root.is_symlink() or not root.is_dir():
            continue
        if root.resolve() == repo_root.resolve() and not owned:
            continue
        if not any(root.resolve() == existing.resolve() for existing in result):
            result.append(root)
    return result


def _builtin_ids(adapter) -> set[str]:
    index = _json(adapter.templates, "_tools/explainer-kit/showcase/designs.json")
    return {v for v in index.get("designs", []) if isinstance(v, str)} if isinstance(index, dict) else set()


def _url(adapter, root: Path, path: str) -> str | None:
    file = _inside(root, path)
    if file is None or not file.is_file() or "work" in path.split("/"):
        return None
    # Legacy v1 serves repository templates; v2 serves the selected profile.
    template_root = adapter.templates / "sandbox"
    if adapter.schema_version == 1 and root.resolve() != template_root.resolve():
        return None
    return f"{_PREFIX}/sandbox/" + "/".join(quote(part, safe="") for part in path.split("/"))


def _catalog_base(adapter, root: Path, folder: str, declaration: dict) -> tuple[Path, str] | None:
    base = declaration.get("base")
    if base is None:
        return root, folder
    if not isinstance(base, str) or not base.startswith("sandbox/"):
        return None
    shared_path = base.removeprefix("sandbox/")
    parts = shared_path.split("/")
    # Shared engines are code, not another profile's Sandbox.
    if len(parts) != 2 or parts[1] not in {"_atlas", "_vida", "_tactico", "_pizarra", "_avatar", "_player", "_engine", "_mapas"}:
        return None
    shared_root = adapter.templates / "sandbox"
    return (shared_root, shared_path) if _inside(shared_root, shared_path) else None


def _source_url(adapter, root: Path, path: str) -> str | None:
    shared_root = adapter.templates / "sandbox"
    # Existing explainer resolver exposes these engine namespaces as shared.
    parts = path.split("/")
    shared = len(parts) >= 2 and parts[1] in {"_atlas", "_vida", "_tactico", "_pizarra", "_avatar", "_player", "_engine", "_mapas"}
    if shared and root.resolve() == shared_root.resolve():
        target = _inside(root, path)
        if target is not None and target.is_file() and "work" not in parts:
            return f"{_PREFIX}/sandbox/" + "/".join(quote(part, safe="") for part in parts)
        return None
    return _url(adapter, root, path)


def atlas_cache_ready(adapter) -> bool:
    """Require the real Atlas renderer's shared assets; never synthesize map data."""
    root = adapter.templates / "sandbox"
    files = ("nodehistory/_atlas/cache/vector/world.pmtiles", "nodehistory/_atlas/cache/sprites/light.json",
             "nodehistory/_atlas/cache/sprites/light.png")
    dirs = ("nodehistory/_atlas/cache/fonts", "nodehistory/_atlas/cache/gibs-bluemarble",
            "nodehistory/_atlas/cache/terrain-land")
    for relative in files:
        path = _inside(root, relative)
        try:
            present = path is not None and path.is_file() and path.stat().st_size > 0
        except OSError:
            present = False
        if not present:
            return False
    for relative in dirs:
        path = _inside(root, relative)
        try:
            present = path is not None and path.is_dir() and any(path.iterdir())
        except OSError:
            present = False
        if not present:
            return False
    return True


def _entry(row: dict, gallery: str | None) -> dict | None:
    name = row.get("name")
    if not isinstance(name, str) or not name:
        return None
    prefix = name.split(".", 1)[0].lower()
    kind = {"personajes": "character", "characters": "character", "escenas": "set", "escenarios": "set",
            "sets": "set", "acciones": "action", "actions": "action", "workflows": "workflow"}.get(prefix, "component")
    json_only = row.get("kind") == "json"
    data = row.get("demo") if json_only else {"native_name": name}
    return {
        "id": _identifier(name), "name": name, "label": str(row.get("label") or name),
        "kind": kind, "summary": str(row.get("summary") or row.get("description") or ""),
        "tags": [tag for tag in row.get("tags", []) if isinstance(tag, str)] if isinstance(row.get("tags", []), list) else [],
        "params": row.get("params") if isinstance(row.get("params"), dict) else {},
        "example": row.get("demo") if isinstance(row.get("demo"), dict) else {},
        "preview_url": gallery if not json_only and isinstance(row.get("preview"), dict) else None,
        "preview_kind": "json" if json_only else "iframe", "data": data,
    }


def _catalog(adapter, root: Path, folder: str, info: dict, design_id: str) -> tuple[list[dict], str | None, str | None]:
    declaration = info.get("catalog")
    if not isinstance(declaration, dict):
        return [], None, "Este diseño aún no tiene un catálogo declarado"
    base = _catalog_base(adapter, root, folder, declaration)
    component_file, gallery_file = declaration.get("components"), declaration.get("gallery")
    if base is None or not isinstance(component_file, str) or not isinstance(gallery_file, str):
        return [], None, "El catálogo necesita una definición y una galería válidas"
    base_root, base_path = base
    payload = _json(base_root, f"{base_path}/{component_file}")
    rows = payload.get("components") if isinstance(payload, dict) else payload
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        return [], None, "No se pudo leer el catálogo de componentes"
    gallery = _source_url(adapter, base_root, f"{base_path}/{gallery_file}")
    if design_id == "atlas-en-movimiento" and gallery is None:
        # The supported gallery is deliberately outside the private work tree.
        gallery = _source_url(adapter, base_root, f"{base_path}/preview/tactico/demo.html")
    entries = []
    for row in rows:
        if (("params" in row and not isinstance(row["params"], dict))
                or ("tags" in row and (not isinstance(row["tags"], list)
                                      or any(not isinstance(tag, str) for tag in row["tags"])))
                or ("preview" in row and not isinstance(row["preview"], dict))
                or (row.get("kind") == "json" and not isinstance(row.get("demo"), dict))):
            return [], None, "El catálogo contiene un componente inválido"
        entry = _entry(row, gallery)
        if entry is None:
            return [], None, "El catálogo contiene componentes sin identidad"
        # Atlas galleries use their own native example instead of an explicit preview field.
        if gallery and entry["preview_kind"] == "iframe" and isinstance(row.get("demo"), dict):
            entry["preview_url"] = gallery
        entries.append(entry)
    sprites_file = declaration.get("sprites")
    sprites_dir = declaration.get("spritesDir")
    if sprites_file is not None or sprites_dir is not None:
        if not isinstance(sprites_file, str) or not isinstance(sprites_dir, str):
            return [], None, "El catálogo de sprites está incompleto"
        payload = _json(base_root, f"{base_path}/{sprites_file}")
        sprites = payload.get("sprites") if isinstance(payload, dict) and "sprites" in payload else payload
        if isinstance(sprites, list):
            if any(not isinstance(row, dict) for row in sprites):
                return [], None, "El catálogo de sprites es inválido"
            sprite_rows = [(str(row.get("name") or row.get("id") or ""), row) for row in sprites]
        elif isinstance(sprites, dict):
            sprite_rows = list(sprites.items())
        else:
            return [], None, "El catálogo de sprites no está disponible o es inválido"
        for name, row in sprite_rows:
            if not isinstance(name, str) or not name or not isinstance(row, dict):
                return [], None, "El catálogo de sprites contiene una identidad inválida"
            filename = row.get("file") or row.get("src")
            if not isinstance(filename, str) or not filename:
                return [], None, "El catálogo de sprites contiene un archivo inválido"
            preview = _source_url(adapter, base_root, f"{base_path}/{sprites_dir.rstrip('/')}/{filename}")
            entries.append({"id": "sprite-" + hashlib.sha256(name.encode("utf-8")).hexdigest()[:24],
                            "name": name, "label": name,
                            "kind": "character" if design_id == "cara-a-cara" else "component",
                            "summary": "", "tags": [], "params": {}, "example": {},
                            "preview_url": preview, "preview_kind": "image",
                            "data": {key: row[key] for key in ("name", "family", "variant", "states") if key in row}})
    workflows_file = declaration.get("workflows")
    if workflows_file is not None:
        if not isinstance(workflows_file, str):
            return [], None, "El catálogo de guías es inválido"
        payload = _json(base_root, f"{base_path}/{workflows_file}")
        cards = payload.get("cards") if isinstance(payload, dict) else None
        if not isinstance(cards, list):
            return [], None, "El catálogo de guías no está disponible o es inválido"
        for row in cards:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"]:
                return [], None, "El catálogo de guías contiene una identidad inválida"
            name = row["id"]
            ident = _identifier(name)
            if len(ident) > 118:
                ident = hashlib.sha256(name.encode("utf-8")).hexdigest()[:24]
            entries.append({"id": "workflow-" + ident, "name": name,
                            "label": str(row.get("title") or name), "kind": "workflow",
                            "summary": str(row.get("summary") or ""), "tags": [], "params": {},
                            "example": {}, "preview_url": None, "preview_kind": "json", "data": row})
    ids = [item["id"] for item in entries]
    if len(ids) != len(set(ids)):
        return [], None, "El catálogo contiene identidades duplicadas"
    blocker = "Esta galería aún no tiene una vista previa accesible" if gallery is None else "Inicializa primero un bundle de este diseño"
    return entries, gallery, blocker


def _discover(adapter):
    builtins = _builtin_ids(adapter)
    discovered = {}
    for root in _roots(adapter):
        for category in sorted(root.iterdir()):
            if category.is_symlink() or not category.is_dir() or not _ID.fullmatch(category.name):
                continue
            for folder in sorted(category.iterdir()):
                if folder.is_symlink() or not folder.is_dir() or folder.name in _RESERVED or not _ID.fullmatch(folder.name):
                    continue
                info = _json(root, f"{category.name}/{folder.name}/info.json")
                if not isinstance(info, dict):
                    continue
                design_id = info.get("design") or folder.name
                if not isinstance(design_id, str) or not _ID.fullmatch(design_id) or design_id == "vida-en-escena":
                    continue
                if not (info.get("is_new_design") is True or isinstance(info.get("catalog"), dict) or isinstance(info.get("design"), str)):
                    continue
                # Historical explainer demos describe an already registered built-in design.
                if design_id in builtins or (design_id.endswith("-demo") and design_id[:-5] in builtins):
                    continue
                engine = info.get("engine")
                if isinstance(engine, str) and engine.startswith("explainer-kit:") and engine.split(":", 1)[1] in builtins:
                    continue
                relative = f"{category.name}/{folder.name}"
                if category.name == "nodemotion":
                    entries, gallery, blocker = [], None, "Plantilla de pipeline sin catálogo de componentes estándar"
                    preview = None
                else:
                    entries, gallery, blocker = _catalog(adapter, root, relative, info, design_id)
                    preview = _url(adapter, root, f"{relative}/index.html")
                    if design_id == "atlas-cinematico" and not atlas_cache_ready(adapter):
                        blocker = "Faltan recursos reales de mapa para la vista previa"
                episodes = []
                episode = _json(root, f"{relative}/assets/episode.json")
                if isinstance(episode, dict) and isinstance(episode.get("id"), str) and _ID.fullmatch(episode["id"]):
                    episodes.append({"id": episode["id"], "title": str(episode.get("title") or episode["id"]),
                                     "design_id": design_id, "preview_url": preview})
                design = {"id": design_id, "name": str(info.get("title") or design_id), "category": category.name,
                          "state": "prueba", "family": design_id, "engine_id": str(info.get("engine") or "desconocido"),
                          "description": str(info.get("summary") or ""), "revision": "1", "preview_url": preview,
                          "promotable": False, "promote_blocker": blocker, "episodes": episodes, "legacy": True}
                catalog = {"schema_version": 1, "design_id": design_id, "revision": "1", "entries": entries}
                existing = discovered.get(design_id)
                if existing is not None:
                    old_design, old_catalog, old_gallery, old_root, old_primary = existing
                    same_group = (old_root.resolve() == root.resolve() and old_design["category"] == category.name
                                  and (info.get("design") == design_id or old_primary))
                    if not same_group:
                        raise ShowcaseConflict("Identidad de diseño duplicada en Sandbox")
                    combined = old_design["episodes"] + episodes
                    if len({episode["id"] for episode in combined}) != len(combined):
                        raise ShowcaseConflict("Identidad de episodio duplicada en Sandbox")
                    if folder.name == design_id and not old_primary:
                        design["episodes"] = combined
                        discovered[design_id] = (design, catalog, gallery, root, True)
                    else:
                        old_design["episodes"] = combined
                        discovered[design_id] = (old_design, old_catalog, old_gallery, root, old_primary)
                else:
                    discovered[design_id] = (design, catalog, gallery, root, folder.name == design_id)
    return discovered


def legacy_designs(adapter) -> dict[str, dict]:
    return {key: value[0] for key, value in _discover(adapter).items()}


def legacy_catalog(adapter, design_id: str) -> dict | None:
    item = _discover(adapter).get(design_id)
    return item[1] if item else None


def legacy_preview(adapter, design_id: str, entry_id: str | None, format: str) -> str | None:
    item = _discover(adapter).get(design_id)
    if item is None:
        return None
    design, catalog, gallery = item[:3]
    if entry_id is None:
        return design["preview_url"]
    entry = next((row for row in catalog["entries"] if row["id"] == entry_id), None)
    return legacy_entry_preview(entry, gallery, format)


def legacy_entry_preview(entry: dict | None, gallery: str | None, format: str) -> str | None:
    """Resolve one entry from an already loaded snapshot without rescanning the profile."""
    if not entry or not entry["preview_url"]:
        return None
    if entry["preview_kind"] == "image":
        return entry["preview_url"]
    if gallery is None:
        return None
    native = entry["data"].get("native_name", entry["name"]) if isinstance(entry["data"], dict) else entry["name"]
    return gallery + "?" + urlencode({"only": native, "bg": "white", "autoplay": "1", "loop": "1", "bare": "1", "aspect": format})
