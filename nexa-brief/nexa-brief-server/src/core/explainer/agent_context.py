"""Prepare the public design reference inside one isolated production."""
from __future__ import annotations

import json
import os
import re
import stat
import tempfile
from pathlib import Path

from src.core.explainer.catalog import KIT_DIR

_ID = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]*$')


def _write(path: Path, contents: str) -> None:
    fd, name = tempfile.mkstemp(prefix='.context-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            out.write(contents)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def _safe(root: Path, *parts: str) -> Path:
    path = Path(root)
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError('El contexto no admite enlaces simbólicos')
    for part in parts:
        if not part or part in {'.', '..'} or '/' in part or '\\' in part:
            raise ValueError('Ruta de contexto inválida')
        path /= part
        if path.is_symlink():
            raise ValueError('El contexto no admite enlaces simbólicos')
    return path


def ensure_private_workspace(root: Path) -> None:
    """Restrict only this workspace; reject links, special files and other owners."""
    root = _safe(root)
    if not root.is_dir():
        raise ValueError('Workspace inexistente')

    def fail(error):
        raise error

    entries = []
    for directory, dirs, names in os.walk(root, topdown=True, followlinks=False, onerror=fail):
        entries.append(Path(directory))
        entries.extend(Path(directory) / name for name in names)
        for name in dirs + names:
            path = Path(directory) / name
            info = path.lstat()
            if (info.st_uid != os.getuid() or stat.S_ISLNK(info.st_mode)
                    or not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode))
                    or (stat.S_ISREG(info.st_mode) and info.st_nlink != 1)):
                raise ValueError('Workspace contiene archivos compartidos o no seguros')
    for path in entries:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(fd)
            if (info.st_uid != os.getuid() or not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode))
                    or (stat.S_ISREG(info.st_mode) and info.st_nlink != 1)):
                raise ValueError('Workspace contiene archivos compartidos o no seguros')
            mode = stat.S_IMODE(info.st_mode) & 0o700
            os.fchmod(fd, mode | (0o700 if stat.S_ISDIR(info.st_mode) else 0))
        finally:
            os.close(fd)


def prepare_design_context(video_dir: Path, design: str, *, kit_dir: Path = KIT_DIR) -> Path:
    """Copy only the selected public QUICK and per-entry catalog contracts."""
    if not _ID.fullmatch(design):
        raise ValueError('Diseño inválido')
    design_root = _safe(kit_dir, 'designs', design)
    info = json.loads(_safe(design_root, 'design.json').read_text(encoding='utf-8'))
    family = info.get('family')
    if not isinstance(family, str) or not _ID.fullmatch(family):
        raise ValueError('Familia de diseño inválida')
    quick = _safe(design_root, 'QUICK.md').read_text(encoding='utf-8')
    catalog = json.loads(_safe(kit_dir, 'catalog.json').read_text(encoding='utf-8'))
    rows = catalog.get('comps') if isinstance(catalog, dict) else None
    if not isinstance(rows, list):
        raise ValueError('Catálogo de diseño inválido')
    selected = []
    for row in rows:
        name = row.get('name') if isinstance(row, dict) else None
        if isinstance(name, str) and name.startswith((family + '.', 'common.')):
            if not _ID.fullmatch(name) or any(old['name'] == name for old in selected):
                raise ValueError('Entrada de catálogo inválida o duplicada')
            selected.append(row)
    if not selected:
        raise ValueError('El diseño no tiene componentes en el catálogo')
    root = _safe(video_dir, 'work', 'agent-context')
    entries_dir = _safe(root, 'entries')
    entries_dir.mkdir(parents=True, exist_ok=True)
    _write(_safe(root, 'QUICK.md'), quick)
    index = []
    for row in selected:
        name = row['name']
        _write(_safe(entries_dir, name + '.json'), json.dumps(row, ensure_ascii=False, indent=2) + '\n')
        index.append({'id': name, 'summary': row.get('summary', ''), 'file': f'entries/{name}.json'})
    _write(_safe(root, 'index.json'), json.dumps({'design': design, 'family': family, 'entries': index}, ensure_ascii=False, indent=2) + '\n')
    return root
