"""Behavioral coverage of shared prompts, real copy construction and asset reuse."""
import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from src.core import promo_prompts as prompts
from src.core.draft_details import research
from src.core.metadata import active_strategies, build_copy_prompt
from src.modules import copy_writer, template_inputs_applier as inputs

SERVER = Path(__file__).resolve().parents[2]
CLI = SERVER / 'src/templates/_tools/nodemotion-promo/promo.py'

@pytest.mark.parametrize('template', sorted(prompts.TEMPLATES))
def test_new_and_every_stage_use_shared_files_only(tmp_path, template):
    root=tmp_path/'profile';root.mkdir()
    (root/'profile.json').write_text(json.dumps({'schema_version':3}))
    brief=tmp_path/'brief.json'
    brief.write_text(json.dumps({'template':template,'topic':'Tema independiente','duration_seconds':72,
        'tone':'claro','language':'es','audience':'general','name':'Ensayo','texts':{}}))
    env={**os.environ,'NEXA_PROFILE_DIR':str(root)}
    result=subprocess.run([sys.executable,str(CLI),'new','--id','ensayo','--brief',str(brief)],env=env,capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    target=root/'sandbox/nodemotion/ensayo'
    assert json.loads((target/'work/instrucciones/prompts-version.json').read_text())==prompts.reference()
    for stage in prompts.STAGES:
        result=subprocess.run([sys.executable,str(CLI),'prompt','--id','ensayo','--stage',stage],env=env,capture_output=True,text=True)
        assert result.returncode==0,result.stderr
        assert result.stdout==prompts.compose(stage,template)
    assert not list((target/'work/instrucciones').glob('*.md'))
    assert not (target/'work/instrucciones/prompts').exists()


def test_hash_tampering_and_transport_conflicts_fail(tmp_path,monkeypatch):
    folder=tmp_path/'prompts';shutil.copytree(prompts.PROMPTS,folder)
    monkeypatch.setattr(prompts,'PROMPTS',folder)
    old=prompts.reference()
    path=tmp_path/'transport.json'
    prompts.bind_reference(path,old)
    prompts.bind_reference(path,old)
    changed=dict(old);changed['hashes']={**old['hashes'],'base.md':'0'*64}
    with pytest.raises(ValueError): prompts.bind_reference(path,changed)
    (folder/'versions'/old['version']/'base.md').write_text('edited')
    with pytest.raises(ValueError,match='hash'):prompts.compose('escribir')


def test_pinned_version_survives_active_version_change(tmp_path,monkeypatch):
    folder=tmp_path/'prompts';shutil.copytree(prompts.PROMPTS,folder)
    monkeypatch.setattr(prompts,'PROMPTS',folder)
    ref=prompts.reference(version='v1')
    saved=tmp_path/'pin.json';prompts.bind_reference(saved,ref)
    shutil.copytree(folder/'versions/v1',folder/'versions/v99')
    manifest=json.loads((folder/'active.json').read_text());manifest['active']='v99';manifest['versions']['v99']=manifest['versions']['v1']
    (folder/'active.json').write_text(json.dumps(manifest))
    assert prompts.reference()['version']=='v99'
    assert prompts.reference_file(saved)['version']=='v1'
    assert prompts.compose('publicar',version='v1')==prompts.compose('publicar',version='v2')


def commercial_response(strategies):
    result={'song':None,'artist':None,'thumbnail_options':{'A':'Una experiencia','B':'Descubre el movimiento'},'thumbnail_selected':'B'}
    for platform,strategy in strategies.items():
        result[platform]={}
        for name,field in strategy.fields.items():
            examples=field.examples.get('es') or []
            value=examples[0] if examples else ([f'etiqueta{i}' for i in range(field.min_items or 1)] if field.type=='list' else 'Una experiencia real')
            if field.type=='list':
                value=list(value)
                value += [f'etiqueta{i}' for i in range(len(value),max(len(value),field.min_items or 1))]
            result[platform][name]=value
    return result


def test_real_commercial_copy_keeps_strategy_json_and_records_reference():
    strategies=active_strategies(profile='commercial')
    ai=SimpleNamespace(complete_json=AsyncMock(return_value=commercial_response(strategies)))
    facts='Textos que aparecen en pantalla: Un nuevo movimiento'
    result=asyncio.run(copy_writer.write_copy(ai,facts,'es','test',profile='commercial',include_thumbnail_options=True))
    system,user=ai.complete_json.call_args_list[0].args
    expected_system,expected_user=build_copy_prompt(strategies,facts,'es','commercial')
    assert system==prompts.compose('publicar')+'\n\n'+expected_system
    assert user.startswith(expected_user)
    assert prompts.compose('miniaturas',include_base=False) in user
    assert system.count(prompts.compose('base').strip())==1
    assert prompts.compose('base').strip() not in user
    assert result.promo_prompt_reference==prompts.reference()
    assert set(result.copies)==set(strategies)
    assert not result.unresolved_errors
    assert ai.complete_json.await_count==1


def test_song_copy_does_not_load_promo_prompts(monkeypatch):
    def forbidden(*a,**kw): raise AssertionError('song loaded promo prompts')
    monkeypatch.setattr(prompts,'compose',forbidden)
    raw=commercial_response(active_strategies());raw.update(song='Canción',artist='Artista')
    ai=SimpleNamespace(complete_json=AsyncMock(return_value=raw))
    result=asyncio.run(copy_writer.write_copy(ai,'Letra conocida','es','test'))
    assert result.promo_prompt_reference is None
    assert ai.complete_json.await_count <= 2


def test_commercial_context_uses_shared_stage_and_song_keeps_its_prompt():
    ai=SimpleNamespace(complete_json=AsyncMock(return_value={'song':None,'artist':None,'facts':['hecho dado']}))
    assert asyncio.run(research(ai,'notas','hechos',profile='commercial'))=='- hecho dado'
    assert ai.complete_json.call_args.args[0]==prompts.compose('contexto')
    asyncio.run(research(ai,'notas','hechos'))
    assert 'de una canción' in ai.complete_json.call_args.args[0]


def test_repeated_media_is_copied_and_postered_once(tmp_path,monkeypatch):
    source=tmp_path/'source.mp4';source.write_bytes(b'media')
    monkeypatch.setattr(inputs,'_resolve_asset',lambda kind,ident:('video',source))
    copied=[]
    actual_copy=shutil.copy2
    def copy(a,b):copied.append((a,b));return actual_copy(a,b)
    monkeypatch.setattr(inputs.shutil,'copy2',copy)
    extract=AsyncMock(return_value=True);monkeypatch.setattr(inputs,'_extract_poster',extract)
    config={'media':[{'type':'video'} for _ in range(4)]}
    asyncio.run(inputs._apply_media_slot(config,{'slot':'clips','kind':'video','max':6},['a','a','b','a'],tmp_path/'output'))
    assert len(copied)==2 and extract.await_count==2
    assert [entry['src'] for entry in config['media']]==['assets/inputs/clips-1.mp4','assets/inputs/clips-1.mp4','assets/inputs/clips-3.mp4','assets/inputs/clips-1.mp4']

@pytest.mark.parametrize('template',sorted(prompts.TEMPLATES))
def test_app_preparation_respects_project_version_for_all_promos(tmp_path,monkeypatch,template):
    from src.core import draft_details
    from src.core.job import Job,JobInput
    from src.adapters.ai import factory
    from src.config import niche_config
    from src.modules import content_language
    from src.core import video_usage
    folder=tmp_path/'prompts';shutil.copytree(prompts.PROMPTS,folder)
    monkeypatch.setattr(prompts,'PROMPTS',folder)
    pinned=prompts.reference(version='v1')
    output=tmp_path/'output';output.mkdir()
    prompts.bind_reference(output/'promo-prompts-version.json',pinned)
    shutil.copytree(folder/'versions/v1',folder/'versions/v99')
    manifest=json.loads((folder/'active.json').read_text());manifest['active']='v99';manifest['versions']['v99']=manifest['versions']['v1']
    (folder/'active.json').write_text(json.dumps(manifest))
    strategies=active_strategies(profile='commercial')
    ai=SimpleNamespace(complete_json=AsyncMock(side_effect=[{'song':None,'artist':None,'facts':['dato proporcionado']},commercial_response(strategies)]))
    monkeypatch.setattr(factory,'get_copy_ai',lambda:ai)
    monkeypatch.setattr(niche_config,'get_niche_config',lambda ident:SimpleNamespace(template=SimpleNamespace(template_id=template,requires_lyrics=False)))
    monkeypatch.setattr(content_language,'resolve_content_language',AsyncMock(return_value=SimpleNamespace(code='es')))
    monkeypatch.setattr(video_usage,'for_video',lambda adapter,*args:adapter)
    monkeypatch.setattr(copy_writer,'build_facts',lambda *args:'Tema y hechos suministrados')
    job=Job(input=JobInput(category_name='test'))
    job=job.model_copy(update={'artifacts':job.artifacts.model_copy(update={'output_dir':output})})
    details=asyncio.run(draft_details.generate(job,'test','seed','Notas proporcionadas'))
    assert details.promo_prompt_reference==pinned
    assert details.model_dump()['promo_prompt_reference']['version']=='v1'
    assert ai.complete_json.call_args_list[0].args[0]==prompts.compose('contexto',version='v1')
    assert ai.complete_json.call_args_list[1].args[0].startswith(prompts.compose('publicar',version='v1'))
    assert prompts.reference_file(output/'promo-prompts-version.json')==pinned


@pytest.mark.parametrize('template',sorted(prompts.TEMPLATES))
def test_recreation_reuses_reviewed_details_and_template_thumbnail(tmp_path,monkeypatch,template):
    import importlib.util
    tools=SERVER/'src/templates/_tools/nodemotion-promo'
    sys.path.insert(0,str(tools))
    spec=importlib.util.spec_from_file_location('workflow_shared_test',tools/'draft_workflow.py')
    workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
    target=tmp_path/'project';(target/'work/research').mkdir(parents=True)
    (target/'work/research/research.md').write_text('fuentes')
    read=lambda p:json.loads(p.read_text())
    write=lambda p,data:p.write_text(json.dumps(data))
    write(target/'draft.json',{'draft_id':'old'})
    write(target/'brief.json',{'template':template,'texts':{}})
    calls=[];reviewed={'copies':{'youtube':{'title':'Revisado'}},'promo_prompt_reference':prompts.reference()}
    def create(*args):write(target/'draft-recreation.json',{'draft_id':'new'});return {'draft_id':'new'}
    def call(target,method,path,payload=None):
        calls.append((method,path,payload))
        if path=='/drafts/old':return {'details':reviewed}
        if method=='GET' and path=='/drafts/new':return {'thumbnails':{'options':{key:{'design':{'background':{'sourceKind':'image'},'tagline':'Conservar'}} for key in ('A','B')}}}
        return {}
    monkeypatch.setattr(workflow,'call',call);monkeypatch.setattr(workflow,'create',create)
    def prepare(*args):
        assert any(m=='PUT' and p=='/drafts/new/details' for m,p,_ in calls)
        calls.append(('PREPARE','',None))
    monkeypatch.setattr(workflow,'prepare',prepare)
    monkeypatch.setattr(workflow,'wait_for',lambda *args:{'status':'prepared'})
    workflow.recreate(tmp_path,target,'test',read,write,'Texto A','Texto B',2)
    detail=next(payload for method,path,payload in calls if method=='PUT' and path.endswith('/details'))
    assert detail['copies']==reviewed['copies'] and detail['promo_prompt_reference']==reviewed['promo_prompt_reference']
    designs=[payload['design'] for method,path,payload in calls if method=='PUT' and '/thumbnails/' in path]
    assert all(d['tagline']=='Conservar' and d['background']['sourceKind']=='image' for d in designs)
    assert len([c for c in calls if c[0]=='PREPARE'])==2
    assert calls[-1][:2]==('DELETE','/drafts/old')


def test_legacy_migration_dry_run_preserves_history_and_is_idempotent(tmp_path):
    sys.path.insert(0,str(SERVER/'src/templates/_tools/nodemotion-promo'))
    from prompt_migration import migrate
    target=tmp_path/'project';folder=target/'work/instrucciones/prompts';folder.mkdir(parents=True)
    (target/'brief.json').write_text(json.dumps({'template':'promo-sports'}))
    history=prompts.PROMPTS/'history/narrativa-v2'
    hashes=json.loads((history/'manifest.json').read_text())['hashes']
    for name in hashes:shutil.copy2(history/name,folder/name)
    previous={'version':'promo-narrativa-v2 + contrato Sports vigente','prompts':[{'archivo':name,'sha256':digest} for name,digest in hashes.items()],'extra':'conservar'}
    (folder.parent/'prompts-version.json').write_text(json.dumps(previous))
    before={str(p.relative_to(target)):p.read_bytes() for p in target.rglob('*') if p.is_file()}
    assert migrate(target)['verified_copies']==6
    assert before=={str(p.relative_to(target)):p.read_bytes() for p in target.rglob('*') if p.is_file()}
    assert migrate(target,True)['verified_copies']==6
    assert not folder.exists()
    assert prompts.reference_file(folder.parent/'prompts-version.json')==prompts.reference()
    assert json.loads((folder.parent/'prompts-history.json').read_text())['previous_reference']==previous
    assert migrate(target,True)['verified_copies']==0


def test_unknown_legacy_variant_is_never_deleted_or_adopted(tmp_path):
    sys.path.insert(0,str(SERVER/'src/templates/_tools/nodemotion-promo'))
    from prompt_migration import migrate
    target=tmp_path/'project';folder=target/'work/instrucciones';folder.mkdir(parents=True)
    (target/'brief.json').write_text(json.dumps({'template':'promo-editorial'}))
    (folder/'base.md').write_text('una variante desconocida')
    with pytest.raises(ValueError,match='variante'):migrate(target,True)
    assert (folder/'base.md').read_text()=='una variante desconocida'
    assert not (folder/'prompts-version.json').exists()
