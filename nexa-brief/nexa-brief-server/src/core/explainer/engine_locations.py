"""Explicit shared engine locations, independent of a profile's projects.

engine_id is stable identity. engine_root is a repository-relative directory;
legacy_engine_roots provide public-file compatibility after a physical move.
Neither field grants access to a profile or to private engine files.
"""
from __future__ import annotations

import json
import hashlib
import os
import re
from pathlib import Path

SEGMENT = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_-]{0,127}\Z")
PRIVATE = {"work", "logs", "node_modules", "__pycache__", "test", "tests",
           "accounts.json", "users.json", "access.json"}


def safe_root(templates: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not 2 <= len(relative.split('/')) <= 5:
        raise ValueError('Ruta de motor inválida')
    if any(not SEGMENT.fullmatch(p) for p in relative.split('/')):
        raise ValueError('Ruta de motor inválida')
    if templates.is_symlink():
        raise ValueError('La raíz de plantillas no admite enlaces simbólicos')
    current = templates
    for part in relative.split('/'):
        current = current / part
        if current.is_symlink():
            raise ValueError('Un motor no admite enlaces simbólicos')
    return current


def contracts(templates: Path):
    definitions_root = safe_root(templates, '_tools/design-definitions')
    for file in sorted(definitions_root.glob('*/design.json')):
        if file.is_symlink() or file.parent.is_symlink():
            continue
        value = json.loads(file.read_text())
        if isinstance(value, dict):
            yield file, value


def engine_root(templates: Path, engine: str, design: dict | None = None) -> Path:
    if engine == 'explainer-kit' or engine.startswith('explainer-kit:'):
        return safe_root(templates, '_tools/explainer-kit')
    roots = {value['engine_root'] for _, value in contracts(templates)
             if value.get('engine_id') == engine and value.get('engine_root')}
    if design and design.get('engine_root'):
        roots.add(design['engine_root'])
    if len(roots) > 1:
        raise ValueError('El motor tiene más de una ubicación registrada')
    return safe_root(templates, next(iter(roots)) if roots else 'sandbox/' + engine)


def public_engine_file(templates: Path, parts: tuple[str, ...]):
    """Map current/legacy engine public paths, never project directories."""
    if any(p.startswith('.') or p.lower() in PRIVATE or
           p.lower().startswith(('client_secret', 'credential', 'secret', 'token'))
           for p in parts) or (parts and Path(parts[-1]).suffix.lower() in {'.key', '.pem', '.p12', '.pfx'}):
        return None
    matches = set()
    for _, design in contracts(templates):
        root = design.get('engine_root')
        if not root:
            continue
        canonical = safe_root(templates, root)
        aliases = design.get('legacy_engine_roots') or []
        if not isinstance(aliases, list):
            raise ValueError('Alias del motor inválidos')
        for relative in [root, *aliases]:
            safe_root(templates, relative)
            prefix = tuple(relative.split('/'))
            if len(parts) > len(prefix) and parts[:len(prefix)] == prefix:
                target = canonical.joinpath(*parts[len(prefix):])
                if target.is_relative_to(canonical):
                    matches.add(target)
    if len(matches) > 1:
        raise ValueError('Alias de motor ambiguo')
    return next(iter(matches), None)


def code_signature(directory: Path) -> str:
    digest = hashlib.sha256()
    for file in sorted(directory.rglob('*')):
        relative = file.relative_to(directory)
        if 'cache' in relative.parts or not file.is_file():
            continue
        if file.is_symlink():
            raise ValueError('Un motor no admite enlaces simbólicos')
        stat = file.stat()
        digest.update(f'{relative}:{stat.st_size}:{stat.st_mtime_ns}\n'.encode())
    return digest.hexdigest()


def plan_engine_move(templates: Path, engine: str, category: str, ident: str, design=None):
    """A principal demo moves its experimental shared engine, never a copy."""
    if not engine or engine.startswith('explainer-kit'):
        return None
    source = engine_root(templates, engine, design)
    if not source.is_dir():
        return None  # Inline/native projects are reviewed by the normal file review.
    relative = source.relative_to(templates).as_posix()
    if not relative.startswith('sandbox/'):
        return None
    for file in source.rglob('*'):
        if file.is_symlink() or file.name in {'accounts.json', 'users.json', '.aws', '.codex', '.agents', '.git'} or file.name.startswith(('.env', 'client_secret', 'credentials')):
            raise ValueError('El motor contiene enlaces o archivos privados; requiere revisión')
    target_relative = f'{category}/{ident}/{source.name}'
    target = safe_root(templates, target_relative)
    if target.exists() or target.is_symlink():
        raise ValueError('El destino del motor ya existe; reconcilia sus versiones')
    if source.stat().st_dev != templates.stat().st_dev:
        raise ValueError('El motor requiere una migración entre discos supervisada')
    return {'source': relative, 'target': target_relative, 'signature': code_signature(source)}


def apply_engine_move(templates: Path, plan, design: dict):
    if not plan:
        return
    source = safe_root(templates, plan['source'])
    target = safe_root(templates, plan['target'])
    if not source.is_dir() or target.exists():
        raise ValueError('El origen o destino del motor cambió')
    if code_signature(source) != plan.get('signature'):
        raise ValueError('El motor cambió después de la validación')
    target.parent.mkdir(parents=True, exist_ok=True)
    os.rename(source, target)
    design['engine_root'] = plan['target']
    design['legacy_engine_roots'] = list(dict.fromkeys([
        *design.get('legacy_engine_roots', []), plan['source']]))


def rollback_engine_move(templates: Path, plan):
    if not plan:
        return
    source = safe_root(templates, plan['source'])
    target = safe_root(templates, plan['target'])
    if target.exists() and source.exists():
        raise ValueError('Ambas ubicaciones del motor existen; recuperación manual requerida')
    if target.is_dir():
        if code_signature(target) != plan.get('signature'):
            raise ValueError('El motor trasladado cambió; recuperación manual requerida')
        source.parent.mkdir(parents=True, exist_ok=True)
        os.rename(target, source)
