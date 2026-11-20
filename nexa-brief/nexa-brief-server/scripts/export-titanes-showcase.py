#!/usr/bin/env python3
"""Regenera el contrato Showcase de TITANES: componentes, personajes e imágenes.

Fuentes: el registro del kit (componentes titanes.* y comunes que TITANES carga) y la
biblioteca de capas (personajes y todas sus poses). Escribe solo
_tools/design-definitions/titanes/{design,catalog}.json. Sin --write solo comprueba.

Uso (desde nexa-brief-server/):  .venv/bin/python scripts/export-titanes-showcase.py [--write]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from urllib.parse import urlencode

SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER))
from src.adapters.showcase.filesystem import FILES_PREFIX, _entry, _read  # noqa: E402

TEMPLATES = SERVER / "src/templates"
KIT = TEMPLATES / "_tools/explainer-kit"
CAPAS = KIT / "capas"
DEFINITIONS = TEMPLATES / "_tools/design-definitions/titanes"
DESIGN = "titanes"
STAGE = f"{FILES_PREFIX}/_tools/explainer-kit/showcase/stage.html"
CAPAS_FILES = f"{FILES_PREFIX}/_tools/explainer-kit/capas/"

# Comunes que TITANES ya carga (designs/titanes/design.json: text.js y capas.js).
# Los demás comunes (clip, logo, question, tabloid) necesitan su script en el diseño.
TITANES_COMMON = ("common.capas", "common.endcard", "common.flash", "common.lyric", "common.punch", "common.tag")
CHARACTER_TYPES = {"personaje", "mano", "grupo"}
TYPE_LABELS = {"personaje": "Personaje", "mano": "Mano", "grupo": "Grupo", "objeto": "Objeto", "decorado": "Decorado"}
STATUS_LABELS = {"aprobado": "aprobado", "con-defectos": "con defectos", "descartado": "descartado"}


def _load_exporter():
    """Reutiliza clean() y serialized() del exportador existente, sin duplicar el cálculo de revisión."""
    spec = importlib.util.spec_from_file_location("export_showcase_definitions",
                                                  SERVER / "scripts/export-showcase-definitions.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def component_entry(row: dict, family: str) -> dict:
    entry = _entry(row)
    entry["family"] = family
    entry["preview_url"] = f"{STAGE}?" + urlencode({"d": DESIGN, "c": entry["id"]})
    return entry


def capas_entries(catalog: dict) -> tuple[list[dict], list[dict]]:
    characters, images = [], []
    for asset in catalog["assets"]:
        asset_id, status = asset["id"], asset["status"]
        type_label = TYPE_LABELS.get(asset["type"], asset["type"])
        status_label = STATUS_LABELS.get(status, status)
        poses = [(pose, data["file"]) for pose, data in asset["poses"].items()]
        for pose, file in poses:
            if not (CAPAS / file).is_file():
                raise SystemExit(f"Falta la pose {asset_id}/{pose}: {file}")
        pose_urls = [{"name": pose, "url": CAPAS_FILES + file} for pose, file in poses]
        for row in pose_urls:
            pose, url = row["name"], row["url"]
            images.append({
                "id": f"capas.{asset_id}.{pose}",
                "name": f"capas.{asset_id}.{pose}",
                "label": f"{asset['name']} · {pose}",
                "kind": "component",
                "summary": f"{type_label} de la biblioteca de capas, pose {pose}. Estado: {status_label}.",
                "tags": ["capas", status_label],
                "family": "capas",
                "section": "components",
                "params": {},
                "example": {},
                "preview_kind": "image",
                "preview_url": url,
                "data": {"capas": {"asset": asset_id, "pose": pose, "type": asset["type"], "status": status}},
            })
        if asset["type"] in CHARACTER_TYPES:
            characters.append({
                "id": f"capas.{asset_id}",
                "name": f"capas.{asset_id}",
                "label": asset["name"],
                "kind": "character",
                "summary": asset["description"],
                "tags": ["personaje", "capas", status_label],
                "family": "capas",
                "section": "components",
                "params": {},
                "example": {},
                "preview_kind": "image",
                "preview_url": pose_urls[0]["url"],
                "data": {
                    "character": {
                        "identity": {
                            "id": f"capas.{asset_id}",
                            "nombre": asset["name"],
                            "tema": type_label,
                            "estilo": asset["description"],
                        },
                        "poses": pose_urls,
                    },
                    "capas": {"asset": asset_id, "type": asset["type"], "status": status},
                },
            })
    return characters, images


def build(exporter):
    design_in = _read(DEFINITIONS / "design.json")
    kit_rows = {row["name"]: row for row in _read(KIT / "catalog.json")["comps"]}
    titanes = [name for name in kit_rows if name.startswith("titanes.")]
    missing = [name for name in TITANES_COMMON if name not in kit_rows]
    if missing:
        raise SystemExit(f"Faltan comunes en el kit: {missing}")
    declared = _read(KIT / "designs" / DESIGN / "design.json")["showcase"]["components"]
    if sorted(titanes) != sorted(declared):
        raise SystemExit("El registro del kit y showcase.components de TITANES no coinciden")

    characters, images = capas_entries(_read(CAPAS / "catalog.json"))
    components = [component_entry(kit_rows[name], "titanes") for name in titanes]
    commons = [component_entry(kit_rows[name], "common") for name in TITANES_COMMON]
    entries = characters + components + commons + images
    groups = [
        {"id": "personajes", "label": "Personajes", "families": [], "components": [e["name"] for e in characters]},
        {"id": "titanes", "label": "Componentes TITANES", "families": [], "components": [e["name"] for e in components]},
        {"id": "comunes", "label": "Comunes reutilizables", "families": [], "components": [e["name"] for e in commons]},
        {"id": "imagenes", "label": "Imágenes", "families": [], "components": [e["name"] for e in images]},
    ]
    design = {key: value for key, value in design_in.items() if key != "revision"}
    catalog = {"design_id": DESIGN, "schema_version": 1, "revision": "", "entries": entries, "groups": groups}
    return exporter.clean(design, catalog, default_state="prueba", source="builtin")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Escribir los contratos; por defecto solo comprueba.")
    args = parser.parse_args()
    exporter = _load_exporter()
    design, catalog = build(exporter)
    expected = {
        DEFINITIONS / "design.json": exporter.serialized(design),
        DEFINITIONS / "catalog.json": exporter.serialized(catalog),
    }
    different = [str(p.relative_to(DEFINITIONS)) for p, text in expected.items()
                 if not p.is_file() or p.read_text(encoding="utf-8") != text]
    print(json.dumps({
        "entries": len(catalog["entries"]),
        "groups": {g["id"]: len(g["components"]) for g in catalog["groups"]},
        "revision": design["revision"],
        "different": different,
    }, ensure_ascii=False))
    if args.write:
        for path, text in expected.items():
            path.write_text(text, encoding="utf-8")
        print("escrito")
    return 0


if __name__ == "__main__":
    sys.exit(main())
