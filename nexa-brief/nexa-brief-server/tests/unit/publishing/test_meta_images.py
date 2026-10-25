from __future__ import annotations

import hashlib
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, parse_qsl, urlparse

import httpx
import pytest

from src.adapters.publishing.facebook_image_adapter import FacebookImageAdapter
from src.adapters.publishing.image_reel_adapter import ImageReelAdapter
from src.adapters.publishing.image_publisher import ImagePublisher, MetaGraphError, graph_json
from src.adapters.publishing.image_publisher import delivery_assets
from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter
from src.config.settings import settings
from src.core.image_posts.models import DeliverySpec
from src.presentation.api.routers.publisher import facebook_oauth_start, instagram_oauth_start


class FakeTokens:
    async def get_valid_token(self, platform: str, alias: str) -> str:
        return f"token:{platform}:{alias}"

    def target_id(self, platform: str, alias: str) -> str:
        return {"facebook": "page-1", "instagram": "ig-1"}[platform]


class FakeMediaStorage:
    def __init__(self, objects: dict[str, bytes] | None = None) -> None:
        self.objects = objects or {}

    def get(self, key: str) -> bytes:
        return self.objects[key]

    def signed_url(self, key: str, *, audience: str, ttl: int) -> str:
        assert audience == "meta"
        assert ttl <= 900
        return f"https://media.example/{key}?expires={ttl}"


def _jpeg() -> bytes:
    return b"\xff\xd8\xff" + b"synthetic-jpeg"


def _asset(index: int, *, platform: str = "instagram") -> dict[str, str]:
    return {
        "storage_key": f"slide-{index}.jpg",
        "mime": "image/jpeg",
        "sha256": hashlib.sha256(_jpeg()).hexdigest(),
        f"alt_text_{'ig' if platform == 'instagram' else 'fb'}": f"Lámina {index}",
    }


@pytest.mark.asyncio
async def test_archived_jpeg_hash_is_checked_before_meta_upload_or_signing() -> None:
    expected = hashlib.sha256(b"approved JPEG").hexdigest()
    spec = {
        "platform": "instagram", "media_keys": ["slide-1.jpg"],
        "media_sha256": [expected], "alt_text": ["Lámina 1"],
    }
    asset = delivery_assets(spec)[0]
    assert asset["sha256"] == expected

    media = FakeMediaStorage({"slide-1.jpg": _jpeg()})
    instagram = InstagramImageAdapter(FakeTokens(), media)
    with pytest.raises(ValueError, match="approved asset"):
        await instagram._signed_url(asset)

    facebook = FacebookImageAdapter(FakeTokens(), media)
    with pytest.raises(ValueError, match="approved asset"):
        await facebook._read_asset(asset)


def test_delivery_assets_rejects_misaligned_hashes() -> None:
    with pytest.raises(ValueError, match="hashes"):
        delivery_assets({"media_keys": ["one.jpg", "two.jpg"], "media_sha256": ["a" * 64]})


@pytest.mark.asyncio
async def test_graph_error_does_not_expose_page_token():
    token = "page-token-that-must-remain-private"

    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {
            "code": 190, "message": f"Invalid access token {token}",
        }})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(MetaGraphError) as captured:
            await graph_json(client, "GET", "page-1", token=token)
    assert token not in str(captured.value)
    assert token not in captured.value.as_result_error()["message"]


@pytest.mark.asyncio
async def test_facebook_five_photos_caption_permalink_and_comment_permission() -> None:
    requests: list[tuple[str, str, bytes]] = []
    photo_counter = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal photo_counter
        body = request.content
        requests.append((request.method, request.url.path, body))
        if request.method == "POST" and request.url.path.endswith("/page-1/photos"):
            photo_counter += 1
            return httpx.Response(200, json={"id": f"photo-{photo_counter}"})
        if request.method == "POST" and request.url.path.endswith("/page-1/feed"):
            assert b"attached_media%5B0%5D" in body
            assert b"photo-1" in body and b"photo-5" in body
            return httpx.Response(200, json={"id": "post-1"})
        if request.method == "GET" and request.url.path.endswith("/post-1"):
            return httpx.Response(200, json={"id": "post-1", "permalink_url": "https://facebook.test/posts/1"})
        if request.method == "POST" and request.url.path.endswith("/post-1/comments"):
            return httpx.Response(400, json={"error": {"code": 200, "message": "Permission denied"}})
        raise AssertionError(f"Unexpected Graph request: {request.method} {request.url.path}")

    media = FakeMediaStorage({f"slide-{index}.jpg": _jpeg() for index in range(1, 6)})
    adapter = FacebookImageAdapter(
        FakeTokens(),
        media,
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )
    spec = {
        "platform": "facebook",
        "account_alias": "pagina_3",
        "target_id": "page-1",
        "placement": "carousel",
        "caption": "Cinco láminas verificadas",
        "first_comment": "¿Qué te pareció?",
        "slides": [_asset(index, platform="facebook") for index in range(1, 6)],
    }
    saved: list[dict] = []

    async def persist(remote: dict) -> None:
        saved.append(remote)

    result = await adapter.publish_image_delivery(spec, on_remote_update=persist)

    assert result.status == "published"
    assert result.remote["photo_ids"] == [f"photo-{i}" for i in range(1, 6)]
    assert result.remote["post_id"] == "post-1"
    assert result.remote["permalink"] == "https://facebook.test/posts/1"
    assert result.comment_status == "skipped_permission"
    assert result.comment_message == "permiso pendiente"
    assert len(saved) >= 6
    assert all(b"alt_text_custom" in body for method, path, body in requests if path.endswith("/photos"))


@pytest.mark.asyncio
async def test_instagram_carousel_persists_containers_before_publish_and_reads_quota() -> None:
    requests: list[tuple[str, str, bytes]] = []
    child_counter = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal child_counter
        body = request.content
        requests.append((request.method, request.url.path, body))
        if request.method == "POST" and request.url.path.endswith("/ig-1/media"):
            form = parse_qs(body.decode())
            if form.get("media_type") == ["CAROUSEL"]:
                assert form.get("children") == ["child-1,child-2,child-3,child-4,child-5"]
                return httpx.Response(200, json={"id": "parent-1"})
            child_counter += 1
            assert form.get("is_carousel_item") == ["true"]
            assert form.get("alt_text_custom") == [f"Lámina {child_counter}"]
            return httpx.Response(200, json={"id": f"child-{child_counter}"})
        if request.method == "GET" and any(request.url.path.endswith(f"/child-{i}") for i in range(1, 6)):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        if request.method == "GET" and request.url.path.endswith("/parent-1"):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        if request.method == "POST" and request.url.path.endswith("/ig-1/media_publish"):
            form = parse_qs(body.decode())
            assert form.get("creation_id") == ["parent-1"]
            return httpx.Response(200, json={"id": "media-1"})
        if request.method == "GET" and request.url.path.endswith("/media-1"):
            return httpx.Response(200, json={"id": "media-1", "permalink": "https://instagram.test/p/abc/"})
        if request.method == "POST" and request.url.path.endswith("/media-1/comments"):
            return httpx.Response(400, json={"error": {"code": 200, "message": "Permission denied"}})
        if request.method == "GET" and request.url.path.endswith("/ig-1/content_publishing_limit"):
            return httpx.Response(200, json={"data": [{"quota_usage": 3, "config": {"quota_total": 50}}]})
        raise AssertionError(f"Unexpected Graph request: {request.method} {request.url.path}")

    adapter = InstagramImageAdapter(
        FakeTokens(),
        FakeMediaStorage({f"slide-{index}.jpg": _jpeg() for index in range(1, 6)}),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
        poll_interval_seconds=0,
    )
    spec = {
        "platform": "instagram",
        "account_alias": "instagram_2",
        "target_id": "ig-1",
        "placement": "carousel",
        "caption": "Carrusel con fuentes",
        "first_comment": "¿Lo sabías?",
        "slides": [_asset(index) for index in range(1, 6)],
    }
    saved: list[dict] = []

    async def persist(remote: dict) -> None:
        saved.append(remote)

    result = await adapter.publish_image_delivery(spec, on_remote_update=persist)
    assert result.status == "published"
    assert result.remote["child_container_ids"] == [f"child-{i}" for i in range(1, 6)]
    assert result.remote["parent_container_id"] == "parent-1"
    assert result.remote["post_id"] == "media-1"
    assert result.remote["permalink"] == "https://instagram.test/p/abc/"
    assert result.comment_status == "skipped_permission"
    assert result.comment_message == "permiso pendiente"
    assert saved[-1]["parent_container_id"] == "parent-1"

    quota = await adapter.get_content_publishing_limit("instagram_2")
    assert quota["status"] == "ok"
    assert quota["quota_usage"] == 3
    assert quota["config"]["quota_total"] == 50


@pytest.mark.asyncio
async def test_instagram_publish_timeout_is_reconciled_without_second_publish() -> None:
    publish_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal publish_calls
        if request.method == "GET" and request.url.path.endswith("/ig-1/content_publishing_limit"):
            return httpx.Response(200, json={"data": [{"quota_usage": 3, "config": {"quota_total": 50}}]})
        if request.method == "POST" and request.url.path.endswith("/ig-1/media"):
            return httpx.Response(200, json={"id": "image-container"})
        if request.method == "GET" and request.url.path.endswith("/image-container"):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        if request.method == "POST" and request.url.path.endswith("/ig-1/media_publish"):
            publish_calls += 1
            raise httpx.ReadTimeout("simulated lost response", request=request)
        raise AssertionError(f"Unexpected Graph request: {request.method} {request.url.path}")

    adapter = InstagramImageAdapter(
        FakeTokens(),
        FakeMediaStorage({"slide-1.jpg": _jpeg()}),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
        poll_interval_seconds=0,
    )
    spec = {
        "platform": "instagram",
        "account_alias": "instagram_2",
        "target_id": "ig-1",
        "placement": "image",
        "caption": "Dato verificado",
        "slides": [_asset(1)],
    }

    result = await adapter.publish_image_delivery(spec)

    assert result.status == "outcome_unknown"
    assert result.remote["parent_container_id"] == "image-container"
    assert publish_calls == 1


@pytest.mark.asyncio
async def test_instagram_quota_exhaustion_blocks_graph_publish() -> None:
    publish_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal publish_calls
        if request.method == "GET" and request.url.path.endswith("/ig-1/content_publishing_limit"):
            return httpx.Response(200, json={"data": [{"quota_usage": 50, "config": {"quota_total": 50}}]})
        if request.method == "POST":
            publish_calls += 1
        raise AssertionError(f"Unexpected Graph request: {request.method} {request.url.path}")

    adapter = InstagramImageAdapter(
        FakeTokens(),
        FakeMediaStorage({"slide-1.jpg": _jpeg()}),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = await adapter.publish_image_delivery(
        {
            "platform": "instagram",
            "account_alias": "instagram_2",
            "target_id": "ig-1",
            "placement": "image",
            "caption": "Dato",
            "slides": [_asset(1)],
        }
    )

    assert result.status == "failed_retryable"
    assert result.last_error["code"] == "META_QUOTA"
    assert publish_calls == 0


@pytest.mark.parametrize(
    ("graph_code", "expected_status"),
    [("190", "failed_permanent"), ("9004", "failed_permanent"), ("9007", "failed_permanent"), ("36001", "failed_retryable")],
)
@pytest.mark.asyncio
async def test_facebook_graph_errors_are_classified_from_mock_responses(graph_code, expected_status) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={"error": {"code": int(graph_code), "message": "simulated Graph error", "fbtrace_id": "trace-test"}},
        )

    adapter = FacebookImageAdapter(
        FakeTokens(),
        FakeMediaStorage({"slide-1.jpg": _jpeg()}),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = await adapter.publish_image_delivery(
        {
            "platform": "facebook",
            "account_alias": "pagina_3",
            "target_id": "page-1",
            "placement": "image",
            "caption": "Foto",
            "slides": [_asset(1, platform="facebook")],
        }
    )

    assert result.status == expected_status
    assert result.last_error["fbtrace_id"] == "trace-test"


@pytest.mark.asyncio
async def test_instagram_create_timeout_is_outcome_unknown_before_container_id() -> None:
    create_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal create_calls
        if request.method == "GET" and request.url.path.endswith("/ig-1/content_publishing_limit"):
            return httpx.Response(200, json={"data": [{"quota_usage": 1, "config": {"quota_total": 50}}]})
        if request.method == "POST" and request.url.path.endswith("/ig-1/media"):
            create_calls += 1
            raise httpx.ConnectTimeout("simulated connect failure", request=request)
        raise AssertionError(f"Unexpected Graph request: {request.method} {request.url.path}")

    adapter = InstagramImageAdapter(
        FakeTokens(),
        FakeMediaStorage({"slide-1.jpg": _jpeg()}),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = await adapter.publish_image_delivery(
        {
            "platform": "instagram",
            "account_alias": "instagram_2",
            "target_id": "ig-1",
            "placement": "image",
            "caption": "Dato",
            "slides": [_asset(1)],
        }
    )

    assert result.status == "outcome_unknown"
    assert result.remote == {}
    assert create_calls == 1


@pytest.mark.asyncio
async def test_image_publisher_dispatches_to_platform_adapter() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path.endswith("/page-1/photos"):
            return httpx.Response(200, json={"id": "photo-1", "post_id": "post-1"})
        if request.method == "GET" and request.url.path.endswith("/post-1"):
            return httpx.Response(200, json={"permalink_url": "https://facebook.test/posts/1"})
        raise AssertionError(f"Unexpected Graph request: {request.method} {request.url.path}")

    saved: list[dict] = []

    async def persist(spec: DeliverySpec, remote: dict) -> None:
        assert spec.delivery_id == "delivery-1"
        saved.append(remote)

    publisher = ImagePublisher(
        FakeTokens(),
        FakeMediaStorage({"slide-1.jpg": _jpeg()}),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
        remote_persister=persist,
    )
    result = await publisher.publish_image_delivery(
        DeliverySpec(
            publication_id="pub-1",
            delivery_id="delivery-1",
            revision=1,
            platform="facebook",
            account_alias="pagina_3",
            target_id="page-1",
            placement="image",
            idempotency_key="idem-1",
            caption="Foto",
            hashtags=[],
            media_keys=["slide-1.jpg"],
            alt_text=["Foto de prueba"],
        )
    )

    assert result.photo_ids == ["photo-1"]
    assert result.post_id == "post-1"
    assert saved[0]["photo_ids"] == ["photo-1"]
    assert saved[-1]["permalink"] == "https://facebook.test/posts/1"


@pytest.mark.asyncio
async def test_facebook_photo_delete_uses_graph_delete_for_cleanup() -> None:
    methods: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        assert request.url.path.endswith("/post-1")
        assert request.url.params.get("access_token") == "token:facebook:pagina_3"
        return httpx.Response(200, json={"success": True})

    adapter = FacebookImageAdapter(
        FakeTokens(),
        FakeMediaStorage(),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )

    assert await adapter.delete_image_post("post-1", "pagina_3") is True
    assert methods == ["DELETE"]


@pytest.mark.asyncio
async def test_reel_adapter_delegates_to_existing_pipeline_and_blocks_unknown_music(tmp_path) -> None:
    reel_path = tmp_path / "reel.mp4"
    reel_path.write_bytes(b"\x00\x00\x00\x18ftypisomreel")

    class ReelStorage:
        def local_path(self, key: str) -> Path:
            assert key == "reels/reel.mp4"
            return reel_path

    class ExistingPublisher:
        def __init__(self) -> None:
            self.calls: list[dict] = []

        async def publish_video(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(post_id="reel-1", url="https://instagram.test/reel/1")

    existing = ExistingPublisher()
    adapter = ImageReelAdapter(FakeTokens(), ReelStorage(), publisher=existing)
    spec = {
        "platform": "instagram",
        "account_alias": "instagram_2",
        "placement": "reel",
        "reel_storage_key": "reels/reel.mp4",
        "caption": (
            "Reel con pista licenciada\nMúsica: Artista de prueba\n"
            "https://music.example/track-1\nhttps://creativecommons.org/licenses/by/4.0/"
        ),
        "music": {
            "mode": "convert_to_reel",
            "music_asset_id": "music-1",
            "source_sha256": "a" * 64,
            "duration_sec": 8,
            "license": {
                "spdx_or_name": "CC-BY-4.0",
                "url": "https://creativecommons.org/licenses/by/4.0/",
                "proof_ref": "music-proof-1",
                "author": "Artista de prueba",
                "track_url": "https://music.example/track-1",
                "attribution": "Música: Artista de prueba",
            },
        },
    }

    result = await adapter.publish_image_delivery(spec)

    assert result.status == "published"
    assert result.remote == {"post_id": "reel-1", "permalink": "https://instagram.test/reel/1"}
    assert existing.calls[0]["account_selector"] == "instagram:instagram_2"
    assert existing.calls[0]["publish_as_reel"] is False

    missing_credit = await adapter.publish_image_delivery({**spec, "caption": "Sin crédito musical"})
    assert missing_credit.status == "failed_permanent"
    assert missing_credit.last_error["code"] == "UNLICENSED_MUSIC"
    assert len(existing.calls) == 1

    blocked = await adapter.publish_image_delivery(
        {
            **spec,
            "music": {"mode": "convert_to_reel", "license": {"spdx_or_name": "unknown"}},
        }
    )
    assert blocked.status == "failed_permanent"
    assert blocked.last_error["code"] == "UNLICENSED_MUSIC"
    assert len(existing.calls) == 1
    assert adapter._music_license_error({**spec, "music": {
        **spec["music"], "license": {
            **spec["music"]["license"], "spdx_or_name": "CC BY NC 4.0",
        },
    }}) is not None


@pytest.mark.asyncio
async def test_reel_reconciliation_confirms_only_a_published_facebook_video() -> None:
    requests: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.method)
        assert request.method == "GET"
        assert request.url.path.endswith("/video-1")
        return httpx.Response(
            200,
            json={
                "id": "video-1",
                "is_published": True,
                "permalink_url": "https://facebook.test/reel/1",
                "status": {
                    "video_status": "ready",
                    "processing_progress": {"status": "complete"},
                },
            },
        )

    adapter = ImageReelAdapter(
        FakeTokens(),
        FakeMediaStorage(),
        publisher=SimpleNamespace(),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = await adapter.reconcile_image_delivery(
        {
            "platform": "facebook",
            "account_alias": "pagina_3",
            "remote": {"post_id": "video-1"},
        }
    )

    assert result.status == "published"
    assert result.remote["permalink"] == "https://facebook.test/reel/1"
    assert requests == ["GET"]


@pytest.mark.asyncio
async def test_saved_instagram_reel_container_is_reconciled_without_reposting() -> None:
    methods: list[str] = []
    publish_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        assert request.method == "GET"
        assert request.url.path.endswith("/container-1")
        return httpx.Response(200, json={"id": "container-1", "status_code": "FINISHED"})

    class ExistingPublisher:
        async def publish_video(self, **kwargs):
            nonlocal publish_calls
            publish_calls += 1
            raise AssertionError("A saved Instagram container must not be recreated")

    adapter = ImageReelAdapter(
        FakeTokens(),
        FakeMediaStorage(),
        publisher=ExistingPublisher(),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = await adapter.publish_image_delivery(
        {
            "platform": "instagram",
            "account_alias": "instagram_2",
            "remote": {"parent_container_id": "container-1"},
        }
    )

    assert result.status == "outcome_unknown"
    assert methods == ["GET"]
    assert publish_calls == 0


@pytest.mark.asyncio
async def test_oauth_requests_optional_image_comment_and_insight_scopes(monkeypatch) -> None:
    monkeypatch.setattr(settings, "facebook_client_id", "test-app-id")
    monkeypatch.setattr(settings, "publisher_encryption_key", "test-signing-key")
    monkeypatch.setattr(settings, "public_app_url", "https://nexa.example")

    instagram = await instagram_oauth_start("instagram_2")
    facebook = await facebook_oauth_start("pagina_3")
    instagram_query = dict(parse_qsl(urlparse(instagram.headers["location"]).query))
    facebook_query = dict(parse_qsl(urlparse(facebook.headers["location"]).query))

    assert "instagram_manage_comments" in instagram_query["scope"].split(",")
    assert "instagram_manage_insights" in instagram_query["scope"].split(",")
    assert "pages_manage_engagement" in facebook_query["scope"].split(",")
    assert "pages_read_user_engagement" in facebook_query["scope"].split(",")
