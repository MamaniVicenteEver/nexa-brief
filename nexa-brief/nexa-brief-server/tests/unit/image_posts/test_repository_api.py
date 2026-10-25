from __future__ import annotations

import asyncio
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
from types import SimpleNamespace
from urllib.parse import urlsplit

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from src.adapters.data.json_publication_repository import (
    IdempotencyConflict,
    JsonPublicationRepository,
    RepositoryConflict,
)
from src.adapters.data.local_publication_media import LocalPublicationMedia
from src.adapters.data.publication_factory import (
    build_publication_components,
    set_publication_components,
)
from src.core.data import set_data_store
from src.core.image_posts.service import _copy_source_for_record
from src.core.image_posts.service import ImagePostError, _approved_for_publication, _safe_error
from src.adapters.publishing.image_publisher import ImagePublishError
from src.core.image_posts.models import (
    Delivery,
    DeliveryError,
    DeliveryStatus,
    EditorialRecord,
    EditorialReview,
    EditorialSlide,
    NetworkCopy,
    MusicOption,
    PostCopy,
    PostStatus,
    PublicationRecord,
    ReelManifest,
    RemoteResult,
    RenderedSlide,
    TechnicalRecord,
    ValidationResult,
)
from src.presentation.api.routers import image_posts, publications
from src.presentation.api.routers.image_posts import _record as lookup_image_post
from src.presentation.api.routers.image_posts import _post_json
from src.presentation.api.routers.publications import _safe_record
from src.presentation.api.schemas.image_posts_schema import ImagePostPatchRequest
from src.config.settings import settings


NOW = datetime(2026, 10, 25, 10, 0, tzinfo=timezone.utc)


def test_mixed_copy_source_is_persisted_with_rules_provenance():
    assert _copy_source_for_record("modelo") == "modelo"
    assert _copy_source_for_record("reglas: modelo apagado") == "reglas: modelo apagado"
    assert _copy_source_for_record("modelo; por reglas: body") == (
        "reglas: salida mixta; campos sustituidos: body"
    )


def test_meta_errors_redact_credentials_and_signed_media_urls():
    message = (
        "access_token=page-secret&appsecret_proof=proof-secret "
        "Bearer bearer-secret "
        "https://example.org/api/v1/publish/instagram/media/signed-secret"
    )
    cleaned = _safe_error(RuntimeError(message))
    assert all(secret not in cleaned for secret in (
        "page-secret", "proof-secret", "bearer-secret", "signed-secret",
    ))


@pytest.mark.parametrize(("usage", "expected"), [
    ("Sí; aprobado con caveat", True),
    ("Aprobada: publicar solo con contexto", True),
    ("Publicar — cifra cotejada", True),
    ("Cotejada; puede usarse", False),
    ("Sí, pero no publicar", False),
])
def test_publication_approval_marker_is_explicit(usage, expected):
    assert _approved_for_publication(usage) is expected


def test_archived_image_dtos_reject_free_fields_and_preserve_copy_api_alias():
    with pytest.raises(ValidationError):
        DeliveryError(code="META", message="falló", access_token="secret")

    technical = _record().technical.model_dump(mode="json")
    technical["render"] = {"engine": "chromium", "absolute_path": "/tmp/private/render.png"}
    with pytest.raises(ValidationError):
        TechnicalRecord.model_validate(technical)
    technical = _record().technical.model_dump(mode="json")
    technical["reel"] = {"storage_key": "reel.mp4", "duration_sec": 15, "credential": "secret"}
    with pytest.raises(ValidationError):
        TechnicalRecord.model_validate(technical)
    technical = _record().technical.model_dump(mode="json")
    technical["composition_plan"]["slides"][0]["claim_refs"][0]["secret"] = "secret"
    with pytest.raises(ValidationError):
        TechnicalRecord.model_validate(technical)

    patch = ImagePostPatchRequest.model_validate({
        "revision": 1,
        "copy": {"facebook": {"caption": "Texto"}, "instagram": {"caption": "Texto"}},
    })
    assert patch.copy_data.facebook.caption == "Texto"
    assert "copy" in patch.model_dump(exclude_unset=True)
    assert "copy_data" not in patch.model_dump(exclude_unset=True)


@pytest.mark.asyncio
async def test_repository_redacts_secrets_and_absolute_paths_before_save(tmp_path):
    components = build_publication_components(data_dir=tmp_path)
    delivery = Delivery(
        delivery_id="del_redact", revision=1, platform="facebook", account_alias="pagina_3",
        target_id="page-test", placement="image", idempotency_key="redact-key",
        status=DeliveryStatus.FAILED_PERMANENT,
        last_error=DeliveryError(
            code="META_TEST",
            message="access_token=private Bearer bearer-secret /tmp/private/render.png",
        ),
        created_at=NOW, updated_at=NOW,
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))
    error = components.repository.get("pub_test").deliveries[0].last_error
    assert error is not None
    assert "private" not in error.message
    assert "bearer-secret" not in error.message
    assert "/tmp/private" not in error.message
    assert "[ruta local omitida]" in error.message


@pytest.mark.asyncio
async def test_concurrent_delivery_claim_returns_one_stable_delivery(tmp_path):
    repo = JsonPublicationRepository(tmp_path)
    await repo.create(_record())

    def candidate(delivery_id: str) -> dict:
        return Delivery(
            delivery_id=delivery_id, revision=1, platform="facebook", account_alias="pagina_3",
            target_id="page-test", placement="image", idempotency_key="same-delivery-key",
            status=DeliveryStatus.QUEUED, created_at=NOW, updated_at=NOW,
        ).model_dump(mode="json")

    async def claim(delivery_id: str):
        return await repo.claim_deliveries(
            "pub_test", "deliveries:same-request", "same-body-hash", 1,
            [candidate(delivery_id)], PostStatus.APPROVED.value,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(asyncio.run, claim(f"del_{index}")) for index in range(2)]
        results = [future.result() for future in futures]

    ids = [result["delivery_ids"] for result in results]
    assert ids[0] == ids[1]
    assert len(ids[0]) == 1
    assert len(repo.get("pub_test")["deliveries"]) == 1


def test_api_records_hide_reel_storage_key():
    record = _record()
    technical = record.technical.model_copy(update={
        "reel": ReelManifest(storage_key="node_tech/private/reel.mp4", duration_sec=15),
    })
    record = record.model_copy(update={"technical": technical})
    for response in (_post_json(record), _safe_record(record)):
        assert "storage_key" not in response["technical"]["reel"]
        assert "storage_key" not in response["technical"]["slides"][0]


def _record(publication_id: str = "pub_test", *, status: PostStatus = PostStatus.APPROVED) -> PublicationRecord:
    slide = RenderedSlide(
        slide_id="slide_01", order=1, asset_id="asset_01",
        storage_key=f"node_tech/2026/10/{publication_id}/slides/01.jpg",
        width=1080, height=1350, bytes=20, sha256="a" * 64, rendered_at=NOW,
    )
    return PublicationRecord(
        publication_id=publication_id, post_id="img_test", revision=1, record_version=1,
        created_at=NOW, updated_at=NOW, status=status,
        technical=TechnicalRecord(
            kind="image", template_id="daily_fact", slides=[slide],
            copy_sources={"claim_1": "reglas: sin modelo"},
            composition_plan={
                "schema_version": 1, "plan_id": "plan_test", "category_id": "node_tech",
                "source_video_id": "video_test", "source_revision": "source-r1",
                "style_id": "node_tech_rough", "style_version": "1.0.0",
                "template_id": "daily_fact", "format": "4:5", "seed": 7,
                "renderer_version": "image-stage-1.0.0", "plan_hash": "b" * 64,
                "slides": [{"slide_id": "slide_01", "order": 1, "layout": "dato",
                            "elements": [], "texts": [], "media": [],
                            "claim_refs": [{"id": "claim_1", "source_id": "source_1",
                                            "url": "https://example.org", "locator": "§1"}]}],
            },
            validations=[ValidationResult(name="jpeg", version="1", passed=True, checked_at=NOW)],
        ),
        editorial=EditorialRecord(
            category_id="node_tech", strategy_id="cifra_que_frena",
            source_video_id="video_test", title="Dato validado",
            sources=[{"source_id": "source_1", "claim_ids": ["claim_1"], "title": "Fuente",
                      "url": "https://example.org", "locator": "§1", "verified_at": NOW}],
            slides=[EditorialSlide(slide_id="slide_01", alt_text_fb="Descripción FB", alt_text_ig="Descripción IG")],
            copy=PostCopy(facebook=NetworkCopy(caption="Texto FB"), instagram=NetworkCopy(caption="Texto IG")),
            review=EditorialReview(required=True, approved_at=NOW, approval_source="human"),
        ),
    )


@pytest.mark.asyncio
async def test_review_archives_licensed_reel_before_approval(tmp_path):
    root = tmp_path / "media-cache" / "reel_music"
    root.mkdir(parents=True)
    audio = b"ID3" + b"licensed" * 100
    (root / "verified.mp3").write_bytes(audio)
    license_data = {
        "spdx_or_name": "CC0-1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "author": "Autor", "track_url": "https://example.org/track",
        "attribution": "Autor — Obra", "proof_ref": "https://example.org/track",
    }
    digest = hashlib.sha256(audio).hexdigest()
    (root / "catalog.json").write_text(json.dumps({"schema_version": 1, "tracks": [{
        "music_asset_id": "verified", "file": "verified.mp3", "source_sha256": digest,
        "license": license_data, "commercial_sync": True, "instrumental": True,
    }]}))

    class FakeEncoder:
        async def encode(self, _frames, path, *, duration, trim_start, gain_db):
            assert path == root / "verified.mp3"
            assert duration == 8 and trim_start == 0 and gain_db == 0
            return b"\x00\x00\x00\x18ftypisom" + b"mock-video"

    components = build_publication_components(data_dir=tmp_path)
    components.service.reel_encoder = FakeEncoder()
    record = _record(status=PostStatus.READY_FOR_REVIEW)
    technical = record.technical.model_copy(update={"music": MusicOption.model_validate({
        "mode": "convert_to_reel", "music_asset_id": "verified",
        "source_sha256": digest, "license": license_data, "duration_sec": 8,
    })})
    await components.repository.create(record.model_copy(update={"technical": technical}))

    approved = await components.service.review("pub_test", 1, "approve")
    assert approved.status == PostStatus.APPROVED
    editorial_check = next(item for item in approved.technical.validations
                           if item.name == "claims_sources_license")
    assert editorial_check.passed
    assert editorial_check.details.claim_count == 1
    assert editorial_check.details.source_count == 1
    assert approved.technical.reel is not None
    reel = approved.technical.reel
    assert reel.duration_sec == 8 and reel.asset_id.startswith("reel_")
    assert hashlib.sha256(components.media.get(reel.storage_key).read()).hexdigest() == reel.sha256

    class BrokenEncoder:
        async def encode(self, *_args, **_kwargs):
            raise ValueError("ffmpeg failed at /tmp/private/reel.mp4")

    components.service.reel_encoder = BrokenEncoder()
    with pytest.raises(ImagePostError) as captured:
        await components.service._encode_reel(approved)
    assert "/tmp/private" not in str(captured.value)


@pytest.mark.asyncio
async def test_review_rejects_claim_with_mismatched_archived_source(tmp_path):
    components = build_publication_components(data_dir=tmp_path)
    record = _record(status=PostStatus.READY_FOR_REVIEW)
    editorial = record.editorial.model_copy(update={
        "sources": [record.editorial.sources[0].model_copy(update={"url": "https://other.example.org"})],
    })
    await components.repository.create(record.model_copy(update={"editorial": editorial}))

    with pytest.raises(ImagePostError) as captured:
        await components.service.review("pub_test", 1, "approve")
    assert captured.value.code == "UNSOURCED_CLAIM"
    assert components.repository.get("pub_test").status == PostStatus.READY_FOR_REVIEW


@pytest.mark.asyncio
async def test_review_rejects_photo_if_network_caption_loses_attribution(tmp_path):
    components = build_publication_components(data_dir=tmp_path)
    record = _record(status=PostStatus.READY_FOR_REVIEW)
    technical_data = record.technical.model_dump(mode="json")
    technical_data["composition_plan"]["slides"][0]["media"] = [{
        "asset_id": "photo_1", "sha256": "c" * 64, "license_id": "CC BY 2.0",
        "author": "Fotógrafa", "url": "https://commons.wikimedia.org/wiki/File:Photo.jpg",
    }]
    await components.repository.create(record.model_copy(update={
        "technical": TechnicalRecord.model_validate(technical_data),
    }))

    with pytest.raises(ImagePostError) as captured:
        await components.service.review("pub_test", 1, "approve")
    assert captured.value.code == "UNLICENSED_MEDIA"


@pytest.mark.asyncio
async def test_gallery_filters_platform_and_delivery_status_on_same_delivery(tmp_path):
    components = build_publication_components(data_dir=tmp_path)
    facebook = Delivery(
        delivery_id="del_fb", revision=1, platform="facebook", account_alias="pagina_3",
        target_id="page-test", placement="image", idempotency_key="fb-key",
        status=DeliveryStatus.PUBLISHED, created_at=NOW, updated_at=NOW,
    )
    instagram = Delivery(
        delivery_id="del_ig", revision=1, platform="instagram", account_alias="instagram_2",
        target_id="ig-test", placement="reel", idempotency_key="ig-key",
        status=DeliveryStatus.REMOVED_MANUALLY, created_at=NOW, updated_at=NOW,
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [facebook, instagram]}))

    assert components.repository.list({
        "platform": "instagram", "delivery_status": "published",
    }).items == []
    assert len(components.repository.list({
        "platform": "instagram", "placement": "reel", "delivery_status": "removed_manually",
    }).items) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("meta_status,expected_status", [
    ("failed_permanent", DeliveryStatus.FAILED_PERMANENT),
    ("failed_retryable", DeliveryStatus.FAILED_RETRYABLE),
    ("outcome_unknown", DeliveryStatus.OUTCOME_UNKNOWN),
])
async def test_publish_delivery_preserves_meta_failure_classification(
    tmp_path, meta_status, expected_status,
):
    class FailingPublisher:
        async def publish_image_delivery(self, _spec):
            raise ImagePublishError(meta_status, {
                "code": "META_TEST", "message": "access_token=page-secret",
            })

    components = build_publication_components(data_dir=tmp_path, publisher=FailingPublisher())
    delivery = Delivery(
        delivery_id="del_test", revision=1, platform="facebook", account_alias="pagina_3",
        target_id="page-test", placement="image", idempotency_key="test-key",
        status=DeliveryStatus.QUEUED, created_at=NOW, updated_at=NOW,
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))

    with pytest.raises(ImagePostError):
        await components.service.publish_delivery(delivery.delivery_id)
    stored = components.repository.get("pub_test").deliveries[0]
    assert stored.status == expected_status
    assert stored.last_error.code == "META_TEST"
    assert "page-secret" not in stored.last_error.message


@pytest.mark.asyncio
async def test_unclassified_publish_failure_requires_reconciliation(tmp_path):
    class UnexpectedPublisher:
        async def publish_image_delivery(self, _spec):
            raise RuntimeError("Meta response handling failed")

    components = build_publication_components(data_dir=tmp_path, publisher=UnexpectedPublisher())
    delivery = Delivery(
        delivery_id="del_unknown", revision=1, platform="facebook", account_alias="pagina_3",
        target_id="page-test", placement="image", idempotency_key="unknown-key",
        status=DeliveryStatus.QUEUED, created_at=NOW, updated_at=NOW,
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))

    with pytest.raises(ImagePostError) as captured:
        await components.service.publish_delivery(delivery.delivery_id)
    assert captured.value.code == "OUTCOME_UNKNOWN"
    assert components.repository.get("pub_test").deliveries[0].status == DeliveryStatus.OUTCOME_UNKNOWN


@pytest.mark.asyncio
async def test_cancelled_delivery_cannot_call_publisher(tmp_path):
    class UnexpectedPublisher:
        async def publish_image_delivery(self, _spec):
            raise AssertionError("The publisher must not be called")

    components = build_publication_components(data_dir=tmp_path, publisher=UnexpectedPublisher())
    delivery = Delivery(
        delivery_id="del_cancelled", revision=1, platform="facebook", account_alias="pagina_3",
        target_id="page-test", placement="image", idempotency_key="cancelled-key",
        status=DeliveryStatus.CANCELLED, created_at=NOW, updated_at=NOW,
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))

    with pytest.raises(ImagePostError, match="La entrega ya no está en cola"):
        await components.service.publish_delivery(delivery.delivery_id)
    assert components.repository.get("pub_test").deliveries[0].attempt_count == 0


@pytest.mark.asyncio
async def test_post_lookup_reaches_records_after_first_index_page(tmp_path):
    components = build_publication_components(data_dir=tmp_path)
    old = _record("pub_old").model_copy(update={
        "post_id": "img_old", "created_at": NOW - timedelta(days=1),
    })
    await components.repository.create(old)
    for index in range(101):
        await components.repository.create(_record(f"pub_new_{index:03}"))

    found = lookup_image_post(components.service, "img_old")
    assert found is not None
    assert found.publication_id == "pub_old"


@pytest.mark.asyncio
async def test_patch_preserves_review_policy_when_field_is_omitted(tmp_path, monkeypatch):
    from src.core.schedule import queue_repository

    monkeypatch.setattr(queue_repository, "list_entries", lambda **_kwargs: ([], 0))
    components = build_publication_components(data_dir=tmp_path)
    record = _record()
    editorial = record.editorial.model_copy(update={"review": EditorialReview(required=False)})
    await components.repository.create(record.model_copy(update={"editorial": editorial}))

    updated = await components.service.patch_post("pub_test", {"revision": 1, "title": "Nuevo título"})
    assert updated.editorial.review.required is False


@pytest.mark.asyncio
async def test_publication_record_roundtrip_cas_idempotency_and_index_repair(tmp_path):
    repository = JsonPublicationRepository(tmp_path)
    record = _record()
    saved = await repository.create(record, "plan-key", idempotency_request_hash="request-hash")
    assert saved["publication_id"] == record.publication_id
    assert repository.get(record.publication_id)["editorial"]["title"] == "Dato validado"
    assert repository.get(record.publication_id)["technical"]["copy_sources"] == {
        "claim_1": "reglas: sin modelo",
    }

    duplicate = await repository.create(_record("pub_other"), "plan-key", idempotency_request_hash="request-hash")
    assert duplicate["publication_id"] == record.publication_id
    assert (repository.root / "node_tech" / "2026" / "10" / "pub_test" / "plan.json").is_file()
    with pytest.raises(IdempotencyConflict):
        await repository.create(record, "plan-key", idempotency_request_hash="different-request")

    updated = await repository.update(record.publication_id, {"status": "failed"}, expected_record_version=1)
    assert updated["record_version"] == 2
    with pytest.raises(RepositoryConflict):
        await repository.update(record.publication_id, {"status": "approved"}, expected_record_version=1)

    repository.index_path.unlink()
    assert repository.get(record.publication_id) is None
    assert repository.repair_index() == 1
    assert repository.get(record.publication_id)["status"] == "failed"

    raw = _record("pub_bad").model_dump(mode="json")
    raw["unexpected"] = True
    with pytest.raises(ValidationError):
        await repository.create(raw)

    legacy = _record("pub_legacy").model_dump(mode="json")
    legacy["schema_version"] = 1
    legacy["editorial"].pop("strategy_id")
    legacy["technical"].pop("copy_sources")
    upgraded = await repository.create(legacy)
    assert upgraded["schema_version"] == 2
    assert upgraded["editorial"]["strategy_id"] is None
    assert upgraded["technical"]["copy_sources"] == {}


def _jpeg(color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (1080, 1350), color)
    stream = BytesIO()
    image.save(stream, format="JPEG", quality=80)
    return stream.getvalue()


def test_local_publication_media_is_immutable_and_rejects_traversal_and_symlinks(tmp_path):
    media = LocalPublicationMedia(tmp_path)
    first = _jpeg((10, 20, 30))
    digest = hashlib.sha256(first).hexdigest()
    key = "node_tech/2026/10/pub_test/slides/01.jpg"
    result = media.put(key, first, "image/jpeg", digest)
    assert result.sha256 == digest
    assert media.get(key).read() == first
    assert media.get(key, (0, 2)).read() == first[:3]
    with pytest.raises(FileExistsError):
        media.put(key, _jpeg((30, 20, 10)), "image/jpeg", hashlib.sha256(_jpeg((30, 20, 10))).hexdigest())
    with pytest.raises(ValueError):
        media.put("../outside.jpg", first, "image/jpeg", digest)
    with pytest.raises(ValueError):
        media.put("node_tech/a.jpg", first, "image/jpeg", "0" * 64)

    outside = tmp_path / "outside"
    outside.mkdir()
    media.root.mkdir(parents=True, exist_ok=True)
    (media.root / "link").symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError, match="symlinks"):
        media.put("link/file.jpg", first, "image/jpeg", digest)

    old_key, old_origin = settings.publisher_encryption_key, settings.public_app_url
    settings.publisher_encryption_key, settings.public_app_url = "test-signing-key", "https://example.org"
    try:
        with pytest.raises(ValueError, match="aprobación"):
            media.signed_url(key, "meta", 60, expected_sha256="0" * 64)
        signed = media.signed_url(key, "meta", 60)
        token = urlsplit(signed).path.rsplit("/", 1)[-1]
        assert media.resolve_signed_token(token, audience="meta")[0].read_bytes() == first
        with pytest.raises(ValueError, match="audiencia"):
            media.resolve_signed_token(token, audience="gallery")
    finally:
        settings.publisher_encryption_key, settings.public_app_url = old_key, old_origin


@pytest.mark.asyncio
async def test_publication_gallery_uses_authenticated_short_lived_asset_urls(tmp_path):
    old_values = (
        settings.app_env, settings.nexa_internal_token, settings.data_dir,
        settings.publisher_encryption_key, settings.public_app_url,
    )
    settings.app_env, settings.nexa_internal_token = "test", ""
    settings.data_dir = tmp_path
    settings.publisher_encryption_key, settings.public_app_url = "test-signing-key", "https://example.org"
    components = build_publication_components(data_dir=tmp_path)
    set_publication_components(components)
    app = FastAPI()
    app.include_router(publications.router, prefix="/api/v1")
    app.include_router(image_posts.router, prefix="/api/v1")
    client = TestClient(app)
    try:
        record = _record()
        content = _jpeg((25, 35, 45))
        digest = hashlib.sha256(content).hexdigest()
        slide = record.technical.slides[0].model_copy(update={"bytes": len(content), "sha256": digest})
        delivery = Delivery(
            delivery_id="del_gallery", revision=1, platform="facebook", account_alias="pagina_3",
            target_id="page-test", placement="image", idempotency_key="gallery-key",
            status=DeliveryStatus.PUBLISHED, created_at=NOW, updated_at=NOW, published_at=NOW,
        )
        record = record.model_copy(update={
            "status": PostStatus.COMPLETED,
            "technical": record.technical.model_copy(update={"slides": [slide]}),
            "deliveries": [delivery],
        })
        components.media.put(slide.storage_key, content, "image/jpeg", digest)
        await components.repository.create(record)

        listing = client.get("/api/v1/publications")
        strategy_listing = client.get("/api/v1/publications?strategy_id=cifra_que_frena")
        strategy_miss = client.get("/api/v1/publications?strategy_id=hilo_guardable")
        detail = client.get(f"/api/v1/publications/{record.publication_id}")
        asset = client.get(f"/api/v1/publications/{record.publication_id}/assets/{slide.asset_id}/url")

        assert listing.status_code == 200
        assert [item["strategy_id"] for item in strategy_listing.json()["items"]] == [
            "cifra_que_frena",
        ]
        assert strategy_miss.json()["items"] == []
        assert listing.json()["items"][0]["cover_url"].startswith(
            "https://example.org/api/v1/publish/instagram/media/"
        )
        assert detail.status_code == 200
        assert "storage_key" not in detail.json()["technical"]["slides"][0]
        assert asset.status_code == 200
        assert asset.json()["sha256"] == digest

        archived = components.media.root / slide.storage_key
        archived.write_bytes(_jpeg((60, 70, 80)))
        changed_cover = client.get("/api/v1/publications")
        changed_asset = client.get(
            f"/api/v1/publications/{record.publication_id}/assets/{slide.asset_id}/url"
        )
        changed_preview = client.get(f"/api/v1/image-posts/{record.post_id}/assets/{slide.asset_id}")
        assert changed_cover.json()["items"][0]["cover_url"] is None
        assert changed_asset.status_code == 503
        assert changed_preview.status_code == 503
        archived.write_bytes(content)

        components.media.delete(slide.storage_key, digest)
        missing_cover = client.get("/api/v1/publications")
        missing_asset = client.get(
            f"/api/v1/publications/{record.publication_id}/assets/{slide.asset_id}/url"
        )
        assert missing_cover.status_code == 200
        assert missing_cover.json()["items"][0]["cover_url"] is None
        assert missing_asset.status_code == 404
    finally:
        (settings.app_env, settings.nexa_internal_token, settings.data_dir,
         settings.publisher_encryption_key, settings.public_app_url) = old_values
        set_publication_components(None)


class FakePlanBuilder:
    def __call__(self, **request):
        return {
            "schema_version": 1,
            "plan_id": "plan_api", "category_id": request["category_id"],
            "source_video_id": request["source_video_id"], "source_revision": "video-r1",
            "style_id": "node_tech_rough", "style_version": "1.0.0",
            "template_id": request["template_id"], "format": "4:5",
            "slides": [{"slide_id": "slide_01", "order": 1, "layout": "dato",
                        "elements": [], "texts": [], "media": [],
                        "claim_refs": [{"id": "claim_1", "source_id": "source_1",
                                        "url": "https://example.org", "locator": "PLAN.md §3"}]}],
            "seed": request.get("seed") or 7, "renderer_version": "fake-1",
        }


@pytest.mark.asyncio
async def test_default_plan_builder_uses_verified_source_material(tmp_path, monkeypatch):
    from src.core.explainer import catalog

    monkeypatch.setenv("NEXA_IMAGE_COPY_MODEL", "off")  # textos por reglas: sin red ni modelo

    video_dir = tmp_path / "video"
    (video_dir / "assets" / "media").mkdir(parents=True)
    (video_dir / "PLAN.md").write_text(
        "## 3. Hechos verificados\n"
        "| # | hecho | fuente primaria | cotejo / uso |\n|---|---|---|---|\n"
        "| 1 | El sistema registró 37 segundos de margen. | https://example.org/report | Sí; dato observado y aprobado. |\n"
        "| 2 | El informe afirma una cifra de 999 mil millones. | https://example.org/report | Cifra cotejada, sin aprobación de uso. |\n"
        "## 4. Inventario visual\n"
        "| 2 | Una cifra sin fuente no se publica. | https://example.org/report | sí |\n",
        encoding="utf-8",
    )
    (video_dir / "assets" / "script.json").write_text(
        json.dumps({"segments": [{"id": "s01", "text": "El margen fue de treinta y siete segundos."}]}),
        encoding="utf-8",
    )
    (video_dir / "assets" / "media" / "CREDITS.md").write_text("Sin medios externos.\n", encoding="utf-8")
    (video_dir / "publish.json").write_text(json.dumps({
        "schema_version": 2,
        "titles": {"youtube": [{"option": "A", "text": "Un margen de 37 segundos", "strategy": 1,
                                  "emotion": "curiosidad"}],
                   "facebook": {"title": "Un margen de 37 segundos", "first_line": ""}, "chosen": "A"},
        "description": {"question": "¿Qué cambia un margen así?"},
        "sources": ["https://example.org/report"], "credits": ["Sin imágenes externas"],
        "tags": {"facebook": ["#tecnologia"]}, "pinned_comment": "¿Qué dato te sorprendió?",
    }), encoding="utf-8")
    monkeypatch.setattr(catalog, "find_video_dir", lambda _video_id: video_dir)
    monkeypatch.setattr(catalog, "load_video", lambda _path: SimpleNamespace(
        ready=True, category_path="node_tech", title="Video de prueba", topic="El margen de reacción",
    ))
    components = build_publication_components(data_dir=tmp_path / "data")
    with pytest.raises(ImagePostError, match="focus_claim_ids"):
        await components.service.create_plan({
            "category_id": "node_tech", "source_video_id": "video_test",
            "template_id": "daily_fact", "style_id": "node_tech_rough", "seed": 7,
            "focus_claim_ids": ["claim_2"],
        })
    plan, record = await components.service.create_plan({
        "category_id": "node_tech", "source_video_id": "video_test",
        "template_id": "daily_fact", "style_id": "node_tech_rough", "seed": 7,
    }, "source-plan-key")

    assert plan.slides[0].claim_refs[0].url == "https://example.org/report"
    assert "cotejo/uso aprobado: Sí; dato observado y aprobado." in plan.slides[0].claim_refs[0].locator
    texts = {item.role: item.value for item in plan.slides[0].texts}
    assert plan.slides[0].layout == "cifra_que_frena:hero"
    assert texts["stat"] == "37 segundos"
    assert texts["headline"].startswith("El sistema registró")
    assert record.editorial.title == "Un margen de 37 segundos"
    assert record.editorial.strategy_id == "cifra_que_frena"
    assert record.technical.copy_sources == {"claim_1": "reglas: modelo apagado"}
    assert "https://example.org/report" in record.editorial.copy_data.facebook.caption
    assert record.editorial.slides[0].alt_text_ig
    assert len(plan.slides[0].claim_refs) == 1
    assert plan.slides[0].claim_refs[0].id == "claim_1"


def test_image_posts_api_auth_and_idempotency(tmp_path):
    old_env, old_token, old_data_dir = settings.app_env, settings.nexa_internal_token, settings.data_dir
    settings.app_env, settings.nexa_internal_token, settings.data_dir = "test", "", tmp_path
    components = build_publication_components(data_dir=tmp_path, plan_builder=FakePlanBuilder())
    set_publication_components(components)
    app = FastAPI()
    app.include_router(image_posts.router, prefix="/api/v1")
    app.include_router(publications.router, prefix="/api/v1")
    client = TestClient(app)
    body = {
        "category_id": "node_tech", "source_video_id": "video_test",
        "template_id": "daily_fact", "style_id": "node_tech_rough", "seed": 7,
    }
    key = "00000000-0000-4000-8000-000000000123"
    try:
        strategies_response = client.get("/api/v1/image-posts/strategies")
        assert strategies_response.status_code == 200
        strategy_rows = strategies_response.json()
        assert {"cifra_que_frena", "hilo_guardable"} <= {item["id"] for item in strategy_rows}
        assert all(set(item) == {"id", "name", "description", "goal", "template_id", "facts_needed"}
                   for item in strategy_rows)
        first = client.post("/api/v1/image-posts/plans", json=body, headers={"Idempotency-Key": key})
        second = client.post("/api/v1/image-posts/plans", json=body, headers={"Idempotency-Key": key})
        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json()["post"]["publication_id"] == second.json()["post"]["publication_id"]
        assert "copy" in first.json()["post"]["editorial"]
        assert "copy_data" not in first.json()["post"]["editorial"]
        assert first.json()["post"]["editorial"]["strategy_id"] == "cifra_que_frena"
        invalid_strategy = client.post(
            "/api/v1/image-posts/plans", json={**body, "strategy_id": "hilo_guardable"},
            headers={"Idempotency-Key": "00000000-0000-4000-8000-000000000124"},
        )
        assert invalid_strategy.status_code == 422
        conflict = client.post(
            "/api/v1/image-posts/plans", json={**body, "style_id": "binary"},
            headers={"Idempotency-Key": key},
        )
        assert conflict.status_code == 409
        unauthenticated_app = FastAPI()
        unauthenticated_app.include_router(image_posts.router, prefix="/api/v1")
        settings.app_env = "production"
        protected = TestClient(unauthenticated_app).get("/api/v1/image-posts?category_id=node_tech")
        assert protected.status_code == 503
    finally:
        settings.app_env, settings.nexa_internal_token, settings.data_dir = old_env, old_token, old_data_dir
        set_publication_components(None)
        set_data_store(None)


class FakeMetaPublisher:
    async def publish_image_delivery(self, spec):
        assert spec.platform == "facebook"
        assert spec.media_keys
        assert len(spec.media_sha256) == len(spec.media_keys)
        assert all(len(digest) == 64 for digest in spec.media_sha256)
        return RemoteResult(photo_ids=["photo-fake"], post_id="post-fake",
                            permalink="https://example.org/post-fake",
                            comment_status="skipped_permission")


@pytest.mark.asyncio
async def test_publish_now_replay_launches_only_one_queue_task(tmp_path, monkeypatch):
    from src.core.schedule import engine, queue_repository

    old_data_dir = settings.data_dir
    settings.data_dir = tmp_path
    set_data_store(None)
    components = build_publication_components(
        data_dir=tmp_path,
        account_provider=lambda: [{"platform": "facebook", "alias": "pagina_3",
                                   "target_id": "page-test", "status": "ok"}],
    )
    set_publication_components(components)
    calls = 0

    async def publish_entry(*_args):
        nonlocal calls
        calls += 1

    monkeypatch.setattr(engine, "publish_entry", publish_entry)
    try:
        await components.repository.create(_record())
        delivery = (await components.service.schedule_deliveries(
            "pub_test", 1, [{"platform": "facebook", "account_alias": "pagina_3"}],
            "publish-now-test", immediate=True, request_idempotency_key="deliveries-test",
        ))[0]
        key = "00000000-0000-4000-8000-000000000225"
        first = await image_posts.publish_delivery_now(delivery.delivery_id, key)
        await asyncio.sleep(0)
        entry = queue_repository.find_for_delivery(delivery.delivery_id)
        assert entry is not None and entry.scheduled_at is not None
        assert entry in queue_repository.find_due(datetime.now(timezone.utc).isoformat())
        second = await image_posts.publish_delivery_now(delivery.delivery_id, key)
        assert first == second
        assert calls == 1
    finally:
        settings.data_dir = old_data_dir
        set_publication_components(None)
        set_data_store(None)


@pytest.mark.asyncio
async def test_queue_dispatches_image_delivery_through_fake_meta_port(tmp_path):
    from src.core.schedule import queue_repository
    from src.core.schedule.engine import publish_entry

    old_data_dir = settings.data_dir
    settings.data_dir = tmp_path
    set_data_store(None)
    components = build_publication_components(
        data_dir=tmp_path, publisher=FakeMetaPublisher(),
        account_provider=lambda: [{"platform": "facebook", "alias": "pagina_3",
                                   "target_id": "page-test", "status": "ok"}],
    )
    set_publication_components(components)
    try:
        record = await components.repository.create(_record())
        deliveries = await components.service.schedule_deliveries(
            record.publication_id, 1,
            [{"platform": "facebook", "account_alias": "pagina_3"}],
            "request-1", immediate=True, request_idempotency_key="request-key-1",
        )
        entry = queue_repository.get(deliveries[0].delivery_id)
        if entry is None:
            entry = next(item for item in queue_repository.list_entries(limit=20)[0]
                         if item.delivery_id == deliveries[0].delivery_id)
        result = await publish_entry(None, entry)
        assert result.job_id is None
        assert result.content_kind == "image"
        assert result.status.value == "published", result.error
        final = components.repository.get(record.publication_id)
        assert final.deliveries[0].remote.permalink == "https://example.org/post-fake"
        assert final.deliveries[0].status == DeliveryStatus.PUBLISHED
        replay = await components.service.schedule_deliveries(
            record.publication_id, 1,
            [{"platform": "facebook", "account_alias": "pagina_3"}],
            "request-1", immediate=True, request_idempotency_key="request-key-1",
        )
        assert len(replay) == 1
        assert replay[0].delivery_id == deliveries[0].delivery_id
        assert replay[0].status == DeliveryStatus.PUBLISHED
    finally:
        settings.data_dir = old_data_dir
        set_publication_components(None)
        set_data_store(None)


@pytest.mark.asyncio
async def test_plan_revision_cancels_pending_queue_and_gets_immutable_media_namespace(tmp_path):
    from src.core.schedule import queue_repository

    old_data_dir = settings.data_dir
    settings.data_dir = tmp_path
    set_data_store(None)
    components = build_publication_components(
        data_dir=tmp_path, account_provider=lambda: [{
            "platform": "facebook", "alias": "pagina_3", "target_id": "page-test", "status": "ok",
        }],
    )
    set_publication_components(components)
    try:
        original = await components.repository.create(_record())
        delivery = (await components.service.schedule_deliveries(
            original.publication_id, 1,
            [{"platform": "facebook", "account_alias": "pagina_3"}],
            "edit-before-send", immediate=True,
        ))[0]
        updated_plan = {
            "schema_version": 1, "plan_id": "plan_test", "category_id": "node_tech",
            "source_video_id": "video_test", "source_revision": "video-r2",
            "style_id": "node_tech_rough", "style_version": "1.0.0",
            "template_id": "daily_fact", "format": "4:5", "seed": 8,
            "renderer_version": "fake-1",
            "slides": [{
                "slide_id": "slide_01", "order": 1, "layout": "fact-card",
                "elements": [], "media": [],
                "claim_refs": [{"id": "claim_1", "source_id": "source_1",
                                "locator": "PLAN.md §3", "url": "https://example.org"}],
                "texts": [{"role": "headline", "value": "Un hecho verificado", "claim_refs": ["claim_1"]}],
            }],
        }
        current = await components.service.save_plan(updated_plan, expected_revision=1)
        previous = components.repository.get(original.publication_id)
        queue_entry = next(item for item in queue_repository.list_entries(limit=100)[0]
                           if item.delivery_id == delivery.delivery_id)

        assert current.publication_id != original.publication_id
        assert current.revision == 2
        assert current.technical.slides == []
        assert previous.status == PostStatus.CANCELLED
        assert previous.deliveries[0].status == DeliveryStatus.CANCELLED
        assert queue_entry.status.value == "cancelled"
    finally:
        settings.data_dir = old_data_dir
        set_publication_components(None)
        set_data_store(None)
