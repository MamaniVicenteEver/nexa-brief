import json
from pathlib import Path

from src.core.explainer import catalog, production_templates, sandbox_info


def test_registered_demo_uses_historical_usage_when_manifest_has_no_count(tmp_path, monkeypatch):
    root = tmp_path / 'templates'
    video = root / 'nodeatlas' / 'demo'
    video.mkdir(parents=True)
    (video/'manifest.json').write_text(json.dumps({'title':'Demo','design':'atlas','demo':True}))
    (video/'usage-report.json').write_text('{}')
    monkeypatch.setattr(catalog, 'TEMPLATES_DIR', root)
    monkeypatch.setattr(production_templates, 'shared_demo', lambda templates, video_id: video)
    monkeypatch.setattr(sandbox_info, 'get_item_costs', lambda root, item: (True, 277804, False))
    monkeypatch.setattr(catalog, 'preview_directory', lambda path: path/'render')
    assert catalog.load_video(video).estimated_tokens == 277804
    # A private/unregistered directory is never read through this fallback.
    monkeypatch.setattr(production_templates, 'shared_demo', lambda templates, video_id: None)
    monkeypatch.setattr(sandbox_info, 'get_item_costs', lambda *args: (_ for _ in ()).throw(AssertionError()))
    assert catalog.load_video(video).estimated_tokens is None


def test_explicit_manifest_count_takes_precedence(tmp_path, monkeypatch):
    video=tmp_path/'demo'; video.mkdir()
    (video/'manifest.json').write_text(json.dumps({'title':'Demo','estimated_tokens':42}))
    (video/'usage-report.json').write_text('{}')
    monkeypatch.setattr(production_templates, 'shared_demo', lambda *args: (_ for _ in ()).throw(AssertionError()))
    monkeypatch.setattr(catalog, 'preview_directory', lambda path: path/'render')
    assert catalog.load_video(video).estimated_tokens == 42
