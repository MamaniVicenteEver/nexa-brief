"""Rebuild del host: conserva las revisiones y evita repetir inferencias."""
import json
from unittest.mock import AsyncMock
import pytest
from src.core.nodemotion.promo import pipeline
from src.core.nodemotion.promo.prompts import reference
from test_promo_pipeline import proposal


@pytest.mark.asyncio
async def test_retry_rebuilds_preview_preserves_old_draft_and_reuses_publication(tmp_path, monkeypatch):
    sid='a'*32;project=tmp_path/sid;project.mkdir();target=tmp_path/(sid+'-r1');target.mkdir()
    data=proposal('promo-kinetic');brief,research,guion,plan=pipeline.prepare_data({'template_id':'promo-kinetic'},data)
    normalized={**data,'brief':brief,'research':research,'guion':guion,'media_plan':plan}
    session={'session_id':sid,'revision':1,'template_id':'promo-kinetic','provider':'claude','resume_host':True,
             'prompt_ref':reference('v3'),'proposal':normalized,'source_context':[{'url':s['url'],'text':'contenido'} for s in research['findings'][0]['sources']]}
    for path,value in [('brief.json',brief),('work/research/input.json',research),('work/script.json',guion),('media-plan.json',plan),('draft.json',{'draft_id':'old'}),('work/instructions/prompts-version.json',reference('v3'))]:
        pipeline.write(target/path,value)
    rows={'old':{'status':'prepared','details':{'copies':{'youtube':{'title':'revisado'}}},'thumbnails':{'options':{'A':{'text':'PRIMOS'},'B':{'text':'PRIMOS'}}}},'new':{'status':'prepared'}}
    monkeypatch.setattr(pipeline,'collection',lambda _:type('Rows',(),{'get':lambda self,k:rows.get(k)})())
    calls=[]
    async def tool(folder,stage,args,progress,**kwargs):
        calls.append((stage,args))
        if stage=='rhythm':pipeline.write(folder/'assets/lyrics.json',{'segments':[]})
        if stage=='preview':pipeline.write(folder/'draft.json',{'draft_id':'new'})
        if stage=='quality':return 0,{'ready':True,'coverage':{'full':True}}
        return 0,{}
    monkeypatch.setattr(pipeline,'tool',tool)
    monkeypatch.setattr(pipeline,'inspect_existing',AsyncMock(return_value={'passed':True,'checks':[],'errors':[],'warnings':[]}))
    ai=AsyncMock(side_effect=AssertionError('No debe repetir copy ni investigación'))
    monkeypatch.setattr(pipeline,'_prepare_publication',ai)
    monkeypatch.setattr(pipeline,'source_context',ai)
    monkeypatch.setattr(pipeline,'_repair_proposal',ai)
    result=await pipeline._prepare(session,project,normalized,AsyncMock())
    assert result['draft_id']=='new' and rows['old']['status']=='prepared'
    args=next(args for stage,args in calls if stage=='preview')
    assert '--keep-previous' in args and '--defer-preparation' in args
    assert result['quality']['passed']
    ai.assert_not_awaited()

@pytest.mark.asyncio
@pytest.mark.parametrize('present', [[], ['brief.json'], ['brief.json', 'work/script.json', 'work/instructions/prompts-version.json']])
async def test_resume_partial_directory_restores_only_missing_without_replacing_existing(tmp_path, monkeypatch, present):
    sid = 'b' * 32
    project = tmp_path / sid
    project.mkdir()
    target = tmp_path / (sid + '-r1')
    target.mkdir()
    raw = proposal('promo-kinetic')
    brief, research, guion, plan = pipeline.prepare_data({'template_id': 'promo-kinetic'}, raw)
    data = {**raw, 'brief':brief, 'research':research, 'guion':guion, 'media_plan':plan}
    session = {'session_id':sid, 'revision':1, 'template_id':'promo-kinetic', 'provider':'claude',
               'resume_host':True, 'prompt_ref':reference('v3'), 'proposal':data,
               'source_context':[{'url':s['url'], 'text':'contenido'} for s in research['findings'][0]['sources']]}
    files = {'brief.json':brief, 'work/script.json':guion, 'work/instructions/prompts-version.json':reference('v3')}
    for path in present: pipeline.write(target/path, files[path])
    before = {path:(target/path).read_bytes() for path in present}
    rows = {'new':{'status':'prepared'}}
    monkeypatch.setattr(pipeline, 'collection', lambda _:type('Rows',(),{'get':lambda self,k:rows.get(k)})())
    async def tool(folder, stage, args, progress, **kw):
        if stage == 'rhythm': pipeline.write(folder/'assets/lyrics.json', {'segments':[]})
        if stage == 'preview': pipeline.write(folder/'draft.json', {'draft_id':'new'})
        if stage == 'quality': return 0, {'ready':True}
        return 0, {}
    monkeypatch.setattr(pipeline, 'tool', tool)
    monkeypatch.setattr(pipeline, 'inspect_existing', AsyncMock(return_value={'passed':True,'checks':[],'errors':[],'warnings':[]}))
    monkeypatch.setattr(pipeline, '_prepare_publication', AsyncMock())
    forbidden = AsyncMock(side_effect=AssertionError('No se debe rehacer guion ni búsqueda'))
    monkeypatch.setattr(pipeline, '_repair_proposal', forbidden)
    monkeypatch.setattr(pipeline, 'source_context', forbidden)
    result = await pipeline._prepare(session, project, data, AsyncMock())
    assert result['draft_id'] == 'new'
    assert all((target/path).read_bytes() == value for path,value in before.items())
    for path in ('brief.json','work/script.json','work/research/input.json','media-plan.json','work/instructions/prompts-version.json'):
        assert (target/path).is_file()
    forbidden.assert_not_awaited()

@pytest.mark.asyncio
async def test_unresolved_slot_removes_stale_id_from_all_uses(tmp_path, monkeypatch):
    items = [{'scene':1,'slot':'hero','kind':'video','query':'ciudad','asset_id':'stale'},
             {'scene':2,'slot':'hero','kind':'video','query':'ciudad','asset_id':'stale'}]
    pipeline.write(tmp_path/'media-plan.json', {'items':items})
    pipeline.write(tmp_path/'assets/lyrics.json', {'segments':[{'start':0,'end':2},{'start':2,'end':4}]})
    async def reject(target,ident,progress):
        value=pipeline.read(target/'media-plan.json')
        value['items'][0].pop('asset_id')
        pipeline.write(target/'media-plan.json',value)
        raise ValueError('Sin medios')
    monkeypatch.setattr(pipeline, '_resolve_unique_media', reject)
    with pytest.raises(ValueError, match='Sin medios'):
        await pipeline._resolve_media(tmp_path,'demo',AsyncMock())
    assert all('asset_id' not in item for item in pipeline.read(tmp_path/'media-plan.json')['items'])

@pytest.mark.asyncio
async def test_shared_slot_rejects_conflicting_criteria_before_fetch(tmp_path, monkeypatch):
    items = [{'scene':1,'slot':'hero','kind':'image','query':'ciudad','required_terms':['Valparaíso']},
             {'scene':2,'slot':'hero','kind':'image','query':'ciudad','required_terms':['Santiago']}]
    pipeline.write(tmp_path/'media-plan.json', {'items':items})
    pipeline.write(tmp_path/'assets/lyrics.json', {'segments':[{'start':0,'end':2},{'start':2,'end':4}]})
    resolver=AsyncMock()
    monkeypatch.setattr(pipeline,'_resolve_unique_media',resolver)
    with pytest.raises(ValueError, match='criterios incompatibles'):
        await pipeline._resolve_media(tmp_path,'demo',AsyncMock())
    resolver.assert_not_awaited()
    assert pipeline.read(tmp_path/'media-plan.json')['items'] == items
