import hashlib
import importlib.util
import json
from pathlib import Path
from unittest.mock import AsyncMock, Mock
import pytest


def test_create_pins_and_syncs_built_scenes_without_overrides(tmp_path, monkeypatch):
    path=Path('src/templates/_tools/nodemotion-promo/draft_workflow.py').resolve()
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
    identity={'request':state['request'],'lyrics':lyrics,'scene_config':config}
    assert state['fingerprint']==hashlib.sha256(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    sync.assert_called_once_with(target,'draft1',read)
    write(target/'assets/config.json',{'scenes':[{'type':'word'}]})
    with pytest.raises(ValueError,match='inputs cambiaron'):
        workflow.create(tmp_path,target,'project',read,write)
    assert sync.call_count==1


def test_legacy_without_built_config_does_not_sync(tmp_path, monkeypatch):
    path=Path('src/templates/_tools/nodemotion-promo/draft_workflow.py').resolve()
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
