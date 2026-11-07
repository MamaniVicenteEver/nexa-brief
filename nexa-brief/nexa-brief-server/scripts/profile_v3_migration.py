"""Offline transformation of a sanitized v2 migration staging tree to v3.

The caller seals the staging tree and is responsible for journal persistence,
activation, rollback and maintenance mode. This module never activates a profile.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from src.adapters.data.import_legacy_sections import import_legacy_data
from src.adapters.data.layout import COLLECTIONS, DOCUMENTS
from src.config.media_paths import category_folder, image_key, reel_key, video_key

_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$')
_PRIVATE = re.compile(r'(?:secret|token|credential|password|^accounts\.json$|^users\.json$|^\.env)', re.I)


def _safe(root: Path, path: Path) -> Path:
    if not path.is_relative_to(root):
        raise ValueError('Ruta fuera del staging')
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('Symlink en migración')
        if part == root:
            break
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Ruta fuera del staging')
    return path


def _files(root: Path, tree: Path) -> list[Path]:
    _safe(root, tree)
    if not tree.exists():
        return []
    found = []
    for current, dirs, names in os.walk(tree, followlinks=False):
        directory = Path(current)
        for name in dirs:
            _safe(root, directory / name)
        for name in names:
            path = _safe(root, directory / name)
            if not path.is_file():
                raise ValueError('Archivo de migración no regular')
            found.append(path)
    return sorted(found)


def _json(path: Path) -> Any:
    if _PRIVATE.search(path.name):
        raise ValueError('Un archivo privado apareció en staging JSON')
    with path.open(encoding='utf-8') as stream:
        return json.load(stream)


def _save(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name('.' + path.name + '.v3tmp')
    if temp.exists() or temp.is_symlink():
        raise FileExistsError('Temporal v3 ya existe')
    try:
        with temp.open('x', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _id(value: Any, fallback: str) -> str:
    return value if isinstance(value, str) and _ID.fullmatch(value) else fallback


def _orientation(path: Path) -> str:
    """Probe local bytes only; an unreadable file must never acquire a guessed aspect."""
    executable = shutil.which('ffprobe')
    if executable is None:
        return 'unknown'
    try:
        result = subprocess.run(
            [executable, '-v', 'error', '-protocol_whitelist', 'file', '-select_streams', 'v:0',
             '-show_entries', 'stream=width,height', '-of', 'json', str(path)],
            capture_output=True, text=True, timeout=15, check=True,
        )
        stream = json.loads(result.stdout)['streams'][0]
        width, height = stream['width'], stream['height']
        if type(width) is not int or type(height) is not int or min(width, height) <= 0 or width == height:
            return 'unknown'
        return '9x16' if height > width else '16x9'
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, IndexError, TypeError):
        return 'unknown'


def _rewrite(value: Any, replacements: dict[str, str], media_keys: dict[str, str]) -> Any:
    if isinstance(value, dict):
        return {key: media_keys.get(child, replacements.get(child, child)) if key == 'storage_key' and isinstance(child, str)
                else _rewrite(child, replacements, media_keys) for key, child in value.items()}
    if isinstance(value, list):
        return [_rewrite(child, replacements, media_keys) for child in value]
    if isinstance(value, str):
        return replacements.get(value, value)
    return value


def _records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = _json(path)
    if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
        raise ValueError('Índice legacy inválido')
    return data


def transform_staging(root: Path, tx: Path, journal: dict[str, Any]) -> dict[str, Any]:
    """Transform staged data and plan all output moves without touching live data.

    Output moves use `source` relative to tx and `destination` relative to root.
    The caller must move `root/output` to `tx/legacy/output` before applying them.
    Staged render moves use paths relative to tx. No source profile file is moved.
    """
    root, tx = Path(root).absolute(), Path(tx).absolute()
    _safe(root, tx)
    if journal.get('v3_transform'):
        if journal['v3_transform'].get('complete') is not True:
            raise ValueError('Transformación v3 incompleta; descarte el staging')
        return journal
    data = _safe(tx, tx / 'staged/data')
    stage = _safe(tx, tx / 'staged')
    if not data.is_dir() or (data / 'json').exists():
        raise ValueError('Staging de datos no es v2 o ya contiene secciones')
    mapping = dict(journal.get('mapping') or {})
    if not isinstance(journal.get('mapping'), dict):
        raise ValueError('Falta mapping en journal')
    all_json = _files(tx, data)
    if any(path.suffix.lower() != '.json' for path in all_json):
        raise ValueError('Staging de datos contiene archivos no JSON')
    if any(any(_PRIVATE.search(part) for part in path.relative_to(data).parts) for path in all_json):
        raise ValueError('Staging contiene archivos privados')

    publications = {}
    from src.adapters.showcase.shared_definitions import load_shared_design_defaults
    from src.adapters.showcase.legacy_bundle_validation import assert_legacy_bundle_equivalent
    from src.core.showcase.state_migration import convert_legacy_designs
    legacy_designs = data / 'showcase/designs.json'
    design_rows = _json(legacy_designs) if legacy_designs.exists() else []
    templates = Path(__file__).resolve().parents[1] / 'src/templates'
    defaults = load_shared_design_defaults(templates)
    designs = convert_legacy_designs(design_rows, defaults)
    for row in design_rows:
        assert_legacy_bundle_equivalent(root, row, templates / '_tools/design-definitions')
    record_paths = sorted((data / 'publicaciones').glob('*/*/*/*/record.json'))
    for path in record_paths:
        _safe(tx, path)
        record = _json(path)
        if not isinstance(record, dict) or not isinstance(record.get('technical'), dict):
            raise ValueError('Publicación legacy inválida')
        pub = _id(record.get('publication_id'), '')
        post = _id(record.get('post_id'), '')
        category = category_folder(record.get('editorial', {}).get('category_id', ''))
        if not pub or not post or pub in publications:
            raise ValueError('Identidad de publicación inválida o repetida')
        publications[pub] = (record, path, category, post)

    # Collect every stored key in the record, including format exports.
    referenced: dict[str, tuple[str, str, str]] = {}
    def collect(value, category, post, pub):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'storage_key' and isinstance(child, str):
                    owner = (category, post, pub)
                    if child in referenced and referenced[child] != owner:
                        raise ValueError('Medio compartido por publicaciones incompatibles')
                    referenced[child] = owner
                else:
                    collect(child, category, post, pub)
        elif isinstance(value, list):
            for child in value:
                collect(child, category, post, pub)
    for pub, (record, _, category, post) in publications.items():
        collect(record.get('technical', {}), category, post, pub)

    replacements: dict[str, str] = {}
    media_keys: dict[str, str] = {}
    aliases: dict[str, dict[str, str]] = {}
    existing_destinations: set[str] = set()
    library_collections = {'images': 'image_assets', 'music': 'music_assets',
                           'sounds': 'sound_assets', 'videos': 'video_assets'}
    library_owners: dict[tuple[str, str], set[str]] = {}
    for kind, namespace in library_collections.items():
        collection_path = data / COLLECTIONS[namespace][0]
        for record in _records(collection_path):
            ident = _id(record.get('asset_id'), '')
            if not ident:
                raise ValueError('Recurso de biblioteca sin asset_id válido')
            relative = record.get('relative_path')
            if not isinstance(relative, str) or not relative:
                path_value = record.get('path')
                prefix = str(root / 'resources' / kind) + '/'
                relative = path_value[len(prefix):] if isinstance(path_value, str) and path_value.startswith(prefix) else ''
            if relative:
                parts = Path(relative)
                if parts.is_absolute() or '\\' in relative or any(part in ('.', '..') for part in parts.parts):
                    raise ValueError('Clave de biblioteca inválida')
                library_owners.setdefault((kind, parts.as_posix()), set()).add(ident)

    for record in _records(data / 'content/resources.json'):
        ident, storage = _id(record.get('asset_id'), ''), record.get('storage_key')
        if not ident or not isinstance(storage, str):
            continue
        parts = Path(storage).parts
        if len(parts) >= 3 and parts[0] == 'resources' and parts[1] in library_collections:
            library_owners.setdefault((parts[1], Path(*parts[2:]).as_posix()), set()).add(ident)

    library_count = 0
    migrated_library_keys: set[tuple[str, str]] = set()
    for old_source in sorted(key for key in mapping if key.startswith('data/library/files/')):
        relative = Path(old_source).relative_to('data/library/files')
        if len(relative.parts) < 2 or relative.parts[0] not in library_collections:
            raise ValueError('Tipo de biblioteca no reconocido')
        kind = relative.parts[0]
        old_key = Path(*relative.parts[1:]).as_posix()
        migrated_library_keys.add((kind, old_key))
        source = _safe(root, root / old_source)
        if not source.is_file():
            raise ValueError('Medio de biblioteca no está disponible')
        owners = library_owners.get((kind, old_key), set())
        asset = min(owners) if owners else 'legacy-' + _digest(old_source)[:24]
        new_key = f'resources/{kind}/{asset}/{relative.name}'
        if new_key in existing_destinations:
            new_key = f'resources/{kind}/{asset}/legacy-{_digest(old_source)[:16]}-{relative.name}'
        if new_key in existing_destinations:
            raise ValueError('Colisión de medio de biblioteca')
        existing_destinations.add(new_key)
        old_key_full = f'resources/{kind}/{old_key}'
        previous = mapping[old_source]
        mapping[old_source] = new_key
        aliases[_digest(old_key_full)] = {'legacy_key': old_key_full, 'storage_key': new_key,
                                          'sha256': _file_digest(source)}
        for old in (old_source, previous):
            replacements[old] = new_key
            replacements[str(root / old)] = str(root / new_key)
        library_count += 1

    known_pub_sources = {key[len('data/publicaciones/'):]: key for key in mapping if key.startswith('data/publicaciones/')}
    for old_key, (category, post, pub) in referenced.items():
        if old_key not in known_pub_sources:
            raise ValueError('Medio de publicación referenciado no está en el plan de migración')
        ext = Path(old_key).suffix.lower()
        asset = 'legacy-' + _digest(old_key)[:24]
        if ext in {'.jpg', '.jpeg'}:
            new_key = image_key(category, post, pub, asset)
        elif ext == '.mp4':
            new_key = reel_key(category, post, pub, _digest(old_key))
        else:
            raise ValueError('Formato de publicación referenciado no compatible')
        dest = 'renders/' + new_key
        if dest in existing_destinations:
            raise ValueError('Colisión de medio de publicación')
        existing_destinations.add(dest)
        old_source = known_pub_sources[old_key]
        original = _safe(root, root / old_source)
        if not original.is_file():
            raise ValueError('Medio de publicación no está disponible')
        previous = mapping[old_source]
        mapping[old_source] = dest
        media_keys[old_key] = new_key
        aliases[_digest(old_key)] = {'legacy_key': old_key, 'storage_key': new_key,
                                     'sha256': _file_digest(original)}
        for old in (old_source, previous):
            replacements[old] = dest
            replacements[str(root / old)] = str(root / dest)

    # Preserve non-selected publication media and traces, with deterministic IDs.
    for old_key, old_source in known_pub_sources.items():
        if old_key in referenced:
            continue
        parts = Path(old_key).parts
        owner = next(((pub, c, post) for pub, (_, _, c, post) in publications.items() if pub in parts), None)
        pub, category, post = owner or ('legacy-' + _digest(old_key)[:16], 'otros', 'legacy-' + _digest(old_key)[:16])
        ext = Path(old_key).suffix.lower()
        if ext in {'.jpg', '.jpeg'}:
            dest = 'renders/' + image_key(category, post, pub, 'legacy-' + _digest(old_key)[:24])
        elif ext == '.mp4':
            dest = 'renders/' + reel_key(category, post, pub, _digest(old_key))
        elif ext in {'.txt', '.jsonl', '.log'}:
            dest = f'logs/publications/{pub}/legacy-{_digest(old_key)[:16]}{ext}'
        else:
            dest = f'productions/{category}/{post}/work/legacy-publications/{pub}/legacy-{_digest(old_key)[:16]}{ext}'
        if dest in existing_destinations:
            raise ValueError('Colisión de archivo de publicación')
        existing_destinations.add(dest)
        previous = mapping[old_source]
        mapping[old_source] = dest
        replacements[old_source] = dest
        replacements[str(root / old_source)] = str(root / dest)
        replacements[previous] = dest
        replacements[str(root / previous)] = str(root / dest)
        if dest.startswith('renders/'):
            original = _safe(root, root / old_source)
            if not original.is_file():
                raise ValueError('Medio de publicación no está disponible')
            aliases[_digest(old_key)] = {'legacy_key': old_key, 'storage_key': dest[len('renders/'):],
                                         'sha256': _file_digest(original)}

    videos = _records(data / 'content/videos.json')
    jobs = _records(data / 'jobs/jobs.json')
    details_dir = data / 'content/video_details'
    details = {}
    for row in videos:
        video = _id(row.get('video_id'), '')
        if video:
            path = _safe(tx, details_dir / f'{video}.json')
            details[video] = _json(path) if path.is_file() else {}
    # Resolve product configuration from the profile being migrated, never the
    # currently selected profile. Fall back only to versioned product defaults.
    profile_niches = root / 'config/niches.json'
    niches_path = profile_niches if profile_niches.exists() else Path(__file__).resolve().parents[1] / 'niches.json'
    config = _json(_safe(root, profile_niches)) if profile_niches.exists() else _json(niches_path)
    categories = config.get('categories', {}) if isinstance(config, dict) else {}
    if not isinstance(categories, dict):
        raise ValueError('Configuración de categorías inválida')
    known_categories = set(categories)
    known_folders = {category_folder(name) for name in known_categories}
    niche_categories: dict[str, str] = {}
    def collect_niches(node: Any, folder: str) -> None:
        if not isinstance(node, dict):
            raise ValueError('Categoría inválida')
        for niche in node.get('niches', []):
            if isinstance(niche, str):
                prior = niche_categories.setdefault(niche, folder)
                if prior != folder:
                    raise ValueError('Nicho pertenece a varias categorías')
        children = node.get('children', {})
        if not isinstance(children, dict):
            raise ValueError('Subcategorías inválidas')
        for child in children.values():
            collect_niches(child, folder)
    for name, node in categories.items():
        collect_niches(node, category_folder(node.get('folder') or name))
    # Drafts own outputs even when no schedulable job record exists.  They are
    # used only to map files; never insert them into the jobs collection.
    draft_jobs = []
    draft_categories = {}
    for path in _files(tx, data / 'studio/draft_jobs'):
        if path.suffix != '.json':
            raise ValueError('Documento de borrador inválido')
        draft = _json(path)
        if not isinstance(draft, dict):
            raise ValueError('Documento de borrador inválido')
        job_id = _id(draft.get('job_id'), '')
        artifacts, inputs = draft.get('artifacts', {}), draft.get('input', {})
        if not isinstance(artifacts, dict) or not isinstance(inputs, dict):
            raise ValueError('Metadatos de borrador inválidos')
        directory = artifacts.get('output_dir')
        if not directory:
            continue
        if not job_id or not isinstance(directory, str):
            raise ValueError('Identidad o output de borrador inválido')
        category = inputs.get('category_name') or ''
        previous = draft_categories.setdefault(job_id, category)
        if previous != category:
            raise ValueError('Categorías incompatibles para borrador')
        masters = {}
        for fmt in ('youtube', 'reels', 'tiktok'):
            value = artifacts.get(fmt + '_video_path')
            if isinstance(value, str) and value:
                masters[fmt] = value
        draft_jobs.append({'job_id': job_id, 'category': category, 'output_dir': directory,
                           'file_paths': masters, 'source': 'draft'})
    output_references = {}
    output_owners: dict[Path, tuple[str, str]] = {}
    for job in jobs + draft_jobs:
        job_id = _id(job.get('job_id'), '')
        video = _id(job.get('video_id'), '') or job_id
        if not video:
            continue
        category = (details.get(video, {}).get('category_id') or job.get('category_path')
                    or job.get('category_id') or job.get('category') or draft_categories.get(job_id) or '')
        if not category:
            template = str(job.get('template_id') or '')
            category = next((item for item in known_categories if template == item or template.startswith(item + '_')
                             or template.startswith(item + '-')), 'otros')
        try:
            category = category_folder(niche_categories.get(category, category))
        except ValueError:
            category = 'otros'
        directory = job.get('output_dir')
        if isinstance(directory, str) and job.get('source') == 'explainer':
            # Explainer output folders contain recordings, while the job's v3
            # working directory belongs to the already discovered production.
            # Do not invent a production when its original source is missing.
            folder_key = details.get(video, {}).get('folder_key')
            if isinstance(folder_key, str):
                folder = Path(folder_key)
                if (len(folder.parts) != 3 or folder.parts[0] != 'productions'
                        or any(part in ('.', '..') for part in folder.parts)):
                    raise ValueError('Directorio de producción inválido')
                staged_folder = _safe(tx, stage / folder)
                if staged_folder.is_dir():
                    path = Path(directory)
                    for base in (root / 'output', root / 'renders'):
                        if path.is_absolute() and path.is_relative_to(base):
                            rel = path.relative_to(base)
                            if not rel.parts or '..' in rel.parts:
                                raise ValueError('Directorio de job inválido')
                            destination = str(root / folder)
                            for old_base in (root / 'output', root / 'renders'):
                                replacements[str(old_base / rel)] = destination
                            replacements[str(Path('/app/output') / rel)] = destination
                            for legacy in journal.get('legacy_server_roots', []):
                                replacements[str(Path(legacy) / 'output' / rel)] = destination
                            replacements[(Path('output') / rel).as_posix()] = destination
                            replacements[(Path('renders') / rel).as_posix()] = destination
                            break
        if isinstance(directory, str) and job.get('source') != 'explainer':
            output_path = Path(directory)
            for base in (root / 'output', root / 'renders'):
                if output_path.is_absolute() and output_path.is_relative_to(base):
                    rel = output_path.relative_to(base)
                    if not rel.parts or '..' in rel.parts:
                        raise ValueError('Directorio de job inválido')
                    previous_owner = output_owners.setdefault(rel, (category, video))
                    if previous_owner != (category, video):
                        raise ValueError('Directorio de output pertenece a varios jobs')
                    destination = str(root / 'productions' / category / video)
                    for old_base in (root / 'output', root / 'renders'):
                        replacements[str(old_base / rel)] = destination
                    replacements[str(Path('/app/output') / rel)] = destination
                    for legacy in journal.get('legacy_server_roots', []):
                        replacements[str(Path(legacy) / 'output' / rel)] = destination
                    replacements[(Path('output') / rel).as_posix()] = destination
                    replacements[(Path('renders') / rel).as_posix()] = destination
                    break
        for field in ('file_paths', 'format_paths'):
            values = job.get(field) or {}
            if not isinstance(values, dict):
                raise ValueError('Referencias de output inválidas')
            for fmt, value in values.items():
                if isinstance(value, str):
                    identity = (category, video, str(fmt))
                    candidates = {value}
                    if value.startswith(('output/', 'renders/')):
                        candidates.add(str(root / value))
                    if value.startswith(str(root / 'output') + '/'):
                        candidates.add(str(root / 'renders') + value[len(str(root / 'output')):])
                    for candidate in candidates:
                        previous = output_references.get(candidate)
                        if previous and previous[:2] != identity[:2]:
                            raise ValueError('Un output tiene varias identidades de job')
                        output_references.setdefault(candidate, identity)

    # Keep an existing empty source directory addressable after relocation.
    # Non-empty owners are populated by the per-file moves below.
    for rel, (category, video) in output_owners.items():
        original = _safe(root, root / 'output' / rel)
        if original.is_dir():
            _safe(tx, stage / 'productions' / category / video).mkdir(parents=True, exist_ok=True)

    resources = _records(data / 'content/resources.json')
    resource_ids = {row.get('asset_id') for row in resources}
    output_moves, render_moves = [], []
    def output_group(relative: Path) -> tuple[str, str]:
        first = relative.parts[0] if len(relative.parts) > 1 else ''
        category = category_folder(first) if first in known_categories or first in known_folders else 'otros'
        group = (relative.parts[1] if category != 'otros' and len(relative.parts) > 2 else first)
        return category, group or relative.stem

    group_identities: dict[tuple[str, str], tuple[str, str] | None] = {}
    for value, (category, video, _) in output_references.items():
        path = Path(value)
        for base in (root / 'output', root / 'renders'):
            if path.is_absolute() and path.is_relative_to(base):
                group = output_group(path.relative_to(base))
                identity = (category, video)
                if group not in group_identities:
                    group_identities[group] = identity
                elif group_identities[group] != identity:
                    group_identities[group] = None
                break
    # A video embedded by source code is an input unless an explicit job output
    # identifies it as a master, even if its filename looks like a final render.
    quoted = re.compile(r"(?P<quote>['\"`])(?P<url>[^'\"`\n]+)(?P=quote)")
    unquoted_src = re.compile(r'\b(?:src|href)\s*=\s*([^\s>\"\'`]+)', re.I)
    unquoted_css = re.compile(r'url\(\s*([^\s)\"\'`]+)\s*\)', re.I)
    output_files = _files(root, root / 'output')
    source_texts: dict[Path, str] = {}
    embedded_inputs: set[Path] = set()
    def local_reference(rel: Path, url: str) -> Path | None:
        path_part = url.split('?', 1)[0].split('#', 1)[0]
        if path_part.startswith(('/app/output/', str(root / 'output') + '/')):
            absolute = Path(path_part.replace('/app/output/', str(root / 'output') + '/', 1))
            if not absolute.is_relative_to(root / 'output'):
                return None
            return absolute.relative_to(root / 'output')
        if path_part.startswith(('/', 'http:', 'https:', 'data:', '#')):
            return None
        reference = Path(os.path.normpath(str(rel.parent / path_part)))
        return None if '..' in reference.parts else reference
    for source in output_files:
        rel = source.relative_to(root / 'output')
        if (source.suffix.lower() not in {'.html', '.htm', '.js', '.mjs', '.css'}
                or not any(rel.is_relative_to(owner) for owner in output_owners)):
            continue
        if _PRIVATE.search(source.name):
            raise ValueError('Fuente textual privada en output')
        original = source.read_bytes().decode('utf-8', errors='surrogateescape')
        source_texts[rel] = original
        urls = [m.group('url') for m in quoted.finditer(original)]
        urls.extend(m.group(1) for m in unquoted_src.finditer(original))
        urls.extend(m.group(1) for m in unquoted_css.finditer(original))
        for url in urls:
            reference = local_reference(rel, url)
            if reference is not None:
                embedded_inputs.add(reference)
    unknown_orientations = []
    master_routes: dict[Path, str] = {}
    def classify(source: Path, relative: Path, source_ref: str, is_master: bool):
        hint = output_references.get(source_ref)
        explicit_hint = hint
        owner = None
        if not is_master:
            matches = [(path, identity) for path, identity in output_owners.items() if relative.is_relative_to(path)]
            if matches:
                owner = max(matches, key=lambda item: len(item[0].parts))
                if hint is None:
                    hint = (*owner[1], '')
        category_hint, group = output_group(relative)
        group_identity = group_identities.get((category_hint, group)) if not is_master else None
        if hint is None and group_identity:
            hint = (*group_identity, '')
        video_hint = relative.parts[0] if is_master and relative.parts else 'legacy-' + _digest(group)[:16]
        category, video, fmt = hint or (category_hint, _id(video_hint, 'legacy-' + _digest(group)[:16]), '')
        if is_master and video in details:
            try:
                category = category_folder(details[video].get('category_id') or 'otros')
            except ValueError:
                category = 'otros'
        root_master_name = (relative.name.lower() in {'final.mp4', 'video.mp4'}
                            or relative.name.lower().endswith('_video.mp4'))
        # An owned output can contain arbitrary input clips, including under
        # assets/. The presence of a job owner alone does not make one a master.
        at_owner_root = owner is None or relative.parent == owner[0]
        final = relative.suffix.lower() == '.mp4' and (
            is_master or explicit_hint is not None or (root_master_name and at_owner_root and relative not in embedded_inputs))
        if final:
            orientation = _orientation(source)
            recording = 'legacy-' + _digest(source_ref)[:16]
            if orientation == 'unknown':
                unknown_orientations.append(source_ref)
                dest = f'renders/videos/{category}/{video}/{recording}-unknown/video.mp4'
            else:
                dest = 'renders/' + video_key(category, video, recording, orientation)
            if not is_master:
                master_routes[relative] = '/api/v1/explainer/files/' + dest
            asset = _digest(video + ':' + dest)
            if asset not in resource_ids:
                resources.append({'asset_id': asset, 'video_id': video, 'storage_key': dest, 'kind': 'video'})
                resource_ids.add(asset)
            detail = details.setdefault(video, {'category_id': category, 'legacy_source': source_ref})
            detail.setdefault('recordings', {})[recording] = {'recording_id': recording, 'asset_ids': [asset], 'source': 'legacy-output'}
            if not any(row.get('video_id') == video for row in videos):
                videos.append({'video_id': video, 'production_id': video if owner is not None else recording})
        elif owner is not None:
            # Keep the original relative tree: legacy HTML/JS may reference flat
            # audio, images and other files directly. Never duplicate the bytes.
            dest = (Path('productions') / category / video / relative.relative_to(owner[0])).as_posix()
        else:
            dest = f'productions/{category}/{video}/work/legacy-output-{_digest(source_ref)[:16]}/{relative.name}'
        return dest

    for source in output_files:
        rel = source.relative_to(root / 'output')
        previous = str(root / 'renders' / rel)
        dest = classify(source, rel, previous, False)
        if dest in existing_destinations or (stage / dest).exists():
            raise ValueError('Colisión de output')
        existing_destinations.add(dest)
        output_moves.append({'source': (Path('legacy/output') / rel).as_posix(), 'destination': dest})
        for old in (str(root / 'output' / rel), previous, str(Path('/app/output') / rel)):
            replacements[old] = str(root / dest)
        for legacy in journal.get('legacy_server_roots', []):
            replacements[str(Path(legacy) / 'output' / rel)] = str(root / dest)
        replacements[(Path('renders') / rel).as_posix()] = dest
        replacements[(Path('output') / rel).as_posix()] = dest
    # Rewrite local links to exported masters in owned source files. Stage the
    # changed text separately, leaving original bytes in legacy/output so that
    # rollback restores the exact source. Input clips remain next to the HTML.
    for item in output_moves:
        source = root / 'output' / Path(item['source']).relative_to('legacy/output')
        rel = source.relative_to(root / 'output')
        original = source_texts.get(rel)
        if original is None:
            continue
        def replace_url(url: str) -> str:
            reference = local_reference(rel, url)
            if reference not in master_routes:
                return url
            route = master_routes[reference]
            suffix_at = min((i for i in (url.find('?'), url.find('#')) if i >= 0), default=len(url))
            return route + url[suffix_at:]
        def replace_link(match: re.Match[str]) -> str:
            return match.group('quote') + replace_url(match.group('url')) + match.group('quote')
        def replace_unquoted(match: re.Match[str]) -> str:
            url = match.group(1)
            start, end = match.span(1)
            return match.group(0)[:start - match.start()] + replace_url(url) + match.group(0)[end - match.start():]
        rewritten = unquoted_css.sub(replace_unquoted, unquoted_src.sub(replace_unquoted, quoted.sub(replace_link, original)))
        if rewritten != original:
            staged = _safe(tx, stage / 'rewritten-output' / rel)
            staged.parent.mkdir(parents=True, exist_ok=True)
            staged.write_bytes(rewritten.encode('utf-8', errors='surrogateescape'))
            item['source'] = staged.relative_to(tx).as_posix()
    for source in _files(tx, stage / 'render-import'):
        rel = source.relative_to(stage / 'render-import')
        previous = str(root / 'renders' / rel)
        dest = classify(source, rel, previous, True)
        if dest in existing_destinations:
            raise ValueError('Colisión de master')
        existing_destinations.add(dest)
        render_moves.append({'source': source.relative_to(tx).as_posix(), 'destination': dest})
        replacements[previous] = str(root / dest)
        replacements[(Path('renders') / rel).as_posix()] = dest

    unresolved_outputs = {
        value for value in output_references
        if value.startswith((str(root / 'renders') + '/', str(root / 'output') + '/'))
        and value not in replacements
    }

    # Preserve remaining ordinary JSON in one keyed namespace, never discard it.
    known = {data / relative for name, (relative, _) in COLLECTIONS.items() if name != 'showcase_designs'}
    known.update(path for relative in DOCUMENTS.values() for path in _files(tx, data / relative) if path.suffix == '.json')
    known.update(record_paths)
    known.add(data / 'publicaciones/idempotency.json')
    known.add(data / 'publicaciones/index.json')
    known.add(legacy_designs)
    residual = {}
    staged_traces = []
    for path in all_json:
        if path not in known:
            relative = path.relative_to(data)
            if relative.parts[0] == 'publicaciones':
                owner = next(((pub, c, post) for pub, (_, _, c, post) in publications.items()
                              if pub in relative.parts), None)
                pub, category, post = owner or ('legacy-' + _digest(relative.as_posix())[:16], 'otros',
                                                'legacy-' + _digest(relative.as_posix())[:16])
                target = stage / 'productions' / category / post / 'work' / 'legacy-publications' / pub / ('legacy-' + _digest(relative.as_posix())[:16] + '.json')
                _safe(tx, target)
                if target.exists():
                    raise FileExistsError('Colisión de traza de publicación')
                staged_traces.append((target, _json(path)))
            else:
                residual[relative.as_posix()] = _json(path)

    # Rewrite only sanitized staged JSON; source JSON and binary media remain intact.
    for path in all_json:
        value = _json(path)
        _save(path, _rewrite(value, replacements, media_keys))
    for video, detail in details.items():
        _save(details_dir / (video + '.json'), _rewrite(detail, replacements, media_keys))
    if videos:
        _save(data / 'content/videos.json', _rewrite(videos, replacements, media_keys))
    if resources:
        _save(data / 'content/resources.json', _rewrite(resources, replacements, media_keys))
    for key, value in aliases.items():
        _save(data / 'content/media_aliases' / f'{key}.json', value)
    for old, destination in replacements.items():
        _save(data / 'content/legacy_path_aliases' / (_digest(old) + '.json'),
              {'legacy_key': old, 'storage_key': destination})
    for target, value in staged_traces:
        _save(target, _rewrite(value, replacements, media_keys))
    counts = import_legacy_data(data, data)
    design_section_path = data / 'json/designs.json'
    design_section = _json(design_section_path)
    design_section['collections']['showcase_designs'] = designs
    _save(design_section_path, design_section)
    counts['showcase_designs'] = len(designs)
    if residual:
        path = data / 'json/legacy.json'
        _save(path, {'schema_version': 1, 'revision': 1, 'collections': {},
                     'documents': {'legacy_json': _rewrite(residual, replacements, media_keys)}})
    archive = _safe(tx, tx / 'legacy/staged-json')
    if archive.exists():
        raise FileExistsError('El archivo legacy de staging ya existe')
    archive.mkdir(parents=True)
    for child in sorted(data.iterdir()):
        if child.name != 'json':
            shutil.move(str(child), str(archive / child.name))
    for old, destination in mapping.items():
        mapping[old] = replacements.get(destination, destination)
    journal['mapping'] = mapping
    journal['output_moves'] = output_moves
    journal['staged_render_moves'] = render_moves
    journal['v3_transform'] = {'complete': True, 'counts': counts, 'media_aliases': len(aliases),
                               'library_files': library_count,
                               'unresolved_library_reference_count': len(set(library_owners) - migrated_library_keys),
                               'path_aliases': len(replacements),
                               'output_files': len(output_moves), 'render_import_files': len(render_moves),
                               'publication_traces': len(staged_traces),
                               'preserved_legacy_json': len(residual),
                               'unresolved_output_reference_count': len(unresolved_outputs),
                               'unknown_orientation_count': len(unknown_orientations)}
    return journal
