"""Read-only inventory. Emits a reconciliation plan; never applies changes."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re

DENIED_DIRS = {'.git', '.agents', '.aws', '.codex', 'node_modules', '__pycache__', '.venv'}
DENIED_FILES = {'.env', 'accounts.json', 'users.json', 'credentials.json'}


def allowed_file(name: str) -> bool:
    return name not in DENIED_FILES and not name.startswith(('client_secret', '.env.'))


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def inventory(root: Path) -> dict[str, dict]:
    result = {}
    if not root.is_dir():
        return result
    for current, directories, files in os.walk(root, followlinks=False):
        for name in directories:
            link = Path(current) / name
            if name not in DENIED_DIRS and link.is_symlink():
                result[str(link.relative_to(root))] = {'kind': 'symlink', 'target': os.readlink(link)}
        directories[:] = sorted(d for d in directories if d not in DENIED_DIRS and not (Path(current) / d).is_symlink())
        for name in sorted(files):
            if not allowed_file(name):
                continue
            path = Path(current) / name
            relative = str(path.relative_to(root))
            if path.is_symlink():
                result[relative] = {'kind': 'symlink', 'target': os.readlink(path)}
            elif path.is_file():
                result[relative] = {'kind': 'file', 'bytes': path.stat().st_size, 'sha256': digest(path)}
    return result


def json_fields(a, b, key='') -> list[str]:
    if type(a) is not type(b):
        return [key or '$']
    if isinstance(a, dict):
        return [key + '.' + name for name in sorted(a.keys() ^ b.keys())] + [field for name in sorted(a.keys() & b.keys()) for field in json_fields(a[name], b[name], key + '.' + name)]
    if isinstance(a, list):
        if len(a) != len(b):
            return [key + '.length']
        return [field for i, (left, right) in enumerate(zip(a, b)) for field in json_fields(left, right, key + '[' + str(i) + ']')]
    return [] if a == b else [key or '$']


def path_only_html(a: str, b: str) -> bool:
    # Replace only script/link URL values. All markup, CSS and inline code must match.
    pattern = r'(?P<head>\b(?:src|href)=[\"\x27])(?P<url>[^\"\x27]+)(?P<tail>[\"\x27])'
    left = re.findall(pattern, a)
    right = re.findall(pattern, b)
    if len(left) != len(right):
        return False
    changes = [(x[1], y[1]) for x, y in zip(left, right) if x[1] != y[1]]
    if not changes:
        return False
    # A route-only classification requires matching filenames and local old/new URLs.
    if any(x.rsplit('/', 1)[-1] != y.rsplit('/', 1)[-1] or '://' in x or '://' in y for x, y in changes):
        return False
    return re.sub(pattern, lambda m: m['head'] + 'URL' + m['tail'], a) == re.sub(pattern, lambda m: m['head'] + 'URL' + m['tail'], b)


def compare(source: Path, target: Path, source_files: dict, target_files: dict) -> dict:
    equal = []
    equivalent = []
    changed = []
    for relative in sorted(source_files.keys() & target_files.keys()):
        a, b = source_files[relative], target_files[relative]
        if a == b:
            equal.append(relative)
            continue
        item = {'file': relative, 'source_sha256': a.get('sha256'), 'target_sha256': b.get('sha256')}
        if a['kind'] == b['kind'] == 'file' and relative.endswith('.json'):
            try:
                left = json.loads((source / relative).read_text())
                right = json.loads((target / relative).read_text())
                fields = json_fields(left, right)
                if not fields:
                    equivalent.append(dict(item, equality='json_semantic'))
                    continue
                item['changed_fields'] = fields[:30]
                item['changed_field_count'] = len(fields)
                if fields == ['.output'] and isinstance(left, dict) and isinstance(right, dict) and isinstance(left.get('output'), str) and isinstance(right.get('output'), str) and Path(left['output']).name == Path(right['output']).name:
                    equivalent.append(dict(item, equality='render_output_path_only'))
                    continue
            except (OSError, ValueError, TypeError):
                pass
        elif a['kind'] == b['kind'] == 'file' and relative.endswith('.html'):
            try:
                if path_only_html((source / relative).read_text(), (target / relative).read_text()):
                    equivalent.append(dict(item, equality='external_url_paths_only'))
                    continue
            except (OSError, UnicodeError):
                pass
        changed.append(item)
    return {'byte_identical_count': len(equal), 'semantic_or_route_equivalent': equivalent, 'different': changed,
            'source_only': [dict(file=x, **source_files[x]) for x in sorted(source_files.keys() - target_files.keys())],
            'target_only': [dict(file=x, **target_files[x]) for x in sorted(target_files.keys() - source_files.keys())]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--server-root', default='/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server')
    parser.add_argument('--profile-root', default='/home/alfred/.local/share/nexa-brief/profiles/profesional')
    args = parser.parse_args()
    server, profile = Path(args.server_root), Path(args.profile_root)
    templates = server / 'src/templates'
    legacy = templates / 'sandbox'
    targets = {
        'nodehistory/fronteras-demo': templates / 'nodeatlas/fronteras-demo',
        'nodehistory/bolivia-mar': profile / 'productions/node_atlas_bol/bolivia-mar',
        'nodehistory/memorias-demo': templates / 'nodehistory/memorias-demo',
        'nodepolitics/atlas-demo': profile / 'productions/nodeatlas/atlas-demo',
        'nodeeconomy/dinero-demo': templates / 'nodeeconomy/dinero-demo',
    }
    plan = {'generated_at_utc': datetime.now(timezone.utc).isoformat(), 'mode': 'READ_ONLY_DRY_RUN',
            'applied': False, 'backup_policy': 'HDD absent: do not create SSD backup; no deletion or overwrite is proposed by this script.',
            'projects': [], 'references': [], 'reference_aliases': [], 'residues_names_only': []}
    for category in sorted(legacy.iterdir()):
        if not category.is_dir() or category.name.startswith('_') or category.name in DENIED_DIRS or category.name == 'referencias':
            continue
        for source in sorted(category.iterdir()):
            if not source.is_dir() or source.is_symlink() or source.name.startswith('_') or source.name in DENIED_DIRS:
                continue
            if not (source / 'info.json').is_file() or not (source / 'index.html').is_file():
                if source.name == 'atlas-en-movimiento':
                    plan['residues_names_only'].append({'path': str(source), 'top_level_names_only': sorted(x.name for x in source.iterdir()), 'action': 'leave untouched; no project media identified'})
                continue
            relative = str(source.relative_to(legacy))
            target = targets.get(relative, profile / 'sandbox' / relative)
            source_files, target_files = inventory(source), inventory(target)
            result = compare(source, target, source_files, target_files)
            item = {'project': relative, 'source': str(source), 'target': str(target), 'target_exists': target.exists(),
                    'source_file_count': len(source_files), 'target_file_count': len(target_files),
                    'source_inventory': source_files, 'target_inventory': target_files, **result}
            unique = [x for x in result['source_only'] if x['kind'] == 'file' and Path(x['file']).name != '.gitignore']
            item['proposed_unique_transfers'] = [{'source': str(source / x['file']), 'target': str(target / x['file']), 'sha256': x.get('sha256'), 'operation': 'move only after fresh destination-absence and source-hash checks'} for x in unique]
            item['source_only_symlinks'] = [dict(x, operation='retain link metadata in this plan; do not recreate absolute links from another workstation in an active project') for x in result['source_only'] if x['kind'] == 'symlink']
            reference = profile / 'sandbox/referencias' / source.parent.name / (source.name + '-revision-repositorio')
            item['proposed_divergent_retention'] = [{'source': str(source / x['file']), 'target': str(reference / x['file']), 'sha256': x.get('source_sha256'), 'operation': 'move original divergent file only; never overwrite active target; retain comparison manifest'} for x in result['different']]
            item['duplicate_retirement'] = 'not applied; requires policy decision and fresh equivalence checks; never remove unique content'
            if relative == 'nodehistory/atlas-cinematico':
                item['note'] = 'Old prototype is not canonical economic principal demo. Economic principal exists=' + str((templates / 'nodeatlas/atlas-economias-demo/index.html').is_file()) + '. Retain prototype data in profile sandbox or explicitly selected references; root owns motor relocation.'
                item['optional_reclassify_existing_profile_project'] = {'source': str(target), 'target': str(profile / 'sandbox/referencias/nodehistory/atlas-cinematico-revision'), 'operation': 'move existing profile prototype once only if it is no longer an active experiment; do not duplicate the legacy source'}
            if relative == 'nodeeconomy/dinero-demo':
                item['note'] = 'Principal demo was integrated through API at repository nodeeconomy/dinero-demo; this plan reconciles its legacy files only.'
            plan['projects'].append(item)
    for category in sorted((legacy / 'referencias').iterdir()):
        if not category.is_dir() or category.is_symlink() or category.name in DENIED_DIRS:
            continue
        for source in sorted(category.iterdir()):
            if source.name.startswith('.'):
                continue
            target = profile / 'sandbox/referencias' / category.name / source.name
            if source.is_symlink():
                plan['reference_aliases'].append({'source': str(source), 'link_target': os.readlink(source), 'target_is_other_legacy_reference': source.resolve().parent == source.parent.resolve()})
            elif source.is_dir():
                left, right = inventory(source), inventory(target)
                plan['references'].append({'source': str(source), 'target': str(target), 'source_inventory': left, 'target_inventory': right, 'exact_inventory_equal': left == right})
    plan['counts'] = {'projects': len(plan['projects']), 'source_only_non_gitignore': sum(len(x['proposed_unique_transfers']) for x in plan['projects']), 'divergent_files_to_review': sum(len(x['different']) for x in plan['projects'])}
    print(json.dumps(plan, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
