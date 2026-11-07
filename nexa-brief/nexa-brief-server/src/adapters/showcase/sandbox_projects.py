"""Explicit, profile-owned Showcase visibility for evolving Sandbox projects."""
from __future__ import annotations

import asyncio
import hashlib
import json

from src.adapters.showcase.legacy_catalogs import (
    _catalog, _entry, _inside, _json, _url, legacy_entry_preview,
)
from src.core.showcase.ports import ShowcaseConflict, ShowcaseNotFound

_RESERVED = {"referencias", "nuevos", "designs", "assets", "work", "render", "logs", "tools", "prompts"}


class SandboxProjectsAdapter:
    def __init__(self, owner):
        self.owner = owner

    def _shared_ids(self):
        return {p.name for p in self.owner.definitions.iterdir() if p.is_dir() and not p.is_symlink()}

    def _item(self, folder, project_id, shared):
        root = self.owner.sandbox
        if any(not isinstance(v, str) or v.startswith((".", "_")) or v in _RESERVED
               or '/' in v or '\\' in v for v in (folder, project_id)):
            return None
        relative = f"{folder}/{project_id}"
        directory = _inside(root, relative)
        if directory is None or not directory.is_dir():
            return None
        markers = [_inside(root, f"{relative}/{name}")
                   for name in ("index.html", "info.json", "manifest.json")]
        if not any(path is not None and path.is_file() for path in markers):
            return None
        info = _json(root, f"{relative}/info.json") or {}
        manifest = _json(root, f"{relative}/manifest.json") or {}
        if not isinstance(info, dict) or not isinstance(manifest, dict):
            return None
        candidates = [project_id, info.get("design"), manifest.get("design")]
        if isinstance(info.get("engine"), str) and info["engine"].startswith("explainer-kit:"):
            candidates.append(info["engine"].split(":", 1)[1])
        existing = next((v for v in candidates if isinstance(v, str) and v in shared), None)
        ident = existing or "sandbox-" + hashlib.sha256(relative.encode()).hexdigest()[:24]
        return dict(folder=folder, project_id=project_id, design_id=ident,
                    managed=existing is None, relative=relative, info=info)

    def _items(self):
        root = self.owner.sandbox
        if root.is_symlink() or not root.is_dir():
            return []
        shared = self._shared_ids()
        items = []
        for category in sorted(root.iterdir()):
            if category.name.startswith((".", "_")) or category.name in _RESERVED:
                continue
            safe_category = _inside(root, category.name)
            if safe_category is None or not safe_category.is_dir():
                continue
            for directory in sorted(safe_category.iterdir()):
                item = self._item(category.name, directory.name, shared)
                if item:
                    items.append(item)
        return items

    def _records(self):
        return {row['id']: row for row in self.owner.store.collection("sandbox_showcase").list()
                if isinstance(row, dict) and isinstance(row.get('id'), str)}

    def _catalog(self, item):
        info, relative = item['info'], item['relative']
        if isinstance(info.get('catalog'), dict):
            entries, gallery, _ = _catalog(self.owner, self.owner.sandbox, relative, info, item['design_id'])
        else:
            entries, gallery = [], None
            for row in info.get('components', []) if isinstance(info.get('components'), list) else []:
                entry = _entry(row, None) if isinstance(row, dict) else None
                if entry:
                    entry.update(preview_kind='json', data=row)
                    entries.append(entry)
        # A component keeps its native name for gallery selection; group buttons
        # remain the project's own navigation, not another design's categories.
        for entry in entries:
            entry.setdefault('family', entry['name'].split('.', 1)[0])
        revision = hashlib.sha256(json.dumps([info, entries], sort_keys=True).encode()).hexdigest()[:24]
        catalog = dict(schema_version=1, design_id=item['design_id'], revision=revision, entries=entries)
        declaration = info.get('catalog')
        if isinstance(declaration, dict) and isinstance(declaration.get('tabs'), list):
            catalog['groups'] = [{k: tab[k] for k in ('id', 'label', 'families', 'components') if k in tab}
                                 for tab in declaration['tabs'] if isinstance(tab, dict)
                                 and isinstance(tab.get('id'), str) and isinstance(tab.get('label'), str)]
        return catalog, gallery

    def _state(self, item, records):
        return {k: item[k] for k in ('folder', 'project_id', 'design_id', 'managed')} | {
            'visible': not item['managed'] or records.get(item['design_id'], {}).get('visible') is True,
            'component_count': len(self._catalog(item)[0]['entries']) if item['managed'] else None,
        }

    def states(self):
        items = self._items()
        if not items:
            return []
        records = self._records()
        return [self._state(item, records) for item in items]

    def set_visible(self, folder, project_id, visible):
        async def change():
            async with self.owner.store.coordination('showcase'):
                item = next((v for v in self._items() if v['folder'] == folder and v['project_id'] == project_id), None)
                if item is None:
                    raise ShowcaseNotFound('Proyecto Sandbox no encontrado')
                if not item['managed']:
                    raise ShowcaseConflict('Este diseño ya está registrado; conserva su flujo actual')
                await self.owner.store.collection('sandbox_showcase').upsert(
                    {'id': item['design_id'], 'folder': folder, 'project_id': project_id, 'visible': visible}, match=['id'])
                return self._state(item, self._records())
        return asyncio.run(change())

    def _enabled(self):
        # Preview requests resolve only explicit selections, not every prototype.
        root = self.owner.sandbox
        if root.is_symlink() or not root.is_dir():
            return []
        shared = self._shared_ids()
        items = []
        for record in self._records().values():
            if record.get('visible') is not True:
                continue
            item = self._item(record.get('folder'), record.get('project_id'), shared)
            if item and item['managed'] and item['design_id'] == record['id']:
                items.append(item)
        return sorted(items, key=lambda v: v['design_id'])

    def _design(self, item):
        catalog, _ = self._catalog(item)
        preview = _url(self.owner, self.owner.sandbox, item['relative'] + '/index.html')
        info = item['info']
        title = info.get('title') if isinstance(info.get('title'), str) and info['title'] else item['project_id']
        engine = info.get('engine') if isinstance(info.get('engine'), str) and info['engine'] else 'sandbox'
        description = info.get('summary') if isinstance(info.get('summary'), str) else ''
        return dict(id=item['design_id'], name=title,
                    category=item['folder'], state='prueba', family='sandbox',
                    engine_id=engine, description=description,
                    revision=catalog['revision'], preview_url=preview, promotable=False,
                    promote_blocker='Este proyecto continúa en Sandbox; su registro no lo promueve a producción.',
                    episodes=[dict(id=item['project_id'], title=title,
                                   design_id=item['design_id'], preview_url=preview)])

    def list_designs(self):
        return [self._design(item) for item in self._enabled()]

    def get_design(self, ident):
        item = next((v for v in self._enabled() if v['design_id'] == ident), None)
        return self._design(item) if item else None

    def get_catalog(self, ident):
        item = next((v for v in self._enabled() if v['design_id'] == ident), None)
        return self._catalog(item)[0] if item else None

    def preview(self, ident, entry_id, format):
        item = next((v for v in self._enabled() if v['design_id'] == ident), None)
        if item is None:
            return None
        if entry_id is None:
            return self._design(item)['preview_url']
        catalog, gallery = self._catalog(item)
        entry = next((v for v in catalog['entries'] if v['id'] == entry_id), None)
        return legacy_entry_preview(entry, gallery, format)
