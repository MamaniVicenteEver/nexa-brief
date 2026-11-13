from __future__ import annotations

import hashlib
import io
from pathlib import Path

import httpx
import pytest
from PIL import Image

from src.adapters.stock.wikimedia_adapter import WikimediaCommonsAdapter
from src.adapters.data.local_image_media_cache import LocalImageMediaCache
from src.core.image_posts import media_sources
from src.core.image_posts.image_licensing import accepted_license
from src.core.ports.stock_media_port import StockItem


def _ext(value: str) -> dict[str, str]:
    return {"value": value}


def _file_page(
    *,
    pageid: int = 42,
    title: str = "File:Test photo.jpg",
    license_name: str = "CC BY-SA 4.0",
    author: str = "<a href=\"https://example.org/artist\">Ada Example</a>",
) -> dict:
    return {
        "pageid": pageid,
        "title": title,
        "imageinfo": [{
            "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Test_photo.jpg",
            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Test_photo.jpg/2160px-Test_photo.jpg",
            "width": 4000,
            "height": 3000,
            "thumbwidth": 2160,
            "thumbheight": 1620,
            "extmetadata": {
                "LicenseShortName": _ext(license_name),
                "LicenseUrl": _ext("https://creativecommons.org/licenses/by-sa/4.0/"),
                "Artist": _ext(author),
                "Credit": _ext("Archivo &amp; colección"),
                "ImageDescription": _ext("<span>Una foto de prueba</span>"),
            },
        }],
    }


def _api_response(pages: list[dict]) -> dict:
    return {"query": {"pages": pages}}


def _png_bytes(width: int = 1200, height: int = 900) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (width, height), (25, 80, 140)).save(output, format="PNG")
    return output.getvalue()


def test_license_whitelist_and_plain_publishable_attribution():
    assert accepted_license("Public domain")
    assert accepted_license("PD-old-70")
    assert accepted_license("CC0 1.0")
    assert accepted_license("CC BY 4.0")
    assert accepted_license("Creative Commons Attribution-Share Alike 4.0 International")
    for denied in (
        "CC BY-NC 4.0",
        "CC BY-ND 4.0",
        "CC BY-NC-SA 4.0",
        "Fair use",
        "CC BY",
        "",
    ):
        assert not accepted_license(denied)

    adapter = WikimediaCommonsAdapter(min_request_interval=0)
    item = adapter._item_from_page(_file_page())
    assert item is not None
    assert item.author == "Ada Example"
    assert item.description == "Una foto de prueba"
    assert item.credit == "Archivo & colección"
    assert "<" not in item.attribution and ">" not in item.attribution
    assert item.attribution == "Foto: Ada Example · CC BY-SA 4.0 · Wikimedia Commons"
    assert (item.width, item.height) == (2160, 1620)
    assert (item.original_width, item.original_height) == (4000, 3000)
    unknown_author = adapter._item_from_page(_file_page(author="Unknown author Unknown author"))
    assert unknown_author is not None
    assert unknown_author.attribution == "Foto: Unknown author · CC BY-SA 4.0 · Wikimedia Commons"


@pytest.mark.asyncio
async def test_search_uses_wikimedia_api_and_filters_rejected_licenses():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=_api_response([
            _file_page(),
            _file_page(pageid=43, title="File:NC.jpg", license_name="CC BY-NC 4.0"),
            _file_page(pageid=44, title="File:Fair use.jpg", license_name="Fair use"),
        ]))

    adapter = WikimediaCommonsAdapter(transport=httpx.MockTransport(handler), min_request_interval=0)
    [item] = await adapter.search("RMS Titanic", "image", per_page=10)
    assert item.provider == "wikimedia"
    assert item.license_url.endswith("by-sa/4.0/")
    assert item.original_url.endswith("Test_photo.jpg")
    assert item.thumb_url.endswith("2160px-Test_photo.jpg")
    assert seen[0].headers["user-agent"].startswith("NexaBriefWikimediaBot/")
    assert seen[0].url.params["generator"] == "search"
    assert seen[0].url.params["gsrnamespace"] == "6"
    assert "extmetadata" in seen[0].url.params["iiprop"]


@pytest.mark.asyncio
async def test_article_lead_image_resolves_pageprops_file_in_commons():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.host == "es.wikipedia.org":
            return httpx.Response(200, json={"query": {"pages": [{
                "pageid": 987,
                "title": "Muro de Berlín",
                "pageprops": {"page_image_free": "Berlin Wall 1989.jpg"},
                "thumbnail": {"source": "https://upload.wikimedia.org/thumb.jpg"},
            }]}})
        return httpx.Response(200, json=_api_response([
            _file_page(title="File:Berlin Wall 1989.jpg"),
        ]))

    adapter = WikimediaCommonsAdapter(transport=httpx.MockTransport(handler), min_request_interval=0)
    item = await adapter.article_image("Muro de Berlín", lang="es")
    assert item is not None
    assert item.source_url.endswith("File:Berlin_Wall_1989.jpg")
    assert item.article_url == "https://es.wikipedia.org/wiki/Muro_de_Berl%C3%ADn"
    assert seen[0].url.params["prop"] == "pageimages|pageprops"
    assert seen[1].url.params["titles"] == "File:Berlin Wall 1989.jpg"


def _stock_item(
    provider_id: str,
    width: int,
    height: int,
    license_name: str = "CC BY 4.0",
) -> StockItem:
    return StockItem(
        provider="wikimedia",
        provider_id=provider_id,
        kind="image",
        title=provider_id,
        preview_url="https://upload.wikimedia.org/preview.jpg",
        download_url="https://upload.wikimedia.org/image.png",
        width=width,
        height=height,
        license=license_name,
        attribution=f"Foto: {provider_id} · {license_name} · Wikimedia Commons",
        original_url="https://upload.wikimedia.org/original.jpg",
        thumb_url="https://upload.wikimedia.org/image.png",
    )


def test_pick_best_scores_resolution_aspect_and_license_simplicity():
    portrait = _stock_item("portrait", 1080, 1350, "CC BY-SA 4.0")
    low_pd = _stock_item("low-pd", 700, 875, "Public domain")
    landscape = _stock_item("landscape", 1920, 1080, "CC BY 4.0")

    chosen, why = media_sources.pick_best([low_pd, portrait], aspect="4:5", min_side=1080)
    assert chosen is portrait
    assert "resolución" in why and "licencia" in why
    chosen, why = media_sources.pick_best([portrait, landscape], aspect="16:9", min_side=1080)
    assert chosen is landscape
    assert "aspecto 1.00" in why


@pytest.mark.asyncio
async def test_find_images_downloads_hashes_and_reuses_ported_cache(monkeypatch, tmp_path: Path):
    api_calls = 0
    download_calls = 0
    image_bytes = _png_bytes()

    def api_handler(request: httpx.Request) -> httpx.Response:
        nonlocal api_calls
        api_calls += 1
        return httpx.Response(200, json=_api_response([_file_page()]))

    def download_handler(request: httpx.Request) -> httpx.Response:
        nonlocal download_calls
        download_calls += 1
        assert request.headers["user-agent"].startswith("NexaBriefWikimediaBot/")
        return httpx.Response(200, content=image_bytes, headers={"Content-Type": "image/png"})

    provider = WikimediaCommonsAdapter(transport=httpx.MockTransport(api_handler), min_request_interval=0)
    monkeypatch.setattr(media_sources, "get_stock_providers", lambda: {"wikimedia": provider})
    monkeypatch.setattr(media_sources, "_download_transport", httpx.MockTransport(download_handler))
    cache = LocalImageMediaCache(tmp_path)

    [first] = await media_sources.find_images("RMS Titanic", cache, n=1)
    [second] = await media_sources.find_images("RMS Titanic", cache, n=1)
    digest = hashlib.sha256(image_bytes).hexdigest()
    assert first.sha256 == digest and second.sha256 == digest
    assert first.content == first.bytes == image_bytes
    assert not hasattr(first, "path")
    cached = cache.get_by_url(first.thumburl)
    assert cached is not None and cached.content == image_bytes
    assert download_calls == 1
    assert api_calls == 2  # búsquedas nuevas; el archivo reutiliza su caché local
    assert cached.metadata["sha256"] == digest
    assert cached.metadata["attribution"].startswith("Foto: Ada Example")
    assert cached.metadata["extension"] == ".png"
