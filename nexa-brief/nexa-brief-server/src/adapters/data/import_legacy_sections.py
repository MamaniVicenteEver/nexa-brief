"""Convert known v2 JSON namespaces into v3 sections in an offline staging profile.

This does not read connection files, sessions, log payloads, or arbitrary JSON. The
caller owns staging, maintenance mode, backup and the final profile switch.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from src.adapters.data.layout import COLLECTIONS, DOCUMENTS
from src.adapters.data.section_names import COLLECTION_SECTIONS, DOCUMENT_SECTIONS

_EXCLUDED_COLLECTIONS = {'publication_index', 'showcase_designs'}
_REQUIRED_SECTIONS = {'videos', 'image-posts', 'publicaciones', 'resources', 'designs', 'jobs', 'logs'}


def _checked(path: Path, root: Path) -> Path:
    if not path.is_relative_to(root):
        raise ValueError('Path outside staging root')
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('Symlinks are not permitted in migration paths')
        if part == root:
            break
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Path outside staging root')
    return path


def _read(path: Path, root: Path) -> Any:
    _checked(path, root)
    with path.open(encoding='utf-8') as stream:
        return json.load(stream)


def import_legacy_data(source_data_dir: Path, destination_data_dir: Path) -> dict[str, int]:
    """Import an offline v2 `data` tree into empty v3 `data/json` files.

    Returns counts by logical namespace, never content. Existing destination
    section files are rejected. Inputs are left intact. The caller must discard
    staging on failure and not run this while writers are active.
    """
    source, destination = Path(source_data_dir).absolute(), Path(destination_data_dir).absolute()
    _checked(source, source)
    _checked(destination, destination)
    sections: dict[str, dict[str, Any]] = {}
    counts: dict[str, int] = {}

    def section(name: str) -> dict[str, Any]:
        return sections.setdefault(name, {'schema_version': 1, 'revision': 1, 'collections': {}, 'documents': {}})

    for name, (relative, key_field) in COLLECTIONS.items():
        if name in _EXCLUDED_COLLECTIONS:
            continue
        path = _checked(source / relative, source)
        if not path.exists():
            continue
        rows = _read(path, source)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError(f'Invalid collection: {name}')
        if key_field is not None:
            keys = [row.get(key_field) for row in rows]
            if any(not isinstance(key, str) or not key for key in keys) or len(keys) != len(set(keys)):
                raise ValueError(f'Missing or duplicate key in collection: {name}')
        section(COLLECTION_SECTIONS[name])['collections'][name] = rows
        counts[name] = len(rows)

    for name, relative in DOCUMENTS.items():
        directory = _checked(source / relative, source)
        if not directory.exists():
            continue
        if not directory.is_dir():
            raise ValueError(f'Invalid document directory: {name}')
        docs = {}
        for path in sorted(directory.glob('*.json')):
            _checked(path, source)
            if not path.is_file() or path.stem.startswith('.'):
                raise ValueError(f'Invalid document in {name}')
            docs[path.stem] = _read(path, source)
        if docs:
            section(DOCUMENT_SECTIONS[name])['documents'][name] = docs
            counts[name] = len(docs)

    publications = _checked(source / 'publicaciones', source)
    records = {}
    if publications.exists():
        from src.adapters.data.json_publication_repository import JsonPublicationRepository, _SAFE_ID
        for path in sorted(publications.glob('*/*/*/*/record.json')):
            record = JsonPublicationRepository._dump(_read(path, source))
            publication_id = record['publication_id']
            if not _SAFE_ID.fullmatch(publication_id) or publication_id in records:
                raise ValueError('Invalid or duplicate publication ID')
            records[publication_id] = record
    if records:
        section('publicaciones')['documents']['publications'] = records
        counts['publications'] = len(records)
        from src.adapters.data.section_publication_repository import image_post_index
        index = section('image-posts')
        index['collections']['image_posts_index'] = image_post_index(records)
        index['documents']['index_metadata'] = {'source_revision': 1}

    # Only the two known receipt shapes are accepted; no arbitrary cached
    # response or private connection material is imported from this file.
    ledger_path = _checked(publications / 'idempotency.json', source)
    if ledger_path.exists():
        from src.core.image_posts.models import Delivery
        from src.core.image_posts.security import redact_persisted_value
        ledger = _read(ledger_path, source)
        if not isinstance(ledger, dict):
            raise ValueError('Invalid publication idempotency ledger')
        clean = {}
        for key, entry in ledger.items():
            if not isinstance(key, str) or not key or not isinstance(entry, dict):
                raise ValueError('Invalid publication idempotency entry')
            body_hash = entry.get('body_hash')
            if not isinstance(body_hash, str) or not body_hash:
                raise ValueError('Invalid publication idempotency hash')
            if key.startswith('request:'):
                if set(entry) != {'body_hash', 'result'} or not isinstance(entry['result'], dict):
                    raise ValueError('Unknown publication receipt')
                result = entry['result']
                if set(result) == {'delivery_ids'} and isinstance(result['delivery_ids'], list) and all(isinstance(x, str) for x in result['delivery_ids']):
                    safe_result = {'delivery_ids': result['delivery_ids']}
                elif set(result) == {'delivery'}:
                    safe_result = {'delivery': Delivery.model_validate(redact_persisted_value(result['delivery'])).model_dump(mode='json')}
                else:
                    raise ValueError('Unknown publication receipt')
                clean[key] = {'body_hash': body_hash, 'result': safe_result}
            else:
                if set(entry) != {'body_hash', 'publication_id'} or entry['publication_id'] not in records:
                    raise ValueError('Publication idempotency points to a missing record')
                clean[key] = {'body_hash': body_hash, 'publication_id': entry['publication_id']}
        if clean:
            section('publicaciones')['documents']['publication_idempotency'] = clean
            counts['publication_idempotency'] = len(clean)

    for name in _REQUIRED_SECTIONS:
        section(name)
    target_dir = _checked(destination / 'json', destination)
    paths = {name: _checked(target_dir / f'{name}.json', destination) for name in sections}
    for path in paths.values():
        if path.exists():
            raise FileExistsError(f'Section already exists: {path.name}')
    tmp_dir = _checked(destination.parent / '.system' / 'runtime' / 'tmp', destination.parent)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    target_dir.mkdir(parents=True, exist_ok=True)
    written = []
    try:
        for name, path in sorted(paths.items()):
            fd, temp = tempfile.mkstemp(prefix='.section-import.', dir=tmp_dir)
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                    json.dump(sections[name], stream, ensure_ascii=False, indent=2)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.link(temp, path)  # O_EXCL semantics; never replace another section.
                written.append(path)
            finally:
                os.unlink(temp)
        fd = os.open(target_dir, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    except BaseException:
        for path in written:
            path.unlink(missing_ok=True)
        raise
    return counts
