#!/usr/bin/env python3
"""One-time, lossless NodeMotion engine extraction and integrity verification.

No profiles, media, template selection, config, lyrics, or stable IDs are changed.
Run from the server root: python3 src/templates/_tools/nodemotion/shared/extract.py --extract
Use --check for a read-only verification after migration.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))
from src.templates._tools.nodemotion.shared import assemble as engine

ENGLISH_NAMES = engine.ENGLISH_RUNTIME_NAMES


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def thin_entry(design_id: str) -> bytes:
    # La API entrega el documento antes de abrirlo; este fallback sirve en hosts
    # que publican el archivo sin el resolvedor compartido de NodeMotion.
    return (f'<!DOCTYPE html>\n<html lang="es"><head><meta charset="UTF-8">\n'
            f'<meta name="nodemotion-design" content="{design_id}">\n'
            f'<title>NodeMotion · {design_id}</title></head><body>\n'
            '<script>(async function(){\n'
            f'  const response = await fetch("/api/v1/templates/{design_id}/source");\n'
            '  if (!response.ok) throw new Error("Shared NodeMotion source is unavailable");\n'
            '  const html = await response.text();\n'
            '  document.open(); document.write(html); document.close();\n'
            '})();</script>\n</body></html>\n').encode("utf-8")


def entries() -> dict:
    templates = json.loads((engine.TEMPLATES / "templates.json").read_text(encoding="utf-8"))["templates"]
    return {key: value for key, value in templates.items()
            if value.get("folder", "").startswith(("nodemotion/lyrics/", "nodemotion/commercial/"))}


def extract(design_id: str, entry: dict) -> None:
    demo = engine.TEMPLATES / entry["folder"]
    source = demo / "index.html"
    html = source.read_bytes()
    if engine.registered(design_id):
        if b'<meta name="nodemotion-design"' not in html:
            raise ValueError(f"{design_id}: registered engine still has an editable demo implementation")
        verify(design_id)
        return
    family = "lyrics" if entry["folder"].startswith("nodemotion/lyrics/") else "promo"
    root = engine.ROOT / family / "designs" / design_id
    root.mkdir(parents=True, exist_ok=True)
    document, fragments, files = engine.split_document(html)
    aliases, runtime_hashes = {}, {}
    runtime = sorted(path for path in demo.rglob("*") if path.is_file()
                     and (path.suffix.lower() in (".js", ".css")
                          or (path.suffix.lower() == ".html" and path != source)))
    for path in runtime:
        relative = path.relative_to(demo).as_posix()
        canonical_parts = [ENGLISH_NAMES.get(part, part) for part in Path(relative).parts]
        canonical = "runtime/" + "/".join(canonical_parts)
        if canonical in aliases.values():
            raise ValueError(f"English runtime path collision: {design_id}/{relative}")
        aliases[relative] = canonical
        runtime_hashes[relative] = sha256(path.read_bytes())
        files[canonical] = path.read_bytes()
    for relative, data in files.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (root / "document.html").write_bytes(document)
    contracts = {"template": "templates.json#templates/" + design_id,
                 "config": entry.get("config_json")}
    for name in ("info.json", "showcase/components.json", "DESIGN.md", "README.md"):
        if (demo / name).is_file():
            contracts[name] = (Path(entry["folder"]) / name).as_posix()
    manifest = {
        "schema_version": 1, "design_id": design_id, "family": family,
        "demo_folder": entry["folder"], "document": "document.html",
        "fragments": fragments, "runtime_aliases": aliases,
        "runtime_assets": entry.get("runtime_assets", []),
        "source_sha256": sha256(html), "migration_source_sha256": sha256(html),
        "migration_runtime_sha256": runtime_hashes,
        "contract_sources": contracts,
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if engine.assemble(design_id) != html:
        raise ValueError(f"Byte equivalence failed before removing demo implementation: {design_id}")
    for relative, path in engine.runtime_assets(design_id).items():
        if sha256(path.read_bytes()) != runtime_hashes[relative]:
            raise ValueError(f"Runtime equivalence failed: {design_id}/{relative}")
    contract = {"schema_version": 1, "design_id": design_id, "family": family,
                "source_of_truth": "templates.json#templates/" + design_id,
                "config_json": entry.get("config_json"), "config_prompt": entry.get("config_prompt"),
                "inputs": entry.get("inputs", {}), "sources": contracts,
                "component_parameters": "Read existing showcase/components.json when present; otherwise use the existing config and DESIGN.md. No inferred parameter schema."}
    (root / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    quick = (f"# {design_id}\n\n"
             f"Shared {family} engine; stable design ID `{design_id}`.\n\n"
             "For content work read `contract.json`, the existing config, and only the selected component contract. "
             "Use config, lyrics, and media data; never copy or edit the engine in a project.\n\n"
             "`manifest.json` preserves the exact inline script/style order and maps legacy component URLs to English source filenames. "
             "`document.html`, `scripts/`, `styles/`, and `runtime/` are shared implementation. "
             "The demo folder retains its data and a thin entry; API, static preview, and recorder consumers resolve this engine.\n\n"
             "After an authorized engine change run the shared extraction integrity check and the NodeMotion tests. "
             "Generated designs are updated by their shared compiler through `update_engine`, not by editing their demo entry.\n")
    (root / "QUICK.md").write_text(quick, encoding="utf-8")
    # Solo después de comprobar todos los bytes se retira la implementación duplicada.
    source.write_bytes(thin_entry(design_id))
    for path in runtime:
        path.unlink()
    for path in sorted((p for p in demo.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
        if not any(path.iterdir()):
            path.rmdir()
    verify(design_id)


def verify(design_id: str) -> dict:
    manifest = engine.design_manifest(design_id)
    html = engine.assemble(design_id)
    if sha256(html) != manifest["source_sha256"]:
        raise ValueError(f"Document integrity mismatch: {design_id}")
    marker = f'<meta name="nodemotion-design" content="{design_id}">'.encode("ascii")
    if marker not in (engine.demo_folder(design_id) / "index.html").read_bytes():
        raise ValueError(f"Missing thin entry: {design_id}")
    for relative, path in engine.runtime_assets(design_id).items():
        if sha256(path.read_bytes()) != manifest["migration_runtime_sha256"][relative]:
            raise ValueError(f"Runtime integrity mismatch: {design_id}/{relative}")
        if (engine.demo_folder(design_id) / relative).exists():
            raise ValueError(f"Duplicate editable runtime: {design_id}/{relative}")
    return {"design_id": design_id, "html_bytes": len(html),
            "source_sha256": sha256(html), "runtime_files": len(manifest["runtime_aliases"]),
            "revision": engine.engine_revision(design_id)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--extract", action="store_true")
    action.add_argument("--check", action="store_true")
    parser.add_argument("design_ids", nargs="*")
    args = parser.parse_args()
    registry = entries()
    selected = args.design_ids or sorted(registry)
    for design_id in selected:
        if design_id not in registry:
            parser.error(f"Not a registered lyrics or promo design: {design_id}")
        if args.extract:
            extract(design_id, registry[design_id])
        print(json.dumps(verify(design_id), ensure_ascii=False))
    if args.extract:
        catalog = {"schema_version": 1, "designs": [
            {"design_id": key, "family": engine.design_manifest(key)["family"],
             "manifest": str((engine._design_root(key) / "manifest.json").relative_to(engine.ROOT)),
             "contract": str((engine._design_root(key) / "contract.json").relative_to(engine.ROOT)),
             "quick": str((engine._design_root(key) / "QUICK.md").relative_to(engine.ROOT)),
             "catalog": str((engine._design_root(key) / "catalog.json").relative_to(engine.ROOT))}
            for key in engine.design_ids()]}
        (engine.ROOT / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
        sys.path.insert(0, str(engine.TEMPLATES.parents[1]))
        from src.templates._tools.nodemotion.shared.discovery import refresh
        for design_id in engine.design_ids():
            refresh(design_id)


if __name__ == "__main__":
    main()
