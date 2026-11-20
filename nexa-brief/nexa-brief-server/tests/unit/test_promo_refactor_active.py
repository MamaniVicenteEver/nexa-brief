from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import pytest
from src.core.template_config import active_config
from src.core.nodemotion.promo import prompts as promo_prompts


def test_active_config_selects_requested_case_and_falls_back_like_runtime():
    raw = {'activeId': 'b', 'configs': [{'id': 'a', 'scenes': [1]}, {'id': 'b', 'scenes': [2]}]}
    assert active_config(raw) is raw['configs'][1]
    raw['activeId'] = 'missing'
    assert active_config(raw) is raw['configs'][0]
    flat = {'scenes': [1]}
    assert active_config(flat) is flat


@pytest.mark.parametrize('raw', [{'configs': []}, {'configs': None}, {'configs': [None]}, []])
def test_active_config_rejects_invalid_collections(raw):
    with pytest.raises(ValueError):
        active_config(raw)


def test_bind_reference_is_idempotent_concurrently_and_detects_tampering(tmp_path):
    value = promo_prompts.reference()
    path = tmp_path / 'prompts-version.json'
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: promo_prompts.bind_reference(path, value), range(4)))
    assert all(result == value for result in results)
    altered = json.loads(path.read_text())
    altered['hashes']['base.md'] = '0' * 64
    path.write_text(json.dumps(altered))
    with pytest.raises(ValueError):
        promo_prompts.bind_reference(path, value)


def test_pin_legacy_requires_explicit_adoption(tmp_path):
    (tmp_path / 'brief.json').write_text('{}')
    (tmp_path / 'work').mkdir()
    with pytest.raises(ValueError):
        promo_prompts.pin_project(tmp_path)
    result = promo_prompts.pin_project(tmp_path, adopt=True)
    assert promo_prompts.pin_project(tmp_path) == result


def test_music_new_and_reused_share_preparation(tmp_path):
    import ast
    import asyncio
    import tempfile
    from types import SimpleNamespace
    source = Path('src/templates/_tools/nodemotion/promo/tools/media.py').read_text()
    node = next(n for n in ast.parse(source).body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'music')
    root, target = tmp_path / 'profile', tmp_path / 'project'
    folder = root / 'resources/music/track'
    folder.mkdir(parents=True)
    target.mkdir()
    original = folder / 'original.mp3'
    original.write_bytes(b'audio')
    sidecar = folder / 'resource.json'
    operations = []
    def write_json(path, obj):
        path.write_text(json.dumps(obj))
    async def download(target, provider, url, path):
        operations.append(('download', provider))
        path.write_bytes(b'audio')
    async def register_music(*args, **kwargs):
        return SimpleNamespace(asset_id='track')
    def run(cmd, **kwargs):
        operations.append(('ffmpeg', cmd[cmd.index('-t') + 1]))
        Path(cmd[-1]).write_bytes(b'clip')
    lib = SimpleNamespace(hash_file=lambda path:'hash', find_music_by_hash=lambda digest:None,
                          register_music=register_music, resolve_asset_path=lambda kind, ident:original)
    def find(*args, **kwargs):
        return (sidecar, json.loads(sidecar.read_text())) if sidecar.exists() else None
    def use(found, project_id, write):
        return found[1]
    env = {'Path':Path, 'tempfile':tempfile, 'json':json, 'lib':lib, 'find':find, 'use':use,
           'collection':lambda name:SimpleNamespace(list=lambda:[]), 'download':download,
           'probe':lambda p:{'duration_seconds':100}, 'read_duration':lambda p:70,
           'subprocess':SimpleNamespace(run=run), 'now':lambda:'2026-11-12',
           'MUSIC_URL':'https://music', 'MUSIC_SOURCE':'https://source', 'MUSIC_LICENSE':'https://license'}
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<music>', 'exec'), env)
    asyncio.run(env['music'](root,target,'p',write_json,lambda *args:None))
    first=json.loads((target/'music.json').read_text())
    assert first == {'asset_id':'track','duration_seconds':70.0,'ready_file':'undaunted-70s.mp3'}
    assert json.loads(sidecar.read_text())['ready_file'] == first['ready_file']
    asyncio.run(env['music'](root,target,'p',write_json,lambda *args:None))
    assert operations.count(('ffmpeg','70.0')) == 1
    assert operations.count(('download','creativecommons')) == 1
    assert json.loads((target/'music.json').read_text()) == first


@pytest.mark.parametrize('template', sorted(promo_prompts.TEMPLATES))
def test_scene_contract_matches_generator_spec(template):
    root = Path(__file__).resolve().parents[2] / 'src'
    contract = json.loads((root / 'templates/_tools/nodemotion/promo/production/templates' / f'{template}.json').read_text())
    spec = json.loads((root / 'templates/_tools/nodemotion/promo/compiler/build' / f'{template}.spec.json').read_text())
    metadata = {'max_text_lines', 'min_text_lines', 'text_source'}
    scenes = [{k: v for k, v in scene.items() if k not in metadata} for scene in contract['default_scenes']]
    assert scenes == spec['config']['scenes']
