"""Regression checks for the independent review; no real browser or account."""
import asyncio
import fcntl
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.browser_playwright import profiles, qr_login, uploader
from nexa_tiktok.adapters.browser_playwright.catalog import parse_catalog
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Account, Job
from nexa_tiktok.main import APIError, create_app, valid_text
from nexa_tiktok.services.jobs import Jobs


@pytest.mark.parametrize('kind', ['publish', 'comment', 'delete'])
@pytest.mark.parametrize('after_click', [False, True])
async def test_challenge_keeps_uncertain_click_in_review(tmp_path, kind, after_click):
    store = JsonStore(tmp_path)
    async def perform(job, before_click):
        if after_click:
            await before_click()
            assert store.get_job(job['id'])['state'] == 'clicked'
        raise uploader.ManualInterventionRequired('synthetic challenge')
    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    job = jobs.create('test', kind, {}, 'key')
    await jobs.run(job['id'])
    result = store.get_job(job['id'])
    assert result['state'] == ('needs_review' if after_click else 'failed')
    assert result['error']['code'] == 'challenge_required'
    # A second invocation cannot replay an uncertain/failed operation.
    await jobs.run(job['id'])
    assert store.get_job(job['id']) == result


@pytest.mark.parametrize('after_click', [False, True])
async def test_job_timeout_releases_worker_and_preserves_click(tmp_path, monkeypatch, after_click):
    monkeypatch.setattr(settings, 'nexa_tiktok_job_timeout', .02)
    store = JsonStore(tmp_path)
    async def perform(job, before_click):
        if after_click:
            await before_click()
        await asyncio.Event().wait()
    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    a = jobs.create('test', 'comment', {}, 'a')
    b = jobs.create('test', 'comment', {}, 'b')
    # Start from persisted queue rather than enqueuing the same jobs twice.
    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    await jobs.start()
    try:
        await asyncio.wait_for(jobs.queue.join(), 1)
        assert not jobs.task.done()
    finally:
        await jobs.stop()
    for item in (a, b):
        assert store.get_job(item['id'])['state'] == ('needs_review' if after_click else 'failed')


async def test_publish_without_id_never_reports_done(tmp_path):
    store = JsonStore(tmp_path)
    async def perform(job, before_click):
        await before_click()
        return {}
    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    job = jobs.create('test', 'publish', {}, 'key')
    await jobs.run(job['id'])
    assert store.get_job(job['id'])['state'] == 'needs_review'


def test_concurrent_idempotency_is_persisted_once(tmp_path):
    store = JsonStore(tmp_path)
    def create(index):
        return store.create_job(Job(id=f'job{index}', alias='test', kind='comment', idempotency_key='shared').model_dump())
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(create, range(20)))
    assert sum(created for _, created in results) == 1
    assert len({job['id'] for job, _ in results}) == 1
    assert len(JsonStore(tmp_path).list_jobs()) == 1


@pytest.mark.parametrize('text', ['hola \U0001f600', '1\ufe0f\u20e3', '\u00a9', '\u231a', '\u2194\ufe0f'])
def test_all_emoji_forms_are_rejected(text):
    with pytest.raises(APIError, match='No se permiten emojis'):
        valid_text(text)
    assert valid_text('Texto sin emojis: 123, acción #video')


def test_invalid_privacy_is_a_validation_error(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'test-key')
    store = JsonStore(tmp_path)
    store.put_account('test', Account(alias='test').model_dump())
    with TestClient(create_app(store, SimpleNamespace())) as client:
        response = client.post('/v1/accounts/test/videos', headers={'X-Nexa-Tiktok-Key':'test-key'}, json={
            'caption':'text', 'privacy':[], 'idempotency_key':'key', 'video_path':'unused',
        })
    assert response.status_code == 422
    assert response.json()['error']['code'] == 'invalid_privacy'


def test_non_ascii_auth_is_rejected_without_server_error(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'test-key')
    with TestClient(create_app(JsonStore(tmp_path), SimpleNamespace())) as client:
        assert client.get('/v1/accounts', headers={b'X-Nexa-Tiktok-Key':b'\xe9'}).status_code == 401


async def test_content_confirmation_uses_actual_account_and_response_id(monkeypatch):
    page = SimpleNamespace(url='https://www.tiktok.com/tiktokstudio/content', goto=AsyncMock(), wait_for_load_state=AsyncMock())
    monkeypatch.setattr(uploader, '_find_content_row', AsyncMock(return_value=('old caption', '111111', 'Publicada')))
    result = await uploader._inspect_content(page, 'caption', '222222', username='another.account')
    assert result.url == 'https://www.tiktok.com/@another.account/video/222222'
    assert not result.published
    unknown = await uploader._inspect_content(page, 'caption', None, username='another.account')
    assert unknown.post_id is None
    assert unknown.url is None


async def test_qr_cancel_removes_qr_image(monkeypatch):
    state = qr_login.QRLoginSession('synthetic', 'test', state='waiting_qr', qr_png_b64='synthetic-image')
    monkeypatch.setattr(qr_login, '_sessions', {'synthetic':state})
    assert await qr_login.cancel_qr_login('synthetic')
    assert await qr_login.get_qr_login('synthetic') == {'state':'cancelled'}


def test_catalog_strips_signed_url_parameters():
    data = {'item_list':[{'item_id':'123', 'share_url':'https://www.tiktok.com/@test/video/123?token=synthetic#secret'}]}
    assert parse_catalog(data)[0]['url'] == 'https://www.tiktok.com/@test/video/123'
    data['item_list'][0]['share_url'] = 'https://tiktok.com.evil.test/123'
    assert parse_catalog(data)[0]['url'] is None


def test_xvfb_start_has_bounded_wait(monkeypatch):
    process = SimpleNamespace(terminate=lambda:None, wait=lambda **kwargs:None)
    monkeypatch.setattr(profiles, '_xvfb', None)
    monkeypatch.setattr(profiles, '_display', None)
    monkeypatch.setattr(profiles.shutil, 'which', lambda binary:'/synthetic/Xvfb')
    monkeypatch.setattr(profiles.subprocess, 'Popen', lambda *args, **kwargs:process)
    monkeypatch.setattr(profiles.select, 'select', lambda *args:([], [], []))
    with pytest.raises(RuntimeError, match='diez segundos'):
        profiles.start_display()
    assert profiles._xvfb is None


async def test_cancelled_account_lock_does_not_leave_browser_slot_taken(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_data_dir', tmp_path)
    monkeypatch.setattr(profiles, 'BROWSER_SEMAPHORE', asyncio.Semaphore(1))
    locks = tmp_path / 'locks'
    locks.mkdir()
    with (locks / 'test.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        async def blocked():
            async with profiles.open_browser('test'):
                pytest.fail('The browser must not open while the account is locked')
        task = asyncio.create_task(blocked())
        await asyncio.sleep(.02)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert not profiles.BROWSER_SEMAPHORE.locked()


@pytest.mark.parametrize('kind', ['publish', 'comment', 'delete'])
async def test_restart_does_not_replay_any_clicked_operation(tmp_path, kind):
    store = JsonStore(tmp_path)
    store.put_job(Job(id='interrupted', alias='test', kind=kind, state='clicked', payload={'caption':'test'}).model_dump())
    browser = SimpleNamespace(perform=AsyncMock(), sync=AsyncMock(return_value=[]))
    jobs = Jobs(store, store, browser)
    await jobs.start()
    try:
        await asyncio.wait_for(jobs.queue.join(), 1)
    finally:
        await jobs.stop()
    assert store.get_job('interrupted')['state'] == 'needs_review'
    browser.perform.assert_not_awaited()
    browser.sync.assert_awaited_once_with('test')


def test_production_fails_closed_without_service_key(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'nexa_tiktok_key', '')
    with (
        pytest.raises(RuntimeError, match='obligatoria fuera de development'),
        TestClient(create_app(JsonStore(tmp_path), SimpleNamespace())),
    ):
        pytest.fail('Startup must refuse unauthenticated production access')
