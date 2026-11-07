"""Relate existing production manifests to built-in designs without reading media."""
from __future__ import annotations

import json
import re

from src.core.showcase.ports import ShowcaseConflict

_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
_SKIP = {"muestras", "work", "render", "assets", "sandbox", "_tools"}


def builtin_episode_relations(adapter, builtin_ids: set[str]) -> dict[str, list[dict]]:
    if adapter.schema_version == 1:
        if not adapter.allow_legacy_repo():
            return {}
        root = adapter.templates
        prefix = "/api/v1/explainer/files"
    else:
        root = adapter.root / "productions"
        prefix = "/api/v1/explainer/files/productions"
    if any(path.is_symlink() for path in (root, *root.parents)) or not root.is_dir():
        return {}
    from src.core.categories import explainer_folders
    relations: dict[str, list[dict]] = {}
    seen = set()
    for folder in sorted(explainer_folders()):
        if not _ID.fullmatch(folder) or folder in _SKIP:
            continue
        category = root / folder
        if category.is_symlink() or not category.is_dir():
            continue
        for project in sorted(category.iterdir()):
            if project.name in _SKIP or not _ID.fullmatch(project.name) or project.is_symlink() or not project.is_dir():
                continue
            manifest = project / "manifest.json"
            if manifest.is_symlink() or not manifest.is_file():
                continue
            try:
                if manifest.stat().st_size > 2_000_000:
                    continue
                data = json.loads(manifest.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if (not isinstance(data, dict) or not isinstance(data.get("design"), str)
                    or data["design"] not in builtin_ids):
                continue
            ident = data.get("video_id", project.name)
            if not isinstance(ident, str) or not _ID.fullmatch(ident):
                continue
            if ident in seen:
                raise ShowcaseConflict("ID de episodio duplicado en producciones")
            seen.add(ident)
            index = project / "index.html"
            preview = f"{prefix}/{folder}/{project.name}/index.html" if not index.is_symlink() and index.is_file() else None
            design_id = data["design"]
            title = data.get("title")
            relations.setdefault(design_id, []).append({"id": ident, "title": title if isinstance(title, str) and title else ident,
                                                       "design_id": design_id, "preview_url": preview})
    return relations
