"""Profile-confined resolution of job output files for layout v3."""
from __future__ import annotations

import hashlib
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings


def checked_profile_path(path: Path, allowed_root: Path, profile_root: Path) -> Path:
    """Reject traversal and every symlink, including a symlink to an in-profile file."""
    if not path.is_absolute() or not path.is_relative_to(allowed_root) or path == allowed_root:
        raise ValueError('La ruta no pertenece al perfil seleccionado')
    if '..' in path.parts or not allowed_root.is_relative_to(profile_root):
        raise ValueError('La ruta no pertenece al perfil seleccionado')
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('La ruta atraviesa un enlace simbólico')
        if part == profile_root:
            break
    if not path.resolve().is_relative_to(allowed_root.resolve()):
        raise ValueError('La ruta no pertenece al perfil seleccionado')
    return path


def resolve_v3_job_output(stored_path: str) -> Path | None:
    """Resolve an owned path or a validated, exact legacy alias in this profile."""
    if not isinstance(stored_path, str) or not stored_path or '\\' in stored_path:
        return None
    layout = layout_for_settings(settings)
    original = Path(stored_path)
    if '..' in original.parts:
        return None
    candidate = original if original.is_absolute() else layout.root / original
    allowed = (layout.renders_dir, layout.productions_dir)
    for root in allowed:
        if candidate.is_relative_to(root):
            try:
                checked_profile_path(candidate, root, layout.root)
            except ValueError:
                return None
            if candidate.is_file():
                return candidate
            break

    from src.core.data import documents
    alias = documents('legacy_path_aliases').get(hashlib.sha256(stored_path.encode()).hexdigest())
    if not isinstance(alias, dict) or alias.get('legacy_key') != stored_path:
        return None
    target = alias.get('storage_key')
    if not isinstance(target, str) or not target or '\\' in target or '..' in Path(target).parts:
        return None
    path = Path(target)
    path = path if path.is_absolute() else layout.root / path
    for root in allowed:
        if path.is_relative_to(root):
            try:
                checked_profile_path(path, root, layout.root)
            except ValueError:
                return None
            if path.is_file():
                expected = alias.get('sha256')
                if expected is not None:
                    if not isinstance(expected, str):
                        return None
                    digest = hashlib.sha256()
                    with path.open('rb') as source:
                        for chunk in iter(lambda: source.read(1024 * 1024), b''):
                            digest.update(chunk)
                    if digest.hexdigest() != expected:
                        return None
                return path
    return None
