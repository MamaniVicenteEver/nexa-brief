"""Owner-only feature evidence; automatic reads never publish or infer all permissions."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.adapters.publishing.youtube_adapter import YouTubeAdapter
from src.config.exceptions import PublisherError
from src.config.settings import settings
from src.core.data import collection
from src.core.youtube_capabilities import (
    feature_access, feature_access_needs_refresh, record_feature_access, thumbnail_capability,
)
from src.presentation.api.routers import publisher


@pytest.mark.parametrize('raw,state', [('allowed','enabled'),('eligible','verification_required'),('disallowed','restricted'),(None,'unknown'),('new_value','unknown'),({},'unknown')])
async def test_api_states_never_assume_thumbnail_or_general_verification(raw, state):
    await record_feature_access('one','UC1',raw)
    access=feature_access('one','UC1')
    assert access['state']==state
    assert access['checked_at'] is not None
    assert not access['stale']
    assert thumbnail_capability('one','UC1')['state']=='unknown'
    assert 'phone_verified' not in access


async def test_new_channel_and_different_identity_have_no_inherited_access():
    await record_feature_access('one','UC1','allowed')
    assert feature_access('two','UC2')['state']=='unknown'
    assert feature_access('one','UC_OTHER')['state']=='unknown'
    assert feature_access_needs_refresh('two','UC2')
    assert feature_access_needs_refresh('one','UC_OTHER')


@pytest.mark.parametrize('raw,age,stale',[('allowed',3600,False),('allowed',21601,True),(None,901,True),(None,600,False)])
async def test_refresh_ttl_respects_unknown_and_confirmed_evidence(raw,age,stale):
    with patch('src.core.youtube_capabilities.time.time',return_value=100_000):
        await record_feature_access('one','UC1',raw)
    with patch('src.core.youtube_capabilities.time.time',return_value=100_000+age):
        assert feature_access_needs_refresh('one','UC1') is stale


def adapter_with_response(resource):
    manager=MagicMock()
    manager.get_valid_token=AsyncMock(return_value='synthetic-token')
    manager.target_id.return_value='UC1'
    adapter=YouTubeAdapter(manager)
    client=MagicMock()
    client.__aenter__.return_value=client
    client.get=AsyncMock(return_value=httpx.Response(200,json={'items':[resource]}))
    return adapter,client


async def test_profile_reads_owner_status_without_uploads():
    adapter,client=adapter_with_response({'id':'UC1','snippet':{'title':'One'},'status':{'longUploadsStatus':'allowed'}})
    with patch.object(adapter,'_make_client',return_value=client):
        profile=await adapter.get_channel_profile('one',expected_channel_id='UC1')
    assert profile.channel_id=='UC1'
    assert profile.long_uploads_status=='allowed'
    assert client.get.call_args.kwargs['params']['part']=='snippet,status'
    assert client.get.call_args.kwargs['params']['mine']=='true'
    assert feature_access('one','UC1')['state']=='enabled'
    client.post.assert_not_called()


async def test_unexpected_profile_identity_never_creates_access():
    adapter,client=adapter_with_response({'id':'UC_WRONG','snippet':{'title':'Wrong'},'status':{'longUploadsStatus':'allowed'}})
    with patch.object(adapter,'_make_client',return_value=client):
        assert await adapter.get_channel_profile('one',expected_channel_id='UC1') is None
    assert collection('channels').list()==[]


async def test_catalog_records_access_only_for_expected_channel():
    adapter,client=adapter_with_response({'id':'UC1','status':{'longUploadsStatus':'eligible'}})
    with patch.object(adapter,'_make_client',return_value=client):
        await adapter._own_channel('one')
    assert feature_access('one','UC1')['state']=='verification_required'


async def test_catalog_identity_mismatch_does_not_enable_channel():
    adapter,client=adapter_with_response({'id':'UC_WRONG','status':{'longUploadsStatus':'allowed'}})
    with patch.object(adapter,'_make_client',return_value=client),pytest.raises(PublisherError):
        await adapter._own_channel('one')
    assert feature_access('one','UC1')['state']=='unknown'


async def test_two_concurrent_background_reads_share_one_check(tmp_path,monkeypatch):
    monkeypatch.setattr(settings,'accounts_json_path',tmp_path/'opaque.json')
    adapter=MagicMock()
    async def read(*args,**kwargs):
        await asyncio.sleep(.03)
        await record_feature_access('one','UC1','allowed')
        return MagicMock(channel_id='UC1')
    adapter.get_channel_profile=AsyncMock(side_effect=read)
    account={'alias':'one','target_id':'UC1'}
    await asyncio.gather(publisher._refresh_youtube_access(account,adapter),publisher._refresh_youtube_access(account,adapter))
    adapter.get_channel_profile.assert_awaited_once()


async def test_refresh_failure_preserves_previous_evidence_and_throttles(tmp_path,monkeypatch):
    monkeypatch.setattr(settings,'accounts_json_path',tmp_path/'opaque.json')
    with patch('src.core.youtube_capabilities.time.time',return_value=100_000):
        await record_feature_access('one','UC1','allowed')
    adapter=MagicMock()
    adapter.get_channel_profile=AsyncMock(side_effect=httpx.ConnectError('synthetic outage'))
    await publisher._refresh_youtube_access({'alias':'one','target_id':'UC1'},adapter)
    access=feature_access('one','UC1')
    assert access['state']=='enabled'
    assert access['stale']
    assert publisher._youtube_access_retry_at[('one','UC1')]>0
    publisher._youtube_access_retry_at.clear()


async def test_get_schedules_once_without_waiting_for_youtube():
    started=asyncio.Event()
    finish=asyncio.Event()
    async def read(*args):
        started.set()
        await finish.wait()
    adapter=MagicMock(spec=YouTubeAdapter)
    facade=MagicMock()
    facade._adapters={'youtube':adapter}
    account={'platform':'youtube','alias':'new','target_id':'UCNEW','status':'ok'}
    with patch.object(publisher,'_refresh_youtube_access',side_effect=read) as refresh:
        publisher._schedule_youtube_access_checks([account],facade)
        publisher._schedule_youtube_access_checks([account],facade)
        await asyncio.wait_for(started.wait(),1)
        assert refresh.call_count==1
        assert len(publisher._youtube_access_tasks)==1
        finish.set()
        await asyncio.gather(*publisher._youtube_access_tasks.values())
        await asyncio.sleep(0)
    assert not publisher._youtube_access_tasks


async def test_get_projects_access_separately_from_connection(api_client):
    await record_feature_access('one','UC1','eligible')
    facade=MagicMock()
    facade.list_accounts.return_value=[{'platform':'youtube','alias':'one','target_id':'UC1','name':'One','status':'ok','expires_in_seconds':100,'has_refresh_token':True}]
    with patch.object(publisher,'_get_facade',return_value=facade):
        response=await api_client.get('/api/v1/publish/accounts')
    assert response.status_code==200
    account=response.json()[0]
    assert account['status']=='ok'
    assert account['youtube_feature_access']['state']=='verification_required'
    assert account['youtube_thumbnail_capability']['state']=='unknown'
