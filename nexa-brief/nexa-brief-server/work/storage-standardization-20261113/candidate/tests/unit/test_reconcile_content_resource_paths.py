import hashlib
import json
from pathlib import Path
import subprocess
import sys

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/reconcile-content-resource-paths.py'


def run(root, *args):
    return subprocess.run([sys.executable, str(SCRIPT), '--profile-dir', str(root), *args],
                          capture_output=True, text=True, timeout=15)


def test_plan_apply_backup_cas_and_preserve_unrelated_records(tmp_path):
    root = tmp_path / 'profile'
    section = root / 'data/json/resources.json'
    section.parent.mkdir(parents=True)
    (root / 'profile.json').write_text('{"schema_version":3}')
    old = 'renders/legacy/clip.mp4'
    new = root / 'renders/videos/nodetech/v1/r1/16x9/video.mp4'
    new.parent.mkdir(parents=True)
    new.write_bytes(b'synthetic')
    existing = root / 'productions/v1/image.jpg'
    existing.parent.mkdir(parents=True)
    existing.write_bytes(b'image')
    record = {'asset_id': 'a1', 'video_id': 'v1', 'kind': 'video', 'storage_key': old}
    other = {'asset_id': 'a2', 'video_id': 'v1', 'kind': 'image', 'storage_key': 'productions/v1/image.jpg'}
    original = {'schema_version': 1, 'revision': 3, 'collections': {'content_resources': [record, other]},
                'documents': {'legacy_path_aliases': {hashlib.sha256(old.encode()).hexdigest():
                    {'legacy_key': old, 'storage_key': str(new)}}, 'other': {'a': {'x': 1}}}}
    section.write_text(json.dumps(original))
    baseline = section.read_bytes()
    planned = run(root)
    assert planned.returncode == 0, planned.stderr
    plan = json.loads(planned.stdout)
    assert plan['candidatos'] == 1 and plan['sin_resolver'] == 0 and not plan['aplicado']
    assert section.read_bytes() == baseline
    rejected = run(root, '--apply', '--confirm-maintenance', '--expected-count', '1', '--expected-sha256', 'incorrect')
    assert rejected.returncode == 2 and section.read_bytes() == baseline
    applied = run(root, '--apply', '--confirm-maintenance', '--expected-count', '1', '--expected-sha256', plan['section_sha256'])
    assert applied.returncode == 0, applied.stderr
    result = json.loads(applied.stdout)
    assert Path(result['backup']).read_bytes() == baseline
    saved = json.loads(section.read_text())
    assert saved['revision'] == 4
    assert saved['collections']['content_resources'] == [{**record, 'storage_key': new.relative_to(root).as_posix()}, other]
    assert saved['documents'] == original['documents']
    assert json.loads(run(root).stdout)['candidatos'] == 0


def test_rejects_alias_to_outside_or_symlink_without_modifying_section(tmp_path):
    root = tmp_path / 'profile'
    section = root / 'data/json/resources.json'
    section.parent.mkdir(parents=True)
    (root / 'profile.json').write_text('{"schema_version":3}')
    old = 'renders/legacy/clip.mp4'
    record = {'asset_id': 'a1', 'storage_key': old}
    data = {'schema_version': 1, 'revision': 1, 'collections': {'content_resources': [record]},
            'documents': {'legacy_path_aliases': {hashlib.sha256(old.encode()).hexdigest():
                {'legacy_key': old, 'storage_key': str(tmp_path / 'outside.mp4')}}}}
    section.write_text(json.dumps(data))
    assert run(root).returncode == 2
    assert json.loads(section.read_text()) == data
    (root / 'renders').mkdir()
    (root / 'renders/link').symlink_to(tmp_path, target_is_directory=True)
    data['documents']['legacy_path_aliases'][hashlib.sha256(old.encode()).hexdigest()]['storage_key'] = 'renders/link/outside.mp4'
    section.write_text(json.dumps(data))
    assert run(root).returncode == 2
    assert json.loads(section.read_text()) == data
