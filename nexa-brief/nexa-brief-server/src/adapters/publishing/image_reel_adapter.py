"""Publica el MP4 musical derivado por la ruta existente de Reels."""
from __future__ import annotations

import inspect
import hashlib
import hmac
import re
import tempfile
from pathlib import Path
from typing import Any

import httpx

from src.adapters.publishing.image_publisher import (
    DeliverySpec,
    ClientFactory,
    MetaGraphError,
    ProgressCallback,
    ProgressPersistenceError,
    ImageAdapterResult,
    caption_for,
    remote_caption_matches,
    remote_date_matches,
    graph_json,
    remote_state,
    report_remote,
    storage_key,
    value,
)
from src.adapters.publishing.instagram_media import probe, reels_safe_video
from src.adapters.publishing.instagram_media_url import create_signed_media_url
from src.config.settings import settings


class ImageReelAdapter:
    """Entrega el Reel musical al pipeline de video para conservar su publicación."""

    PLATFORM = "meta"

    def __init__(
        self,
        token_manager: Any,
        media_storage: Any,
        *,
        publisher: Any | None = None,
        client_factory: ClientFactory | None = None,
        publication_loader: Any | None = None,
    ) -> None:
        self._token_manager = token_manager
        self._media_storage = media_storage
        self._publisher = publisher
        self._client_factory = client_factory or httpx.AsyncClient
        self._publication_loader = publication_loader

    def _publisher_facade(self) -> Any:
        if self._publisher is not None:
            return self._publisher
        from src.adapters.publishing.factory import get_publisher_facade

        return get_publisher_facade()

    def _music_license_error(self, spec: Any, music: Any = None) -> str | None:
        music = music or value(spec, "music") or value(value(spec, "technical", {}), "music") or {}
        if value(music, "mode") != "convert_to_reel":
            return "La entrega Reel requiere música aprobada en modo convert_to_reel"
        license_data = value(music, "license") or {}
        if isinstance(license_data, str):
            license_name = license_data
            proof = value(music, "proof_ref")
            license_url = value(music, "license_url")
            author = value(music, "author")
            track_url = value(music, "track_url")
            attribution = value(music, "attribution")
        else:
            license_name = value(license_data, "spdx_or_name") or value(license_data, "name") or ""
            proof = value(license_data, "proof_ref")
            license_url = value(license_data, "url")
            author = value(license_data, "author")
            track_url = value(license_data, "track_url")
            attribution = value(license_data, "attribution")
        normalized = str(license_name).strip().lower()
        if not normalized or normalized == "unknown" or "unknown" in normalized:
            return "No se publica un Reel con licencia musical desconocida"
        if re.search(r"\b(?:nc|nd)\b|non[ -]?commercial|no[ -]?derivatives", normalized):
            return "La licencia musical no permite sincronización comercial"
        if re.search(r"\bsa\b", normalized):
            return "La licencia CC BY-SA requiere una revisión de compatibilidad antes del Reel"
        approved_license = (
            normalized in {"cc0", "cc0-1.0", "cc-0"}
            or normalized.startswith("cc-by")
            or normalized.startswith("cc by")
            or "pixabay content license" in normalized
        )
        if not approved_license:
            return "La licencia musical no está habilitada para sincronización comercial"
        if normalized.startswith(("cc-by", "cc by")) and not attribution:
            return "La licencia CC BY necesita el texto de atribución aprobado"
        if normalized.startswith(("cc-by", "cc by")) and any(
            part not in caption_for(spec) for part in (str(attribution), str(author), str(track_url), str(license_url))
        ):
            return "El caption del Reel debe incluir el crédito y los enlaces de la música CC BY"
        if not value(music, "music_asset_id") or not re.fullmatch(r"[a-fA-F0-9]{64}", str(value(music, "source_sha256") or "")):
            return "La pista musical necesita ID de biblioteca y SHA-256"
        if not proof or not license_url or not author or not track_url:
            return "La licencia musical necesita autor, URL de pista, URL y referencia de prueba"
        duration = value(music, "duration_sec") or value(music, "duration_seconds")
        try:
            valid_duration = duration is not None and float(duration).is_integer() and 8 <= float(duration) <= 20
        except (TypeError, ValueError, OverflowError):
            valid_duration = False
        if not valid_duration:
            return "El Reel musical debe durar entre 8 y 20 segundos enteros"
        return None

    def _reel_key(self, spec: Any) -> str:
        reel = value(spec, "reel") or value(value(spec, "technical", {}), "reel") or {}
        key = value(spec, "reel_storage_key") or value(reel, "storage_key")
        if not key:
            media_keys = value(spec, "media_keys") or []
            if media_keys:
                key = media_keys[0]
        if not key:
            assets = value(spec, "assets") or value(spec, "slides") or []
            if assets:
                key = value(value(assets[0], "asset", assets[0]), "storage_key")
        return storage_key({"storage_key": key})

    async def _local_reel_path(self, spec: Any) -> tuple[Path, bool]:
        key = self._reel_key(spec)
        local_path = getattr(self._media_storage, "local_path", None)
        if local_path is not None:
            path = Path(local_path(key)).resolve()
            if not path.is_file() or path.suffix.lower() != ".mp4":
                raise ValueError("Stored Reel is not an MP4 file")
            return path, False
        getter = getattr(self._media_storage, "get", None)
        if getter is None:
            raise ValueError("Reel publishing requires a readable media storage")
        source = getter(key)
        if inspect.isawaitable(source):
            source = await source
        if isinstance(source, (bytes, bytearray)):
            content = bytes(source)
        elif hasattr(source, "read"):
            content = source.read()
            if inspect.isawaitable(content):
                content = await content
        else:
            raise ValueError("MediaStoragePort.get must return an MP4 stream")
        if len(content) < 8 or content[4:8] != b"ftyp":
            raise ValueError("Stored Reel is not an MP4 file")
        Path(settings.output_dir).mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(prefix="image-reel-", suffix=".mp4", dir=settings.output_dir, delete=False) as tmp:
            tmp.write(content)
            return Path(tmp.name), True

    async def _publish_with_existing_adapter(
        self,
        facade: Any,
        platform: str,
        alias: str,
        path: Path,
        caption: str,
        checkpoint: ProgressCallback,
    ) -> dict[str, Any]:
        adapters = getattr(facade, "_adapters", {})
        adapter = adapters.get(platform) if isinstance(adapters, dict) else None
        if adapter is None:
            result = await facade.publish_video(
                video_path=path,
                title="",
                description=caption,
                tags=[],
                account_selector=f"{platform}:{alias}",
                publish_as_reel=platform == "facebook",
            )
            return {"post_id": value(result, "post_id") or value(result, "video_id"),
                    "permalink": value(result, "url") or value(result, "permalink")}
        if platform == "instagram":
            return await self._publish_instagram_reel(adapter, alias, path, caption, checkpoint)
        return await self._publish_facebook_reel(adapter, alias, path, caption, checkpoint)

    async def _publish_instagram_reel(
        self,
        adapter: Any,
        alias: str,
        path: Path,
        caption: str,
        checkpoint: ProgressCallback,
    ) -> dict[str, Any]:
        """Reusa preparación y procesamiento Reel, guardando cada ID antes del siguiente POST."""
        video_path = await reels_safe_video(path)
        token = await adapter._token_manager.get_valid_token("instagram", alias)
        instagram_id = adapter._token_manager.target_id("instagram", alias)
        if not instagram_id:
            raise ValueError("Instagram professional-account ID is missing")
        video_url = create_signed_media_url(video_path, ttl_seconds=3600)
        try:
            duration = (await probe(video_path)).duration_seconds
        except Exception:  # noqa: BLE001
            duration = 0.0
        data = {
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption[:2200],
            "share_to_feed": "true",
            "access_token": token,
        }
        creator = getattr(adapter._create_container, "__wrapped__", adapter._create_container)
        async with adapter._make_client(upload=True) as client:
            container_id = await creator(adapter, client, instagram_id, data)
            await report_remote(checkpoint, {"parent_container_id": container_id})
            await adapter._wait_until_ready(
                client,
                container_id,
                token,
                self._poll_window(video_path.stat().st_size, duration),
            )
            publisher = getattr(adapter._publish_container, "__wrapped__", adapter._publish_container)
            media_id = await publisher(adapter, client, instagram_id, container_id, token)
            remote = {"parent_container_id": container_id, "post_id": media_id}
            await report_remote(checkpoint, remote)
            permalink = await adapter._permalink(client, media_id, token)
            if permalink:
                remote["permalink"] = permalink
                await report_remote(checkpoint, remote)
            return remote

    @staticmethod
    def _poll_window(file_size_bytes: int, duration_seconds: float) -> float:
        from src.adapters.publishing.instagram_adapter import _poll_window_seconds

        return _poll_window_seconds(file_size_bytes, duration_seconds)

    async def _publish_facebook_reel(
        self,
        adapter: Any,
        alias: str,
        path: Path,
        caption: str,
        checkpoint: ProgressCallback,
    ) -> dict[str, Any]:
        """Reusa las tres fases FB sin el retry automático de una llamada ambigua."""
        token = await adapter._token_manager.get_valid_token("facebook", alias)
        page_id = adapter._token_manager.target_id("facebook", alias)
        if not page_id:
            raise ValueError("Facebook Page ID is missing")
        video_id, upload_url = await adapter._reel_phase_start(token, page_id, alias)
        await report_remote(checkpoint, {"post_id": video_id})
        await adapter._reel_phase_transfer(token, upload_url, path, path.stat().st_size, alias)
        await adapter._reel_phase_finish(token, page_id, video_id, caption, alias)
        remote = {"post_id": video_id}
        try:
            data = await adapter._catalog_get_json(
                video_id,
                {"fields": "id,permalink_url"},
                alias,
                "image_reel_permalink",
            )
            if data.get("permalink_url"):
                remote["permalink"] = data["permalink_url"]
        except Exception:  # noqa: BLE001 — el ID confirmado basta; el enlace puede sincronizarse luego
            pass
        await report_remote(checkpoint, remote)
        return remote

    async def publish_image_delivery(
        self,
        delivery_spec: DeliverySpec,
        *,
        on_remote_update: ProgressCallback | None = None,
    ) -> ImageAdapterResult:
        alias = str(value(delivery_spec, "account_alias", ""))
        platform = str(value(delivery_spec, "platform", ""))
        previous = remote_state(delivery_spec)
        if (
            value(delivery_spec, "status") == "outcome_unknown"
            or previous.get("post_id")
            or previous.get("parent_container_id")
        ):
            return await self.reconcile_image_delivery(delivery_spec)
        record = None
        if self._publication_loader:
            record = self._publication_loader(str(value(delivery_spec, "publication_id", "")))
            if inspect.isawaitable(record):
                record = await record
        music = value(delivery_spec, "music") or value(value(record, "technical", {}), "music")
        license_error = self._music_license_error(delivery_spec, music)
        if license_error:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "UNLICENSED_MUSIC", "message": license_error},
            )
        if platform not in {"facebook", "instagram"} or not alias:
            return ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "INVALID_REEL_TARGET", "message": "Reel target must be a linked Facebook or Instagram account"},
            )
        working_remote = dict(previous)

        async def checkpoint(remote: dict[str, Any]) -> None:
            working_remote.update(remote)
            await report_remote(on_remote_update, working_remote)

        try:
            path, temporary = await self._local_reel_path(delivery_spec)
            expected_hash = value(value(value(record, "technical", {}), "reel"), "sha256")
            if expected_hash:
                actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
                if not hmac.compare_digest(actual_hash, str(expected_hash).lower()):
                    raise ValueError("Stored Reel hash does not match the approved asset")
            facade = self._publisher_facade()
            result = await self._publish_with_existing_adapter(
                facade,
                platform,
                alias,
                path,
                caption_for(delivery_spec),
                checkpoint,
            )
            remote = {
                **working_remote,
                "post_id": str(value(result, "post_id") or value(result, "video_id") or ""),
            }
            permalink = value(result, "url") or value(result, "permalink")
            if permalink:
                remote["permalink"] = str(permalink)
            if not remote["post_id"]:
                return ImageAdapterResult(
                    status="outcome_unknown",
                    remote=remote,
                    last_error={"code": "MISSING_MEDIA_ID", "message": "The Reel pipeline returned no remote ID"},
                )
            await checkpoint(remote)
            comment_status, comment_id = await self._publish_first_comment(
                platform,
                alias,
                remote["post_id"],
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
        except Exception as exc:  # noqa: BLE001
            status_code = getattr(exc, "status_code", None)
            status = "failed_retryable" if status_code in {429, 500, 502, 503, 504} else "failed_permanent"
            if working_remote.get("post_id") or working_remote.get("parent_container_id") or (status_code and status_code >= 500):
                status = "outcome_unknown"
            return ImageAdapterResult(
                status=status,
                remote=working_remote,
                last_error={"code": "REEL_PUBLISH_FAILED", "status_code": status_code, "message": str(exc)[:300]},
            )
        finally:
            if "temporary" in locals() and temporary:
                path.unlink(missing_ok=True)

    async def _publish_first_comment(
        self,
        platform: str,
        alias: str,
        media_id: str,
        comment: Any,
        allowed: bool,
    ) -> tuple[str, str | None]:
        """Publica el comentario opcional y conserva permiso pendiente como estado."""
        if not comment:
            return "not_requested", None
        if not allowed:
            return "skipped_permission", None
        token = await self._token_manager.get_valid_token(platform, alias)
        if platform == "facebook":
            from src.adapters.publishing.facebook_image_adapter import FacebookImageAdapter

            adapter = FacebookImageAdapter(self._token_manager, self._media_storage, client_factory=self._client_factory)
        else:
            from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter

            adapter = InstagramImageAdapter(self._token_manager, self._media_storage, client_factory=self._client_factory)
        async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
            return await adapter._publish_first_comment(client, media_id, token, comment)

    async def reconcile_image_delivery(self, delivery_spec: DeliverySpec) -> ImageAdapterResult:
        """Confirma el Reel guardado sin crear otro contenedor ni volver a publicar."""
        alias = str(value(delivery_spec, "account_alias", ""))
        platform = str(value(delivery_spec, "platform", ""))
        previous = remote_state(delivery_spec)
        post_id = previous.get("post_id")
        container_id = previous.get("parent_container_id")
        if platform == "instagram" and (post_id or container_id):
            from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter

            adapter = InstagramImageAdapter(
                self._token_manager,
                self._media_storage,
                client_factory=self._client_factory,
            )
            spec = delivery_spec.model_dump(mode="python") if hasattr(delivery_spec, "model_dump") else dict(delivery_spec)
            spec["remote"] = previous
            return await adapter.reconcile_image_delivery(spec)
        if platform != "facebook" or not post_id:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "OUTCOME_UNKNOWN", "message": "The Reel pipeline did not return a reconcilable ID"},
            )
        try:
            token = await self._token_manager.get_valid_token(platform, alias)
            async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
                raw = await graph_json(
                    client,
                    "GET",
                    str(post_id),
                    token=token,
                    params={"fields": "id,from{id},created_time,description,is_published,permalink_url,status,length,source"},
                )
            status = raw.get("status") or {}
            if not isinstance(status, dict):
                status = {}
            video_status = str(status.get("video_status") or "").lower()
            progress_status = str(
                value(value(status, "processing_progress", {}), "status", "")
            ).lower()
            page_id = str(value(delivery_spec, "target_id") or self._token_manager.target_id(platform, alias) or "")
            owner = raw.get("from") if isinstance(raw.get("from"), dict) else {}
            expected_duration = value(delivery_spec, "expected_duration_sec")
            try:
                duration_matches = expected_duration is not None and abs(
                    float(raw.get("length")) - float(expected_duration)
                ) <= 1.5
            except (TypeError, ValueError):
                duration_matches = False
            if (
                not page_id
                or str(owner.get("id") or "") != page_id
                or not remote_caption_matches(raw.get("description"), delivery_spec)
                or not remote_date_matches(raw.get("created_time"), delivery_spec)
                or not duration_matches
                or not str(raw.get("source") or "").startswith("https://")
            ):
                return ImageAdapterResult(
                    status="outcome_unknown",
                    remote=previous,
                    last_error={"code": "REMOTE_PIECE_UNVERIFIED", "message": "No se pudo verificar Página, fecha, caption y duración del Reel"},
                )
            if raw.get("is_published") is not True or video_status not in {"ready", "published"}:
                return ImageAdapterResult(
                    status="outcome_unknown",
                    remote=previous,
                    last_error={"code": "OUTCOME_UNKNOWN", "message": "Facebook has not confirmed the Reel is published"},
                )
            if progress_status not in {"complete", "completed", "succeeded", "success"}:
                return ImageAdapterResult(
                    status="outcome_unknown",
                    remote=previous,
                    last_error={"code": "OUTCOME_UNKNOWN", "message": "Facebook Reel processing is not complete"},
                )
            remote = {**previous, "post_id": str(raw.get("id") or post_id)}
            permalink = raw.get("permalink_url")
            if permalink:
                remote["permalink"] = str(permalink)
            return ImageAdapterResult(status="published", remote=remote)
        except MetaGraphError as exc:
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "RECONCILIATION_FAILED", **exc.as_result_error()},
            )
        except Exception as exc:  # noqa: BLE001
            return ImageAdapterResult(
                status="outcome_unknown",
                remote=previous,
                last_error={"code": "RECONCILIATION_FAILED", "message": str(exc)[:300]},
            )
