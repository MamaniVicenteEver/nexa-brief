"""Editable previews and immutable exports use local fixtures, never AI or social APIs."""

from __future__ import annotations

import asyncio
from dataclasses import replace
import hashlib
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image, ImageCms
import pytest

from test_plan_render import load_style, make_plan
from test_repository_api import _record, NOW
from src.adapters.data.publication_factory import build_publication_components
from src.config.settings import settings
from src.core.image_posts.artwork import ImagePostArtwork, latest_post_revision, validate_target_format
from src.core.image_posts.errors import ImagePostError
from src.core.image_posts.models import Delivery, DeliveryStatus, PostStatus
from src.core.image_posts.profiles import get_image_profile
from src.core.image_posts.plan import plan_hash
from src.presentation.api.routers import image_posts
from src.presentation.api.image_post_access import ImageSession, require_image_session
from src.presentation.api.security import require_internal


def jpeg(size, *, profile=True, file_format="JPEG"):
    output = BytesIO()
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes() if profile else None
    Image.new("RGB", size, "#151515").save(output, file_format, icc_profile=icc)
    return output.getvalue()


class FakeRenderer:
    def __init__(self):
        self.calls = 0
        self.before_result = None
        self.content = None

    async def render(self, plan, style, media):
        self.calls += 1
        if self.before_result:
            await self.before_result()
        size = get_image_profile(plan.format).size
        content = self.content if self.content is not None else jpeg(size)
        return {
            "assets": [
                {
                    "width": size[0],
                    "height": size[1],
                    "content": content,
                    "sha256": hashlib.sha256(content).hexdigest(),
                    "qc": {"overflow": False, "contrast": True, "readability": True},
                }
            ],
            "technical": {
                "validations": [{"name": "jpeg", "version": "test", "passed": True, "checked_at": NOW}],
                "render": {},
            },
        }


@pytest.fixture
def components(tmp_path, monkeypatch):
    # ACL lookups, events and repositories are isolated from production data.
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    renderer = FakeRenderer()
    result = build_publication_components(
        data_dir=tmp_path,
        renderer=renderer,
        publisher=AsyncMock(),
        account_provider=lambda: [
            {"platform": platform, "alias": "test", "target_id": "target", "status": "ok"}
            for platform in ("instagram", "facebook")
        ],
    )
    result.service._emit = AsyncMock()
    result.service._queue_deliveries = AsyncMock()
    result.service.account_mapping = SimpleNamespace(resolve_account=lambda *_: {"active": True, "can_comment": False})
    return result


async def store_record(components, *, format="4:5", status=PostStatus.APPROVED):
    record = _record(status=status)
    plan = replace(make_plan(load_style("node_tech")), format=format)
    technical = record.technical.model_copy(
        update={
            "composition_plan": type(record.technical.composition_plan).model_validate(
                {
                    **plan.to_dict(),
                    "plan_hash": plan_hash(plan, load_style("node_tech")),
                }
            ),
            "slides": [
                record.technical.slides[0].model_copy(
                    update={
                        "width": get_image_profile(format).width,
                        "height": get_image_profile(format).height,
                        "aspect_ratio": format,
                    }
                )
            ],
        }
    )
    record = record.model_copy(update={"technical": technical})
    return await components.repository.create(record)


@pytest.mark.asyncio
@pytest.mark.parametrize("format", ["4:5", "3:5", "9:16"])
async def test_preview_is_read_only_and_uses_selected_format(components, monkeypatch, format):
    record = await store_record(components)
    before = components.repository.get(record.publication_id).model_dump(mode="json")
    from src.core.image_posts import render

    calls = []

    def build_html(plan, style, media, *, slide_id, format):
        calls.append((plan.format, slide_id, format))
        return "<!doctype html><html><body>Editable artwork</body></html>"

    monkeypatch.setattr(render, "build_preview_html", build_html)
    response = await ImagePostArtwork(components.service).preview(record, format, None)
    assert response["format"] == format
    assert (response["width"], response["height"]) == get_image_profile(format).size
    assert calls == [(format, "slide_01", format)]
    assert components.repository.get(record.publication_id).model_dump(mode="json") == before
    assert len(components.repository.list().items) == 1
    assert components.service.renderer.calls == 0
    components.service.publisher.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("format", ["4:5", "3:5", "9:16"])
async def test_export_creates_reviewable_revision_preserving_editorial_and_old_media(components, format):
    record = await store_record(components)
    old_content = jpeg((1080, 1350))
    old_key = record.technical.slides[0].storage_key
    components.media.put(old_key, old_content, "image/jpeg", hashlib.sha256(old_content).hexdigest(), if_absent=True)
    before = components.repository.get(record.publication_id).model_dump(mode="json")
    result = await ImagePostArtwork(components.service).export(record, 1, format)
    assert result.revision == 2 and result.post_id == record.post_id
    assert result.publication_id != record.publication_id
    assert result.supersedes_publication_id == record.publication_id
    assert result.status == PostStatus.READY_FOR_REVIEW
    assert not result.editorial.review.approved_at
    assert result.deliveries == [] and result.metrics_snapshots == []
    assert result.editorial.model_dump(exclude={"review"}) == record.editorial.model_dump(exclude={"review"})
    assert components.repository.get(record.publication_id).model_dump(mode="json") == before
    assert components.media.get(old_key).read() == old_content
    new_slide = result.technical.slides[0]
    new_bytes = components.media.get(new_slide.storage_key).read()
    assert new_slide.storage_key != old_key
    assert hashlib.sha256(new_bytes).hexdigest() == new_slide.sha256
    with Image.open(BytesIO(new_bytes)) as image:
        assert image.format == "JPEG" and image.mode == "RGB"
        assert image.size == get_image_profile(format).size
        assert (
            "srgb" in ImageCms.getProfileName(ImageCms.ImageCmsProfile(BytesIO(image.info["icc_profile"]))).casefold()
        )
    assert latest_post_revision(components.service, record).publication_id == result.publication_id


@pytest.mark.asyncio
async def test_repeat_export_with_same_source_hash_is_idempotent(components):
    old = await store_record(components)
    artwork = ImagePostArtwork(components.service)
    first = await artwork.export(old, 1, "9:16")
    second = await artwork.export(first, 2, "9:16")
    assert second.publication_id == first.publication_id
    assert components.service.renderer.calls == 1
    assert len(components.repository.list().items) == 2
    with pytest.raises(ImagePostError) as stale:
        await artwork.export(old, 1, "9:16")
    assert stale.value.code == "REVISION_CONFLICT"


@pytest.mark.asyncio
async def test_parallel_exports_allow_one_revision_and_reject_stale_request(components):
    record = await store_record(components)
    artwork = ImagePostArtwork(components.service)
    results = await asyncio.gather(
        artwork.export(record, 1, "9:16"), artwork.export(record, 1, "3:5"), return_exceptions=True
    )
    assert sum(not isinstance(item, Exception) for item in results) == 1
    assert [item.code for item in results if isinstance(item, ImagePostError)] == ["REVISION_CONFLICT"]
    assert len(components.repository.list().items) == 2


@pytest.mark.asyncio
async def test_caption_edit_during_render_is_not_overwritten(components):
    record = await store_record(components)

    async def edit_caption():
        await components.repository.update(
            record.publication_id,
            {
                "editorial": {
                    **record.editorial.model_dump(mode="json"),
                    "title": "Título editado mientras se exportaba",
                }
            },
            record.record_version,
        )

    components.service.renderer.before_result = edit_caption
    with pytest.raises(ImagePostError) as conflict:
        await ImagePostArtwork(components.service).export(record, 1, "9:16")
    assert conflict.value.code == "REVISION_CONFLICT"
    assert components.repository.get(record.publication_id).editorial.title == "Título editado mientras se exportaba"
    assert len(components.repository.list().items) == 1


@pytest.mark.asyncio
async def test_renderer_change_during_export_cannot_save_stale_source_hash(components, monkeypatch):
    record = await store_record(components)
    from src.core.image_posts import render

    fingerprints = iter(["a" * 64, "b" * 64])
    monkeypatch.setattr(render, "renderer_source_hash", lambda *_: next(fingerprints))
    with pytest.raises(ImagePostError) as changed:
        await ImagePostArtwork(components.service).export(record, 1, "9:16")
    assert changed.value.code == "REVISION_CONFLICT"
    assert len(components.repository.list().items) == 1


@pytest.mark.parametrize("format", ["4:5", "3:5", "9:16"])
def test_media_storage_accepts_only_registered_jpeg_dimensions(tmp_path, format):
    from src.adapters.data.local_publication_media import LocalPublicationMedia

    storage = LocalPublicationMedia(data_dir=tmp_path)
    content = jpeg(get_image_profile(format).size)
    digest = hashlib.sha256(content).hexdigest()
    first = storage.put("node_tech/test/01.jpg", content, "image/jpeg", digest, if_absent=True)
    assert storage.get(first.key).read() == content
    assert storage.put(first.key, content, "image/jpeg", digest, if_absent=True).sha256 == digest
    other = jpeg((1080, 1500))
    with pytest.raises(ValueError, match="tamaño de publicación"):
        storage.put("node_tech/test/02.jpg", other, "image/jpeg", hashlib.sha256(other).hexdigest(), if_absent=True)


def test_storage_mp4_contract_is_unchanged(tmp_path):
    from src.adapters.data.local_publication_media import LocalPublicationMedia

    storage = LocalPublicationMedia(data_dir=tmp_path)
    mp4 = b"\x00\x00\x00\x18ftypisom" + b"mock-existing-reel"
    digest = hashlib.sha256(mp4).hexdigest()
    saved = storage.put("node_tech/test/reel.mp4", mp4, "video/mp4", digest, if_absent=True)
    assert storage.get(saved.key).read() == mp4


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status",
    [
        DeliveryStatus.QUEUED,
        DeliveryStatus.PUBLISHING,
        DeliveryStatus.OUTCOME_UNKNOWN,
        DeliveryStatus.PUBLISHED,
        DeliveryStatus.REMOVED_API,
    ],
)
async def test_sent_and_inflight_deliveries_lock_format_changes(components, status):
    record = await store_record(components)
    delivery = Delivery(
        delivery_id="del_test",
        revision=1,
        platform="facebook",
        account_alias="test",
        target_id="target",
        placement="image",
        idempotency_key="test",
        status=status,
        created_at=NOW,
        updated_at=NOW,
    )
    record = await components.repository.update(
        record.publication_id, {"deliveries": [delivery.model_dump(mode="json")]}, record.record_version
    )
    with pytest.raises(ImagePostError) as locked:
        await ImagePostArtwork(components.service).export(record, 1, "9:16")
    assert locked.value.code == "IMAGE_FORMAT_LOCKED"
    assert components.service.renderer.calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_content",
    [
        b"\xff\xd8\xfftruncated",
        jpeg((1080, 1350)),
        jpeg((1080, 1920), profile=False),
        jpeg((1080, 1920), file_format="PNG"),
    ],
    ids=["truncated", "wrong-dimensions", "missing-srgb", "png"],
)
async def test_export_rejects_manifest_that_lies_about_jpeg_bytes(components, bad_content):
    record = await store_record(components)
    components.service.renderer.content = bad_content
    with pytest.raises(ImagePostError) as invalid:
        await ImagePostArtwork(components.service).export(record, 1, "9:16")
    assert invalid.value.code == "INVALID_IMAGE"
    assert len(components.repository.list().items) == 1


@pytest.mark.asyncio
async def test_instagram_incompatible_profile_fails_before_queue_and_facebook_can_queue(components):
    record = await store_record(components, format="9:16")
    with pytest.raises(ImagePostError) as incompatible:
        await components.service.schedule_deliveries(
            record.publication_id, 1, [{"platform": "instagram", "account_alias": "test"}], "ig-test", immediate=True
        )
    assert incompatible.value.code == "UNSUPPORTED_IMAGE_RATIO"
    components.service._queue_deliveries.assert_not_called()
    assert components.repository.get(record.publication_id).deliveries == []
    deliveries = await components.service.schedule_deliveries(
        record.publication_id, 1, [{"platform": "facebook", "account_alias": "test"}], "fb-test", immediate=True
    )
    assert len(deliveries) == 1 and deliveries[0].platform == "facebook"
    components.service._queue_deliveries.assert_called_once()
    components.service.publisher.assert_not_called()


@pytest.mark.asyncio
async def test_format_validation_rejects_unexported_profile_dimensions(components):
    record = await store_record(components, format="9:16")
    slide = record.technical.slides[0].model_copy(update={"height": 1350})
    record = record.model_copy(update={"technical": record.technical.model_copy(update={"slides": [slide]})})
    with pytest.raises(ImagePostError) as invalid:
        validate_target_format(record, "facebook")
    assert invalid.value.code == "IMAGE_FORMAT_NOT_EXPORTED"


@pytest.mark.asyncio
async def test_routes_require_session_category_access_and_validate_format(components, monkeypatch):
    record = await store_record(components)
    monkeypatch.setattr(image_posts, "get_image_post_service", lambda: components.service)
    app = FastAPI()
    app.include_router(image_posts.router, prefix="/api/v1")
    app.dependency_overrides[require_internal] = lambda: None
    with TestClient(app) as client:
        assert client.get(f"/api/v1/image-posts/{record.post_id}/preview").status_code == 401
        assert (
            client.post(
                f"/api/v1/image-posts/{record.post_id}/format", json={"revision": 1, "format": "9:16"}
            ).status_code
            == 401
        )
        app.dependency_overrides[require_image_session] = lambda: ImageSession(
            email="editor@example.org", role="editor"
        )
        assert client.get(f"/api/v1/image-posts/{record.post_id}/preview").status_code == 403
        app.dependency_overrides[require_image_session] = lambda: ImageSession(email="admin@example.org", role="admin")
        response = client.get(f"/api/v1/image-posts/{record.post_id}/preview?format=16:9")
        assert response.status_code == 422 and response.json()["detail"]["code"] == "INVALID_IMAGE_FORMAT"
        assert (
            client.post(
                f"/api/v1/image-posts/{record.post_id}/format", json={"revision": 1, "format": "16:9"}
            ).status_code
            == 422
        )
        assert (
            client.post(
                f"/api/v1/image-posts/{record.post_id}/format", json={"revision": 0, "format": "9:16"}
            ).status_code
            == 422
        )
    assert len(components.repository.list().items) == 1
    assert components.service.renderer.calls == 0
