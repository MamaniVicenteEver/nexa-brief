"""Miniatura propia en YouTube (thumbnails.set): nunca hace fallar la publicación."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.adapters.publishing.token_manager import TokenManager
from src.adapters.publishing.youtube_adapter import YouTubeAdapter


@pytest.fixture
def adapter() -> YouTubeAdapter:
    manager = MagicMock(spec=TokenManager)
    manager.get_valid_token = AsyncMock(return_value="token")
    return YouTubeAdapter(manager)


def _client(response=None, error: Exception | None = None):
    client = MagicMock()
    client.__aenter__.return_value = client
    client.post = AsyncMock(side_effect=error) if error else AsyncMock(return_value=response)
    return client


@pytest.mark.asyncio
async def test_thumbnail_is_uploaded_as_jpeg(adapter: YouTubeAdapter, tmp_path: Path):
    image = tmp_path / "thumbnail.jpg"
    image.write_bytes(b"jpg")
    client = _client(httpx.Response(200, json={"items": []}))
    with patch.object(adapter, "_make_client", return_value=client):
        assert await adapter._set_thumbnail("token", "vid123", image) is True
    url = client.post.call_args.args[0]
    assert url.endswith("/thumbnails/set?videoId=vid123")
    assert client.post.call_args.kwargs["headers"]["Content-Type"] == "image/jpeg"
    assert client.post.call_args.kwargs["content"] == b"jpg"


@pytest.mark.asyncio
@pytest.mark.parametrize("response, error", [
    (httpx.Response(403, json={"error": {"message": "channel not verified"}}), None),
    (None, httpx.ConnectError("sin red")),
])
async def test_thumbnail_failure_never_raises(adapter: YouTubeAdapter, tmp_path: Path, response, error):
    # publish() reintenta ante errores: una miniatura rechazada no puede volver a subir el video
    image = tmp_path / "thumbnail.jpg"
    image.write_bytes(b"jpg")
    with patch.object(adapter, "_make_client", return_value=_client(response, error)):
        assert await adapter._set_thumbnail("token", "vid123", image) is False
