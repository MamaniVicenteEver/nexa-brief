import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Job
from nexa_tiktok.main import create_app
from nexa_tiktok.services.jobs import Jobs


def test_invalid_structures_are_quarantined_and_valid_backup_restored(tmp_path):
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test', 'label': 'saved'})
    store.put_account('test', {'alias': 'test', 'label': 'new'})
    store.put_videos('test', [{'id': '1'}])
    store.put_videos('test', [{'id': '2'}])
    job = Job(id='job1', alias='test', kind='publish').model_dump()
    store.put_job(job)
    store.put_job({**job, 'state': 'clicked'})
    for relative, value in [('accounts/test/account.json', []),
                            ('accounts/test/videos.json', {}), ('jobs/job1.json', [])]:
        (tmp_path / relative).write_text(json.dumps(value))
    assert store.get_account('test')['label'] == 'saved'
    assert store.get_videos('test') == [{'id': '1'}]
    assert store.get_job('job1')['state'] == 'needs_review'
    assert len([p for p in (tmp_path / 'quarantine').rglob('*') if p.is_file()]) == 3


def test_invalid_job_without_backup_does_not_prevent_start_or_allow_new_jobs(tmp_path):
    store = JsonStore(tmp_path)
    (tmp_path / 'jobs').mkdir()
    (tmp_path / 'jobs/bad.json').write_text('[]')
    store.put_account('good', {'alias': 'good'})
    store.put_account('bad', {'alias': 'bad'})
    (tmp_path / 'accounts/bad/account.json').write_text('[]')
    with TestClient(create_app(store=store, browser=object())) as client:
        health = client.get('/health').json()
        assert health['status'] == 'degraded'
        assert health['worker'] == 'ok'
        assert [account['alias'] for account in health['accounts']] == ['good']
        with pytest.raises(RuntimeError):
            store.create_job(Job(id='new', alias='test', kind='publish').model_dump())


async def test_initial_store_failure_is_retried(tmp_path):
    store = JsonStore(tmp_path)
    original = store.list_jobs
    calls = 0

    def flaky():
        nonlocal calls
        calls += 1
        if calls == 1:
            raise OSError('temporary failure')
        return original()

    store.list_jobs = flaky
    jobs = Jobs(store, store, SimpleNamespace())
    await jobs.start()
    try:
        async with asyncio.timeout(3):
            while calls < 2:
                await asyncio.sleep(.01)
        assert not jobs.task.done()
    finally:
        await jobs.stop()


def test_health_tracks_checks_and_distinguishes_failure_from_expiry(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'test-key')
    headers = {'X-Nexa-Tiktok-Key': 'test-key'}
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test'})
    browser = SimpleNamespace(check=AsyncMock(side_effect=[{'username': 'test'}, None, OSError('offline')]))
    with TestClient(create_app(store=store, browser=browser)) as client:
        def health():
            return client.get('/health').json()['accounts'][0]

        assert health()['session'] == 'unknown'
        assert client.post('/v1/accounts/test/check', headers=headers).status_code == 200
        assert health()['session'] == 'ok'
        assert health()['checked_at']
        assert client.post('/v1/accounts/test/check', headers=headers).status_code == 409
        assert health()['session'] == 'expired'
        assert client.post('/v1/accounts/test/check', headers=headers).status_code == 409
        assert health()['session'] == 'unknown'
