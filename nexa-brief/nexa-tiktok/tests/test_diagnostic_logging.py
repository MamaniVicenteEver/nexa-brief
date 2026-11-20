from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from nexa_tiktok.adapters.browser_playwright import uploader
from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.services.jobs import Jobs


@pytest.mark.parametrize('error', [PlaywrightTimeoutError('external details'), TimeoutError('deadline')])
async def test_browser_timeouts_are_classified(tmp_path, monkeypatch, error):
    monkeypatch.setattr(settings, 'nexa_tiktok_data_dir', tmp_path)
    store = JsonStore(tmp_path)
    jobs = Jobs(store, store, SimpleNamespace(perform=AsyncMock(side_effect=error)))
    job = jobs.create('test', 'publish', {}, 'key')
    await jobs.run(job['id'])
    assert store.get_job(job['id'])['error']['code'] == 'browser_timeout'


@pytest.mark.parametrize('message,expected', [
    ('La descripción escrita no coincide con el texto previsto.', 'La descripción escrita no coincide con el texto previsto.'),
    ('sessionid=secret-value', 'detalle externo omitido'),
])
async def test_error_detail_is_private_and_untrusted_text_is_omitted(tmp_path, monkeypatch, message, expected):
    monkeypatch.setattr(settings, 'nexa_tiktok_data_dir', tmp_path)
    store = JsonStore(tmp_path)
    async def perform(job, before_click):
        raise uploader.TikTokUploadError(message, code='caption_mismatch')
    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    job = jobs.create('test', 'publish', {}, 'key')
    await jobs.run(job['id'])
    result = store.get_job(job['id'])
    log = (tmp_path / 'logs' / job['id'] / 'error.log').read_text()
    assert expected in log
    assert 'secret-value' not in log
    assert message not in str(result['error'])
    assert (tmp_path / 'logs' / job['id'] / 'error.log').stat().st_mode & 0o777 == 0o600


async def test_failure_capture_masks_challenge(tmp_path):
    page = SimpleNamespace(locator=lambda selector: selector, screenshot=AsyncMock())
    await uploader.capture_failure(page, tmp_path, uploader.ManualInterventionRequired('challenge'), after_publish_click=False)
    assert page.screenshot.await_args.kwargs['mask'] == ['body']
    assert page.screenshot.await_args.kwargs['path'].endswith('failure.png')


@pytest.mark.parametrize('url,error', [
    ('https://www.tiktok.com/login', uploader.RequiresReauthError()),
    ('https://www.tiktok.com/login', uploader.TikTokUploadError('other', code='other')),
    ('https://www.tiktok.com/studio', uploader.RequiresReauthError()),
])
async def test_failure_capture_masks_login(tmp_path, monkeypatch, url, error):
    monkeypatch.setattr(uploader, '_detect_manual_intervention', AsyncMock())
    page = SimpleNamespace(url=url, locator=lambda selector: selector, screenshot=AsyncMock())
    await uploader.capture_failure(page, tmp_path, error, after_publish_click=False)
    assert page.screenshot.await_args.kwargs['mask'] == ['body']


@pytest.mark.parametrize('detection,full_mask', [
    (None, False),
    (uploader.ManualInterventionRequired('challenge'), True),
    (RuntimeError('detection failed'), True),
])
async def test_failure_capture_checks_verification(tmp_path, monkeypatch, detection, full_mask):
    monkeypatch.setattr(uploader, '_detect_manual_intervention', AsyncMock(side_effect=detection))
    page = SimpleNamespace(url='https://www.tiktok.com/studio', locator=lambda selector: selector, screenshot=AsyncMock())
    await uploader.capture_failure(page, tmp_path, RuntimeError('failure'), after_publish_click=False)
    assert (page.screenshot.await_args.kwargs['mask'] == ['body']) is full_mask


@pytest.mark.parametrize('stage', ['el ajuste de visibilidad', 'el ajuste de comentarios'])
async def test_unknown_modal_logs_controlled_stage(tmp_path, monkeypatch, stage):
    monkeypatch.setattr(settings, 'nexa_tiktok_data_dir', tmp_path)
    monkeypatch.setattr(uploader, '_visible_dialog_text', AsyncMock(return_value=(object(), 'external text')))
    monkeypatch.setattr(uploader, '_detect_manual_intervention', AsyncMock())
    store = JsonStore(tmp_path)

    async def perform(job, before_click):
        await uploader._ensure_no_dialog(SimpleNamespace(), stage)

    jobs = Jobs(store, store, SimpleNamespace(perform=perform))
    job = jobs.create('test', 'publish', {}, 'key')
    await jobs.run(job['id'])
    log = (tmp_path / 'logs' / job['id'] / 'error.log').read_text()
    assert log == f'unknown_modal: TikTok mostró un modal no reconocido durante {stage}; se detuvo.\n'
    assert 'external text' not in log
    assert stage not in str(store.get_job(job['id'])['error'])
