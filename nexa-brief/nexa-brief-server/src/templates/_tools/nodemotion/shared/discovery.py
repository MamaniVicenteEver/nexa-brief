"""Small agent catalogs derived from existing, authoritative design metadata.

This module never scans player code to invent a parameter schema. Rich showcase
contracts take precedence; production scene contracts retain their per-variant
limits; legacy configs expose observed defaults with explicit unknown bounds.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from . import assemble as engines


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _pointer(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def _source(path: Path, pointer: str) -> dict[str, str]:
    return {"path": path.relative_to(engines.TEMPLATES).as_posix(), "pointer": pointer}


def _config(entry: dict[str, Any]) -> tuple[dict[str, Any], Path, str]:
    path = engines.TEMPLATES / entry["config_json"]
    config = _load(path)
    if isinstance(config, dict) and isinstance(config.get("configs"), list) and config["configs"]:
        selected = next((i for i, item in enumerate(config["configs"])
                         if item.get("id") == config.get("activeId")), 0)
        return config["configs"][selected], path, f"/configs/{selected}"
    return config, path, ""


def contracts(design_id: str) -> list[dict[str, Any]]:
    manifest = engines.design_manifest(design_id)
    templates = _load(engines.TEMPLATES / "templates.json")["templates"]
    entry = templates[design_id]
    demo = engines.demo_folder(design_id)
    found: dict[str, dict[str, Any]] = {}
    # info es el fallback; Showcase documenta parámetros, opciones y ejemplos.
    for filename in ("info.json", "showcase/components.json"):
        path = demo / filename
        if not path.is_file():
            continue
        data = _load(path)
        for index, component in enumerate(data.get("components", [])):
            name = component.get("name") or component.get("id")
            if not name:
                continue
            previous = found.get(name, {})
            merged = {**previous.get("component", {}), **component}
            found[name] = {
                "entry_id": name, "kind": "component", "label": merged.get("label", name),
                "summary": merged.get("summary", ""), "component": merged,
                "params": merged.get("params", {}), "sources": [_source(path, f"/components/{index}")],
                "constraints_status": "documented" if merged.get("params") else "unknown",
                "unknown": [] if merged.get("params") else ["parameter validation bounds", "supported options", "text capacity"],
            }
    production = engines.ROOT / "promo" / "production" / "templates" / f"{design_id}.json"
    if production.is_file():
        source = _load(production)
        scenes: dict[str, list[tuple[int, dict]]] = defaultdict(list)
        cycles: dict[str, list[tuple[int, dict]]] = defaultdict(list)
        for index, scene in enumerate(source.get("default_scenes", [])):
            if isinstance(scene, dict) and isinstance(scene.get("type"), str):
                scenes[scene["type"]].append((index, scene))
        for index, scene in enumerate(source.get("scene_cycle", [])):
            if isinstance(scene, dict) and isinstance(scene.get("type"), str):
                cycles[scene["type"]].append((index, scene))
        for name, variants in scenes.items():
            details = cycles.get(name, [])
            notes = {key: value for key, value in source.items()
                     if key in ("scene_cycle_note", "max_text_lines_note", "design_limitations", "script", "brand_texts")}
            found["scene." + name] = {
                "entry_id": "scene." + name, "name": name, "kind": "scene", "label": name,
                "summary": next((item.get("shows") for _, item in details if item.get("shows")), f"Existing scene type: {name}."),
                "variants": [item for _, item in variants], "scene_cycle": [item for _, item in details],
                "notes": notes,
                "sources": [_source(production, f"/default_scenes/{index}") for index, _ in variants]
                           + [_source(production, f"/scene_cycle/{index}") for index, _ in details],
                "constraints_status": "documented_per_variant", "unknown": ["validation rules not explicitly present in the cited source"],
            }
    config, config_path, prefix = _config(entry)
    if not isinstance(config, dict):
        return list(found.values())

    def observed(entry_id: str, kind: str, name: str, value: Any, pointer: str) -> None:
        if entry_id in found:
            return
        params = {key: {"default": item} for key, item in value.items()} if isinstance(value, dict) else {}
        found[entry_id] = {
            "entry_id": entry_id, "name": name, "kind": kind, "label": name,
            "summary": f"Existing {kind} configuration: {name}.",
            "params": params, "example": value, "sources": [_source(config_path, pointer)],
            "constraints_status": "observed_defaults_only",
            "unknown": ["validation bounds", "supported options beyond the example", "text capacity"],
            "note": "These are existing example values, not an inferred parameter schema or a guarantee of valid alternatives.",
        }

    for key, value in config.items():
        if key in ("id", "description", "audio", "lyricsUrl", "seed", "debug", "media"):
            continue
        if key == "layouts" and isinstance(value, dict):
            for name, layout in value.items():
                observed("layout." + name, "layout", name, layout, prefix + "/layouts/" + _pointer(name))
        elif key == "scenes" and isinstance(value, list):
            for index, scene in enumerate(value):
                if isinstance(scene, dict) and isinstance(scene.get("type"), str):
                    name = scene["type"]
                    observed("scene." + name, "scene", name, scene, prefix + f"/scenes/{index}")
        else:
            observed("config." + key, "configuration", key, value, prefix + "/" + _pointer(key))
    return list(found.values())


def catalog(design_id: str) -> dict[str, Any]:
    manifest = engines.design_manifest(design_id)
    template = _load(engines.TEMPLATES / "templates.json")["templates"][design_id]
    result = {"schema_version": 1, "generated": True, "design_id": design_id,
              "family": manifest["family"], "display_name": template.get("display_name"),
              "description": template.get("description"), "inputs": template.get("inputs", {}),
              "config_json": template.get("config_json"), "config_prompt": template.get("config_prompt"),
              "runtime_assets": template.get("runtime_assets", []), "contract_sources": manifest.get("contract_sources", {}),
              "lookup": "/api/v1/templates/" + design_id + "/components/{entry_id}", "entries": []}
    for index, contract in enumerate(contracts(design_id), 1):
        result["entries"].append({key: contract[key] for key in ("entry_id", "kind", "label", "summary", "constraints_status")}
                                 | {"id": contract["entry_id"], "contract": f"contracts/{index:03d}-{contract['kind']}.json"})
    return result


def component_contract(design_id: str, entry_id: str) -> dict[str, Any]:
    for contract in contracts(design_id):
        if contract["entry_id"] == entry_id:
            return {"schema_version": 1, "generated": True, "design_id": design_id, "id": contract["entry_id"], **contract}
    raise KeyError(f"Unknown NodeMotion component contract: {design_id}/{entry_id}")


def refresh(design_id: str) -> None:
    """Materialize small, derived catalog artifacts for filesystem-only agents."""
    root = engines._design_root(design_id)
    index = catalog(design_id)
    (root / "catalog.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    directory = root / "contracts"
    directory.mkdir(exist_ok=True)
    expected = set()
    for item in index["entries"]:
        path = root / item["contract"]
        expected.add(path)
        path.write_text(json.dumps(component_contract(design_id, item["entry_id"]), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for path in directory.glob("*.json"):
        if path not in expected:
            path.unlink()
    lines = [f"# {design_id}", "", "Read `catalog.json` to select a component, then only its contract in `contracts/`.", "",
             "These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.", "",
             "Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.", "",
             "An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.", "",
             "| Entry ID | Kind | Summary | Contract |", "| --- | --- | --- | --- |"]
    for item in index["entries"]:
        summary = item["summary"].replace("|", "\\|").replace("\n", " ")
        lines.append(f"| `{item['entry_id']}` | {item['kind']} | {summary} | [{item['entry_id']}]({item['contract']}) |")
    lines += ["", "Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.",
              "Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.", ""]
    (root / "QUICK.md").write_text("\n".join(lines), encoding="utf-8")
