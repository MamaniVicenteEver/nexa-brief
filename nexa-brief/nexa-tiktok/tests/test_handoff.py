"""Verification handoff tests use synthetic data and no TikTok accounts."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from nexa_tiktok.adapters.browser_playwright import handoff, uploader
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Job
from nexa_tiktok.main import create_app
from nexa_tiktok.services.jobs import Jobs


@pytest.mark.parametrize('kind', ['publish', 'photo', 'comment'])
@pytest.mark.parametrize('code', ['challenge_required', 'requires_reauth'])
async def test_before_click_review_without_replay(tmp_path, kind, code):
    store = JsonStore(tmp_path)
    perform = AsyncMock(side_effect=uploader.TikTokUploadError('test', code=code))
    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    job = jobs.create('test', kind, {}, 'key')
    await jobs.run(job['id'])
    await jobs.run(job['id'])
    result = store.get_job(job['id'])
    assert result['state'] == 'needs_review'
    assert result['error']['code'] == 'human_verification_required'
    assert perform.await_count == 1


async def test_recheck_only_current_page(monkeypatch):
    check = AsyncMock(side_effect=[uploader.ManualInterventionRequired('test'), None])
    monkeypatch.setattr(uploader, '_detect_manual_intervention_once', check)
    monkeypatch.setattr(uploader.asyncio, 'sleep', AsyncMock())
    await uploader._detect_manual_intervention(SimpleNamespace(), 'old')
    assert check.await_count == 2
    assert check.await_args.args[1] is None
    check.reset_mock(side_effect=True)
    check.side_effect = uploader.ManualInterventionRequired('test')
    with pytest.raises(uploader.ManualInterventionRequired):
        await uploader._detect_manual_intervention(SimpleNamespace(_nexa_publish_clicked=True))
    assert check.await_count == 1


@pytest.mark.parametrize(('url', 'allowed'), [
    ('https://www.tiktok.com/@owner/video/1', True),
    ('https://www.tiktok.com/%40other/video/1', False),
    ('https://tiktok.com.evil.example/', False),
    ('http://www.tiktok.com/', False),
])
def test_navigation_scope(url, allowed):
    assert handoff.allowed_url(url, 'owner') is allowed


def test_websocket_requires_key_and_review_job(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'test-key')
    store = JsonStore(tmp_path)
    job = Job(id='example', alias='test', kind='publish', state='needs_review', error={'code': 'other', 'message': 'test'}).model_dump()
    store.put_job(job)
    with TestClient(create_app(store, SimpleNamespace())) as client:
        for headers in ({}, {'X-Nexa-Tiktok-Key': 'test-key'}):
            with pytest.raises(WebSocketDisconnect):
                with client.websocket_connect('/v1/jobs/example/verification', headers=headers):
                    pass


def test_websocket_stays_closed_until_security_is_complete(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'test-key')
    store = JsonStore(tmp_path)
    job = Job(id='example', alias='test', kind='publish', state='needs_review',
              error={'code': 'human_verification_required', 'message': 'test'}).model_dump()
    store.put_job(job)
    with TestClient(create_app(store, SimpleNamespace())) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect('/v1/jobs/example/verification', headers={'X-Nexa-Tiktok-Key': 'test-key'}):
                pass
