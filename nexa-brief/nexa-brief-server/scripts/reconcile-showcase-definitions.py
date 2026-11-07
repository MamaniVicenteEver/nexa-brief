#!/usr/bin/env python3
"""Plan or reconcile local design state with shared definitions; never move assets."""

from __future__ import annotations
import argparse
import asyncio
import json
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER))
from src.adapters.showcase.filesystem import _id, _read, _safe  # noqa: E402
from src.adapters.showcase.shared_definitions import SharedDefinitionsShowcaseAdapter  # noqa: E402
from src.config.settings import settings  # noqa: E402
from src.core.data import get_data_store  # noqa: E402
from src.core.showcase.ports import ShowcaseInvalid  # noqa: E402


def plan(adapter):
    states = adapter._states()
    old_index = _safe(adapter.root, "data", "showcase", "designs.json")
    old = _read(old_index) if old_index.exists() else []
    if not isinstance(old, list):
        raise ShowcaseInvalid("Índice anterior inválido")
    legacy = {}
    for row in old:
        if not isinstance(row, dict):
            raise ShowcaseInvalid("Índice anterior inválido")
        ident = _id(row.get("id"))
        if ident in legacy or row.get("state") not in ("prueba", "produccion"):
            raise ShowcaseInvalid("Estado anterior inválido o duplicado")
        legacy[ident] = row["state"]
    changes, unavailable = [], []
    definitions = {path.name for path in adapter.definitions.iterdir() if path.is_dir() and not path.is_symlink()}
    for ident in sorted(set(states) | set(legacy) | definitions):
        definition = adapter._definition(ident)
        if not definition:
            unavailable.append(ident)
            continue
        design, _ = definition
        desired = {
            "id": ident,
            "state": states.get(ident, {}).get("state", legacy.get(ident, design["state"])),
            "definition_ref": ident,
            "revision": design["revision"],
        }
        if states.get(ident) != desired:
            changes.append(desired)
    return changes, unavailable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile-dir", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        root = Path(args.profile_dir)
        if not root.is_absolute() or not root.is_dir() or any(p.is_symlink() for p in (root, *root.parents)):
            raise ShowcaseInvalid("Perfil absoluto no válido")
        profile = _read(_safe(root, "profile.json"))
        if not isinstance(profile, dict) or profile.get("schema_version") != 3:
            raise ShowcaseInvalid("La reconciliación requiere un perfil v3")
        settings.storage_profile_dir = root
        settings.storage_layout_version = 3
        settings.data_dir = root / "data"
        adapter = SharedDefinitionsShowcaseAdapter(root, SERVER / "src/templates")

        async def reconcile():
            async with get_data_store().coordination("showcase"):
                changes, unavailable = plan(adapter)
                if args.apply:
                    for row in changes:
                        await get_data_store().collection("showcase_designs").upsert(row, match=["id"])
                return changes, unavailable

        # A dry run does not create coordination locks or touch profile data.
        changes, unavailable = asyncio.run(reconcile()) if args.apply else plan(adapter)
        print(
            json.dumps(
                {"status": "applied" if args.apply else "plan", "changes": changes, "unavailable": unavailable},
                ensure_ascii=False,
            )
        )
        return 0
    except (OSError, ValueError, ShowcaseInvalid) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
