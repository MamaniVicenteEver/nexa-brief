"""Integración sintética: perfil migrado, preview y nueva grabación sin publicar."""
import json
import os
import re
from urllib.parse import urljoin
from pathlib import Path
import subprocess
import sys

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.config.settings import settings
from src.core.content_registry import get_video as get_registered_video
from src.core.explainer.catalog import get_video
from src.core.explainer.recorder import ExplainerRecorder, RecordState, render_filename
from src.presentation.api.routers import explainer

SERVER = Path(__file__).resolve().parents[2]
MIGRATE = SERVER / 'scripts/migrate-profile-layout.py'


def put(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content if isinstance(content, bytes) else content.encode())
    return path


@pytest.mark.asyncio
async def test_v3_pipeline_production_files_use_canonical_category_and_keep_private_paths_closed(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from src.core import categories

    root = tmp_path / 'profile'
    root.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'templates_dir', SERVER / 'src/templates')
    monkeypatch.setattr(categories, 'list_categories', lambda: {
        'node_motion': categories.CategoryNode(display_name='Motion', engine='pipeline'),
        'custom_category': categories.CategoryNode(display_name='Custom'),
    })
    production = root / 'productions/nodemotion/job1'
    put(production / 'index.html', '<html>synthetic</html>')
    put(production / 'assets/clip.mp4', b'synthetic clip')
    put(production / 'work/result.txt', 'private')
    put(production / 'assets/access.json', 'private')
    put(root / 'productions/otros/unmapped/index.html', '<html>other</html>')
    put(root / 'productions/custom_category/job2/index.html', '<html>custom</html>')
    outside = put(tmp_path / 'outside.mp4', b'outside')
    (production / 'assets/link.mp4').symlink_to(outside)
    app = FastAPI()
    app.include_router(explainer.router, prefix='/api/v1')
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        prefix = '/api/v1/explainer/files/'
        for path in ('productions/nodemotion/job1/index.html', 'productions/otros/unmapped/index.html',
                     'productions/custom_category/job2/index.html'):
            assert (await client.get(prefix + path)).status_code == 200
        clip = await client.get(prefix + 'productions/nodemotion/job1/assets/clip.mp4')
        assert clip.status_code == 200 and clip.content == b'synthetic clip'
        for path in ('productions/nodemotion/job1/work/result.txt',
                     'productions/nodemotion/job1/assets/access.json',
                     'productions/nodemotion/job1/assets/link.mp4',
                     'productions/unknown/job/index.html'):
            assert (await client.get(prefix + path)).status_code == 404
    assert not explainer.is_servable(('productions', 'nodemotion', 'job1', '..', 'index.html'))


@pytest.mark.asyncio
async def test_migrated_preview_and_recording_are_resolvable(tmp_path, monkeypatch):
    root, old = tmp_path / 'profile', tmp_path / 'legacy-templates'
    root.mkdir()
    old.mkdir()
    put(root/'profile.json', json.dumps({'id':'testprofile','schema_version':1,'providers':{}}))
    put(root/'data/explainer/productions.json', json.dumps([{'production_id':'prod1','video_id':'demo',
        'folder':'nodetech','state':'ready','category_path':'node_tech','topic':'Synthetic'}]))
    original = old/'nodetech/demo'
    put(original/'index.html', '<html><head><script src="../../_tools/explainer-kit/engine/loader.js"></script></head><body></body></html>')
    put(original/'manifest.json', json.dumps({'video_id':'demo','design':'rough','status':'listo','title':'Synthetic'}))
    put(original/'assets/config.json', json.dumps({'configs':[{'id':'demo','audio':{'src':'assets/song.mp3'},'lyricsUrl':'assets/lyrics.json','storyboardUrl':'assets/storyboard.json'}]}))
    put(original/'assets/lyrics.json', '{"segments":[]}')
    put(original/'assets/storyboard.json', json.dumps({'beats':[{'params':{'src':'/nodetech/demo/assets/media/test.png'}}]}))
    put(original/'assets/media/test.png', b'image')
    put(original/'assets/song.mp3', b'audio')
    env = {'PATH':os.environ['PATH'],'XDG_CONFIG_HOME':str(tmp_path/'xdg')}
    def run(*opts):
        return subprocess.run([sys.executable,str(MIGRATE), '--target-version', '2','--profile-dir',str(root),'--templates-dir',str(old),*opts],
                              env=env,capture_output=True,text=True,timeout=30)
    prepare = run('--local-prepare','--confirm-maintenance','--confirm-templates-owned')
    assert prepare.returncode == 0, prepare.stderr
    ident = next(line.split('=',1)[1] for line in prepare.stdout.splitlines() if line.startswith('migration_id='))
    result = run('--local-activate','--migration-id',ident,'--confirm-maintenance')
    assert result.returncode == 0, result.stderr
    assert json.loads((root/'config/niches.json').read_text())
    monkeypatch.setattr(settings,'storage_profile_dir',root)
    monkeypatch.setattr(settings,'storage_layout_version',2)
    monkeypatch.setattr(settings,'data_dir',root/'data')
    monkeypatch.setattr(settings,'output_dir',root/'renders')
    monkeypatch.setattr(settings,'templates_dir',SERVER/'src/templates')
    video = get_video('demo')
    assert video and video.path == root/'productions/nodetech/demo'
    request = Request({'type':'http','method':'GET','path':'/','headers':[]})
    html = await explainer.get_explainer_file('productions/nodetech/demo/index.html',request)
    loader = re.search(rb'<script src="([^"]+)"', html.body).group(1).decode()
    assert urljoin('/api/v1/explainer/files/productions/nodetech/demo/index.html', loader) == '/api/v1/explainer/files/_tools/explainer-kit/engine/loader.js'
    assert urljoin('/productions/nodetech/demo/index.html', loader) == '/_tools/explainer-kit/engine/loader.js'
    storyboard = json.loads((video.path/'assets/storyboard.json').read_text())
    assert storyboard['beats'][0]['params']['src'] == '/productions/nodetech/demo/assets/media/test.png'
    response = await explainer.get_explainer_file('productions/nodetech/demo/assets/media/test.png',request)
    assert response.status_code == 200
    with pytest.raises(HTTPException):
        await explainer.get_explainer_file('productions/nodetech/demo/work/private.json',request)

    async def fake_render(vid, seconds, formats, *, output_dir, on_output=None):
        for fmt in formats:
            (output_dir/render_filename(vid,fmt,seconds)).write_bytes(b'synthetic-mp4')
    recorder = ExplainerRecorder(render_runner=fake_render,output_root=root/'renders')
    job = recorder.submit(video,duration='10',formats=['16x9'])
    done = await recorder.wait(job.job_id)
    assert done.state == RecordState.done, done.error
    assert Path(done.outputs[0]).read_bytes() == b'synthetic-mp4'
    index = get_registered_video('demo')
    assert index['production_id'] == 'prod1'
    assert any(row['kind']=='video' and row['storage_key'].startswith('renders/demo/') for row in index['resources'])
    assert all(path.suffix == '.json' for path in (root/'data').rglob('*') if path.is_file())
