#!/usr/bin/env python3
"""Offline, read-only identity and referenced-file audit for v1/v2 -> v3.

Only the private baseline file is written; run under maintenance both times.
The result reports counts, never record IDs, paths or contents.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.adapters.data.layout import COLLECTIONS, DOCUMENTS
from src.adapters.data.section_names import COLLECTION_SECTIONS, DOCUMENT_SECTIONS
from profile_local_migration import validate_legacy_roots

PRIVATE = re.compile(r'(?:secret|token|credential|password|^accounts(?:\.json)?$|^users(?:\.json)?$|^\.env|session)', re.I)
SKIP = {'publication_index', 'media_aliases', 'legacy_path_aliases', 'showcase_designs'}
COMPOSITE_KEYS = {'channels': ('platform', 'alias'),
                  'channel_publications': ('platform', 'target_id', 'post_id'),
                  'published_videos': ('platform', 'alias', 'post_id')}
OPAQUE = {'connections': '.system/connections', 'web-data': '.system/web-data',
          'tiktok': '.system/tiktok', 'data/browser_profiles': '.system/browser-profiles'}
LIBRARIES = {'image_assets': 'images', 'music_assets': 'music', 'sound_assets': 'sounds', 'video_assets': 'videos'}
FILE_FIELDS = {'storage_key', 'relative_path', 'file_path', 'output_dir', 'log_path', 'path'}
FILE_GROUPS = {'file_paths', 'format_paths'}


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def checked(root: Path, path: Path) -> Path:
    if not path.is_relative_to(root) or any(part in ('.', '..') for part in path.relative_to(root).parts):
        raise ValueError('Ruta fuera del perfil')
    for item in (path, *path.parents):
        if item == root:
            break
        if item.is_symlink():
            raise ValueError('Symlink en ruta auditada')
    return path


def load(root: Path, path: Path) -> Any:
    checked(root, path)
    if any(PRIVATE.search(part) for part in path.relative_to(root).parts):
        raise ValueError('Archivo privado excluido')
    with path.open(encoding='utf-8') as stream:
        return json.load(stream)


SEMANTIC_POINTERS = {('explainer_productions', ('category_path',)),
                     ('content_plan', ('category_path',))}


def refs(value: Any, pointer: tuple[str | int, ...] = (), field: str = ''):
    if isinstance(value, dict):
        for key, child in value.items():
            if PRIVATE.search(key):
                continue
            yield from refs(child, pointer + (key,), key if field not in FILE_GROUPS else field)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            yield from refs(child, pointer + (i,), field)
    elif isinstance(value, str) and (field in FILE_FIELDS or field in FILE_GROUPS or field.endswith('_path')):
        if value and not PRIVATE.search(Path(value.split('?', 1)[0]).name):
            yield pointer, value


def pointer_get(value: Any, pointer: list[str | int]) -> Any:
    try:
        for part in pointer:
            value = value[part]
        return value
    except (KeyError, IndexError, TypeError):
        return None


def candidate_paths(root: Path, namespace: str, ref: str, version: int, legacy_roots=()) -> list[Path]:
    if not isinstance(ref, str) or not ref or '\\' in ref or '?' in ref or '#' in ref:
        return []
    value = Path(ref)
    if '..' in value.parts or any(PRIVATE.search(part) for part in value.parts):
        return []
    paths: list[Path] = []
    legacy_match = False
    for legacy in legacy_roots:
        for suffix, target in (('/output', 'output'), ('/data', 'data')):
            prefix = legacy + suffix
            if ref == prefix or ref.startswith(prefix + '/'):
                paths.append(root / target / ref[len(prefix):].lstrip('/'))
                legacy_match = True
                break
        if legacy_match:
            break
    if legacy_match:
        pass
    elif ref.startswith('/app/output/'):
        paths.append(root / 'output' / ref[len('/app/output/'):])
    elif ref.startswith('/app/data/'):
        paths.append(root / 'data' / ref[len('/app/data/'):])
    elif value.is_absolute():
        if value.is_relative_to(root):
            paths.append(value)
    elif value.parts and value.parts[0] in {'resources', 'renders', 'productions', 'sandbox', 'logs', 'data', 'output'}:
        paths.append(root / value)
    elif namespace in LIBRARIES:
        kind = LIBRARIES[namespace]
        paths.extend((root / 'data/library/files' / kind / value, root / 'resources' / kind / value))
    else:
        paths.extend((root / value, root / 'data/publicaciones' / value, root / 'renders' / value))
    return [checked(root, path) for path in paths]


def exists(root: Path, namespace: str, ref: str, version: int, legacy_roots=()) -> bool:
    for path in candidate_paths(root, namespace, ref, version, legacy_roots):
        if path.exists() and (path.is_file() or path.is_dir()):
            return True
    return False


def scan(root: Path) -> dict[str, Any]:
    manifest = load(root, root / 'profile.json')
    version = manifest.get('schema_version', 1)
    if version not in (1, 2, 3):
        raise ValueError('Versión de perfil inválida')
    data = root / 'data'
    collections: dict[str, list[dict]] = {}
    documents: dict[str, dict[str, Any]] = {}
    section_cache = {}
    def section(name: str) -> dict:
        if name not in section_cache:
            path = data / 'json' / (name + '.json')
            section_cache[name] = load(root, path) if path.exists() else {}
        return section_cache[name]
    for name, (relative, key) in COLLECTIONS.items():
        if name in SKIP:
            continue
        path = data / relative
        rows = section(COLLECTION_SECTIONS[name]).get('collections', {}).get(name, []) if version == 3 else (load(root, path) if path.exists() else [])
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError('Colección inválida: ' + name)
        identities = [row_identity(name, row) for row in rows]
        if key is not None and len(set(identities)) != len(rows):
            raise ValueError('IDs duplicados en ' + name)
        collections[name] = rows
    for name, relative in DOCUMENTS.items():
        if name in SKIP:
            continue
        if version == 3:
            rows = section(DOCUMENT_SECTIONS[name]).get('documents', {}).get(name, {})
        else:
            directory = checked(root, data / relative)
            rows = {}
            if directory.exists():
                if not directory.is_dir():
                    raise ValueError('Directorio de documentos inválido')
                for path in sorted(directory.glob('*.json')):
                    rows[path.stem] = load(root, path)
        if not isinstance(rows, dict):
            raise ValueError('Documentos inválidos: ' + name)
        documents[name] = rows
    if version == 3:
        designs = section('designs').get('collections', {}).get('showcase_designs', [])
        publications = section('publicaciones').get('documents', {}).get('publications', {})
    else:
        designs_path = data / 'showcase/designs.json'
        designs = load(root, designs_path) if designs_path.exists() else []
        publications = {}
        publication_root = checked(root, data / 'publicaciones')
        if publication_root.exists():
            for path in sorted(publication_root.glob('*/*/*/*/record.json')):
                row = load(root, path)
                ident = row.get('publication_id') if isinstance(row, dict) else None
                if not isinstance(ident, str) or not ident or ident in publications:
                    raise ValueError('Publicación inválida')
                publications[ident] = row
    if not isinstance(designs, list) or any(not isinstance(r, dict) or not isinstance(r.get('id'), str) for r in designs):
        raise ValueError('Diseños inválidos')
    if len({r['id'] for r in designs}) != len(designs) or not isinstance(publications, dict):
        raise ValueError('Índice de diseños o publicaciones inválido')
    collections['showcase_designs'] = designs
    documents['publications'] = publications
    aliases = {}
    if version == 3:
        resource_docs = section('resources').get('documents', {})
        for namespace in ('media_aliases', 'legacy_path_aliases'):
            for row in resource_docs.get(namespace, {}).values():
                if isinstance(row, dict) and isinstance(row.get('legacy_key'), str) and isinstance(row.get('storage_key'), str):
                    aliases[row['legacy_key']] = row['storage_key']
    return {'version': version, 'collections': collections, 'documents': documents, 'aliases': aliases}


def row_identity(namespace: str, row: dict) -> str:
    key = 'id' if namespace == 'showcase_designs' else COLLECTIONS[namespace][1]
    fields = (key,) if key is not None else COMPOSITE_KEYS[namespace]
    values = [row.get(field) for field in fields]
    if any(not isinstance(value, str) or not value for value in values):
        raise ValueError('Falta identidad en colección: ' + namespace)
    return digest(json.dumps(values, ensure_ascii=False, separators=(',', ':')))


def inventory(root: Path, snapshot: dict, legacy_roots=()) -> dict:
    records, ids, references = {}, {}, []
    for namespace, rows in snapshot['collections'].items():
        ids[namespace] = [row_identity(namespace, row) for row in rows]
        records[namespace] = {row_identity(namespace, row): row for row in rows}
    for namespace, docs in snapshot['documents'].items():
        ids[namespace] = [digest(str(key)) for key in docs]
        records[namespace] = {digest(str(key)): value for key, value in docs.items()}
    for namespace, rows in records.items():
        for ident, row in rows.items():
            for pointer, ref in refs(row):
                if (namespace, pointer) in SEMANTIC_POINTERS:
                    continue
                if candidate_paths(root, namespace, ref, snapshot['version'], legacy_roots):
                    references.append({'namespace': namespace, 'id': ident, 'pointer': pointer,
                                       'ref': ref, 'existed': exists(root, namespace, ref, snapshot['version'], legacy_roots)})
    return {'records': records, 'ids': ids, 'references': references}


def opaque_identities(root: Path, version: int) -> dict[str, list[int]]:
    found = {}
    for source, destination in OPAQUE.items():
        path = checked(root, root / (source if version < 3 else destination))
        if path.exists():
            stat = path.lstat()
            if not path.is_dir():
                raise ValueError('Raíz opaca inválida')
            found[source] = [stat.st_dev, stat.st_ino]
    return found


def capture(root: Path, legacy_roots=()) -> dict:
    snapshot = scan(root)
    if snapshot['version'] not in (1, 2):
        raise ValueError('Captura requiere perfil v1 o v2')
    found = inventory(root, snapshot, legacy_roots)
    return {'schema_version': 1, 'legacy_server_roots': list(legacy_roots), 'profile_id': digest(str(load(root, root / 'profile.json').get('id', ''))),
            'record_ids': {k: sorted(v) for k, v in found['ids'].items()}, 'references': found['references'],
            'opaque': opaque_identities(root, snapshot['version'])}


def verify(root: Path, baseline: dict) -> dict[str, int]:
    snapshot = scan(root)
    if baseline.get('schema_version') != 1 or snapshot['version'] != 3:
        raise ValueError('Baseline o perfil v3 inválido')
    if baseline.get('profile_id') != digest(str(load(root, root / 'profile.json').get('id', ''))):
        raise ValueError('El baseline corresponde a otro perfil')
    legacy_roots = validate_legacy_roots(baseline.get('legacy_server_roots', []))
    found = inventory(root, snapshot, legacy_roots)
    missing_ids = sum(sum((Counter(ids) - Counter(found['ids'].get(ns, []))).values())
                      for ns, ids in baseline['record_ids'].items())
    opaque_after = opaque_identities(root, snapshot['version'])
    opaque_missing = sum(opaque_after.get(key) != identity for key, identity in baseline['opaque'].items())
    missing_files = previously_missing = retained = non_file = 0
    for ref in baseline['references']:
        if (ref['namespace'], tuple(ref['pointer'])) in SEMANTIC_POINTERS:
            non_file += 1
            continue
        if not ref['existed']:
            previously_missing += 1
            continue
        ns, ident, old = ref['namespace'], ref['id'], ref['ref']
        current = pointer_get(found['records'].get(ns, {}).get(ident), ref['pointer'])
        candidates = [current] if isinstance(current, str) else []
        candidates.append(old)
        if ns in LIBRARIES:
            candidates.append('resources/' + LIBRARIES[ns] + '/' + old)
        for key in list(candidates):
            alias = snapshot['aliases'].get(key)
            if alias:
                candidates.append(alias)
        if any(exists(root, ns, candidate, 3, legacy_roots) for candidate in candidates):
            retained += 1
        else:
            missing_files += 1
    return {'registros_base': sum(map(len, baseline['record_ids'].values())), 'ids_perdidos': missing_ids,
            'referencias_conservadas': retained, 'referencias_perdidas': missing_files,
            'referencias_ya_ausentes': previously_missing, 'referencias_semanticas_ignoradas': non_file,
            'raices_opacas_perdidas': opaque_missing}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile-dir', type=Path, required=True)
    parser.add_argument('--legacy-server-root', action='append', default=[])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--capture', type=Path)
    group.add_argument('--verify', type=Path)
    args = parser.parse_args()
    try:
        root = args.profile_dir.resolve(strict=True)
        baseline_path = (args.capture or args.verify).absolute()
        if not baseline_path.parent.resolve(strict=True).is_relative_to(Path('/tmp').resolve()):
            raise ValueError('El baseline debe estar en /tmp')
        if args.capture:
            data = capture(root, validate_legacy_roots(args.legacy_server_root))
            fd = os.open(baseline_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(data, stream, ensure_ascii=False)
            print(json.dumps({'registros_base': sum(map(len, data['record_ids'].values())),
                              'referencias_base': len(data['references']),
                              'referencias_ya_ausentes': sum(not r['existed'] for r in data['references']),
                              'raices_opacas': len(data['opaque'])}))
            return 0
        if baseline_path.is_symlink():
            raise ValueError('Baseline no puede ser symlink')
        with baseline_path.open(encoding='utf-8') as stream:
            baseline = json.load(stream)
        result = verify(root, baseline)
        print(json.dumps(result))
        return 1 if result['ids_perdidos'] or result['referencias_perdidas'] or result['raices_opacas_perdidas'] else 0
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print(f'Verificación interrumpida: {type(exc).__name__}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
