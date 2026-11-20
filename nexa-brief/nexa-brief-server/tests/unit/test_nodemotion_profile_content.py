"""Orphan projects retain their public URLs without a visible draft or HTML copy."""
from __future__ import annotations

import functools
import http.server
import json
import re
import threading
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import pytest

from src.config.settings import settings
from src.core.nodemotion.shared import content, execution, resources
from src.templates._tools.http_media import MediaRequestHandler, ProfileContentMixin


@pytest.fixture
def project(tmp_path, monkeypatch):
    profile = tmp_path / "selected-profile"
    profile.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", profile)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", profile / "data")
    root = profile / "productions/nodemotion/orphan"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text('{"orphan_project":true}')
    audio = profile / "resources/music/shared/song.mp3"
    audio.parent.mkdir(parents=True)
    audio.write_bytes(b"0123456789-shared-audio")
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio)
    execution.create_project(root, "lyrics-caution", {"song.mp3": resources.asset_ref("music", "one")},
                             policy="pinned", timeline={"segments": [{"text": "private project timing"}]})
    (root / "logs").mkdir()
    (root / "logs/secret.json").write_text('{"private":true}')
    return profile, root, audio


def server(profile, *, mixin=True):
    class Handler(ProfileContentMixin, MediaRequestHandler):
        pass
    handler = functools.partial(Handler if mixin else MediaRequestHandler, directory=str(profile))
    host = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    worker = threading.Thread(target=host.serve_forever, daemon=True)
    worker.start()
    return host, worker, f"http://127.0.0.1:{host.server_port}"


async def test_generic_profile_route_serves_orphan_index_assets_and_ranges(api_client, project):
    from src.core.data import collection
    profile, root, audio = project
    assert collection("drafts").list() == []
    url = "/api/v1/explainer/files/productions/nodemotion/orphan/index.html"
    response = await api_client.get(url)
    assert response.status_code == 200
    assert b"nodemotion-design" not in response.content
    assert not (root / "index.html").exists()
    base = re.search(r'<base\s+href="([^"]+)"', response.text).group(1)
    prefix = urljoin(url, base)
    assert (await api_client.get(urljoin(prefix, "config.json"))).json()["orphan_project"] is True
    timing = await api_client.get(urljoin(prefix, "lyrics.json"))
    assert timing.status_code == 200 and timing.json()["segments"]
    media = await api_client.get(urljoin(prefix, "song.mp3"), headers={"Range": "bytes=3-7"})
    assert media.status_code == 206 and media.content == b"34567"
    script = await api_client.get(urljoin(prefix, "components/intro.js"))
    assert script.status_code == 200 and script.content
    assert collection("drafts").list() == []
    assert audio.read_bytes() == b"0123456789-shared-audio"


@pytest.mark.parametrize("tail", ["project.json", "appearance.json", "logs/secret.json", "work/private.js", ".hidden.json"])
async def test_generic_project_route_does_not_fall_through_to_private_files(api_client, project, tail):
    _, root, _ = project
    response = await api_client.get("/api/v1/explainer/files/productions/nodemotion/orphan/" + tail)
    assert response.status_code == 404


@pytest.mark.parametrize("mixin", [True, False])
def test_static_profile_server_resolves_virtual_directory_and_exact_audio_range(project, mixin):
    profile, root, audio = project
    host, worker, base = server(profile, mixin=mixin)
    try:
        entry = base + "/productions/nodemotion/orphan/"
        with urlopen(entry) as response:
            html = response.read().decode()
            assert response.headers.get_content_type() == "text/html"
        href = re.search(r'<base\s+href="([^"]+)"', html).group(1)
        scoped = urljoin(entry, href)
        with urlopen(urljoin(scoped, "config.json")) as response:
            assert response.headers.get_content_type() == "application/json"
            assert json.load(response)["orphan_project"] is True
        with urlopen(urljoin(scoped, "lyrics.json")) as response:
            assert response.headers.get_content_type() == "application/json"
            assert json.load(response)["segments"]
        with urlopen(Request(urljoin(scoped, "song.mp3"), headers={"Range": "bytes=-5"})) as response:
            assert response.status == 206
            assert response.read() == audio.read_bytes()[-5:]
        with urlopen(urljoin(scoped, "components/intro.js")) as response:
            assert response.headers.get_content_type() in {"text/javascript", "application/javascript"}
            assert response.read()
        for private in ("logs/secret.json", "project.json"):
            with pytest.raises(HTTPError) as error:
                urlopen(base + "/productions/nodemotion/orphan/" + private)
            assert error.value.code == 404
    finally:
        host.shutdown()
        host.server_close()
        worker.join(timeout=2)


def test_locator_rejects_links_and_never_claims_other_profile_or_category(project, tmp_path):
    profile, root, _ = project
    other = tmp_path / "other-profile/productions/nodemotion/private/index.html"
    other.parent.mkdir(parents=True)
    other.write_text("private outside profile")
    assert content.locate_project_content(other) is None
    assert content.locate_project_content(profile / "productions/nodetech/item/index.html") is None
    (root / "assets/escape").symlink_to(other.parent, target_is_directory=True)
    with pytest.raises(ValueError, match="symlink"):
        content.locate_project_content(root / "assets/escape/index.html")


def test_static_responses_keep_logical_mime_when_canonical_suffix_differs(project, monkeypatch):
    profile, root, _ = project
    canonical = profile / "resources/shared/deduplicated.bin"
    canonical.parent.mkdir(parents=True)
    canonical.write_bytes(b"same exact asset bytes")
    original = content.resolve_static_project_content
    def resolve(path, request_path):
        if request_path.endswith("/font.woff2"):
            return canonical
        return original(path, request_path)
    monkeypatch.setattr(content, "resolve_static_project_content", resolve)
    host, worker, base = server(profile)
    try:
        with urlopen(base + "/productions/nodemotion/orphan/font.woff2") as response:
            assert response.headers.get_content_type() == "font/woff2"
            assert response.read() == canonical.read_bytes()
    finally:
        host.shutdown()
        host.server_close()
        worker.join(timeout=2)


def test_migrated_sandbox_project_remains_visible_and_reuses_cached_thumbnail(project, monkeypatch, tmp_path):
    from src.core.explainer import sandbox, sandbox_components, sandbox_thumbs
    profile, original, _ = project
    root = profile / "sandbox/nodemotion/known"
    root.parent.mkdir(parents=True)
    original.rename(root)
    assert not (root / "index.html").exists()
    item = sandbox.load_item(root, folder="nodemotion")
    assert item is not None and item.has_index and item.player == "protocol"
    assert item.kind == "hyperframes" and item.thumbnail_url
    components = sandbox_components.list_components(profile / "sandbox")
    assert next(item for item in components if item["id"] == "known")["has_index"] is True
    cache = tmp_path / "cached-thumbnails"
    thumbnail = cache / "nodemotion/known.jpg"
    thumbnail.parent.mkdir(parents=True)
    thumbnail.write_bytes(b"preserve existing thumbnail bytes")
    monkeypatch.setattr(sandbox_thumbs, "_has_visible_content", lambda path: True)
    def unexpected(*args):
        pytest.fail("Relocation must reuse the existing valid thumbnail")
    assert sandbox_thumbs.ensure_thumbnail(root, "nodemotion", "known", "unused", cache_dir=cache, capture=unexpected) == thumbnail
    assert thumbnail.read_bytes() == b"preserve existing thumbnail bytes"
    unknown = profile / "sandbox/nodemotion/custom"
    unknown.mkdir()
    (unknown / "index.html").write_text("<html>custom unchanged</html>")
    assert sandbox.load_item(unknown, folder="nodemotion").has_index
    assert not content.has_project_entry(unknown)


def add_alternate_entry(project, tmp_path, monkeypatch):
    from src.templates._tools.nodemotion.shared import assemble as engines
    _, root, _ = project
    design_id = "lyrics-caution"
    original = engines._design_root(design_id)
    manifest = engines.design_manifest(design_id)
    temporary_root = tmp_path / "temporary-engines"
    design = temporary_root / "lyrics/designs" / design_id
    design.mkdir(parents=True)
    names = {manifest["document"], *(item["path"] for item in manifest["fragments"]), *manifest["runtime_aliases"].values()}
    for name in names:
        path = design / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((original / name).read_bytes())
    (design / "manifest.json").write_text(json.dumps(manifest))
    monkeypatch.setattr(engines, "ROOT", temporary_root)
    alternate = b'<html><head><title>Alternate unchanged</title></head><body><script>fetch("assets/config.json")</script></body></html>'
    aliases = {**engines.runtime_assets(design_id), "index1.html": alternate}
    revision = engines.archive_engine(design_id, engines.assemble(design_id), aliases)
    path = root / "project.json"
    project_data = json.loads(path.read_text())
    project_data["engine"]["revision"] = revision
    path.write_text(json.dumps(project_data))
    return revision


async def test_generic_alternate_html_pins_all_relative_requests(api_client, project, tmp_path, monkeypatch):
    revision = add_alternate_entry(project, tmp_path, monkeypatch)
    url = "/api/v1/explainer/files/productions/nodemotion/orphan/index1.html"
    response = await api_client.get(url)
    assert response.status_code == 200 and "Alternate unchanged" in response.text
    href = re.search(r'<base\s+href="([^"]+)"', response.text).group(1)
    assert f"revision/{revision}/" in href
    config = await api_client.get(urljoin(urljoin(url, href), "assets/config.json"))
    assert config.status_code == 200 and config.json()["orphan_project"] is True


def test_static_alternate_html_pins_all_relative_requests(project, tmp_path, monkeypatch):
    revision = add_alternate_entry(project, tmp_path, monkeypatch)
    profile, _, _ = project
    host, worker, base = server(profile)
    try:
        url = base + "/productions/nodemotion/orphan/index1.html"
        with urlopen(url) as response:
            html = response.read().decode()
        assert "Alternate unchanged" in html
        href = re.search(r'<base\s+href="([^"]+)"', html).group(1)
        assert f"revision/{revision}/" in href
        with urlopen(urljoin(urljoin(url, href), "assets/config.json")) as response:
            assert json.load(response)["orphan_project"] is True
    finally:
        host.shutdown()
        host.server_close()
        worker.join(timeout=2)
