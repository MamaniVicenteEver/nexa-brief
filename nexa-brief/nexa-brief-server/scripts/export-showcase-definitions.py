#!/usr/bin/env python3
"""Build the public, versioned Showcase contracts from repository engine metadata."""

from __future__ import annotations
import argparse
import hashlib
import json
import sys
import tempfile
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER))
from src.adapters.showcase.filesystem import FILES_PREFIX, FilesystemShowcaseAdapter, _entry, _read  # noqa: E402
from src.adapters.showcase.legacy_catalogs import _catalog, legacy_entry_preview  # noqa: E402
from src.core.showcase.models import Catalog, Design  # noqa: E402
from src.core.showcase.state_migration import legacy_text_fingerprint  # noqa: E402

LEGACY = {
    "cara-a-cara": ("nodeaction", "Cara a Cara", "Comparaciones con personajes y escenas."),
    "atlas-cinematico": ("nodehistory", "Atlas Cinemático", "Mapas cinematográficos y visualización geográfica."),
    "atlas-en-movimiento": ("nodehistory", "Atlas en Movimiento", "Mapas tácticos y animación de unidades."),
}


def contracts(templates: Path):
    with tempfile.TemporaryDirectory(prefix="showcase-definitions-") as temporary:
        adapter = FilesystemShowcaseAdapter(Path(temporary), templates, schema_version=1)
        for ident, design in adapter._builtin().items():
            catalog = adapter.get_catalog(ident)
            yield clean(design, catalog, default_state="produccion", source="builtin")
        for ident, (category, name, description) in LEGACY.items():
            info = _read(templates / "sandbox" / category / ident / "info.json")
            entries, gallery, _ = _catalog(adapter, templates / "sandbox", f"{category}/{ident}", info, ident)
            for entry in entries:
                if entry["preview_url"] and entry["preview_kind"] != "image":
                    entry["preview_url"] = legacy_entry_preview(entry, gallery, "9x16")
            design = {
                "id": ident,
                "name": name,
                "category": category,
                "state": "prueba",
                "family": ident,
                "engine_id": info.get("engine") or "desconocido",
                "description": description,
                "revision": "1",
                "preview_url": next(
                    (e["preview_url"] for e in entries if e["preview_url"] and e["preview_kind"] == "iframe"), None
                ),
                "episodes": [],
                "source_type": "legacy_catalog",
                "legacy_revisions": ["1"],
                "legacy_presentation_sha256": {
                    "name": legacy_text_fingerprint(str(info.get("title") or ident)),
                    "description": legacy_text_fingerprint(str(info.get("summary") or "")),
                    "family": legacy_text_fingerprint(ident),
                },
            }
            yield clean(
                design,
                {"design_id": ident, "schema_version": 1, "revision": "1", "entries": entries},
                default_state="prueba",
                source="legacy",
            )
        source = _read(templates / "sandbox/nodeaction/_vida/showcase/components.json")
        entries = [_entry(c) for c in source["components"]]
        for entry in entries:
            entry["preview_url"] = f"{FILES_PREFIX}/sandbox/nodeaction/_vida/showcase.html"
        design = {
            "id": "vida-en-escena",
            "name": "Vida en Escena",
            "category": "nodeaction",
            "state": "prueba",
            "family": "vida-en-escena",
            "engine_id": "nodeaction/_vida",
            "description": "Historias con personajes y escenarios reutilizables.",
            "revision": "1",
            "preview_url": f"{FILES_PREFIX}/sandbox/nodeaction/_vida/showcase.html",
            "episodes": [],
        }
        legacy_digest = hashlib.sha256()
        for relative in ("showcase/components.json", "showcase.js", "player.js", "catalog.json"):
            legacy_digest.update((templates / "sandbox/nodeaction/_vida" / relative).read_bytes())
            legacy_digest.update(b"\0")
        design["legacy_revisions"] = [legacy_digest.hexdigest()]
        yield clean(
            design,
            {"design_id": design["id"], "schema_version": 1, "revision": "1", "entries": entries},
            default_state="prueba",
            source="vida",
        )


def clean(design, catalog, *, default_state, source):
    design = {
        k: v
        for k, v in design.items()
        if k not in {"builtin", "legacy", "promotable", "promote_blocker", "catalog_url"}
    }
    design.update(state=default_state, episodes=[], definition_source=source, schema_version=1)
    catalog = {**catalog, "revision": "", "schema_version": 1}
    design["revision"] = ""
    digest = hashlib.sha256(
        json.dumps([design, catalog], sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    design["revision"] = catalog["revision"] = digest
    Design.model_validate(design)
    Catalog.model_validate(catalog)
    return design, catalog


def serialized(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Write repository definitions; default checks them.")
    args = parser.parse_args()
    base = SERVER / "src/templates/_tools/design-definitions"
    expected = {}
    for design, catalog in contracts(SERVER / "src/templates"):
        for filename, value in [("design.json", design), ("catalog.json", catalog)]:
            expected[base / design["id"] / filename] = serialized(value)
    if args.write:
        for path, contents in expected.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(contents, encoding="utf-8")
    missing = [
        str(p.relative_to(base)) for p, c in expected.items() if not p.is_file() or p.read_text(encoding="utf-8") != c
    ]
    extra = sorted(str(p.relative_to(base)) for p in base.glob("*/design.json") if p not in expected)
    print(json.dumps({"designs": len(expected) // 2, "different": missing, "extra": extra}, ensure_ascii=False))
    return bool(missing or extra)


if __name__ == "__main__":
    sys.exit(main())
