import json
from types import SimpleNamespace
from src.core.nodemotion.promo import content, reports

SID='a'*32

def put(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value))


def setup(tmp_path, monkeypatch):
    root=tmp_path/'sandbox';project=root/'nodemotion'/SID;target=root/'nodemotion'/f'{SID}-r1'
    put(project/'work/content.json',{'revision':1,'project_id':f'{SID}-r1'})
    put(target/'draft.json',{'draft_id':'draft1'})
    put(target/'brief.json',{'topic':'Tema','duration_seconds':60})
    put(target/'work/script.json',{'segments':[{'n':1,'scene':'word','lines':['HOLA']}]})
    put(target/'media-plan.json',{'items':[]})
    put(target/'music.json',{'asset_id':'m1'})
    profile=tmp_path/'profile'; output=profile/'productions/nodemotion/job1'; assets=output/'assets'
    put(assets/'lyrics.json',{'segments':[{'lines':['HOLA']}]})
    put(assets/'config.json',{'scenes':[{'type':'word'}]})
    monkeypatch.setattr(content,'settings',SimpleNamespace(storage_profile_dir=profile))
    monkeypatch.setattr(content,'layout_for_settings',lambda _:SimpleNamespace(resources_dir=profile/'resources'))
    monkeypatch.setattr(content,'load_job',lambda _:SimpleNamespace(artifacts=SimpleNamespace(output_dir=output,content_dir=assets)))
    monkeypatch.setattr(content,'active_config',lambda config:config)
    row={'session_id':SID,'template_id':'promo-kinetic','revision':1,'draft_id':'draft1','state':'review','updated_at':'now'}
    draft={'draft_id':'draft1','template_id':'promo-kinetic','name':'Tema','details':{'copies':{'youtube':{'title':'Título','description':'Texto'}}}}
    service=SimpleNamespace(get=lambda sid:dict(row),_project=lambda sid:project,_rows=lambda:SimpleNamespace(get=lambda sid:dict(row)))
    monkeypatch.setattr(reports,'sandbox_root',lambda:root)
    monkeypatch.setattr(content,'collection',lambda name:SimpleNamespace(get=lambda ident:draft))
    monkeypatch.setattr(content,'_resource_rows',lambda target:[{'id':'m1','type':'music','name':'Tema musical','author':'Autor','source':'stock','license':'CC','file':'/private/secret','download_url':'https://secret'}])
    return service,row,draft,project,target


def test_content_uses_revision_files_and_whitelists_fields(tmp_path,monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    result=content.read_content(service,SID)
    assert result['title']=='Tema' and result['copies']['youtube']['description']=='Texto'
    assert result['copies']['youtube_shorts'] == {'title': 'Título #Shorts', 'description': 'Texto'}
    assert result['guion']['segments'][0]['lines']==['HOLA'] and result['media']==[]
    assert result['music']['name']=='Tema musical' and 'file' not in result['music'] and 'download_url' not in result['music']
    assert set(result['availability'].values())=={'available'}



def test_content_reads_legacy_guion_filename(tmp_path, monkeypatch):
    service, row, draft, project, target = setup(tmp_path, monkeypatch)
    (target / "work/script.json").unlink()
    put(target / "work/guion.json", {"segments": [{"n": 1, "scene": "word", "lines": ["LEGADO"]}]})
    monkeypatch.setattr(content, "load_job", lambda _: None)
    result = content.read_content(service, SID)
    assert result["guion"]["segments"][0]["lines"] == ["LEGADO"]


def test_legacy_missing_and_mismatched_revision_content(tmp_path,monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    put(project/'work/content.json',{'revision':1,'project_id':'../../other'})
    result=content.read_content(service,SID)
    assert result['title']=='Tema' and result['guion'] is None and result['availability']['guion']=='missing'
    put(project/'work/content.json',{'revision':1,'project_id':f'{SID}-r1'})
    put(target/'draft.json',{'draft_id':'outdated'})
    assert content.read_content(service,SID)['guion'] is None


def test_content_rejects_symlink_and_detects_session_race(tmp_path,monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    guion=tmp_path/'profile/productions/nodemotion/job1/assets/lyrics.json';guion.unlink();guion.symlink_to(tmp_path/'secret')
    assert content.read_content(service,SID)['guion'] is None
    states=iter([dict(row),{**row,'revision':2}]);service.get=lambda sid:next(states)
    result=content.read_content(service,SID)
    assert result['title'] is None and set(result['availability'].values())=={'stale'}


def test_running_skips_disk_and_database(tmp_path,monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch);row['state']='running'
    monkeypatch.setattr(content,'collection',lambda name: (_ for _ in ()).throw(AssertionError()))
    assert set(content.read_content(service,SID)['availability'].values())=={'pending'}


def test_failed_without_proposal_cannot_retry(tmp_path,monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    row.update(state='failed',draft_id=None)
    assert content.read_content(service,SID)['can_retry_preparation'] is False


def test_legacy_reads_safe_job_assets_and_registered_resources(tmp_path,monkeypatch):
    from pathlib import Path
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    (project/'work/content.json').unlink()
    profile=tmp_path/'profile';output=profile/'productions/nodemotion/job1';assets=output/'assets'
    put(assets/'lyrics.json',{'segments':[{'lines':['LEGADO']}]})
    put(assets/'config.json',{'scenes':[{'type':'word'}]})
    root=profile/'resources';put(root/'music'/'m1'/'resource.json',{'id':'m1','type':'music','name':'Canción','author':'Autor'})
    draft['inputs']={'music_asset_id':'m1','template_inputs':{'media':{'clips':[],'photos':[]}}}
    monkeypatch.setattr(content,'settings',SimpleNamespace(storage_profile_dir=profile))
    monkeypatch.setattr(content,'layout_for_settings',lambda _:SimpleNamespace(resources_dir=root))
    monkeypatch.setattr(content,'load_job',lambda _:SimpleNamespace(artifacts=SimpleNamespace(output_dir=output,content_dir=assets)))
    monkeypatch.setattr(content,'active_config',lambda config:config)
    result=content.read_content(service,SID)
    assert result['guion']['segments'][0]['lines']==['LEGADO']
    assert result['music']['name']=='Canción' and result['media']==[]
    outside=tmp_path/'outside';outside.mkdir()
    monkeypatch.setattr(content,'load_job',lambda _:SimpleNamespace(artifacts=SimpleNamespace(output_dir=outside,content_dir=outside)))
    assert content.read_content(service,SID)['guion'] is None


def test_retry_indicator_obeys_all_service_preconditions(tmp_path, monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    row.update(state='failed', proposal={'valid':True}, source_context=[{'url':'u','text':'x'},{'url':'v','text':'y'}], prompt_ref={'version':'v5','hashes':{}})
    monkeypatch.setattr(content.agents,'decode',lambda x:None)
    monkeypatch.setattr(content,'task_is_owned',lambda *args:False)
    assert content.read_content(service,SID)['can_retry_preparation'] is True
    draft['status']='rendering'
    assert content.read_content(service,SID)['can_retry_preparation'] is False
    draft['status']='prepared';monkeypatch.setattr(content,'task_is_owned',lambda *args:True)
    assert content.read_content(service,SID)['can_retry_preparation'] is False


def test_legacy_derived_music_uses_safe_library_metadata(tmp_path,monkeypatch):
    service,row,draft,project,target=setup(tmp_path,monkeypatch)
    (project/'work/content.json').unlink()
    draft['inputs']={'music_asset_id':'derived','template_inputs':{'media':{'clips':[],'photos':[]}}}
    entry=SimpleNamespace(asset_id='derived',track_name='Undaunted',artist='Autor',provider='stock',license_note='CC BY https://example.com/?token=secret',relative_path='/private/file',original_url='https://secret')
    monkeypatch.setattr(content.asset_library,'get_music_entry',lambda ident:entry)
    result=content.read_content(service,SID)
    assert result['availability']['music']=='available'
    assert result['music']=={'id':'derived','type':'music','name':'Undaunted','author':'Autor','source':'stock','license':'CC BY [enlace omitido]'}
    assert '/private' not in json.dumps(result) and 'token=secret' not in json.dumps(result)


def test_resolved_media_reports_the_real_scene_and_slot_uses(tmp_path, monkeypatch):
    service, row, draft, project, target = setup(tmp_path, monkeypatch)
    put(target / "media-plan.json", {"items": [
        {"scene": 1, "slot": "horses", "kind": "video", "asset_id": "video1"},
        {"scene": 3, "slot": "horses", "kind": "video", "asset_id": "video1"},
    ]})
    visual = {"id": "video1", "type": "video", "name": "Material real", "author": "Autora", "source": "Wikimedia", "license": "CC BY", "file": "/private/file"}
    soundtrack = {"id": "m1", "type": "music", "name": "Tema musical", "author": "Compositora", "source": "Biblioteca", "license": "CC BY"}
    monkeypatch.setattr(content, "_resource_rows", lambda _: [visual, soundtrack])

    result = content.read_content(service, SID)

    assert result["media_basis"] == "resolved_plan"
    assert result["media"] == [{
        "id": "video1", "type": "video", "name": "Material real", "author": "Autora",
        "source": "Wikimedia", "license": "CC BY",
        "scene_uses": [{"scene": 1, "slot": "horses"}, {"scene": 3, "slot": "horses"}],
    }]
    assert "/private" not in json.dumps(result)


def test_legacy_configured_media_includes_defaults_and_missing_refs(tmp_path, monkeypatch):
    monkeypatch.setattr(content, 'active_config', lambda config: config)
    root = tmp_path / 'resources'
    put(root / 'videos/v1/resource.json', {'id': 'v1', 'name': 'Video real', 'type': 'video', 'license': 'CC'})
    put(root / 'images/i1/resource.json', {'id': 'i1', 'name': 'Imagen real', 'type': 'image', 'license': 'CC'})
    config = {'media': [
        {'id': 'clip', 'type': 'video', 'src': 'assets/media/clip.mp4'},
        {'id': 'photo', 'type': 'image', 'src': 'assets/inputs/photo.jpg'},
        {'id': 'missing', 'type': 'video', 'src': 'assets/media/missing.mp4'},
    ]}
    project = {'assets': {
        'assets/media/clip.mp4': {'kind': 'video', 'asset_id': 'v1'},
        'assets/inputs/photo.jpg': {'kind': 'image', 'asset_id': 'i1'},
    }}
    items, complete = content._configured_project_media(config, project, root)
    assert [(x['id'], x['name']) for x in items] == [('v1', 'Video real'), ('i1', 'Imagen real'), (None, 'missing')]
    assert not complete
    assert str(tmp_path) not in json.dumps(items)


def test_content_preserves_explicit_shorts_copy(tmp_path, monkeypatch):
    service, row, draft, project, target = setup(tmp_path, monkeypatch)
    draft['details']['copies']['youtube_shorts'] = {'title': 'Corto propio', 'description': 'Texto propio'}
    assert content.read_content(service, SID)['copies']['youtube_shorts'] == {'title': 'Corto propio', 'description': 'Texto propio'}
