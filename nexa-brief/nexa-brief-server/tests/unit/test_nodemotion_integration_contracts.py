"""Critical HTTP contracts for data-only NodeMotion projects and recorder hosts."""
from __future__ import annotations

import functools
import hashlib
import http.server
import json
import re
import threading
from types import SimpleNamespace
from urllib.parse import urljoin, urlsplit
from urllib.request import urlopen

import pytest

from src.core.job import Job, JobInput
from src.core.nodemotion.shared import execution, resources
from src.templates._tools.nodemotion.shared import assemble as engines


def _project(tmp_path, monkeypatch):
    audio = tmp_path / "library.mp3"
    audio.write_bytes(b"0123456789-shared-read-only-audio")
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio)
    root = tmp_path / "project"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text('{"custom_project": true}')
    execution.create_project(root, "lyrics-caution", {"song.mp3": resources.asset_ref("music", "one")},
                             timeline={"segments": [{"text": "project words"}]})
    return root, audio


async def test_generic_template_preview_resolves_project_without_physical_index(api_client, tmp_path, monkeypatch):
    from src.presentation.api.routers import templates as router
    root, audio = _project(tmp_path, monkeypatch)
    before = hashlib.sha256(audio.read_bytes()).hexdigest()
    monkeypatch.setattr(router.preview_tracker, "get", lambda _: {"output_dir": str(root), "assets_dir": str(root / "assets")})
    url = "/api/v1/templates/preview/review/index.html"
    response = await api_client.get(url)
    assert response.status_code == 200
    assert not (root / "index.html").exists()
    assert b"nodemotion-design" not in response.content
    base = re.search(r'<base\s+href="([^"]+)"', response.text).group(1)
    config_url = urljoin(urljoin(url, base), "config.json")
    config = await api_client.get(config_url)
    assert config.status_code == 200
    assert config.json()["custom_project"] is True
    lyrics = await api_client.get(urljoin(urljoin(url, base), "lyrics.json"))
    assert lyrics.status_code == 200
    assert lyrics.json()["segments"][0]["text"] == "project words"
    song = await api_client.get(urljoin(urljoin(url, base), "song.mp3"), headers={"Range": "bytes=2-6"})
    assert song.status_code == 206
    assert song.content == b"23456"
    assert hashlib.sha256(audio.read_bytes()).hexdigest() == before
    assert not (root / "assets/song.mp3").exists()


async def test_revision_index_keeps_an_anchored_single_revision_base(api_client, tmp_path, monkeypatch):
    from src.presentation.api.routers import drafts as router
    root, _ = _project(tmp_path, monkeypatch)
    job = Job(input=JobInput(category_name="lyrics_video_caution"))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"output_dir": root})})
    draft = SimpleNamespace(template_id="lyrics-caution", original=False)
    async def get(_):
        return draft
    monkeypatch.setattr(router.drafts, "get", get)
    monkeypatch.setattr(router.drafts, "load_job", lambda _: job)
    revision = engines.engine_revision("lyrics-caution")
    url = f"/api/v1/drafts/review/preview/revision/{revision}/index.html"
    response = await api_client.get(url)
    assert response.status_code == 200
    base = re.search(r'<base\s+href="([^"]+)"', response.text).group(1)
    config_url = urljoin(urljoin(url, base), "config.json")
    assert urlsplit(config_url).path.count("/revision/") == 1
    config = await api_client.get(config_url)
    assert config.status_code == 200
    assert config.json()["custom_project"] is True


def test_static_directory_urls_resolve_canonical_document():
    from src.templates._tools.http_media import MediaRequestHandler
    handler = functools.partial(MediaRequestHandler, directory=str(engines.TEMPLATES))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_port}"
        with urlopen(base + "/nodemotion/lyrics/lyrics-caution/") as response:
            assert response.read() == engines.assemble("lyrics-caution")
        with urlopen(base + "/nodemotion/lyrics/lyrics-trazo/components/escenas.js") as response:
            assert response.read() == engines.resolve_runtime_asset("lyrics-trazo", "components/escenas.js").read_bytes()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


async def test_generic_promo_preview_rejects_missing_timeline_before_background_work(api_client, monkeypatch):
    from src.presentation.api.routers import templates as router
    def unexpected(*args, **kwargs):
        pytest.fail("Missing timeline must be rejected before creating a job")
    monkeypatch.setattr(router.preview_tracker, "create", unexpected)
    response = await api_client.post("/api/v1/templates/promo-editorial/preview", data={"topic": "topic"})
    assert response.status_code == 422
