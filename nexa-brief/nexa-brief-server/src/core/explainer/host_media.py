"""Bounded image broker: host searches and the isolated agent selects local candidates."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import tempfile
import uuid
from pathlib import Path


from src.adapters.stock.safe_image_download import (
    MAX_IMAGE, allowed as _allowed, download as _download, public_url as _public_url, to_jpeg as _jpeg,
)
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.explainer.agent_context import _safe
from src.core.image_posts.image_licensing import accepted_license
from src.core.stock.service import get_stock_providers, search_stock

MAX_REQUESTS = 16
MAX_TOTAL = 80 * 1024 * 1024
MAX_JSON = 128 * 1024
_ID = re.compile(r'^[a-z0-9][a-z0-9_-]{0,47}$')


class MediaBrokerError(ValueError):
    """A media request cannot be fulfilled safely or needs correction."""


def _read(path: Path, limit=MAX_JSON) -> bytes:
    import stat
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid():
            raise MediaBrokerError('Archivo de medios no seguro')
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise MediaBrokerError('Archivo de medios excede el límite')
    return data


def _write(path: Path, data: bytes) -> None:
    fd, temporary = tempfile.mkstemp(prefix='.media-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _write_json(path: Path, value: dict) -> None:
    _write(path, (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode())


def _clean(value: str, limit: int = 200) -> str:
    return ' '.join(str(value or '').replace('—', '-').split())[:limit]


def _valid_license(value: str) -> bool:
    return value.strip().casefold() in {'pexels license', 'pixabay content license', 'pixabay license', 'unsplash license'} or accepted_license(value)


def _requests(video: Path) -> tuple[dict, str]:
    try:
        path = _safe(video, 'work', 'media-requests.json')
        raw = _read(path)
        data = json.loads(raw)
        script = json.loads(_read(_safe(video, 'assets', 'script.json')))
        rows = data.get('requests') if isinstance(data, dict) and data.get('version') == 1 else None
        segments = script.get('segments') if isinstance(script, dict) else None
        if not isinstance(rows, list) or len(rows) > MAX_REQUESTS or not isinstance(segments, list):
            raise ValueError
        seen = set()
        for row in rows:
            if not isinstance(row, dict) or set(row) != {'id', 'anchor', 'shows', 'queries'}:
                raise ValueError
            ident, anchor, shows, queries = (row[k] for k in ('id', 'anchor', 'shows', 'queries'))
            if (not isinstance(ident, str) or not _ID.fullmatch(ident) or ident in seen
                    or not isinstance(anchor, str) or not 5 <= len(anchor.strip()) <= 200
                    or not isinstance(shows, str) or not 5 <= len(shows.strip()) <= 200
                    or not isinstance(queries, list) or not 1 <= len(queries) <= 2
                    or any(not isinstance(q, str) or not 3 <= len(q.strip()) <= 120
                           or re.search(r'(?i)https?://', q) for q in queries)
                    or not any(isinstance(s, dict) and anchor in str(s.get('text', '')) for s in segments)):
                raise ValueError
            seen.add(ident)
        return data, hashlib.sha256(raw).hexdigest()
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise MediaBrokerError('Solicitud de imágenes ausente o inválida; corrige work/media-requests.json y retoma') from exc


def _existing_media(video: Path, parts: list[str]) -> bool:
    import stat

    try:
        if not parts or Path(parts[-1]).suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm'}:
            return False
        path = _safe(video, 'assets', 'media', *parts)
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(fd)
            return stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid == os.getuid() and info.st_size > 0
        finally:
            os.close(fd)
    except (OSError, ValueError):
        return False


def _has_legacy_referenced_media(video: Path) -> bool:
    """Only inspect this video's storyboard/manifest and its referenced media."""
    for source in (('assets', 'storyboard.json'), ('manifest.json',)):
        try:
            root = json.loads(_read(_safe(video, *source)))
        except (OSError, ValueError, RecursionError):
            continue
        pending = [root]
        visited = 0
        while pending and visited < 30000:
            item = pending.pop()
            visited += 1
            if isinstance(item, dict):
                pending.extend(item.values())
            elif isinstance(item, list):
                pending.extend(item)
            elif isinstance(item, str) and item.startswith('assets/media/'):
                parts = item.removeprefix('assets/media/').split('/')
                if _existing_media(video, parts):
                    return True
    return False


def initialize_legacy_requests(video: Path, uploaded: list[str], *, allow_existing_references: bool = False) -> None:
    """Initialize only for authorized uploads or referenced legacy media on resume."""
    try:
        target = _safe(video, 'work', 'media-requests.json')
        if target.exists():
            return
        if not isinstance(uploaded, list):
            raise ValueError
        if uploaded:
            if any(not isinstance(name, str) or not _existing_media(video, [name]) for name in uploaded):
                raise ValueError
        elif not allow_existing_references or not _has_legacy_referenced_media(video):
            return
        _write_json(target, {'version': 1, 'requests': []})
    except (OSError, ValueError) as exc:
        raise MediaBrokerError('Los medios subidos no están disponibles de forma segura; revísalos y retoma') from exc


def _runtime(video_id: str) -> Path:
    if not _ID.fullmatch(video_id):
        raise MediaBrokerError('ID de producción inválido')
    runtime = layout_for_settings(settings).runtime_dir
    directory = _safe(runtime, 'host-media')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    return _safe(directory, video_id + '.json')


async def prepare(video: Path, production_id: str) -> dict:
    """Search and prepare candidates; no model-provided URL is fetched."""
    request, digest = _requests(video)
    state_path = _runtime(production_id)
    try:
        state = json.loads(_read(state_path)) if state_path.exists() else None
    except (OSError, ValueError):
        raise MediaBrokerError('Estado de medios inválido; requiere revisión')
    if state and state.get('request_hash') == digest:
        if request['requests'] and not state.get('candidates') and not state.get('applied'):
            state_path.unlink()
            state = None
    if state and state.get('request_hash') == digest:
        try:
            for candidate in state.get('candidates', []):
                path = _safe(video, 'work', 'agent-context', 'media-candidates', candidate['id'] + '.jpg')
                if hashlib.sha256(_read(path, MAX_IMAGE)).hexdigest() != candidate['sha256']:
                    raise ValueError
        except (OSError, ValueError, TypeError, KeyError) as exc:
            raise MediaBrokerError('Candidata de imagen modificada; requiere revisión') from exc
        _publish_candidates(video, state)
        state['request_count'] = len(request['requests'])
        return state
    if state and state.get('applied'):
        raise MediaBrokerError('La solicitud de medios cambió después de importar; requiere revisión')
    directory = _safe(video, 'work', 'agent-context', 'media-candidates')
    directory.mkdir(parents=True, exist_ok=True)
    candidates, failures, seen, total = [], [], set(), 0
    providers = get_stock_providers() if request['requests'] else {}
    for row in request['requests']:
        items = []
        for query in row['queries']:
            try:
                result = await asyncio.wait_for(search_stock(query, 'image', per_page=4), timeout=25)
                items.extend(result.results)
                failures.extend(f'{_clean(issue.provider, 40)}: {_clean(issue.code, 40)}' for issue in result.provider_errors)
            except (asyncio.TimeoutError, OSError):
                failures.append('búsqueda no disponible')
        count = 0
        for item in items:
            key = (item.provider, item.provider_id)
            provider = providers.get(item.provider)
            source = _public_url(item.source_url)
            if (key in seen or not provider or item.kind != 'image' or not source or not item.author
                    or not _valid_license(item.license) or not _allowed(provider, item.download_url)):
                continue
            try:
                data = await _download(provider, item.download_url)
                image = await asyncio.to_thread(_jpeg, data)
            except (OSError, ValueError):
                failures.append(f'{_clean(item.provider, 40)}: descarga no disponible')
                continue
            total += len(image)
            if total > MAX_TOTAL:
                failures.append('límite total de imágenes alcanzado')
                break
            ident = uuid.uuid4().hex
            _write(_safe(directory, ident + '.jpg'), image)
            candidates.append({'id': ident, 'request_id': row['id'], 'anchor': row['anchor'], 'shows': row['shows'],
                               'title': _clean(item.title), 'author': _clean(item.author),
                               'license': _clean(item.license), 'source_url': source,
                               'sha256': hashlib.sha256(image).hexdigest()})
            seen.add(key)
            count += 1
            if count == 2:
                break
    state = {'version': 1, 'request_hash': digest, 'request_count': len(request['requests']), 'candidates': candidates,
             'failures': list(dict.fromkeys(failures))[:20], 'applied': False}
    _write_json(state_path, state)
    _publish_candidates(video, state)
    return state


def _publish_candidates(video: Path, state: dict) -> None:
    public = []
    for row in state['candidates']:
        public.append({**{key: row[key] for key in ('id', 'request_id', 'anchor', 'shows', 'title', 'author', 'license', 'source_url')},
                       'file': f"work/agent-context/media-candidates/{row['id']}.jpg"})
    _write_json(_safe(video, 'work', 'agent-context', 'media-candidates.json'),
                {'version': 1, 'candidates': public, 'failures': state['failures']})


def apply_selection(video: Path, production_id: str, state: dict, *, require_nonempty: bool = False) -> None:
    """Import only explicitly selected, unchanged candidates and preserve credits."""
    _, digest = _requests(video)
    if digest != state.get('request_hash'):
        raise MediaBrokerError('La solicitud de imágenes cambió; retoma la búsqueda')
    if state.get('applied'):
        try:
            candidates = {row['id']: row for row in state['candidates']}
            for item in state.get('imported', []):
                ident = item.get('candidate_id')
                candidate = candidates.get(ident)
                path = _safe(video, 'assets', 'media', 'stock-' + str(ident) + '.jpg')
                if not candidate or hashlib.sha256(_read(path, MAX_IMAGE)).hexdigest() != candidate['sha256']:
                    raise ValueError
        except (OSError, ValueError, TypeError, KeyError) as exc:
            raise MediaBrokerError('Imagen importada modificada; requiere revisión') from exc
        _write_json(_safe(video, 'work', 'agent-context', 'media-imported.json'),
                    {'version': 1, 'imported': state.get('imported', [])})
        return
    try:
        selected = json.loads(_read(_safe(video, 'work', 'media-selection.json')))
        rows = selected.get('selections') if isinstance(selected, dict) and selected.get('version') == 1 else None
        if not isinstance(rows, list) or len(rows) > MAX_REQUESTS or (require_nonempty and not rows):
            raise ValueError
        candidates = {row['id']: row for row in state['candidates']}
        seen = set()
        planned = []
        for row in rows:
            if not isinstance(row, dict) or set(row) != {'request_id', 'candidate_id', 'depiction'}:
                raise ValueError
            candidate = candidates.get(row['candidate_id'])
            if (not candidate or row['request_id'] != candidate['request_id'] or row['request_id'] in seen
                    or not isinstance(row['depiction'], str) or not 8 <= len(row['depiction'].strip()) <= 300):
                raise ValueError
            seen.add(row['request_id'])
            data = _read(_safe(video, 'work', 'agent-context', 'media-candidates', candidate['id'] + '.jpg'), MAX_IMAGE)
            if hashlib.sha256(data).hexdigest() != candidate['sha256']:
                raise ValueError
            planned.append((candidate, data, _clean(row['depiction'], 300)))
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise MediaBrokerError('Selección de imágenes inválida; corrige work/media-selection.json y retoma') from exc
    media = _safe(video, 'assets', 'media')
    media.mkdir(parents=True, exist_ok=True)
    credits = _safe(media, 'CREDITS.md')
    previous = _read(credits).decode('utf-8') if credits.exists() else '# Créditos de medios\n'
    lines = previous.splitlines()
    imported = []
    for candidate, data, depiction in planned:
        filename = 'stock-' + candidate['id'] + '.jpg'
        target = _safe(media, filename)
        if target.exists():
            if hashlib.sha256(_read(target, MAX_IMAGE)).hexdigest() != candidate['sha256']:
                raise MediaBrokerError('Colisión de archivo de imagen; requiere revisión')
        else:
            _write(target, data)
        credit = f"{filename} — {candidate['title']} — {candidate['author']} — {candidate['license']} — {candidate['source_url']}"
        if credit not in lines:
            lines.append(credit)
        imported.append({'request_id': candidate['request_id'], 'candidate_id': candidate['id'], 'file': 'assets/media/' + filename,
                         'anchor': candidate['anchor'], 'shows': candidate['shows'], 'depiction': depiction})
    _write(credits, ('\n'.join(lines) + '\n').encode())
    state = {**state, 'applied': True, 'imported': imported}
    _write_json(_runtime(production_id), state)
    _write_json(_safe(video, 'work', 'agent-context', 'media-imported.json'), {'version': 1, 'imported': imported})
