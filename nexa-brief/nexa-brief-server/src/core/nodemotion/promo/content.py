"""Ficha de lectura de la revisión efectiva, sin rutas ni evidencia privada."""
from __future__ import annotations

import re
import json
from pathlib import Path
from src.core.task_ownership import task_is_owned
from . import agents

from src.core.data import collection
from src.core.library import asset_library
from src.config.exceptions import AssetNotFoundError
from src.core.drafts import load_job
from src.core.template_config import active_config
from src.core.explainer.agent_context import _safe
from src.config.settings import settings
from src.config.profile_layout import layout_for_settings
from .reports import _json, _target, _resource_rows
from .paths import work_script_path

PLATFORMS = ('youtube', 'youtube_shorts', 'facebook', 'instagram', 'tiktok')


def _text(value, limit=500):
    return value[:limit] if isinstance(value, str) else None


def _resource(row):
    source = row.get('source')
    if not isinstance(source, str) or not re.fullmatch(r'[A-Za-z0-9 _.-]{1,100}', source):
        source = None
    return {'id': _text(row.get('id'), 128), 'name': _text(row.get('name')),
            'type': _text(row.get('type'), 32), 'source': source,
            'author': _text(row.get('author')), 'license': _text(row.get('license'))}


def _scene_uses(plan):
    # Index the real scene and slot for each resolved asset.
    uses = {}
    items = plan.get('items') if isinstance(plan, dict) else None
    if not isinstance(items, list):
        return uses
    for item in items:
        if not isinstance(item, dict):
            continue
        kind, ident, scene, slot = (item.get('kind'), item.get('asset_id'),
                                    item.get('scene'), item.get('slot'))
        if kind not in ('image', 'video') or not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', ident):
            continue
        if type(scene) is not int or not 1 <= scene <= 200:
            continue
        if not isinstance(slot, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', slot):
            slot = None
        key = (kind, ident)
        use = {'scene': scene, 'slot': slot}
        if use not in uses.setdefault(key, []):
            uses[key].append(use)
    return uses


def _can_retry(row, draft):
    if not row or row.get('state') not in {'failed', 'review'} or task_is_owned('promo-chat', row['session_id']):
        return False
    if draft and draft.get('status') == 'rendering':
        return False
    try:
        agents.decode(json.dumps(row.get('proposal'), ensure_ascii=False))
        context, ref = row.get('source_context'), row.get('prompt_ref')
        return (isinstance(context, list) and sum(isinstance(item, dict) and bool(item.get('url')) and bool(item.get('text')) for item in context) >= 2
                and isinstance(ref, dict) and bool(ref.get('version')) and isinstance(ref.get('hashes'), dict))
    except (TypeError, ValueError):
        return False




def _scene_media_uses(config, project):
    """Map each configured visual to the scenes that reference its project asset."""
    scenes = active_config(config).get('scenes') if isinstance(config, dict) else None
    references = project.get('assets') if isinstance(project, dict) else None
    if not isinstance(scenes, list) or not isinstance(references, dict):
        return {}
    prefix = project.get('content_prefix') or ''
    uses = {}

    def visit(value, number):
        if isinstance(value, dict):
            for child in value.values():
                visit(child, number)
        elif isinstance(value, list):
            for child in value:
                visit(child, number)
        elif isinstance(value, str):
            ref = references.get(value) or references.get(f'{prefix}/{value}' if prefix else value)
            if not isinstance(ref, dict) or ref.get('kind') not in ('image', 'video'):
                return
            kind, ident = ref.get('kind'), ref.get('asset_id')
            if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', ident):
                return
            key = (kind, ident)
            use = {'scene': number, 'slot': None}
            if use not in uses.setdefault(key, []):
                uses[key].append(use)

    for number, scene in enumerate(scenes[:200], 1):
        visit(scene, number)
    return uses


def _configured_project_media(config, project, resources_root):
    """Return the configured visual resources, including non-input defaults.

    The config is not a playback trace: callers must label these as configured,
    and unknown references remain visible without disclosing local paths.
    """
    if not isinstance(config, dict) or not isinstance(project, dict):
        return None
    configured = active_config(config).get('media')
    references = project.get('assets')
    if not isinstance(configured, list) or not configured or len(configured) > 200 or not isinstance(references, dict):
        return None
    items, seen, complete = [], {}, True
    prefix = project.get('content_prefix') or ''
    for position, spec in enumerate(configured, 1):
        if not isinstance(spec, dict) or spec.get('type') not in ('image', 'video'):
            continue
        kind, source = spec['type'], spec.get('src')
        if not isinstance(source, str) or not source or source.startswith('/') or '..' in source.split('/'):
            complete = False
            continue
        ref = references.get(source) or references.get(f'{prefix}/{source}' if prefix else source)
        ident = ref.get('asset_id') if isinstance(ref, dict) and ref.get('kind') == kind else None
        if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', ident):
            complete = False
            items.append({'id': None, 'name': _text(spec.get('id')) or 'Recurso configurado',
                          'type': kind, 'source': None, 'author': None, 'license': None})
            continue
        key = (kind, ident)
        if key in seen:
            seen[key]['positions'].append(position)
            continue
        folder = 'images' if kind == 'image' else 'videos'
        meta = _json(resources_root, folder, ident, 'resource.json')
        if isinstance(meta, dict) and meta.get('id') == ident:
            item = _resource({**meta, 'type': kind})
        else:
            try:
                entry = asset_library.get_entry(kind, ident)
            except (AssetNotFoundError, ValueError, TypeError):
                entry = None
            note = _text(getattr(entry, 'license_note', None))
            if note:
                note = re.sub(r'https?://\S+', '[enlace omitido]', note)
            item = _resource({'id': ident, 'type': kind,
                              'name': getattr(entry, 'display_name', None) or getattr(entry, 'label', None) or spec.get('id'),
                              'source': getattr(entry, 'provider', None), 'license': note})
        complete = complete and bool(item.get('name'))
        item['positions'] = [position]
        seen[key] = item
        items.append(item)
    if items:
        scene_uses = _scene_media_uses(config, project)
        for item in items:
            item['scene_uses'] = scene_uses.get((item.get('type'), item.get('id')), [])
        indexed = list(enumerate(items))
        indexed.sort(key=lambda pair: (
            0 if pair[1].get('scene_uses') else 1,
            min((use['scene'] for use in pair[1].get('scene_uses', [])),
                default=min(pair[1].get('positions', [pair[0] + 1])),
            ),
            pair[0],
        ))
        items = [item for _, item in indexed]
    return (items, complete) if items else None


def _legacy(result, draft, draft_id):
    """Los únicos artefactos aceptados son los del job dentro del perfil activo."""
    job = load_job(draft_id)
    if not job:
        return False
    profile = _safe(settings.storage_profile_dir)
    output = job.artifacts.output_dir
    if not output or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', output.name):
        return True
    expected = _safe(profile, 'productions', 'nodemotion', output.name)
    assets = _safe(expected, 'assets')
    if output != expected or job.artifacts.content_dir != assets or not assets.is_dir():
        return True
    from src.core.nodemotion.service import load_project, resolve_project, lyrics_for_job

    project = load_project(output)
    if project is None:
        lyrics, config = _json(assets, 'lyrics.json'), _json(assets, 'config.json')
    else:
        lyrics = lyrics_for_job(job)
        prefix = project.get('content_prefix', '')
        config_key = f"{prefix}/config.json" if prefix else "config.json"
        resolved_config = resolve_project(output, config_key, expected_revision=project.get('engine', {}).get('revision'))
        if isinstance(resolved_config, Path):
            config = json.loads(resolved_config.read_text(encoding='utf-8'))
        elif isinstance(resolved_config, bytes):
            config = json.loads(resolved_config)
        else:
            config = None
    segments = lyrics.get('segments') if isinstance(lyrics, dict) else None
    scenes = active_config(config).get('scenes') if isinstance(config, dict) else None
    if isinstance(segments, list) and len(segments) <= 200 and isinstance(scenes, list) and scenes:
        converted = []
        for i, item in enumerate(segments):
            lines = item.get('lines') if isinstance(item, dict) else None
            scene = scenes[i % len(scenes)]
            if not isinstance(lines, list) or len(lines) > 50 or not all(isinstance(x, str) and len(x) <= 1000 for x in lines) or not isinstance(scene, dict):
                break
            converted.append({'n': i+1, 'scene': _text(scene.get('type'), 100), 'lines': lines})
        else:
            result['guion'] = {'segments': converted}
            result['availability']['guion'] = 'available'
    inputs = draft.get('inputs') or {}
    media = (inputs.get('template_inputs') or {}).get('media') or {}
    root = layout_for_settings(settings).resources_dir
    items = []
    for field, kind, folder in (('clips','video','videos'), ('photos','image','images')):
        entries = media.get(field, [])
        if not isinstance(entries, list) or len(entries) > 200:
            return True
        for ident in entries:
            if not isinstance(ident,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}',ident):
                return True
            if any(r['id']==ident and r['type']==kind for r in items):
                continue
            meta = _json(root,folder,ident,'resource.json')
            if isinstance(meta,dict) and meta.get('id')==ident:
                items.append(_resource(meta))
            else:
                items.append({'id':ident,'name':None,'type':kind,'source':None,'author':None,'license':None})
    configured_media = _configured_project_media(config, project, root)
    if configured_media is not None:
        items, complete = configured_media
        result['media_basis'] = 'effective_config'
        result['availability']['media'] = 'available' if complete else 'missing'
    else:
        result['media_basis'] = 'draft_inputs'
        result['availability']['media'] = 'available' if all(x.get('name') for x in items) else 'missing'
    result['media'] = items
    music_record = _json(assets, 'music.json')
    ident = inputs.get('music_asset_id')
    if not isinstance(ident, str) and isinstance(music_record, dict):
        ident = music_record.get('asset_id')
    if isinstance(ident,str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}',ident):
        meta = _json(root,'music',ident,'resource.json')
        if isinstance(meta,dict) and meta.get('id')==ident:
            result['music'] = _resource(meta)
            result['availability']['music'] = 'available' if meta.get('name') else 'missing'
        else:
            try:
                entry = asset_library.get_music_entry(ident)
            except (AssetNotFoundError, ValueError, TypeError):
                entry = None
            if entry is not None and entry.asset_id == ident:
                note = _text(entry.license_note)
                if note:
                    note = re.sub(r'https?://\S+', '[enlace omitido]', note)
                result['music'] = _resource({'id': ident, 'type': 'music',
                    'name': entry.track_name, 'author': entry.artist,
                    'source': entry.provider, 'license': note})
                result['availability']['music'] = 'available' if entry.track_name else 'missing'

    return True


def read_legacy_resources(draft_id):
    """Read-only resource sheet for a saved Promo draft that has no review session yet."""
    if not isinstance(draft_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', draft_id):
        return None
    draft = collection('drafts').get(draft_id)
    if (
        not isinstance(draft, dict)
        or not isinstance(draft.get('template_id'), str)
        or not draft['template_id'].startswith('promo-')
        or draft.get('original') is True
        or draft.get('status') not in {'prepared', 'preview_ready'}
    ):
        return None
    result = {
        'guion': None, 'media': None, 'media_basis': None, 'music': None,
        'availability': {'guion': 'missing', 'media': 'missing', 'music': 'missing'},
    }
    if not _legacy(result, draft, draft_id):
        return None
    details = draft.get('details') if isinstance(draft.get('details'), dict) else {}
    music = result.get('music') if isinstance(result.get('music'), dict) else None
    song_name = _text(details.get('song_name'), 200) or (music or {}).get('name')
    artist = _text(details.get('artist'), 200) or (music or {}).get('author')
    return {
        'draft_id': draft_id,
        'title': _text(draft.get('name'), 300),
        'song': {'title': song_name, 'artist': artist},
        'music': music,
        'media': result.get('media') if isinstance(result.get('media'), list) else [],
        'media_basis': result.get('media_basis'),
        'lyrics': result.get('guion'),
        'availability': result['availability'],
    }


def read_content(service, session_id):
    row = service.get(session_id)
    revision, draft_id = row.get('revision'), row.get('draft_id')
    result = {'session_id': session_id, 'revision': revision, 'draft_id': draft_id,
              'can_retry_preparation': False, 'title': None, 'copies': {name: None for name in PLATFORMS},
              'brief': None, 'guion': None, 'media': None, 'media_basis': None, 'music': None,
              'availability': {'draft': 'missing', 'brief': 'missing', 'guion': 'missing', 'media': 'missing', 'music': 'missing'}}
    if row.get('state') in ('queued', 'running'):
        result['availability'] = dict.fromkeys(result['availability'], 'pending')
        return result
    draft = collection('drafts').get(draft_id) if draft_id else None
    raw_row = service._rows().get(session_id)
    result['can_retry_preparation'] = _can_retry(raw_row, draft)
    if isinstance(draft, dict) and draft.get('draft_id') == draft_id and draft.get('template_id') == row.get('template_id'):
        result['title'] = _text(draft.get('name'))
        copies = (draft.get('details') or {}).get('copies') or {}
        for name in PLATFORMS:
            item = copies.get(name)
            if isinstance(item, dict):
                result['copies'][name] = {'title': _text(item.get('title'), 500), 'description': _text(item.get('description'), 5000)}
        # Older drafts acquire the same Shorts starting copy as DraftDetails.
        if 'youtube_shorts' not in copies and isinstance(copies.get('youtube'), dict):
            from src.core.draft_details import PlatformDetails, _shorts_variant
            youtube = copies['youtube']
            variant = _shorts_variant(PlatformDetails(
                title=_text(youtube.get('title'), 300) or '',
                description=_text(youtube.get('description'), 5000) or '',
            ))
            result['copies']['youtube_shorts'] = {'title': variant.title, 'description': variant.description}
        result['availability']['draft'] = 'available'
    else:
        return result
    try:
        project = service._project(session_id)
        target = _target(project, session_id, revision)
        record = _json(target, 'draft.json') if target else None
        if target and isinstance(record, dict) and record.get('draft_id') == draft_id:
            brief = _json(target, 'brief.json')
            if isinstance(brief, dict):
                result['brief'] = {k: _text(brief.get(k), 1000) for k in ('topic', 'tone', 'language', 'audience')}
                duration = brief.get('duration_seconds')
                result['brief']['duration_seconds'] = duration if isinstance(duration, (int, float)) and not isinstance(duration, bool) else None
                result['availability']['brief'] = 'available'
            guion = _json(target, 'work', work_script_path(target).name)
            segments = guion.get('segments') if isinstance(guion, dict) else None
            if isinstance(segments, list) and len(segments) <= 200 and all(isinstance(s, dict) and isinstance(s.get('lines'), list) and len(s['lines']) <= 50 and all(isinstance(line, str) and len(line) <= 1000 for line in s['lines']) for s in segments):
                result['guion'] = {'segments': [{'n': s.get('n'), 'scene': _text(s.get('scene'), 100), 'lines': s['lines']} for s in segments]}
                result['availability']['guion'] = 'available'
            # La letra y escenas del job son lo que el preview usa; el guion de
            # trabajo puede haber quedado desactualizado tras una corrección.
            actual = {'guion': None, 'media': None, 'music': None,
                      'availability': {'guion': 'missing', 'media': 'missing', 'music': 'missing'}}
            if _legacy(actual, draft, draft_id):
                result['guion'] = actual['guion']
                result['availability']['guion'] = actual['availability']['guion']
            plan = _json(target, 'media-plan.json')
            music = _json(target, 'music.json')
            resources = _resource_rows(target)
            if isinstance(plan, dict) and isinstance(plan.get('items'), list) and len(plan['items']) <= 200:
                used = [r for r in resources if r.get('type') in ('image', 'video')]
                uses = _scene_uses(plan)
                result['media'] = []
                for resource in used:
                    item = _resource(resource)
                    item['scene_uses'] = uses.get((resource.get('type'), resource.get('id')), [])
                    result['media'].append(item)
                result['media_basis'] = 'resolved_plan'
                expected = {(item.get('kind'), item.get('asset_id')) for item in plan['items'] if isinstance(item, dict) and item.get('kind') in ('image', 'video')}
                actual = {(r.get('type'), r.get('id')) for r in used if r.get('name')}
                result['availability']['media'] = 'available' if expected == actual else 'missing'
            if isinstance(music, dict):
                item = next((r for r in resources if r.get('type') == 'music' and r.get('id') == music.get('asset_id')), None)
                if item:
                    result['music'] = _resource(item)
                    result['availability']['music'] = 'available' if item.get('name') else 'missing'
        elif not target and not row.get('proposal') and _json(project, 'work', 'content.json') is None:
            _legacy(result, draft, draft_id)
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        pass
    current = service.get(session_id)
    current_draft = collection('drafts').get(draft_id)
    if any(current.get(k) != row.get(k) for k in ('revision', 'draft_id', 'state', 'updated_at')) or current_draft != draft:
        result.update(can_retry_preparation=False, title=None, copies=dict.fromkeys(PLATFORMS), brief=None, guion=None, media=None, media_basis=None, music=None)
        result['availability'] = dict.fromkeys(result['availability'], 'stale')
    return result
