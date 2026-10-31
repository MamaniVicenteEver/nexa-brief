import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from src.core.data import collection
from src.core.schedule import queue_repository
from src.presentation.api.routers import schedule


async def test_publish_now_retries_reuse_persisted_entry(api_client, monkeypatch):
    calls = []
    release = asyncio.Event()

    async def publish(_facade, entry):
        claimed = await queue_repository.mark_publishing(entry.entry_id)
        if claimed:
            calls.append(entry.idempotency_key)
            await release.wait()

    monkeypatch.setattr(schedule, '_get_facade', lambda: object())
    monkeypatch.setattr(schedule.engine, 'publish_entry', publish)
    monkeypatch.setattr(queue_repository, '_publish_event', AsyncMock())
    body = {'job_id': 'video', 'platform': 'tiktok', 'account_alias': 'test',
            'idempotency_key': 'attempt-1'}
    try:
        # Discard the first response, as if the connection failed after commit.
        first = await api_client.post('/api/v1/schedule/publish-now', json=body)
        second = await api_client.post('/api/v1/schedule/publish-now', json=body)
        await asyncio.sleep(.05)
        assert first.status_code == second.status_code == 202
        assert first.json()['entry_id'] == second.json()['entry_id']
        entries = collection('queue_entries').list()
        assert len(entries) == 1
        assert entries[0]['idempotency_key'] == 'attempt-1'
        assert calls == ['attempt-1']
        conflict = await api_client.post('/api/v1/schedule/publish-now', json={**body, 'account_alias': 'other'})
        assert conflict.status_code == 409
    finally:
        release.set()
        if schedule._publish_tasks:
            await asyncio.gather(*list(schedule._publish_tasks))


async def test_engine_sends_persisted_key_to_facade(tmp_path, monkeypatch):
    from src.core.schedule import engine
    from src.core.schedule.models import QueueEntry, QueueSource

    path = tmp_path / 'video.mp4'
    path.touch()
    entry = QueueEntry(entry_id='entry', job_id='video', platform='tiktok', account_alias='test',
                       source=QueueSource.IMMEDIATE, created_at='now', updated_at='now',
                       idempotency_key='attempt-1')
    monkeypatch.setattr(queue_repository, 'mark_publishing', AsyncMock(return_value=entry))
    monkeypatch.setattr(queue_repository, 'mark_published', AsyncMock(return_value=entry))
    monkeypatch.setattr(engine.job_tracker, 'get', lambda _: {'file_paths': {'tiktok': str(path)}})
    monkeypatch.setattr(engine.job_tracker, 'format_paths', lambda _: {})
    monkeypatch.setattr(engine.job_tracker, 'get_summary', lambda _: {})
    facade = SimpleNamespace(publish_video=AsyncMock(return_value=SimpleNamespace(post_id='1', url='url')))
    await engine.publish_entry(facade, entry)
    assert facade.publish_video.await_args.kwargs['idempotency_key'] == 'attempt-1'
