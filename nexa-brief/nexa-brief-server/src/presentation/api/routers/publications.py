"""Galería autorizada del archivo de publicaciones."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from src.adapters.data.publication_factory import get_publication_components
from src.adapters.publishing.image_publisher import get_image_publisher
from src.core.image_posts.models import PublicationRecord
from src.presentation.api.schemas.publications_schema import PublicationListResponse, SignedAssetResponse
from src.presentation.api.security import require_internal
from src.presentation.api.image_post_access import (
    ImageSession, has_account_restrictions, require_account_access,
    require_category_access, require_image_session,
)

router = APIRouter(
    prefix="/publications", tags=["publications"],
    dependencies=[Depends(require_internal), Depends(require_image_session)],
)


def _safe_record(record: PublicationRecord) -> dict[str, Any]:
    value = record.model_dump(mode="json")
    reel = value.get("technical", {}).get("reel")
    if isinstance(reel, dict):
        reel.pop("storage_key", None)
    for slide in value.get("technical", {}).get("slides", []):
        slide.pop("storage_key", None)
    for delivery in value.get("deliveries", []):
        error = delivery.get("last_error")
        if isinstance(error, dict):
            delivery["last_error"] = {key: error.get(key) for key in ("code", "message") if key in error}
    return value


def _record(publication_id: str) -> PublicationRecord | None:
    return get_publication_components().repository.get(publication_id)


@router.get("", response_model=PublicationListResponse)
async def list_publications(
    category_id: str | None = None,
    platform: str | None = None,
    account_alias: str | None = None,
    kind: str | None = None,
    strategy_id: str | None = None,
    placement: str | None = None,
    status: str | None = None,
    metric: str | None = None,
    window: str = "48h",
    sort: str = "desc",
    limit: int = 24,
    cursor: str | None = None,
    identity: ImageSession = Depends(require_image_session),
) -> dict[str, Any]:
    if category_id:
        require_category_access(identity, category_id)
    elif not identity.is_admin:
        raise HTTPException(status_code=403, detail="Elige una categoría autorizada para ver publicaciones.")
    if not identity.is_admin and category_id and has_account_restrictions(identity, category_id):
        if not platform or not account_alias:
            raise HTTPException(
                status_code=403, detail="Elige una cuenta autorizada para consultar esta galería."
            )
    if account_alias and category_id:
        require_account_access(identity, category_id, platform or "", account_alias)
        try:
            get_publication_components().resources.resolve_account(
                category_id, platform or "", account_alias
            )
        except LookupError as exc:
            raise HTTPException(status_code=403, detail="La cuenta no pertenece a esta categoría.") from exc
    filters = {
        key: value for key, value in {
            "category_id": category_id, "platform": platform, "account_alias": account_alias,
            "kind": kind, "placement": placement,
            "delivery_status": status if status is not None else ["published", "removal_pending_manual"],
            "strategy_id": strategy_id,
            "metric": metric, "window": window,
        }.items() if value is not None
    }
    try:
        page = get_publication_components().repository.list(filters, sort=sort, limit=limit, cursor=cursor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = []
    for summary in page.items:
        item = dict(summary)
        item.pop("record_key", None)
        item.pop("cover_key", None)
        visible_statuses = {status} if status else {"published", "removal_pending_manual"}
        restricted_account = bool(
            not identity.is_admin and category_id and has_account_restrictions(identity, category_id)
        )
        item["delivery_summaries"] = [
            delivery for delivery in item.get("delivery_summaries", [])
            if delivery.get("status") in visible_statuses
            and (not platform or delivery.get("platform") == platform)
            and (not account_alias or delivery.get("account_alias") == account_alias)
            and (not placement or delivery.get("placement") == placement)
            and (not restricted_account or (
                delivery.get("platform") == platform and delivery.get("account_alias") == account_alias
            ))
        ]
        record = _record(item["publication_id"])
        if record and record.technical.slides:
            slide = record.technical.slides[0]
            try:
                item["cover_url"] = get_publication_components().media.signed_url(
                    slide.storage_key, "meta", 300, expected_sha256=slide.sha256
                )
                item["cover_asset_id"] = slide.asset_id
                item["cover_sha256"] = slide.sha256
            except (ValueError, RuntimeError, FileNotFoundError):
                item["cover_url"] = None
        items.append(item)
    return {"items": items, "next_cursor": page.next_cursor, "as_of": page.as_of}


@router.get("/{publication_id}")
async def get_publication(
    publication_id: str, response: Response,
    identity: ImageSession = Depends(require_image_session),
) -> dict[str, Any]:
    record = _record(publication_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    require_category_access(identity, record.editorial.category_id)
    for delivery in record.deliveries:
        require_account_access(
            identity, record.editorial.category_id, delivery.platform, delivery.account_alias
        )
    response.headers["ETag"] = f'"{record.record_version}"'
    return _safe_record(record)


@router.get("/{publication_id}/assets/{asset_id}/url", response_model=SignedAssetResponse)
async def get_asset_url(
    publication_id: str, asset_id: str, purpose: str = Query(default="preview"),
    identity: ImageSession = Depends(require_image_session),
) -> dict[str, Any]:
    if purpose not in {"preview", "export"}:
        raise HTTPException(status_code=422, detail="purpose debe ser preview o export")
    record = _record(publication_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    require_category_access(identity, record.editorial.category_id)
    for delivery in record.deliveries:
        require_account_access(
            identity, record.editorial.category_id, delivery.platform, delivery.account_alias
        )
    slide = next((item for item in record.technical.slides if item.asset_id == asset_id), None)
    asset = slide or (record.technical.reel if record.technical.reel and record.technical.reel.asset_id == asset_id else None)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    ttl = 300 if purpose == "preview" else 900
    try:
        # La firma se emite tras auth interna y usa el GET público existente de medios.
        url = get_publication_components().media.signed_url(
            asset.storage_key, "meta", ttl, expected_sha256=asset.sha256
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Asset not found") from exc
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="No se pudo firmar el medio") from exc
    return {
        "url": url, "expires_at": datetime.now(timezone.utc) + timedelta(seconds=ttl),
        "mime": asset.mime, "sha256": asset.sha256,
    }


@router.get("/{publication_id}/metrics")
async def get_publication_metrics(
    publication_id: str, delivery_id: str | None = None, window: str | None = None,
    identity: ImageSession = Depends(require_image_session),
) -> dict[str, Any]:
    record = _record(publication_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    require_category_access(identity, record.editorial.category_id)
    if delivery_id:
        delivery = next((item for item in record.deliveries if item.delivery_id == delivery_id), None)
        if delivery:
            require_account_access(
                identity, record.editorial.category_id, delivery.platform, delivery.account_alias
            )
    else:
        for delivery in record.deliveries:
            require_account_access(
                identity, record.editorial.category_id, delivery.platform, delivery.account_alias
            )
    if delivery_id and not any(delivery.delivery_id == delivery_id for delivery in record.deliveries):
        raise HTTPException(status_code=404, detail="Delivery not found")
    snapshots = [
        item.model_dump(mode="json") for item in record.metrics_snapshots
        if (delivery_id is None or item.delivery_id == delivery_id)
        and (window is None or item.window == window)
    ]
    snapshots.sort(key=lambda item: item["observed_at"])
    return {"items": snapshots}


@router.post("/{publication_id}/remove")
async def remove_publication(
    publication_id: str, body: dict[str, Any],
    identity: ImageSession = Depends(require_image_session),
) -> dict[str, Any]:
    record = _record(publication_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    require_category_access(identity, record.editorial.category_id)
    for delivery in record.deliveries:
        require_account_access(identity, record.editorial.category_id, delivery.platform, delivery.account_alias)
    try:
        updated = await get_publication_components().service.remove_publication(
            publication_id, str(body.get("reason") or ""), get_image_publisher()
        )
    except Exception as exc:
        from src.core.image_posts.service import ImagePostError

        if isinstance(exc, ImagePostError):
            raise HTTPException(
                status_code=exc.status_code, detail={"code": exc.code, "message": str(exc)}
            ) from exc
        raise
    return _safe_record(updated)


@router.delete("/{publication_id}", status_code=status.HTTP_204_NO_CONTENT)
async def purge_publication(
    publication_id: str, identity: ImageSession = Depends(require_image_session)
) -> Response:
    if not identity.is_admin:
        raise HTTPException(status_code=403, detail="La purga legal requiere una sesión administradora.")
    components = get_publication_components()
    try:
        deleted = await components.service.purge_publication(
            publication_id, policy="authorized_legal_purge"
        )
    except Exception as exc:
        from src.core.image_posts.service import ImagePostError

        if isinstance(exc, ImagePostError):
            raise HTTPException(
                status_code=exc.status_code,
                detail={"code": exc.code, "message": str(exc)},
            ) from exc
        raise
    if not deleted:
        raise HTTPException(status_code=404, detail="Publication not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
