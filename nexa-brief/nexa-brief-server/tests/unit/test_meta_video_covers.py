from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from PIL import Image, ImageDraw

from src.adapters.publishing import instagram_adapter, video_cover
from src.adapters.publishing.facebook_adapter import FacebookAdapter
from src.adapters.publishing.instagram_adapter import InstagramAdapter
from src.adapters.publishing.instagram_media_url import create_signed_media_token, resolve_signed_media_token
from src.adapters.publishing.publisher_facade import PublisherFacade
from src.config.settings import settings
from src.core.ports.publisher_port import PublishVideoResult


def cover(path: Path, portrait: bool = False) -> Path:
    image = Image.new("RGB", (720, 1280) if portrait else (1280, 720), "black")
    ImageDraw.Draw(image).rectangle((100, 100, 500, 500), fill="white")
    image.save(path, "JPEG")
    return path


@pytest.mark.parametrize("portrait", [False, True])
async def test_reuses_only_the_cover_for_the_selected_video_format(tmp_path, monkeypatch, portrait):
    video = tmp_path / "v.mp4"
    video.write_bytes(b"fixture")
    orientation = "9x16" if portrait else "16x9"
    monkeypatch.setattr(video_cover, "video_geometry", AsyncMock(return_value=(orientation, 10)))
    correct = cover(tmp_path / f"thumbnail-{orientation}.jpg", portrait)
    wrong = cover(tmp_path / "wrong.jpg", not portrait)
    generate = AsyncMock(side_effect=AssertionError("must reuse the captured intro"))
    monkeypatch.setattr(video_cover, "make_thumbnail", generate)
    assert await video_cover.ensure_video_cover(video, wrong) == correct


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg required")
@pytest.mark.parametrize("orientation,size,expected", [
    ("16x9", "320x180", (1280, 720)), ("9x16", "180x320", (720, 1280)),
])
async def test_legacy_recording_gets_a_nonblack_cover_in_its_own_format(tmp_path, orientation, size, expected):
    video = tmp_path / "v.mp4"
    subprocess.run([
        "ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"smptebars=size={size}:rate=10:duration=2",
        "-vf", "fade=t=in:st=0:d=0.6", "-pix_fmt", "yuv420p", str(video),
    ], check=True)
    path = await video_cover.ensure_video_cover(video)
    with Image.open(path) as image:
        assert image.size == expected
    assert video_cover.usable_cover(path, orientation)


async def test_does_not_publish_when_no_legible_cover_can_be_made(tmp_path, monkeypatch):
    video = tmp_path / "v.mp4"
    video.write_bytes(b"fixture")
    monkeypatch.setattr(video_cover, "video_geometry", AsyncMock(return_value=("16x9", 8)))
    monkeypatch.setattr(video_cover, "make_thumbnail", AsyncMock(return_value=None))
    with pytest.raises(video_cover.VideoCoverError, match="miniatura legible"):
        await video_cover.ensure_video_cover(video)


async def test_signed_output_jpeg_is_served_and_cannot_be_changed(api_client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "output_dir", tmp_path)
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-cover-key")
    image = cover(tmp_path / "thumbnail-16x9.jpg")
    token = create_signed_media_token(image)
    assert resolve_signed_media_token(token) == image
    response = await api_client.get(f"/api/v1/publish/instagram/media/{token}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    image.write_bytes(image.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="changed after signing"):
        resolve_signed_media_token(token)


def manager():
    return SimpleNamespace(
        get_valid_token=AsyncMock(return_value="test-page-token"),
        _storage=SimpleNamespace(get_state=lambda *_: SimpleNamespace(target_id="123")),
    )


@pytest.mark.parametrize("portrait", [False, True])
async def test_instagram_container_receives_the_signed_cover(tmp_path, monkeypatch, portrait):
    monkeypatch.setattr(settings, "output_dir", tmp_path)
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-cover-key")
    monkeypatch.setattr(settings, "public_app_url", "https://nexa.example")
    video = tmp_path / "video.mp4"
    video.write_bytes(b"\x00\x00\x00\x18ftypisomfixture")
    image = cover(tmp_path / "cover.jpg", portrait)
    adapter = InstagramAdapter(manager())
    monkeypatch.setattr(instagram_adapter, "reels_safe_video", AsyncMock(return_value=video))
    monkeypatch.setattr(instagram_adapter, "probe", AsyncMock(return_value=SimpleNamespace(duration_seconds=10)))
    create = AsyncMock(return_value="container")
    monkeypatch.setattr(adapter, "_create_container", create)
    monkeypatch.setattr(adapter, "_wait_until_ready", AsyncMock())
    monkeypatch.setattr(adapter, "_publish_container", AsyncMock(return_value="media"))
    monkeypatch.setattr(adapter, "_permalink", AsyncMock(return_value="https://instagram.com/reel/test/"))
    result = await adapter.publish(video, "title", "caption", [], "alias", thumbnail_path=image)
    params = create.await_args.args[2]
    assert "cover_url" in params and "thumb_offset" not in params
    assert resolve_signed_media_token(params["cover_url"].rsplit("/", 1)[-1]) == image
    assert result.raw_response["thumbnail"]["status"] == "set"


@pytest.mark.parametrize("reel", [False, True])
@pytest.mark.parametrize("accepted", [False, True])
async def test_facebook_attaches_preferred_thumbnail_without_reuploading_video(tmp_path, monkeypatch, reel, accepted):
    video = tmp_path / "v.mp4"
    video.write_bytes(b"fixture")
    image = cover(tmp_path / "cover.jpg", reel)
    adapter = FacebookAdapter(manager())
    start = AsyncMock(return_value=("session", 0, 0, "video"))
    monkeypatch.setattr(adapter, "_phase_start", start)
    monkeypatch.setattr(adapter, "_phase_transfer", AsyncMock())
    monkeypatch.setattr(adapter, "_phase_finish", AsyncMock(return_value="video"))
    reel_start = AsyncMock(return_value=("video", "https://upload.example"))
    monkeypatch.setattr(adapter, "_reel_phase_start", reel_start)
    monkeypatch.setattr(adapter, "_reel_phase_transfer", AsyncMock())
    monkeypatch.setattr(adapter, "_reel_phase_finish", AsyncMock(return_value="video"))
    requests = []

    def respond(request):
        requests.append(request)
        assert request.url.path.endswith("/video/thumbnails")
        body = request.content
        assert b'name="is_preferred"' in body and b"true" in body
        assert b'name="source"' in body and b"image/jpeg" in body
        return httpx.Response(200, json={"success": True}) if accepted else httpx.Response(403, json={"error": {"code": 200}})

    monkeypatch.setattr(adapter, "_make_client", lambda **_: httpx.AsyncClient(transport=httpx.MockTransport(respond)))
    result = await adapter.publish(video, "title", "caption", [], "alias", publish_as_reel=reel, thumbnail_path=image)
    assert result.raw_response["thumbnail"]["status"] == ("set" if accepted else "failed")
    assert (reel_start if reel else start).await_count == 1
    assert len(requests) == 1


@pytest.mark.parametrize("platform", ["facebook", "instagram"])
async def test_shared_facade_adds_cover_for_every_publishing_entry_point(tmp_path, monkeypatch, platform):
    video = tmp_path / "v.mp4"
    video.write_bytes(b"fixture")
    image = cover(tmp_path / "cover.jpg")
    ensure = AsyncMock(return_value=image)
    monkeypatch.setattr(video_cover, "ensure_video_cover", ensure)
    expected = PublishVideoResult(post_id="id", url="https://example.com/post", platform=platform, account_alias="alias", raw_response={})
    adapter = SimpleNamespace(publish=AsyncMock(return_value=expected))
    facade = PublisherFacade.__new__(PublisherFacade)
    monkeypatch.setattr(facade, "_resolve", lambda _: (platform, "alias", adapter))
    assert await facade.publish_video(video, "title", "caption", [], f"{platform}:alias") == expected
    assert adapter.publish.await_args.kwargs["thumbnail_path"] == image
    ensure.assert_awaited_once_with(video, None)


async def test_facebook_waits_for_processing_and_retries_only_the_cover(tmp_path, monkeypatch):
    adapter = FacebookAdapter(manager())
    image = cover(tmp_path / "cover.jpg")
    calls = []

    def respond(request):
        calls.append(request)
        if len(calls) < 3:
            return httpx.Response(400, json={"error": {"code": 100, "is_transient": True}})
        return httpx.Response(200, json={"success": True})

    monkeypatch.setattr(adapter, "_make_client", lambda **_: httpx.AsyncClient(transport=httpx.MockTransport(respond)))
    monkeypatch.setattr("src.adapters.publishing.facebook_adapter.asyncio.sleep", AsyncMock())
    result = await adapter._upload_thumbnail("test-token", "video", image)
    assert result["status"] == "set" and len(calls) == 3


async def test_explainer_captures_have_distinct_files_and_orientation(tmp_path, monkeypatch):
    from src.core.explainer import thumbnails

    video = SimpleNamespace(path=tmp_path, design="binary")
    monkeypatch.setattr(thumbnails, "intro_specs", lambda _: {"A": {"component": "binary.introv1", "params": {}}})
    calls = []

    async def subprocess_capture(*args, **kwargs):
        calls.append(args)
        path = Path(args[2])
        path.parent.mkdir(exist_ok=True)
        cover(path, "9x16" == args[args.index("--orientation") + 1])
        return SimpleNamespace(returncode=0, communicate=AsyncMock(return_value=(b"", None)))

    monkeypatch.setattr(thumbnails.asyncio, "create_subprocess_exec", subprocess_capture)
    horizontal = await thumbnails.render(video, ("A",))
    vertical = await thumbnails.render(video, ("A",), orientation="9x16")
    assert horizontal["A"] != vertical["A"]
    assert video_cover.usable_cover(horizontal["A"], "16x9")
    assert video_cover.usable_cover(vertical["A"], "9x16")
