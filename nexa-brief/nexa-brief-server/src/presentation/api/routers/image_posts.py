"""API interna del editor de publicaciones de imagen."""

from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from src.adapters.data.publication_factory import get_publication_components
from src.adapters.data.licensed_reel_music import LicensedReelMusic
from src.core.image_posts.models import PublicationRecord
from src.core.image_posts.service import ImagePostError, ImagePostService
from src.presentation.api.schemas.image_posts_schema import (
    CreateDeliveriesRequest, ImagePostPatchRequest, PlanCreateRequest,
    PlanUpdateRequest, ReconcileRequest, RenderRequest, ReviewRequest,
)
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/image-posts", tags=["image-posts"], dependencies=[Depends(require_internal)])
_publish_tasks: set[asyncio.Task] = set()


def get_image_post_service() -> ImagePostService:
    return get_publication_components().service


@router.get("/music")
async def list_licensed_music() -> dict[str, Any]:
    """Solo expone pistas locales cuya licencia y hash fueron verificados."""
    catalog = get_image_post_service().music_catalog or LicensedReelMusic()
    tracks = []
    for row in catalog.list():
        safe = {key: row[key] for key in ("music_asset_id", "title", "author", "source_sha256", "license")}
        tracks.append(safe)
    return {"tracks": tracks}


def _raise(exc: Exception) -> None:
    if isinstance(exc, ImagePostError):
        raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": str(exc)}) from exc
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_NOT_LINKED", "message": str(exc)}) from exc
    if isinstance(exc, ValueError):
        message = str(exc)
        code = (
            "REVISION_CONFLICT" if "REVISION_CONFLICT" in message else
            "IDEMPOTENCY_CONFLICT" if "Idempotency-Key" in message else "INVALID_PLAN"
        )
        raise HTTPException(status_code=409 if code in {"REVISION_CONFLICT", "IDEMPOTENCY_CONFLICT"} else 422,
                            detail={"code": code, "message": str(exc)}) from exc
    raise exc


def _record(service: ImagePostService, identifier: str) -> PublicationRecord | None:
    direct = service.get(identifier)
    if direct:
        return direct
    for item in service._all_summaries():
        record = service.get(item["publication_id"])
        if record and (record.post_id == identifier or record.technical.composition_plan.plan_id == identifier):
            return record
    return None


def _post_json(record: PublicationRecord) -> dict[str, Any]:
    result = record.model_dump(mode="json")
    reel = result.get("technical", {}).get("reel")
    if isinstance(reel, dict):
        reel.pop("storage_key", None)
    for slide in result.get("technical", {}).get("slides", []):
        asset_id = slide.get("asset_id")
        slide.pop("storage_key", None)
        slide["preview_url"] = f"/api/v1/image-posts/{record.post_id}/assets/{asset_id}"
    return result


def _idempotency_key(value: str | None, *, required: bool = False) -> str | None:
    if not value:
        if required:
            raise HTTPException(status_code=400, detail="Idempotency-Key es obligatorio")
        return None
    import uuid
    try:
        return str(uuid.UUID(value))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Idempotency-Key debe ser UUID") from exc


@router.get("/styles")
async def list_styles(category_id: str) -> dict[str, Any]:
    try:
        return {"styles": get_image_post_service().get_styles(category_id)}
    except Exception as exc:
        _raise(exc)


@router.get("/strategies")
async def list_strategies() -> list[dict[str, Any]]:
    from src.core.image_posts import strategies

    return [
        {
            "id": strategy.id,
            "name": strategy.name,
            "description": strategy.description,
            "goal": strategy.goal,
            "template_id": strategy.template_id,
            "facts_needed": strategy.facts_needed,
        }
        for strategy in strategies.list_strategies()
    ]


@router.get("/capabilities")
async def get_capabilities(category_id: str) -> dict[str, Any]:
    try:
        return get_image_post_service().capabilities(category_id)
    except Exception as exc:
        _raise(exc)


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreateRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    try:
        plan, record = await get_image_post_service().create_plan(
            body.model_dump(exclude_none=True), _idempotency_key(idempotency_key, required=True)
        )
        return {"plan": plan.to_dict(), "post": _post_json(record),
                "validation": {"errors": [], "warnings": []}}
    except Exception as exc:
        _raise(exc)


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: str, body: PlanUpdateRequest,
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> dict[str, Any]:
    try:
        plan = body.model_dump(mode="json")
        if plan.get("plan_id") != plan_id:
            raise ImagePostError("INVALID_PLAN", "plan_id de la ruta y del cuerpo no coinciden")
        if not if_match:
            raise HTTPException(status_code=428, detail="If-Match es obligatorio")
        try:
            expected_revision = int(if_match.strip('"'))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="If-Match debe contener la revisión") from exc
        record = await get_image_post_service().save_plan(plan, expected_revision)
        return {"plan": record.technical.composition_plan, "post": _post_json(record),
                "validation": {"errors": [], "warnings": []}}
    except Exception as exc:
        _raise(exc)


@router.post("/plans/{plan_id}/render", status_code=status.HTTP_202_ACCEPTED)
async def render_plan(plan_id: str, body: RenderRequest) -> dict[str, Any]:
    try:
        record = await get_image_post_service().start_render(plan_id, review_required=body.review_required)
        return {"post_id": record.post_id, "publication_id": record.publication_id,
                "status": record.status.value if hasattr(record.status, "value") else record.status}
    except Exception as exc:
        _raise(exc)


@router.get("")
async def list_image_posts(
    category_id: str | None = None,
    post_status: str | None = Query(default=None, alias="status"),
    limit: int = 24,
    cursor: str | None = None,
) -> dict[str, Any]:
    try:
        page = get_image_post_service().list(
            {key: value for key, value in {"category_id": category_id, "status": post_status}.items() if value},
            limit=limit, cursor=cursor,
        )
        items = []
        for summary in page.items:
            record = get_image_post_service().get(summary["publication_id"])
            if record:
                items.append(_post_json(record))
        return {"items": items, "next_cursor": page.next_cursor, "as_of": page.as_of}
    except Exception as exc:
        _raise(exc)


@router.get("/{post_id}")
async def get_image_post(post_id: str) -> dict[str, Any]:
    record = _record(get_image_post_service(), post_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Image post not found")
    return _post_json(record)


@router.patch("/{post_id}")
async def patch_image_post(
    post_id: str,
    body: ImagePostPatchRequest,
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> dict[str, Any]:
    service = get_image_post_service()
    record = _record(service, post_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Image post not found")
    if if_match and if_match.strip('"') not in {str(record.record_version), str(record.revision)}:
        raise HTTPException(status_code=409, detail={"code": "REVISION_CONFLICT"})
    try:
        saved = await service.patch_post(record.publication_id, body.model_dump(exclude_unset=True, mode="json"))
        return _post_json(saved)
    except Exception as exc:
        _raise(exc)


@router.post("/{post_id}/review")
async def review_image_post(post_id: str, body: ReviewRequest) -> dict[str, Any]:
    service = get_image_post_service()
    record = _record(service, post_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Image post not found")
    try:
        saved = await service.review(record.publication_id, body.revision, body.decision, body.note)
        return _post_json(saved)
    except Exception as exc:
        _raise(exc)


@router.post("/{post_id}/deliveries", status_code=status.HTTP_201_CREATED)
async def create_deliveries(
    post_id: str,
    body: CreateDeliveriesRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    service = get_image_post_service()
    record = _record(service, post_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Image post not found")
    key = _idempotency_key(idempotency_key, required=True)
    try:
        times = [target.scheduled_at for target in body.targets]
        if any(value is None for value in times) and any(value is not None for value in times):
            raise ImagePostError("INVALID_PLAN", "No se mezclan entregas inmediatas y programadas")
        deliveries = await service.schedule_deliveries(
            record.publication_id, body.revision,
            [target.model_dump(mode="json") for target in body.targets],
            body.client_request_id or key, immediate=all(value is None for value in times),
            request_idempotency_key=key,
        )
        return {"deliveries": [delivery.model_dump(mode="json") for delivery in deliveries]}
    except Exception as exc:
        _raise(exc)


def _publish_done(task: asyncio.Task) -> None:
    _publish_tasks.discard(task)
    if not task.cancelled():
        try:
            task.result()
        except Exception:
            pass


@router.post("/deliveries/{delivery_id}/publish-now", status_code=status.HTTP_202_ACCEPTED)
async def publish_delivery_now(
    delivery_id: str,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    from src.core.schedule import engine, queue_repository

    key = _idempotency_key(idempotency_key, required=True)
    service = get_image_post_service()
    record, delivery = service._find_delivery(delivery_id)
    if record is None or delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    request_key = f"publish-now:{delivery_id}:{key}"
    request_hash = hashlib.sha256(
        json.dumps({"delivery_id": delivery_id}, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    try:
        previous = service.repository.get_request(request_key, request_hash)
        if previous:
            return previous["delivery"]
    except Exception as exc:
        _raise(exc)
    try:
        delivery = await service.publish_now(delivery_id)
    except Exception as exc:
        _raise(exc)
    queue_entry = queue_repository.find_for_delivery(delivery_id)
    if queue_entry is None:
        raise HTTPException(status_code=409, detail="Delivery no está en la cola")
    response_data = delivery.model_dump(mode="json")
    try:
        is_first, receipt = service.repository.store_request_once(
            request_key, request_hash, {"delivery": response_data}
        )
    except Exception as exc:
        _raise(exc)
    if is_first:
        task = asyncio.create_task(engine.publish_entry(None, queue_entry))
        _publish_tasks.add(task)
        task.add_done_callback(_publish_done)
    return receipt["delivery"]


@router.post("/deliveries/{delivery_id}/cancel")
async def cancel_delivery(delivery_id: str) -> dict[str, Any]:
    try:
        delivery = await get_image_post_service().cancel_delivery(delivery_id)
        return delivery.model_dump(mode="json")
    except Exception as exc:
        _raise(exc)


@router.post("/deliveries/{delivery_id}/reconcile")
async def reconcile_delivery(delivery_id: str, body: ReconcileRequest) -> dict[str, Any]:
    """Reintento manual de consulta remota, autenticado y sin publicar otra vez."""
    try:
        delivery = await get_image_post_service().reconcile_delivery(
            delivery_id, manual=True, remote_post_id=body.remote_post_id,
        )
        return delivery.model_dump(mode="json")
    except Exception as exc:
        _raise(exc)


@router.get("/deliveries/{delivery_id}")
async def get_delivery(delivery_id: str) -> dict[str, Any]:
    _record_obj, delivery = get_image_post_service()._find_delivery(delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return delivery.model_dump(mode="json")


@router.get("/{post_id}/assets/{asset_id}")
async def get_preview_asset(post_id: str, asset_id: str) -> StreamingResponse:
    service = get_image_post_service()
    record = _record(service, post_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Image post not found")
    slide = next((item for item in record.technical.slides if item.asset_id == asset_id), None)
    if slide is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    try:
        stream = get_publication_components().media.get(slide.storage_key)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Asset not found") from exc
    content = stream.read()
    if hashlib.sha256(content).hexdigest() != slide.sha256.lower():
        raise HTTPException(status_code=503, detail="El JPEG archivado cambió desde su aprobación")
    from io import BytesIO
    stream = BytesIO(content)
    return StreamingResponse(stream, media_type="image/jpeg", headers={"ETag": f'"{slide.sha256}"'})
