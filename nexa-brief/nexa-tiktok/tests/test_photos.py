import struct
import zlib

import pytest
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Account, Job
from nexa_tiktok.main import create_app
from nexa_tiktok.services.jobs import Jobs


def png_bytes():
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b'\x00\xff\xff\xff')) + chunk(b'IEND', b''))


class FakeBrowser:
    def __init__(self, store):
        self.store = store
        self.calls = []

    async def perform(self, job, before_click):
        self.calls.append(job['id'])
        await before_click()
        assert self.store.get_job(job['id'])['state'] == 'clicked'
        return {'post_id': '123456', 'url': None, 'status': 'publicado'}


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', '')
    monkeypatch.setattr(settings, 'app_env', 'development')
    store = JsonStore(tmp_path)
    for alias in ('test', 'another'):
        store.put_account(alias, Account(alias=alias).model_dump())
    image = tmp_path / 'test.png'
    image.write_bytes(png_bytes())
    browser = FakeBrowser(store)
    with TestClient(create_app(store, browser)) as client:
        yield client, store, browser, image


def test_photo_validation(api):
    client, store, _, image = api
    valid = {'image_paths': [str(image)], 'caption': 'Texto', 'privacy': 'private', 'idempotency_key': 'key'}
    corrupt = image.parent / 'corrupt.png'
    corrupt.write_bytes(png_bytes()[:20])
    other = image.parent / 'other.jpg'
    other.write_bytes(b'not an image')
    cases = [
        {'image_paths': []}, {'image_paths': [str(image)] * 36}, {'image_paths': 'wrong'},
        {'image_paths': [str(image), '/missing']}, {'image_paths': [str(corrupt)]}, {'image_paths': [str(other)]},
        {'caption': ''}, {'caption': 'x' * 2201}, {'caption': 1},
        {'privacy': 'unknown'}, {'privacy': []}, {'idempotency_key': ''},
        {'idempotency_key': 'x' * 201}, {'idempotency_key': None},
        {'first_comment': ''}, {'first_comment': 'x' * 121}, {'first_comment': 1},
        {'caption': 'Hola \U0001f600'}, {'first_comment': '\U0001f600'},
    ]
    for patch in cases:
        response = client.post('/v1/accounts/test/photos', json={**valid, **patch})
        assert response.status_code == 422, (patch, response.text)
    assert not store.list_jobs()


def test_photo_idempotency_and_catalog(api):
    client, store, browser, image = api
    body = {'image_paths': [str(image)], 'caption': 'Texto', 'privacy': 'private', 'idempotency_key': 'same'}
    first = client.post('/v1/accounts/test/photos', json=body)
    second = client.post('/v1/accounts/test/photos', json=body)
    other = client.post('/v1/accounts/another/photos', json=body)
    assert first.status_code == second.status_code == other.status_code == 202
    assert first.json()['id'] == second.json()['id'] != other.json()['id']
    assert first.json()['kind'] == 'photo'
    assert len(store.list_jobs()) == 2


async def test_photo_click_and_recovery(tmp_path):
    store = JsonStore(tmp_path)
    browser = FakeBrowser(store)
    jobs = Jobs(store, store, browser)
    job = jobs.create('test', 'photo', {'caption': 'Texto'}, 'key')
    await jobs.run(job['id'])
    assert store.get_job(job['id'])['state'] == 'done'
    assert store.get_videos('test')[0]['media_type'] == 'photo'
    interrupted = Job(id='interrupted', alias='test', kind='photo', state='clicked', payload={'caption': 'Texto'})
    store.put_job(interrupted.model_dump())
    jobs.recover()
    assert store.get_job('interrupted')['state'] == 'needs_review'
    assert browser.calls == [job['id']]


@pytest.mark.parametrize('dry_run', [True, False])
async def test_photo_uploader_single_click_and_dry_run(tmp_path, monkeypatch, dry_run):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from nexa_tiktok.adapters.browser_playwright import photo_uploader, uploader

    image = tmp_path / 'photo.png'
    image.write_bytes(png_bytes())
    events = []

    class Locator:
        async def count(self):
            return 1

        async def set_input_files(self, paths):
            events.append(('files', paths))

    class Page:
        url = 'https://www.tiktok.com/tiktokstudio/upload'

        async def goto(self, *args, **kwargs):
            pass

        def locator(self, selector):
            return Locator()

        async def screenshot(self, path, **kwargs):
            open(path, 'wb').close()

        def remove_listener(self, *args):
            pass

    page = Page()
    context = SimpleNamespace(pages=[page])
    for name in ('_detect_manual_intervention', '_ensure_no_dialog', '_human_pause', '_wait_for_editor',
                 '_dismiss_pre_publish_prompts', '_enter_caption', '_set_privacy',
                 '_expand_settings_for_comments', '_set_comments_enabled'):
        monkeypatch.setattr(uploader, name, AsyncMock())
    monkeypatch.setattr(photo_uploader, 'first_visible', AsyncMock(return_value='button'))
    async def click(page, button):
        events.append(('click', button))
    monkeypatch.setattr(uploader, '_move_and_click', click)
    monkeypatch.setattr(uploader, '_discard_draft', AsyncMock(return_value=True))
    ready = asyncio.Event()
    ready.set()
    monkeypatch.setattr(uploader, '_capture_publication_response', AsyncMock(
        return_value=(ready, {'post_id': '123456', 'endpoint': None}, 'listener')))
    monkeypatch.setattr(uploader, '_inspect_content', AsyncMock(
        return_value=uploader.UploadOutcome('123456', None, 'publicado', True, False)))
    async def before():
        events.append(('persisted',))
    result = await photo_uploader.upload_photos(context, [image], 'Texto', privacy='private', dry_run=dry_run,
                                                shots_dir=tmp_path / 'shots', before_click=before, username='test')
    assert events[0] == ('click', 'button')  # photo tab
    assert events[1] == ('files', [str(image)])
    if dry_run:
        assert events == [('click', 'button'), ('files', [str(image)])]
        assert result.draft_discarded is True
    else:
        assert events[2:] == [('persisted',), ('click', 'button')]
        assert result.url.endswith('/photo/123456')


async def test_late_iframe_challenge_stops_before_persist_and_publish(tmp_path, monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from nexa_tiktok.adapters.browser_playwright import photo_uploader, uploader

    image = tmp_path / 'photo.png'
    image.write_bytes(png_bytes())
    events = []
    page = SimpleNamespace(url=uploader.UPLOAD_URL, challenged=False, goto=AsyncMock(),
                           remove_listener=lambda *args: None)
    file_input = SimpleNamespace(count=AsyncMock(return_value=1), set_input_files=AsyncMock())
    iframe = SimpleNamespace(evaluate_all=AsyncMock(side_effect=lambda script: 'verification challenge' if page.challenged else ''))
    body = SimpleNamespace(inner_text=AsyncMock(return_value='Editor de fotos'))
    page.locator = lambda selector: iframe if selector == 'iframe' else body if selector == 'body' else file_input
    for name in ('_ensure_no_dialog', '_human_pause', '_wait_for_editor', '_dismiss_pre_publish_prompts',
                 '_enter_caption', '_set_privacy', '_expand_settings_for_comments', 'capture_failure'):
        monkeypatch.setattr(uploader, name, AsyncMock())
    async def enable_comments(page):
        page.challenged = True
    monkeypatch.setattr(uploader, '_set_comments_enabled', enable_comments)
    tab, publish = object(), object()
    monkeypatch.setattr(photo_uploader, 'first_visible', AsyncMock(side_effect=[tab, publish]))
    async def click(page, button):
        events.append('publish' if button is publish else 'tab')
    monkeypatch.setattr(uploader, '_move_and_click', click)
    ready = asyncio.Event()
    ready.set()
    monkeypatch.setattr(uploader, '_capture_publication_response', AsyncMock(return_value=(ready, {}, 'listener')))
    async def before_click():
        events.append('persist')
    with pytest.raises(uploader.ManualInterventionRequired):
        await photo_uploader.upload_photos(SimpleNamespace(pages=[page]), [image], 'Texto', privacy='private',
                                           dry_run=False, shots_dir=tmp_path / 'shots', before_click=before_click,
                                           username='synthetic')
    assert events == ['tab']


@pytest.mark.parametrize('media_type,response_id,published', [
    ('photo', '123456', True), ('photo', '999999', False),
    ('video', '123456', True), ('video', '999999', False),
])
async def test_content_row_ids_are_compared_for_photos_and_videos(media_type, response_id, published):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from nexa_tiktok.adapters.browser_playwright import uploader

    page = SimpleNamespace(url=uploader.CONTENT_URL, goto=AsyncMock(), wait_for_load_state=AsyncMock(),
                           evaluate=AsyncMock(return_value={
                               'text': 'Texto Publicado',
                               'links': [f'https://www.tiktok.com/@synthetic/{media_type}/123456'],
                           }))
    assert (await uploader._find_content_row(page, 'Texto'))[1] == '123456'
    outcome = await uploader._inspect_content(page, 'Texto', response_id, username='synthetic')
    assert outcome.published is published
    assert outcome.status == ('Publicado' if published else 'desconocido')


async def test_photo_failure_after_click_needs_review(tmp_path):
    store = JsonStore(tmp_path)
    class Browser:
        async def perform(self, job, before_click):
            await before_click()
            raise RuntimeError('unknown result')
    jobs = Jobs(store, store, Browser())
    job = jobs.create('test', 'photo', {'caption': 'Texto'}, 'key')
    await jobs.run(job['id'])
    assert store.get_job(job['id'])['state'] == 'needs_review'


def test_photo_accepts_35_images(api):
    client, _, _, image = api
    response = client.post('/v1/accounts/test/photos', json={
        'image_paths': [str(image)] * 35, 'caption': 'Texto', 'privacy': 'private', 'idempotency_key': 'max',
    })
    assert response.status_code == 202
