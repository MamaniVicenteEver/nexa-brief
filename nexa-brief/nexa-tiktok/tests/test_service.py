import asyncio

import pytest
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.browser_playwright.catalog import parse_catalog
from nexa_tiktok.adapters.browser_playwright.session import normalize_cookies
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Account, Job
from nexa_tiktok.main import create_app
from nexa_tiktok.services.jobs import Jobs


class FakeBrowser:
    def __init__(self):
        self.calls = []

    async def check(self, alias):
        return {'username': 'test'}

    async def sync(self, alias):
        return [{'id': '123456', 'caption': 'remote'}]

    async def perform(self, job, before_click):
        self.calls.append(job['id'])
        await before_click()
        return {'post_id': '123456', 'url': None, 'status': 'en revisión'}


def test_store_atomic_and_idempotent(tmp_path):
    store = JsonStore(tmp_path)
    store.put_account('test', Account(alias='test').model_dump())
    assert store.get_account('test')['alias'] == 'test'
    a = Job(id='one', alias='test', kind='publish', idempotency_key='key').model_dump()
    b = Job(id='two', alias='test', kind='comment', idempotency_key='key').model_dump()
    assert store.create_job(a) == (a, True)
    assert store.create_job(b) == (a, False)
    assert not list(tmp_path.rglob('.tmp-*'))
    with pytest.raises(ValueError):
        store.get_account('../escape')


async def test_recovery_never_retries_clicked(tmp_path):
    store, browser = JsonStore(tmp_path), FakeBrowser()
    clicked = Job(id='clicked', alias='test', kind='publish', state='clicked', idempotency_key='x').model_dump()
    queued = Job(id='queued', alias='test', kind='publish', state='queued',
                 payload={'caption': 'text'}, idempotency_key='y').model_dump()
    store.put_job(clicked)
    store.put_job(queued)
    jobs = Jobs(store, store, browser)
    await jobs.start()
    await asyncio.wait_for(jobs.queue.join(), timeout=2)
    await jobs.stop()
    assert store.get_job('clicked')['state'] == 'needs_review'
    assert browser.calls == ['queued']
    assert 'Studio consultado' in store.get_job('clicked')['steps'][-1]
    assert store.get_job('queued')['state'] == 'done'


def test_normalize_cookies():
    result = normalize_cookies([{'name': 'sessionid', 'value': 'secret', 'domain': '.tiktok.com'},
                                {'name': 'bad', 'value': 'secret', 'domain': 'tiktok.com.evil.test'}])
    assert len(result) == 1 and result[0]['name'] == 'sessionid'
    with pytest.raises(ValueError):
        normalize_cookies([{'name': 'sessionid', 'value': 'secret', 'domain': 'evil.test'}])


def test_catalog_requires_known_response():
    assert parse_catalog({'data': {'item_list': [{'item_id': '123', 'desc': 'hola'}]}})[0]['id'] == '123'
    assert parse_catalog({'status': 'ok'}) is None
    assert parse_catalog({'data': {'item_list': []}}) == []


def test_routers_auth_and_fake_browser(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'test-key')
    store, browser = JsonStore(tmp_path), FakeBrowser()
    store.put_account('test', Account(alias='test').model_dump())
    video = tmp_path / 'video.mp4'
    video.write_bytes(b'fake')
    app = create_app(store, browser)
    with TestClient(app) as client:
        assert client.get('/health').status_code == 200
        assert client.get('/v1/accounts').status_code == 401
        headers = {'X-Nexa-Tiktok-Key': 'test-key'}
        assert client.post('/v1/accounts/test/check', headers=headers).json()['identity']['username'] == 'test'
        assert client.get('/v1/accounts/test/videos?refresh=1', headers=headers).json()[0]['id'] == '123456'
        payload = {'video_path': str(video), 'caption': 'hola', 'privacy': 'public', 'idempotency_key': 'same'}
        first = client.post('/v1/accounts/test/videos', headers=headers, json=payload)
        second = client.post('/v1/accounts/test/videos', headers=headers, json=payload)
        assert first.status_code == second.status_code == 202
        assert first.json()['id'] == second.json()['id']
        assert 'payload' not in first.json()
        bad = client.post('/v1/sessions/import', headers=headers, content=b'x' * (256 * 1024 + 1))
        assert bad.status_code == 413
