"""Publicación de JPEG y multifoto para páginas de Facebook."""
from __future__ import annotations

import inspect
import json
import hashlib
import hmac
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
    remote_caption_matches,
    remote_date_matches,
    remote_visuals_match,
    report_remote,
    storage_key,
    value,
    alt_text,
)
from src.config.settings import settings

_GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_api_version}"


class FacebookImageAdapter:
    """Sube fotos a `/photos`, reúne carruseles en `/feed` y limpia por Graph."""

    PLATFORM = "facebook"

    def __init__(
        self,
        token_manager: Any,
        media_storage: Any,
        *,
        client_factory: ClientFactory | None = None,
    ) -> None:
        self._token_manager = token_manager
        self._media_storage = media_storage
        self._client_factory = client_factory or httpx.AsyncClient

    async def _read_asset(self, asset: Any) -> tuple[bytes, str]:
        key = storage_key(asset)
        mime = str(value(asset, "mime") or "image/jpeg")
        if mime != "image/jpeg":
            raise ValueError("Facebook image deliveries require JPEG assets")
        getter = getattr(self._media_storage, "get", None)
        if getter is not None:
            result = getter(key)
            if inspect.isawaitable(result):
                result = await result
            if isinstance(result, bytes):
                content = result
            elif isinstance(result, bytearray):
                content = bytes(result)
            elif hasattr(result, "read"):
                content = result.read()
                if inspect.isawaitable(content):
                    content = await content
            else:
                raise ValueError("MediaStoragePort.get must return a readable stream")
        else:
            local_path = getattr(self._media_storage, "local_path", None)
            if local_path is None:
                raise ValueError("Facebook publishing needs MediaStoragePort.get")
            content = local_path(key).read_bytes()
        if not content.startswith(b"\xff\xd8\xff"):
            raise ValueError("Stored asset is not a JPEG")
        expected = value(asset, "sha256")
        if expected:
            actual = hashlib.sha256(content).hexdigest()
            if not hmac.compare_digest(actual, str(expected).lower()):
                raise ValueError("Stored JPEG hash does not match the approved asset")
        return content, key

    async def publish_image_delivery(
        self,
        delivery_spec: DeliverySpec,
        *,
        on_remote_update: ProgressCallback | None = None,
    ) -> ImageAdapterResult:
        alias = str(value(delivery_spec, "account_alias", ""))
        page_id = str(value(delivery_spec, "target_id") or self._token_manager.target_id(self.PLATFORM, alias))
        if not alias or not page_id:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "ACCOUNT_NOT_LINKED", "message": "Facebook Page ID is missing"},
            )
        assets = delivery_assets(delivery_spec)
        placement = str(value(delivery_spec, "placement", "image"))
        copy_error = copy_validation_error(delivery_spec)
        if copy_error:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "COPY_LIMIT", "message": copy_error},
            )
        if (placement == "carousel" and len(assets) != 5) or (placement == "image" and len(assets) != 1):
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "INVALID_IMAGE_COUNT", "message": "Expected one JPEG or five carousel JPEGs"},
            )
        previous = remote_state(delivery_spec)
        if value(delivery_spec, "status") == "outcome_unknown" or previous.get("post_id"):
            return await self.reconcile_image_delivery(delivery_spec)
        working_remote = dict(previous)

        async def checkpoint(remote: dict[str, Any]) -> None:
            working_remote.update(remote)
            await report_remote(on_remote_update, working_remote)

        try:
            token = await self._token_manager.get_valid_token(self.PLATFORM, alias)
            async with self._client_factory(timeout=settings.publisher_upload_timeout_seconds) as client:
                if placement == "carousel":
                    remote = await self._upload_carousel(client, page_id, token, assets, delivery_spec, checkpoint)
                else:
                    remote = await self._upload_photo(client, page_id, token, assets[0], delivery_spec, checkpoint)
                comment_status, comment_id = await self._publish_first_comment(
                    client,
                    remote.get("post_id"),
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
                    comment_message="permiso pendiente" if comment_status in {"pending", "skipped_permission"} else None,
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
        except MetaGraphError as exc:
            has_remote_work = bool(
                working_remote.get("photo_ids")
                or working_remote.get("post_id")
            )
            status = "outcome_unknown" if exc.status_code >= 500 or has_remote_work else classify_graph_error(exc)
            return ImageAdapterResult(status=status, remote=working_remote, last_error=exc.as_result_error())
        except (ValueError, OSError) as exc:
            return ImageAdapterResult(
                status="failed_permanent",
                remote=working_remote,
                last_error={"code": "INVALID_IMAGE", "message": str(exc)[:300]},
            )

    async def _upload_photo(
        self,
        client: httpx.AsyncClient,
        page_id: str,
        token: str,
        asset: Any,
        spec: Any,
        callback: ProgressCallback | None,
    ) -> dict[str, Any]:
        content, key = await self._read_asset(asset)
        data: dict[str, Any] = {"caption": caption_for(spec), "published": "true"}
        alt = alt_text(asset, self.PLATFORM)
        if alt:
            data["alt_text_custom"] = alt
        payload = await graph_json(
            client,
            "POST",
            f"{quote(page_id, safe='')}/photos",
            token=token,
            data=data,
            files={"source": (key.rsplit("/", 1)[-1], content, "image/jpeg")},
        )
        photo_id = str(payload.get("id") or "")
        if not photo_id:
            raise MetaGraphError(200, None, "Facebook did not return a photo ID", None)
        remote = {"photo_ids": [photo_id], "child_container_ids": [], "post_id": payload.get("post_id")}
        await report_remote(callback, remote)
        if not remote["post_id"]:
            try:
                details = await graph_json(
                    client,
                    "GET",
                    quote(photo_id, safe=""),
                    token=token,
                    params={"fields": "id,post_id,permalink_url"},
                )
                remote["post_id"] = details.get("post_id")
                remote["permalink"] = details.get("permalink_url")
                await report_remote(callback, remote)
            except (MetaGraphError, httpx.HTTPError):
                pass
        else:
            remote["permalink"] = await self._permalink(client, str(remote["post_id"]), token)
            await report_remote(callback, remote)
        return remote

    async def _upload_carousel(
        self,
        client: httpx.AsyncClient,
        page_id: str,
        token: str,
        assets: list[Any],
        spec: Any,
        callback: ProgressCallback | None,
    ) -> dict[str, Any]:
        photo_ids: list[str] = []
        remote: dict[str, Any] = {"photo_ids": [], "child_container_ids": []}
        for index, asset in enumerate(assets):
            content, key = await self._read_asset(asset)
            data: dict[str, Any] = {"published": "false"}
            alt = alt_text(asset, self.PLATFORM)
            if alt:
                data["alt_text_custom"] = alt
            payload = await graph_json(
                client,
                "POST",
                f"{quote(page_id, safe='')}/photos",
                token=token,
                data=data,
                files={"source": (key.rsplit("/", 1)[-1], content, "image/jpeg")},
            )
            photo_id = str(payload.get("id") or "")
            if not photo_id:
                raise MetaGraphError(200, None, "Facebook did not return a carousel photo ID", None)
            photo_ids.append(photo_id)
            remote["photo_ids"] = list(photo_ids)
            await report_remote(callback, remote)
        attached = {
            f"attached_media[{index}]": json.dumps({"media_fbid": photo_id}, separators=(",", ":"))
            for index, photo_id in enumerate(photo_ids)
        }
        payload = await graph_json(
            client,
            "POST",
            f"{quote(page_id, safe='')}/feed",
            token=token,
            data={"message": caption_for(spec), **attached},
        )
        post_id = str(payload.get("id") or "")
        if not post_id:
            raise MetaGraphError(200, None, "Facebook did not return a post ID", None)
        remote["post_id"] = post_id
        remote["permalink"] = await self._permalink(client, post_id, token)
        await report_remote(callback, remote)
        return remote

    async def _permalink(self, client: httpx.AsyncClient, post_id: str, token: str) -> str | None:
        try:
            data = await graph_json(
                client,
                "GET",
                quote(post_id, safe=""),
                token=token,
                params={"fields": "id,permalink_url"},
            )
            permalink = data.get("permalink_url")
            return str(permalink) if permalink else None
        except (MetaGraphError, httpx.HTTPError):
            return None

    async def _publish_first_comment(
        self,
        client: httpx.AsyncClient,
        post_id: Any,
        token: str,
        comment: Any,
        allowed: bool = True,
    ) -> tuple[str, str | None]:
        if not comment:
            return "not_requested", None
        if not allowed:
            return "skipped_permission", None
        if not post_id:
            return "pending", None
        try:
            data = await graph_json(
                client,
                "POST",
                f"{quote(str(post_id), safe='')}/comments",
                token=token,
                data={"message": str(comment)},
            )
            comment_id = data.get("id")
            return ("published", str(comment_id)) if comment_id else ("pending", None)
        except MetaGraphError as exc:
            if exc.permission_missing:
                return "skipped_permission", None
            return "failed", None
        except httpx.HTTPError:
            return "failed", None

    async def reconcile_image_delivery(self, delivery_spec: DeliverySpec) -> ImageAdapterResult:
        """Verifica cuenta, fecha, caption y fotos antes de conciliar como publicada."""
        alias = str(value(delivery_spec, "account_alias", ""))
        previous = remote_state(delivery_spec)
        post_id = previous.get("post_id")
        if not post_id:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "OUTCOME_UNKNOWN", "message": "Facebook no devolvió un Page Post ID"},
            )
        try:
            token = await self._token_manager.get_valid_token(self.PLATFORM, alias)
            page_id = str(value(delivery_spec, "target_id") or self._token_manager.target_id(self.PLATFORM, alias) or "")
            if not page_id or str(self._token_manager.target_id(self.PLATFORM, alias) or page_id) != page_id:
                return ImageAdapterResult(
                    status="outcome_unknown", remote=previous,
                    last_error={"code": "REMOTE_ACCOUNT_UNVERIFIED", "message": "No se pudo confirmar la Página de destino"},
                )
            async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
                data = await graph_json(
                    client,
                    "GET",
                    quote(str(post_id), safe=""),
                    token=token,
                    params={
                        "fields": "id,from{id},created_time,message,caption,permalink_url,full_picture,attachments{media_type,media}",
                    },
                )
                owner = data.get("from") if isinstance(data.get("from"), dict) else {}
                if str(owner.get("id") or "") != page_id:
                    return ImageAdapterResult(
                        status="outcome_unknown", remote=previous,
                        last_error={"code": "REMOTE_ACCOUNT_MISMATCH", "message": "El post no pertenece a la Página de esta entrega"},
                    )
                if not remote_caption_matches(data.get("message") or data.get("caption"), delivery_spec):
                    return ImageAdapterResult(
                        status="outcome_unknown", remote=previous,
                        last_error={"code": "REMOTE_CAPTION_MISMATCH", "message": "El caption remoto no coincide con esta entrega"},
                    )
                if not remote_date_matches(data.get("created_time"), delivery_spec):
                    return ImageAdapterResult(
                        status="outcome_unknown", remote=previous,
                        last_error={"code": "REMOTE_DATE_MISMATCH", "message": "La fecha del post remoto no coincide con esta entrega"},
                    )
                attachments = data.get("attachments") or {}
                attachment_rows = attachments.get("data", []) if isinstance(attachments, dict) else []
                media_urls = []
                for item in attachment_rows:
                    media = item.get("media") if isinstance(item, dict) else None
                    image = media.get("image") if isinstance(media, dict) else None
                    if isinstance(image, dict) and image.get("src"):
                        media_urls.append(str(image["src"]))
                if not media_urls and data.get("full_picture"):
                    media_urls = [str(data["full_picture"])]
                if not await remote_visuals_match(client, self._media_storage, delivery_spec, media_urls):
                    return ImageAdapterResult(
                        status="outcome_unknown", remote=previous,
                        last_error={"code": "REMOTE_MEDIA_MISMATCH", "message": "Las fotos remotas no coinciden con el arte aprobado"},
                    )
            remote = {**previous, "post_id": str(data.get("id") or post_id)}
            if data.get("permalink_url"):
                remote["permalink"] = data["permalink_url"]
            return ImageAdapterResult(status="published", remote=remote, comment_status=str(previous.get("comment_status", "not_requested")))
        except MetaGraphError as exc:
            if exc.status_code == 404 or (exc.code == "100" and exc.subcode == "33"):
                return ImageAdapterResult(
                    status="failed_permanent",
                    remote=previous,
                    last_error={"code": "REMOTE_POST_NOT_FOUND", "message": "Facebook post was not found"},
                )
            return ImageAdapterResult(status="failed_retryable", remote=previous, last_error=exc.as_result_error())
        except (httpx.HTTPError, Exception) as exc:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "RECONCILIATION_FAILED", "message": str(exc)[:300]},
            )

    async def get_content_publishing_limit(self, account_alias: str) -> dict[str, Any]:
        """Facebook no expone el endpoint IG `content_publishing_limit`."""
        del account_alias
        return {"status": "unsupported", "quota_usage": None, "config": None}

    async def delete_image_post(self, post_id: str, account_alias: str) -> bool:
        """Borra solo el Page Post identificado para limpieza de contenido propio."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
            try:
                result = await graph_json(
                    client,
                    "DELETE",
                    quote(post_id, safe=""),
                    token=token,
                )
            except MetaGraphError as exc:
                if exc.status_code == 404 or (exc.code == "100" and exc.subcode == "33"):
                    return True
                raise
        return result.get("success") is True
