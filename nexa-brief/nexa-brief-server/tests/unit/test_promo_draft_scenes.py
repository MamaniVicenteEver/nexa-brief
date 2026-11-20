import hashlib
import importlib.util
import json
from pathlib import Path
from unittest.mock import AsyncMock, Mock
from types import SimpleNamespace
import pytest


def test_create_pins_and_syncs_built_scenes_without_overrides(tmp_path, monkeypatch):
    path=Path('src/templates/_tools/nodemotion/promo/tools/draft_workflow.py').resolve()
    spec=importlib.util.spec_from_file_location('workflow_scene_test',path)
    workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
    target=tmp_path/'project';(target/'assets').mkdir(parents=True)
    read=lambda p:json.loads(p.read_text())
    def write(p,data): p.write_text(json.dumps(data))
    write(target/'brief.json',{'template':'promo-dynamic','name':'Auroras','topic':'Auroras','tone':'claro','language':'es','texts':{}})
    write(target/'media-plan.json',{'items':[]})
    lyrics={'segments':[]};write(target/'assets/lyrics.json',lyrics)
    config={'scenes':[{'type':'photo'}]};write(target/'assets/config.json',config)
    monkeypatch.setattr(workflow,'derived_music',AsyncMock(return_value='music'))
    def call(target,method,path,payload=None):
        if path.endswith('/lyrics'): return lyrics
        if method=='POST': return {'draft_id':'draft1'}
        return {}
    monkeypatch.setattr(workflow,'call',call)
    monkeypatch.setattr(workflow,'wait_for',lambda *args:{'draft_id':'draft1'})
    monkeypatch.setattr(workflow,'bind_prompt_reference',lambda *args:None)
    sync=Mock();monkeypatch.setattr(workflow,'sync_scene_config',sync)
    workflow.create(tmp_path,target,'project',read,write)
    state=read(target/'draft.json')
    identity={'request':state['request'],'promo_timeline':lyrics,'scene_config':config}
    assert state['fingerprint']==hashlib.sha256(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    sync.assert_called_once_with(target,'draft1',read)
    write(target/'assets/config.json',{'scenes':[{'type':'word'}]})
    with pytest.raises(ValueError,match='inputs cambiaron'):
        workflow.create(tmp_path,target,'project',read,write)
    assert sync.call_count==1


def test_legacy_without_built_config_does_not_sync(tmp_path, monkeypatch):
    path=Path('src/templates/_tools/nodemotion/promo/tools/draft_workflow.py').resolve()
    spec=importlib.util.spec_from_file_location('workflow_legacy_scene_test',path)
    workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
    target=tmp_path/'project';(target/'assets').mkdir(parents=True)
    read=lambda p:json.loads(p.read_text())
    def write(p,data): p.write_text(json.dumps(data))
    write(target/'brief.json',{'template':'promo-dynamic','name':'Tema','topic':'Tema','tone':'claro','language':'es','texts':{}})
    write(target/'media-plan.json',{'items':[]});lyrics={'segments':[]};write(target/'assets/lyrics.json',lyrics)
    monkeypatch.setattr(workflow,'derived_music',AsyncMock(return_value='music'))
    monkeypatch.setattr(workflow,'call',lambda target,method,path,payload=None: lyrics if path.endswith('/lyrics') else {'draft_id':'draft1'})
    monkeypatch.setattr(workflow,'wait_for',lambda *args:{'draft_id':'draft1'})
    monkeypatch.setattr(workflow,'bind_prompt_reference',lambda *args:None)
    sync=Mock();monkeypatch.setattr(workflow,'sync_scene_config',sync)
    workflow.create(tmp_path,target,'project',read,write)
    sync.assert_not_called()


@pytest.mark.parametrize('collection', [False, True])
def test_sync_preserves_campaign_identity_and_resolved_runtime_paths(tmp_path, monkeypatch, collection):
    path=Path('src/templates/_tools/nodemotion/promo/tools/draft_workflow.py').resolve()
    spec=importlib.util.spec_from_file_location('workflow_identity_test',path)
    workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
    target=tmp_path/'project';(target/'assets').mkdir(parents=True)
    output=tmp_path/'output';content=output/'content';content.mkdir(parents=True)
    read=lambda p:json.loads(p.read_text())
    desired={'scenes':[{'type':'intro','media':['clip']}],
             'intro':{'enabled':True,'title':'','sub':''},
             'outro':{'version':'v2'},'palette':{'green':'#AA44FF'},
             'brand':{'tagline':'Campaña'}}
    (target/'assets/config.json').write_text(json.dumps({'activeId':'built','configs':[{'id':'built',**desired}]}))
    runtime={'id':'active','scenes':[{'type':'full','media':['clip']}],
             'intro':{'title':'Undaunted','artist':'Kevin MacLeod'},
             'outro':{'version':'v1'},'palette':{'green':'#2BF51A'},
             'media':[{'id':'clip','src':'resolved/clip.mp4'}],
             'audio':{'src':'resolved/song.mp3'},'lyricsUrl':'resolved/lyrics.json',
             'brand':{'name':'Marca resuelta'},'other_runtime':True}
    original=json.loads(json.dumps(runtime))
    inactive={'id':'inactive','intro':{'title':'Otra campaña'}}
    raw={'activeId':'active','configs':[inactive,runtime]} if collection else runtime
    (content/'config.json').write_text(json.dumps(raw))
    from src.core import drafts
    monkeypatch.setattr(drafts,'load_job',lambda _:SimpleNamespace(artifacts=SimpleNamespace(output_dir=output,content_dir=content)))
    workflow.sync_scene_config(target,'draft1',read)
    saved=read(content/'config.json')
    effective=workflow.active_config(saved)
    for key in ('scenes','intro','outro','palette'):
        assert effective[key]==desired[key]
    assert 'artist' not in effective['intro']
    assert effective['brand']=={'name':'Marca resuelta','tagline':'Campaña'}
    for key in ('media','audio','lyricsUrl','other_runtime'):
        assert effective[key]==original[key]
    if collection:
        assert saved['configs'][0]==inactive


def test_prepare_restores_campaign_after_details_before_thumbnails(tmp_path, monkeypatch):
    path=Path('src/templates/_tools/nodemotion/promo/tools/draft_workflow.py').resolve()
    spec=importlib.util.spec_from_file_location('workflow_prepare_identity_test',path)
    workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
    target=tmp_path/'sandbox/nodemotion/demo';(target/'assets').mkdir(parents=True)
    def write(path,data):
        path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data))
    write(target/'draft.json',{'draft_id':'draft1'})
    write(target/'assets/config.json',{'scenes':[{'type':'intro'}]})
    write(target/'media-plan.json',{'items':[]})
    write(target/'music.json',{'asset_id':'music'})
    write(tmp_path/'resources/music/music/resource.json',{'attribution':'Música con licencia'})
    draft={'status':'prepared','details':{'research':'Fuentes'}}
    events=[]
    def call(_target,method,path,payload=None):
        if method=='PUT':
            events.append('details');draft['details']=payload
        if '/thumbnails/' in path:
            events.append('thumbnail');return b'jpg'
        return draft
    monkeypatch.setattr(workflow,'call',call)
    monkeypatch.setattr(workflow,'sync_scene_config',lambda *args:events.append('sync'))
    from src.core.nodemotion.promo import credits
    monkeypatch.setattr(credits,'apply_credits',lambda details,*args,**kwargs:details)
    workflow.prepare(target,lambda path:json.loads(path.read_text()))
    assert events==['details','sync','thumbnail','thumbnail']
