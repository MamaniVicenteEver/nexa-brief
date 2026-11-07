"""Synthetic end-to-end rehearsal for legacy pipeline output in schema 3."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/migrate-profile-layout.py'


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def invoke(root, templates, *args):
    env = {'PATH': os.environ['PATH'], 'HOME': str(root.parent),
           'XDG_CONFIG_HOME': str(root.parent / 'xdg'), 'NEXA_PROFILE': ''}
    return subprocess.run([sys.executable, str(SCRIPT), '--profile-dir', str(root),
                           '--templates-dir', str(templates), '--target-version', '3', *args],
                          env=env, text=True, capture_output=True, timeout=45)


def seed(tmp_path):
    root, templates = tmp_path / 'profile', tmp_path / 'templates'
    root.mkdir()
    templates.mkdir()
    write(root / 'profile.json', b'{"id":"fixture","schema_version":1,"providers":{}}')
    # The profile's configuration has priority over versioned or selected defaults.
    write(root / 'config/niches.json', json.dumps({'categories': {'node_motion': {
        'folder': 'nodemotion', 'children': {'letras': {'niches': ['custom_song']}}}}}).encode())
    output = root / 'output/node_motion/letras/job1'
    files = {'index.html': b'<audio src="song.mp3"></audio><video src="assets/final.mp4"></video><video src="input_video.mp4"></video><video src=youtube_video.mp4></video>', 'song.mp3': b'audio',
             'style.css': b'.master{background:url(youtube_video.mp4)} .input{background:url(input_video.mp4)}', 'assets/background.png': b'background', 'assets/final.mp4': b'input-clip', 'input_video.mp4': b'root-input', 'youtube_video.mp4': b'video'}
    for name, data in files.items():
        write(output / name, data)
    job = {'job_id': 'job1', 'category': 'custom_song', 'source': 'pipeline',
           'stage': 'packaged', 'output_dir': str(output),
           'file_paths': {'youtube': str(output / 'youtube_video.mp4'), 'reels': str(output / 'youtube_video.mp4')},
           'format_paths': {'16x9': str(output / 'youtube_video.mp4')}}
    write(root / 'data/jobs/jobs.json', json.dumps([job]).encode())
    return root, templates, output, files, job


def test_pipeline_sources_master_aliases_and_rollback(tmp_path):
    root, templates, output, files, original_job = seed(tmp_path)
    legacy_resource = {'asset_id': 'legacy-resource', 'video_id': 'job1', 'kind': 'video',
                       'storage_key': 'renders/node_motion/letras/job1/youtube_video.mp4'}
    write(root / 'data/content/resources.json', json.dumps([legacy_resource]).encode())
    prepared = invoke(root, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert prepared.returncode == 0, prepared.stderr
    ident = next(x.split('=', 1)[1] for x in prepared.stdout.splitlines() if x.startswith('migration_id='))
    assert output.is_dir()  # preparation is read-only against source
    activated = invoke(root, templates, '--local-activate', '--migration-id', ident, '--confirm-maintenance')
    assert activated.returncode == 0, activated.stderr
    jobs = json.loads((root / 'data/json/jobs.json').read_text())['collections']['jobs']
    job = jobs[0]
    assert (job['job_id'], job['category']) == ('job1', 'custom_song')
    production = root / 'productions/nodemotion/job1'
    assert job['output_dir'] == str(production)
    for name in ('song.mp3', 'assets/background.png', 'assets/final.mp4', 'input_video.mp4'):
        assert (production / name).read_bytes() == files[name]
    html = (production / 'index.html').read_text()
    assert 'src="song.mp3"' in html and 'src="assets/final.mp4"' in html
    assert 'src=/api/v1/explainer/files/renders/videos/nodemotion/job1/' in html
    css = (production / 'style.css').read_text()
    assert 'url(/api/v1/explainer/files/renders/videos/nodemotion/job1/' in css
    assert 'url(input_video.mp4)' in css
    master = Path(job['file_paths']['youtube'])
    assert master.is_relative_to(root / 'renders/videos/nodemotion/job1')
    assert master.name == 'video.mp4' and master.read_bytes() == files['youtube_video.mp4']
    resources = json.loads((root / 'data/json/resources.json').read_text())['collections']['content_resources']
    migrated_resource = next(row for row in resources if row['asset_id'] == 'legacy-resource')
    assert migrated_resource['storage_key'] == master.relative_to(root).as_posix()
    assert job['file_paths']['reels'] == str(master) == job['format_paths']['16x9']
    sections = json.loads((root / 'data/json/resources.json').read_text())
    aliases = sections['documents']['legacy_path_aliases']
    alias = aliases[hashlib.sha256(str(output).encode()).hexdigest()]
    assert alias['storage_key'] == str(production)
    docker_alias = '/app/output/node_motion/letras/job1'
    assert aliases[hashlib.sha256(docker_alias.encode()).hexdigest()]['storage_key'] == str(production)
    assert aliases[hashlib.sha256(str(output / 'song.mp3').encode()).hexdigest()]['storage_key'] == str(production / 'song.mp3')
    videos = json.loads((root / 'data/json/videos.json').read_text())['collections']['content_videos']
    assert any(v['video_id'] == 'job1' and v['production_id'] == 'job1' for v in videos)
    rolled = invoke(root, templates, '--local-rollback', '--migration-id', ident,
                    '--confirm-maintenance', '--confirm-no-v2-writes')
    assert rolled.returncode == 0, rolled.stderr
    assert json.loads((root / 'data/jobs/jobs.json').read_text()) == [original_job]
    for name, data in files.items():
        assert (output / name).read_bytes() == data


def test_multiple_jobs_cannot_claim_same_output_directory(tmp_path):
    root, templates, output, _, job = seed(tmp_path)
    write(root / 'data/jobs/jobs.json', json.dumps([job, {**job, 'job_id': 'job2'}]).encode())
    result = invoke(root, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert result.returncode != 0
    assert 'varios jobs' in result.stderr
    assert (output / 'index.html').is_file()
    assert json.loads((root / 'profile.json').read_text())['schema_version'] == 1


def test_legacy_draft_sources_and_provenance_survive_activation_and_rollback(tmp_path):
    root, templates, _, _, _ = seed(tmp_path)
    (root / 'data/jobs/jobs.json').unlink()
    old_server = '/home/former/nexa-brief-server'
    old_dir = old_server + '/output/node_motion/letras/draft1'
    draft = {'job_id': 'draft1', 'stage': 'failed', 'input': {'category_name': 'custom_song'},
             'artifacts': {'output_dir': old_dir, 'music_path': old_dir + '/song.mp3',
                           'html_path': old_dir + '/index.html',
                           'youtube_video_path': old_dir + '/youtube_video.mp4'}}
    write(root / 'data/studio/draft_jobs/d1.json', json.dumps(draft).encode())
    old_missing = old_server + '/output/node_motion/letras/draft2'
    failed = {'job_id': 'draft2', 'stage': 'failed', 'input': {'category_name': 'custom_song'},
              'artifacts': {'output_dir': old_missing, 'youtube_video_path': old_missing + '/missing.mp4'}}
    write(root / 'data/studio/draft_jobs/d2.json', json.dumps(failed).encode())
    write(root / 'output/node_motion/letras/draft2/index.html', b'failed draft')
    source = root / 'output/node_motion/letras/draft1'
    write(source / 'index.html', b'<audio src="song.mp3"></audio>')
    write(source / 'song.mp3', b'audio')
    write(source / 'youtube_video.mp4', b'video')
    write(templates / 'sandbox/nodehistory/demo/index.html', b'fixture')
    diagnostic = {'old_template': old_server + '/src/templates/sandbox/nodehistory/demo/index.html',
                  'trace': '/tmp/old-review-capture.png'}
    write(templates / 'sandbox/nodehistory/demo/review/history.json', json.dumps(diagnostic).encode())
    args = ('--legacy-server-root', old_server)
    verifier = SCRIPT.parent / 'verify-profile-migration.py'
    baseline = tmp_path / 'baseline.json'
    captured = subprocess.run([sys.executable, str(verifier), '--profile-dir', str(root), '--legacy-server-root',
                               old_server, '--capture', str(baseline)], text=True, capture_output=True, timeout=20)
    assert captured.returncode == 0, captured.stderr
    assert json.loads(captured.stdout)['referencias_base'] >= 4
    prepared = invoke(root, templates, *args, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert prepared.returncode == 0, prepared.stderr
    ident = next(x.split('=', 1)[1] for x in prepared.stdout.splitlines() if x.startswith('migration_id='))
    journal = json.loads((root / '.system/migrations' / ident / 'journal.json').read_text())
    assert len(journal['external_provenance']) == 1
    assert journal['external_provenance'][0]['state'] == 'external_unresolved'
    assert invoke(root, templates, '--local-activate', '--migration-id', ident, '--confirm-maintenance').returncode == 0
    data = json.loads((root / 'data/json/videos.json').read_text())
    migrated = data['documents']['draft_jobs']['d1']
    production = root / 'productions/nodemotion/draft1'
    assert migrated['job_id'] == 'draft1' and migrated['stage'] == 'failed'
    assert migrated['artifacts']['output_dir'] == str(production)
    assert data['documents']['draft_jobs']['d2']['stage'] == 'failed'
    assert not any(row['video_id'] == 'draft2' for row in data['collections'].get('content_videos', []))
    assert Path(migrated['artifacts']['music_path']).read_bytes() == b'audio'
    assert Path(migrated['artifacts']['html_path']).read_bytes() == b'<audio src="song.mp3"></audio>'
    master = Path(migrated['artifacts']['youtube_video_path'])
    assert master.is_relative_to(root / 'renders/videos/nodemotion/draft1') and master.read_bytes() == b'video'
    assert not json.loads((root / 'data/json/jobs.json').read_text())['collections'].get('jobs')
    review = json.loads((root / 'sandbox/nodehistory/demo/review/history.json').read_text())
    assert review == {'old_template': str(root / 'sandbox/nodehistory/demo/index.html'),
                      'trace': '/tmp/old-review-capture.png'}
    verified = subprocess.run([sys.executable, str(verifier), '--profile-dir', str(root), '--verify', str(baseline)],
                              text=True, capture_output=True, timeout=20)
    assert verified.returncode == 0, verified.stdout + verified.stderr
    rolled = invoke(root, templates, '--local-rollback', '--migration-id', ident,
                    '--confirm-maintenance', '--confirm-no-v2-writes')
    assert rolled.returncode == 0, rolled.stderr
    assert json.loads((root / 'data/studio/draft_jobs/d1.json').read_text()) == draft
    assert (source / 'youtube_video.mp4').read_bytes() == b'video'


def test_legacy_roots_are_explicit_and_unresolved_live_files_fail_closed(tmp_path):
    from scripts.profile_local_migration import rewrite, validate_legacy_roots
    root, templates = tmp_path / 'profile', tmp_path / 'templates'
    root.mkdir()
    templates.mkdir()
    old = '/home/former/nexa-brief-server'
    assert validate_legacy_roots([old]) == (old,)
    assert rewrite(old + '/output/job/file.mp4', root, {'output': 'renders'}, templates,
                   legacy_roots=(old,)) == str(root / 'renders/job/file.mp4')
    import pytest
    with pytest.raises(ValueError):
        validate_legacy_roots(['/home/former/../nexa-brief-server'])
    with pytest.raises(ValueError):
        validate_legacy_roots(['/home'])
    with pytest.raises(ValueError):
        rewrite('/home/not-authorized/output/file.mp4', root, {}, templates, legacy_roots=(old,))
    with pytest.raises(ValueError):
        rewrite(old + '/output/../secret', root, {}, templates, legacy_roots=(old,))


def test_v3_preserves_vision_and_lyrics_documents_and_rollback(tmp_path):
    root, templates, _, _, _ = seed(tmp_path)
    expected = {'image_vision': {'caption': 'synthetic'},
                'video_vision': {'description': 'synthetic'}, 'lyrics': {'text': 'synthetic'}}
    for namespace, document in expected.items():
        write(root / 'data/library/cache' / namespace / 'document-1.json', json.dumps(document).encode())
    write(root / 'data/library/cache/other/cache.bin', b'cached')
    verifier = SCRIPT.parent / 'verify-profile-migration.py'
    baseline = tmp_path / 'baseline.json'
    captured = subprocess.run([sys.executable, str(verifier), '--profile-dir', str(root), '--capture', str(baseline)],
                              capture_output=True, text=True, timeout=20)
    assert captured.returncode == 0, captured.stderr
    prepared = invoke(root, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert prepared.returncode == 0, prepared.stderr
    ident = next(x.split('=', 1)[1] for x in prepared.stdout.splitlines() if x.startswith('migration_id='))
    assert invoke(root, templates, '--local-activate', '--migration-id', ident, '--confirm-maintenance').returncode == 0
    documents = json.loads((root / 'data/json/resources.json').read_text())['documents']
    for namespace, document in expected.items():
        assert documents[namespace]['document-1'] == document
    assert (root / '.system/cache/library/other/cache.bin').read_bytes() == b'cached'
    verified = subprocess.run([sys.executable, str(verifier), '--profile-dir', str(root), '--verify', str(baseline)],
                              capture_output=True, text=True, timeout=20)
    assert verified.returncode == 0, verified.stdout + verified.stderr
    assert invoke(root, templates, '--local-rollback', '--migration-id', ident, '--confirm-maintenance',
                  '--confirm-no-v2-writes').returncode == 0
    for namespace, document in expected.items():
        assert json.loads((root / 'data/library/cache' / namespace / 'document-1.json').read_text()) == document


def test_explainer_job_directory_points_to_existing_production_and_preserves_master(tmp_path):
    root, templates, output, _, job = seed(tmp_path)
    write(templates / 'nodemotion/video1/index.html', b'<html>owned production</html>')
    write(templates / 'nodemotion/video1/manifest.json', b'{"status":"ready"}')
    job.update({'source': 'explainer', 'video_id': 'video1'})
    write(root / 'data/jobs/jobs.json', json.dumps([job]).encode())
    write(root / 'data/explainer/productions.json', json.dumps([{
        'video_id': 'video1', 'production_id': 'production1', 'folder': 'nodemotion',
        'category_path': 'node_motion', 'state': 'ready'}]).encode())
    result = invoke(root, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert result.returncode == 0, result.stderr
    ident = next(x.split('=', 1)[1] for x in result.stdout.splitlines() if x.startswith('migration_id='))
    assert invoke(root, templates, '--local-activate', '--migration-id', ident, '--confirm-maintenance').returncode == 0
    record = json.loads((root / 'data/json/jobs.json').read_text())['collections']['jobs'][0]
    assert record['output_dir'] == str(root / 'productions/nodemotion/video1')
    assert Path(record['output_dir'], 'index.html').read_bytes() == b'<html>owned production</html>'
    assert Path(record['file_paths']['youtube']).read_bytes() == b'video'
    assert invoke(root, templates, '--local-rollback', '--migration-id', ident, '--confirm-maintenance',
                  '--confirm-no-v2-writes').returncode == 0
    assert output.is_dir()


def test_empty_pipeline_output_remains_addressable(tmp_path):
    root, templates, _, _, job = seed(tmp_path)
    empty = root / 'output/node_motion/letras/empty'
    empty.mkdir(parents=True)
    job.update({'job_id': 'empty', 'output_dir': str(empty), 'file_paths': {}, 'format_paths': {}})
    write(root / 'data/jobs/jobs.json', json.dumps([job]).encode())
    result = invoke(root, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert result.returncode == 0, result.stderr
    ident = next(x.split('=', 1)[1] for x in result.stdout.splitlines() if x.startswith('migration_id='))
    assert invoke(root, templates, '--local-activate', '--migration-id', ident, '--confirm-maintenance').returncode == 0
    migrated = json.loads((root / 'data/json/jobs.json').read_text())['collections']['jobs'][0]
    assert Path(migrated['output_dir']).is_dir()
    assert invoke(root, templates, '--local-rollback', '--migration-id', ident, '--confirm-maintenance',
                  '--confirm-no-v2-writes').returncode == 0
    assert empty.is_dir()
