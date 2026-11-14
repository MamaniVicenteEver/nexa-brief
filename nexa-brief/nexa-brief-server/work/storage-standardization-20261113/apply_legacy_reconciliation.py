"""Apply a reviewed inventory plan. Defaults to dry-run; supports journaled resume.

No backup, copy, recursive delete, app edits or source traversal outside the plan.
The journal stores operation metadata, never project files. Resume continues a
previously validated plan; it is not a promise of byte-exact rollback of obsolete
JSON formatting. Use the same plan file and its SHA-256 for apply and resume.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

from legacy_reconcile_dryrun import DENIED_DIRS, allowed_file, digest, inventory

SERVER = Path('/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server')
PROFILE = Path('/home/alfred/.local/share/nexa-brief/profiles/profesional')
LEGACY = SERVER / 'src/templates/sandbox'


def spec(path: Path):
    if path.is_symlink():
        return {'kind': 'symlink', 'target': os.readlink(path)}
    if path.is_file():
        return {'kind': 'file', 'bytes': path.stat().st_size, 'sha256': digest(path)}
    if path.exists():
        return {'kind': 'unexpected_directory'}
    return None


def assert_safe(path: Path, roots: tuple[Path, ...]) -> None:
    if not path.is_absolute() or '..' in path.parts or any(x in DENIED_DIRS for x in path.parts) or not allowed_file(path.name):
        raise RuntimeError(f'Forbidden path: {path}')
    if not any(path.is_relative_to(root) for root in roots):
        raise RuntimeError(f'Outside authorized roots: {path}')
    # Do not allow a parent symlink to bypass the authorized roots.
    if path.parent.resolve() != path.parent:
        raise RuntimeError(f'Symlink parent forbidden: {path}')


def build_operations(plan: dict) -> tuple[list[dict], list[dict]]:
    operations, groups = [], []
    for item in plan['projects']:
        source, target = Path(item['source']), Path(item['target'])
        groups.append(item)
        different = {x['file'] for x in item['different']}
        equivalent = {x['file'] for x in item['semantic_or_route_equivalent']}
        source_only = set(item['source_inventory']) - set(item['target_inventory'])
        reference = PROFILE / 'sandbox/referencias' / source.parent.name / (source.name + '-revision-repositorio')
        for relative, expected in sorted(item['source_inventory'].items()):
            path = source / relative
            if relative in different:
                if expected['kind'] != 'file' or not relative.endswith('.json'):
                    raise RuntimeError(f'Unexpected divergent non-JSON: {path}')
                operation = {'kind': 'move', 'reason': 'preserve_divergent_original', 'source': str(path), 'target': str(reference / relative), 'expected_source': expected}
            elif relative in source_only:
                if expected['kind'] == 'symlink':
                    if item.get('project') != 'nodepolitics/atlas-demo' or relative not in {'work/perf/assets/lyrics.json', 'work/perf/assets/storyboard.json', 'work/perf/assets/media'} or not expected['target'].startswith('/home/university/'):
                        raise RuntimeError(f'Unreviewed source-only symlink: {path}')
                    operation = {'kind': 'unlink_obsolete_link', 'reason': 'preserve_link_description_in_journal_without_following', 'source': str(path), 'expected_source': expected}
                else:
                    operation = {'kind': 'move', 'reason': 'preserve_unique_original_in_active_project', 'source': str(path), 'target': str(target / relative), 'expected_source': expected}
            else:
                peer = item['target_inventory'][relative]
                if expected != peer and relative not in equivalent:
                    raise RuntimeError(f'Unclassified content cannot be retired: {path}')
                operation = {'kind': 'retire_duplicate', 'reason': 'byte_equal' if expected == peer else 'reviewed_semantic_or_route_equivalence', 'source': str(path), 'target': str(target / relative), 'expected_source': expected, 'expected_target': peer}
            operations.append(operation)
    for item in plan.get('references', []):
        if not item['exact_inventory_equal'] or item['source_inventory'] != item['target_inventory']:
            raise RuntimeError(f'Reference mismatch: {item["source"]}')
        groups.append(item)
        for relative, expected in sorted(item['source_inventory'].items()):
            operations.append({'kind': 'retire_duplicate', 'reason': 'reference_byte_equal', 'source': str(Path(item['source']) / relative), 'target': str(Path(item['target']) / relative), 'expected_source': expected, 'expected_target': expected})
    for item in plan.get('reference_aliases', []):
        if not item['target_is_other_legacy_reference']:
            raise RuntimeError(f'Unexpected alias: {item["source"]}')
        operations.append({'kind': 'unlink_obsolete_link', 'reason': 'reference_alias_metadata_retained', 'source': item['source'], 'expected_source': {'kind': 'symlink', 'target': item['link_target']}})
    # Preserve originals before retiring any duplicates. Stable ordering enables resume.
    operations.sort(key=lambda x: (0 if x['kind'] == 'move' else 1, x['source']))
    for i, op in enumerate(operations):
        op['id'] = i
        assert_safe(Path(op['source']), (LEGACY,))
        if 'target' in op:
            assert_safe(Path(op['target']), (PROFILE / 'sandbox', PROFILE / 'productions', SERVER / 'src/templates/nodeatlas', SERVER / 'src/templates/nodehistory', SERVER / 'src/templates/nodeeconomy'))
    return operations, groups


def validate_all(groups: list[dict], operations: list[dict]) -> None:
    errors = []
    for group in groups:
        for label in ('source', 'target'):
            root = Path(group[label])
            if inventory(root) != group[label + '_inventory']:
                errors.append(f'{label} inventory changed: {root}')
    for op in operations:
        source = Path(op['source'])
        if spec(source) != op['expected_source']:
            errors.append(f'Source changed: {source}')
        if op['kind'] == 'move':
            target = Path(op['target'])
            if spec(target) is not None:
                errors.append(f'Move destination is occupied: {target}')
            ancestor = target.parent
            while not ancestor.exists():
                ancestor = ancestor.parent
            if source.lstat().st_dev != ancestor.stat().st_dev:
                errors.append(f'Move would cross devices: {source} -> {target}')
        elif op['kind'] == 'retire_duplicate' and spec(Path(op['target'])) != op['expected_target']:
            errors.append(f'Canonical changed: {op["target"]}')
    if errors:
        raise RuntimeError('PREFLIGHT FAILED; no mutations performed:\n' + '\n'.join(errors))


def append_journal(path: Path, event: dict) -> None:
    record = dict(event, timestamp_utc=datetime.now(timezone.utc).isoformat())
    with path.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + '\n')
        stream.flush()
        os.fsync(stream.fileno())


def read_journal(path: Path) -> list[dict]:
    records = []
    for line in path.read_text().splitlines():
        try:
            records.append(json.loads(line))
        except ValueError as exc:
            raise RuntimeError('Journal contains a partial record; preserve it and repair only its last line before resuming') from exc
    return records


def operation_state(op: dict) -> str:
    source = spec(Path(op['source']))
    if op['kind'] == 'move':
        target = spec(Path(op['target']))
        if source == op['expected_source'] and target is None:
            return 'pending'
        if source is None and target == op['expected_source']:
            return 'done'
        if source == op['expected_source'] and target == op['expected_source'] and Path(op['source']).samefile(Path(op['target'])):
            return 'linked_awaiting_source_unlink'
    elif op['kind'] == 'retire_duplicate':
        if spec(Path(op['target'])) != op['expected_target']:
            return 'conflict'
        if source == op['expected_source']:
            return 'pending'
        if source is None:
            return 'done'
    elif op['kind'] == 'unlink_obsolete_link':
        if source == op['expected_source']:
            return 'pending'
        if source is None:
            return 'done'
    return 'conflict'


def validate_resume_inventories(groups: list[dict], operations: list[dict]) -> None:
    states = {op['id']: operation_state(op) for op in operations}
    for group in groups:
        expected_source = dict(group['source_inventory'])
        expected_target = dict(group['target_inventory'])
        source_root, target_root = Path(group['source']), Path(group['target'])
        for op in operations:
            source, state = Path(op['source']), states[op['id']]
            if source.is_relative_to(source_root) and state == 'done':
                expected_source.pop(str(source.relative_to(source_root)), None)
            if op['kind'] == 'move' and state in {'done', 'linked_awaiting_source_unlink'}:
                target = Path(op['target'])
                if target.is_relative_to(target_root):
                    expected_target[str(target.relative_to(target_root))] = op['expected_source']
        if inventory(source_root) != expected_source or inventory(target_root) != expected_target:
            raise RuntimeError(f'Resume inventory changed unexpectedly: {source_root}')


def cleanup_empty_project_dirs(groups: list[dict]) -> None:
    for group in groups:
        root = Path(group['source'])
        if not root.is_dir():
            continue
        safe_directories = []
        for current, directories, files in os.walk(root, topdown=True, followlinks=False):
            directories[:] = [x for x in directories if x not in DENIED_DIRS and not (Path(current) / x).is_symlink()]
            path = Path(current)
            safe_directories.append(path)
        for path in reversed(safe_directories):
            try:
                path.rmdir()  # Only succeeds when empty; never recursive deletion.
            except OSError:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True, type=Path)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--journal', type=Path, default=PROFILE / 'sandbox/referencias/reconciliation-20261113/operations.jsonl')
    args = parser.parse_args()
    plan_bytes = args.plan.read_bytes()
    plan_hash = hashlib.sha256(plan_bytes).hexdigest()
    if plan_hash != args.plan_sha256:
        raise RuntimeError('Plan digest does not match reviewed plan')
    plan = json.loads(plan_bytes)
    if plan.get('applied') or plan.get('mode') != 'READ_ONLY_DRY_RUN':
        raise RuntimeError('Unexpected plan mode')
    operations, groups = build_operations(plan)
    assert_safe(args.journal, (PROFILE / 'sandbox/referencias',))
    counts = {kind: sum(x['kind'] == kind for x in operations) for kind in sorted({x['kind'] for x in operations})}
    print(json.dumps({'mode': 'APPLY' if args.apply else 'DRY_RUN', 'plan_sha256': plan_hash, 'operations': counts}, ensure_ascii=False), flush=True)
    if args.resume:
        if not args.apply or not args.journal.is_file():
            raise RuntimeError('Resume requires --apply and an existing journal')
        records = read_journal(args.journal)
        if not records or records[0].get('event') != 'validated_all' or records[0].get('plan_sha256') != plan_hash:
            raise RuntimeError('Journal does not belong to this validated plan')
        intended = {x['operation']['id'] for x in records if x.get('event') == 'intent'}
        completed = {x['operation_id'] for x in records if x.get('event') == 'done'}
        for op in operations:
            state = operation_state(op)
            if state == 'conflict' or (state in {'done', 'linked_awaiting_source_unlink'} and op['id'] not in intended) or (op['id'] in completed and state != 'done'):
                raise RuntimeError(f'Resume conflict at operation {op["id"]}: {op["source"]}')
        validate_resume_inventories(groups, operations)
    else:
        if args.journal.exists():
            raise RuntimeError('Journal already exists; review it, then use --resume or select a fresh journal')
        validate_all(groups, operations)
        print('PREFLIGHT OK: every source and canonical inventory matches; all moves stay on one filesystem.', flush=True)
        if not args.apply:
            print('No changes applied; no journal created.', flush=True)
            return
        args.journal.parent.mkdir(parents=True, exist_ok=True)
        append_journal(args.journal, {'event': 'validated_all', 'plan_sha256': plan_hash, 'operation_count': len(operations)})
    for op in operations:
        state = operation_state(op)
        if state == 'done':
            continue
        if state not in {'pending', 'linked_awaiting_source_unlink'}:
            raise RuntimeError(f'Concurrent change detected at operation {op["id"]}; stop and resume only after review')
        append_journal(args.journal, {'event': 'intent', 'operation': op})
        source = Path(op['source'])
        if op['kind'] == 'move':
            target = Path(op['target'])
            target.parent.mkdir(parents=True, exist_ok=True)
            assert_safe(target, (PROFILE / 'sandbox', PROFILE / 'productions', SERVER / 'src/templates/nodeatlas', SERVER / 'src/templates/nodehistory', SERVER / 'src/templates/nodeeconomy'))
            if state == 'linked_awaiting_source_unlink':
                if spec(source) != op['expected_source'] or spec(target) != op['expected_source'] or not source.samefile(target):
                    raise RuntimeError(f'Concurrent change before completing linked move: {source}')
                source.unlink()
                append_journal(args.journal, {'event': 'done', 'operation_id': op['id']})
                continue
            if spec(source) != op['expected_source'] or spec(target) is not None:
                raise RuntimeError(f'Concurrent change before move: {source}')
            # link/unlink gives no-overwrite semantics without copying file data.
            os.link(source, target, follow_symlinks=False)
            if spec(target) != op['expected_source'] or spec(source) != op['expected_source']:
                raise RuntimeError(f'Move verification failed; both directory entries retained: {source}')
            source.unlink()
        else:
            if spec(source) != op['expected_source']:
                raise RuntimeError(f'Concurrent change before retirement: {source}')
            if op['kind'] == 'retire_duplicate' and spec(Path(op['target'])) != op['expected_target']:
                raise RuntimeError(f'Canonical changed before retirement: {op["target"]}')
            source.unlink()
        append_journal(args.journal, {'event': 'done', 'operation_id': op['id']})
    cleanup_empty_project_dirs(groups)
    remaining = {item['source']: sorted(inventory(Path(item['source']))) for item in groups if inventory(Path(item['source']))}
    if remaining:
        raise RuntimeError('Unexpected source files remain after processing: ' + json.dumps(remaining))
    append_journal(args.journal, {'event': 'complete', 'plan_sha256': plan_hash, 'operations': counts})
    print('Reconciliation complete; originals preserved at planned operational destinations; journal retained.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
