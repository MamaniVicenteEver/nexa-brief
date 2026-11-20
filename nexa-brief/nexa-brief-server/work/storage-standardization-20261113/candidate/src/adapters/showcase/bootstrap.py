"""Bootstrap known legacy design metadata without moving episodes or engines."""

from __future__ import annotations

import os
import hashlib
import shutil
import tempfile
import uuid
from pathlib import Path

from src.adapters.showcase.filesystem import (
    FILES_PREFIX,
    REQUIRED_DIRS,
    FilesystemShowcaseAdapter,
    _entry,
    _read,
    _safe,
    _write,
)
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid


def legacy_vida(adapter: FilesystemShowcaseAdapter):
    root = _safe(adapter.templates, "sandbox", "nodeaction")
    engine = _safe(root, "_vida")  # shared engine is a repository resource
    catalog = _read(_safe(engine, "showcase", "components.json"))
    components = catalog.get("components") if isinstance(catalog, dict) else None
    if not isinstance(components, list) or not components:
        raise ShowcaseInvalid("Catálogo de Vida no disponible")
    entries = [_entry(c) for c in components]
    if len({x["id"] for x in entries}) != len(entries):
        raise ShowcaseConflict("Componentes duplicados")
    for entry in entries:
        entry["preview_url"] = f"{FILES_PREFIX}/sandbox/nodeaction/_vida/showcase.html"
    episodes = []
    for folder, expected_id in (
        ("vida-en-escena", "un-dia-cualquiera"),
        ("vida-en-escena-heladeria", "vida-en-escena-heladeria"),
    ):
        if adapter.schema_version == 1:
            directory = _safe(root, folder)
            url = f"{FILES_PREFIX}/sandbox/nodeaction/{folder}/index.html"
        else:
            candidates = [
                (
                    _safe(adapter.sandbox, "nodeaction", folder),
                    f"{FILES_PREFIX}/sandbox/nodeaction/{folder}/index.html",
                ),
                (
                    _safe(adapter.root, "productions", "nodeaction", folder),
                    f"{FILES_PREFIX}/productions/nodeaction/{folder}/index.html",
                ),
            ]
            match = next(
                (
                    (p, u)
                    for p, u in candidates
                    if (p / "assets/episode.json").is_file() and (p / "index.html").is_file()
                ),
                None,
            )
            directory, url = match if match else (None, None)
        data = (
            _read(_safe(directory, "assets", "episode.json"))
            if directory
            else {"id": expected_id, "title": expected_id}
        )
        ident = data.get("id") if isinstance(data, dict) else None
        from src.adapters.showcase.filesystem import _id

        _id(ident)
        if ident != expected_id:
            raise ShowcaseConflict("ID de episodio heredado inesperado")
        episodes.append(
            {"id": ident, "title": str(data.get("title") or ident), "design_id": "vida-en-escena", "preview_url": url}
        )
    if len({e["id"] for e in episodes}) != len(episodes):
        raise ShowcaseConflict("Episodios con ID duplicado")
    digest = hashlib.sha256()
    for parts in (("showcase", "components.json"), ("showcase.js",), ("player.js",), ("catalog.json",)):
        digest.update(_safe(engine, *parts).read_bytes())
        digest.update(b"\0")
    revision = digest.hexdigest()
    manifest = {
        "schema_version": 1,
        "id": "vida-en-escena",
        "name": "Vida en Escena",
        "category": "nodeaction",
        "state": "prueba",
        "family": "vida-en-escena",
        "engine_id": "nodeaction/_vida",
        "revision": revision,
        "description": "Historias con personajes y escenarios reutilizables."
        + (" Episodios aún no disponibles en este perfil." if any(e["preview_url"] is None for e in episodes) else ""),
        "promotable": True,
        "preview_url": f"{FILES_PREFIX}/sandbox/nodeaction/_vida/showcase.html?only=characters.heladero&aspect=9x16",
        "episodes": episodes,
        "source_key": "sandbox/nodeaction/_vida",
    }
    return manifest, {"schema_version": 1, "design_id": manifest["id"], "revision": revision, "entries": entries}


def _planning_adapter(adapter: FilesystemShowcaseAdapter, confirm_ownership: bool):
    """Allow an explicit read-only ownership confirmation without writing a marker."""
    if adapter.schema_version != 1 or adapter.allow_legacy_repo() or not confirm_ownership:
        return adapter
    candidate = FilesystemShowcaseAdapter(adapter.root, adapter.templates, data_root=adapter.data,
                                          sandbox_root=adapter.sandbox, schema_version=adapter.schema_version)
    candidate.allow_legacy_repo = lambda: True
    return candidate


def _definition(adapter: FilesystemShowcaseAdapter, design_id: str):
    if design_id == "vida-en-escena":
        return legacy_vida(adapter)
    from src.adapters.showcase.legacy_catalogs import _discover, atlas_cache_ready, legacy_entry_preview
    from src.core.showcase.service import _safe_destination

    discovered = _discover(adapter).get(design_id)
    if discovered is None:
        raise ShowcaseInvalid("Diseño heredado no disponible en este perfil")
    design, catalog, gallery = discovered[:3]
    if design_id == "atlas-cinematico" and not atlas_cache_ready(adapter):
        return None, "Faltan recursos reales de mapa para la vista previa"
    if not catalog["entries"]:
        return None, design.get("promote_blocker") or "Catálogo incompleto"
    entries = []
    for entry in catalog["entries"]:
        target = legacy_entry_preview(entry, gallery, "9x16") if entry.get("preview_url") else None
        if target:
            _safe_destination(target, design_id)
        entries.append({**entry, "preview_url": target})
    if any(entry["preview_kind"] != "json" and not entry["preview_url"] for entry in entries):
        return None, design.get("promote_blocker") or "Hay vistas previas o medios que no están disponibles"
    # A sprite alone cannot make a work-only component gallery promotable.
    demo = next((entry for entry in entries if entry["preview_kind"] == "iframe" and entry["preview_url"]), None)
    if demo is None:
        return None, design.get("promote_blocker") or "Vista previa no disponible"
    manifest = {key: value for key, value in design.items() if key != "legacy"}
    manifest.update(schema_version=1, promotable=True, promote_blocker=None,
                    preview_url=demo["preview_url"], source_type="legacy_catalog")
    return manifest, {**catalog, "entries": entries}


def bootstrap(adapter: FilesystemShowcaseAdapter, *, design_id: str = "vida-en-escena",
              apply: bool = False, confirm_ownership: bool = False):
    if apply and not confirm_ownership:
        raise ShowcaseInvalid("La inicialización requiere confirmar la pertenencia del diseño al perfil")
    managed_row = next((row for row in adapter._rows() if row.get("id") == design_id), None)
    if managed_row:
        existing = adapter._managed(managed_row)
        current_catalog = adapter.get_catalog(design_id)
        if apply and adapter.schema_version == 1:
            with adapter._lock():
                if not adapter.allow_legacy_repo():
                    _write(_safe(adapter.data, "showcase", "legacy-source.json"), {"schema_version": 1, "owned": True})
        return {"id": design_id, "status": "already_present", "entries": len(current_catalog["entries"]),
                "episodes": len(existing.get("episodes", []))}
    source = _planning_adapter(adapter, confirm_ownership)
    manifest, catalog = _definition(source, design_id)
    if manifest is None:
        return {"id": design_id, "status": "blocked", "reason": catalog}
    ident = manifest["id"]
    existing = adapter.get_design(ident)
    if existing and not existing.get("legacy"):
        if existing.get("engine_id") != manifest["engine_id"]:
            raise ShowcaseConflict("ID de diseño ya utilizado")
        if apply and adapter.schema_version == 1:
            with adapter._lock():
                if not adapter.allow_legacy_repo():
                    _write(_safe(adapter.data, "showcase", "legacy-source.json"), {"schema_version": 1, "owned": True})
        return {
            "id": ident,
            "status": "already_present",
            "entries": len(catalog["entries"]),
            "episodes": len(manifest["episodes"]),
        }
    row = {"id": ident, "category": manifest["category"], "state": "prueba"}
    destination = adapter._bundle(row)
    if destination.exists():
        raise ShowcaseConflict("Ya existe una carpeta de diseño sin registrar")
    if not apply:
        return {
            "id": ident,
            "status": "plan",
            "entries": len(catalog["entries"]),
            "episodes": len(manifest["episodes"]),
        }
    with adapter._lock():
        existing = adapter.get_design(ident)
        if existing and not existing.get("legacy"):
            if existing.get("engine_id") != manifest["engine_id"]:
                raise ShowcaseConflict("ID de diseño ya utilizado")
            current = adapter.get_catalog(ident)
            return {"id": ident, "status": "already_present", "entries": len(current["entries"]),
                    "episodes": len(existing.get("episodes", []))}
        if destination.exists():
            raise ShowcaseConflict("El diseño apareció durante la preparación")
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temp = Path(tempfile.mkdtemp(prefix=".design-stage-", dir=destination.parent))
        marker = ".bootstrap-" + uuid.uuid4().hex
        journal = adapter.runtime / "promotion.json"
        try:
            from src.adapters.showcase.guides import ensure_design_guides

            ensure_design_guides(adapter.root, manifest["category"], temp, ident)
            for name in REQUIRED_DIRS:
                (temp / name).mkdir(mode=0o700)
            _write(temp / "design.json", manifest)
            _write(temp / "catalog.json", catalog)
            from html import escape
            (temp / "showcase.html").write_text(
                '<!doctype html><title>Muestra</title><iframe title="Muestra" src="'
                + escape(manifest["preview_url"], quote=True) + '"></iframe>', encoding="utf-8")
            (temp / marker).write_text("", encoding="utf-8")
            _write(journal, {"kind": "bootstrap", "row": row, "marker": marker,
                             "own_legacy": adapter.schema_version == 1})
            os.rename(temp, destination)
            _write(_safe(adapter.data, "showcase", "designs.json"), [*adapter._rows(), row])
            if adapter.schema_version == 1:
                _write(_safe(adapter.data, "showcase", "legacy-source.json"), {"schema_version": 1, "owned": True})
            (destination / marker).unlink()
            journal.unlink()
        except BaseException:
            if journal.exists():
                adapter._recover()
            raise
        finally:
            if temp.exists():
                shutil.rmtree(temp)
    return {"id": ident, "status": "created", "entries": len(catalog["entries"]), "episodes": len(manifest["episodes"])}


def bootstrap_all(adapter: FilesystemShowcaseAdapter, *, apply: bool = False, confirm_ownership: bool = False):
    from src.adapters.showcase.legacy_catalogs import legacy_designs

    if apply and not confirm_ownership:
        raise ShowcaseInvalid("La inicialización requiere confirmar la pertenencia del diseño al perfil")
    source = _planning_adapter(adapter, confirm_ownership)
    candidates = set(legacy_designs(source))
    if (source.templates / "sandbox/nodeaction/_vida/showcase/components.json").is_file():
        candidates.add("vida-en-escena")
    # Include previously managed bundles so repeated --all calls remain informative and idempotent.
    candidates.update(row["id"] for row in adapter._rows())
    results = []
    for ident in sorted(candidates):
        try:
            results.append(bootstrap(adapter, design_id=ident, apply=apply, confirm_ownership=confirm_ownership))
        except ShowcaseInvalid as exc:
            results.append({"id": ident, "status": "blocked", "reason": str(exc)})
    return {"status": "applied" if apply else "plan", "designs": results,
            "ownership_required": adapter.schema_version == 1 and not adapter.allow_legacy_repo() and not confirm_ownership}
