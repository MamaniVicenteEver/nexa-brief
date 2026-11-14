"""Adaptador local para consultar la biblioteca desde Python, sin servicio adicional."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = frozenset({'simple-icons', 'lucide-static', 'devicon'})
ID_PATTERN = re.compile(r'^[a-z0-9_.-]+$')
FILE_PATTERN = re.compile(r'^icons/[a-z0-9_./-]+\.svg$')


def load_catalog(path: Path | None = None) -> dict:
    target = path or ROOT / 'dist/catalog.json'
    try:
        data = json.loads(target.read_text(encoding='utf-8'))
    except FileNotFoundError as exc:
        raise RuntimeError('Catálogo no preparado. Ejecuta pnpm build.') from exc
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('resources'), list) or not isinstance(data.get('sources'), dict):
        raise ValueError('Catálogo inválido.')
    return data


def _fold(value: object) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', str(value)) if unicodedata.category(c) != 'Mn').lower()


def search_catalog(catalog: dict, *, query: str = '', provider: str = '', category: str = '', offset: int = 0, limit: int = 30) -> dict:
    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0 or isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
        raise ValueError('Límite o desplazamiento inválido.')
    limit = min(limit, 100)
    terms = _fold(query).split()
    matches = []
    for row in catalog['resources']:
        if (provider and row['provider'] != provider) or (category and row['category'] != category):
            continue
        haystack = _fold(' '.join([row['id'], row['label'], *row.get('tags', [])]))
        if all(term in haystack for term in terms):
            matches.append(row)
    return {'total': len(matches), 'offset': offset, 'limit': limit, 'items': matches[offset:offset + limit]}


def get_resource(catalog: dict, resource_id: str) -> dict | None:
    if not isinstance(resource_id, str) or not ID_PATTERN.fullmatch(resource_id) or '..' in resource_id:
        return None
    return next((row for row in catalog['resources'] if row['id'] == resource_id), None)


def read_svg(catalog: dict, resource_id: str, *, package_root: Path = ROOT) -> str:
    row = get_resource(catalog, resource_id)
    if row is None:
        raise ValueError('Recurso no encontrado.')
    source = catalog['sources'].get(row['provider'], {})
    package, file = source.get('package'), row.get('file')
    if package not in PACKAGES or not isinstance(file, str) or not FILE_PATTERN.fullmatch(file) or '..' in PurePosixPath(file).parts:
        raise ValueError('Ruta del recurso inválida.')
    base = (package_root / 'node_modules' / package).resolve(strict=True)
    target = (base / file).resolve(strict=True)
    if not target.is_relative_to(base) or not target.is_file():
        raise ValueError('Ruta del recurso inválida.')
    return target.read_text(encoding='utf-8')
