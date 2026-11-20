"""Determine whether showcase examples are shared or belong to this profile."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit

from src.adapters.showcase.filesystem import _read, _safe
from src.core.showcase.ports import ShowcaseInvalid

ATLAS_MEDIA = {
    'callout.photo': ('assets/media/A04.png', 'assets/fonts/AtlasEditorial.ttf'),
    'editorial.press': ('assets/media/P03-soft.png', 'assets/media/A01.png', 'assets/fonts/AtlasEditorial.ttf'),
    'portrait.badge': ('assets/media/P01.png', 'assets/fonts/AtlasEditorial.ttf'),
    'portrait.cutout': ('assets/media/P01-soft.png', 'assets/fonts/AtlasEditorial.ttf'),
    'caption.transcript': ('assets/lyrics.json',),
    'intro.title': ('assets/fonts/AtlasIntroTitle.ttf', 'assets/fonts/AtlasIntroUI.ttf'),
    'outro.channel': ('assets/fonts/AtlasIntroTitle.ttf', 'assets/fonts/AtlasIntroUI.ttf',
                      'assets/media/mapa-mundo-cierre.jpg'),
}

def _owned_file(sandbox: Path, *parts: str) -> bool:
    try:
        return _safe(sandbox, *parts).is_file()
    except (OSError, ShowcaseInvalid):
        return False


def _gallery_index(templates: Path, *parts: str) -> dict[str, dict]:
    payload = _read(_safe(templates, *parts))
    rows = payload.get('components') if isinstance(payload, dict) else None
    if not isinstance(rows, list) or any(not isinstance(row, dict) or not isinstance(row.get('name'), str) for row in rows):
        raise ShowcaseInvalid('Catálogo de vistas previas inválido')
    names = [row['name'] for row in rows]
    if len(names) != len(set(names)):
        raise ShowcaseInvalid('Catálogo de vistas previas duplicado')
    return {row['name']: row for row in rows}


def _character_details(templates: Path) -> dict[str, dict]:
    """Expose reusable identities and media, never profile files or arbitrary URLs."""
    from src.adapters.showcase.legacy_catalogs import _inside, _json

    root = templates / 'nodeactualidad/cara-a-cara'
    payload = _json(root, 'showcase/characters.json')
    rows = payload.get('sprites') if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return {}
    prefix = '/api/v1/explainer/files/bundled/nodeactualidad/cara-a-cara/'

    def media(relative):
        file = _inside(root, relative)
        if file is None or not file.is_file():
            return None
        return prefix + '/'.join(quote(part, safe='') for part in relative.split('/'))

    details = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('name'), str):
            continue
        identity = _json(root, row.get('characterFile'))
        if not isinstance(identity, dict) or not isinstance(identity.get('id'), str):
            continue
        voice = identity.get('voz')
        voice = voice if isinstance(voice, dict) else {}
        sample = media(voice.get('muestra'))
        poses = []
        for pose in row.get('poses', []) if isinstance(row.get('poses'), list) else []:
            if not isinstance(pose, dict) or not isinstance(pose.get('name'), str):
                continue
            file = pose.get('file')
            if not isinstance(file, str) or '/' in file or '\\' in file:
                continue
            url = media('showcase/thumbs/' + file)
            if url:
                poses.append({'name': pose['name'], 'url': url})
        detail = {'identity': identity, 'poses': poses}
        if sample:
            detail['voiceSample'] = {'url': sample, 'text': voice.get('texto', ''),
                                     'source': voice.get('nota_muestra', 'Muestra de ' + row['name'])}
            captions = media(voice.get('subtitulos'))
            if captions:
                detail['voiceSample']['captionsUrl'] = captions
        details[row['name']] = detail
        details['personajes.identidad-' + identity['id']] = detail
    return details


def availability(templates: Path, sandbox: Path, design_id: str, entries: list[dict]) -> list[dict]:
    """Copy catalog entries and hide examples requiring absent profile-owned data."""
    if design_id == 'vida-en-escena':
        source = _gallery_index(templates, 'sandbox', 'nodeaction', '_vida', 'showcase', 'components.json')
    elif design_id == 'cara-a-cara':
        source = _gallery_index(templates, 'nodeactualidad', 'cara-a-cara', 'showcase', 'components.json')
    else:
        source = {}
    characters = _character_details(templates) if design_id == 'cara-a-cara' else {}
    result = []
    for row in entries:
        item = dict(row)
        name = row.get('name')
        if name in characters:
            previous = item.get('data')
            item['data'] = {**(previous if isinstance(previous, dict) else {}), 'character': characters[name]}
        if design_id == 'vida-en-escena' and row.get('preview_url'):
            declaration = source.get(name)
            preview = declaration.get('preview') if isinstance(declaration, dict) else None
            url = preview.get('url') if isinstance(preview, dict) else None
            if not isinstance(url, str):
                item['preview_url'] = None
            elif url.startswith('../vida-en-escena/'):
                parsed = urlsplit(url)
                episode = parse_qs(parsed.query).get('ep', [])
                safe = (parsed.path == '../vida-en-escena/index.html' and len(episode) == 1
                        and episode[0].startswith('assets/') and not any(
                            p in {'', '.', '..'} or p.startswith('.') for p in episode[0].split('/')))
                if (not safe
                        or not _owned_file(sandbox, 'nodeaction', 'vida-en-escena', 'index.html')
                        or not _owned_file(sandbox, 'nodeaction', 'vida-en-escena', *episode[0].split('/'))):
                    item['preview_url'] = None
            elif urlsplit(url).path != 'studio.html':
                item['preview_url'] = None
        elif design_id == 'atlas-en-movimiento' and name in ATLAS_MEDIA:
            production = sandbox.parent / 'productions' / 'nodeatlas' / 'atlas-en-movimiento'
            if production.is_dir() and not production.is_symlink():
                available = all(_owned_file(production, *path.split('/')) for path in ATLAS_MEDIA[name])
            else:
                available = all(_owned_file(sandbox, 'nodehistory', 'atlas-en-movimiento', *path.split('/'))
                                for path in ATLAS_MEDIA[name])
            if not available:
                item['preview_url'] = None
        elif design_id == 'cara-a-cara':
            declaration = source.get(name)
            preview = declaration.get('preview') if isinstance(declaration, dict) else None
            guide = isinstance(preview, dict) and preview.get('kind') == 'guide'
            if guide:
                item['preview_kind'] = 'iframe'
                item['preview_url'] = ('/api/v1/explainer/files/bundled/nodeactualidad/cara-a-cara/'
                                       'showcase.html?only=personajes.crear-personaje&aspect=9x16')
            elif row.get('preview_url'):
                if row.get('preview_kind') == 'image':
                    prefix = '/api/v1/explainer/files/bundled/nodeactualidad/cara-a-cara/'
                    path = urlsplit(row['preview_url']).path
                    parts = ['nodeactualidad', 'cara-a-cara', *path[len(prefix):].split('/')] if path.startswith(prefix) else []
                    if not parts or not _owned_file(templates, *parts):
                        item['preview_url'] = None
                else:
                    root = ('nodeactualidad', 'cara-a-cara')
                    files = [('showcase.html',), ('showcase.js',), ('showcase-preview.html',),
                             ('showcase', 'components.json'), ('assets', 'scene.json')]
                    if (not all(_owned_file(templates, *root, *file) for file in files)
                            or not (_owned_file(templates, *root, 'config.json')
                                    or _owned_file(templates, *root, 'assets', 'config.json'))):
                        item['preview_url'] = None
        result.append(item)
    return result


def is_cara_guide(templates: Path, name: str) -> bool:
    source = _gallery_index(templates, 'nodeactualidad', 'cara-a-cara', 'showcase', 'components.json')
    preview = source.get(name, {}).get('preview')
    return isinstance(preview, dict) and preview.get('kind') == 'guide'
