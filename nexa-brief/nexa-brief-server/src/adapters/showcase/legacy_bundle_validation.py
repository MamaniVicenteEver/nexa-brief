"""Validate profile-owned bundles before replacing them with shared contracts."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from src.adapters.showcase.filesystem import ENTRY, KINDS, _id, _read, _safe
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid
from src.core.showcase.state_migration import legacy_text_fingerprint


def _preview(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ShowcaseInvalid("Vista previa inválida")
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or parsed.fragment or "\\" in value:
        raise ShowcaseInvalid("Vista previa inválida")
    path = parsed.path.replace("/api/v1/explainer/files/bundled/sandbox/", "/api/v1/explainer/files/sandbox/", 1)
    return urlunsplit(("", "", path, parsed.query, ""))


def assert_legacy_bundle_equivalent(root: Path, row: dict, shared_definitions_root: Path) -> None:
    """Reject a bundle whose profile-specific contract cannot be represented losslessly.

    Only the indexed bundle's two JSON files and the matching shared pair are read.
    Errors name the design and field, never the values of profile-owned content.
    """
    if not isinstance(row, dict):
        raise ShowcaseInvalid("Registro de diseño heredado inválido")
    ident = _id(row.get("id"))
    category = _id(row.get("category"))
    state = row.get("state")
    if state not in ("prueba", "produccion"):
        raise ShowcaseInvalid(f"Diseño {ident}: estado inválido")
    if state == "prueba":
        bundle = _safe(Path(root), "sandbox", "designs", category, ident)
    else:
        bundle = _safe(Path(root), "designs", category, ident)
    shared = _safe(Path(shared_definitions_root), ident)
    if not bundle.is_dir() or not shared.is_dir():
        raise ShowcaseConflict(f"Diseño {ident}: falta bundle o definición compartida")
    try:
        manifest, catalog = _read(_safe(bundle, "design.json")), _read(_safe(bundle, "catalog.json"))
        definition, canonical = _read(_safe(shared, "design.json")), _read(_safe(shared, "catalog.json"))
    except ShowcaseInvalid as exc:
        raise ShowcaseInvalid(f"Diseño {ident}: contrato ilegible") from exc
    if not all(isinstance(value, dict) for value in (manifest, catalog, definition, canonical)):
        raise ShowcaseInvalid(f"Diseño {ident}: contrato inválido")
    for field, expected in (("id", ident), ("category", category), ("state", state)):
        if manifest.get(field) != expected:
            raise ShowcaseConflict(f"Diseño {ident}: diferencia en {field}")
    for field in ("id", "category", "engine_id"):
        if manifest.get(field) != definition.get(field):
            raise ShowcaseConflict(f"Diseño {ident}: diferencia en {field}")
    fingerprints = definition.get("legacy_presentation_sha256", {})
    if not isinstance(fingerprints, dict):
        raise ShowcaseInvalid(f"Diseño {ident}: huellas de presentación inválidas")
    for field in ("name", "description", "family"):
        value = manifest.get(field)
        if not isinstance(value, str):
            raise ShowcaseInvalid(f"Diseño {ident}: {field} inválido")
        if value != definition.get(field) and legacy_text_fingerprint(value) != fingerprints.get(field):
            raise ShowcaseConflict(f"Diseño {ident}: diferencia en {field}")
    allowed_manifest = {
        "schema_version",
        "id",
        "name",
        "category",
        "state",
        "family",
        "engine_id",
        "description",
        "revision",
        "preview_url",
        "episodes",
        "promotable",
        "promote_blocker",
        "source_type",
        "source_key",
        "definition_source",
    }
    if set(manifest) - allowed_manifest:
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en campo_adicional")
    if "definition_source" in manifest and manifest["definition_source"] != definition.get("definition_source"):
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en definition_source")
    if manifest.get("source_type") != definition.get("source_type"):
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en source_type")
    if "source_key" in manifest and not (
        ident == "vida-en-escena" and manifest["source_key"] == "sandbox/nodeaction/_vida"
    ):
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en source_key")
    old_preview = _preview(manifest.get("preview_url"))
    new_preview = _preview(definition.get("preview_url"))
    known_vida_preview = (
        "/api/v1/explainer/files/sandbox/nodeaction/_vida/showcase.html?only=characters.heladero&aspect=9x16"
    )
    if old_preview != new_preview and not (ident == "vida-en-escena" and old_preview == known_vida_preview):
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en preview_url")
    if catalog.get("design_id") != ident or canonical.get("design_id") != ident:
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en catalog.design_id")
    if set(catalog) != {"schema_version", "design_id", "revision", "entries"}:
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en catalog.campo_adicional")
    if manifest.get("schema_version") != 1 or catalog.get("schema_version") != 1:
        raise ShowcaseInvalid(f"Diseño {ident}: versión de contrato inválida")
    legacy_revisions = definition.get("legacy_revisions", [])
    if not isinstance(legacy_revisions, list) or any(not isinstance(r, str) for r in legacy_revisions):
        raise ShowcaseInvalid(f"Diseño {ident}: revisiones conocidas inválidas")
    revision = manifest.get("revision")
    if (
        not isinstance(revision, str)
        or catalog.get("revision") != revision
        or revision not in [definition.get("revision"), *legacy_revisions]
    ):
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en revision")

    def indexed(value):
        entries = value.get("entries")
        if not isinstance(entries, list) or not entries:
            raise ShowcaseConflict(f"Diseño {ident}: catálogo vacío o inválido")
        result = {}
        for entry in entries:
            if not isinstance(entry, dict):
                raise ShowcaseInvalid(f"Diseño {ident}: entrada inválida")
            entry_id = entry.get("id")
            if (
                not isinstance(entry_id, str)
                or not ENTRY.fullmatch(entry_id)
                or ".." in entry_id
                or entry_id in result
                or entry.get("kind") not in KINDS
            ):
                raise ShowcaseInvalid(f"Diseño {ident}: identidad o tipo de entrada inválido")
            result[entry_id] = entry
        return result

    actual, expected = indexed(catalog), indexed(canonical)
    if actual.keys() != expected.keys():
        raise ShowcaseConflict(f"Diseño {ident}: diferencia en catalog.entries.id")
    for entry_id, item in actual.items():
        reference = expected[entry_id]
        for field in sorted(set(item) | set(reference)):
            if field not in {
                "id",
                "name",
                "label",
                "kind",
                "summary",
                "tags",
                "params",
                "example",
                "preview_kind",
                "preview_url",
                "data",
            }:
                raise ShowcaseConflict(f"Diseño {ident}: diferencia en catalog.entries.campo_adicional")
            if field == "preview_url":
                differs = _preview(item.get(field)) != _preview(reference.get(field))
            else:
                differs = field not in item or field not in reference or item[field] != reference[field]
            if differs:
                raise ShowcaseConflict(f"Diseño {ident}: diferencia en catalog.entries.{field}")
