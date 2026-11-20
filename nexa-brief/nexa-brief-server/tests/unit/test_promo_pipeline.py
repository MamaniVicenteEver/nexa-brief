"""Contratos reales de las seis promos y guardas de confirmación humana."""
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from src.core.nodemotion.promo import pipeline,readiness,usage
from src.core.nodemotion.promo.prompts import SKILL,TEMPLATES


def proposal(template):
    contract=json.loads((SKILL/'templates'/f'{template}.json').read_text())
    schema=json.loads((SKILL/'schemas'/f'build-{template.removeprefix("promo-")}.json').read_text())
    texts={key:'TEMA' for key in schema['properties']['texts'].get('required',[])}
    count=len(contract['default_scenes']);cycles=1
    while count*cycles*2.4<60:cycles+=1
    count*=cycles;duration=max(60,count*2)
    return {'reply':'Propuesta', 'brief':{'template':template,'topic':'Un tema','tone':'claro','duration_seconds':duration,'language':'es','audience':'general','name':'Un tema','texts':texts},
        'research':{'topic':'Un tema','findings':[{'id':'f1','claim':'Hecho proporcionado','sources':[{'title':'A','url':'https://a.example.org/fact','data_date':None,'accessed_at':'2026-11-12'},{'title':'B','url':'https://b.example.net/fact','data_date':'2026','accessed_at':'2026-11-12'}]}]},
        'guion':{'template':template,'duration_seconds':duration,'segments':[{'n':i+1,'scene':contract['default_scenes'][i%len(contract['default_scenes'])]['type'],'lines':['TEMA'] * contract['default_scenes'][i%len(contract['default_scenes'])].get('min_text_lines', 1),'facts':['f1']} for i in range(count)]},'media_plan':{'items':[]}}


@pytest.mark.parametrize('template',sorted(TEMPLATES))
def test_six_contracts_produce_exact_media_slots_and_accept_undated_sources(template):
    data=proposal(template)
    brief,research,guion,plan=pipeline.prepare_data({'template_id':template},data)
    contract=json.loads((SKILL/'templates'/f'{template}.json').read_text())
    assert {(x['scene'],x['slot']) for x in plan['items']}=={(i+1,slot) for i,scene in enumerate(contract['default_scenes']) for slot in scene.get('media',[])}
    assert research['findings'][0]['sources'][0]['data_date'] is None
    assert brief['template']==template and len(guion['segments'])%len(contract['default_scenes'])==0


def test_factual_refs_and_independent_sources_are_required():
    data=proposal('promo-kinetic');data['guion']['segments'][0].update(lines=['17 PRIMOS'],facts=[])
    with pytest.raises(ValueError,match='factuales'):pipeline.prepare_data({'template_id':'promo-kinetic'},data)
    data=proposal('promo-kinetic');data['research']['findings'][0]['sources'][1]['url']='https://a.example.org/other'
    with pytest.raises(ValueError,match='independientes'):pipeline.prepare_data({'template_id':'promo-kinetic'},data)


def test_photo_fallback_restores_video_contract_and_retains_derived_id(tmp_path,monkeypatch):
    pipeline.write(tmp_path/'media-plan.json',{'items':[{'scene':1,'slot':'hero','kind':'video','query':'tema'}]})
    pipeline.write(tmp_path/'assets/lyrics.json',{'segments':[{'start':0,'end':2}]})
    async def tool(target,stage,args,progress,**kw):
        if stage=='media-photo-fallback':
            plan=pipeline.read(target/'media-plan.json');plan['items'][0]['asset_id']='photo';pipeline.write(target/'media-plan.json',plan)
        if stage.startswith('derive-'):
            assert args[args.index('--asset')+1]=='photo'
            return 0,{'id':'derived-video'}
        return 1,None
    monkeypatch.setattr(pipeline,'tool',tool)
    asyncio.run(pipeline._resolve_media(tmp_path,'demo',AsyncMock()))
    assert pipeline.read(tmp_path/'media-plan.json')['items'][0]['asset_id']=='derived-video'
    assert pipeline.read(tmp_path/'media-plan.json')['items'][0]['kind']=='video'


def test_recording_requires_approval_current_revision_and_matching_content(monkeypatch):
    from src.core import data
    from src.core.drafts import Draft
    monkeypatch.setattr(readiness,'_content_files',lambda ident:({},None))
    draft=Draft(draft_id='d1',template_id='promo-kinetic',niche_id='test',status='prepared',created_at='now',updated_at='now')
    rows=[]
    monkeypatch.setattr(data,'collection',lambda name:SimpleNamespace(list=lambda **kw:rows))
    assert not readiness.approved_for_recording(draft)
    rows.append({'draft_id':'d1','state':'review','revision':1,'approved_revision':None,'quality':{'passed':True}})
    assert not readiness.approved_for_recording(draft)
    rows[0].update(state='ready',approved_revision=1,reviewed_fingerprint=readiness.snapshot_fingerprint(draft.model_dump(mode='json')))
    assert readiness.approved_for_recording(draft)
    rows[0]['archived_at'] = '2026'
    assert readiness.is_archived_draft(draft)
    assert not readiness.approved_for_recording(draft)
    del rows[0]['archived_at']
    rows[0]['revision']=2
    assert not readiness.approved_for_recording(draft)
    rows[0]['revision']=1
    changed=draft.model_copy(update={'preview_url':'/new-preview'})
    assert not readiness.approved_for_recording(changed)


def test_demo_recording_uses_only_server_assigned_original_and_complete_details(monkeypatch):
    from src.core import data
    from src.core.draft_details import DraftDetails
    from src.core.drafts import Draft
    from src.presentation.api.schemas.draft_schema import DraftCreateRequest, DraftUpdateRequest

    # Campos ajenos a los contratos públicos no crean ni convierten una demo.
    assert not hasattr(DraftCreateRequest(template_id='promo-kinetic', original=True), 'original')
    assert not hasattr(DraftUpdateRequest(name='Demo', original=True), 'original')
    monkeypatch.setattr(data, 'collection', lambda name: SimpleNamespace(list=lambda **kw: []))
    demo = Draft(draft_id='demo', template_id='promo-kinetic', niche_id='test',
                 original=True, status='prepared', created_at='now', updated_at='now')
    assert not readiness.approved_for_recording(demo)
    # La autenticidad de `original` la establece el endpoint, no el nombre visible.
    complete = demo.model_copy(update={'details': DraftDetails()})
    assert readiness.approved_for_recording(complete)
    assert not readiness.approved_for_recording(complete.model_copy(update={'status': 'preview_ready'}))
    assert not readiness.approved_for_recording(complete.model_copy(update={'original': False, 'name': 'Demo'}))


def test_usage_counts_provider_cache_once_and_ignores_tool_token_nulls():
    claude=usage.step('claude','claude-sonnet-5-5',1,{'input_tokens':100,'cached_input_tokens':500,'output_tokens':20},1,True)
    codex=usage.step('codex','gpt-6.1-terra',1,{'input_tokens':600,'cached_input_tokens':500,'output_tokens':20},1,True)
    assert claude['total_tokens']==codex['total_tokens']==620
    totals=usage.summarize([claude,{'stage':'search','model':None,'seconds':2}])['totals']
    assert totals['total_tokens']==620 and totals['unknown_model_attempts']==0


def test_evidence_requires_downloaded_sources_and_separate_organizations():
    data=proposal('promo-kinetic')['research']
    docs=[{'url':s['url'],'text':'contenido'} for s in data['findings'][0]['sources']]
    pipeline.check_evidence(data,docs)
    with pytest.raises(ValueError,match='descargada'):pipeline.check_evidence(data,docs[:1])
    data['findings'][0]['sources'][1]['url']='https://b.example.org/other'
    docs.append({'url':'https://b.example.org/other','text':'contenido'})
    with pytest.raises(ValueError,match='subdominios'):pipeline.check_evidence(data,docs)


def test_shared_media_slot_is_fetched_once_and_propagated(tmp_path,monkeypatch):
    pipeline.write(tmp_path/'media-plan.json',{'items':[
        {'scene':1,'slot':'hero','kind':'video','query':'primera'},
        {'scene':2,'slot':'hero','kind':'video','query':'otra'}]})
    pipeline.write(tmp_path/'assets/lyrics.json',{'segments':[{'start':0,'end':2},{'start':2,'end':5}]})
    async def resolve(target,ident,progress):
        plan=pipeline.read(target/'media-plan.json')
        assert len(plan['items'])==1 and plan['items'][0]['minimum_duration_seconds']==3
        plan['items'][0]['asset_id']='single-video';pipeline.write(target/'media-plan.json',plan)
    monkeypatch.setattr(pipeline,'_resolve_unique_media',resolve)
    asyncio.run(pipeline._resolve_media(tmp_path,'demo',AsyncMock()))
    assert [x['asset_id'] for x in pipeline.read(tmp_path/'media-plan.json')['items']]==['single-video','single-video']


def test_host_normalizes_package_metadata_without_another_model_call():
    data=proposal('promo-kinetic');data['research']['topic']='Otra formulación del mismo título';data['guion']['template']='typo'
    brief,research,guion,_=pipeline.prepare_data({'template_id':'promo-kinetic'},data)
    assert research['topic']==brief['topic'] and guion['template']==brief['template']


@pytest.mark.asyncio
async def test_host_timeout_reports_stage_and_imports_completed_usage(tmp_path,monkeypatch):
    from types import SimpleNamespace
    async def communicate():
        await asyncio.sleep(10)
    fake=SimpleNamespace(pid=999999,communicate=communicate,wait=AsyncMock(return_value=0))
    monkeypatch.setattr(pipeline.asyncio,'create_subprocess_exec',AsyncMock(return_value=fake))
    killed=[]
    monkeypatch.setattr(pipeline.os,'killpg',lambda pid,sig:killed.append((pid,sig)))
    imported=AsyncMock();monkeypatch.setattr(pipeline,'import_tool_usage',imported)
    progress=AsyncMock()
    with pytest.raises(ValueError,match='media-search.*límite'):
        await pipeline.tool(tmp_path,'media-search',['fetch'],progress,timeout=.01)
    assert killed and killed[0][0]==999999
    imported.assert_awaited_once_with(tmp_path,progress)
    assert progress.await_args_list[-1].args[1]['usage']['ok'] is False


def test_v4_requires_kinds_and_references_for_non_numeric_fact():
    data = proposal('promo-kinetic')
    for segment in data['guion']['segments']:
        segment['kind'] = 'fact'
    session = {'template_id':'promo-kinetic', 'prompt_ref':{'version':'v4'}}
    data['guion']['segments'][0].update(lines=['LUZ POLAR'], facts=[])
    with pytest.raises(ValueError, match='referencias factuales'):
        pipeline.prepare_data(session, data)
    data['guion']['segments'][0].update(facts=['missing'])
    with pytest.raises(ValueError, match='referencias factuales'):
        pipeline.prepare_data(session, data)
    data['guion']['segments'][0].update(facts=['f1'])
    data['guion']['segments'][1].update(kind='creative', lines=['AURORAS'], facts=[])
    data['guion']['segments'][2].update(kind='cta', lines=['CONOCE MÁS'], facts=[])
    assert pipeline.prepare_data(session, data)[2]['segments'][1]['kind'] == 'creative'
    data['guion']['segments'][2].pop('kind')
    with pytest.raises(ValueError, match='falta kind'):
        pipeline.prepare_data(session, data)


@pytest.mark.parametrize('version', ['v2', 'v3'])
def test_old_prompt_versions_accept_legacy_segments_without_kind(version):
    data = proposal('promo-kinetic')
    data['guion']['segments'][0].update(lines=['TEMA'], facts=[])
    assert pipeline.prepare_data({'template_id':'promo-kinetic','prompt_ref':{'version':version}}, data)


def test_cli_final_json_can_follow_registration_logs_but_not_trailing_garbage():
    raw='2026-11-13 [info] asset_library_video_registered asset_id=clip\n{\n "id":"clip", "metadata":{"source":"real"}\n}\n'
    assert pipeline.decode_tool_result(raw)=={'id':'clip','metadata':{'source':'real'}}
    assert pipeline.decode_tool_result(' {"ready":true}\n')=={'ready':True}
    assert pipeline.decode_tool_result('{"id":"clip"}\nnot-json') is None
    assert pipeline.decode_tool_result('log {"id":"clip"}') is None
    assert pipeline.decode_tool_result(' [1,2]\n')==[1,2]


@pytest.mark.parametrize('template,segment,lines,expected', [
    ('promo-dynamic', 4, ['A','B','C','D'], 1),
    ('promo-dynamic', 3, ['A','B'], None),
    ('promo-trendy', 1, ['A','B'], None),
    ('promo-trendy', 2, ['A','B'], 1),
    ('promo-kinetic', 1, ['A','B'], 1),
    ('promo-sports', 3, ['A','B','C'], None),
    ('promo-sports', 3, ['A','B','C','D'], 3),
    ('promo-urban', 1, ['A','B'], None),
    ('promo-urban', 3, ['A','B'], 1),
])
def test_segment_lines_match_actual_scene_capacity(template, segment, lines, expected):
    data = proposal(template)
    data['guion']['segments'][segment-1]['lines'] = lines
    if expected is None:
        pipeline.prepare_data({'template_id':template}, data)
    else:
        with pytest.raises(ValueError, match=rf'Segmento {segment}, escena .*capacidad {expected} líneas'):
            pipeline.prepare_data({'template_id':template}, data)


def test_contracts_have_audited_structural_capacity():
    for template in sorted(TEMPLATES):
        contract = json.loads((SKILL/'templates'/f'{template}.json').read_text())
        assert all('max_text_lines' in scene and (scene['max_text_lines'] is None or type(scene['max_text_lines']) is int and scene['max_text_lines'] >= 0) for scene in contract['default_scenes'])


def test_editorial_versus_lines_match_actual_brand_texts():
    data=proposal('promo-editorial')
    data['brief']['texts'].update({'brand.left':'Auroras Norte','brand.right':'Auroras Sur','brand.round':'Explicación'})
    contract=json.loads((SKILL/'templates'/'promo-editorial.json').read_text())
    for i, segment in enumerate(data['guion']['segments']):
        if contract['default_scenes'][i % len(contract['default_scenes'])]['type']=='versus':
            segment['lines']=['  auroras   norte ', 'AURORAS SUR']
    pipeline.prepare_data({'template_id':'promo-editorial'},data)
    for segment in data['guion']['segments']:
        if segment['scene']=='versus': segment['lines']=['Una frase no visible']
    with pytest.raises(ValueError, match='alinea cada línea'):
        pipeline.prepare_data({'template_id':'promo-editorial'},data)


def test_sports_panels3_requires_exactly_three_lines():
    data=proposal('promo-sports')
    segment=next(s for s in data['guion']['segments'] if s['scene']=='panels3')
    segment['lines']=['UNO', 'DOS']
    with pytest.raises(ValueError, match=r'escena panels3: mínimo 3 líneas'):
        pipeline.prepare_data({'template_id':'promo-sports'},data)
    segment['lines']=['UNO', 'DOS', 'TRES']
    pipeline.prepare_data({'template_id':'promo-sports'},data)


def test_manual_media_selection_is_host_owned():
    data = proposal("promo-editorial")
    contract = json.loads((SKILL / "templates" / "promo-editorial.json").read_text())
    scene_number = next(
        index for index, scene in enumerate(contract["default_scenes"], 1) if scene.get("media")
    )
    first_scene = contract["default_scenes"][scene_number - 1]
    slot = first_scene["media"][0]
    kind = next(item["type"] for item in contract["default_media"] if item["id"] == slot)
    data["media_plan"]["items"] = [
        {"scene": scene_number, "slot": slot, "kind": kind, "query": "tema", "manual_selection": True}
    ]

    _, _, _, plan = pipeline.prepare_data({"template_id": "promo-editorial"}, data)
    assert all("manual_selection" not in item for item in plan["items"])

    marked = pipeline._mark_manual_media(plan, [{"scene": scene_number, "slot": slot}])
    assert next(item for item in marked["items"] if item["scene"] == scene_number and item["slot"] == slot)["manual_selection"] is True
    assert all(
        not item.get("manual_selection")
        for item in marked["items"]
        if (item["scene"], item["slot"]) != (scene_number, slot)
    )
