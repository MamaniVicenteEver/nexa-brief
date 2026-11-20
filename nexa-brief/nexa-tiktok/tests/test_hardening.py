import json
import re

import pytest
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.main import create_app


def test_corruption_is_quarantined_and_latest_backup_restored(tmp_path):
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test', 'label': 'original'})
    store.put_account('test', {'alias': 'test', 'label': 'new'})
    path = tmp_path / 'accounts/test/account.json'
    path.write_text('{broken')
    assert store.get_account('test')['label'] == 'original'
    assert list((tmp_path / 'quarantine/accounts/test').glob('account.json.*'))
    assert json.loads(path.read_text())['label'] == 'original'


def test_missing_backup_is_isolated_and_persistent(tmp_path):
    store = JsonStore(tmp_path)
    store.put_account('good', {'alias': 'good'})
    store.put_account('bad', {'alias': 'bad'})
    (tmp_path / 'accounts/bad/account.json').write_text('{')
    assert [account['alias'] for account in store.list_accounts()] == ['good']
    assert 'accounts/bad/account.json' in JsonStore(tmp_path).degraded
    with pytest.raises(RuntimeError):
        JsonStore(tmp_path).get_account('bad')


def test_restore_rejects_traversal_and_recovers(tmp_path):
    store = JsonStore(tmp_path)
    store.put_videos('test', [{'id': '1'}])
    store.put_videos('test', [{'id': '2'}])
    backup = store.list_backups()[0]
    with pytest.raises(ValueError, match='legible'):
        store.restore_backup(**backup)
    assert store.get_videos('test') == [{'id': '2'}]
    (tmp_path / 'accounts/test/videos.json').unlink()
    store.restore_backup(**backup)
    assert store.get_videos('test') == [{'id': '1'}]
    with pytest.raises(ValueError):
        store.restore_backup('../outside', backup['timestamp'])


def test_health_reports_worker_and_backup(tmp_path):
    store = JsonStore(tmp_path)
    store.put_videos('test', [])
    store.put_videos('test', [{'id': '1'}])
    with TestClient(create_app(store=store, browser=object())) as client:
        health = client.get('/health').json()
        assert health['status'] == 'ok'
        assert health['worker'] == 'ok'
        assert re.fullmatch(r'\d{8}T\d{6}\.\d{6}Z', health['last_backup_at'])


def test_recovered_job_is_never_requeued(tmp_path):
    store = JsonStore(tmp_path)
    job = {'id': 'job1', 'alias': 'test', 'kind': 'publish', 'state': 'queued', 'steps': [], 'idempotency_key': 'key'}
    store.put_job(job)
    store.put_job({**job, 'state': 'clicked'})
    (tmp_path / 'jobs/job1.json').write_text('{')
    assert store.get_job('job1')['state'] == 'needs_review'
    same, created = store.create_job({**job, 'id': 'job2'})
    assert not created
    assert same['id'] == 'job1'


def test_corrupt_job_without_backup_blocks_new_jobs(tmp_path):
    store = JsonStore(tmp_path)
    store.put_job({'id': 'job1', 'state': 'queued', 'idempotency_key': 'key'})
    (tmp_path / 'jobs/job1.json').write_text('{')
    with pytest.raises(RuntimeError):
        store.create_job({'id': 'job2', 'state': 'queued', 'idempotency_key': 'key'})
    with pytest.raises(RuntimeError):
        JsonStore(tmp_path).create_job({'id': 'job3', 'state': 'queued', 'idempotency_key': 'key'})
