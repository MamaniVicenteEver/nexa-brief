#!/usr/bin/env python3
"""Plan or bootstrap known legacy design bundles without changing episodes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER))

from src.adapters.showcase.bootstrap import bootstrap, bootstrap_all  # noqa: E402
from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter, _safe  # noqa: E402
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile-dir", required=True)
    parser.add_argument("--templates-dir", default=str(SERVER / "src/templates"))
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--design", help="ID de un diseño heredado")
    selection.add_argument("--all", action="store_true", help="Considera todos los diseños adaptables")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Crea el bundle e índice; por defecto solo muestra el plan")
    mode.add_argument("--dry-run", action="store_true", help="Muestra el plan sin modificar el perfil")
    parser.add_argument(
        "--confirm-ownership", action="store_true", help="Confirma que el diseño legado pertenece al perfil"
    )
    args = parser.parse_args()
    try:
        root, templates = Path(args.profile_dir), Path(args.templates_dir)
        if not root.is_absolute() or not templates.is_absolute() or not root.is_dir() or not templates.is_dir():
            raise ShowcaseInvalid("Se requieren directorios absolutos existentes")
        if any(p.is_symlink() for p in (root, *root.parents, templates, *templates.parents)):
            raise ShowcaseInvalid("Las raíces no admiten enlaces simbólicos")
        if root == templates or root.is_relative_to(templates) or templates.is_relative_to(root):
            raise ShowcaseInvalid("El perfil y las plantillas deben ser independientes")
        manifest = json.loads(_safe(root, "profile.json").read_text(encoding="utf-8"))
        if (
            not isinstance(manifest, dict)
            or type(manifest.get("schema_version")) is not int
            or manifest["schema_version"] not in (1, 2)
        ):
            raise ShowcaseInvalid("Manifiesto de perfil inválido")
        adapter = FilesystemShowcaseAdapter(root, templates, schema_version=manifest["schema_version"])
        result = (bootstrap(adapter, design_id=args.design, apply=args.apply, confirm_ownership=args.confirm_ownership)
                  if args.design else bootstrap_all(adapter, apply=args.apply, confirm_ownership=args.confirm_ownership))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ShowcaseInvalid, ShowcaseConflict, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
