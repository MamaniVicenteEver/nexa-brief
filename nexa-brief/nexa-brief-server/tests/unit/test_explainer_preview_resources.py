import json

import pytest
from starlette.responses import FileResponse

from src.presentation.api.routers import explainer


@pytest.fixture
def storyboard(tmp_path, monkeypatch):
    monkeypatch.setattr(explainer, "TEMPLATES_DIR", tmp_path)
    path = tmp_path / "nodetech/demo/assets/storyboard.json"
    path.parent.mkdir(parents=True)
    data = {"beats": [{"params": {
        "src": "/nodetech/demo/assets/media/cover.png",
        "srcAfter": "/nodehistory/other/assets/media/after.jpg?v=2#focus",
        "video": "assets/media/clip.mp4",
        "logo": "https://example.org/logo.svg",
        "already": "/api/v1/explainer/files/nodetech/demo/assets/media/cover.png",
        "external": "//example.org/cover.png",
        "private": "/etc/passwd",
        "traversal": "/nodetech/../.env",
    }}]}
    path.write_text(json.dumps(data))
    image = path.parent / "media/cover.png"
    image.parent.mkdir()
    image.write_bytes(b"public-image")
    return path, data


@pytest.mark.asyncio
async def test_preview_translates_rooted_media_without_changing_stored_storyboard(api_client, storyboard):
    path, original = storyboard
    response = await api_client.get("/api/v1/explainer/files/nodetech/demo/assets/storyboard.json")
    assert response.status_code == 200
    params = response.json()["beats"][0]["params"]
    assert params["src"] == "/api/v1/explainer/files/nodetech/demo/assets/media/cover.png"
    assert params["srcAfter"] == "/api/v1/explainer/files/nodehistory/other/assets/media/after.jpg?v=2#focus"
    for key in ("video", "logo", "already", "external", "private", "traversal"):
        assert params[key] == original["beats"][0]["params"][key]
    assert json.loads(path.read_text()) == original
    image = await api_client.get(params["src"])
    assert image.status_code == 200
    assert image.content == b"public-image"


@pytest.mark.asyncio
async def test_new_preview_etag_replaces_cached_untranslated_body(api_client, storyboard):
    path, _ = storyboard
    old_etag = FileResponse(path, stat_result=path.stat()).headers["etag"]
    url = "/api/v1/explainer/files/nodetech/demo/assets/storyboard.json"
    response = await api_client.get(url, headers={"If-None-Match": old_etag})
    assert response.status_code == 200
    assert response.headers["etag"] != old_etag
    cached = await api_client.get(url, headers={"If-None-Match": response.headers["etag"]})
    assert cached.status_code == 304
    assert cached.headers["cache-control"] == "no-cache"


@pytest.mark.asyncio
async def test_preview_cache_changes_when_storyboard_changes(api_client, storyboard):
    path, original = storyboard
    url = "/api/v1/explainer/files/nodetech/demo/assets/storyboard.json"
    first = await api_client.get(url)
    original["beats"][0]["params"]["src"] = "/nodetech/demo/assets/media/new-cover.png"
    path.write_text(json.dumps(original))
    second = await api_client.get(url, headers={"If-None-Match": first.headers["etag"]})
    assert second.status_code == 200
    assert second.headers["etag"] != first.headers["etag"]
    assert second.json()["beats"][0]["params"]["src"].endswith("/new-cover.png")


@pytest.mark.asyncio
async def test_invalid_json_and_non_json_keep_file_serving_behavior(api_client, storyboard):
    path, _ = storyboard
    path.write_text('{"work in progress":')
    response = await api_client.get("/api/v1/explainer/files/nodetech/demo/assets/storyboard.json")
    assert response.status_code == 200
    assert response.text == path.read_text()


def test_nested_common_resource_urls_are_translated_and_other_text_is_unchanged():
    data = {"assets": ["/_tools/explainer-kit/images/paper.png", "El texto /nodetech no es una URL."]}
    result = explainer._preview_resource_urls(data)
    assert result["assets"] == ["/api/v1/explainer/files/_tools/explainer-kit/images/paper.png", data["assets"][1]]
