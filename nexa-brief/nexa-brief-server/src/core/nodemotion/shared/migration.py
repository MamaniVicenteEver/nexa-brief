"""Conservative migration of registered legacy NodeMotion drafts.

No source files are removed: the report identifies retained files for a separate
reference audit. Run only while the selected profile is quiescent.
"""
from __future__ import annotations

import json
import hashlib
import re
from html.parser import HTMLParser
import html as html_entities
import os
import sys
import tempfile
from urllib.parse import unquote, unquote_to_bytes, urlsplit
from pathlib import Path, PurePosixPath
from typing import Any

import structlog

from src.core.data import collection, documents
from src.core.library import asset_library
from src.core.nodemotion.shared.resources import digest, with_library_resolution_snapshot
from src.templates._tools.nodemotion.shared.assemble import (
    archive_engine, assemble, design_ids, design_manifest, registered, runtime_assets,
)

_MEDIA = {'.mp3': 'music', '.wav': 'music', '.m4a': 'music', '.ogg': 'music',
          '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image',
          '.gif': 'image', '.mp4': 'video', '.webm': 'video', '.mov': 'video'}
_CODE = {'.js', '.css', '.html', '.woff', '.woff2', '.ttf', '.otf', '.svg'}
_SKIP = {'logs', 'work', 'thumbnails', 'results', 'renders', 'render', 'output'}


def _contained(root: Path, path: Path) -> bool:
    return not path.is_symlink() and path.resolve().is_relative_to(root.resolve())


def _tree(root: Path):
    # Never follow symlinks, including a symlinked parent directory.
    for directory, dirs, files in os.walk(root, followlinks=False):
        base = Path(directory)
        dirs[:] = [d for d in dirs if d not in _SKIP]
        for name in dirs:
            if (base / name).is_symlink():
                raise ValueError(f'Symlink in project: {(base / name).relative_to(root)}')
        for name in files:
            path = base / name
            if path.is_symlink():
                raise ValueError(f'Symlink in project: {path.relative_to(root)}')
            yield path


def _publish_new(path: Path, body: bytes) -> None:
    """Publish a new file atomically without overwriting a concurrent writer."""
    fd, name = tempfile.mkstemp(prefix=f'.{path.name}.migration-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        os.link(name, path, follow_symlinks=False)
    finally:
        Path(name).unlink(missing_ok=True)


def _html_and_prefix(raw: bytes, root: Path) -> tuple[bytes, str]:
    # Older prepared promos include the exact base added by resolve_project.
    marker = b'<base href="assets/">'
    if marker in raw:
        if raw.count(marker) != 1 or not (root / 'assets').is_dir():
            raise ValueError('Ambiguous HTML base')
        pattern = rb'(<head\b[^>]*>)' + re.escape(marker)
        stripped, count = re.subn(pattern, rb'\1', raw, count=1, flags=re.I)
        if count != 1:
            raise ValueError('Unsupported HTML base placement')
        return stripped, 'assets'
    if re.search(rb'<base\b', raw, flags=re.I):
        raise ValueError('Unsupported HTML base')
    return raw, ''


def _safe_demo_url(root: Path, value: Any, expected: set[str]) -> str:
    if not isinstance(value, str) or not value or '\\' in value or '\x00' in value:
        raise ValueError('Invalid demo resource URL')
    parts = urlsplit(value)
    if parts.scheme or parts.netloc or parts.query or parts.fragment:
        raise ValueError('Demo resource must be a local path')
    relative = unquote(parts.path)
    path = PurePosixPath(relative)
    if '\\' in relative or '\x00' in relative or path.is_absolute() or any(part in {'', '.', '..'} for part in relative.split('/')):
        raise ValueError('Invalid demo resource URL')
    target = root / relative
    if target.suffix.lower() not in expected or not target.is_file():
        raise ValueError(f'Missing demo resource: {relative}')
    for parent in (target, *target.parents):
        if parent.is_symlink():
            raise ValueError('Symlink in demo resource')
        if parent == root:
            break
    if not _contained(root, target):
        raise ValueError('Demo resource escapes its project')
    return relative


def _demo_data_urls(root: Path, design: str, *, identity_evidence: str = '') -> dict[str, str]:
    """Read explicit demo identity and the active configured original URLs."""
    publish = root / 'publish.json'
    if publish.is_symlink():
        raise ValueError('Invalid demo identity path')
    if publish.is_file():
        metadata = json.loads(publish.read_bytes())
        if not isinstance(metadata, dict) or metadata.get('template_id') != design:
            raise ValueError('Demo publish identity does not match its design')
    else:
        html, _ = _html_and_prefix((root / 'index.html').read_bytes(), root)
        actual = hashlib.sha256(html).hexdigest()
        manifest = design_manifest(design)
        if (identity_evidence != 'exact-engine-html' or actual != manifest.get('source_sha256')
                or actual != hashlib.sha256(assemble(design)).hexdigest()):
            raise ValueError('Demo requires an explicit or exact engine identity')
    if (root / 'config.json').exists() or (root / 'config.json').is_symlink():
        raise ValueError('Ambiguous root demo configuration')
    config = _safe_demo_url(root, 'assets/config.json', {'.json'})
    data = json.loads((root / config).read_bytes())
    if not isinstance(data, dict) or not isinstance(data.get('configs'), list):
        raise ValueError('Invalid demo configuration')
    active = [item for item in data['configs'] if isinstance(item, dict) and item.get('id') == data.get('activeId')]
    if len(active) != 1 or not isinstance(active[0].get('audio'), dict):
        raise ValueError('Ambiguous active demo configuration')
    audio = _safe_demo_url(root, active[0]['audio'].get('src'), {'.mp3', '.wav', '.m4a', '.ogg'})
    timing = _safe_demo_url(root, active[0].get('lyricsUrl') or 'assets/lyrics.json', {'.json'})
    if len({config, timing, audio}) != 3:
        raise ValueError('Conflicting demo resource URLs')
    result = {'config': config, 'timing': timing, 'audio': audio}
    background = active[0].get('bg') or active[0].get('background')
    if isinstance(background, dict) and background.get('src'):
        result['background'] = _safe_demo_url(root, background['src'], {
            extension for extension, kind in _MEDIA.items() if kind in {'image', 'video'}})
        if result['background'] in {config, timing, audio}:
            raise ValueError('Conflicting demo background URL')
    return result


def _inventory(root: Path, *, exclude: set[Path] | None = None,
               data_urls: dict[str, str] | None = None) -> tuple[bytes, str, dict[str, Path], dict[str, Path]]:
    html_path = root / 'index.html'
    if not html_path.is_file() or not _contained(root, html_path):
        raise ValueError('Missing safe index.html')
    html, prefix = _html_and_prefix(html_path.read_bytes(), root)
    if data_urls and prefix:
        raise ValueError('Demo URL migration requires its original unbased HTML')
    content = root if data_urls else root / prefix
    if content.is_symlink() or not content.resolve().is_relative_to(root.resolve()):
        raise ValueError('Unsafe content directory')
    code: dict[str, Path] = {}
    media: dict[str, Path] = {}
    for path in _tree(content):
        relative = path.relative_to(content).as_posix()
        if (data_urls or not prefix) and relative == 'index.html':
            continue
        ext = path.suffix.lower()
        if ext in _CODE:
            code[relative] = path
        elif ext in _MEDIA:
            # Named render outputs and explicit artifact paths stay in place.
            outputs = {'video.mp4', 'youtube_video.mp4', 'youtube_video-ig.mp4', 'tiktok_video.mp4',
                       'reels_video.mp4', 'thumbnail.jpg', 'thumbnail.png', 'thumbnail.webp'}
            if relative not in outputs and path.resolve() not in (exclude or set()):
                media[relative] = path
    for name in (tuple(data_urls.values()) if data_urls else ('song.mp3', 'config.json', 'lyrics.json')):
        path = content / name
        if not path.is_file() or not _contained(root, path):
            raise ValueError(f'Missing safe {prefix}/{name}')
    return html, 'assets' if data_urls else prefix, code, media


def _unsupported_runtime(content: Path, html: bytes, code: dict[str, Path], *,
                         data_urls: dict[str, str] | None = None) -> list[str]:
    """Fail closed when a local runtime dependency is not representable."""
    config = (content / (data_urls['config'] if data_urls else 'config.json')).read_bytes()
    text = b'\n'.join([html, config, *(path.read_bytes() for path in code.values()
                                   if path.suffix.lower() in {'.html', '.css', '.js', '.svg'})])
    normalized = html_entities.unescape(unquote_to_bytes(text).decode('utf-8', errors='replace')).encode('utf-8')
    public_data = {'config.json', 'lyrics.json', 'timeline.json', 'project.json'}
    if data_urls:
        public_data.update({data_urls['config'], data_urls['timing'], 'assets/timeline.json'})
    return sorted(relative for path in _tree(content)
                  if path.suffix.lower() not in _CODE | _MEDIA.keys()
                  and (relative := path.relative_to(content).as_posix()) not in public_data
                  and relative.encode('utf-8') in normalized)


def _library_index() -> dict[tuple[str, str], str]:
    from src.config.exceptions import AssetNotFoundError
    from src.config.settings import settings
    durable_root = Path(settings.storage_profile_dir) / 'resources'
    result = {}
    for kind, list_fn in (
        ('music', asset_library.list_music),
        ('image', asset_library.list_images),
        ('video', asset_library.list_videos),
    ):
        for entry in list_fn():
            try:
                path = asset_library.resolve_asset_entry_path(kind, entry, from_collection=True)
                if _contained(durable_root, path):
                    result.setdefault((kind, digest(path)), entry.asset_id)
            except (AssetNotFoundError, FileNotFoundError, OSError, ValueError):
                continue
    return result


async def _register(kind: str, path: Path, sha: str, job_id: str) -> str:
    register = {'music': asset_library.register_music, 'image': asset_library.register_image,
                'video': asset_library.register_video}[kind]
    kwargs = dict(category='nodemotion', source='migration', provider='local', job_id=job_id,
                  filename=f'{sha}{path.suffix.lower()}')
    if kind == 'music':
        kwargs['content_hash'] = sha
    entry = await register(path, **kwargs)
    resolver = {'music': asset_library.resolve_music_path, 'image': asset_library.resolve_image_path,
                'video': asset_library.resolve_video_path}[kind]
    if digest(Path(resolver(entry.asset_id))) != sha:
        raise ValueError('Registered asset did not preserve its bytes')
    return entry.asset_id


@with_library_resolution_snapshot
def _verify_resolved(root: Path, prefix: str, expected_html: bytes, code: dict[str, Path],
                     media: dict[str, Path], lyrics: dict[str, Any], lyrics_bytes: bytes, *,
                     data_urls: dict[str, str] | None = None, config_bytes: bytes | None = None,
                     extra_files: dict[str, bytes] | None = None) -> None:
    from src.core.nodemotion.shared.execution import resolve_project
    def resolved(name: str):
        return resolve_project(root, name if data_urls else (f'{prefix}/{name}' if prefix else name))
    if resolve_project(root, 'index.html') != expected_html:
        raise ValueError('HTML differs after assembly')
    for relative, source in {**code, **media}.items():
        value = resolved(relative)
        if not isinstance(value, Path) or digest(value) != digest(source):
            raise ValueError(f'Resolved bytes differ: {relative}')
    if data_urls:
        config = resolved(data_urls['config'])
        config_data = config.read_bytes() if isinstance(config, Path) else config
        if config_data != config_bytes:
            raise ValueError('Resolved configuration bytes differ')
    for name, expected in (extra_files or {}).items():
        value = resolved(name)
        actual = value.read_bytes() if isinstance(value, Path) else value
        if actual != expected:
            raise ValueError(f'Resolved extra data differs: {name}')
    value = resolved(data_urls['timing'] if data_urls else 'lyrics.json')
    data = value.read_bytes() if isinstance(value, Path) else value
    if data != lyrics_bytes or json.loads(data) != lyrics:
        raise ValueError('Resolved timeline bytes differ')


class _DesignMeta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag, attrs):
        if tag.lower() != 'meta':
            return
        values = dict(attrs)
        if (values.get('name') or '').lower() in {'nodemotion-design', 'design-id'}:
            self.ids.add(values.get('content', ''))


def _orphan_identity(root: Path, known_hashes: dict[str, list[str]], job: dict | None = None) -> tuple[str | None, str]:
    """Identify only from saved explicit metadata, code constants or exact engine bytes."""
    identities: set[str] = set()
    for name in ('manifest.json', 'info.json', 'publish.json', 'project.json'):
        file = root / name
        if not file.is_file() or file.is_symlink():
            continue
        try:
            data = json.loads(file.read_bytes())
        except (ValueError, OSError):
            return None, f'Invalid {name}'
        if not isinstance(data, dict):
            return None, f'Invalid {name}'
        if name == 'project.json' and data.get('kind') != 'nodemotion':
            continue
        for metadata in (data, data.get('info')):
            if isinstance(metadata, dict):
                for key in ('template_id', 'design_id'):
                    value = metadata.get(key)
                    if isinstance(value, str) and value.startswith(('lyrics-', 'promo-')):
                        identities.add(value)
    if isinstance(job, dict) and isinstance(job.get('input'), dict):
        for key in ('template_id', 'design_id'):
            value = job['input'].get(key)
            if isinstance(value, str) and value.startswith(('lyrics-', 'promo-')):
                identities.add(value)
    html_path = root / 'index.html'
    html = None
    if html_path.is_file() and not html_path.is_symlink():
        raw = html_path.read_bytes()
        parser = _DesignMeta()
        parser.feed(raw.decode('utf-8', errors='replace'))
        identities.update(value for value in parser.ids if value.startswith(('lyrics-', 'promo-')))
        identities.update(match.decode('ascii') for match in re.findall(
            rb"\b(?:const|let|var)\s+NAME\s*=\s*['\"]((?:lyrics|promo)-[a-z0-9-]+)['\"]", raw))
        if not identities:
            try:
                html, _ = _html_and_prefix(raw, root)
            except ValueError:
                return None, 'Unsupported HTML base'
    if identities:
        if len(identities) != 1 or not registered(next(iter(identities))):
            return None, 'Conflicting or unregistered explicit design identity'
        return next(iter(identities)), 'explicit-metadata'
    if html is not None:
        matches = known_hashes.get(hashlib.sha256(html).hexdigest(), [])
        if len(matches) == 1:
            return matches[0], 'exact-engine-html'
        if len(matches) > 1:
            return None, 'Ambiguous matching engine HTML'
    return None, 'No explicit or exact matching design identity'


def _log_progress(index: int, total: int, design: str, status: str) -> None:
    """Emit bounded metadata to stderr while keeping the final JSON on stdout."""
    safe_design = design if re.fullmatch(r"(?:lyrics|promo)-[a-z0-9-]+", design) else "unknown"
    safe_status = status if status in {"planned", "migrated", "already-migrated", "needs-review"} else "unknown"
    try:
        logger = structlog.wrap_logger(structlog.PrintLogger(file=sys.stderr),
                                       processors=[structlog.processors.JSONRenderer()])
        logger.info("nodemotion_migration_project", index=index, total=total,
                    design_id=safe_design, status=safe_status)
    except (OSError, ValueError):
        # Diagnostic output must never interrupt a partially completed migration.
        pass


async def migrate(profile: Path, *, apply: bool = False, retire_verified: bool = False) -> dict[str, Any]:
    """Inspect or migrate drafts in the already selected profile; no deletions."""
    from src.config.settings import settings
    if Path(settings.storage_profile_dir or '').resolve() != profile.resolve():
        raise ValueError('Selected profile differs from --profile')
    if settings.storage_layout_version != 3:
        raise ValueError('Only profile schema v3 is supported')
    profile = profile.resolve(strict=True)
    production = profile / 'productions' / 'nodemotion'
    report: dict[str, Any] = {'profile': str(profile), 'mode': 'apply' if apply else 'dry-run',
                              'projects': [], 'retirement_requested': retire_verified}
    rows = collection('drafts').list()
    job_rows = collection('jobs').list()
    # DocumentStore has no enumeration API; v3 sections expose orphan IDs.
    from src.adapters.data.section_store import Section
    all_jobs = Section('videos').read().get('documents', {}).get('draft_jobs', {})
    draft_ids = {row.get('draft_id') for row in rows}
    draft_roots = set()
    orphan_jobs: dict[str, list[dict]] = {}
    for identifier, job in all_jobs.items():
        if not isinstance(job, dict):
            continue
        output = (job.get('artifacts') or {}).get('output_dir')
        if not isinstance(output, str) or not Path(output).is_absolute():
            continue
        key = str(Path(output).resolve())
        if identifier in draft_ids:
            draft_roots.add(key)
        else:
            orphan_jobs.setdefault(key, []).append(job)
    known_hashes: dict[str, list[str]] = {}
    for design_id in design_ids():
        known_hashes.setdefault(hashlib.sha256(assemble(design_id)).hexdigest(), []).append(design_id)
    # Discover additional explicit/exact registered projects without creating
    # synthetic draft or job records in the DataStore.
    if production.is_dir():
        for directory, dirs, files in os.walk(production, followlinks=False):
            root = Path(directory)
            dirs[:] = [name for name in dirs if name not in _SKIP and not (root / name).is_symlink()]
            relative = root.relative_to(production)
            if relative.parts and relative.parts[0] in {'image', 'video'}:
                dirs[:] = []
                continue
            if not relative.parts or relative.parts in {('commercial',), ('lyrics',)}:
                continue  # Category navigation, not a project.
            if not {'index.html', 'project.json'}.intersection(files) or str(root.resolve()) in draft_roots:
                continue
            matching_jobs = orphan_jobs.get(str(root.resolve()), [])
            if len(matching_jobs) > 1:
                report['projects'].append({'root': str(root), 'status': 'needs-review',
                                           'reason': 'Multiple orphan jobs share the output directory'})
                continue
            job = matching_jobs[0] if matching_jobs else None
            design, evidence = _orphan_identity(root, known_hashes, job)
            if design is None:
                report['projects'].append({'root': str(root), 'status': 'needs-review', 'reason': evidence})
                continue
            rows.append({'template_id': design, '_orphan_root': str(root),
                         '_orphan_job': job or {'artifacts': {'output_dir': str(root)}},
                         '_identity_evidence': evidence})
    sandbox = profile / 'sandbox' / 'nodemotion'
    if sandbox.is_dir():
        for candidate in sorted(sandbox.iterdir()):
            if candidate.is_dir() and (candidate / 'index.html').is_file():
                report['projects'].append({'root': str(candidate), 'status': 'needs-review',
                                           'reason': 'Sandbox prototype requires registered design reconciliation'})
    index = _library_index()
    seen: set[Path] = set()
    missing_assets: dict[tuple[str, str], int] = {}
    candidates = [row for row in rows if isinstance(row.get('template_id'), str)
                  and row['template_id'].startswith(('lyrics-', 'promo-'))]
    for position, row in enumerate(candidates, 1):
        design = row['template_id']
        orphan = '_orphan_root' in row
        migration_id = row.get('draft_id') or ''
        result: dict[str, Any] = {'design_id': design}
        if orphan:
            result.update(source='orphan', identity_evidence=row['_identity_evidence'])
        else:
            result['draft_id'] = migration_id
        report['projects'].append(result)
        try:
            if not registered(design):
                raise ValueError('Design is not registered')
            job = row['_orphan_job'] if orphan else documents('draft_jobs').get(migration_id)
            if not isinstance(job, dict):
                raise ValueError('Missing draft job')
            artifacts = job.get('artifacts') or {}
            excluded_outputs = set()
            for key in ('youtube_video_path', 'tiktok_video_path', 'reels_video_path', 'thumbnail_path'):
                value = artifacts.get(key)
                if isinstance(value, str) and Path(value).is_absolute():
                    excluded_outputs.add(Path(value).resolve())
            path = artifacts.get('output_dir')
            if not isinstance(path, str) or not Path(path).is_absolute():
                raise ValueError('Missing absolute output directory')
            root = Path(path)
            if not root.is_dir() or not _contained(production, root) or root.resolve() == production.resolve():
                raise ValueError('Output directory is missing or outside NodeMotion productions')
            root = root.resolve()
            for registered_job in job_rows:
                if registered_job.get('output_dir') == str(root):
                    for value in (registered_job.get('file_paths') or {}).values():
                        if isinstance(value, str) and Path(value).is_absolute():
                            excluded_outputs.add(Path(value).resolve())
            result['root'] = str(root)
            if root in seen:
                raise ValueError('Output directory is shared by multiple drafts')
            seen.add(root)
            if (root / 'project.json').exists():
                from src.core.nodemotion.shared.execution import load_project
                existing = load_project(root)
                if not existing or existing['design_id'] != design:
                    raise ValueError('Conflicting existing project')
                result['status'] = 'already-migrated'
                if retire_verified:
                    from src.core.nodemotion.shared.retirement import journal_path, resume_retirement, retire_project
                    if journal_path(profile, root).is_file():
                        result['retirement'] = resume_retirement(profile, root, apply=apply)
                    else:
                        _, _, code, media = _inventory(root, exclude=excluded_outputs,
                                                       data_urls=existing.get('data_urls'))
                        result['retirement'] = retire_project(profile, root, draft_id=migration_id,
                                                              code=code, media=media, apply=apply)
                continue
            if (root / 'appearance.json').exists():
                raise ValueError('Existing appearance override requires review')
            is_demo = orphan and root.parent in {production / 'lyrics', production / 'commercial'}
            data_urls = _demo_data_urls(root, design, identity_evidence=row['_identity_evidence']) if is_demo else None
            html, prefix, code, media = _inventory(root, exclude=excluded_outputs, data_urls=data_urls)
            content = root / prefix
            inventory_root = root if data_urls else content
            unsupported = _unsupported_runtime(inventory_root, html, code, data_urls=data_urls)
            extra_files: dict[str, bytes] = {}
            if data_urls:
                for name in list(unsupported):
                    if name.startswith('assets/') and name.lower().endswith('.json'):
                        safe = _safe_demo_url(root, name, {'.json'})
                        body = (root / safe).read_bytes()
                        json.loads(body)
                        extra_files[safe] = body
                        unsupported.remove(name)
            if unsupported:
                result['unsupported_runtime'] = unsupported
                raise ValueError('Unrepresentable local runtime dependency')
            raw_html = (root / 'index.html').read_bytes()
            config_path = root / data_urls['config'] if data_urls else content / 'config.json'
            lyrics_path = root / data_urls['timing'] if data_urls else content / 'lyrics.json'
            config_bytes = config_path.read_bytes()
            lyrics_bytes = lyrics_path.read_bytes()
            lyrics = json.loads(lyrics_bytes)
            if not isinstance(lyrics, dict):
                raise ValueError('Invalid lyrics JSON')
            json.loads(config_bytes)
            refs = {}
            missing = []
            for relative, source in media.items():
                kind = _MEDIA[source.suffix.lower()]
                sha = digest(source)
                key = (kind, sha)
                asset_id = index.get(key)
                if not asset_id and apply:
                    asset_id = await _register(kind, source, sha, migration_id)
                    index[key] = asset_id
                if asset_id:
                    refs[relative] = {'kind': kind, 'asset_id': asset_id, 'sha256': sha}
                else:
                    missing.append(relative)
                    missing_assets.setdefault(key, source.stat().st_size)
            result.update(content_prefix=prefix, media_count=len(media), runtime_count=len(code),
                          resources_to_register=missing)
            if data_urls:
                result['data_urls'] = data_urls
                result['extra_data_urls'] = sorted(extra_files)
            if not apply:
                result['status'] = 'planned'
                continue
            revision = archive_engine(design, html, code)
            if assemble(design, revision) != html:
                raise ValueError('Archived HTML differs')
            for name, path in runtime_assets(design, revision).items():
                if name not in code or digest(path) != digest(code[name]):
                    raise ValueError(f'Archived runtime differs: {name}')
            # Stage the manifest in a disposable directory. The project is only
            # published after the resolver reproduces the old HTML and media.
            from src.core.nodemotion.shared.execution import create_project
            with tempfile.TemporaryDirectory(prefix='.nodemotion-migrate-', dir=root.parent) as temp:
                stage = Path(temp)
                (stage / prefix).mkdir(parents=True, exist_ok=True)
                config_destination = stage / data_urls['config'] if data_urls else stage / prefix / 'config.json'
                config_destination.parent.mkdir(parents=True, exist_ok=True)
                config_destination.write_bytes(config_bytes)
                for name, body in extra_files.items():
                    target = stage / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(body)
                project_options = {'data_urls': data_urls, 'inject_base': False} if data_urls else {}
                if extra_files:
                    project_options['extra_data_urls'] = sorted(extra_files)
                project = create_project(stage, design, refs, content_prefix=prefix, **project_options,
                    timeline=lyrics if design_manifest(design)['family'] == 'promo' else None,
                    transcription_data=lyrics_bytes if design_manifest(design)['family'] == 'lyrics' else None,
                    lyrics_asset_id=artifacts.get('music_asset_id') if design_manifest(design)['family'] == 'lyrics' else None)
                # Preserve approved promo timing bytes, including formatting.
                if project.get('timeline'):
                    (stage / prefix / 'timeline.json').write_bytes(lyrics_bytes)
                project['engine'] = {'policy': 'pinned', 'revision': revision}
                (stage / 'project.json').write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding='utf-8')
                _verify_resolved(stage, prefix, raw_html, code, media, lyrics, lyrics_bytes,
                                 data_urls=data_urls, config_bytes=config_bytes, extra_files=extra_files)
                if ((root / 'index.html').read_bytes() != raw_html or
                    config_path.read_bytes() != config_bytes or
                    lyrics_path.read_bytes() != lyrics_bytes or
                    any((root / name).read_bytes() != body for name, body in extra_files.items())):
                    raise ValueError('Project inputs changed during migration')
                if not orphan and design_manifest(design)['family'] == 'promo':
                    from src.core.nodemotion.promo.approval_compatibility import (
                        prepare_review_compatibility, review_path,
                    )
                    proof = prepare_review_compatibility(
                        root, stage, draft_id=migration_id,
                        retired_paths=[root / 'index.html', *code.values(), *media.values(),
                                       lyrics_path])
                    if proof is not None:
                        proof_path = review_path(root)
                        if proof_path.parent.resolve() != root or proof_path.is_symlink():
                            raise ValueError('Invalid review compatibility path')
                        if proof_path.exists():
                            if proof_path.read_bytes() != proof:
                                raise ValueError('Conflicting review compatibility proof')
                        else:
                            _publish_new(proof_path, proof)
                if project.get('timeline'):
                    timeline = content / 'timeline.json'
                    if timeline.exists() and timeline.read_bytes() != lyrics_bytes:
                        raise ValueError('Conflicting existing timeline bytes')
                    if not timeline.exists():
                        _publish_new(timeline, (stage / prefix / 'timeline.json').read_bytes())
                target = root / 'project.json'
                if target.exists() or target.is_symlink():
                    raise ValueError('Project appeared during migration')
                _publish_new(target, (stage / 'project.json').read_bytes())
            result.update(status='migrated', engine_revision=revision)
            if retire_verified:
                from src.core.nodemotion.shared.retirement import retire_project
                result['retirement'] = retire_project(profile, root, draft_id=migration_id,
                                                      code=code, media=media, apply=True)
        except Exception as exc:
            result.update(status='needs-review', reason=str(exc))
        finally:
            _log_progress(position, len(candidates), design, result.get('status', 'unknown'))
    # Inventory production entry points beyond registered draft jobs without
    # guessing a design from a directory name or importing prototype media.
    job_roots: dict[str, list[str]] = {}
    for job in job_rows:
        output = job.get('output_dir')
        if isinstance(output, str) and Path(output).is_absolute():
            key = str(Path(output).resolve())
            job_roots.setdefault(key, []).append(str(job.get('job_id', '')))
    unmatched_entries: set[Path] = {Path(item['root']).resolve() for item in report['projects']
                                    if item.get('root') and item.get('status') == 'needs-review'}
    if production.is_dir():
        for directory, dirs, files in os.walk(production, followlinks=False):
            base = Path(directory)
            dirs[:] = [name for name in dirs if name not in _SKIP and not (base / name).is_symlink()]
            relative = base.relative_to(production)
            if (relative.parts and relative.parts[0] in {'image', 'video'} or
                not relative.parts or relative.parts in {('commercial',), ('lyrics',)}):
                continue
            if ('index.html' not in files or base.resolve() in seen or
                    base.resolve() in unmatched_entries or str(base.resolve()) in draft_roots):
                continue
            unmatched_entries.add(base.resolve())
            report['projects'].append({'root': str(base), 'status': 'needs-review',
                'reason': 'Production entry has no matching registered draft job',
                'job_ids': job_roots.get(str(base.resolve()), [])})
    for name, job_ids in job_roots.items():
        root = Path(name)
        if (root.is_relative_to(production.resolve()) and root not in seen
                and root not in unmatched_entries and str(root) not in draft_roots):
            report['projects'].append({'root': name, 'status': 'needs-review',
                'reason': 'Job output has no registered draft or HTML entry', 'job_ids': job_ids})
    report['unique_missing_assets'] = len(missing_assets)
    report['unique_missing_bytes'] = sum(missing_assets.values())
    return report
