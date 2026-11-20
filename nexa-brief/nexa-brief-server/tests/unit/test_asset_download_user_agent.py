"""The common downloader identifies the application to media providers."""

import asyncio

import httpx
import pytest

from src.config.exceptions import AssetDownloadError
from src.core.library import asset_library


def test_download_identifies_client_and_preserves_http_errors(tmp_path, monkeypatch):
    real_client = httpx.AsyncClient
    seen = []

    def handler(request):
        seen.append(request.headers.get("user-agent"))
        status = 403 if request.url.path == "/denied" else 200
        return httpx.Response(status, content=b"media")

    def client(**kwargs):
        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(asset_library.httpx, "AsyncClient", client)
    target = tmp_path / "image.jpg"
    asyncio.run(asset_library.download_url_to("https://example.org/image", target))
    assert target.read_bytes() == b"media"
    assert seen == ["NexaBrief/1.0 (+https://nexa-brief.everdev.space)"]

    with pytest.raises(AssetDownloadError, match="HTTP 403"):
        asyncio.run(asset_library.download_url_to("https://example.org/denied", tmp_path / "denied"))
