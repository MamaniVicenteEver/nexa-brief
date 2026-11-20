#!/usr/bin/env python3
"""Prepare a v1 profile for v2 without changing the selected layout or deleting sources.

Plan is read-only. Apply requires an explicit maintenance attestation; the tool
cannot detect workers on other hosts. See --help and the recovery manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

MEDIA_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a'}
SKIP_DIRS = {'.git', '.aws', '.ssh', '.codex', '.agents', '.venv', '.system', '.config', '.runtime', 'node_modules', '__pycache__', 'connections'}
SECRET_NAME = re.compile(r'(^\.env($|\.)|^accounts\.json$|^users\.json$|^client_secret|token|credential|secret|oauth|private|password|passwd|cookie|session|api[_-]?key|access[_-]?key|service[_-]?account|^id_rsa|\.(pem|key|p12|pfx)$)', re.I)
CATEGORY = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]*$')


@dataclass(frozen=True)
class Item:
    group: str
    source: Path
    destination: Path
    source_root: str


def checked_root(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute() or not path.is_dir():
        raise ValueError('Ambas raíces deben ser directorios absolutos existentes')
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('No se admiten raíces ni ancestros symlink')
    return path


def assert_no_symlink(path: Path, root: Path) -> None:
    if not path.is_relative_to(root):
        raise ValueError('Ruta fuera de la raíz permitida')
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('Se encontró un symlink; el plan se detuvo')
        if part == root:
            return
    raise ValueError('Ruta fuera de la raíz permitida')


def files_in(root: Path, boundary: Path, skipped: list[int], exclude_samples: bool = False):
    assert_no_symlink(root, boundary)
    if not root.exists():
        return
    if not root.is_dir():
        raise ValueError('Una ruta de origen esperada no es directorio')
    for current, dirs, files in os.walk(root, followlinks=False):
        current = Path(current)
        for name in list(dirs):
            path = current / name
            if name.lower() in SKIP_DIRS or SECRET_NAME.search(name) or (exclude_samples and name == 'muestras'):
                dirs.remove(name)
                skipped[0] += 1
            else:
                assert_no_symlink(path, boundary)
        for name in files:
            path = current / name
            if SECRET_NAME.search(name) or name.endswith(('.lock', '.tmp')):
                skipped[0] += 1
                continue
            assert_no_symlink(path, boundary)
            if not stat.S_ISREG(path.stat().st_mode):
                raise ValueError('Se encontró un archivo especial; el plan se detuvo')
            yield path


def make_plan(profile: Path, templates: Path):
    if profile == templates or profile.is_relative_to(templates) or templates.is_relative_to(profile):
        raise ValueError('Las raíces de perfil y plantillas deben ser independientes')
    manifest = profile / 'profile.json'
    assert_no_symlink(manifest, profile)
    try:
        value = json.loads(manifest.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise ValueError('No se pudo leer el manifiesto del perfil') from None
    if not isinstance(value, dict) or type(value.get('schema_version')) is not int or value['schema_version'] != 1:
        raise ValueError('Se requiere un perfil v1 válido')
    skipped = [0]
    items: list[Item] = []
    summaries = []

    def mapping(label, source, dest, source_root, only_media=False, suffixes=None):
        count = 0
        missing = not source.exists()
        for path in files_in(source, profile if source_root == 'profile' else templates, skipped, source_root == 'templates'):
            if only_media and path.suffix.lower() not in (suffixes or MEDIA_SUFFIXES):
                continue
            target = dest / path.relative_to(source)
            assert_no_symlink(target, profile)
            items.append(Item(label, path, target, source_root))
            count += 1
        summaries.append((label, source, dest, count, missing))

    for source in sorted(templates.iterdir()):
        name = source.name
        if name == 'sandbox' or name.startswith('_') or name.startswith('.'):
            continue
        if SECRET_NAME.search(name) or name.lower() in SKIP_DIRS:
            skipped[0] += 1
            continue
        if source.is_symlink():
            raise ValueError('Se encontró un symlink; el plan se detuvo')
        if source.is_dir() and CATEGORY.fullmatch(name):
            mapping('producciones', source, profile / 'productions' / name, 'templates')
    mapping('sandbox', templates / 'sandbox', profile / 'sandbox', 'templates')
    mapping('renders', profile / 'output', profile / 'renders', 'profile')
    for kind in ('images', 'music', 'sounds', 'videos'):
        mapping('biblioteca', profile / 'data/library/files' / kind, profile / 'resources' / kind, 'profile')
    mapping('música licenciada', profile / 'data/media-cache/reel_music', profile / 'resources/reel_music', 'profile', True, {'.mp3'})
    mapping('medios de publicaciones', profile / 'data/publicaciones', profile / 'productions/_publicaciones', 'profile', True)
    mapping('logs de modelos', profile / 'data/model-calls', profile / 'logs/model-calls', 'profile')
    mapping('logs de prototipos', profile / 'data/prototypes/logs', profile / 'logs/prototypes', 'profile')
    mapping('caché de miniaturas', profile / 'data/sandbox-thumbs', profile / '.system/cache/sandbox-thumbs', 'profile')
    destinations = [item.destination for item in items]
    if len(destinations) != len(set(destinations)):
        raise ValueError('Dos orígenes apuntan al mismo destino')
    return items, summaries, skipped[0]


def digest(path: Path) -> tuple[str, int]:
    flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)
    fd = os.open(path, flags)
    hasher = hashlib.sha256()
    size = 0
    with os.fdopen(fd, 'rb') as stream:
        while block := stream.read(1024 * 1024):
            hasher.update(block)
            size += len(block)
    return hasher.hexdigest(), size


def write_manifest(path: Path, value: dict) -> None:
    temp = path.with_suffix('.tmp')
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def apply(profile: Path, templates: Path, items: list[Item]) -> Path:
    # Never overwrite or merge an existing destination. Preflight all first.
    for item in items:
        assert_no_symlink(item.source, profile if item.source_root == 'profile' else templates)
        assert_no_symlink(item.destination, profile)
        if item.destination.exists():
            raise ValueError('Hay archivos de destino existentes; no se sobrescribió ninguno')
    migration_dir = profile / '.system/migrations' / uuid.uuid4().hex
    assert_no_symlink(migration_dir, profile)
    migration_dir.mkdir(parents=True, mode=0o700, exist_ok=False)
    record_path = migration_dir / 'manifest.json'
    record = {'version': 1, 'state': 'preparing', 'profile_schema_unchanged': True, 'files': [
        {'group': x.group, 'source_root': x.source_root,
         'source': str(x.source.relative_to(profile if x.source_root == 'profile' else templates)),
         'destination': str(x.destination.relative_to(profile)), 'state': 'planned'} for x in items]}
    write_manifest(record_path, record)
    for item, entry in zip(items, record['files']):
        # Hash through no-follow descriptors; copy into a private staging file.
        assert_no_symlink(item.source, profile if item.source_root == 'profile' else templates)
        flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)
        source_fd = os.open(item.source, flags)
        staged = migration_dir / 'staged'
        staged_fd = os.open(staged, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        with os.fdopen(source_fd, 'rb') as src, os.fdopen(staged_fd, 'wb') as dst:
            shutil.copyfileobj(src, dst, 1024 * 1024)
            os.fchmod(dst.fileno(), stat.S_IMODE(os.fstat(src.fileno()).st_mode) & 0o777)
            dst.flush()
            os.fsync(dst.fileno())
        before_hash, before_size = digest(item.source)
        staged_hash, staged_size = digest(staged)
        if (before_hash, before_size) != (staged_hash, staged_size):
            raise ValueError('Cambió un origen o falló la verificación; revisión manual requerida')
        entry.update({'sha256': staged_hash, 'bytes': staged_size, 'state': 'verified'})
        write_manifest(record_path, record)
        assert_no_symlink(item.destination, profile)
        item.destination.parent.mkdir(parents=True, exist_ok=True)
        assert_no_symlink(item.destination, profile)
        os.link(staged, item.destination, follow_symlinks=False)  # atomic, no overwrite
        staged.unlink()
        entry['state'] = 'created'
        write_manifest(record_path, record)
    record['state'] = 'prepared'
    write_manifest(record_path, record)
    return record_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile-dir', required=True)
    parser.add_argument('--templates-dir')
    parser.add_argument('--legacy-server-root', action='append', default=[], help='Raíz histórica del servidor explícitamente autorizada; repetible')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--local-plan', action='store_true')
    mode.add_argument('--local-prepare', action='store_true')
    mode.add_argument('--local-activate', action='store_true')
    mode.add_argument('--local-rollback', action='store_true')
    parser.add_argument('--migration-id')
    parser.add_argument('--target-version', type=int, choices=(2, 3), default=3)
    parser.add_argument('--confirm-no-v2-writes', action='store_true')
    parser.add_argument('--apply', action='store_true', help='Prepara copias verificadas; no cambia profile.json')
    parser.add_argument('--confirm-maintenance', action='store_true', help='Confirma que todos los procesos y hosts del perfil están detenidos')
    parser.add_argument('--confirm-templates-owned', action='store_true', help='Confirma que las plantillas y producciones elegidas pertenecen a este perfil')
    args = parser.parse_args()
    try:
        if args.legacy_server_root and not (args.local_plan or args.local_prepare):
            raise ValueError('--legacy-server-root solo se usa al planificar o preparar')
        if any((args.local_plan, args.local_prepare, args.local_activate, args.local_rollback)):
            import profile_local_migration as local
            root = local.root_path(args.profile_dir)
            legacy_roots = local.validate_legacy_roots(args.legacy_server_root)
            if args.apply:
                raise ValueError("--apply no se combina con el flujo local")
            if not args.local_plan and not args.confirm_maintenance:
                raise ValueError("La operación requiere --confirm-maintenance")
            if args.local_plan or args.local_prepare:
                if not args.templates_dir:
                    raise ValueError("Se requiere --templates-dir")
                templates = checked_root(args.templates_dir)
                if root == templates or root.is_relative_to(templates) or templates.is_relative_to(root):
                    raise ValueError("Las raíces de perfil y plantillas deben ser independientes")
                if args.local_prepare and not args.confirm_templates_owned:
                    raise ValueError("--local-prepare requiere --confirm-templates-owned")
                counts = local.plan(root, templates, target_version=args.target_version)
                print(json.dumps(counts, ensure_ascii=False, sort_keys=True))
                if args.local_prepare:
                    print("migration_id=" + local.prepare(root, templates, target_version=args.target_version, legacy_roots=legacy_roots))
                else:
                    print("plan solamente; no se modificaron archivos")
            elif args.local_activate:
                if not args.migration_id:
                    raise ValueError("Se requiere --migration-id")
                local.activate(root, args.migration_id)
                print("activación del perfil completada")
            else:
                if not args.migration_id or not args.confirm_no_v2_writes:
                    raise ValueError("rollback requiere --migration-id y --confirm-no-v2-writes")
                local.rollback(root, args.migration_id)
                print("rollback completado")
            return 0
        if not args.templates_dir:
            raise ValueError("Se requiere --templates-dir")
        if args.apply and not args.confirm_maintenance:
            raise ValueError('--apply requiere --confirm-maintenance: detener todos los procesos y hosts')
        if args.apply and not args.confirm_templates_owned:
            raise ValueError('--apply requiere --confirm-templates-owned: confirmar pertenencia al perfil')
        profile, templates = checked_root(args.profile_dir), checked_root(args.templates_dir)
        items, summaries, skipped = make_plan(profile, templates)
        for label, source, target, count, missing in summaries:
            print(f'{label}: {source} -> {target} | archivos={count} | origen={"ausente" if missing else "presente"}')
        conflicts = sum(item.destination.exists() for item in items)
        print(f'excluidos por seguridad: {skipped}; total de archivos: {len(items)}; destinos existentes: {conflicts}')
        print('runtime anterior: no se copia (locks, leases y eventos se regeneran)')
        print('JSON de datos y perfil v1: permanecen en su lugar; no se activa v2')
        print('conexiones y credenciales: excluidas; las rutas absolutas en JSON requieren revisión')
        if args.apply:
            record = apply(profile, templates, items)
            print(f'preparación verificada; manifiesto de recuperación: {record}')
        else:
            print('plan solamente; no se modificaron archivos')
        return 0
    except (OSError, ValueError) as exc:
        # Filesystem exceptions can contain confidential names; never print them.
        message = str(exc) if isinstance(exc, ValueError) else 'Error de archivo; revise permisos, espacio y sistema de archivos'
        print(f'error: {message}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
