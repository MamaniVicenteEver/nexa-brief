"""Public campaign data before and after publishing a shared project."""
from __future__ import annotations
import json
from pathlib import Path

from src.core.nodemotion.shared.resources import asset_ref, _resolve_ref


def prepared_reference(root: Path, kind: str, asset_id: str, filename: str) -> dict:
    """Bind a ready file to its registered source identity and exact bytes."""
    folder = {"music": "music", "image": "images", "video": "videos"}[kind]
    expected = root / "resources" / folder / asset_id / filename
    ref = asset_ref(kind, asset_id, variant_file=filename)
    if _resolve_ref(ref).resolve() != expected.resolve(strict=True):
        raise ValueError("Registered resource does not resolve the selected prepared file")
    return ref


def timeline(target: Path, read_json=None) -> dict:
    read_json = read_json or (lambda path: json.loads(path.read_text(encoding="utf-8")))
    canonical = target / "assets/timeline.json"
    legacy = target / "assets/lyrics.json"
    if canonical.is_file():
        value = read_json(canonical)
        if legacy.is_file() and read_json(legacy) != value:
            raise ValueError("Conflicting timeline and legacy lyrics; run timing again")
        return value
    if legacy.is_file():
        return read_json(legacy)
    from src.core.nodemotion.service import load_project, resolve_project
    project = load_project(target)
    if project is not None:
        prefix = project.get("content_prefix", "")
        name = project.get("data_urls", {}).get("timing") or (f"{prefix}/lyrics.json" if prefix else "lyrics.json")
        value = resolve_project(target, name)
        if isinstance(value, bytes):
            return json.loads(value)
        if isinstance(value, Path):
            return read_json(value)
    raise FileNotFoundError("Missing campaign timeline")


def audio(target: Path) -> Path:
    metadata = target / "music.json"
    if metadata.is_file():
        ref = json.loads(metadata.read_text(encoding="utf-8")).get("resource_ref")
        if ref is not None:
            return _resolve_ref(ref)
    from src.core.nodemotion.service import load_project, resolve_project
    project = load_project(target)
    if project is not None:
        prefix = project.get("content_prefix", "")
        name = project.get("data_urls", {}).get("audio") or (f"{prefix}/song.mp3" if prefix else "song.mp3")
        value = resolve_project(target, name)
        if isinstance(value, Path):
            return value
    return (target / "assets/song.mp3").resolve(strict=True)
