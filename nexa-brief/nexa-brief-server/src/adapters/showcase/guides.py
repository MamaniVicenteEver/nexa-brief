"""Install profile instructions without replacing an owner's existing guides."""
from __future__ import annotations

import os
import re
from pathlib import Path

from src.config.design_guides import DESIGN_GUIDE
from src.core.showcase.ports import ShowcaseInvalid


def _check_directory(path: Path) -> None:
    for ancestor in (path, *path.parents):
        if ancestor.is_symlink():
            raise ShowcaseInvalid("Las guías no admiten enlaces simbólicos")
    if path.exists() and not path.is_dir():
        raise ShowcaseInvalid("La ubicación de las guías no es una carpeta")


def ensure_design_guides(profile_root: Path, category: str, bundle: Path, design_id: str) -> list[Path]:
    """Create missing root/category/bundle guides; never read or overwrite a guide."""
    root, bundle = Path(profile_root), Path(bundle)
    if not root.is_absolute() or not bundle.is_absolute() or not all(
        re.fullmatch(r"[a-z][a-z0-9_-]{0,127}", value) for value in (category, design_id)
    ):
        raise ShowcaseInvalid("Identidad de guía inválida")
    categories = (root / "designs" / category, root / "sandbox/designs" / category)
    if not any(bundle.is_relative_to(path) and bundle != path for path in categories):
        raise ShowcaseInvalid("Bundle fuera de las carpetas de diseños del perfil")
    locations = (root / "designs", root / "sandbox/designs", *categories, bundle)
    created = []
    for directory in locations:
        _check_directory(directory)
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        _check_directory(directory)
        body = DESIGN_GUIDE
        if directory == bundle:
            body += f"\nDiseño asignado: `{design_id}`. Categoría: `{category}`.\nConsulta `design.json` para su estado y revisión actuales.\n"
        for name in ("AGENTS.md", "CLAUDE.md"):
            target = directory / name
            if target.is_symlink():
                raise ShowcaseInvalid("Las guías no admiten enlaces simbólicos")
            try:
                fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
            except FileExistsError:
                if not target.is_file() or target.is_symlink():
                    raise ShowcaseInvalid("La guía existente no es un archivo regular")
                continue
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(body)
                stream.flush()
                os.fsync(stream.fileno())
            created.append(target)
    return created
