import asyncio
import importlib.util
import json
import sys
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/nodemotion/promo/tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('nm_draft_workflow', TOOLS / 'draft_workflow.py')
workflow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow)

class Records:
    def __init__(self, raw): self.data = {raw['asset_id']: raw}
    def list(self): return list(self.data.values())
    def get(self, ident): return self.data.get(ident)
    async def insert(self, data): self.data[data['asset_id']] = data


def test_music_derived_reuses_audio_without_transcription_cache(tmp_path, monkeypatch):
    folder = tmp_path/'resources/music/source'; folder.mkdir(parents=True)
    audio=folder/'cut.mp3'; audio.write_bytes(b'audio')
    (folder/'resource.json').write_text(json.dumps({'id':'source','attribution':'CC BY'}))
    target=tmp_path/'sandbox/nodemotion/demo'; (target/'assets').mkdir(parents=True)
    (target/'music.json').write_text(json.dumps({'asset_id':'source','ready_file':'cut.mp3','duration_seconds':90}))
    lyrics={'segments':[{'text':'hola'}]}; (target/'assets/lyrics.json').write_text(json.dumps(lyrics))
    records=Records({'asset_id':'source','relative_path':'source/original.mp3','track_name':'Song'})
    cache_calls=[]
    monkeypatch.setattr(workflow,'collection',lambda _:records)
    monkeypatch.setattr(workflow.asset_library,'resolve_music_path',lambda _:audio)
    monkeypatch.setattr(workflow.asset_library,'get_lyrics_cache',lambda ident:cache_calls.append(('read',ident)))
    async def save(ident, data): cache_calls.append(('write',ident))
    monkeypatch.setattr(workflow.asset_library,'save_lyrics_cache',save)
    read=lambda p:json.loads(p.read_text())
    write=lambda p,d:p.write_text(json.dumps(d))
    first=asyncio.run(workflow.derived_music(tmp_path,target,'demo',read,write))
    assert asyncio.run(workflow.derived_music(tmp_path,target,'demo',read,write))==first
    assert records.get(first)['relative_path']=='source/cut.mp3'
    assert records.get(first)['derived_from']=='source'
    (target/'assets/lyrics.json').write_text(json.dumps({'segments':[{'text':'otra'}]}))
    second=asyncio.run(workflow.derived_music(tmp_path,target,'demo',read,write))
    assert second == first
    assert cache_calls == []
    assert asyncio.run(workflow.derived_music(tmp_path,target,'demo',read,write))==first


def test_wait_for_never_treats_errors_as_ready(monkeypatch,tmp_path):
    monkeypatch.setattr(workflow,'call',lambda *a,**k:{'status':'prepared','errors':['falló']})
    with pytest.raises(RuntimeError,match='errores'):
        workflow.wait_for(tmp_path,'id',{'prepared'})


def test_recreate_keeps_original_when_prepare_fails(tmp_path, monkeypatch):
    target = tmp_path / 'sandbox/nodemotion/demo'
    target.mkdir(parents=True)
    (target/'draft.json').write_text(json.dumps({'draft_id': 'old'}))
    calls = []
    monkeypatch.setattr(workflow, 'call', lambda _target, method, path, payload=None:
                        calls.append((method, path)) or {'draft_id': 'old', 'details': {}})
    monkeypatch.setattr(workflow, 'create', lambda *args: {'draft_id': 'new'})
    def fail(*args):
        raise RuntimeError('no preparado')
    monkeypatch.setattr(workflow, 'prepare', fail)
    read = lambda path: json.loads(path.read_text())
    write = lambda path, data: path.write_text(json.dumps(data))
    with pytest.raises(RuntimeError, match='no preparado'):
        workflow.recreate(tmp_path, target, 'demo', read, write, 'A', 'B', 2)
    assert read(target/'draft.json')['draft_id'] == 'old'
    assert not any(method == 'DELETE' for method, _ in calls)


def test_recreate_deletes_only_after_prepared_and_thumbnails(tmp_path, monkeypatch):
    target = tmp_path/'sandbox/nodemotion/demo'
    (target/'work/research').mkdir(parents=True)
    (target/'work/research/research.md').write_text('fuentes')
    def write(path, value): path.write_text(json.dumps(value))
    read = lambda path: json.loads(path.read_text())
    write(target/'draft.json', {'draft_id':'old'})
    write(target/'brief.json', {'texts': {'brand.left':'Uno', 'brand.right':'Dos'}})
    calls = []
    def create(*args):
        write(target/'draft-recreation.json', {'draft_id':'new'})
        return {'draft_id':'new'}
    def call(_target, method, path, payload=None):
        calls.append((method, path, payload))
        if path == '/drafts/old': return {'details': {'copies': {}}}
        if method == 'GET' and path == '/drafts/new':
            return {'thumbnails': {'options': {k:{'design':{'background':{}}} for k in ('A','B')}}}
        return {}
    monkeypatch.setattr(workflow, 'create', create)
    monkeypatch.setattr(workflow, 'prepare', lambda *args: None)
    monkeypatch.setattr(workflow, 'wait_for', lambda *args: calls.append(('WAIT', 'prepared', None)) or {'status':'prepared'})
    monkeypatch.setattr(workflow, 'call', call)
    workflow.recreate(tmp_path, target, 'demo', read, write, 'A', 'B', 3.78)
    assert read(target/'draft.json')['draft_id'] == 'new'
    assert calls[-1][:2] == ('DELETE', '/drafts/old')
    assert [c[1] for c in calls if c[0] == 'GET' and '/thumbnails/' in c[1]] == ['/drafts/new/thumbnails/A','/drafts/new/thumbnails/B']
    assert any(c[0] == 'WAIT' for c in calls)


def test_recreate_resumes_after_delete_error(tmp_path, monkeypatch):
    target=tmp_path/'sandbox/nodemotion/demo'; target.mkdir(parents=True)
    read=lambda path:json.loads(path.read_text())
    write=lambda path,data:path.write_text(json.dumps(data))
    write(target/'draft.json',{'draft_id':'old'})
    write(target/'draft-recreation.json',{'draft_id':'new','ready_to_replace':'old'})
    monkeypatch.setattr(workflow,'wait_for',lambda *args:{'status':'prepared'})
    calls=[]
    def call(_target,method,path,payload=None):
        calls.append((method,path))
        if method=='DELETE': raise RuntimeError('HTTP 404: ya eliminado')
        return b'jpg'
    monkeypatch.setattr(workflow,'call',call)
    workflow.recreate(tmp_path,target,'demo',read,write,'A','B',2)
    assert read(target/'draft.json') == {'draft_id':'new'}
    assert not (target/'draft-recreation.json').exists()


def test_thumbnail_side_uses_api_and_recaptures(tmp_path, monkeypatch):
    (tmp_path/'draft.json').write_text('{"draft_id":"new"}')
    calls = []
    def call(_target, method, path, payload=None):
        calls.append((method, path, payload))
        return {'thumbnails':{'options':{'B':{'text':'EL LEGADO','design':{'side':'right'}}}}}
    monkeypatch.setattr(workflow, 'call', call)
    monkeypatch.setattr(workflow, 'prepare', lambda *args: calls.append(('capture', '', None)))
    workflow.thumbnail_side(tmp_path, lambda p: json.loads(p.read_text()), 'B', 'left')
    assert calls[1][2]['design']['side'] == 'left'
    assert calls[-1][0] == 'capture'


def test_inspect_video_extracts_six_distributed_original_frames(tmp_path, monkeypatch):
    import promo
    from types import SimpleNamespace
    folder = tmp_path/'resources/videos/asset'
    folder.mkdir(parents=True)
    (folder/'source.mp4').write_bytes(b'video')
    (folder/'resource.json').write_text('{"file":"source.mp4","duration_seconds":12}')
    monkeypatch.setattr(promo, 'profile', lambda:tmp_path)
    monkeypatch.setattr(promo, 'project', lambda _:tmp_path/'project')
    commands=[]
    monkeypatch.setattr(promo.subprocess, 'run', lambda command, check:commands.append(command))
    promo.inspect_video(SimpleNamespace(id='demo',asset='asset'))
    assert [float(c[c.index('-ss')+1]) for c in commands] == [1,3,5,7,9,11]
    assert all('source.mp4' in c[c.index('-i')+1] for c in commands)


def test_usage_imports_closed_log_once_and_rejects_open_log(tmp_path, monkeypatch):
    import promo
    from types import SimpleNamespace
    monkeypatch.setattr(promo, 'project', lambda _:tmp_path)
    log = tmp_path/'closed.log'
    log.write_text('tokens used\n1,234\nresult\nEXIT 0\n')
    args = SimpleNamespace(id='demo', codex_log=[str(log)])
    promo.usage(args)
    promo.usage(args)
    assert json.loads((tmp_path/'usage.json').read_text())['reported_total_tokens'] == 1234
    log.write_text('tokens used\n1,234\nnot finished\n')
    with pytest.raises(ValueError, match='no está cerrado'):
        promo.usage(args)


def test_reject_and_select_media_preserve_library_file(tmp_path, monkeypatch):
    import promo
    from types import SimpleNamespace
    monkeypatch.setattr(promo, 'profile', lambda:tmp_path)
    monkeypatch.setattr(promo, 'project', lambda _:tmp_path/'project')
    folder=tmp_path/'resources/videos/asset'; folder.mkdir(parents=True)
    (folder/'resource.json').write_text('{"id":"asset"}')
    (folder/'source.mp4').write_bytes(b'original')
    (tmp_path/'project').mkdir()
    (tmp_path/'project/media-plan.json').write_text('{"items":[{"scene":1,"slot":"stadium","kind":"video","asset_id":"asset"}]}')
    promo.reject_video(SimpleNamespace(asset='asset',reason='marca'))
    promo.select_media(SimpleNamespace(id='demo',slot='stadium',query='nueva consulta'))
    assert json.loads((folder/'resource.json').read_text())['approved'] is False
    assert (folder/'source.mp4').read_bytes() == b'original'
    assert 'asset_id' not in json.loads((tmp_path/'project/media-plan.json').read_text())['items'][0]


def test_draft_creation_is_resumable_and_never_requests_render(tmp_path, monkeypatch):
    target=tmp_path/'sandbox/nodemotion/demo'; (target/'assets').mkdir(parents=True)
    brief={'template':'promo-editorial','name':'Demo','topic':'fútbol','tone':'épico','language':'es','texts':{'brand.name':'Barça','brand.left':'PASIÓN','brand.right':'HISTORIA'}}
    plan={'items':[{'slot':'trophy','asset_id':'c'}, {'slot':'match','asset_id':'b'}, {'slot':'stadium','asset_id':'a'}, {'slot':'team-win','asset_id':'d'}, {'slot':'soccer','asset_id':'f'}, {'slot':'coach','asset_id':'e'}, {'slot':'coach-2','asset_id':'g'}]}
    for name,data in [('brief.json',brief),('media-plan.json',plan),('assets/lyrics.json',{'segments':[]})]:
        (target/name).write_text(json.dumps(data))
    calls=[]
    async def derive(*args): return 'music90'
    monkeypatch.setattr(workflow,'derived_music',derive)
    def call(_target,method,path,payload=None):
        calls.append((method,path,payload))
        if path.endswith('/lyrics'): return {'segments':[]}
        if method=='POST': return {'draft_id':'draft1'}
        return {'draft_id':'draft1','status':'preview_ready','errors':[]}
    monkeypatch.setattr(workflow,'call',call)
    read=lambda p:json.loads(p.read_text())
    write=lambda p,d:p.write_text(json.dumps(d))
    for _ in range(2):
        assert workflow.create(tmp_path,target,'demo',read,write)['draft_id']=='draft1'
    posts=[x for x in calls if x[0]=='POST']
    assert len(posts)==1
    assert posts[0][1]=='/drafts'
    assert 'auto_render' not in posts[0][2]
    assert posts[0][2]['template_inputs']['media']=={'clips':['a','b','c','d','e','f'],'photos':['g','g','g']}
    assert posts[0][2]['promo_timeline']=={'segments':[]}
    brief['name']='Cambiado'; (target/'brief.json').write_text(json.dumps(brief))
    with pytest.raises(ValueError,match='inputs cambiaron'):
        workflow.create(tmp_path,target,'demo',read,write)
    assert len([x for x in calls if x[0]=='POST'])==1


def test_prepare_adds_credits_once_and_reuses_prepared_draft(tmp_path, monkeypatch):
    target=tmp_path/'sandbox/nodemotion/demo'; target.mkdir(parents=True)
    def write(path,data):
        path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data))
    write(target/'draft.json',{'draft_id':'draft1'})
    write(target/'music.json',{'asset_id':'music'})
    write(target/'media-plan.json',{'items':[{'kind':'image','asset_id':'photo'}]})
    write(tmp_path/'resources/images/photo/resource.json',{'author':'Autora','license':'Pexels License',
          'source_url':'https://example.org/photo','license_url':'https://www.pexels.com/license/',
          'attribution':'Autora · Pexels'})
    write(tmp_path/'resources/music/music/resource.json',{'author':'Kevin','license':'CC BY 4.0',
          'source_url':'https://example.org/music','license_url':'https://creativecommons.org/licenses/by/4.0/',
          'attribution':'Kevin · CC BY 4.0'})
    draft={'status':'prepared','errors':[],'details':{'research':'Fuentes',
           'copies':{p:{'description':'Texto editorial'} for p in ('youtube','facebook','instagram','tiktok')}}}; calls=[]
    def call(_target,method,path,payload=None):
        calls.append((method,path))
        if method=='PUT': draft['details']=payload
        if '/thumbnails/' in path: return b'jpg'
        return draft
    monkeypatch.setattr(workflow,'call',call)
    read=lambda path:json.loads(path.read_text())
    workflow.prepare(target,read); workflow.prepare(target,read)
    assert draft['details']['research'].count('Autora · Pexels')==1
    assert draft['details']['research'].count('Kevin · CC BY 4.0')==1
    assert sum(method=='PUT' for method,_ in calls)==1
    assert not any(method=='POST' for method,_ in calls)


def test_check_detects_unused_and_rejected_media(tmp_path, monkeypatch):
    import io
    import playwright.sync_api as pw
    from PIL import Image
    import preview_check

    target=tmp_path/'sandbox/nodemotion/demo'; target.mkdir(parents=True)
    def write(path, data):
        path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data))
    lyrics={'metadata':{'audio_duration_sec':90},'segments':[
        {'start':0,'end':1,'lines':['PRIMERA']},
        {'start':1,'end':2,'lines':['OTRA']},
        {'start':2,'end':3,'lines':['SEGUNDA']}]}
    write(target/'draft.json',{'draft_id':'draft1','request':{'template_inputs':{'media':{'clips':['clip'], 'photos':['photo']}}}})
    write(target/'assets/lyrics.json',lyrics)
    write(target/'media-plan.json',{'items':[{'slot':'stadium','kind':'video','asset_id':'clip'},{'slot':'other','kind':'image','asset_id':'photo'}]})
    write(target/'music.json',{'asset_id':'song'})
    write(target/'quality.json',{'min_unique_visual_assets':2,'rejected_assets':{'clip':'marca visible'}})
    for folder,ident in [('videos','clip'),('images','photo'),('music','song')]:
        write(tmp_path/'resources'/folder/ident/'resource.json',{'source_url':'https://example.org','license':'licencia','license_url':'https://example.org','author':'autor','attribution':'crédito'})
    buff=io.BytesIO();Image.new('RGB',(20,20),'white').save(buff,format='JPEG')
    calls=[]
    def call(_target,method,path,payload=None):
        calls.append((method,path))
        if 'thumbnails' in path:return buff.getvalue()
        if path.endswith('lyrics.json'):return lyrics
        if path.endswith('config.json'):return {'scenes':[{'media':['stadium']},{}],'media':[{'id':'stadium','src':'assets/inputs/clips-1.mp4'}]}
        return {'status':'prepared','errors':[]}
    class Page:
        def on(self,*args):pass
        def goto(self,*args,**kwargs):pass
        def wait_for_function(self,*args,**kwargs):pass
        def wait_for_timeout(self,*args):pass
        def evaluate(self,script,*args):
            if 'audio").duration' in script:return 90
            if 'badMedia' in script:return {'badMedia':[],'textOutside':[]}
            return None
        def screenshot(self,path):Image.new('RGB',(20,20),'white').save(path)
        def close(self):pass
    class Browser:
        def new_page(self,**kwargs):return Page()
        def close(self):pass
    class Driver:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        @property
        def chromium(self):return self
        def launch(self,**kwargs):return Browser()
    monkeypatch.setattr(pw,'sync_playwright',lambda:Driver())
    monkeypatch.setattr(preview_check,'contact_times',lambda segments,*,full=False:(1,))
    result=preview_check.evaluate(target,tmp_path,lambda p:json.loads(p.read_text()),write,call)
    assert not result['ready']
    assert any('solo 1 medios' in error for error in result['errors'])
    assert any('marca visible' in error for error in result['errors'])
    assert [a['lines'] for a in result['slot_lines'][0]['appearances']]==[['PRIMERA'],['SEGUNDA']]
    assert result['slot_lines'][1]['appearances']==[]
    assert all(method=='GET' for method,_ in calls)
