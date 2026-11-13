import json

import pytest

from src.config.settings import settings
from src.core.catalog.models import CatalogCategory, CatalogItem, Playback
from src.core.catalog.service import CatalogService


def test_public_demos_only_and_shared_categories_do_not_duplicate(sample):
    page = sample[4].list()
    assert page.total == 1
    assert page.items[0].category_ids == ["history", "tech"]
    assert sample[4].list(category="tech").total == 1
    assert page.category_counts == {"history": 1, "tech": 1}
    assert "/catalog/media/nodehistory/public-demo/" in page.items[0].poster_url


def test_all_by_default_and_filter_before_pagination():
    class MemoryRepository:
        def list_items(self):
            return [CatalogItem(id=str(i), source_id=str(i), kind="demo", title=str(i),
                                category_ids=["a" if i % 2 else "b"], playback=Playback()) for i in range(7)]
    class MemoryCategories:
        def list_categories(self):
            return [CatalogCategory(id="a", name="A"), CatalogCategory(id="b", name="B")]
    service = CatalogService(MemoryRepository(), MemoryCategories())
    assert service.list().total == 7
    assert len(service.list().items) == 7
    first = service.list(category="a", page_size=2)
    second = service.list(category="a", page_size=2, page=2)
    assert first.total == 3 and first.total_pages == 2
    assert [x.id for x in first.items] == ["1", "3"]
    assert [x.id for x in second.items] == ["5"]
    for invalid in (0, -1, "bad", 101):
        with pytest.raises(ValueError):
            service.list(page_size=invalid)


def test_engine_and_complete_mp4_both_present(sample):
    _, public, _, _, service = sample
    assert service.list().items[0].playback.desktop_video_url is None
    (public / "render/public-demo-16x9.mp4").write_bytes(b"complete-video")
    item = service.list().items[0]
    assert item.playback.desktop_video_url.endswith("public-demo-16x9.mp4")
    assert item.playback.engine_url.endswith("index.html")


def test_background_clip_is_not_complete_motion_demo(sample):
    templates = sample[0]
    folder = templates / "nodetech/video/test"
    (folder / "assets").mkdir(parents=True)
    (folder / "assets/bg.mp4").write_bytes(b"background")
    (folder / "index.html").write_text("engine")
    (templates / "templates.json").write_text(json.dumps({"templates": {"test": {
        "folder": "nodetech/video/test", "index_html": "nodetech/video/test/index.html"}}}))
    item = next(i for i in sample[4].list().items if i.kind == "template")
    assert item.playback.desktop_video_url is None


@pytest.mark.parametrize("key", [
    "nodehistory/private-episode/index.html", "productions/nodehistory/public-demo/index.html",
    "nodehistory/public-demo/manifest.json", "nodehistory/public-demo/publish.json",
    "nodehistory/public-demo/../../private-episode/index.html", "sandbox/nodehistory/private/index.html",
    "nodehistory/public-demo/assets/credentials.json", "_tools/explainer-kit/AGENTS.md",
])
def test_public_media_denies_private_and_traversal(sample, key):
    with pytest.raises(FileNotFoundError):
        sample[3].open(key)


def test_public_media_rejects_symlink(sample, tmp_path):
    external = tmp_path / "private.json"
    external.write_text("private")
    assets = sample[1] / "assets"
    assets.mkdir()
    (assets / "data.json").symlink_to(external)
    with pytest.raises(FileNotFoundError):
        sample[3].open("nodehistory/public-demo/assets/data.json")


def test_shared_player_and_map_dependencies_are_public_but_profile_files_are_not(sample):
    templates, _, _, media, _ = sample
    for key in ("_tools/player/bridge.js", "nodeatlas/_atlas/data/geo/admin0.geojson",
                "sandbox/nodehistory/_atlas/cache/vector/world.pmtiles"):
        path = templates / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"shared-runtime")
        assert media.open(key).size > 0
    with pytest.raises(FileNotFoundError):
        media.open("sandbox/nodehistory/private-demo/assets/song.mp3")


async def test_public_list_playback_stream_ranges_and_conditional_get(client, sample):
    response = await client.get("/api/v1/catalog")
    assert response.status_code == 200 and response.json()["total"] == 1
    media = await client.get(response.json()["items"][0]["playback"]["engine_url"])
    assert media.status_code == 200
    assert b"/api/v1/explainer/files/" not in media.content
    assert b"/api/v1/catalog/media/_tools/player/player.js" in media.content
    assert (await client.get(response.json()["items"][0]["playback"]["engine_url"],
                             headers={"If-None-Match": media.headers["etag"]})).status_code == 304
    (sample[1] / "render/public-demo-16x9.mp4").write_bytes(b"0123456789")
    url = "/api/v1/catalog/media/nodehistory/public-demo/render/public-demo-16x9.mp4"
    movie = await client.get(url, headers={"Range": "bytes=3-5"})
    assert movie.status_code == 206 and movie.content == b"345"
    assert movie.headers["content-range"] == "bytes 3-5/10"
    assert (await client.get(url, headers={"Range": "bytes=20-"})).status_code == 416
    assert (await client.get("/api/v1/catalog", params={"page_size": "0"})).status_code == 422


async def test_internal_detail_is_not_public_even_with_query_flag(client, monkeypatch):
    monkeypatch.setattr(settings, "nexa_internal_token", "catalog-contract-test")
    monkeypatch.setattr(settings, "app_env", "production")
    assert (await client.get("/api/v1/catalog?audience=internal")).status_code == 200
    assert (await client.get("/api/v1/catalog/internal")).status_code == 403
    assert (await client.get("/api/v1/catalog/internal/items/demo:public-demo/studio")).status_code == 403
    assert (await client.get("/api/v1/catalog/internal", headers={"X-Nexa-Internal": "catalog-contract-test"})).status_code == 200
