import json

import pytest

from src.presentation.api.routers import explainer


@pytest.fixture
def preview_files(tmp_path, monkeypatch):
    monkeypatch.setattr(explainer, "TEMPLATES_DIR", tmp_path)
    directory = tmp_path / "nodetech/demo/assets"
    directory.mkdir(parents=True)
    (directory / "large.js").write_text("const example = 'repeated text';\n" * 4000)
    (directory / "large.mp4").write_bytes(b"video" * 20000)
    (directory / "storyboard.json").write_text(json.dumps({
        "src": "/nodetech/demo/assets/media/cover.png", "text": "x" * 70000,
    }))
    return directory


@pytest.mark.asyncio
async def test_gzip_identity_range_and_conditional(api_client, preview_files):
    url = "/api/v1/explainer/files/nodetech/demo/assets/large.js"
    identity = await api_client.get(url, headers={"Accept-Encoding": "identity"})
    zipped = await api_client.get(url, headers={"Accept-Encoding": "br, gzip;q=0.8"})
    assert identity.status_code == zipped.status_code == 200
    assert "content-encoding" not in identity.headers
    assert zipped.headers["content-encoding"] == "gzip"
    assert zipped.headers["vary"] == "Accept-Encoding"
    assert zipped.headers["cache-control"] == "no-cache"
    assert "javascript" in zipped.headers["content-type"]
    assert zipped.content == identity.content
    assert int(zipped.headers["content-length"]) < len(identity.content)
    assert zipped.headers["etag"] != identity.headers["etag"]
    cached = await api_client.get(url, headers={"Accept-Encoding": "gzip", "If-None-Match": zipped.headers["etag"]})
    assert cached.status_code == 304
    assert cached.headers["etag"] == zipped.headers["etag"]
    assert cached.headers["vary"] == "Accept-Encoding"
    partial = await api_client.get(url, headers={"Accept-Encoding": "gzip", "Range": "bytes=0-19"})
    assert partial.status_code == 206
    assert "content-encoding" not in partial.headers
    assert partial.content == identity.content[:20]
    disabled = await api_client.get(url, headers={"Accept-Encoding": "gzip;q=0"})
    assert "content-encoding" not in disabled.headers


@pytest.mark.asyncio
async def test_noncompressible_and_transformed_json(api_client, preview_files):
    base = "/api/v1/explainer/files/nodetech/demo/assets/"
    video = await api_client.get(base + "large.mp4", headers={"Accept-Encoding": "gzip"})
    assert "content-encoding" not in video.headers
    result = await api_client.get(base + "storyboard.json", headers={"Accept-Encoding": "gzip"})
    assert result.headers["content-encoding"] == "gzip"
    assert result.headers["content-type"].startswith("application/json")
    assert result.json()["src"] == base + "media/cover.png"
    cached = await api_client.get(base + "storyboard.json", headers={
        "Accept-Encoding": "gzip", "If-None-Match": result.headers["etag"],
    })
    assert cached.status_code == 304
    identity = await api_client.get(base + "storyboard.json", headers={"Accept-Encoding": "identity"})
    assert identity.json() == result.json()
    assert identity.headers["etag"] != result.headers["etag"]


@pytest.mark.asyncio
async def test_cache_reuses_and_invalidates_compressed_file(api_client, preview_files, monkeypatch):
    calls = []
    compress = explainer.gzip.compress

    def counting_compress(*args, **kwargs):
        calls.append(1)
        return compress(*args, **kwargs)

    monkeypatch.setattr(explainer.gzip, "compress", counting_compress)
    url = "/api/v1/explainer/files/nodetech/demo/assets/large.js"
    headers = {"Accept-Encoding": "gzip"}
    first = await api_client.get(url, headers=headers)
    second = await api_client.get(url, headers=headers)
    assert first.content == second.content
    assert len(calls) == 1
    (preview_files / "large.js").write_text("changed content\n" * 8000)
    changed = await api_client.get(url, headers=headers)
    assert changed.content != first.content
    assert changed.headers["etag"] != first.headers["etag"]
    assert len(calls) == 2
