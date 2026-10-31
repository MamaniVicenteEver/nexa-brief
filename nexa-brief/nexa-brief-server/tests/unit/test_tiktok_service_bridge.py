import httpx
import pytest

from src.adapters.publishing.tiktok_service.adapter import TikTokServiceAdapter
from src.adapters.publishing.tiktok_service.client import TikTokServiceClient
from src.config.exceptions import PublisherError


@pytest.mark.asyncio
async def test_publish_polls_job_and_reuses_supplied_idempotency_key(tmp_path):
    seen = []
    def handler(request):
        seen.append(request)
        if request.method == 'POST':
            assert b'"idempotency_key":"stable-key"' in request.content
            assert request.headers['X-Nexa-Tiktok-Key'] == 'test-key'
            return httpx.Response(202, json={'id': 'job1', 'state': 'queued'})
        return httpx.Response(200, json={'id': 'job1', 'state': 'done', 'result': {'post_id': '123', 'url': 'https://example.test/123'}})
    client = TikTokServiceClient('http://test', 'test-key', httpx.MockTransport(handler))
    result = await TikTokServiceAdapter(client).publish(tmp_path / 'video.mp4', 'Title', '', [], 'alice', idempotency_key='stable-key')
    assert result.post_id == '123'
    assert [r.method for r in seen] == ['POST', 'GET']


@pytest.mark.asyncio
async def test_uncertain_job_is_not_retried():
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(202, json={'id': 'job1', 'state': 'needs_review', 'error': {'code': 'interrupted'}})
    adapter = TikTokServiceAdapter(TikTokServiceClient('http://test', 'key', httpx.MockTransport(handler)))
    with pytest.raises(PublisherError, match='needs_review'):
        await adapter.delete_video('123', 'alice')
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_service_error_maps_to_publisher_error():
    client = TikTokServiceClient('http://test', 'key', httpx.MockTransport(lambda request: httpx.Response(409, json={'error': {'code': 'requires_reauth', 'message': 'Reconnect'}})))
    with pytest.raises(PublisherError, match='requires_reauth'):
        await client.request('POST', '/v1/accounts/alice/check')


@pytest.mark.parametrize('payload', [None, [], 'invalid', {'error': []}, {'error': 'secret'}])
async def test_invalid_error_shapes_are_mapped_without_exposing_body(payload):
    client = TikTokServiceClient('http://test', 'key', httpx.MockTransport(lambda request: httpx.Response(502, json=payload)))
    with pytest.raises(PublisherError) as error:
        await client.request('GET', '/v1/accounts')
    assert 'secret' not in str(error.value)


async def test_invalid_success_json_and_scalar_are_mapped():
    for response in (httpx.Response(200, text='not json'), httpx.Response(200, json='secret')):
        client = TikTokServiceClient('http://test', 'key', httpx.MockTransport(lambda request: response))
        with pytest.raises(PublisherError, match='invalid_response'):
            await client.request('GET', '/v1/accounts')


async def test_missing_account_is_not_reported_as_missing_video():
    from src.adapters.publishing.tiktok_service.client import TikTokServiceError
    client = TikTokServiceClient('http://test', 'key', httpx.MockTransport(lambda request: httpx.Response(404, json={'error': {'code':'account_not_found','message':'secret'}})))
    with pytest.raises(TikTokServiceError) as error:
        await client.request('GET', '/v1/accounts/test')
    assert error.value.code == 'account_not_found'
    assert 'secret' not in str(error.value)


@pytest.mark.parametrize('job', [{'id':'job1','state':'unknown'}, {'state':'done'}, [], {'id':'../escape','state':'queued'}])
async def test_invalid_jobs_are_not_polled(job):
    client = TikTokServiceClient('http://test', 'key')
    with pytest.raises(PublisherError, match='invalid_job_response'):
        await client.wait_job(job)


async def test_polling_deadline_does_not_resubmit():
    import time
    calls = []
    client = TikTokServiceClient('http://test', 'key', httpx.MockTransport(lambda request: calls.append(request)))
    start = time.monotonic()
    with pytest.raises(PublisherError, match='job1 sigue en curso'):
        await client.wait_job({'id':'job1','state':'clicked'}, timeout=.02)
    assert time.monotonic() - start < .5
    assert not calls


@pytest.mark.parametrize('method,path,payload', [
    ('POST','/api/v1/publish/browser/tiktok/qr/start',{'alias':'test'}),
    ('GET','/api/v1/publish/browser/sessions/test',None),
    ('POST','/api/v1/publish/browser/sessions/test/cancel',None),
])
async def test_qr_proxy_translates_unavailable_service(api_client, monkeypatch, method, path, payload):
    from src.adapters.publishing.tiktok_service.client import TikTokServiceError
    async def unavailable(*args, **kwargs):
        raise TikTokServiceError('service_unavailable')
    monkeypatch.setattr(TikTokServiceClient, 'request', unavailable)
    response = await api_client.request(method, path, json=payload)
    assert response.status_code == 502
    assert 'service_unavailable' in response.json()['detail']


@pytest.mark.parametrize('method,path,payload', [
    ('POST','/api/v1/publish/browser/tiktok/pair',{'alias':'test'}),
    ('POST','/api/v1/publish/browser/tiktok/qr/start',{'alias':'test'}),
    ('GET','/api/v1/publish/browser/sessions/test',None),
    ('POST','/api/v1/publish/browser/sessions/test/cancel',None),
    ('POST','/api/v1/publish/accounts/tiktok/test/check-session',None),
])
async def test_qr_management_requires_internal_auth(api_client, monkeypatch, method, path, payload):
    from src.config.settings import settings
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'nexa_internal_token', 'synthetic-key')
    response = await api_client.request(method, path, json=payload)
    assert response.status_code == 403


async def test_service_outage_does_not_expire_account(api_client, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from src.presentation.api.routers import publisher
    from src.adapters.publishing.tiktok_service.client import TikTokServiceError
    storage = SimpleNamespace(mark_requires_reauth=AsyncMock())
    facade = SimpleNamespace(
        list_accounts=lambda:[{'platform':'tiktok', 'alias':'test', 'mode':'service'}],
        _token_manager=SimpleNamespace(_storage=storage),
    )
    monkeypatch.setattr(publisher, '_get_facade', lambda:facade)
    async def unavailable(*args, **kwargs):
        raise TikTokServiceError('service_unavailable')
    monkeypatch.setattr(TikTokServiceClient, 'request', unavailable)
    response = await api_client.post('/api/v1/publish/accounts/tiktok/test/check-session')
    assert response.status_code == 502
    storage.mark_requires_reauth.assert_not_awaited()


async def test_schedule_retry_reuses_service_idempotency_key(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from src.core.schedule import engine
    from src.core.schedule.models import QueueEntry
    from src.config.exceptions import PublisherError
    video = tmp_path / 'video.mp4'
    video.write_bytes(b'synthetic')
    entry = QueueEntry(entry_id='same-entry', job_id='job1', platform='tiktok', account_alias='test', source='manual', created_at='now', updated_at='now')
    monkeypatch.setattr(engine.queue_repository, 'mark_publishing', AsyncMock(return_value=entry))
    monkeypatch.setattr(engine.queue_repository, 'mark_failed', AsyncMock(return_value=entry))
    monkeypatch.setattr(engine.job_tracker, 'get', lambda _: {'file_paths':{'tiktok':str(video)}})
    monkeypatch.setattr(engine.job_tracker, 'get_summary', lambda _: {})
    monkeypatch.setattr(engine, 'copy_for_platform', lambda *args: SimpleNamespace(title='caption', description='', tags=[]))
    facade = SimpleNamespace(publish_video=AsyncMock(side_effect=PublisherError('synthetic ambiguous result')))
    await engine.publish_entry(facade, entry)
    await engine.publish_entry(facade, entry)
    assert [call.kwargs['idempotency_key'] for call in facade.publish_video.await_args_list] == ['schedule:same-entry'] * 2


@pytest.mark.parametrize('method,path,payload', [
    ('POST', '/api/v1/publish/', {'video_path': 'unused', 'title': 'test'}),
    ('PUT', '/api/v1/publish/tiktok/test/123', {'title': 'test'}),
    ('DELETE', '/api/v1/publish/tiktok/test/123', None),
    ('PATCH', '/api/v1/publish/accounts/tiktok/test', {'label': 'test'}),
    ('DELETE', '/api/v1/publish/accounts/tiktok/test', None),
    ('POST', '/api/v1/schedule/publish-now', {'job_id': 'test', 'platform': 'tiktok', 'account_alias': 'test'}),
    ('POST', '/api/v1/schedule/queue', {'job_id': 'test', 'platform': 'tiktok', 'account_alias': 'test'}),
    ('POST', '/api/v1/schedule/slots', {'platform': 'tiktok', 'account_alias': 'test'}),
])
async def test_publication_mutations_require_internal_auth(api_client, monkeypatch, method, path, payload):
    from src.config.settings import settings
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'nexa_internal_token', 'synthetic-key')
    response = await api_client.request(method, path, json=payload)
    assert response.status_code == 403


@pytest.mark.parametrize('platform', ['tiktok', 'youtube', 'facebook'])
async def test_oauth_callbacks_stay_public(api_client, monkeypatch, platform):
    from src.config.settings import settings
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'nexa_internal_token', 'synthetic-key')
    response = await api_client.get(f'/api/v1/publish/auth/{platform}/callback')
    assert response.status_code == 400  # Missing OAuth code, not an internal-auth rejection.


async def test_signed_import_stays_public_and_one_use(api_client, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import Mock
    from src.config.settings import settings
    from src.presentation.api.routers import publisher
    from src.adapters.publishing.tiktok_service import pairing
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'nexa_internal_token', 'synthetic-key')
    monkeypatch.setattr(settings, 'nexa_link_secret', 'synthetic-link-secret')
    saved = Mock()
    monkeypatch.setattr(publisher, '_get_facade', lambda: SimpleNamespace(
        _token_manager=SimpleNamespace(_storage=SimpleNamespace(save_browser_account=saved))))

    async def imported(*args, **kwargs):
        return {'identity': {'username': 'test'}}

    monkeypatch.setattr(TikTokServiceClient, 'request', imported)
    pairing_id, url = pairing.create_pairing('test', 'http://test')
    try:
        payload = {'cookies': [{'name': 'sessionid', 'value': 'synthetic', 'domain': '.tiktok.com'}], 'expected_username': 'test'}
        assert (await api_client.post(url.split('?')[0], json=payload)).status_code == 401
        assert (await api_client.post(url, json=payload)).status_code == 200
        assert (await api_client.post(url, json=payload)).status_code == 401
        saved.assert_called_once()
    finally:
        with pairing._lock:
            pairing._pairings.pop(pairing_id, None)
