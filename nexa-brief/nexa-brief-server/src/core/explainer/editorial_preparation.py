"""Complete a production video's editorial package. Never moves or records content."""
from __future__ import annotations
import asyncio
import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol
from dataclasses import asdict

from src.config.settings import settings
from src.config.content_paths import content_key, sandbox_root, preview_directory
from src.core.data import collection, coordination
from src.core.task_ownership import start_owned_task, task_is_owned
from src.adapters.data.file_locks import AsyncFileLock
from src.core.explainer.catalog import get_video, load_video
from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.publishing.store import load_package, read_publish, save_package
from src.core.explainer.publishing.checks import check_package
from src.core.explainer.publishing.strategies import resolve_for_video, resolved_from_snapshot
from src.core.execution_logs import register_execution_log
from src.adapters.showcase.filesystem import _write

ACTIVE = {'queued', 'running'}
logger = logging.getLogger(__name__)

class EditorialGenerator(Protocol):
    async def generate(self, context: dict, workspace: Path, schema: dict, log_path: Path, on_usage): ...

def now():
    return datetime.now(timezone.utc).isoformat()

def _video(ident):
    if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', ident):
        raise ValueError('Identificador inválido')
    video = get_video(ident)
    if not video or video.path.resolve().is_relative_to(sandbox_root().resolve()):
        raise FileNotFoundError('Completa la preparación desde la categoría, después del traslado')
    return video

def input_signature(video, *, readiness=False):
    digest = hashlib.sha256()
    names = ['assets/script.json','assets/lyrics.json','assets/scene.json','assets/config.json','assets/song.mp3','publish.json']
    media = video.path / 'assets/media'
    if media.is_dir(): names += [str(p.relative_to(video.path)) for p in media.rglob('*') if p.is_file()]
    for name in names:
        file = video.path / name
        if file.is_symlink(): raise ValueError('No se permiten enlaces simbólicos')
        if file.is_file():
            digest.update(name.encode())
            if readiness and name == 'publish.json':
                from src.core.explainer.publishing.store import COMPAT_KEYS
                value = json.loads(file.read_text())
                if value.get('schema_version') == 2:
                    value = {key:item for key,item in value.items() if key not in COMPAT_KEYS}
                    value.get('thumbnail', {}).pop('chosen', None)
                    value.get('titles', {}).pop('chosen', None)
                digest.update(json.dumps(value, sort_keys=True, ensure_ascii=False).encode())
            else:
                digest.update(file.read_bytes())
    return digest.hexdigest()

def context_for(video, snapshot):
    values = {}
    for name in ('assets/script.json','assets/lyrics.json','assets/scene.json','assets/config.json','assets/media/CREDITS.md','CREDITS.md'):
        file = video.path / name
        if file.is_file():
            if file.is_symlink() or file.stat().st_size > 600_000:
                raise ValueError(f'Contexto demasiado grande o no permitido: {name}')
            values[name] = file.read_text()
    if not values.get('assets/script.json') and not values.get('assets/lyrics.json'):
        raise ValueError('Falta guion o transcripción para comprender el video')
    media = video.path / 'assets/media'
    return {'video': {'id': video.video_id, 'title': video.title, 'category': video.category_path,
                'design': video.design, 'demo': video.demo, 'narrative_id': video.narrative_id, 'review_requirements': video.review_requirements},
            'files': values, 'existing_publication': read_publish(video.path), 'strategies': snapshot,
            'media': [p.name for p in sorted(media.iterdir()) if p.is_file() and not p.is_symlink()
                      and p.suffix.lower() in {'.jpg','.jpeg','.webp','.png'}] if media.is_dir() else []}

class EditorialPreparationService:
    def __init__(self, generator=None, capture=None):
        self.generator, self.capture = generator, capture

    def latest(self, video_id):
        rows = collection('editorial_preparations').list(where={'video_id': video_id})
        return max(rows, key=lambda row: row['created_at'], default=None)

    def status(self, video_id):
        video = _video(video_id)
        row = self.latest(video_id)
        if row and row['state'] in ACTIVE and not task_is_owned('editorial-preparation', video_id):
            row = {**row, 'state': 'failed', 'error': 'Preparación interrumpida; puedes volver a intentarla'}
        if row and row['state'] == 'ready' and row.get('result_signature') != input_signature(video, readiness=True):
            row = {**row, 'state': 'incomplete', 'issues': ['El contenido cambió después de preparar; vuelve a comprobarlo']}
        return {k: v for k, v in (row or {'video_id': video_id, 'state': 'pending', 'issues': []}).items()
                if k not in {'log_path','strategy_snapshot'}}

    async def submit(self, video_id, regenerate=False):
        video = _video(video_id)
        async with coordination('content-video-' + hashlib.sha256(('editorial:' + video_id).encode()).hexdigest()):
            current = self.latest(video_id)
            if current and current['state'] in ACTIVE and task_is_owned('editorial-preparation', video_id):
                return self.status(video_id)
            resolved = resolve_for_video(video)
            # Check context before creating a job or invoking a paid/model action.
            context_for(video, resolved.snapshot())
            run_id = uuid.uuid4().hex
            log = await register_execution_log(Path('logs')/'explainer'/f'editorial-{run_id}.log', kind='prototype')
            row = {'previous_issues': (current or {}).get('issues', []), 'run_id': run_id, 'video_id': video_id, 'state': 'queued', 'issues': [], 'error': None,
                'created_at': now(), 'updated_at': now(), 'strategy_snapshot': resolved.snapshot(),
                'strategies': resolved.rules.ids(), 'strategy_origins': resolved.origins,
                'strategy_fingerprint': resolved.fingerprint, 'regenerate': regenerate,
                'log_path': str(log.path), 'input_signature': input_signature(video)}
            await collection('editorial_preparations').insert(row)
            manifest = json.loads((video.path / 'manifest.json').read_text())
            manifest.update(status='en preparación', editorial_status='pending')
            _write(video.path / 'manifest.json', manifest)
            start_owned_task('editorial-preparation', video_id, lambda: self._run(row))
        return self.status(video_id)

    async def _update(self, row, **data):
        row.update(data, updated_at=now())
        await collection('editorial_preparations').update(row['run_id'], {**data, 'updated_at': row['updated_at']})

    async def _run(self, row):
        video = _video(row['video_id'])
        async with AsyncFileLock(video.path/'work/editorial/.lock'):
            await self._update(row, state='running')
            try:
                from src.core.explainer import thumbnails
                from src.core.explainer.usage_traces import record_trace
                rules = resolved_from_snapshot(row['strategy_snapshot']).rules
                package = load_package(video.path)
                issues = check_package(package, rules, video.path, video.duration_seconds) if package else []
                must_generate = row['regenerate'] or package is None or any(i.level == 'error' for i in issues)
                if must_generate:
                    if self.generator is None:
                        from src.adapters.explainer.editorial_agent import IsolatedEditorialGenerator
                        generator = IsolatedEditorialGenerator()
                    else: generator = self.generator
                    context = context_for(video, row['strategy_snapshot'])
                    context['previous_validation_issues'] = row.get('previous_issues', [])
                    async def usage(provider, result):
                        await self._update(row, model=result.model or provider, provider=provider)
                        await record_trace({'trace_id': row['run_id'], 'attempt': 1, 'operation': 'editorial_preparation',
                            'status': 'ok' if result.ok else 'failed', 'provider': provider,
                            'model': result.model or provider, 'seconds': result.duration_seconds, **(result.usage or {})},
                            content_key=content_key(video.path), design_id=video.design)
                    proposal = await generator.generate(context, video.path/'work/editorial'/row['run_id'],
                        PublishPackage.model_json_schema(), Path(row['log_path']), usage)
                    package = PublishPackage.model_validate(proposal)
                if package.category != rules.category.id:
                    raise ValueError('El paquete no coincide con la categoría de destino')
                if video.design.startswith('sandbox-') or video.design in {'atlas-en-movimiento','mapas-satelitales','cara-a-cara'}:
                    package = package.model_copy(update={'preserve_opening': True})
                issues = [asdict(i) for i in check_package(package, rules, video.path, video.duration_seconds)]
                if {t.option for t in package.titles.youtube} != {'A','B','C'}:
                    issues.append({'level':'error','field':'titles','message':'Se requieren tres títulos A/B/C'})
                if package.thumbnail.tabloid is None:
                    issues.append({'level':'error','field':'thumbnail','message':'Falta la miniatura C'})
                if input_signature(video) != row['input_signature']:
                    raise ValueError('El contenido cambió durante la preparación; no se sobrescribió')
                if any(i['level'] == 'error' for i in issues):
                    _write(video.path/'work/editorial/proposal.json', package.model_dump(mode='json'))
                    await self._update(row, state='incomplete', issues=issues)
                    return
                # Host validates before writing; the agent cannot write here.
                save_package(video.path, package, rules)
                current = load_video(video.path)
                for orientation in ('16x9','9x16'):
                    rendered = await self.capture(current, orientation) if self.capture else await thumbnails.render(current, orientation=orientation, only_missing=True)
                    if set(rendered) != {'A','B','C'}:
                        raise ValueError('Faltan capturas A/B/C')
                required = ['index.html']
                if video.design.startswith('sandbox-') or video.design == 'atlas-en-movimiento':
                    required += ['assets/scene.json','assets/script.json','assets/lyrics.json','assets/song.mp3']
                missing = [name for name in required if not (video.path / name).is_file()]
                if missing:
                    await self._update(row, state='incomplete', issues=issues + ['Falta ' + name for name in missing])
                    return
                manifest = json.loads((video.path/'manifest.json').read_text())
                manifest.update(status='listo', editorial_status='ready', editorial_run_id=row['run_id'])
                _write(video.path/'manifest.json', manifest)
                _write(video.path/'work/editorial/effective-strategies.json', row['strategy_snapshot'])
                await self._update(row, state='ready', issues=issues, result_signature=input_signature(current, readiness=True))
            except asyncio.CancelledError:
                await self._update(row, state='failed', error='Preparación interrumpida; puedes volver a intentarla')
                raise
            except Exception as exc:
                await self._update(row, state='failed', error=str(exc)[:1500])

    async def recover(self):
        for row in collection('editorial_preparations').list():
            if row['state'] in ACTIVE and not task_is_owned('editorial-preparation', row['video_id']):
                await self._update(row, state='failed', error='Preparación interrumpida al reiniciar; vuelve a intentarla')
