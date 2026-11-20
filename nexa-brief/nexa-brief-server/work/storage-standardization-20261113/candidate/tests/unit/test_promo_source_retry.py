import asyncio
from unittest.mock import AsyncMock
import pytest
from src.core.promos import pipeline, evidence, research


def session():
    return {'messages':[{'role':'user','content':'aurora'}], 'revision':1, 'provider':'claude', 'prompt_ref':{'version':'v5'}}


def doc(url):
    return {'url':url, 'text':'consultado'}


def test_retry_fetch_succeeds_without_replanning(tmp_path, monkeypatch):
    a,b='https://a.org/x','https://b.org/y'
    plan=AsyncMock(return_value={'topic':'aurora','source_urls':[a,b]})
    fetch=AsyncMock(side_effect=[[doc(a)],[doc(b)]])
    monkeypatch.setattr(pipeline,'discovery_plan',plan)
    monkeypatch.setattr(evidence,'gather_evidence',fetch)
    monkeypatch.setattr(research,'gather',AsyncMock(return_value=[]))
    assert len(asyncio.run(pipeline.source_context(session(),tmp_path,AsyncMock())))==2
    assert fetch.await_args_list[1].args[0]==[b]
    assert plan.await_count==1


def test_failed_fetch_replans_once_and_excludes_attempted_urls(tmp_path, monkeypatch):
    a,b='https://a.org/x','https://b.org/y'
    plan=AsyncMock(side_effect=[{'topic':'one','source_urls':[a]},{'topic':'two','source_urls':[a,b]}])
    fetch=AsyncMock(side_effect=[[],[],[doc(b)]])
    monkeypatch.setattr(pipeline,'discovery_plan',plan)
    monkeypatch.setattr(evidence,'gather_evidence',fetch)
    monkeypatch.setattr(research,'gather',AsyncMock(return_value=[]))
    with pytest.raises(ValueError,match='dos fuentes'):
        asyncio.run(pipeline.source_context(session(),tmp_path,AsyncMock()))
    assert plan.await_count==2 and plan.await_args.kwargs['attempt']==2
    assert plan.await_args.kwargs['feedback']['failed_urls']==[a]
    assert fetch.await_args_list[2].args[0]==[b]


def test_exhaustion_preserves_evidence_attempt_receipts(tmp_path,monkeypatch):
    async def fail(url): raise evidence.EvidenceError('falló')
    monkeypatch.setattr(evidence,'_fetch',fail)
    monkeypatch.setattr(pipeline,'discovery_plan',AsyncMock(side_effect=[{'topic':'one','source_urls':['https://a.org/x']},{'topic':'two','source_urls':['https://b.org/y']}]))
    monkeypatch.setattr(research,'gather',AsyncMock(return_value=[]))
    progress=AsyncMock()
    with pytest.raises(ValueError,match='dos fuentes'):
        asyncio.run(pipeline.source_context(session(),tmp_path,progress))
    assert len(list((tmp_path/'work/research').glob('evidence-attempt-*.json')))==3
    assert progress.await_count==3


def test_retry_private_url_uses_existing_public_destination_guard(tmp_path, monkeypatch):
    private='http://127.0.0.1/internal'
    monkeypatch.setattr(pipeline,'discovery_plan',AsyncMock(side_effect=[{'topic':'one','source_urls':[private]},{'topic':'two','source_urls':[]}]))
    monkeypatch.setattr(research,'gather',AsyncMock(return_value=[]))
    with pytest.raises(ValueError, match='dos fuentes'):
        asyncio.run(pipeline.source_context(session(),tmp_path,AsyncMock()))
    import json
    receipts=list((tmp_path/'work/research').glob('evidence-attempt-*.json'))
    assert len(receipts)==2
    assert all(json.loads(path.read_text())['errors'][0]['error']=='Destino no público' for path in receipts)
