import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from src.config.content_paths import content_key, is_private_content_key, resolve_content_key
from src.config.settings import settings


@pytest.fixture
def profile(tmp_path, monkeypatch):
    root = tmp_path / "profile"
    templates = tmp_path / "templates"
    root.mkdir()
    templates.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "templates_dir", templates)
    return root, templates


def test_namespaces_roundtrip_and_shared_runtime(profile):
    root, templates = profile
    files = [root / "productions/nodetech/abc/assets/photo.png", root / "sandbox/nodetech/abc/index.html",
             root / "renders/abc/recording/video.mp4", templates / "_tools/explainer-kit/engine/loader.js",
             templates / "sandbox/_proto/components.json"]
    for path in files:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("test")
        assert resolve_content_key(content_key(path)) == path
    assert content_key(files[-1]).startswith("bundled/")
    assert resolve_content_key("sandbox/_proto/components.json") == files[-1]


def test_rejects_escape_and_private_previews(profile, tmp_path):
    root, _ = profile
    (root / "productions").mkdir()
    (root / "productions/escape").symlink_to(tmp_path)
    for key in ("../secret", "/absolute", "productions/../data/secret.json", "productions/escape/private.json"):
        with pytest.raises(ValueError):
            resolve_content_key(key)
    for key in ("productions/cat/id/work/screenshot.png", "sandbox/cat/id/assets/accounts.json", "_tools/.env"):
        assert is_private_content_key(key)
    assert not is_private_content_key("productions/cat/id/assets/photo.png")


def test_cli_new_creates_production_outside_source(tmp_path):
    server = Path(__file__).resolve().parents[2]
    root = tmp_path / "profile"
    root.mkdir()
    (root / "profile.json").write_text(json.dumps({"schema_version": 2, "id": "test", "providers": {}}))
    env = {**os.environ, "NEXA_PROFILE_DIR": str(root), "XDG_CONFIG_HOME": str(tmp_path / "config")}
    result = subprocess.run([sys.executable, str(server / "src/templates/_tools/explainer-kit/tools/kit.py"),
                             "new", "rough", "test-new-profile", "--folder", "nodetech", "--title", "Test"],
                            cwd=server, env=env, capture_output=True, text=True, timeout=25)
    assert result.returncode == 0, result.stdout + result.stderr
    video = root / "productions/nodetech/test-new-profile"
    assert (video / "assets/config.json").is_file()
    assert (video / "work/results/test").is_dir()
    assert not (video / "render").exists()
    assert 'src="/_tools/explainer-kit/engine/loader.js"' in (video / "index.html").read_text()
    assert not (server / "src/templates/nodetech/test-new-profile").exists()


def test_preview_urls_follow_v2_locations_and_bundled_namespace(profile, monkeypatch):
    from src.core.explainer.catalog import ExplainerVideo
    from src.presentation.api.routers import explainer

    root, templates = profile
    video_dir = root / 'productions/nodetech/same-id'
    photo = video_dir / 'assets/thumbnails/thumbnail-A.jpg'
    photo.parent.mkdir(parents=True)
    photo.write_bytes(b'image')
    video = ExplainerVideo(video_id='same-id', path=video_dir, design='rough', category_path='node_tech',
                           title='Test', status='listo', duration_seconds=1)
    monkeypatch.setattr(explainer.thumbnails, 'intro_specs', lambda _: {'A': {'component': 'intro', 'params': {}}})
    monkeypatch.setattr(explainer.thumbnails, 'capture_current', lambda *_: True)
    monkeypatch.setattr(explainer.thumbnails, 'chosen_option', lambda _: 'A')
    response = explainer._valid_thumbnails(video)
    assert response.options[0].url.startswith('/api/v1/explainer/files/productions/nodetech/same-id/assets/thumbnails/thumbnail-A.jpg?')
    bundled = templates / 'sandbox/nodehistory/same-id'
    bundled.mkdir(parents=True)
    demo = ExplainerVideo(video_id='same-id', path=bundled, design='rough', category_path='node_tech',
                          title='Demo', status='listo', duration_seconds=1)
    with pytest.raises(ValueError, match="not shared"):
        explainer._video_preview_url(demo)
    render = root / 'renders/same-id/full/same-id-16x9.mp4'
    render.parent.mkdir(parents=True)
    render.write_bytes(b'video')
    assert explainer._render_video_url(demo, '16x9') is None
    assert explainer._render_video_url(video, '16x9') == '/api/v1/explainer/files/renders/same-id/full/same-id-16x9.mp4'
    sandbox = root / 'sandbox/nodetech/same-id'
    sandbox.mkdir(parents=True)
    example = ExplainerVideo(video_id='same-id', path=sandbox, design='rough', category_path='node_tech',
                             title='Example', status='listo', duration_seconds=1)
    assert explainer._render_video_url(example, '16x9') is None


@pytest.mark.asyncio
async def test_v2_cannot_read_legacy_episodes_but_can_read_explicit_samples(profile):
    from fastapi import HTTPException
    from starlette.requests import Request
    from src.presentation.api.routers.explainer import get_explainer_file

    root, templates = profile
    request = Request({'type': 'http', 'method': 'GET', 'path': '/', 'headers': []})
    for key in ('sandbox/nodeaction/private-episode/index.html', 'nodetech/private-video/index.html'):
        source = templates / key
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text('<html>private legacy episode</html>')
        with pytest.raises(ValueError):
            content_key(source)
        for prefix in ('', 'bundled/'):
            if not prefix and key.startswith('sandbox/'):
                # Unprefixed sandbox belongs to this profile, never the repository.
                assert resolve_content_key(key) == root / key
                assert not resolve_content_key(key).exists()
            else:
                with pytest.raises(ValueError):
                    resolve_content_key(prefix + key)
            with pytest.raises(HTTPException) as exc:
                await get_explainer_file(prefix + key, request)
            assert exc.value.status_code == 404
    sample = templates / 'nodetech/muestras/rough/demo/index.html'
    sample.parent.mkdir(parents=True)
    sample.write_text('<html>public sample</html>')
    assert resolve_content_key(content_key(sample)) == sample
    assert (await get_explainer_file(content_key(sample), request)).status_code == 200
