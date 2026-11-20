#!/usr/bin/env python3
"""Reconcile moved v3 resource keys using recorded, profile-local aliases.

Dry run by default. Apply requires maintenance, expected count and section hash.
The section is locked, backed up, and replaced atomically; no media are read.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import tempfile
import uuid


def checked(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError('Clave de recurso inválida')
    path = Path(value)
    if path.is_absolute():
        if not path.is_relative_to(root):
            raise ValueError('Alias fuera del perfil')
        path = path.relative_to(root)
    if not path.parts or '..' in path.parts or path.parts[0] not in {'productions', 'renders', 'resources', 'sandbox'}:
        raise ValueError('Clave de recurso fuera del contenido del perfil')
    candidate = root / path
    for part in (candidate, *candidate.parents):
        if part.is_symlink():
            raise ValueError('Symlink en clave de recurso')
        if part == root:
            break
    return candidate


def compute(root: Path, raw: bytes):
    data = json.loads(raw)
    if (not isinstance(data, dict) or data.get('schema_version') != 1
            or type(data.get('revision')) is not int or data['revision'] < 0
            or not isinstance(data.get('collections'), dict) or not isinstance(data.get('documents'), dict)):
        raise ValueError('Sección de recursos inválida')
    rows = data['collections'].get('content_resources', [])
    aliases = data['documents'].get('legacy_path_aliases', {})
    if not isinstance(rows, list) or not isinstance(aliases, dict):
        raise ValueError('Índice de recursos o alias inválido')
    updates = unresolved = 0
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('asset_id'), str) or not row['asset_id'] or row['asset_id'] in ids:
            raise ValueError('Identidad de recurso inválida o duplicada')
        ids.add(row['asset_id'])
        key = row.get('storage_key')
        path = checked(root, key)
        if path.is_file():
            continue
        alias = aliases.get(hashlib.sha256(key.encode()).hexdigest())
        if alias is None:
            unresolved += 1
            continue
        if not isinstance(alias, dict) or alias.get('legacy_key') != key:
            raise ValueError('Alias de recurso inválido')
        dest = checked(root, alias.get('storage_key'))
        if not dest.is_file():
            unresolved += 1
            continue
        row['storage_key'] = dest.relative_to(root).as_posix()
        updates += 1
    return data, updates, unresolved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile-dir', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--confirm-maintenance', action='store_true')
    parser.add_argument('--expected-count', type=int)
    parser.add_argument('--expected-sha256')
    args = parser.parse_args()
    try:
        root = Path(args.profile_dir)
        if not root.is_absolute() or not root.is_dir() or any(p.is_symlink() for p in (root, *root.parents)):
            raise ValueError('Perfil inválido')
        manifest = json.loads((root / 'profile.json').read_text())
        if manifest.get('schema_version') != 3:
            raise ValueError('El perfil debe usar schema 3')
        section = root / 'data/json/resources.json'
        for part in (section, *section.parents):
            if part.is_symlink():
                raise ValueError('Symlink en sección de recursos')
            if part == root:
                break
        if args.apply and (not args.confirm_maintenance or args.expected_count is None or not args.expected_sha256):
            raise ValueError('Aplicar requiere mantenimiento, conteo y hash esperados')
        lock_fd = None
        try:
            if args.apply:
                lock = root / '.system/runtime/locks' / (hashlib.sha256(str(section.resolve()).encode()).hexdigest() + '.lock')
                for part in (lock, *lock.parents):
                    if part.is_symlink():
                        raise ValueError('Symlink en bloqueo')
                    if part == root:
                        break
                lock.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                lock_fd = os.open(lock, os.O_CREAT | os.O_RDWR, 0o600)
                fcntl.flock(lock_fd, fcntl.LOCK_EX)
            raw = section.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            data, count, unresolved = compute(root, raw)
            result = {'candidatos': count, 'sin_resolver': unresolved, 'section_sha256': digest,
                      'revision': data['revision'], 'aplicado': False}
            if args.apply:
                if digest != args.expected_sha256 or count != args.expected_count or unresolved:
                    raise ValueError('El índice o los conteos no coinciden con el plan')
                if count:
                    backup = root / '.system/migrations/resource-key-reconcile' / uuid.uuid4().hex
                    for part in (backup, *backup.parents):
                        if part.is_symlink():
                            raise ValueError('Symlink en respaldo')
                        if part == root:
                            break
                    backup.mkdir(parents=True, mode=0o700)
                    with (backup / 'resources.json').open('xb') as stream:
                        os.chmod(backup / 'resources.json', 0o600)
                        stream.write(raw)
                        stream.flush()
                        os.fsync(stream.fileno())
                    backup_fd = os.open(backup, os.O_RDONLY)
                    try:
                        os.fsync(backup_fd)
                    finally:
                        os.close(backup_fd)
                    data['revision'] += 1
                    fd, temp = tempfile.mkstemp(prefix='.resources-reconcile-', dir=section.parent)
                    try:
                        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                            json.dump(data, stream, ensure_ascii=False, indent=2)
                            stream.flush()
                            os.fsync(stream.fileno())
                        os.replace(temp, section)
                        directory = os.open(section.parent, os.O_RDONLY)
                        try:
                            os.fsync(directory)
                        finally:
                            os.close(directory)
                    finally:
                        if os.path.exists(temp):
                            os.unlink(temp)
                    result['backup'] = str(backup / 'resources.json')
                result['aplicado'] = True
            print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        finally:
            if lock_fd is not None:
                os.close(lock_fd)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        parser.exit(2, f'error: {exc}\n')


if __name__ == '__main__':
    main()
