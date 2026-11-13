import asyncio
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

MODULE = Path(__file__).resolve().parents[2] / 'src/templates/_tools/nodemotion-promo/media.py'
spec = importlib.util.spec_from_file_location('promo_media_test', MODULE)
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def test_find_and_reuse_are_idempotent_and_require_registered_file(tmp_path, monkeypatch):
    folder = tmp_path / 'resources/videos/abc'
    folder.mkdir(parents=True)
    (folder/'source.mp4').write_bytes(b'original')
    (folder/'ready.mp4').write_bytes(b'encoded')
    record = dict(id='abc', file='source.mp4', ready_file='ready.mp4', query='Barcelona skyline', download_url='https://example.com/video', source_url='https://example.com/item', hash='a'*64, used_by=['old'])
    meta=folder/'resource.json'; meta.write_text(json.dumps(record))
    monkeypatch.setattr(media.lib, 'resolve_asset_path', lambda kind, ident: folder/'source.mp4')
    for kwargs in ({'query':'barcelona SKYLINE'}, {'url':'https://example.com/item'}, {'digest':'a'*64}, {'ident':'abc'}):
        assert media.find(tmp_path, 'video', **kwargs)[1]['id'] == 'abc'
    def write(p, v): p.write_text(json.dumps(v))
    media.use(media.find(tmp_path, 'video', ident='abc'), 'new', write)
    media.use(media.find(tmp_path, 'video', ident='abc'), 'new', write)
    assert json.loads(meta.read_text())['used_by'] == ['old','new']
    (folder/'ready.mp4').unlink()
    assert media.find(tmp_path, 'video', ident='abc') is None


def test_fetch_reuses_plan_without_provider_or_download(tmp_path, monkeypatch, capsys):
    target=tmp_path/'project'; target.mkdir()
    plan={'items':[{'scene':1,'slot':'city','kind':'video','query':'city','asset_id':'abc'}]}
    (target/'media-plan.json').write_text(json.dumps(plan))
    (target/'assets').mkdir(); (target/'assets/lyrics.json').write_text(json.dumps({'segments':[{'id':1,'start':0,'end':5}]}))
    monkeypatch.setattr(media,'find',lambda *a,**k:(tmp_path/'resource.json',{'id':'abc','used_by':['pilot'],'orientation':'landscape','duration_seconds':10}))
    monkeypatch.setattr(media,'build_providers',lambda:pytest.fail('unexpected network'))
    def read(p): return json.loads(p.read_text())
    def write(p,v): p.write_text(json.dumps(v))
    result=asyncio.run(media.fetch(tmp_path,target,'pilot',read,write,lambda *args:None))
    assert result == 0
    assert json.loads(capsys.readouterr().out)['downloads'] == 0


def test_register_rejects_unlicensed_candidate_before_download(tmp_path, monkeypatch):
    item=SimpleNamespace(provider='wikimedia',license='CC BY 4.0',license_url='',source_url='https://example.com',download_url='https://example.com/a',author='author')
    monkeypatch.setattr(media,'download',lambda *a,**k:pytest.fail('unexpected download'))
    with pytest.raises(ValueError,match='licencia incompleta'):
        asyncio.run(media.register(tmp_path,tmp_path,'pilot','image',item,'query',lambda *a:None,lambda *a:None))


def test_existing_library_record_is_enriched_without_downloading(tmp_path, monkeypatch):
    folder=tmp_path/'resources/images/abc'; folder.mkdir(parents=True)
    original=folder/'original.jpg'; original.write_bytes(b'old')
    item=SimpleNamespace(provider='pexels',provider_id='42',license='',license_url='',source_url='https://www.pexels.com/photo/42/',download_url='https://images.pexels.com/42.jpg',author='A',title='A city',description='',attribution='')
    monkeypatch.setattr(media,'build_providers',lambda:{'pexels':SimpleNamespace(accepts_download_url=lambda u:True)})
    monkeypatch.setattr(media,'collection',lambda kind:SimpleNamespace(list=lambda:[{'asset_id':'abc','stock_ref':'pexels:image:42','category':'stock'}]))
    monkeypatch.setattr(media.lib,'resolve_asset_path',lambda *a:original)
    monkeypatch.setattr(media,'probe',lambda p:dict(width=1000,height=700,duration_seconds=None,fps=None,orientation='landscape'))
    monkeypatch.setattr(media,'download',lambda *a:pytest.fail('unexpected download'))
    def write(p,v): p.write_text(json.dumps(v))
    data,downloaded=asyncio.run(media.register(tmp_path,tmp_path,'pilot','image',item,'city',write,lambda *a:None))
    assert not downloaded and data['id']=='abc' and data['used_by']==['pilot']
    assert json.loads((folder/'resource.json').read_text())['hash']==media.lib.hash_file(original)


def test_rejects_noncommercial_even_if_all_metadata_present(tmp_path):
    item=SimpleNamespace(provider='wikimedia',license='CC BY-NC 4.0',license_url='https://creativecommons.org/licenses/by-nc/4.0/',source_url='https://example.org/item',download_url='https://example.org/file',author='author')
    with pytest.raises(ValueError,match='uso comercial'):
        asyncio.run(media.register(tmp_path,tmp_path,'pilot','image',item,'query',lambda *a:None,lambda *a:None))


def test_real_video_registration_preserves_original_and_reencodes(tmp_path, monkeypatch):
    import shutil
    import subprocess
    from src.config.settings import settings
    root=tmp_path/'profile'; root.mkdir(); (root/'profile.json').write_text('{"schema_version":3,"id":"test"}')
    monkeypatch.setattr(settings,'storage_profile_dir',root)
    monkeypatch.setattr(settings,'data_dir',root/'data')
    source=tmp_path/'input.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=10:d=1','-c:v','libx264','-threads','1',str(source)],check=True)
    item=SimpleNamespace(provider='pexels',provider_id='42',license='',license_url='',source_url='https://www.pexels.com/photo/42/',download_url='https://videos.pexels.com/42.mp4',author='A',title='city',description='',attribution='')
    monkeypatch.setattr(media,'build_providers',lambda:{'pexels':SimpleNamespace(accepts_download_url=lambda u:True)})
    async def fake_download(target,provider,url,path): shutil.copyfile(source,path)
    monkeypatch.setattr(media,'download',fake_download)
    def write(p,v): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(v))
    data, downloaded=asyncio.run(media.register(root,root,'pilot','video',item,'city',write,lambda *a:None))
    folder=root/'resources/videos'/data['id']
    assert downloaded and (folder/data['file']).read_bytes()==source.read_bytes()
    assert (folder/data['ready_file']).is_file()
    probe=media.probe(folder/data['ready_file'])
    assert probe['width']==320 and probe['height']==180 and probe['duration_seconds']==pytest.approx(1,abs=.1)
    again, downloaded=asyncio.run(media.register(root,root,'pilot','video',item,'city',write,lambda *a:None))
    assert not downloaded and again['id']==data['id']


def test_fetch_reports_missing_scene_even_with_stale_id(tmp_path, monkeypatch, capsys):
    target=tmp_path/'project'; (target/'assets').mkdir(parents=True)
    plan={'items':[{'scene':2,'slot':'missing','kind':'video','query':'city','asset_id':'stale'}]}
    (target/'media-plan.json').write_text(json.dumps(plan)); (target/'assets/lyrics.json').write_text('{"segments":[]}')
    monkeypatch.setattr(media,'build_providers',lambda:pytest.fail('unexpected network'))
    read=lambda p:json.loads(p.read_text())
    def write(p,v): p.write_text(json.dumps(v))
    assert asyncio.run(media.fetch(tmp_path,target,'pilot',read,write,lambda *a:None))==1
    assert 'asset_id' not in read(target/'media-plan.json')['items'][0]


def test_fetch_falls_back_after_provider_error(tmp_path, monkeypatch):
    target=tmp_path/'project'; (target/'assets').mkdir(parents=True)
    (target/'media-plan.json').write_text(json.dumps({'items':[{'scene':1,'slot':'s','kind':'video','query':'city'}]}))
    (target/'assets/lyrics.json').write_text(json.dumps({'segments':[{'id':1,'start':0,'end':6}]}))
    class Provider:
        kinds={'video'}; configured=True
        def __init__(self,name,failed=False): self.name=name; self.failed=failed
        async def search(self,*a,**k):
            if self.failed: raise RuntimeError('outage')
            return [SimpleNamespace(width=1280,height=720,duration_seconds=8,author='A',source_url='https://example.org')]
    monkeypatch.setattr(media,'find',lambda *a,**k:None)
    monkeypatch.setattr(media,'build_providers',lambda:{'bad':Provider('bad',True),'good':Provider('good')})
    async def register(*a): return ({'id':'abc'},True)
    monkeypatch.setattr(media,'register',register)
    read=lambda p:json.loads(p.read_text())
    def write(p,v):p.write_text(json.dumps(v))
    assert asyncio.run(media.fetch(tmp_path,target,'pilot',read,write,lambda *a:None)) == 0
    assert read(target/'media-plan.json')['items'][0]['asset_id']=='abc'
    entries=[json.loads(x) for x in (target/'logs/usage.jsonl').read_text().splitlines()]
    assert [(x['provider'],x['ok']) for x in entries]==[('bad',False),('good',True)]


def test_music_reuses_existing_library_url_before_download(tmp_path, monkeypatch):
    target=tmp_path/'project'; (target/'assets').mkdir(parents=True)
    (target/'assets/lyrics.json').write_text(json.dumps({'segments':[{'end':90}]}))
    folder=tmp_path/'resources/music/abc';folder.mkdir(parents=True);(folder/'original.mp3').write_bytes(b'existing')
    monkeypatch.setattr(media,'collection',lambda _:SimpleNamespace(list=lambda:[{'asset_id':'abc','original_url':media.MUSIC_URL,'category':'stock'}]))
    monkeypatch.setattr(media.lib,'resolve_asset_path',lambda *a:folder/'original.mp3')
    monkeypatch.setattr(media,'probe',lambda p:dict(width=None,height=None,duration_seconds=100,fps=None,orientation=None))
    def run(cmd,check): Path(cmd[-1]).write_bytes(b'prepared')
    monkeypatch.setattr(media.subprocess,'run',run)
    async def get_license(target,provider,url,path):
        assert provider=='creativecommons';path.write_text('license')
    monkeypatch.setattr(media,'download',get_license)
    def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v))
    assert asyncio.run(media.music(tmp_path,target,'pilot',write,lambda *a:None))==0
    d=json.loads((folder/'resource.json').read_text())
    assert d['id']=='abc' and d['ready_file']=='undaunted-90s.mp3' and d['fetched_at'] is None
    assert json.loads((target/'music.json').read_text())['asset_id']=='abc'
