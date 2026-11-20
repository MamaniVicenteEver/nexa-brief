"""Persistencia y coordinación reales en perfiles temporales v2/v3."""
import asyncio
import json
import pytest
from src.adapters.data.json_store import JsonDataStore
from src.config.profile_layout import resolve_profile_layout
from src.config.settings import settings
from src.core.data import set_data_store
from src.core.job import Job, JobInput, JobArtifacts
from src.core.nodemotion.promo.service import PromoChatService

@pytest.fixture(params=[2, 3])
def store(request, tmp_path, monkeypatch):
    layout = resolve_profile_layout(tmp_path / 'profile', request.param)
    layout.root.mkdir()
    monkeypatch.setattr(settings, 'data_dir', layout.data_dir)
    monkeypatch.setattr(settings, 'storage_profile_dir', layout.root)
    monkeypatch.setattr(settings, 'storage_layout_version', request.param)
    store = JsonDataStore()
    set_data_store(store)
    yield store, layout
    set_data_store(None)

@pytest.mark.asyncio
async def test_real_collection_approval_and_fingerprint(store):
    store, layout = store
    content = layout.sandbox_dir / 'nodemotion' / 'example'
    content.mkdir(parents=True)
    for name, data in [('index.html', '<html></html>'), ('config.json', '{}'), ('lyrics.json', '{}')]:
        (content / name).write_text(data)
    draft = {'draft_id':'demo123', 'template_id':'promo-dynamic', 'niche_id':'n', 'status':'prepared', 'errors':[],
             'preview_url':'/preview', 'details':{'copies':{p:{'title':'T','description':'D'} for p in ('youtube','facebook','instagram','tiktok')}},
             'thumbnails':{'options':{'A':{'text':'A'},'B':{'text':'B'}}}}
    await store.collection('drafts').insert(draft)
    job = Job(input=JobInput(category_name='test'), artifacts=JobArtifacts(output_dir=content))
    store.documents('draft_jobs').put('demo123', job.model_dump(mode='json'))
    service = PromoChatService()
    row, duplicate = await asyncio.gather(service.import_legacy('demo123'), service.import_legacy('demo123'))
    assert row['session_id'] == duplicate['session_id']
    assert row['state'] == 'review' and row['quality']['passed']
    result = await service.approve(row['session_id'], 1)
    assert result['state'] == 'ready' and service.get(row['session_id'])['approved_revision'] == 1
    (content / 'lyrics.json').write_text('{"changed":true}')
    assert service.get(row['session_id'])['state'] == 'review'
    assert (await service.import_legacy('demo123'))['revision'] == 2
    if layout.schema_version == 3:
        assert 'promo_chat_sessions' in json.loads((layout.data_dir/'json/jobs.json').read_text())['collections']
    else:
        assert (layout.data_dir/'promos/chat-sessions.json').exists()

@pytest.mark.asyncio
async def test_real_locks_cancel_and_validate(store):
    store, layout = store
    host = store.coordination('promo-host-preparation')
    assert host.timeout == 7200
    assert store.coordination('promo-chat-' + 'a'*32).timeout == 150
    store.coordination('promo-chat-import-draft_1')
    for invalid in ('promo-chat-../evil', 'promo-chat-' + 'a'*33, 'promo-chat-import-../evil', 'promo-chat-import-' + 'x'*129):
        with pytest.raises(KeyError): store.coordination(invalid)
    async with host:
        blocked = asyncio.create_task(store.coordination('promo-host-preparation').__aenter__())
        await asyncio.sleep(.08)
        assert not blocked.done()
        blocked.cancel()
        with pytest.raises(asyncio.CancelledError): await blocked
    async with store.coordination('promo-host-preparation'):
        pass
    assert list((layout.runtime_dir / 'locks').glob('*.lock'))
