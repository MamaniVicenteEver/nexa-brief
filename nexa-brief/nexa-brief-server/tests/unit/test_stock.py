"""F3 — búsqueda en stock e importación a la librería.

Todo con httpx.MockTransport / proveedores falsos: ningún test llama a las APIs
reales ni descarga archivos. Las respuestas imitan el formato real de cada API
(recortado de una búsqueda real "ocean" de 2026-10).
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from src.adapters.stock.pexels import PexelsStockAdapter, pick_video_file
from src.adapters.stock.pixabay import PixabayStockAdapter
from src.adapters.stock.unsplash import UnsplashStockAdapter
from src.config.exceptions import AssetDownloadError
from src.core.data import collection
from src.core.library import asset_library
from src.core.ports.stock_media_port import StockItem, StockMediaPort, StockProviderError
from src.core.stock import import_stock_item, search_stock, set_stock_providers
from src.presentation.main import app

# ── Respuestas reales recortadas ─────────────────────────────────────────────

PEXELS_PHOTOS = {"photos": [{
    "id": 6775303, "width": 3000, "height": 2001,
    "url": "https://www.pexels.com/photo/large-waves-in-a-sea-6775303/",
    "photographer": "Ben Mack", "photographer_url": "https://www.pexels.com/@ben-mack",
    "alt": "Large waves in a sea",
    "src": {
        "original": "https://images.pexels.com/photos/6775303/pexels-photo-6775303.jpeg",
        "medium": "https://images.pexels.com/photos/6775303/pexels-photo-6775303.jpeg?auto=compress&cs=tinysrgb&h=350",
    },
}]}

PEXELS_VIDEOS = {"videos": [{
    "id": 25961000, "width": 2160, "height": 3840, "duration": 12,
    "url": "https://www.pexels.com/video/a-boat-is-in-the-water-25961000/",
    "image": "https://images.pexels.com/videos/25961000/offshore.jpeg",
    "user": {"name": "Nisasu", "url": "https://www.pexels.com/@nisasu"},
    "video_files": [
        {"file_type": "video/mp4", "width": 720, "height": 1280, "size": 6_000_000,
         "link": "https://videos.pexels.com/video-files/25961000/720_1280.mp4"},
        {"file_type": "video/mp4", "width": 1080, "height": 1920, "size": 11_000_000,
         "link": "https://videos.pexels.com/video-files/25961000/1080_1920.mp4"},
        {"file_type": "video/mp4", "width": 2160, "height": 3840, "size": 26_000_000,
         "link": "https://videos.pexels.com/video-files/25961000/2160_3840.mp4"},
    ],
}, {
    # Solo 4K: no se ofrece (no hay variante HD).
    "id": 1, "duration": 5, "url": "https://www.pexels.com/video/x-1/", "image": "", "user": {},
    "video_files": [{"file_type": "video/mp4", "width": 3840, "height": 2160, "size": 1,
                     "link": "https://videos.pexels.com/video-files/1/4k.mp4"}],
}]}

PIXABAY_PHOTOS = {"hits": [{
    "id": 5499649, "pageURL": "https://pixabay.com/photos/sea-wave-5499649/",
    "tags": "sea, wave, nature", "webformatURL": "https://pixabay.com/get/abc_640.jpg",
    "largeImageURL": "https://pixabay.com/get/abc_1280.jpg",
    "imageWidth": 3750, "imageHeight": 2500, "user": "Kanenori", "user_id": 4749850,
    "userURL": "https://pixabay.com/users/4749850/",
}]}

PIXABAY_VIDEOS = {"hits": [{
    "id": 283533, "pageURL": "https://pixabay.com/videos/id-283533/", "tags": "wave, sea",
    "duration": 40, "user": "BlenderTimer", "user_id": 9538909,
    "videos": {
        "large": {"url": "https://cdn.pixabay.com/video/283533_large.mp4", "width": 3840, "height": 2160,
                  "thumbnail": "https://cdn.pixabay.com/video/283533_large.jpg"},
        "medium": {"url": "https://cdn.pixabay.com/video/283533_medium.mp4", "width": 1920, "height": 1080,
                   "thumbnail": "https://cdn.pixabay.com/video/283533_medium.jpg"},
        "small": {"url": "https://cdn.pixabay.com/video/283533_small.mp4", "width": 1280, "height": 720,
                  "thumbnail": ""},
    },
}]}

UNSPLASH_PHOTOS = {"results": [{
    "id": "p-dZaBjPQiw", "width": 10000, "height": 6667,
    "alt_description": "Two people kayaking",
    "urls": {"raw": "https://images.unsplash.com/photo-1789?ixid=abc&ixlib=rb-4.1.0",
             "small": "https://images.unsplash.com/photo-1789?w=400"},
    "links": {"html": "https://unsplash.com/photos/p-dZaBjPQiw"},
    "user": {"name": "Queensland, Australia", "links": {"html": "https://unsplash.com/@queensland"}},
}]}


def _transport(routes: dict[str, object], calls: list[httpx.Request] | None = None) -> httpx.MockTransport:
    """MockTransport que responde por path; status int = respuesta de error."""
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request)
        body = routes.get(request.url.path)
        if body is None:
            return httpx.Response(404)
        if isinstance(body, int):
            return httpx.Response(body)
        return httpx.Response(200, json=body)
    return httpx.MockTransport(handler)


@pytest.fixture(autouse=True)
def _reset_providers():
    yield
    set_stock_providers(None)


# ── Adapters: parseo ─────────────────────────────────────────────────────────

async def test_pexels_photo_parsing_caps_size_and_keeps_credit():
    calls: list[httpx.Request] = []
    adapter = PexelsStockAdapter(api_key="k", transport=_transport({"/v1/search": PEXELS_PHOTOS}, calls))
    [item] = await adapter.search("ocean", "image", orientation="portrait", per_page=5)
    assert item.provider == "pexels" and item.provider_id == "6775303"
    assert item.download_url.endswith("?fit=max&w=2560&h=2560")
    assert (item.width, item.height) == (2560, 1708)       # tamaño real de lo que se baja
    assert item.author == "Ben Mack" and item.license == "Pexels License"
    assert calls[0].headers["Authorization"] == "k"
    assert calls[0].url.params["orientation"] == "portrait"


async def test_pexels_video_picks_hd_never_4k():
    adapter = PexelsStockAdapter(api_key="k", transport=_transport({"/videos/search": PEXELS_VIDEOS}))
    items = await adapter.search("ocean", "video")
    assert len(items) == 1                                   # el que solo tenía 4K queda afuera
    video = items[0]
    assert video.download_url.endswith("1080_1920.mp4")
    assert (video.width, video.height, video.duration_seconds) == (1080, 1920, 12.0)
    assert video.title == "a boat is in the water"


def test_pick_video_file_prefers_lighter_at_same_resolution():
    files = [
        {"file_type": "video/mp4", "width": 1920, "height": 1080, "size": 9, "link": "a"},
        {"file_type": "video/mp4", "width": 1920, "height": 1080, "size": 5, "link": "b"},
        {"file_type": "video/webm", "width": 1920, "height": 1080, "size": 1, "link": "c"},
    ]
    assert pick_video_file(files)["link"] == "b"


async def test_pixabay_parsing_images_and_videos():
    adapter = PixabayStockAdapter(api_key="k", transport=_transport(
        {"/api/": PIXABAY_PHOTOS, "/api/videos/": PIXABAY_VIDEOS}))
    [image] = await adapter.search("ocean", "image")
    assert image.download_url == "https://pixabay.com/get/abc_1280.jpg"
    assert (image.width, image.height) == (1280, 853)
    [video] = await adapter.search("ocean", "video")
    assert video.download_url.endswith("_medium.mp4")       # large era 4K
    assert video.preview_url.endswith("_medium.jpg")
    assert (video.width, video.height, video.duration_seconds) == (1920, 1080, 40.0)


async def test_pixabay_filters_video_orientation_locally():
    calls: list[httpx.Request] = []
    adapter = PixabayStockAdapter(api_key="k", transport=_transport({"/api/videos/": PIXABAY_VIDEOS}, calls))
    assert await adapter.search("ocean", "video", orientation="portrait", per_page=4) == []
    # Filtra acá, así que pide una ventana más grande para no volver vacío.
    assert calls[0].url.params["per_page"] == "20"
    assert calls[0].url.params["q"] == "ocean vertical"      # el video vertical viene etiquetado así
    await adapter.search("ocean", "video", per_page=4)
    assert calls[1].url.params["per_page"] == "4"


async def test_unsplash_images_only_with_utm_credit():
    adapter = UnsplashStockAdapter(api_key="k", transport=_transport({"/search/photos": UNSPLASH_PHOTOS}))
    assert await adapter.search("ocean", "video") == []
    [item] = await adapter.search("ocean", "image", orientation="square")
    assert "fit=max&w=2560&h=2560" in item.download_url and "fm=jpg" in item.download_url
    assert (item.width, item.height) == (2560, 1707)
    assert "utm_source=nexa_brief" in item.author_url and "utm_source=nexa_brief" in item.source_url


async def test_adapter_errors_have_stable_codes():
    with pytest.raises(StockProviderError) as missing:
        await PexelsStockAdapter(api_key="").search("x", "image")
    assert missing.value.code == "missing_key"
    with pytest.raises(StockProviderError) as limited:
        await PexelsStockAdapter(api_key="k", transport=_transport({"/v1/search": 429})).search("x", "image")
    assert limited.value.code == "rate_limited"
    with pytest.raises(StockProviderError) as bad_key:
        await UnsplashStockAdapter(api_key="k", transport=_transport({"/search/photos": 401})).search("x", "image")
    assert bad_key.value.code == "invalid_key"


def test_download_host_allowlist():
    pexels = PexelsStockAdapter(api_key="k")
    assert pexels.accepts_download_url("https://videos.pexels.com/video-files/1/a.mp4")
    assert not pexels.accepts_download_url("http://videos.pexels.com/a.mp4")          # sin https
    assert not pexels.accepts_download_url("https://evil.com/videos.pexels.com/a.mp4")
    assert not pexels.accepts_download_url("https://pexels.com.evil.com/a.mp4")
    assert PixabayStockAdapter(api_key="k").accepts_download_url("https://cdn.pixabay.com/video/a.mp4")


# ── Servicio agregador ───────────────────────────────────────────────────────

class FakeProvider(StockMediaPort):
    download_hosts = ("example.com",)

    def __init__(self, name: str, items: list[StockItem] | None = None, *,
                 error: Exception | None = None, kinds=("image", "video")) -> None:
        self.name = name
        self.kinds = frozenset(kinds)
        self._items = items or []
        self._error = error
        self.calls = 0
        self.notified: list[str] = []

    @property
    def configured(self) -> bool:
        return True

    async def search(self, query, kind, *, orientation=None, page=1, per_page=15):
        self.calls += 1
        if self._error:
            raise self._error
        return [i for i in self._items if i.kind == kind]

    async def notify_download(self, provider_id: str) -> None:
        self.notified.append(provider_id)


def _item(provider: str, pid: str, kind: str = "image") -> StockItem:
    ext = "mp4" if kind == "video" else "jpg"
    return StockItem(provider=provider, provider_id=pid, kind=kind,
                     preview_url=f"https://example.com/{pid}_thumb.jpg",
                     download_url=f"https://example.com/files/{provider}-{pid}.{ext}",
                     width=1920, height=1080, author="Ana", license="Test License")


async def test_search_interleaves_and_reports_failures():
    a = FakeProvider("a", [_item("a", "1"), _item("a", "2"), _item("a", "3")])
    b = FakeProvider("b", [_item("b", "1")])
    down = FakeProvider("down", error=StockProviderError("down", "rate_limited", "limite"))
    crash = FakeProvider("crash", error=KeyError("src"))
    set_stock_providers([a, b, down, crash])

    result = await search_stock("ocean", "image", providers=["a", "b", "down", "crash", "nope"])
    assert [(r.provider, r.provider_id) for r in result.results] == [("a", "1"), ("b", "1"), ("a", "2"), ("a", "3")]
    codes = {e.provider: e.code for e in result.provider_errors}
    assert codes == {"down": "rate_limited", "crash": "bad_response", "nope": "unknown_provider"}


async def test_search_skips_providers_without_kind():
    images_only = FakeProvider("img", [_item("img", "1")], kinds=("image",))
    set_stock_providers([images_only])
    result = await search_stock("ocean", "video")
    assert result.results == [] and result.provider_errors == []
    assert images_only.calls == 0


async def test_search_cache_avoids_repeat_calls_but_not_errors():
    ok = FakeProvider("ok", [_item("ok", "1")])
    down = FakeProvider("down", error=StockProviderError("down", "network", "caído"))
    set_stock_providers([ok, down])

    await search_stock("Ocean  Waves", "image")
    second = await search_stock("ocean waves", "image")       # misma búsqueda normalizada
    assert ok.calls == 1 and down.calls == 2                  # los errores no se cachean
    assert [r.provider_id for r in second.results] == ["1"]
    await search_stock("ocean waves", "image", page=2)
    assert ok.calls == 2                                      # otra página = otra clave


async def test_expired_cache_is_refreshed(monkeypatch):
    ok = FakeProvider("ok", [_item("ok", "1")])
    ok.cache_ttl_seconds = 10
    set_stock_providers([ok])
    await search_stock("ocean", "image")
    import src.core.stock.service as service
    real_time = service.time.time
    monkeypatch.setattr(service.time, "time", lambda: real_time() + 60)
    await search_stock("ocean", "image")
    assert ok.calls == 2


# ── Importación ──────────────────────────────────────────────────────────────

@pytest.fixture
def fake_download(monkeypatch):
    """Simula la descarga (y ffprobe) sin red; registra qué URLs se bajaron."""
    downloads: list[str] = []

    async def download(url: str, dest: Path) -> None:
        downloads.append(url)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"fake-media")

    async def probe(path: Path) -> dict:
        if path.suffix == ".mp4":
            return {"width": 1080, "height": 1920, "duration_seconds": 12.5}
        return {"width": 2560, "height": 1708}

    monkeypatch.setattr(asset_library, "download_url_to", download)
    monkeypatch.setattr(asset_library, "probe_media", probe)
    return downloads


async def test_import_video_registers_with_credit_and_dedups(fake_download):
    provider = FakeProvider("fake")
    set_stock_providers([provider])
    kwargs = dict(provider="fake", provider_id="99", kind="video",
                  download_url="https://example.com/files/ola-99.mp4", title="Olas al atardecer",
                  author="Ana", author_url="https://example.com/@ana",
                  source_url="https://example.com/video/99", license="Test License")

    first = await import_stock_item(**kwargs)
    assert first.already_imported is False
    entry = first.entry
    assert entry.source == "stock" and entry.provider == "fake" and entry.category == "stock"
    assert entry.original_filename == "ola-99.mp4"
    assert (entry.width, entry.height, entry.duration_seconds) == (1080, 1920, 12.5)
    assert entry.license_note == "Test License · por Ana · https://example.com/video/99"
    assert asset_library.resolve_video_path(entry.asset_id).read_bytes() == b"fake-media"
    raw = collection("video_assets").get(entry.asset_id)
    assert raw["stock_ref"] == "fake:video:99" and raw["stock_author_url"] == "https://example.com/@ana"
    assert provider.notified == ["99"]

    second = await import_stock_item(**kwargs)
    assert second.already_imported is True and second.entry.asset_id == entry.asset_id
    assert len(fake_download) == 1                            # no se volvió a bajar
    assert len(asset_library.list_videos()) == 1

    # La búsqueda marca lo que ya está en la librería.
    provider._items = [_item("fake", "99", "video"), _item("fake", "100", "video")]
    result = await search_stock("olas", "video")
    assert {r.provider_id: r.library_asset_id for r in result.results} == {"99": entry.asset_id, "100": None}


async def test_import_image_without_extension_in_url(fake_download):
    set_stock_providers([FakeProvider("fake")])
    result = await import_stock_item(provider="fake", provider_id="abc", kind="image",
                                     download_url="https://example.com/photo-abc?fm=jpg",
                                     author="Luz", category="fondos")
    entry = result.entry
    assert entry.original_filename == "fake-abc.jpg"
    assert entry.photographer == "Luz" and entry.orientation == "landscape"
    assert entry.category == "fondos"


async def test_import_rejects_foreign_url_and_unknown_provider(fake_download):
    from src.core.stock import StockImportError

    set_stock_providers([FakeProvider("fake", kinds=("image",))])
    with pytest.raises(StockImportError):
        await import_stock_item(provider="fake", provider_id="1", kind="image",
                                download_url="https://attacker.test/x.jpg")
    with pytest.raises(StockImportError):
        await import_stock_item(provider="fake", provider_id="1", kind="video",
                                download_url="https://example.com/x.mp4")
    with pytest.raises(StockImportError):
        await import_stock_item(provider="otro", provider_id="1", kind="image",
                                download_url="https://example.com/x.jpg")
    assert fake_download == []


# ── Router ───────────────────────────────────────────────────────────────────

client = TestClient(app)


def test_router_search_and_import(fake_download):
    set_stock_providers([
        FakeProvider("fake", [_item("fake", "1", "video")]),
        FakeProvider("broken", error=StockProviderError("broken", "missing_key", "sin key")),
    ])
    r = client.get("/api/v1/stock/search", params={"q": "ocean", "kind": "video", "per_page": 5})
    assert r.status_code == 200
    body = r.json()
    assert [i["provider_id"] for i in body["results"]] == ["1"]
    assert body["provider_errors"] == [{"provider": "broken", "code": "missing_key", "message": "sin key"}]

    item = body["results"][0]
    payload = {k: item[k] for k in ("provider", "provider_id", "kind", "download_url", "author", "license")}
    r = client.post("/api/v1/stock/import", json=payload)
    assert r.status_code == 200
    imported = r.json()
    assert imported["already_imported"] is False and imported["kind"] == "video"
    assert imported["file_url"] == f"/api/v1/library/videos/{imported['asset_id']}/file"
    assert client.get(imported["file_url"]).status_code == 200

    again = client.post("/api/v1/stock/import", json=payload).json()
    assert again["already_imported"] is True and again["asset_id"] == imported["asset_id"]


def test_router_validation_and_download_errors(monkeypatch):
    set_stock_providers([FakeProvider("fake")])
    assert client.get("/api/v1/stock/search", params={"q": "x", "kind": "audio"}).status_code == 422
    assert client.get("/api/v1/stock/search", params={"q": "  "}).status_code == 422
    bad = {"provider": "fake", "provider_id": "1", "kind": "image", "download_url": "https://evil.test/a.jpg"}
    assert client.post("/api/v1/stock/import", json=bad).status_code == 400

    async def failing(url: str, dest: Path) -> None:
        raise AssetDownloadError("HTTP 403")

    monkeypatch.setattr(asset_library, "download_url_to", failing)
    ok = {**bad, "download_url": "https://example.com/a.jpg"}
    assert client.post("/api/v1/stock/import", json=ok).status_code == 502
    assert asset_library.list_images() == []


def test_router_lists_providers():
    set_stock_providers([FakeProvider("fake", kinds=("image",))])
    assert client.get("/api/v1/stock/providers").json() == [
        {"name": "fake", "configured": True, "kinds": ["image"]}
    ]


async def test_import_uses_readable_name_for_hashed_urls(fake_download):
    set_stock_providers([FakeProvider("fake")])
    result = await import_stock_item(provider="fake", provider_id="7866362", kind="image",
                                     download_url=f"https://example.com/get/g{'c0' * 60}_1280.jpg")
    assert result.entry.original_filename == "fake-7866362.jpg"
