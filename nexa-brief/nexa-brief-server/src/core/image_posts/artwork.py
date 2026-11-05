"""Editable artwork previews and immutable JPEG revisions, without publishing.

The preview and export share the same image renderer. Format changes preserve
editorial copy and sources, produce a new reviewable revision and never overwrite
approved media. This module intentionally has no social-network clients.
"""

from __future__ import annotations

import asyncio
import dataclasses
import hashlib
from typing import TYPE_CHECKING, Any

from .errors import ImagePostError
from .models import DeliveryStatus, EditorialReview, PostStatus, PublicationRecord, RenderedSlide, ValidationResult, FormatArtwork
from .profiles import get_image_profile

if TYPE_CHECKING:
    from .service import ImagePostService

_export_locks: dict[str, asyncio.Lock] = {}
_LOCKED_DELIVERIES = {
    DeliveryStatus.QUEUED,
    DeliveryStatus.PUBLISHING,
    DeliveryStatus.OUTCOME_UNKNOWN,
    DeliveryStatus.PUBLISHED,
    DeliveryStatus.REMOVED_API,
    DeliveryStatus.REMOVED_MANUALLY,
    DeliveryStatus.REMOVED,
    DeliveryStatus.REMOVAL_PENDING_MANUAL,
}


def latest_post_revision(service: ImagePostService, record: PublicationRecord) -> PublicationRecord:
    matches = [record]
    for row in service._all_summaries({"category_id": record.editorial.category_id}):
        if row.get("post_id") and row["post_id"] != record.post_id:
            continue
        candidate = service.repository.get(row["publication_id"])
        if candidate and candidate.post_id == record.post_id:
            matches.append(candidate)
    return max(matches, key=lambda row: (row.revision, row.created_at))


def validate_target_format(record: PublicationRecord, platform: str) -> None:
    """Reject incompatible formats before a delivery is queued or any API is called."""
    if platform not in {"facebook", "instagram", "tiktok"}:
        raise ImagePostError(
            "UNSUPPORTED_IMAGE_PLATFORM", "Este canal no tiene habilitada la publicación de fotos", 422
        )
    profile = get_image_profile(record.technical.composition_plan.format)
    if platform == "instagram" and profile.format != "4:5":
        raise ImagePostError(
            "UNSUPPORTED_IMAGE_RATIO", "El feed de Instagram requiere 4:5. Revisa ese formato antes de publicar.", 422
        )
    if not record.technical.slides or any(
        (slide.width, slide.height) != profile.size for slide in record.technical.slides
    ):
        raise ImagePostError(
            "IMAGE_FORMAT_NOT_EXPORTED", "Exporta y revisa el formato seleccionado antes de publicar", 422
        )


class ImagePostArtwork:
    def __init__(self, service: ImagePostService):
        self.service = service

    @staticmethod
    def _profile(format: str):
        try:
            return get_image_profile(format)
        except ValueError as exc:
            raise ImagePostError("INVALID_IMAGE_FORMAT", str(exc), 422) from exc

    def _source(self, record: PublicationRecord, format: str):
        from .service import _parse_plan, _cached_media
        from .render import RENDERER_VERSION

        profile = self._profile(format)
        plan = dataclasses.replace(
            _parse_plan(record.technical.composition_plan), format=profile.format, renderer_version=RENDERER_VERSION
        )
        style = self.service._style(plan.category_id, plan.style_id)
        if style.version != plan.style_version:
            raise ImagePostError(
                "STYLE_VERSION_CHANGED", "El estilo cambió; revisa el diseño antes de volver a exportar", 409
            )
        return plan, style, _cached_media(plan, self.service.image_cache)

    async def preview(self, record: PublicationRecord, format: str, slide_id: str | None) -> dict[str, Any]:
        from .render import build_preview_html, renderer_source_hash
        from .plan import plan_hash

        plan, style, media = self._source(record, format)
        slide_id = slide_id or (plan.slides[0].slide_id if plan.slides else None)
        if not slide_id or not any(slide.slide_id == slide_id for slide in plan.slides):
            raise ImagePostError("SLIDE_NOT_FOUND", "La lámina no tiene un diseño editable disponible", 404)
        try:
            html = await asyncio.to_thread(build_preview_html, plan, style, media, slide_id=slide_id, format=format)
        except (ValueError, RuntimeError) as exc:
            raise ImagePostError("PREVIEW_UNAVAILABLE", str(exc), 422) from exc
        profile = self._profile(format)
        return {
            "html": html,
            **profile.to_dict(),
            "revision": record.revision,
            "plan_hash": plan_hash(plan, style),
            "slide_id": slide_id,
            "source_hash": renderer_source_hash(plan, style),
        }

    async def export(self, record: PublicationRecord, revision: int, format: str) -> PublicationRecord:
        lock = _export_locks.setdefault(record.post_id, asyncio.Lock())
        async with lock:
            return await self._export(record, revision, format)

    async def export_variant(self, record: PublicationRecord, revision: int, format: str) -> PublicationRecord:
        lock = _export_locks.setdefault(record.post_id, asyncio.Lock())
        async with lock:
            return await self._export(record, revision, format, variant=True)

    async def _export(self, record: PublicationRecord, revision: int, format: str, *, variant: bool = False) -> PublicationRecord:
        from .service import _id, _now, _field, _jsonable
        from .render import render_async, renderer_source_hash, RENDERER_VERSION
        from .plan import plan_hash

        self._profile(format)
        latest = latest_post_revision(self.service, record)
        if latest.publication_id != record.publication_id or latest.revision != revision:
            raise ImagePostError("REVISION_CONFLICT", "Hay una revisión más reciente; vuelve a abrir el post", 409)
        record = self.service.repository.get(record.publication_id) or record
        if record.revision != revision:
            raise ImagePostError("REVISION_CONFLICT", status_code=409)
        if any(delivery.status in _LOCKED_DELIVERIES for delivery in record.deliveries):
            raise ImagePostError(
                "IMAGE_FORMAT_LOCKED", "El archivo publicado o enviado conserva su formato original", 409
            )
        if record.status == PostStatus.RENDERING:
            raise ImagePostError("RENDER_IN_PROGRESS", "Hay una exportación en curso para este post", 409)
        plan, style, media = self._source(record, format)
        fingerprint = renderer_source_hash(plan, style)
        existing = record.technical.format_exports.get(format)
        if variant and existing and existing.revision == revision and existing.source_hash == fingerprint:
            return record
        if (
            record.technical.composition_plan.format == format
            and record.technical.slides
            and record.technical.render.source_hash == fingerprint
            and record.technical.render.renderer_version == RENDERER_VERSION
            and record.technical.validations
            and all(item.passed for item in record.technical.validations)
        ):
            return record
        # Format changes never invoke an AI repair or rewrite approved editorial text.
        renderer = self.service._renderer() if self.service.renderer else render_async
        try:
            result = await self.service._invoke(
                renderer.render if hasattr(renderer, "render") else renderer, plan, style, media
            )
        except (ValueError, RuntimeError) as exc:
            raise ImagePostError("IMAGE_EXPORT_FAILED", str(exc), 422) from exc
        manifest = result.to_record(plan) if hasattr(result, "to_record") else _jsonable(result)
        technical_manifest = manifest.get("technical", manifest)
        assets = _field(result, "assets") or technical_manifest.get("slides") or []
        validations = [ValidationResult.model_validate(row) for row in technical_manifest.get("validations", [])]
        if (
            len(assets) != len(plan.slides)
            or not assets
            or not validations
            or any(not item.passed for item in validations)
        ):
            raise ImagePostError("INVALID_IMAGE", "La exportación no superó las verificaciones de calidad", 422)
        if renderer_source_hash(plan, style) != fingerprint:
            raise ImagePostError(
                "REVISION_CONFLICT", "El motor cambió durante la exportación; vuelve a revisar el diseño", 409
            )
        # Re-read after rendering so concurrent caption edits/deliveries cannot be lost.
        fresh = self.service.repository.get(record.publication_id)
        if (
            fresh is None
            or fresh.record_version != record.record_version
            or latest_post_revision(self.service, fresh).publication_id != record.publication_id
        ):
            raise ImagePostError("REVISION_CONFLICT", "El post cambió durante la exportación; vuelve a revisarlo", 409)
        publication_id, now = _id("pub"), _now()
        profile = self._profile(format)
        prefix = f"{record.editorial.category_id}/{now:%Y/%m}/{publication_id}/slides"
        slides = []
        from .validate import validate_jpeg

        for index, asset in enumerate(assets, 1):
            content = _field(asset, "content") or _field(asset, "data") or _field(asset, "bytes_data")
            if not isinstance(content, bytes):
                raise ImagePostError("INVALID_IMAGE", "La exportación debe devolver bytes JPEG", 422)
            width, height = _field(asset, "width", profile.width), _field(asset, "height", profile.height)
            if (width, height) != profile.size:
                raise ImagePostError("INVALID_IMAGE", "Las dimensiones exportadas no coinciden con el formato", 422)
            try:
                validate_jpeg(content, style, expected_size=profile.size, qc=_field(asset, "qc") or None).require()
            except ValueError as exc:
                raise ImagePostError("INVALID_IMAGE", str(exc), 422) from exc
            digest = hashlib.sha256(content).hexdigest()
            if _field(asset, "sha256") and _field(asset, "sha256") != digest:
                raise ImagePostError("INVALID_IMAGE", "El hash de la exportación no coincide", 422)
            saved = self.service.media.put(f"{prefix}/{index:02}.jpg", content, "image/jpeg", digest, if_absent=True)
            slides.append(
                RenderedSlide(
                    slide_id=plan.slides[index - 1].slide_id,
                    order=index,
                    asset_id=f"asset_{digest[:24]}",
                    storage_key=saved.key,
                    width=profile.width,
                    height=profile.height,
                    aspect_ratio=profile.format,
                    bytes=saved.bytes,
                    sha256=saved.sha256,
                    rendered_at=now,
                )
            )
        plan_data = plan.to_dict()
        plan_data["plan_hash"] = plan_hash(plan, style)
        technical = record.technical.model_copy(
            update={
                "composition_plan": type(record.technical.composition_plan).model_validate(plan_data),
                "slides": slides,
                "validations": validations,
                "reel": None,
                "render": type(record.technical.render).model_validate(
                    {
                        **technical_manifest.get("render", {}),
                        "renderer_version": RENDERER_VERSION,
                        "source_hash": fingerprint,
                    }
                ),
            }
        )
        if variant:
            exported = FormatArtwork(
                revision=revision, source_hash=fingerprint, renderer_version=RENDERER_VERSION,
                slides=slides, validations=validations,
            )
            current_technical = fresh.technical.model_copy(update={
                "format_exports": {**fresh.technical.format_exports, format: exported},
            })
            return await self.service.repository.update(record.publication_id, {
                "technical": current_technical.model_dump(mode="json"),
            }, fresh.record_version)
        technical = technical.model_copy(update={"format_exports": {}})
        changed = record.model_copy(
            update={
                "publication_id": publication_id,
                "revision": revision + 1,
                "record_version": 1,
                "supersedes_publication_id": record.publication_id,
                "created_at": now,
                "updated_at": now,
                "status": PostStatus.READY_FOR_REVIEW,
                "deliveries": [],
                "metrics_snapshots": [],
                "technical": technical,
                "editorial": record.editorial.model_copy(update={"review": EditorialReview(required=True)}),
            }
        )
        request_hash = hashlib.sha256(
            f"{record.publication_id}:{revision}:{format}:{fingerprint}:{plan_data['plan_hash']}".encode()
        ).hexdigest()
        saved = await self.service.repository.create(
            changed, f"artwork:{request_hash}", idempotency_request_hash=request_hash
        )
        await self.service._emit(
            "image_post_changed", {"publication_id": saved.publication_id, "status": saved.status.value}
        )
        return saved


def target_artwork(service: ImagePostService, record: PublicationRecord, platform: str, format: str | None):
    selected = format or record.technical.composition_plan.format
    if selected == record.technical.composition_plan.format:
        validate_target_format(record, platform)
        return record.technical.slides
    profile = get_image_profile(selected)
    if platform == "instagram" and selected != "4:5":
        raise ImagePostError("UNSUPPORTED_IMAGE_RATIO", "El feed de Instagram requiere 4:5", 422)
    artwork = record.technical.format_exports.get(selected)
    plan, style, _media = ImagePostArtwork(service)._source(record, selected)
    from .render import renderer_source_hash, RENDERER_VERSION
    if (not artwork or artwork.revision != record.revision
            or artwork.renderer_version != RENDERER_VERSION
            or artwork.source_hash != renderer_source_hash(plan, style)
            or not artwork.validations or any(not item.passed for item in artwork.validations)
            or len(artwork.slides) != len(record.technical.slides)
            or any((slide.width, slide.height) != profile.size for slide in artwork.slides)):
        raise ImagePostError("IMAGE_FORMAT_NOT_EXPORTED", "Prepara y revisa el JPEG de cada formato antes de publicar", 422)
    return artwork.slides
