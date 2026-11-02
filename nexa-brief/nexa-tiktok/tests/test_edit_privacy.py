import asyncio

from fastapi.testclient import TestClient

from nexa_tiktok.adapters.browser_playwright.privacy import privacy_from_label
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.domain.models import Account, Job
from nexa_tiktok.config import settings
from nexa_tiktok.main import create_app
from nexa_tiktok.services.jobs import Jobs


def test_privacy_labels():
    assert privacy_from_label('Todo el mundo') == 'public'
    assert privacy_from_label('Amigos') == 'friends'
    assert privacy_from_label('Solo yo') == 'private'
    assert privacy_from_label('Desconocido') is None


def test_patch_validation_and_idempotency(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "nexa_tiktok_key", "test-key")
    class Browser:
        async def perform(self, job, before_click):
            await before_click()
            return {'id': job['payload']['video_id'], 'privacy': job['payload']['privacy'], 'verified': True}
    store = JsonStore(tmp_path)
    store.put_account('test', Account(alias='test').model_dump())
    with TestClient(create_app(store, Browser()), headers={'X-Nexa-Tiktok-Key': 'test-key'}) as client:
        url = '/v1/accounts/test/videos/123'
        payload = {'privacy': 'public', 'idempotency_key': 'unique'}
        a = client.patch(url, json=payload)
        b = client.patch(url, json=payload)
        assert a.status_code == 202 and a.json()['kind'] == 'edit_privacy'
        assert b.json()['id'] == a.json()['id']
        assert client.patch(url, json={'privacy': 'other', 'idempotency_key': 'x'}).status_code == 422
        assert client.patch(url, json={'privacy': 'public'}).status_code == 422
        assert client.patch('/v1/accounts/test/videos/no', json=payload).status_code == 422


async def test_privacy_failure_after_click_requires_review(tmp_path):
    class Browser:
        async def perform(self, job, before_click):
            await before_click()
            raise RuntimeError('uncertain')
    store = JsonStore(tmp_path)
    job = Job(id='privacy', alias='test', kind='edit_privacy', idempotency_key='x',
              payload={'video_id': '123', 'privacy': 'public'}).model_dump()
    store.put_job(job)
    jobs = Jobs(store, store, Browser())
    await jobs.run('privacy')
    assert store.get_job('privacy')['state'] == 'needs_review'
    jobs.recover()
    assert jobs.queue.empty()
