"""Update category labels and remove unused categories without moving content."""
from __future__ import annotations

import json
from pathlib import Path

from src.config.settings import settings
from src.config.profile_layout import layout_for_settings
from src.core.categories import CategoryNode, reload_categories, validate_tree
from src.core.category_creation import (
    CategoryCreationError, CategoryConflictError, _config_lock, _display_key,
    _single_line, _write_config_atomically,
)


def manage_category(category_id: str, update: dict | None, *, config_path: Path | None = None):
    path = config_path or settings.niches_path
    with _config_lock(path):
        raw = json.loads(path.read_text())
        nodes = raw.get('categories', {})
        if category_id not in nodes:
            raise KeyError(category_id)
        node = CategoryNode.model_validate(nodes[category_id])
        if update is None:
            if node.designs or node.shared_designs or node.niches or node.children:
                raise CategoryConflictError('La categoría tiene diseños, nichos o subcategorías; retira sus referencias antes de eliminarla')
            layout = layout_for_settings(settings)
            folder = node.folder or category_id
            for root in (layout.productions_dir, layout.sandbox_dir, layout.renders_dir / 'videos', layout.renders_dir / 'images'):
                directory = root / folder
                if directory.is_symlink() or directory.is_dir() and any(p.name not in {'AGENTS.md', 'CLAUDE.md'} for p in directory.iterdir()):
                    raise CategoryConflictError('La categoría contiene archivos; no se elimina')
            from src.core.data import collection
            for name in ('content_videos', 'explainer_productions', 'schedule_slots', 'queue_entries', 'channel_categories', 'drafts'):
                for row in collection(name).list():
                    values = [row.get(k) for k in ('category', 'category_path', 'category_id', 'niche_filter')]
                    if category_id in values:
                        raise CategoryConflictError('La categoría tiene contenido, canales o programación asociados')
            del nodes[category_id]
        else:
            fields = {}
            if 'display_name' in update:
                value = _single_line(update['display_name'], field='El nombre', limit=48)
                if len(value) < 2:
                    raise CategoryCreationError('El nombre debe tener al menos dos caracteres')
                if any(k != category_id and _display_key(n.get('display_name', '')) == _display_key(value) for k, n in nodes.items()):
                    raise CategoryConflictError('Ya existe una categoría con ese nombre')
                fields['display_name'] = value
            if 'topic' in update:
                fields['topic'] = _single_line(update['topic'], field='El tema', limit=180)
            if 'status' in update:
                fields['status'] = update['status']
            if 'language' in update:
                strategy = node.strategy.model_dump() if node.strategy else {}
                strategy['language'] = update['language']
                fields['strategy'] = strategy
            node = CategoryNode.model_validate({**node.model_dump(), **fields})
            nodes[category_id] = node.model_dump(mode='json')
        parsed = {key: CategoryNode.model_validate(val) for key, val in nodes.items()}
        validate_tree(parsed, set(raw.get('niches', {})))
        _write_config_atomically(path, raw)
        reload_categories()
        return node if update is not None else None
