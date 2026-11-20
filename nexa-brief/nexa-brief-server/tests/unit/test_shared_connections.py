"""Multiple API processes share auth and channel profiles, never their job queues."""
import asyncio
from multiprocessing import get_context
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from cryptography.fernet import Fernet

from src.adapters.publishing.token_storage import TokenStorage
from src.adapters.publishing.token_manager import TokenManager
from src.adapters.publishing.tiktok_service.adapter import TikTokServiceAdapter
from src.adapters.publishing.tiktok_service.client import TikTokServiceClient
from src.config.settings import settings
from src.core.data import collection


def test_stale_writer_keeps_another_environments_new_channel(tmp_path):
    key = Fernet.generate_key().decode()
    first = TokenStorage(tmp_path / 'accounts.json', key)
    second = TokenStorage(tmp_path / 'accounts.json', key)
    first.save_tokens('youtube', 'production', access_token='synthetic-one')
    second.save_tokens('youtube', 'development', access_token='synthetic-two')
    assert {a['alias'] for a in first.list_accounts()} == {'production', 'development'}
    assert first.decrypt(first.get_state('youtube', 'development').encrypted_access_token) == 'synthetic-two'


def test_profile_update_and_token_refresh_do_not_overwrite_each_other(tmp_path):
    key = Fernet.generate_key().decode()
    first = TokenStorage(tmp_path / 'accounts.json', key)
    first.save_tokens('youtube', 'one', access_token='old')
    second = TokenStorage(tmp_path / 'accounts.json', key)
    first.update_metadata('youtube', 'one', label='Shared label')
    second.save_tokens('youtube', 'one', access_token='new')
    assert first.list_accounts()[0]['label'] == 'Shared label'
    assert first.decrypt(first.get_state('youtube', 'one').encrypted_access_token) == 'new'
    assert (tmp_path / 'accounts.json').stat().st_mode & 0o777 == 0o600


def test_remove_last_known_alias_keeps_a_concurrently_added_alias(tmp_path):
    key = Fernet.generate_key().decode()
    first = TokenStorage(tmp_path / 'accounts.json', key)
    first.save_tokens('youtube', 'one', access_token='one')
    second = TokenStorage(tmp_path / 'accounts.json', key)
    second.save_tokens('youtube', 'two', access_token='two')
    first.remove_account('youtube', 'one')
    assert [a['alias'] for a in first.list_accounts()] == ['two']


def _write_accounts(path, key, prefix):
    storage = TokenStorage(Path(path), key)
    for index in range(12):
        storage.save_tokens('youtube', f'{prefix}-{index}', access_token='synthetic')


def test_independent_processes_keep_all_connections(tmp_path):
    key = Fernet.generate_key().decode()
    path = tmp_path / 'accounts.json'
    context = get_context('fork')
    processes = [context.Process(target=_write_accounts, args=(str(path), key, prefix)) for prefix in ('prod', 'dev')]
    for process in processes:
        process.start()
    for process in processes:
        process.join(timeout=15)
        assert process.exitcode == 0
    assert len(TokenStorage(path, key).list_accounts()) == 24


async def test_two_managers_only_refresh_a_connection_once(tmp_path, monkeypatch):
    key = Fernet.generate_key().decode()
    path = tmp_path / 'accounts.json'
    first = TokenStorage(path, key)
    first.save_tokens('youtube', 'one', access_token='old', refresh_token='synthetic-refresh', expires_in=1)
    second = TokenStorage(path, key)
    monkeypatch.setattr(settings, 'youtube_client_id', 'synthetic-client')
    monkeypatch.setattr(settings, 'youtube_client_secret', 'synthetic-secret')
    async def refresh(*args, **kwargs):
        await asyncio.sleep(.05)
        return httpx.Response(200, json={'access_token': 'fresh', 'expires_in': 7200})
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.post = AsyncMock(side_effect=refresh)
    with patch('httpx.AsyncClient', return_value=client):
        results = await asyncio.gather(TokenManager(first).get_valid_token('youtube', 'one'), TokenManager(second).get_valid_token('youtube', 'one'))
    assert results == ['fresh', 'fresh']
    client.post.assert_awaited_once()


async def test_only_channel_metadata_uses_the_shared_directory(tmp_path, monkeypatch):
    shared = tmp_path / 'shared'
    monkeypatch.setattr(settings, 'shared_connections_dir', shared)
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'prod')
    await collection('channels').upsert({'platform': 'youtube', 'alias': 'one', 'status': 'ok'}, match=('platform', 'alias'))
    await collection('jobs').upsert({'job_id': 'production-job'}, match=('job_id',))
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'dev')
    assert collection('channels').first({'alias': 'one'})['status'] == 'ok'
    assert collection('jobs').list() == []
    await collection('channels').upsert({'platform': 'youtube', 'alias': 'one', 'youtube_thumbnail_capability': {'state': 'enabled'}}, match=('platform', 'alias'))
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'prod')
    assert collection('channels').first({'alias': 'one'})['youtube_thumbnail_capability']['state'] == 'enabled'
    assert len(collection('jobs').list()) == 1


async def test_container_media_is_uploaded_without_using_its_local_path(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'tiktok_service_upload_media', True)
    video = tmp_path / 'video.mp4'
    video.write_bytes(b'synthetic-video')
    def handle(request):
        assert request.method == 'PUT'
        assert request.content == b'synthetic-video'
        assert request.headers['X-Nexa-Tiktok-Key'] == 'synthetic-key'
        return httpx.Response(200, json={'path': '/central/uploads/synthetic.mp4'})
    client = TikTokServiceClient('http://test', 'synthetic-key', httpx.MockTransport(handle))
    assert await client.stage_media(video) == '/central/uploads/synthetic.mp4'


def test_development_and_production_have_different_operation_keys(monkeypatch):
    monkeypatch.setattr(settings, 'tiktok_idempotency_namespace', 'development')
    development = TikTokServiceAdapter._operation_key('same-job')
    monkeypatch.setattr(settings, 'tiktok_idempotency_namespace', 'production')
    production = TikTokServiceAdapter._operation_key('same-job')
    assert development != production
    assert len(development) < 200
