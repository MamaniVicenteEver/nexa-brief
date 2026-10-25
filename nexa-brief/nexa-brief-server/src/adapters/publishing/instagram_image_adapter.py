"""Publicación de fotos y carruseles en Instagram Graph API."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import inspect
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx

from src.adapters.publishing.image_publisher import (
    ClientFactory,
    DeliverySpec,
    MetaGraphError,
    ProgressCallback,
    ProgressPersistenceError,
    ImageAdapterResult,
    caption_for,
    classify_graph_error,
    copy_validation_error,
    delivery_assets,
    graph_json,
    remote_state,
    report_remote,
    storage_key,
    value,
    alt_text,
)
from src.adapters.publishing.instagram_media_url import create_signed_media_url
from src.config.settings import settings

_GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_api_version}"
_MAX_CAROUSEL_SLIDES = 5


class InstagramImageAdapter:
    """Crea hijos, padre, espera `FINISHED` y publica una sola vez."""

    PLATFORM = "instagram"

    def __init__(
        self,
        token_manager: Any,
        media_storage: Any,
        *,
        client_factory: ClientFactory | None = None,
        poll_interval_seconds: float = 1.0,
        processing_timeout_seconds: float = 120.0,
    ) -> None:
        self._token_manager = token_manager
        self._media_storage = media_storage
        self._client_factory = client_factory or httpx.AsyncClient
        self._poll_interval_seconds = poll_interval_seconds
        self._processing_timeout_seconds = processing_timeout_seconds

    async def _signed_url(self, asset: Any) -> str:
        key = storage_key(asset)
        expected_hash = value(asset, "sha256")
        if expected_hash:
            getter = getattr(self._media_storage, "get", None)
            if getter is None:
                raise ValueError("Instagram publishing needs readable approved media")
            content = getter(key)
            if inspect.isawaitable(content):
                content = await content
            if hasattr(content, "read"):
                content = content.read()
            if inspect.isawaitable(content):
                content = await content
            if not isinstance(content, (bytes, bytearray)) or not hmac.compare_digest(
                hashlib.sha256(content).hexdigest(), str(expected_hash).lower()
            ):
                raise ValueError("Stored JPEG hash does not match the approved asset")
        signer = getattr(self._media_storage, "signed_url", None)
        if signer is None:
            return create_signed_media_url(key, ttl_seconds=900, expected_sha256=expected_hash)
        try:
            result = signer(key, audience="meta", ttl=900, expected_sha256=expected_hash)
        except TypeError:
            try:
                result = signer(key, audience="meta", ttl=900)
            except TypeError:
                result = signer(key, audience="meta", ttl_seconds=900)
        if inspect.isawaitable(result):
            result = await result
        if isinstance(result, dict):
            result = result.get("url")
        elif not isinstance(result, str) and hasattr(result, "url"):
            result = result.url
        url = str(result or "")
        if not url.startswith("https://"):
            raise ValueError("Meta media URL must be public HTTPS")
        return url

    async def _create_container(
        self,
        client: httpx.AsyncClient,
        instagram_id: str,
        token: str,
        asset: Any,
        *,
        carousel_item: bool,
        caption: str = "",
    ) -> str:
        data: dict[str, Any] = {"image_url": await self._signed_url(asset)}
        if carousel_item:
            data["is_carousel_item"] = "true"
        if caption:
            data["caption"] = caption
        alt = alt_text(asset, self.PLATFORM)
        if alt:
            data["alt_text_custom"] = alt
        payload = await graph_json(
            client,
            "POST",
            f"{quote(instagram_id, safe='')}/media",
            token=token,
            data=data,
        )
        container_id = payload.get("id")
        if not container_id:
            raise MetaGraphError(200, None, "Instagram did not return a container ID", None)
        return str(container_id)

    async def _wait_until_finished(
        self,
        client: httpx.AsyncClient,
        container_id: str,
        token: str,
    ) -> None:
        deadline = time.monotonic() + self._processing_timeout_seconds
        while True:
            payload = await graph_json(
                client,
                "GET",
                quote(container_id, safe=""),
                token=token,
                params={"fields": "id,status_code,status"},
            )
            status = str(payload.get("status_code") or "").upper()
            if status == "FINISHED":
                return
            if status in {"ERROR", "EXPIRED"}:
                raise MetaGraphError(400, status, str(payload.get("status") or status), None)
            if time.monotonic() >= deadline:
                raise TimeoutError("Instagram container did not reach FINISHED")
            await asyncio.sleep(self._poll_interval_seconds)

    async def publish_image_delivery(
        self,
        delivery_spec: DeliverySpec,
        *,
        on_remote_update: ProgressCallback | None = None,
    ) -> ImageAdapterResult:
        alias = str(value(delivery_spec, "account_alias", ""))
        instagram_id = str(value(delivery_spec, "target_id") or self._token_manager.target_id(self.PLATFORM, alias))
        placement = str(value(delivery_spec, "placement", "image"))
        assets = delivery_assets(delivery_spec)
        copy_error = copy_validation_error(delivery_spec)
        if copy_error:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "COPY_LIMIT", "message": copy_error},
            )
        expected_count = _MAX_CAROUSEL_SLIDES if placement == "carousel" else 1
        if placement not in {"image", "carousel"} or len(assets) != expected_count:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "INVALID_IMAGE_COUNT", "message": "Instagram expects one JPEG or five carousel JPEGs"},
            )
        if not alias or not instagram_id:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "ACCOUNT_NOT_LINKED", "message": "Instagram professional-account ID is missing"},
            )
        previous = remote_state(delivery_spec)
        if value(delivery_spec, "status") == "outcome_unknown" or previous.get("parent_container_id") or previous.get("post_id"):
            return await self.reconcile_image_delivery(delivery_spec)
        quota = await self.get_content_publishing_limit(alias)
        if quota.get("status") != "ok":
            code = "PERMISSION_MISSING" if quota.get("status") == "permission_missing" else "META_QUOTA_UNAVAILABLE"
            return ImageAdapterResult(
                status="failed_retryable",
                last_error={"code": code, "message": "Instagram publishing quota could not be read live"},
            )
        config = quota.get("config") or {}
        usage = quota.get("quota_usage")
        total = config.get("quota_total") if isinstance(config, dict) else None
        if isinstance(usage, (int, float)) and isinstance(total, (int, float)) and usage >= total:
            return ImageAdapterResult(
                status="failed_retryable",
                last_error={
                    "code": "META_QUOTA",
                    "message": "Instagram content publishing quota is exhausted",
                    "quota_usage": usage,
                    "quota_total": total,
                },
            )
        working_remote: dict[str, Any] = dict(previous)

        async def checkpoint(remote: dict[str, Any]) -> None:
            working_remote.update(remote)
            await report_remote(on_remote_update, working_remote)

        try:
            token = await self._token_manager.get_valid_token(self.PLATFORM, alias)
            async with self._client_factory(timeout=settings.publisher_upload_timeout_seconds) as client:
                child_ids: list[str] = []
                if placement == "carousel":
                    for asset in assets:
                        child_id = await self._create_container(
                            client,
                            instagram_id,
                            token,
                            asset,
                            carousel_item=True,
                        )
                        child_ids.append(child_id)
                        await checkpoint({"child_container_ids": list(child_ids)})
                        await self._wait_until_finished(client, child_id, token)
                    payload = await graph_json(
                        client,
                        "POST",
                        f"{quote(instagram_id, safe='')}/media",
                        token=token,
                        data={
                            "media_type": "CAROUSEL",
                            "children": ",".join(child_ids),
                            "caption": caption_for(delivery_spec),
                        },
                    )
                    parent_id = str(payload.get("id") or "")
                else:
                    parent_id = await self._create_container(
                        client,
                        instagram_id,
                        token,
                        assets[0],
                        carousel_item=False,
                        caption=caption_for(delivery_spec),
                    )
                if not parent_id:
                    raise MetaGraphError(200, None, "Instagram did not return a parent container ID", None)
                remote = {
                    **working_remote,
                    "child_container_ids": child_ids,
                    "parent_container_id": parent_id,
                }
                await checkpoint(remote)
                await self._wait_until_finished(client, parent_id, token)
                try:
                    published = await graph_json(
                        client,
                        "POST",
                        f"{quote(instagram_id, safe='')}/media_publish",
                        token=token,
                        data={"creation_id": parent_id},
                    )
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    return await self._reconcile_after_publish_timeout(
                        client,
                        instagram_id,
                        token,
                        remote,
                        exc,
                    )
                except MetaGraphError as exc:
                    if exc.status_code >= 500:
                        return await self._reconcile_after_publish_timeout(
                            client,
                            instagram_id,
                            token,
                            remote,
                            exc,
                        )
                    raise
                media_id = str(published.get("id") or "")
                if not media_id:
                    return ImageAdapterResult(
                        status="outcome_unknown",
                        remote=remote,
                        last_error={"code": "MISSING_MEDIA_ID", "message": "Instagram returned no published media ID"},
                    )
                remote["post_id"] = media_id
                await checkpoint(remote)
                permalink = await self._permalink(client, media_id, token)
                if permalink:
                    remote["permalink"] = permalink
                    await checkpoint(remote)
                comment_status, comment_id = await self._publish_first_comment(
                    client,
                    media_id,
                    token,
                    value(delivery_spec, "first_comment"),
                    bool(value(delivery_spec, "comment_allowed", True)),
                )
                if comment_id:
                    remote["comment_id"] = comment_id
                    await checkpoint(remote)
                return ImageAdapterResult(
                    status="published",
                    remote=remote,
                    comment_status=comment_status,
                    comment_message="permiso pendiente" if comment_status == "skipped_permission" else None,
                )
        except ProgressPersistenceError as exc:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=working_remote,
                last_error={"code": "REMOTE_ID_NOT_PERSISTED", "message": str(exc)},
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=working_remote,
                last_error={"code": "META_TIMEOUT", "message": str(exc)[:300]},
            )
        except TimeoutError as exc:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=working_remote,
                last_error={"code": "PROCESSING_TIMEOUT", "message": str(exc)},
            )
        except MetaGraphError as exc:
            has_remote_work = bool(
                working_remote.get("child_container_ids")
                or working_remote.get("parent_container_id")
                or working_remote.get("post_id")
            )
            status = "outcome_unknown" if exc.status_code >= 500 or has_remote_work else classify_graph_error(exc)
            return ImageAdapterResult(status=status, remote=working_remote, last_error=exc.as_result_error())
        except ValueError as exc:
            return ImageAdapterResult(
                status="failed_permanent",
                remote=working_remote,
                last_error={"code": "INVALID_IMAGE", "message": str(exc)[:300]},
            )

    async def _reconcile_after_publish_timeout(
        self,
        client: httpx.AsyncClient,
        instagram_id: str,
        token: str,
        remote: dict[str, Any],
        error: Exception,
    ) -> ImageAdapterResult:
        """Confirma un Reel/post solo si Graph revela el ID final sin volver a publicar."""
        parent_id = str(remote.get("parent_container_id") or "")
        if parent_id:
            try:
                state = await graph_json(
                    client,
                    "GET",
                    quote(parent_id, safe=""),
                    token=token,
                    params={"fields": "id,status_code,status,media_id,permalink"},
                )
                media_id = state.get("media_id")
                if str(state.get("status_code") or "").upper() == "PUBLISHED" and media_id:
                    remote["post_id"] = str(media_id)
                    if state.get("permalink"):
                        remote["permalink"] = state["permalink"]
                    return ImageAdapterResult(status="published", remote=remote)
            except (MetaGraphError, httpx.HTTPError):
                pass
        return ImageAdapterResult(
            status="outcome_unknown",
            remote=remote,
            last_error={"code": "OUTCOME_UNKNOWN", "message": str(error)[:300]},
        )

    async def _permalink(
        self,
        client: httpx.AsyncClient,
        media_id: str,
        token: str,
    ) -> str | None:
        try:
            payload = await graph_json(
                client,
                "GET",
                quote(media_id, safe=""),
                token=token,
                params={"fields": "id,permalink"},
            )
            permalink = payload.get("permalink")
            return str(permalink) if permalink else None
        except (MetaGraphError, httpx.HTTPError):
            return None

    async def _publish_first_comment(
        self,
        client: httpx.AsyncClient,
        media_id: str,
        token: str,
        comment: Any,
        allowed: bool = True,
    ) -> tuple[str, str | None]:
        if not comment:
            return "not_requested", None
        if not allowed:
            return "skipped_permission", None
        try:
            payload = await graph_json(
                client,
                "POST",
                f"{quote(media_id, safe='')}/comments",
                token=token,
                data={"message": str(comment)},
            )
            comment_id = payload.get("id")
            return ("published", str(comment_id)) if comment_id else ("pending", None)
        except MetaGraphError as exc:
            if exc.permission_missing:
                return "skipped_permission", None
            return "failed", None
        except httpx.HTTPError:
            return "failed", None

    async def reconcile_image_delivery(self, delivery_spec: DeliverySpec) -> ImageAdapterResult:
        """Consulta IDs existentes; si Meta no confirma la publicación, no repite POST."""
        alias = str(value(delivery_spec, "account_alias", ""))
        previous = remote_state(delivery_spec)
        media_id = previous.get("post_id")
        parent_id = previous.get("parent_container_id")
        if not media_id and not parent_id:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "OUTCOME_UNKNOWN", "message": "No container or media ID was saved"},
            )
        try:
            token = await self._token_manager.get_valid_token(self.PLATFORM, alias)
            async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
                if media_id:
                    payload = await graph_json(
                        client,
                        "GET",
                        quote(str(media_id), safe=""),
                        token=token,
                        params={"fields": "id,permalink,media_type,media_product_type"},
                    )
                    remote = {**previous, "post_id": str(payload.get("id") or media_id)}
                    if payload.get("permalink"):
                        remote["permalink"] = payload["permalink"]
                    return ImageAdapterResult(status="published", remote=remote)
                state = await graph_json(
                    client,
                    "GET",
                    quote(str(parent_id), safe=""),
                    token=token,
                    params={"fields": "id,status_code,status,media_id,permalink"},
                )
                if str(state.get("status_code") or "").upper() == "PUBLISHED" and state.get("media_id"):
                    remote = {**previous, "post_id": str(state["media_id"])}
                    if state.get("permalink"):
                        remote["permalink"] = state["permalink"]
                    return ImageAdapterResult(status="published", remote=remote)
                if str(state.get("status_code") or "").upper() in {"ERROR", "EXPIRED"}:
                    return ImageAdapterResult(
                        status="failed_permanent",
                        remote=previous,
                        last_error={"code": "CONTAINER_FAILED", "message": str(state.get("status") or "Container failed")[:300]},
                    )
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "OUTCOME_UNKNOWN", "message": "Meta has no confirmed published media ID"},
            )
        except MetaGraphError as exc:
            return ImageAdapterResult(status=classify_graph_error(exc), remote=previous, last_error=exc.as_result_error())
        except httpx.HTTPError as exc:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "RECONCILIATION_FAILED", "message": str(exc)[:300]},
            )

    async def get_content_publishing_limit(self, account_alias: str) -> dict[str, Any]:
        """Lee la cuota vigente de Graph y preserva null si el permiso no está concedido."""
        instagram_id = str(self._token_manager.target_id(self.PLATFORM, account_alias) or "")
        if not instagram_id:
            return {"status": "account_not_linked", "quota_usage": None, "config": None}
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        try:
            async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
                payload = await graph_json(
                    client,
                    "GET",
                    f"{quote(instagram_id, safe='')}/content_publishing_limit",
                    token=token,
                    params={"fields": "quota_usage,config"},
                )
            data = payload.get("data")
            entry = data[0] if isinstance(data, list) and data else payload
            return {
                "status": "ok",
                "quota_usage": entry.get("quota_usage"),
                "config": entry.get("config"),
                "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
        except MetaGraphError as exc:
            if exc.permission_missing:
                return {"status": "permission_missing", "quota_usage": None, "config": None}
            return {
                "status": "error",
                "quota_usage": None,
                "config": None,
                "error": exc.as_result_error(),
                "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
        except httpx.HTTPError as exc:
            return {
                "status": "error",
                "quota_usage": None,
                "config": None,
                "error": {"code": "META_UNAVAILABLE", "message": str(exc)[:300]},
                "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
