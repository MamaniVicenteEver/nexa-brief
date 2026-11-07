"""Locate technical files without mixing them into v2 profile data."""
from __future__ import annotations

import hashlib
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings


def data_directory() -> Path:
    """A selected v2 profile is authoritative even if a caller kept old settings."""
    layout = layout_for_settings(settings)
    return layout.data_dir if layout.schema_version >= 2 else settings.data_dir


def assert_profile_path(target: Path) -> None:
    """A local v2 adapter must never fall back to another profile's paths."""
    layout = layout_for_settings(settings)
    if layout.schema_version < 2:
        return
    if not target.is_relative_to(layout.root):
        raise ValueError("Technical path is outside the selected profile")
    for part in (target, *target.parents):
        if part.is_symlink():
            raise ValueError("Symlinks are not allowed in profile technical paths")
        if part == layout.root:
            break
    if not target.resolve().is_relative_to(layout.root.resolve()):
        raise ValueError("Technical path is outside the selected profile")


def lock_path(target: Path, legacy: Path | None = None) -> Path:
    assert_profile_path(target)
    layout = layout_for_settings(settings)
    if layout.schema_version == 1 or not target.resolve().is_relative_to(layout.root.resolve()):
        return legacy if legacy is not None else target.with_suffix('.lock')
    digest = hashlib.sha256(str(target.resolve()).encode()).hexdigest()
    result = layout.runtime_dir / 'locks' / f'{digest}.lock'
    assert_profile_path(result)
    return result


def temporary_dir(target: Path) -> Path:
    assert_profile_path(target)
    layout = layout_for_settings(settings)
    in_profile = target.resolve().is_relative_to(layout.root.resolve())
    directory = target.parent if layout.schema_version == 1 or not in_profile else layout.runtime_dir / 'tmp'
    assert_profile_path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    assert_profile_path(directory)
    return directory
