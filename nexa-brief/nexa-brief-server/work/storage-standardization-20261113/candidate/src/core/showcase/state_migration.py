"""Transform legacy profile design state without touching a profile or its files."""

from __future__ import annotations

import re
import hashlib
from collections.abc import Mapping, Sequence
from typing import Any

from .ports import ShowcaseInvalid

_ID = re.compile(r"^[a-z][a-z0-9_-]{0,127}$")


def legacy_text_fingerprint(value: str) -> str:
    """Identify known public legacy presentation without storing its text."""
    if not isinstance(value, str):
        raise ShowcaseInvalid("Presentación de diseño inválida")
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def convert_legacy_designs(
    rows: Sequence[Mapping[str, Any]], definitions: Mapping[str, Mapping[str, Any]]
) -> list[dict[str, str]]:
    """Combine known default states with legacy states; refuse data loss or ambiguous IDs."""
    if not isinstance(rows, (list, tuple)) or not isinstance(definitions, Mapping):
        raise ShowcaseInvalid("Datos de diseños inválidos")
    result = {}
    for ident, definition in definitions.items():
        if (
            not isinstance(ident, str)
            or not _ID.fullmatch(ident)
            or not isinstance(definition, Mapping)
            or definition.get("state") not in ("prueba", "produccion")
            or not isinstance(definition.get("revision"), str)
            or not definition["revision"]
        ):
            raise ShowcaseInvalid("Definición de diseño inválida")
        result[ident] = {
            "id": ident,
            "state": definition["state"],
            "definition_ref": ident,
            "revision": definition["revision"],
        }
    seen = set()
    for row in rows:
        if not isinstance(row, Mapping):
            raise ShowcaseInvalid("Estado de diseño inválido")
        ident = row.get("id")
        if not isinstance(ident, str) or ident not in result:
            raise ShowcaseInvalid(f"Diseño heredado sin definición compartida: {ident!r}")
        if ident in seen or row.get("state") not in ("prueba", "produccion"):
            raise ShowcaseInvalid("Estado de diseño duplicado o inválido")
        seen.add(ident)
        result[ident]["state"] = row["state"]
    return [result[ident] for ident in sorted(result)]
