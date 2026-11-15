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

PLATFORMS = ('youtube', 'facebook', 'instagram', 'tiktok')


def _text(value, limit=500):
    return value[:limit] if isinstance(value, str) else None


def _resource(row):
    source = row.get('source')
    if not isinstance(source, str) or not re.fullmatch(r'[A-Za-z0-9 _.-]{1,100}', source):
        source = None
    return {'id': _text(row.get('id'), 128), 'name': _text(row.get('name')),
            'type': _text(row.get('type'), 32), 'source': source,
            'author': _text(row.get('author')), 'license': _text(row.get('license'))}


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
    result['media'] = items
    result['media_basis'] = 'draft_inputs'
    result['availability']['media'] = 'available' if all(x.get('name') for x in items) else 'missing'
    ident = inputs.get('music_asset_id')
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
                result['media'] = [_resource(r) for r in used]
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
