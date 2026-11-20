"""Recovery regressions using only temporary stores and synthetic sessions."""
import asyncio
import fcntl
import json
import os
import subprocess
import tarfile
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.browser_playwright import session
from nexa_tiktok.adapters.browser_playwright.comment import comment_is_visible
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.main import create_app
from nexa_tiktok.services.jobs import Jobs


def test_restore_endpoint_cannot_roll_back_good_data(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'synthetic')
    store = JsonStore(tmp_path)
    store.put_videos('test', [{'id': '1'}])
    store.put_videos('test', [{'id': '2'}])
    backup = store.list_backups()[0]
    with TestClient(create_app(store, object())) as client:
        assert client.post('/v1/backups/restore', json=backup).status_code == 401
        result = client.post('/v1/backups/restore', json=backup, headers={'X-Nexa-Tiktok-Key': 'synthetic'})
        assert result.status_code == 409
        assert result.json()['error']['code'] == 'restore_conflict'
    assert store.get_videos('test') == [{'id': '2'}]


def test_recovery_interruption_keeps_durable_barrier(tmp_path, monkeypatch):
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test', 'label': 'saved'})
    store.put_account('test', {'alias': 'test', 'label': 'latest'})
    (tmp_path / 'accounts/test/account.json').write_text('{')
    monkeypatch.setattr(store, '_write', lambda *a, **kw: (_ for _ in ()).throw(OSError('synthetic crash')))
    with pytest.raises(OSError):
        store.get_account('test')
    restarted = JsonStore(tmp_path)
    assert 'accounts/test/account.json' in restarted.degraded
    assert restarted.get_account('test')['label'] == 'saved'
    assert not restarted.degraded
    assert not list((tmp_path / 'quarantine').rglob('*.unresolved'))


def test_failed_backup_flush_preserves_live_file_and_removes_partial_copy(tmp_path, monkeypatch):
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test', 'label': 'good'})
    fsync = os.fsync

    def failed_flush(fd):
        raise OSError('synthetic backup flush failure')

    monkeypatch.setattr(os, 'fsync', failed_flush)
    with pytest.raises(OSError):
        store.put_account('test', {'alias': 'test', 'label': 'new'})
    monkeypatch.setattr(os, 'fsync', fsync)
    assert store.get_account('test')['label'] == 'good'
    assert not store.list_backups()
    store.put_account('test', {'alias': 'test', 'label': 'new'})
    copies = [path for path in (tmp_path / 'backups').rglob('*.json') if path.is_file()]
    assert copies and all(copy.stat().st_mode & 0o777 == 0o600 for copy in copies)


def test_restart_after_replacement_before_marker_cleanup_preserves_review(tmp_path, monkeypatch):
    store = JsonStore(tmp_path)
    job = {'id': 'job1', 'alias': 'test', 'kind': 'publish', 'state': 'queued', 'idempotency_key': 'key'}
    store.put_job(job)
    store.put_job({**job, 'state': 'clicked'})
    (tmp_path / 'jobs/job1.json').write_text('{')

    def interrupted_cleanup(path):
        raise OSError('synthetic crash after replacement')

    monkeypatch.setattr(store, '_resolved', interrupted_cleanup)
    with pytest.raises(OSError):
        store.get_job('job1')
    restarted = JsonStore(tmp_path)
    assert restarted.get_job('job1')['state'] == 'needs_review'
    assert not restarted.degraded
    same, created = restarted.create_job({**job, 'id': 'job2'})
    assert not created
    assert same['id'] == 'job1'


def test_other_store_instance_cannot_erase_unresolved_account_or_job(tmp_path):
    first, other = JsonStore(tmp_path), JsonStore(tmp_path)
    first.put_account('test', {'alias': 'test'})
    first.put_job({'id': 'lost', 'state': 'queued', 'idempotency_key': 'original'})
    (tmp_path / 'accounts/test/account.json').write_text('{')
    (tmp_path / 'jobs/lost.json').write_text('{')
    with pytest.raises(RuntimeError):
        other.get_account('test')
    other.list_jobs()
    with pytest.raises(RuntimeError):
        first.put_account('test', {'alias': 'test'})
    with pytest.raises(RuntimeError):
        first.create_job({'id': 'new', 'state': 'queued', 'idempotency_key': 'original'})


async def test_state_rotation_is_private_atomic_and_preserves_valid_previous(tmp_path, monkeypatch):
    key = Fernet.generate_key()
    monkeypatch.setattr(settings, 'nexa_tiktok_data_dir', tmp_path)
    monkeypatch.setattr(settings, 'nexa_tiktok_encryption_key', key.decode())
    context = SimpleNamespace(storage_state=AsyncMock(return_value={'cookies': [], 'origins': []}))
    modes = []
    replace = os.replace

    def inspect_replace(source, target):
        modes.append(Path(source).stat().st_mode & 0o777)
        replace(source, target)

    monkeypatch.setattr(session.os, 'replace', inspect_replace)
    path = await session.export_state('test', context)
    original = path.read_bytes()
    await session.export_state('test', context)
    previous = path.with_suffix('.enc.previous')
    assert previous.read_bytes() == original
    path.write_bytes(b'corrupt synthetic state')
    await session.export_state('test', context)
    assert previous.read_bytes() == original
    assert json.loads(Fernet(key).decrypt(path.read_bytes())) == {'cookies': [], 'origins': []}
    assert modes and set(modes) == {0o600}
    assert not list(path.parent.glob('.state-*'))


async def test_missing_profile_uses_previous_when_latest_state_is_corrupt(tmp_path, monkeypatch):
    key = Fernet.generate_key()
    monkeypatch.setattr(settings, 'nexa_tiktok_data_dir', tmp_path)
    monkeypatch.setattr(settings, 'nexa_tiktok_encryption_key', key.decode())
    path = session.state_path('test')
    path.parent.mkdir(parents=True)
    path.write_bytes(b'corrupt synthetic state')
    cookies = [{'name': 'synthetic', 'value': 'test', 'domain': '.tiktok.com', 'path': '/'}]
    path.with_suffix('.enc.previous').write_bytes(Fernet(key).encrypt(json.dumps({'cookies': cookies}).encode()))
    context = SimpleNamespace(add_cookies=AsyncMock())

    @asynccontextmanager
    async def opened(alias):
        yield context

    monkeypatch.setattr(session, 'open_browser', opened)
    monkeypatch.setattr(session, 'export_state', AsyncMock())
    assert await session.restore_state('test')
    context.add_cookies.assert_awaited_once_with(cookies)


def test_comment_evidence_requires_the_entire_text():
    assert comment_is_visible('Hola mundo', ' Hola\n mundo ')
    assert not comment_is_visible('Hola', 'Otra cosa\nHola\nResponder')
    assert not comment_is_visible('', '')


async def test_supervisor_survives_store_failure_after_click_without_replay(tmp_path, monkeypatch):
    store = JsonStore(tmp_path)
    calls = []

    async def perform(job, before_click):
        calls.append(job['id'])
        await before_click()
        return {'verified': True}

    jobs = Jobs(store, store, SimpleNamespace(perform=perform, sync=AsyncMock(return_value=[])))
    first = jobs.create('test', 'comment', {}, 'one')
    second = jobs.create('test', 'comment', {}, 'two')
    put = store.put_job
    failures = []

    def fail_final_write(job):
        if job['id'] == first['id'] and job['state'] == 'done' and not failures:
            failures.append(True)
            raise OSError('synthetic temporary store failure')
        put(job)

    monkeypatch.setattr(store, 'put_job', fail_final_write)
    await jobs.start()
    try:
        async with asyncio.timeout(4):
            while store.get_job(second['id'])['state'] != 'done':
                await asyncio.sleep(.02)
        await asyncio.wait_for(jobs.queue.join(), 1)
        assert not jobs.task.done()
        assert store.get_job(first['id'])['state'] == 'needs_review'
        assert calls == [first['id'], second['id']]
    finally:
        await jobs.stop()


def test_full_backup_restore_and_safety_guards(tmp_path):
    scripts = Path(__file__).resolve().parents[1] / 'scripts'
    data = tmp_path / 'data'
    data.mkdir()
    (data / 'synthetic.json').write_text('{"synthetic": true}')
    (data / 'synthetic.json').chmod(0o777)
    (data / 'jobs').mkdir()
    for state in ('queued', 'running', 'clicked', 'done'):
        (data / f'jobs/{state}.json').write_text(json.dumps({'id': state, 'state': state}))
    env = dict(os.environ, NEXA_TIKTOK_DATA_DIR=str(data))
    dest = tmp_path / 'backups'
    with (data / '.service.lock').open('w') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        blocked = subprocess.run([str(scripts / 'backup.sh'), str(dest)], env=env, capture_output=True, check=False)
        assert blocked.returncode != 0
        assert not list(dest.glob('*.tar.gz'))
    nested = subprocess.run([str(scripts / 'backup.sh'), str(data / 'nested')], env=env, capture_output=True, check=False)
    assert nested.returncode != 0
    result = subprocess.run([str(scripts / 'backup.sh'), str(dest)], env=env, capture_output=True, text=True, check=True)
    archive = Path(result.stdout.strip())
    assert archive.stat().st_mode & 0o777 == 0o600
    restored = tmp_path / 'restored'
    subprocess.run([str(scripts / 'restore.sh'), str(archive), str(restored)], capture_output=True, check=True)
    recovered = restored / 'data/synthetic.json'
    assert recovered.read_bytes() == (data / 'synthetic.json').read_bytes()
    assert recovered.stat().st_mode & 0o777 == 0o600
    assert recovered.parent.stat().st_mode & 0o777 == 0o700
    for state in ('queued', 'running', 'clicked'):
        restored_job = json.loads((restored / f'data/jobs/{state}.json').read_text())
        assert restored_job['state'] == 'needs_review'
        assert restored_job['error']['code'] == 'restored_archive'
    assert json.loads((restored / 'data/jobs/done.json').read_text())['state'] == 'done'
    refused = subprocess.run([str(scripts / 'restore.sh'), str(archive), str(restored)], capture_output=True, check=False)
    assert refused.returncode != 0
    malicious = tmp_path / 'unsafe.tar.gz'
    with tarfile.open(malicious, 'w:gz') as tar:
        member = tarfile.TarInfo('../outside')
        tar.addfile(member)
    refused = subprocess.run([str(scripts / 'restore.sh'), str(malicious), str(tmp_path / 'empty')], capture_output=True, check=False)
    assert refused.returncode != 0
    assert not (tmp_path / 'outside').exists()
