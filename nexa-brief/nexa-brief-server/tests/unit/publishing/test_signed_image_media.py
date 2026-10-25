from __future__ import annotations

import hashlib
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from src.adapters.publishing.instagram_media_url import (
    create_signed_media_token,
    resolve_signed_media_token,
)
from src.adapters.data.local_publication_media import LocalPublicationMedia
from src.config.settings import settings


def _write_jpeg(path: Path) -> bytes:
    image_data = BytesIO()
    Image.new("RGB", (1080, 1350), color=(240, 240, 240)).save(image_data, format="JPEG")
    content = image_data.getvalue()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return content


def _write_mp4(path: Path) -> bytes:
    content = b"\x00\x00\x00\x18ftypisomsynthetic-mp4"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return content


def test_signs_final_jpeg_with_storage_key_and_keeps_video_pipeline_mp4(tmp_path, monkeypatch) -> None:
    data_dir = tmp_path / "data"
    output_dir = tmp_path / "output"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "output_dir", output_dir)
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-signing-key")

    jpeg = _write_jpeg(data_dir / "publicaciones/node_tech/2026/10/post/slides/01.jpg")
    mp4 = _write_mp4(output_dir / "job/reel.mp4")
    jpeg_hash = hashlib.sha256(jpeg).hexdigest()

    jpeg_token = create_signed_media_token(
        "node_tech/2026/10/post/slides/01.jpg",
        expected_sha256=jpeg_hash,
    )
    mp4_token = create_signed_media_token(output_dir / "job/reel.mp4")

    assert resolve_signed_media_token(jpeg_token).read_bytes() == jpeg
    assert resolve_signed_media_token(mp4_token).read_bytes() == mp4


def test_rejects_traversal_symlink_bad_mime_and_wrong_hash(tmp_path, monkeypatch) -> None:
    data_dir = tmp_path / "data"
    output_dir = tmp_path / "output"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "output_dir", output_dir)
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-signing-key")
    valid_path = data_dir / "publicaciones/node_tech/post/slides/01.jpg"
    content = _write_jpeg(valid_path)

    with pytest.raises(ValueError, match="Invalid media key"):
        create_signed_media_token("../../outside.jpg")
    with pytest.raises(ValueError, match="hash"):
        create_signed_media_token(
            "node_tech/post/slides/01.jpg",
            expected_sha256="0" * 64,
        )

    bad_path = data_dir / "publicaciones/node_tech/post/slides/not-jpeg.jpg"
    bad_path.parent.mkdir(parents=True, exist_ok=True)
    bad_path.write_bytes(b"not a jpeg")
    with pytest.raises(ValueError, match="not a JPEG"):
        create_signed_media_token("node_tech/post/slides/not-jpeg.jpg")

    external = tmp_path / "outside.jpg"
    _write_jpeg(external)
    link = data_dir / "publicaciones/node_tech/post/slides/link.jpg"
    try:
        link.symlink_to(external)
    except OSError:
        pytest.skip("Symlinks are unavailable in this test environment")
    with pytest.raises(ValueError, match="Symlinks"):
        create_signed_media_token("node_tech/post/slides/link.jpg")

    token = create_signed_media_token("node_tech/post/slides/01.jpg")
    valid_path.write_bytes(content + b"changed")
    with pytest.raises(ValueError, match="changed after signing"):
        resolve_signed_media_token(token)


def test_rejects_expired_and_tampered_signatures(tmp_path, monkeypatch) -> None:
    data_dir = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "output_dir", tmp_path / "output")
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-signing-key")
    _write_jpeg(data_dir / "publicaciones/node_tech/post/slides/01.jpg")
    token = create_signed_media_token("node_tech/post/slides/01.jpg", ttl_seconds=10)

    with pytest.raises(ValueError, match="signature"):
        resolve_signed_media_token(f"{token[:-1]}x")

    monkeypatch.setattr("src.adapters.publishing.instagram_media_url.time.time", lambda: 9999999999)
    with pytest.raises(ValueError, match="Expired"):
        resolve_signed_media_token(token)


@pytest.mark.asyncio
async def test_public_route_streams_signed_jpeg_with_range(api_client, tmp_path, monkeypatch) -> None:
    data_dir = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-signing-key")
    monkeypatch.setattr(settings, "public_base_url", "https://nexa.example")
    key = "node_history/2026/10/post/slides/01.jpg"
    content = _write_jpeg(data_dir / "publicaciones" / key)
    url = LocalPublicationMedia().signed_url(key, audience="meta", ttl=900)
    token = url.rsplit("/", 1)[-1]

    response = await api_client.get(
        f"/api/v1/publish/instagram/media/{token}",
        headers={"Range": "bytes=0-2"},
    )

    assert response.status_code == 206
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content == content[:3]


def test_resolves_signed_token_created_by_publication_media_port(tmp_path, monkeypatch) -> None:
    data_dir = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-signing-key")
    monkeypatch.setattr(settings, "public_base_url", "https://nexa.example")
    image_data = BytesIO()
    Image.new("RGB", (1080, 1350), color=(240, 240, 240)).save(image_data, format="JPEG")
    content = image_data.getvalue()
    digest = hashlib.sha256(content).hexdigest()
    storage = LocalPublicationMedia()
    key = "node_tech/2026/10/post/slides/01.jpg"
    storage.put(key, content, "image/jpeg", digest)
    url = storage.signed_url(key, audience="meta", ttl=900)
    token = url.rsplit("/", 1)[-1]

    assert resolve_signed_media_token(token).read_bytes() == content
