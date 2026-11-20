"""Read-only verification against synthetic profile metadata."""
import json
import os
from pathlib import Path
import subprocess
import sys

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/verify-profile-migration.py'


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value) if not isinstance(value, str) else value)


def run(root, flag, baseline):
    return subprocess.run([sys.executable, str(SCRIPT), '--profile-dir', str(root), flag, str(baseline)],
                          text=True, capture_output=True, timeout=20)


def test_capture_and_verify_records_media_aliases_and_opaque_directories(tmp_path):
    root, baseline = tmp_path / 'profile', tmp_path / 'baseline.json'
    put(root / 'profile.json', {'id': 'synthetic', 'schema_version': 1})
    put(root / 'data/jobs/jobs.json', [{'job_id': 'j1', 'file_paths': {
        'youtube': str(root / 'output/demo/video.mp4'), 'tiktok': str(root / 'output/missing.mp4')}}])
    put(root / 'data/library/images.json', [{'asset_id': 'asset1', 'relative_path': 'category/image.png'}])
    put(root / 'data/canales/channels.json', [{'platform': 'youtube', 'alias': 'alias1'}])
    put(root / 'data/canales/published_videos.json', [{'platform': 'youtube', 'alias': 'alias1', 'post_id': 'p1'}])
    put(root / 'data/content/video_details/j1.json', {'video_id': 'j1'})
    put(root / 'data/publicaciones/c/p/f/pub1/record.json', {'publication_id': 'pub1'})
    put(root / 'output/demo/video.mp4', 'video')
    put(root / 'data/library/files/images/category/image.png', 'image')
    opaque = {'connections': '.system/connections', 'web-data': '.system/web-data',
              'data/browser_profiles': '.system/browser-profiles', 'tiktok': '.system/tiktok'}
    for src in opaque:
        put(root / src / 'opaque', 'never inspect')
    for rel in ('connections/accounts.json', 'web-data/users.json', 'data/browser_profiles/session.json'):
        put(root / rel, 'synthetic opaque bytes')
        (root / rel).chmod(0)
    captured = run(root, '--capture', baseline)
    assert captured.returncode == 0, captured.stderr
    assert (baseline.stat().st_mode & 0o777) == 0o600
    summary = json.loads(captured.stdout)
    assert summary['raices_opacas'] == 4
    assert summary['referencias_ya_ausentes'] == 1
    assert 'alias1' not in captured.stdout and 'asset1' not in captured.stdout
    original_data = root / 'data'
    original_data.rename(root / 'old-data')
    for src, dst in opaque.items():
        source = (root / 'old-data/browser_profiles') if src == 'data/browser_profiles' else root / src
        target = root / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        source.rename(target)
    (root / 'renders/videos/nodemotion/j1/r1').mkdir(parents=True)
    (root / 'output/demo/video.mp4').rename(root / 'renders/videos/nodemotion/j1/r1/video.mp4')
    (root / 'resources/images/asset1').mkdir(parents=True)
    (root / 'old-data/library/files/images/category/image.png').rename(root / 'resources/images/asset1/image.png')
    put(root / 'profile.json', {'id': 'synthetic', 'schema_version': 3})
    def section(collections=None, documents=None):
        return {'schema_version': 1, 'revision': 1, 'collections': collections or {}, 'documents': documents or {}}
    put(root / 'data/json/jobs.json', section({'jobs': [{'job_id': 'j1', 'file_paths': {
        'youtube': str(root / 'renders/videos/nodemotion/j1/r1/video.mp4'), 'tiktok': str(root / 'output/missing.mp4')}},
        {'job_id': 'new-derived'}]}))
    put(root / 'data/json/channels.json', section({'channels': [{'platform': 'youtube', 'alias': 'alias1'}]}))
    key = 'resources/images/category/image.png'
    put(root / 'data/json/resources.json', section({'image_assets': [{'asset_id': 'asset1', 'relative_path': 'category/image.png'}]},
        {'media_aliases': {'a': {'legacy_key': key, 'storage_key': 'resources/images/asset1/image.png'}}}))
    put(root / 'data/json/videos.json', section(documents={'content_video_details': {'j1': {'video_id': 'j1'}}}))
    put(root / 'data/json/publicaciones.json', section({'published_videos': [{'platform': 'youtube', 'alias': 'alias1', 'post_id': 'p1'}]}, documents={'publications': {'pub1': {'publication_id': 'pub1'}}}))
    result = run(root, '--verify', baseline)
    assert result.returncode == 0, result.stdout + result.stderr
    summary = json.loads(result.stdout)
    assert summary['ids_perdidos'] == summary['referencias_perdidas'] == summary['raices_opacas_perdidas'] == 0
    assert summary['referencias_conservadas'] == 2 and summary['referencias_ya_ausentes'] == 1
    (root / 'resources/images/asset1/image.png').unlink()
    result = run(root, '--verify', baseline)
    assert result.returncode == 1 and json.loads(result.stdout)['referencias_perdidas'] == 1
    put(root / 'data/json/channels.json', section({'channels': []}))
    put(root / 'data/json/publicaciones.json', section({'published_videos': []}, documents={'publications': {'pub1': {'publication_id': 'pub1'}}}))
    result = run(root, '--verify', baseline)
    assert result.returncode == 1 and json.loads(result.stdout)['ids_perdidos'] == 2
    (root / '.system/tiktok').rename(root / '.system/tiktok-old')
    (root / '.system/tiktok').mkdir()
    result = run(root, '--verify', baseline)
    assert result.returncode == 1 and json.loads(result.stdout)['raices_opacas_perdidas'] == 1
    assert not (root / 'data/accounts.json').exists()


def test_rejects_symlink_and_does_not_overwrite_baseline(tmp_path):
    root, baseline = tmp_path / 'profile', tmp_path / 'baseline.json'
    put(root / 'profile.json', {'id': 'synthetic', 'schema_version': 1})
    target = tmp_path / 'target'
    target.mkdir()
    (root / 'connections').symlink_to(target, target_is_directory=True)
    assert run(root, '--capture', baseline).returncode == 2
    assert not baseline.exists()
    (root / 'connections').unlink()
    put(baseline, 'existing')
    assert run(root, '--capture', baseline).returncode == 2
    assert baseline.read_text() == 'existing'


def test_real_offline_migration_round_trip_is_verified(tmp_path):
    root, templates, baseline = tmp_path / 'profile', tmp_path / 'templates', tmp_path / 'baseline.json'
    root.mkdir()
    templates.mkdir()
    put(root / 'profile.json', {'id': 'fixture', 'schema_version': 1, 'providers': {}})
    output = root / 'output/node_motion/letras/job1'
    put(output / 'index.html', '<audio src="song.mp3"></audio>')
    put(output / 'song.mp3', 'synthetic')
    put(output / 'youtube_video.mp4', 'synthetic')
    put(root / 'data/jobs/jobs.json', [{'job_id': 'job1', 'category': 'lyrics_video_caution',
         'source': 'pipeline', 'output_dir': str(output), 'file_paths': {'youtube': str(output / 'youtube_video.mp4')}}])
    put(root / 'connections/opaque', 'never read')
    assert run(root, '--capture', baseline).returncode == 0
    migrator = SCRIPT.parent / 'migrate-profile-layout.py'
    env = {'PATH': os.environ['PATH'], 'HOME': str(tmp_path), 'XDG_CONFIG_HOME': str(tmp_path / 'xdg'), 'NEXA_PROFILE': ''}
    common = [sys.executable, str(migrator), '--profile-dir', str(root), '--templates-dir', str(templates), '--target-version', '3']
    prepared = subprocess.run(common + ['--local-prepare', '--confirm-maintenance', '--confirm-templates-owned'],
                              env=env, capture_output=True, text=True, timeout=40)
    assert prepared.returncode == 0, prepared.stderr
    ident = next(line.split('=', 1)[1] for line in prepared.stdout.splitlines() if line.startswith('migration_id='))
    active = subprocess.run(common + ['--local-activate', '--migration-id', ident, '--confirm-maintenance'],
                            env=env, capture_output=True, text=True, timeout=40)
    assert active.returncode == 0, active.stderr
    verified = run(root, '--verify', baseline)
    assert verified.returncode == 0, verified.stdout + verified.stderr
    assert json.loads(verified.stdout)['referencias_conservadas'] == 2


def test_category_path_is_not_a_filesystem_reference_even_in_old_baseline(tmp_path):
    root, baseline = tmp_path / 'profile', tmp_path / 'baseline.json'
    put(root / 'profile.json', {'id': 'fixture', 'schema_version': 1})
    put(root / 'data/explainer/productions.json', [{'production_id': 'p1', 'category_path': 'node_tech'}])
    (root / 'node_tech').mkdir()
    assert run(root, '--capture', baseline).returncode == 0
    value = json.loads(baseline.read_text())
    assert not value['references']
    ident = value['record_ids']['explainer_productions'][0]
    value['references'].append({'namespace': 'explainer_productions', 'id': ident, 'pointer': ['category_path'],
                                'ref': 'node_tech', 'existed': True})
    put(baseline, value)
    put(root / 'profile.json', {'id': 'fixture', 'schema_version': 3})
    put(root / 'data/json/videos.json', {'schema_version': 1, 'revision': 1,
        'collections': {'explainer_productions': [{'production_id': 'p1', 'category_path': 'node_tech'}]}, 'documents': {}})
    (root / 'node_tech').rmdir()
    result = run(root, '--verify', baseline)
    assert result.returncode == 0, result.stdout + result.stderr
    summary = json.loads(result.stdout)
    assert summary['referencias_perdidas'] == 0 and summary['referencias_semanticas_ignoradas'] == 1
