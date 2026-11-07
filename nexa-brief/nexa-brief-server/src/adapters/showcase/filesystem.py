"""Profile-owned showcase bundles and read-only legacy engine adapters."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import tempfile
import threading
from contextlib import contextmanager
from functools import wraps
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid, ShowcaseNotFound

ID = re.compile(r"^[a-z][a-z0-9_-]{0,127}$")
ENTRY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
KINDS = {"component", "set", "character", "action", "workflow"}
PRIVATE = re.compile(
    r"(token|credential|secret|password|cookie|session|private|api[_-]?key|\.(pem|key|p12|pfx)$)", re.I
)
FILES_PREFIX = "/api/v1/explainer/files"
REQUIRED_DIRS = ("components", "assets", "sets", "characters", "preview")


def _read(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ShowcaseInvalid("JSON de diseño inválido o inaccesible") from exc


def _write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".showcase-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        d = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(d)
        finally:
            os.close(d)
    finally:
        Path(name).unlink(missing_ok=True)


def _safe(root: Path, *parts: str) -> Path:
    root = Path(root)
    path = root
    if any(p.is_symlink() for p in (root, *root.parents)):
        raise ShowcaseInvalid("Raíz de diseño con enlace simbólico")
    for part in parts:
        if not part or part in {".", ".."} or "/" in part or "\\" in part or part.startswith("."):
            raise ShowcaseInvalid("Ruta de diseño inválida")
        path = path / part
        if path.is_symlink():
            raise ShowcaseInvalid("Los diseños no admiten enlaces simbólicos")
    return path


def _id(value: str) -> str:
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ShowcaseInvalid("ID de diseño inválido")
    return value


def _normal_params(params):
    if not isinstance(params, dict):
        return {}
    output = {}
    for key, val in params.items():
        if not isinstance(key, str) or not isinstance(val, dict):
            continue
        output[key] = dict(val)
    return output


def _entry(row: dict) -> dict:
    name = row.get("name") or row.get("id")
    ident = {"fx.?": "fx.symbol-question", "fx.!": "fx.symbol-exclamation"}.get(name, name)
    if not isinstance(ident, str) or not ENTRY.fullmatch(ident) or ".." in ident:
        raise ShowcaseInvalid("ID de componente inválido")
    prefix = name.split(".", 1)[0]
    kind = {"characters": "character", "sets": "set", "actions": "action", "workflows": "workflow"}.get(
        prefix, "component"
    )
    return {
        "id": ident,
        "name": name,
        "label": str(row.get("label") or name),
        "kind": kind,
        "summary": str(row.get("summary") or row.get("doc") or ""),
        "tags": row.get("tags") if isinstance(row.get("tags"), list) else [],
        "params": _normal_params(row.get("params")),
        "example": row.get("example") if isinstance(row.get("example"), dict) else {},
        "preview_kind": "iframe",
        "preview_url": None,
        "data": {"native_name": name},
    }


def _read_guard(fn):
    @wraps(fn)
    def guarded(self, *args, **kwargs):
        if getattr(self._local, "locked", False) or not (self.runtime / "lock").exists():
            return fn(self, *args, **kwargs)
        with self._lock():
            return fn(self, *args, **kwargs)

    return guarded


class FilesystemShowcaseAdapter:
    def __init__(
        self,
        profile_root: Path,
        templates_root: Path,
        *,
        data_root: Path | None = None,
        sandbox_root: Path | None = None,
        schema_version: int = 1,
    ):
        self.root = Path(profile_root)
        self.templates = Path(templates_root)
        self.data = Path(data_root) if data_root is not None else self.root / "data"
        self.sandbox = Path(sandbox_root) if sandbox_root is not None else self.root / "sandbox"
        self.production = self.root / "designs"
        self.kit = self.templates / "_tools/explainer-kit"
        self.schema_version = schema_version
        self.registry = self.data / "showcase/designs.json"
        self.runtime = self.root / ".system/runtime/showcase"
        self._local = threading.local()

    @classmethod
    def from_settings(cls):
        from src.config.settings import settings
        from src.config.profile_layout import layout_for_settings

        layout = layout_for_settings(settings)
        sandbox = layout.sandbox_dir if settings.storage_profile_dir else Path(settings.templates_dir) / "sandbox"
        if layout.schema_version == 3 and cls is FilesystemShowcaseAdapter:
            from src.adapters.showcase.shared_definitions import SharedDefinitionsShowcaseAdapter
            return SharedDefinitionsShowcaseAdapter(layout.root, Path(settings.templates_dir), data_root=layout.data_dir,
                                                    sandbox_root=sandbox)
        return cls(
            layout.root,
            Path(settings.templates_dir),
            data_root=layout.data_dir,
            sandbox_root=sandbox,
            schema_version=layout.schema_version,
        )

    def _rows(self):
        registry = _safe(self.data, "showcase", "designs.json")
        if not registry.exists():
            return []
        rows = _read(registry)
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise ShowcaseInvalid("Índice de diseños inválido")
        ids = [r.get("id") for r in rows]
        if any(not isinstance(i, str) or not ID.fullmatch(i) for i in ids):
            raise ShowcaseInvalid("ID de diseño inválido")
        if len(ids) != len(set(ids)):
            raise ShowcaseConflict("IDs duplicados en el índice")
        return rows

    def allow_legacy_repo(self):
        if self.schema_version != 1:
            return False
        marker = _safe(self.data, "showcase", "legacy-source.json")
        if not marker.exists():
            return False
        value = _read(marker)
        return isinstance(value, dict) and value.get("schema_version") == 1 and value.get("owned") is True

    def _builtin(self):
        index = self.kit / "showcase/designs.json"
        if not index.is_file():
            return {}
        ids = _read(index).get("designs", [])
        if (
            not isinstance(ids, list)
            or any(not isinstance(i, str) or not ID.fullmatch(i) for i in ids)
            or len(set(ids)) != len(ids)
        ):
            raise ShowcaseInvalid("Índice de diseños integrado inválido")
        categories = {}
        niches = self.templates.parent.parent / "niches.json"
        if niches.is_file():
            for category in _read(niches).get("categories", {}).values():
                if isinstance(category, dict):
                    for design in category.get("designs", []):
                        categories.setdefault(design, category.get("folder") or "otros")
        result = {}
        catalog_bytes = _safe(self.kit, "catalog.json").read_bytes()
        for ident in ids:
            _id(ident)
            path = _safe(self.kit, "designs", ident, "design.json")
            if not path.is_file():
                raise ShowcaseInvalid("Falta un diseño integrado")
            raw = _read(path)
            if raw.get("id", ident) != ident:
                raise ShowcaseInvalid("ID integrado inconsistente")
            revision = hashlib.sha256(path.read_bytes() + b"\0" + catalog_bytes).hexdigest()
            result[ident] = {
                "id": ident,
                "name": str(raw.get("name") or ident),
                "category": categories.get(ident, "otros"),
                "state": "produccion",
                "family": str(raw.get("family") or ident),
                "engine_id": "explainer-kit",
                "description": str(raw.get("tagline") or ""),
                "revision": revision,
                "schema_version": 1,
                "builtin": True,
                "preview_url": f"{FILES_PREFIX}/_tools/explainer-kit/showcase/index.html",
            }
        from src.adapters.showcase.episode_relations import builtin_episode_relations

        for ident, episodes in builtin_episode_relations(self, set(result)).items():
            result[ident]["episodes"] = episodes
        return result

    def _bundle(self, row):
        ident, category, state = _id(row.get("id")), _id(row.get("category")), row.get("state")
        if state not in {"prueba", "produccion"}:
            raise ShowcaseInvalid("Estado de diseño inválido")
        base = self.sandbox if state == "prueba" else self.production
        parts = ("designs", category, ident) if state == "prueba" else (category, ident)
        return _safe(base, *parts)

    def _managed(self, row):
        directory = self._bundle(row)
        manifest = _read(_safe(directory, "design.json"))
        if not isinstance(manifest, dict) or any(manifest.get(k) != row.get(k) for k in ("id", "category", "state")):
            raise ShowcaseInvalid("Ficha e índice de diseño no coinciden")
        if manifest.get("schema_version") != 1:
            raise ShowcaseInvalid("Versión de ficha desconocida")
        if manifest.get("builtin") or manifest.get("legacy"):
            raise ShowcaseInvalid("Ficha administrada inválida")
        if manifest.get("state") == "produccion":
            manifest["promotable"] = False
        if manifest.get("engine_id") == "nodeaction/_vida" and self.schema_version == 2:
            from src.adapters.showcase.bootstrap import legacy_vida

            current, _ = legacy_vida(self)
            urls = {item["id"]: item.get("preview_url") for item in current["episodes"]}
            manifest["episodes"] = [
                {**item, "preview_url": urls.get(item.get("id"))} for item in manifest.get("episodes", [])
            ]
        elif manifest.get("engine_id") == "nodeaction/_vida" and not self.allow_legacy_repo():
            manifest["episodes"] = [{**item, "preview_url": None} for item in manifest.get("episodes", [])]
        return manifest

    @_read_guard
    def list_designs(self):
        builtins = self._builtin()
        if (
            self.allow_legacy_repo()
            and (self.templates / "sandbox/nodeaction/_vida/showcase/components.json").is_file()
        ):
            from src.adapters.showcase.bootstrap import legacy_vida

            legacy, _ = legacy_vida(self)
            legacy.update(legacy=True, promotable=False, promote_blocker="Inicializa primero el bundle de este perfil")
            builtins[legacy["id"]] = legacy
        from src.adapters.showcase.legacy_catalogs import legacy_designs

        for ident, design in legacy_designs(self).items():
            if ident in builtins:
                raise ShowcaseConflict("ID de diseño integrado duplicado")
            builtins[ident] = design
        for row in self._rows():
            ident = _id(row.get("id"))
            if ident in builtins and not builtins[ident].get("legacy"):
                raise ShowcaseConflict("ID de diseño integrado ya utilizado")
            managed = self._managed(row)
            if ident in builtins and builtins[ident].get("engine_id") != managed.get("engine_id"):
                raise ShowcaseConflict("ID de diseño heredado pertenece a otro motor")
            builtins[ident] = managed
        return list(builtins.values())

    @_read_guard
    def get_design(self, design_id):
        ident = _id(design_id)
        return next((d for d in self.list_designs() if d["id"] == ident), None)

    @_read_guard
    def get_catalog(self, design_id):
        ident = _id(design_id)
        design = self.get_design(ident)
        if not design:
            return None
        if design.get("legacy") and ident == "vida-en-escena":
            from src.adapters.showcase.bootstrap import legacy_vida

            return legacy_vida(self)[1]
        if design.get("legacy"):
            from src.adapters.showcase.legacy_catalogs import legacy_catalog

            return legacy_catalog(self, ident)
        if design.get("builtin"):
            definition = _read(_safe(self.kit, "designs", ident, "design.json"))
            catalog = _read(_safe(self.kit, "catalog.json"))
            selected = definition.get("showcase", {}).get("components")
            components = catalog.get("comps", [])
            if selected:
                components = [c for c in components if c.get("name") in selected]
            else:
                components = [c for c in components if str(c.get("name", "")).startswith((ident + ".", "common."))]
            entries = [_entry(c) for c in components]
            for entry in entries:
                entry["preview_url"] = f"{FILES_PREFIX}/_tools/explainer-kit/showcase/stage.html?" + urlencode(
                    {"d": ident, "c": entry["id"]}
                )
            return {"schema_version": 1, "design_id": ident, "revision": design["revision"], "entries": entries}
        row = next(r for r in self._rows() if r["id"] == ident)
        value = _read(_safe(self._bundle(row), "catalog.json"))
        if not isinstance(value, dict) or value.get("design_id") != ident or not isinstance(value.get("entries"), list):
            raise ShowcaseInvalid("Catálogo de diseño inválido")
        ids = [entry.get("id") for entry in value["entries"] if isinstance(entry, dict)]
        if (
            len(ids) != len(value["entries"])
            or len(ids) != len(set(ids))
            or any(not isinstance(i, str) or not ENTRY.fullmatch(i) for i in ids)
        ):
            raise ShowcaseInvalid("Catálogo contiene IDs inválidos o duplicados")
        if any(e.get("kind") not in KINDS for e in value["entries"]):
            raise ShowcaseInvalid("Tipo de componente inválido")
        return value

    @_read_guard
    def preview(self, design_id, entry_id=None, format="9x16"):
        design = self.get_design(design_id)
        if not design:
            return None
        if format not in {"9x16", "16x9"}:
            raise ShowcaseInvalid("Formato inválido")
        if entry_id is not None:
            entries = self.get_catalog(design_id)["entries"]
            if not any(e["id"] == entry_id for e in entries):
                return None
        if design.get("legacy") and design_id != "vida-en-escena":
            from src.adapters.showcase.legacy_catalogs import legacy_preview

            return legacy_preview(self, design_id, entry_id, format)
        if design.get("builtin"):
            if entry_id is None:
                entries = self.get_catalog(design_id)["entries"]
                if not entries:
                    return None
                entry_id = entries[0]["id"]
            # The isolated stage has no audio track. Its controlled player must
            # use the synthetic clock and wait for the UI's playback command.
            query = {"d": design_id, "c": entry_id, "solo": "1", "controls": "1",
                     "gallery": "1", "clock": "synthetic", "format": format}
            if design_id == "imperio":
                query["isolated"] = "1"
            return f"{FILES_PREFIX}/_tools/explainer-kit/showcase/stage.html?" + urlencode(query)
        if design.get("engine_id") == "nodeaction/_vida":
            if entry_id:
                selected = next(e for e in self.get_catalog(design_id)["entries"] if e["id"] == entry_id)
                native = selected.get("data", {}).get("native_name", entry_id)
                return f"{FILES_PREFIX}/sandbox/nodeaction/_vida/showcase.html?" + urlencode(
                    {"only": native, "aspect": format}
                )
            if self.allow_legacy_repo():
                return f"{FILES_PREFIX}/sandbox/nodeaction/vida-en-escena/index.html?controls=1"
            return f"{FILES_PREFIX}/sandbox/nodeaction/_vida/showcase.html?only=characters.heladero&aspect=" + format
        if design.get("source_type") == "legacy_catalog":
            selected = next((e for e in self.get_catalog(design_id)["entries"] if e["id"] == entry_id), None) if entry_id else None
            target = selected.get("preview_url") if selected else design.get("preview_url")
            if not isinstance(target, str) or not target:
                return None
            parsed = urlsplit(target)
            params = [(key, format if key in {"aspect", "format"} else value)
                      for key, value in parse_qsl(parsed.query, keep_blank_values=True)]
            return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(params), parsed.fragment))
        return f"/api/v1/showcase/designs/{quote(design_id, safe='')}/files/showcase.html"

    @_read_guard
    def resolve_file(self, design_id, path):
        ident = _id(design_id)
        row = next((r for r in self._rows() if r.get("id") == ident), None)
        if not row:
            return None
        parts = path.split("/") if isinstance(path, str) else []
        if not parts or any(
            p.lower() in {"work", "logs", "accounts.json", "users.json", "browser_profiles", "browser-profiles"}
            or PRIVATE.search(p)
            for p in parts
        ):
            raise ShowcaseInvalid("Archivo inválido")
        target = _safe(self._bundle(row), *parts)
        if target.suffix.lower() not in {
            ".html",
            ".js",
            ".mjs",
            ".css",
            ".json",
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".avif",
            ".gif",
            ".svg",
            ".woff",
            ".woff2",
            ".ttf",
            ".mp4",
            ".mp3",
            ".wav",
            ".ogg",
            ".m4a",
        }:
            raise ShowcaseInvalid("Tipo de archivo no permitido")
        return target if target.is_file() else None

    @contextmanager
    def _lock(self):
        if getattr(self._local, "locked", False):
            yield
            return
        if any(p.is_symlink() for p in (self.runtime, *self.runtime.parents)):
            raise ShowcaseInvalid("Raíz insegura")
        self.runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.runtime.is_symlink():
            raise ShowcaseInvalid("Raíz insegura")
        fd = os.open(self.runtime / "lock", os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            self._local.locked = True
            try:
                self._recover()
                yield
            finally:
                self._local.locked = False
        finally:
            os.close(fd)

    def _recover(self):
        journal = self.runtime / "promotion.json"
        if journal.is_symlink():
            raise ShowcaseInvalid("Diario inseguro")
        if not journal.exists():
            return
        j = _read(journal)
        if j.get("kind") == "bootstrap":
            import shutil

            row, marker = j["row"], j["marker"]
            dst = self._bundle(row)
            marker_path = dst / marker
            if dst.exists():
                if row in self._rows():
                    if j.get("own_legacy") is True and not self.allow_legacy_repo():
                        _write(_safe(self.data, "showcase", "legacy-source.json"), {"schema_version": 1, "owned": True})
                    if marker_path.is_symlink():
                        raise ShowcaseConflict("Inicialización interrumpida ambigua")
                    marker_path.unlink(missing_ok=True)
                else:
                    if marker_path.is_symlink() or not marker_path.is_file():
                        raise ShowcaseConflict("Inicialización interrumpida ambigua")
                    shutil.rmtree(dst)
            journal.unlink()
            return
        before, after = j["before"], j["after"]
        src, dst = self._bundle(before), self._bundle(after)
        rows = self._rows()
        if any(row == after for row in rows):
            if not dst.is_dir():
                raise ShowcaseConflict("Promoción interrumpida; falta el destino")
        else:
            if dst.exists() and not src.exists():
                os.rename(dst, src)
            elif dst.exists() or not src.exists():
                raise ShowcaseConflict("Promoción interrumpida ambigua")
            _write(_safe(src, "design.json"), j["manifest_before"])
        journal.unlink()

    def promote(self, design_id):
        ident = _id(design_id)
        with self._lock():
            rows = self._rows()
            row = next((r for r in rows if r.get("id") == ident), None)
            if not row:
                if ident in self._builtin():
                    raise ShowcaseConflict("Los diseños integrados son de solo lectura")
                raise ShowcaseNotFound("Diseño no encontrado")
            before = self._managed(row)
            if row["state"] == "produccion":
                return before
            catalog = self.get_catalog(ident)
            try:
                from src.core.showcase.models import Catalog, Design

                validated, definition = Catalog.model_validate(catalog), Design.model_validate(before)
                if validated.revision != definition.revision:
                    raise ValueError("revision mismatch")
            except (ValueError, TypeError) as exc:
                raise ShowcaseInvalid("Ficha o catálogo incompletos") from exc
            if before.get("source_type") == "legacy_catalog":
                from src.adapters.showcase.bootstrap import _definition

                current, current_catalog = _definition(self, ident)
                if current is None:
                    raise ShowcaseInvalid("Los recursos originales del diseño ya no están completos")
                if current_catalog != catalog:
                    raise ShowcaseConflict("El catálogo original cambió; vuelve a preparar el diseño")
            source = self._bundle(row)
            if not _safe(source, "showcase.html").is_file() or any(
                not _safe(source, x).is_dir() for x in REQUIRED_DIRS
            ):
                raise ShowcaseInvalid("Bundle incompleto")
            for current, dirs, files in os.walk(source, followlinks=False):
                if any((Path(current) / n).is_symlink() for n in dirs + files):
                    raise ShowcaseInvalid("Bundle contiene enlaces simbólicos")
            after = {**row, "state": "produccion"}
            destination = self._bundle(after)
            if destination.exists():
                raise ShowcaseConflict("El destino ya existe")
            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            journal = self.runtime / "promotion.json"
            _write(journal, {"before": row, "after": after, "manifest_before": before})
            try:
                os.rename(source, destination)
                _write(_safe(destination, "design.json"), {**before, "state": "produccion"})
                _write(self.registry, [after if r["id"] == ident else r for r in rows])
                journal.unlink()
            except BaseException:
                self._recover()
                raise
            return self._managed(after)
