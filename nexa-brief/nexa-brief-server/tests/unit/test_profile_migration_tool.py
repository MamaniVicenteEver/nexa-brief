"""Migration tool tests use synthetic profiles only."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/migrate-profile-layout.py'


@pytest.fixture
def source(tmp_path):
    profile, templates = tmp_path / 'profile', tmp_path / 'templates'
    profile.mkdir()
    templates.mkdir()
    (profile / 'profile.json').write_text('{"schema_version": 1, "id": "fixture"}')
    files = {
        profile / 'data/library/files/music/songs/one.mp3': b'audio',
        profile / 'data/publicaciones/cat/post/slide.jpg': b'image',
        profile / 'data/publicaciones/cat/post/record.json': b'{"publication":1}',
        profile / 'data/model-calls/one.json': b'{}',
        profile / 'data/media-cache/reel_music/catalog.json': b'{}',
        profile / 'data/media-cache/reel_music/track.mp3': b'licensed-audio',
        profile / 'data/sandbox-thumbs/a.png': b'cache',
        profile / 'data/runtime/events.json': b'transient',
        templates / 'history/episode/brief.json': b'{}',
        templates / 'history/muestras/example/brief.json': b'{}',
        templates / 'history/episode/accounts.json': b'credential',
        templates / 'sandbox/design/example.html': b'<p>sample</p>',
    }
    for path, body in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    return profile, templates


def run(profile, templates, *args):
    return subprocess.run([sys.executable, str(SCRIPT), '--profile-dir', str(profile), '--templates-dir', str(templates), *args],
                          capture_output=True, text=True, timeout=20)


def test_plan_is_read_only_and_apply_verifies_without_removing_sources(source):
    profile, templates = source
    before = set(p.relative_to(profile) for p in profile.rglob('*'))
    plan = run(profile, templates)
    assert plan.returncode == 0
    assert 'plan solamente' in plan.stdout
    assert 'accounts.json' not in plan.stdout and 'credential' not in plan.stdout
    assert set(p.relative_to(profile) for p in profile.rglob('*')) == before
    denied = run(profile, templates, '--apply')
    assert denied.returncode != 0 and '--confirm-maintenance' in denied.stderr
    applied = run(profile, templates, '--apply', '--confirm-maintenance', '--confirm-templates-owned')
    assert applied.returncode == 0, applied.stderr
    assert (profile / 'resources/music/songs/one.mp3').read_bytes() == b'audio'
    assert (profile / 'data/library/files/music/songs/one.mp3').read_bytes() == b'audio'
    assert (profile / 'productions/_publicaciones/cat/post/slide.jpg').read_bytes() == b'image'
    assert (profile / 'data/publicaciones/cat/post/record.json').exists()
    assert not (profile / 'productions/_publicaciones/cat/post/record.json').exists()
    assert (profile / 'productions/history/episode/brief.json').exists()
    assert not (profile / 'productions/history/muestras').exists()
    assert not (profile / 'productions/history/episode/accounts.json').exists()
    assert (profile / 'sandbox/design/example.html').exists()
    assert (profile / 'logs/model-calls/one.json').exists()
    assert (profile / 'resources/reel_music/track.mp3').read_bytes() == b'licensed-audio'
    assert (profile / 'data/media-cache/reel_music/catalog.json').exists()
    assert not (profile / 'resources/reel_music/catalog.json').exists()
    assert (profile / '.system/cache/sandbox-thumbs/a.png').exists()
    assert not (profile / '.system/runtime/events.json').exists()
    assert json.loads((profile / 'profile.json').read_text())['schema_version'] == 1
    manifests = list((profile / '.system/migrations').glob('*/manifest.json'))
    assert len(manifests) == 1
    manifest = json.loads(manifests[0].read_text())
    assert manifest['state'] == 'prepared'
    assert all(item['state'] == 'created' and len(item['sha256']) == 64 for item in manifest['files'])
    collision = run(profile, templates, '--apply', '--confirm-maintenance', '--confirm-templates-owned')
    assert collision.returncode != 0
    assert len(list((profile / '.system/migrations').glob('*/manifest.json'))) == 1


def test_symlink_is_rejected_without_changing_target(source, tmp_path):
    profile, templates = source
    outside = tmp_path / 'outside.mp3'
    outside.write_bytes(b'untouched')
    (profile / 'data/library/files/music/songs/escape.mp3').symlink_to(outside)
    result = run(profile, templates, '--apply', '--confirm-maintenance', '--confirm-templates-owned')
    assert result.returncode != 0 and 'symlink' in result.stderr
    assert outside.read_bytes() == b'untouched'
    assert not (profile / '.system').exists()


def test_v2_profile_and_overlapping_roots_are_rejected(source):
    profile, templates = source
    (profile / 'profile.json').write_text('{"schema_version": 2, "id": "fixture"}')
    assert run(profile, templates).returncode != 0
    (profile / 'profile.json').write_text('{"schema_version": 1, "id": "fixture"}')
    assert run(profile, profile).returncode != 0
