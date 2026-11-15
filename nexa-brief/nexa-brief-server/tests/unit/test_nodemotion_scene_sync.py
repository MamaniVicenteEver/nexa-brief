import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/nodemotion/promo/tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('scene_workflow', TOOLS / 'draft_workflow.py')
workflow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow)


def setup_scene(tmp_path, monkeypatch, *, missing_media=False):
    from src.core import drafts
    target = tmp_path/'sandbox/demo'
    (target/'assets').mkdir(parents=True)
    output = tmp_path/'productions/job'
    content = output/'assets'
    content.mkdir(parents=True)
    scene = {'type': 'mediaWord', 'media': ['landscape']}
    desired = {'configs': [{'id': 'built', 'scenes': [scene], 'brand': {'tagline': 'UYUNI'}}]}
    (target/'assets/config.json').write_text(json.dumps(desired))
    current = {'activeId': 'active', 'configs': [{'id': 'active', 'scenes': [{'type': 'versus'}],
        'media': [] if missing_media else [{'id': 'landscape', 'src': 'inputs/real.mp4'}],
        'audio': {'src': 'song.mp3'}, 'palette': {'paper': '#ececea'}}]}
    path = content/'config.json'
    path.write_text(json.dumps(current))
    monkeypatch.setattr(drafts, 'load_job', lambda _: SimpleNamespace(
        artifacts=SimpleNamespace(output_dir=output, content_dir=content)))
    return target, path, current, scene


def test_sync_keeps_resolved_media_and_only_changes_scene_data(tmp_path, monkeypatch):
    target, path, original, scene = setup_scene(tmp_path, monkeypatch)
    read = lambda p: json.loads(p.read_text())
    workflow.sync_scene_config(target, 'new', read)
    actual = read(path)['configs'][0]
    assert actual['scenes'] == [scene]
    assert actual['media'] == original['configs'][0]['media']
    assert actual['audio'] == original['configs'][0]['audio']
    assert actual['palette'] == original['configs'][0]['palette']
    assert actual['brand']['tagline'] == 'UYUNI'
    assert not list(path.parent.glob('.scene-config-*'))


def test_sync_rejects_missing_media_without_changing_preview(tmp_path, monkeypatch):
    target, path, original, _ = setup_scene(tmp_path, monkeypatch, missing_media=True)
    with pytest.raises(ValueError, match='medios'):
        workflow.sync_scene_config(target, 'new', lambda p: json.loads(p.read_text()))
    assert json.loads(path.read_text()) == original


def test_sync_rejects_symlink_config(tmp_path, monkeypatch):
    target, path, original, _ = setup_scene(tmp_path, monkeypatch)
    outside = tmp_path/'other-config.json'
    outside.write_text(json.dumps(original))
    path.unlink()
    path.symlink_to(outside)
    with pytest.raises(ValueError, match='enlazado'):
        workflow.sync_scene_config(target, 'new', lambda p: json.loads(p.read_text()))
    assert json.loads(outside.read_text()) == original
