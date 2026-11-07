"""Instantáneas derivadas y versionadas de los catálogos de código existentes."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlencode

from src.config.settings import settings
from src.core.content_registry import _layout
from src.core.data import documents

_ID = re.compile(r"^[a-z][a-z0-9_-]*$")
_COMPONENT = re.compile(r"^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$")
_SAMPLES_INDEX = "nodetech/muestras/index.json"


def snapshot_catalog() -> dict:
    """Extrae identidades y procedencia; nunca copia defaults ni edita las fuentes."""
    _layout()
    base = settings.templates_dir.resolve()
    sources = {}
    missing = []

    def read(relative: str):
        key = Path(relative)
        if (key.is_absolute() or ".." in key.parts or "\\" in relative
                or key.suffix != ".json" or any(part.startswith(".") for part in key.parts)
                or key.name in {"accounts.json", "users.json"} or key.name.startswith("client_secret")):
            return None
        current = base
        for part in key.parts:
            current = current / part
            if current.is_symlink():
                return None
        path = current.resolve()
        if not path.is_relative_to(base) or not path.is_file():
            missing.append(relative)
            return None
        raw = path.read_bytes()
        try:
            parsed = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            return None
        sources[relative] = hashlib.sha256(raw).hexdigest()
        return parsed

    templates = read("templates.json") or {}
    designs = read("_tools/explainer-kit/designs/index.json") or {}
    engines = read("_tools/sandbox/engines.json") or []
    result = {
        "schema_version": 1,
        "templates": [{"id": item, "source": "templates.json"} for item in sorted(templates.get("templates", {}))],
        "designs": [{"id": item, "source": "_tools/explainer-kit/designs/index.json"}
                    for item in designs.get("designs", []) if isinstance(item, str)],
        "engines": [], "components": [], "samples": [],
    }
    for engine in engines:
        if not isinstance(engine, dict) or not isinstance(engine.get("id"), str):
            continue
        engine_id = engine["id"]
        result["engines"].append({"id": engine_id, "source": "_tools/sandbox/engines.json"})
        component_source = engine.get("components")
        if not isinstance(component_source, str):
            continue
        definition = read(component_source)
        if not isinstance(definition, dict):
            continue
        for component in definition.get("comps", []):
            if isinstance(component, dict) and isinstance(component.get("name"), str):
                result["components"].append({"id": component["name"], "engine_id": engine_id,
                                             "source": component_source})
    # Only explicitly indexed repository samples are eligible. Their IDs are not
    # video IDs and they never enter the active profile's production registry.
    sample_index = read(_SAMPLES_INDEX) if (base / _SAMPLES_INDEX).is_file() else {}
    for source in sample_index.get("samples", []) if isinstance(sample_index, dict) else []:
        if not isinstance(source, str):
            continue
        parts = Path(source).parts
        if (len(parts) != 5 or parts[0:2] != ("nodetech", "muestras")
                or not _ID.fullmatch(parts[2]) or parts[3] not in {"componentes", "video-largo"}
                or parts[4] != "sample.json"):
            continue
        sample = read(source)
        if not isinstance(sample, dict):
            continue
        sample_id, design, kind = sample.get("id"), sample.get("design"), sample.get("kind")
        if (not isinstance(sample_id, str) or not _ID.fullmatch(sample_id)
                or design != parts[2] or kind != parts[3] or sample.get("category") != parts[0]):
            continue
        item = {key: sample[key] for key in ("id", "category", "design", "kind", "title", "provenance")
                if isinstance(sample.get(key), str)}
        shared = sample.get("shared_categories")
        if isinstance(shared, list):
            item["shared_categories"] = list(dict.fromkeys(
                value for value in shared if isinstance(value, str) and _ID.fullmatch(value)
                and value != sample["category"]
            ))
        item.update({"source": source, "available": False, "preview_url": None})
        component = sample.get("component")
        preview = sample.get("preview_file")
        required = sample.get("required_files")
        credits = sample.get("credits")

        def bundled_file(value):
            if not isinstance(value, str) or "\\" in value:
                return False
            if not (value.startswith("_tools/") or value.startswith("/".join(parts[:4]) + "/")):
                return False
            if any(p in {".", ".."} or p.startswith(".") for p in value.split("/")):
                return False
            current = base
            for part in Path(value).parts:
                current = current / part
                if current.is_symlink():
                    return False
            resolved = current.resolve()
            return resolved.is_relative_to(base) and resolved.is_file()

        ready = (isinstance(required, list) and bool(required) and bundled_file(credits)
                 and all(bundled_file(path) for path in required) and bundled_file(preview))
        if kind == "componentes":
            if (ready and isinstance(component, str) and _COMPONENT.fullmatch(component)
                    and component.startswith(design + ".")
                    and preview == "_tools/explainer-kit/showcase/stage.html"):
                query = urlencode({"d": design, "c": component, "solo": "1"})
                item.update({"available": True, "component": component,
                             "credits": credits,
                             "preview_url": "/api/v1/explainer/files/" + preview + "?" + query})
        elif ready and preview == "/".join(parts[:4]) + "/index.html":
            item.update({"available": True, "rendered": False, "credits": credits,
                         "preview_url": "/api/v1/explainer/files/bundled/" + preview + "?controls=1"})
        result["samples"].append(item)
    result["sources"] = sources
    result["missing_sources"] = missing
    canonical = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    version = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    snapshot = {**result, "version": version}
    store = documents("content_catalog_snapshots")
    if store.get(version) is None:
        store.put(version, snapshot)
    return snapshot
