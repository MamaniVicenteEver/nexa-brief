"""Recoverable correction for a registered demo whose engine is still experimental."""
from __future__ import annotations

import json
from pathlib import Path

from src.adapters.data.file_locks import AsyncFileLock
from src.adapters.showcase.filesystem import _safe, _write
from src.core.explainer.engine_locations import (
    apply_engine_move, contracts, engine_root, plan_engine_move, rollback_engine_move,
)
from src.core.explainer.production_templates import ID


def rewrite_engine_routes(value, source: str, target: str):
    """Route-only rewrite: retain component IDs, examples and revision."""
    if isinstance(value, str):
        old = '/api/v1/explainer/files/' + source + '/'
        new = '/api/v1/explainer/files/bundled/' + target + '/'
        if value.startswith(old):
            return new + value[len(old):]
        if value.startswith(source + '/'):
            return target + value[len(source):]
        return value
    if isinstance(value, list):
        return [rewrite_engine_routes(v, source, target) for v in value]
    if isinstance(value, dict):
        return {k: rewrite_engine_routes(v, source, target) for k, v in value.items()}
    return value


class RegisteredEngineProduction:
    def __init__(self, showcase, layout):
        self.showcase, self.layout = showcase, layout
        self.templates = showcase.templates
        self.store = showcase.store
        self.journals = layout.runtime_dir / 'design-engine-production'

    def _validate(self, design, catalog):
        marker = design.get('production_template') or {}
        folder = marker.get('folder', '').split('/')
        if marker.get('demo') is not True or len(folder) != 2 or not all(ID.fullmatch(p) for p in folder):
            raise ValueError('El diseño necesita una demo principal registrada')
        demo = _safe(self.templates, *folder)
        if not (demo / 'manifest.json').is_file():
            raise ValueError('No se encuentra la demo principal')
        engine = design.get('engine_id')
        if not isinstance(engine, str) or not engine:
            raise ValueError('El diseño no declara motor')
        root = engine_root(self.templates, engine, design)
        if not root.is_dir():
            raise ValueError('No se encuentra el motor compartido')
        rows = catalog.get('entries', [])
        if not rows or any(not r.get('id') or not r.get('summary') or
                           (r.get('preview_kind') == 'iframe' and not r.get('preview_url')) for r in rows):
            raise ValueError('El catálogo de componentes está incompleto')
        component_file = root / 'components.json'
        if component_file.is_file():
            payload = json.loads(component_file.read_text())
            names = {r['name'] for r in payload.get('components', [])}
            if names != {r['name'] for r in rows}:
                raise ValueError('Showcase no contiene exactamente los componentes del motor')
        return root, rows

    def blocker(self, design, catalog):
        """Cheap read-only availability check; apply repeats under both locks."""
        try:
            self._validate(design, catalog)
        except ValueError as exc:
            return str(exc)
        return None

    async def _restore(self, path, journal):
        validated = []
        for relative, before in journal['files'].items():
            parts = relative.split('/')
            if (len(parts) != 4 or parts[:2] != ['_tools', 'design-definitions']
                    or not ID.fullmatch(parts[2]) or parts[3] not in {'design.json', 'catalog.json'}):
                raise ValueError('Diario de motor inválido')
            validated.append((_safe(self.templates, *parts), before))
        for ident in journal['states']:
            if not ID.fullmatch(ident):
                raise ValueError('Identidad de motor inválida')
        rollback_engine_move(self.templates, journal['plan'])
        for file, before in validated:
            _write(file, before)
        for ident, row in journal['states'].items():
            if not ID.fullmatch(ident):
                raise ValueError('Identidad de motor inválida')
            if row is None:
                await self.store.collection('showcase_designs').delete(ident)
            else:
                await self.store.collection('showcase_designs').upsert(row, match=['id'])
        _write(path, {**journal, 'state': 'recovered'})

    async def recover(self):
        if not self.journals.is_dir():
            return
        async with self.store.coordination('showcase'), AsyncFileLock(self.templates / '.pass-to-production.lock'):
            for path in self.journals.glob('*.json'):
                journal = json.loads(path.read_text())
                if journal.get('state') == 'moving':
                    await self._restore(path, journal)

    async def pass_to_production(self, ident, *, apply=False, category_path=None, shared_categories=None):
        if not isinstance(ident, str) or not ID.fullmatch(ident):
            raise ValueError('Identidad de diseño inválida')
        async with self.store.coordination('showcase'), AsyncFileLock(self.templates / '.pass-to-production.lock'):
            path = self.journals / (ident + '.json')
            if path.is_file() and json.loads(path.read_text()).get('state') == 'moving':
                raise ValueError('Hay una operación interrumpida; ejecutar recuperación')
            contract = self.showcase._definition(ident)
            if not contract:
                raise ValueError('El diseño no está registrado')
            design, catalog = contract
            root, rows = self._validate(design, catalog)
            folder = design['production_template']['folder'].split('/')
            if category_path is not None:
                from src.core.categories import get_category
                selected = [category_path, *(shared_categories or [])]
                if (len(selected) != len(set(selected)) or any(
                    not isinstance(p, str) or not get_category(p) or
                    not get_category(p.split('/', 1)[0]) or
                    get_category(p.split('/', 1)[0]).engine != 'explainer_kit'
                    for p in selected)):
                    raise ValueError('Categorías de diseño inválidas')
                if get_category(category_path.split('/', 1)[0]).folder != folder[0]:
                    raise ValueError('La categoría principal debe coincidir con la demo registrada')
            engine = design['engine_id']
            plan = plan_engine_move(self.templates, engine, folder[0], ident, design)
            target_root = plan['target'] if plan else root.relative_to(self.templates).as_posix()
            affected, files, states = {}, {}, {}
            for file, consumer in contracts(self.templates):
                if consumer.get('engine_id') != engine:
                    continue
                parent = file.parent
                payload = json.loads((parent / 'catalog.json').read_text())
                for name, original in [('design.json', consumer), ('catalog.json', payload)]:
                    files[(parent / name).relative_to(self.templates).as_posix()] = original
                row = self.store.collection('showcase_designs').get(consumer['id'])
                states[consumer['id']] = row
                revised = rewrite_engine_routes(consumer, plan['source'], plan['target']) if plan else dict(consumer)
                revised['engine_root'] = target_root
                if plan:
                    revised['legacy_engine_roots'] = list(dict.fromkeys([
                        *consumer.get('legacy_engine_roots', []), plan['source']]))
                if consumer.get('production_template'):
                    revised['state'] = 'produccion'
                affected[consumer['id']] = (parent, revised, rewrite_engine_routes(payload, plan['source'], plan['target']) if plan else payload)
            result = {'state': 'reviewed', 'design': ident, 'engine_move': plan,
                      'components': len(rows), 'consumers': sorted(affected)}
            if not apply:
                return result
            if (plan is None and category_path is None and all(
                    original == revised and states[key] and states[key].get('state') == revised['state']
                    for key, (parent, revised, _) in affected.items()
                    for original in [json.loads((parent / 'design.json').read_text())])):
                return {**result, 'state': 'already_production', 'engine_root': target_root}
            journal = {'state': 'moving', 'plan': plan, 'files': files, 'states': states}
            _write(path, journal)
            moved = False
            try:
                apply_engine_move(self.templates, plan, {})
                moved = True
                for key, (parent, revised, payload) in affected.items():
                    _write(parent / 'design.json', revised)
                    _write(parent / 'catalog.json', payload)
                    previous = states[key]
                    row = {**(previous or {}), 'id': key, 'definition_ref': key,
                           'revision': revised['revision'],
                           'state': revised['state'] if revised.get('production_template') else
                                    (previous or {}).get('state', revised['state'])}
                    if revised.get('category_path'):
                        row['category_path'] = revised['category_path']
                    if key == ident and category_path is not None:
                        row['category_path'] = category_path
                        row['shared_categories'] = shared_categories or []
                    await self.store.collection('showcase_designs').upsert(row, match=['id'])
                _write(path, {**journal, 'state': 'complete'})
            except BaseException:
                # A competing target appearing before rename is never ours.
                if moved:
                    await self._restore(path, journal)
                else:
                    _write(path, {**journal, 'state': 'not_applied'})
                raise
            return {**result, 'state': 'production'}
