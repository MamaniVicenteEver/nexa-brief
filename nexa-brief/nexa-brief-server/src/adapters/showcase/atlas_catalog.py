"""Unificar los contratos Atlas del productor y Showcase con el registro del motor."""
from copy import deepcopy
from pathlib import Path
from urllib.parse import quote

from src.adapters.showcase.filesystem import _read, _safe
from src.core.showcase.ports import ShowcaseInvalid


def atlas_engine_catalog(templates: Path, catalog: dict) -> dict:
    path = _safe(Path(templates), 'nodeatlas', 'atlas-en-movimiento', 'engine', 'tactico', 'components.json')
    if not path.is_file():
        return catalog
    payload = _read(path)
    rows = payload.get('components') if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ShowcaseInvalid('Registro de componentes Atlas inválido')
    definitions = {}
    for row in rows:
        name = row.get('name') if isinstance(row, dict) else None
        if not isinstance(name, str) or name in definitions:
            raise ShowcaseInvalid('Componente Atlas inválido o duplicado')
        definitions[name] = row
    result = deepcopy(catalog)
    entries, seen = [], set()
    for entry in result.get('entries', []):
        data = entry.get('data')
        native = (data if isinstance(data, dict) else {}).get('native_name', entry['id'])
        source = definitions.get(native)
        if source is not None:
            entry['name'] = native
            entry['params'] = deepcopy(source.get('params', {}))
            if entry['id'] == native and isinstance(source.get('demo'), dict):
                entry['summary'] = source.get('summary', entry.get('summary', ''))
                entry['example'] = deepcopy(source['demo'])
            elif isinstance(entry.get('example'), dict):
                entry['example']['type'] = native
            seen.add(native)
        entries.append(entry)
    for name, source in definitions.items():
        if name in seen:
            continue
        demo = source.get('demo')
        if not isinstance(demo, dict):
            raise ShowcaseInvalid(f'El componente Atlas {name} necesita una demostración JSON')
        entries.append({
            'id': name, 'name': name, 'label': name, 'kind': 'component',
            'summary': source.get('summary', ''), 'tags': source.get('tags', []),
            'params': deepcopy(source.get('params', {})), 'example': deepcopy(demo),
            'preview_kind': 'iframe',
            'preview_url': '/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/preview/tactico/demo.html'
                           '?only=' + quote(name, safe='') + '&bg=dark&autoplay=1&loop=1&bare=1&aspect=9x16',
            'data': {'native_name': name},
        })
    result['entries'] = entries
    return result
