import hashlib
import json
from pathlib import Path

from src.core.explainer.backup_event import write_render_event


def test_cli_complete_formats_one_event_replaces_revision(tmp_path, monkeypatch):
    monkeypatch.delenv('NEXA_RENDER_MANAGED', raising=False)
    templates = tmp_path/'templates'; video = templates/'nodetech'/'demo'
    (video/'render').mkdir(parents=True)
    for fmt in ['16x9','9x16']:
        (video/'render'/f'demo-{fmt}.mp4').write_bytes(b'mp4')
    event = write_render_event(video,templates,tmp_path/'data','demo',['16x9','9x16'])
    old = json.loads(event.read_text())
    assert old['event_id'] == hashlib.sha256(b'nodetech/demo').hexdigest()[:32]
    (video/'render/demo-16x9.mp4').write_bytes(b'new revision')
    assert write_render_event(video,templates,tmp_path/'data','demo',['16x9','9x16']) == event
    assert json.loads(event.read_text())['outputs'] != old['outputs']
    assert len(list(event.parent.iterdir())) == 1
    monkeypatch.setenv('NEXA_RENDER_MANAGED','1')
    assert write_render_event(video,templates,tmp_path/'other-data','demo',['16x9']) is None
    assert not (tmp_path/'other-data').exists()


def test_incomplete_cli_does_not_create_completion_event(tmp_path, monkeypatch):
    import pytest
    monkeypatch.delenv('NEXA_RENDER_MANAGED', raising=False)
    templates = tmp_path/'templates'; video = templates/'nodetech/demo'; video.mkdir(parents=True)
    with pytest.raises(ValueError): write_render_event(video,templates,tmp_path/'data','demo',['16x9'])
    assert not (tmp_path/'data').exists()
