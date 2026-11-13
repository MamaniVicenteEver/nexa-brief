"""Explicitly registered principal demos; never discover private legacy videos."""
from __future__ import annotations

import json
import re
from pathlib import Path

ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")


def definitions(templates: Path):
    root = templates / "_tools/design-definitions"
    if not root.is_dir() or root.is_symlink():
        return
    for path in sorted(root.glob("*/design.json")):
        if path.is_symlink() or path.parent.is_symlink():
            continue
        try:
            design = json.loads(path.read_text())
            marker = design.get("production_template")
            if not isinstance(marker, dict) or marker.get("demo") is not True:
                continue
            parts = marker.get("folder", "").split("/")
            if len(parts) != 2 or not all(ID.fullmatch(p) for p in parts):
                continue
            directory = templates.joinpath(*parts)
            if directory.is_symlink() or directory.parent.is_symlink():
                continue
            if not directory.is_dir() or not (directory / "manifest.json").is_file():
                continue
            yield design, directory
        except (OSError, ValueError, TypeError, AttributeError):
            continue


def shared_demo(templates: Path, video_id: str):
    entries = list(definitions(templates))
    # A real directory name always wins over a compatibility alias. Ambiguous
    # registrations fail closed rather than selecting whichever sorts first.
    exact = [directory for _, directory in entries if directory.name == video_id]
    if exact:
        return exact[0] if len(exact) == 1 else None
    matches = []
    for design, directory in entries:
        aliases = design["production_template"].get("aliases")
        if isinstance(aliases, list) and any(
            isinstance(alias, str) and ID.fullmatch(alias) and alias == video_id for alias in aliases
        ):
            matches.append(directory)
    return matches[0] if len(matches) == 1 else None


def legacy_production_file(templates: Path, parts: tuple[str, ...]):
    """Resolve only explicit former production locations of registered demos."""
    if len(parts) < 3:
        return None
    old_folder = "/".join(parts[:2])
    matches = []
    for design, directory in definitions(templates):
        marker = design["production_template"]
        aliases = marker.get("legacy_production_folders")
        if isinstance(aliases, list) and old_folder in aliases and registered_public_file(templates, (*directory.relative_to(templates).parts, *parts[2:])):
            matches.append((*directory.relative_to(templates).parts, *parts[2:]))
    return matches[0] if len(matches) == 1 else None


def registered_public_file(templates: Path, parts: tuple[str, ...]) -> bool:
    if len(parts) < 3 or any(p.startswith(".") or p in {"work", "logs", "test", "tests", "node_modules", "__pycache__"}
                            for p in parts):
        return False
    if any(p in {'accounts.json','users.json','access.json'} or p.lower().startswith(('client_secret','credentials','token','secret'))
           for p in parts) or Path(parts[-1]).suffix.lower() in {'.pem','.key','.p12','.pfx'}:
        return False
    # Never expose arbitrary sibling directories, even for a registered demo.
    if parts[2] not in {"index.html", "showcase.html", "showcase.js", "components.json", "assets", "render", "preview", "components", "sets", "characters"}:
        return False
    return any(tuple(design["production_template"]["folder"].split("/")) == parts[:2]
               for design, _ in definitions(templates))
