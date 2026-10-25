"""Puerto de salida para publicaciones de imágenes y carruseles en Meta."""
from __future__ import annotations

import hashlib
import hmac
import inspect
import re
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal, Mapping
from urllib.parse import quote, urlsplit

import httpx
import structlog

from src.config.settings import settings
from src.core.image_posts.models import DeliverySpec, RemoteResult as DomainRemoteResult

logger = structlog.get_logger(__name__)
_GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_api_version}"


@dataclass(frozen=True)
class ImageAdapterResult:
    """Estado interno del adapter antes de convertirlo al DTO del dominio."""

    status: Literal["published", "failed_retryable", "failed_permanent", "outcome_unknown"]
    remote: dict[str, Any] = field(default_factory=dict)
    comment_status: Literal[
        "not_requested", "pending", "published", "skipped_permission", "failed"
    ] = "not_requested"
    comment_message: str | None = None
    last_error: dict[str, Any] | None = None


class ImagePublishError(RuntimeError):
    """Error de publicación que distingue fallo conocido de resultado ambiguo."""

    def __init__(
        self,
        status: str,
        details: Mapping[str, Any] | None = None,
        remote: Mapping[str, Any] | None = None,
    ) -> None:
        self.status = status
        self.details = dict(details or {})
        self.remote = dict(remote or {})
        self.outcome_unknown = status == "outcome_unknown"
        self.status_code = self.details.get("status_code")
        super().__init__(str(self.details.get("message") or self.details.get("code") or status))


class MetaGraphError(Exception):
    """Error Graph sin credenciales ni cuerpo completo de la petición."""

    def __init__(
        self,
        status_code: int,
        code: str | None,
        message: str,
        fbtrace_id: str | None,
        subcode: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.fbtrace_id = fbtrace_id
        self.subcode = subcode

    @property
    def permission_missing(self) -> bool:
        return self.status_code == 403 or self.code in {"10", "200"}

    def as_result_error(self) -> dict[str, Any]:
        return {
            "platform": "meta",
            "status_code": self.status_code,
            "code": self.code,
            "message": str(self)[:300],
            "fbtrace_id": self.fbtrace_id,
        }


class ProgressPersistenceError(Exception):
    """Señala que el ID remoto no pudo persistirse antes de la siguiente llamada."""


ProgressCallback = Callable[[dict[str, Any]], Awaitable[None] | None]
ClientFactory = Callable[..., httpx.AsyncClient]
RemotePersister = Callable[[DeliverySpec, dict[str, Any]], Awaitable[None] | None]


def value(obj: Any, key: str, default: Any = None) -> Any:
    """Lee campos de un dict o DTO Pydantic/dataclass sin convertirlo."""
    if isinstance(obj, Mapping):
        return obj.get(key, default)
    return getattr(obj, key, default)


def nested(obj: Any, *keys: str, default: Any = None) -> Any:
    current = obj
    for key in keys:
        current = value(current, key, default)
        if current is default:
            return default
    return current


def delivery_assets(spec: Any) -> list[Any]:
    source = value(spec, "assets") or value(spec, "slides") or value(spec, "media") or []
    if not source:
        keys = value(spec, "media_keys") or []
        hashes = value(spec, "media_sha256") or []
        if hashes and len(hashes) != len(keys):
            raise ValueError("Delivery asset hashes do not match media keys")
        alt_texts = value(spec, "alt_text") or []
        platform = str(value(spec, "platform", ""))
        alt_key = "alt_text_fb" if platform == "facebook" else "alt_text_ig"
        source = [
            {"storage_key": key, "mime": "image/jpeg",
             "sha256": hashes[index] if hashes else None,
             alt_key: alt_texts[index] if index < len(alt_texts) else ""}
            for index, key in enumerate(keys)
        ]
    assets: list[Any] = []
    for item in source:
        assets.append(value(item, "asset", item))
    return assets


def storage_key(asset: Any) -> str:
    key = value(asset, "storage_key") or value(asset, "relative_path") or value(asset, "key")
    if not isinstance(key, str) or not key or key.startswith("/") or ".." in key.split("/"):
        raise ValueError("Delivery asset must use a relative storage key")
    return key


def alt_text(asset: Any, platform: str) -> str | None:
    field = "alt_text_ig" if platform == "instagram" else "alt_text_fb"
    text = value(asset, field) or value(asset, "alt_text")
    if isinstance(text, Mapping):
        text = text.get(platform)
    return str(text) if text else None


def caption_for(spec: Any) -> str:
    caption = value(spec, "caption")
    if caption is None:
        platform = value(spec, "platform")
        caption = nested(spec, "copy", platform, "caption", default="")
    caption = str(caption or "")
    tags = value(spec, "hashtags") or []
    present = set(caption.replace("\n", " ").split())
    missing = [
        f"#{str(tag).lstrip('#')}"
        for tag in tags
        if str(tag).strip("#") and f"#{str(tag).lstrip('#')}" not in present
    ]
    return "\n\n".join(part for part in (caption, " ".join(missing)) if part)


def remote_caption_matches(remote_caption: Any, spec: Any) -> bool:
    expected = " ".join(caption_for(spec).split()).casefold()
    actual = " ".join(str(remote_caption or "").split()).casefold()
    return bool(expected) and actual == expected


def remote_date_matches(remote_timestamp: Any, spec: Any, *, tolerance_hours: int = 48) -> bool:
    expected = value(spec, "expected_at")
    if isinstance(expected, str):
        try:
            expected = datetime.fromisoformat(expected.replace("Z", "+00:00"))
        except ValueError:
            return False
    if not isinstance(expected, datetime) or expected.tzinfo is None:
        return False
    try:
        actual_text = str(remote_timestamp).replace("Z", "+00:00")
        # Graph timestamps commonly use RFC 3339 offsets without the colon (`+0000`).
        actual_text = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", actual_text)
        actual = datetime.fromisoformat(actual_text)
    except (TypeError, ValueError):
        return False
    if actual.tzinfo is None:
        return False
    return abs(actual.astimezone(timezone.utc) - expected.astimezone(timezone.utc)) <= timedelta(hours=tolerance_hours)


def _difference_hash(content: bytes) -> int:
    from io import BytesIO
    from PIL import Image

    with Image.open(BytesIO(content)) as image:
        pixels = list(image.convert("L").resize((9, 8)).getdata())
    result = 0
    bit = 0
    for row in range(8):
        for col in range(8):
            left = pixels[row * 9 + col]
            right = pixels[row * 9 + col + 1]
            if left > right:
                result |= 1 << bit
            bit += 1
    return result


async def remote_visuals_match(
    client: httpx.AsyncClient,
    media_storage: Any,
    spec: Any,
    remote_urls: list[str],
) -> bool:
    """Compara fotos del post remoto con el arte aprobado tras las conversiones de Meta."""
    assets = delivery_assets(spec)
    if not assets or len(assets) != len(remote_urls):
        return False
    getter = getattr(media_storage, "get", None)
    if getter is None:
        return False
    for asset, remote_url in zip(assets, remote_urls, strict=True):
        parsed = urlsplit(remote_url)
        host = (parsed.hostname or "").casefold()
        allowed_hosts = ("fbcdn.net", "cdninstagram.com", "fbsbx.com")
        if parsed.scheme != "https" or not any(
            host == domain or host.endswith(f".{domain}") for domain in allowed_hosts
        ):
            return False
        local = getter(storage_key(asset))
        if inspect.isawaitable(local):
            local = await local
        if hasattr(local, "read"):
            local = local.read()
        if not isinstance(local, (bytes, bytearray)):
            return False
        expected_hash = value(asset, "sha256")
        if expected_hash and not hmac.compare_digest(
            hashlib.sha256(local).hexdigest(), str(expected_hash).lower()
        ):
            return False
        try:
            async with client.stream("GET", remote_url) as response:
                if response.status_code != 200 or not response.headers.get(
                    "content-type", ""
                ).casefold().startswith("image/"):
                    return False
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > 12 * 1024 * 1024:
                        return False
        except httpx.HTTPError:
            return False
        try:
            distance = (_difference_hash(bytes(local)) ^ _difference_hash(bytes(content))).bit_count()
        except (OSError, ValueError):
            return False
        if distance > 12:
            return False
    return True


def copy_validation_error(spec: Any) -> str | None:
    """Valida límites editoriales antes de llamar a Graph."""
    platform = str(value(spec, "platform", ""))
    caption = caption_for(spec)
    hashtags = value(spec, "hashtags") or []
    if platform == "instagram":
        mentions = re.findall(r"(?<![\w.])@[A-Za-z0-9_.]+", caption)
        if len(caption) > 2200 or len(hashtags) > 30 or len(mentions) > 20:
            return "El caption de Instagram supera un límite editorial"
        if any(len(text) > 1000 for text in (value(spec, "alt_text") or [])):
            return "El alt text de Instagram supera 1000 caracteres"
    elif platform == "facebook" and len(caption) > 1500:
        return "El caption de Facebook supera 1500 caracteres"
    return None


def remote_state(spec: Any) -> dict[str, Any]:
    remote = value(spec, "remote") or {}
    if hasattr(remote, "model_dump"):
        remote = remote.model_dump()
    elif hasattr(remote, "__dict__") and not isinstance(remote, Mapping):
        remote = vars(remote)
    return dict(remote) if isinstance(remote, Mapping) else {}


async def report_remote(callback: ProgressCallback | None, remote: dict[str, Any]) -> None:
    """Persiste el último estado remoto antes de ejecutar la siguiente operación."""
    if callback is None:
        return
    try:
        result = callback(dict(remote))
        if inspect.isawaitable(result):
            await result
    except Exception as exc:  # noqa: BLE001
        raise ProgressPersistenceError("Could not persist Meta remote IDs") from exc


async def graph_json(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    token: str,
    params: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
    files: dict[str, tuple[str, bytes, str]] | None = None,
) -> dict[str, Any]:
    """Hace una llamada Graph y normaliza el error sin registrar el token."""
    url = f"{_GRAPH_BASE}/{path.lstrip('/')}"
    request_params = {**(params or {})}
    request_data = {**(data or {})}
    if method.upper() in {"GET", "DELETE"} or params is not None:
        request_params["access_token"] = token
    else:
        request_data["access_token"] = token
    response = await client.request(
        method,
        url,
        params=request_params or None,
        data=request_data or None,
        files=files,
    )
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    error = payload.get("error") if isinstance(payload, dict) else None
    if response.status_code >= 400 or isinstance(error, dict):
        error_data = error if isinstance(error, dict) else {}
        message = str(error_data.get("message") or "Meta Graph API request failed")
        if token:
            message = message.replace(token, "[redacted]")
        raise MetaGraphError(
            response.status_code,
            str(error_data.get("code")) if error_data.get("code") is not None else None,
            message,
            str(error_data.get("fbtrace_id")) if error_data.get("fbtrace_id") else None,
            str(error_data.get("error_subcode")) if error_data.get("error_subcode") is not None else None,
        )
    if not isinstance(payload, dict):
        raise MetaGraphError(response.status_code, None, "Meta returned an invalid response", None)
    return payload


def classify_graph_error(exc: MetaGraphError) -> Literal["failed_retryable", "failed_permanent"]:
    if exc.status_code in {408, 429, 500, 502, 503, 504} or (exc.code or "").startswith("3600"):
        return "failed_retryable"
    return "failed_permanent"


class ImagePublisher:
    """Enruta la entrega al adaptador correcto y ofrece reconciliación explícita."""

    def __init__(
        self,
        token_manager: Any,
        media_storage: Any,
        *,
        client_factory: ClientFactory | None = None,
        reel_publisher: Any | None = None,
        remote_persister: RemotePersister | None = None,
        publication_loader: Any | None = None,
    ) -> None:
        self._token_manager = token_manager
        self._media_storage = media_storage
        self._client_factory = client_factory or httpx.AsyncClient
        self._reel_publisher = reel_publisher
        self._remote_persister = remote_persister
        self._publication_loader = publication_loader

    async def _checkpoint_callback(
        self,
        spec: DeliverySpec,
        callback: ProgressCallback | None,
    ) -> ProgressCallback | None:
        if callback is not None:
            return callback
        if self._remote_persister is None:
            return None

        async def persist(remote: dict[str, Any]) -> None:
            result = self._remote_persister(spec, remote)
            if inspect.isawaitable(result):
                await result

        return persist

    @staticmethod
    def _domain_result(outcome: ImageAdapterResult) -> DomainRemoteResult:
        if outcome.status != "published":
            raise ImagePublishError(outcome.status, outcome.last_error, outcome.remote)
        allowed = {
            "photo_ids", "child_container_ids", "parent_container_id", "post_id",
            "permalink", "comment_id",
        }
        remote = {key: item for key, item in outcome.remote.items() if key in allowed}
        return DomainRemoteResult.model_validate({**remote, "comment_status": outcome.comment_status})

    async def publish_image_delivery(
        self,
        delivery_spec: DeliverySpec,
        *,
        on_remote_update: ProgressCallback | None = None,
    ) -> DomainRemoteResult:
        """Publica foto/carrusel o deriva un Reel al publicador existente."""
        callback = await self._checkpoint_callback(delivery_spec, on_remote_update)
        platform = str(value(delivery_spec, "platform", ""))
        placement = str(value(delivery_spec, "placement", "image"))
        if placement == "reel":
            from src.adapters.publishing.image_reel_adapter import ImageReelAdapter

            adapter = ImageReelAdapter(
                self._token_manager,
                self._media_storage,
                publisher=self._reel_publisher,
                client_factory=self._client_factory,
                publication_loader=self._publication_loader,
            )
            outcome = await adapter.publish_image_delivery(delivery_spec, on_remote_update=callback)
            return self._domain_result(outcome)
        if platform == "facebook":
            from src.adapters.publishing.facebook_image_adapter import FacebookImageAdapter

            adapter = FacebookImageAdapter(
                self._token_manager,
                self._media_storage,
                client_factory=self._client_factory,
            )
        elif platform == "instagram":
            from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter

            adapter = InstagramImageAdapter(
                self._token_manager,
                self._media_storage,
                client_factory=self._client_factory,
            )
        else:
            outcome = ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "UNSUPPORTED_PLATFORM", "message": "Unsupported Meta platform"},
            )
            return self._domain_result(outcome)
        outcome = await adapter.publish_image_delivery(delivery_spec, on_remote_update=callback)
        return self._domain_result(outcome)

    async def reconcile_image_delivery(
        self,
        delivery_spec: DeliverySpec,
        remote: Mapping[str, Any] | None = None,
    ) -> DomainRemoteResult:
        """Consulta IDs guardados; jamás vuelve a enviar una entrega ambigua."""
        platform = str(value(delivery_spec, "platform", ""))
        if value(delivery_spec, "placement") == "reel":
            from src.adapters.publishing.image_reel_adapter import ImageReelAdapter

            adapter = ImageReelAdapter(
                self._token_manager,
                self._media_storage,
                publisher=self._reel_publisher,
                client_factory=self._client_factory,
                publication_loader=self._publication_loader,
            )
        elif platform == "facebook":
            from src.adapters.publishing.facebook_image_adapter import FacebookImageAdapter

            adapter = FacebookImageAdapter(
                self._token_manager,
                self._media_storage,
                client_factory=self._client_factory,
            )
        elif platform == "instagram":
            from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter

            adapter = InstagramImageAdapter(
                self._token_manager,
                self._media_storage,
                client_factory=self._client_factory,
            )
        else:
            outcome = ImageAdapterResult(
                status="failed_permanent",
                last_error={"code": "UNSUPPORTED_PLATFORM", "message": "Unsupported Meta platform"},
            )
            return self._domain_result(outcome)
        spec_data = delivery_spec.model_dump(mode="python")
        if remote is not None:
            spec_data["remote"] = dict(remote)
        outcome = await adapter.reconcile_image_delivery(spec_data)
        return self._domain_result(outcome)

    async def get_content_publishing_limit(self, account_alias: str) -> dict[str, Any]:
        """Lee la cuota de Instagram en vivo; no codifica un máximo fijo."""
        from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter

        adapter = InstagramImageAdapter(
            self._token_manager,
            self._media_storage,
            client_factory=self._client_factory,
        )
        return await adapter.get_content_publishing_limit(account_alias)

    async def delete_facebook_image_post(self, post_id: str, account_alias: str) -> bool:
        """Elimina por Graph un post de foto FB propio durante limpieza de QA."""
        from src.adapters.publishing.facebook_image_adapter import FacebookImageAdapter

        adapter = FacebookImageAdapter(
            self._token_manager,
            self._media_storage,
            client_factory=self._client_factory,
        )
        return await adapter.delete_image_post(post_id, account_alias)

    async def remove_remote_delivery(self, delivery: Any) -> dict[str, Any]:
        """Retira un medio propio o conserva una instrucción verificable de borrado manual."""
        platform = str(value(delivery, "platform"))
        remote_id = str(nested(delivery, "remote", "post_id") or "")
        if platform not in {"facebook", "instagram"} or not remote_id.isdigit() and not re.fullmatch(r"\d+_\d+", remote_id):
            raise ValueError("La entrega no tiene un ID remoto válido")
        token = await self._token_manager.get_valid_token(platform, str(value(delivery, "account_alias")))
        path = quote(remote_id, safe="")
        instruction = (
            "Borrar desde la app de Instagram y luego pulsar Verificar eliminación."
            if platform == "instagram" else
            "Borrar desde la Página de Facebook y luego pulsar Verificar eliminación."
        )
        async with self._client_factory(timeout=settings.api_timeout_seconds) as client:
            if value(delivery, "status") == "removal_pending_manual":
                try:
                    await graph_json(client, "GET", path, token=token, params={"fields": "id"})
                except MetaGraphError as exc:
                    if exc.status_code == 404 or (exc.code == "100" and exc.subcode == "33"):
                        account_id = str(value(delivery, "target_id") or "")
                        if account_id:
                            try:
                                listing = await graph_json(
                                    client, "GET", f"{quote(account_id, safe='')}/media",
                                    token=token, params={"fields": "id", "limit": "100"},
                                )
                            except (MetaGraphError, httpx.HTTPError):
                                listing = {}
                            ids = {str(row.get("id")) for row in listing.get("data", []) if isinstance(row, dict)}
                            if "data" in listing and remote_id not in ids and not listing.get("paging", {}).get("next"):
                                return {"status": "removed", "graph_response": {"verification": exc.as_result_error()}}
                    return {"status": "removal_pending_manual", "instruction": instruction,
                            "graph_response": {"verification": exc.as_result_error()}}
                return {"status": "removal_pending_manual", "instruction": instruction,
                        "graph_response": {"verification": {"status": "still_exists"}}}
            try:
                response = await graph_json(client, "DELETE", path, token=token)
            except MetaGraphError as exc:
                return {"status": "removal_pending_manual", "instruction": instruction,
                        "graph_response": {"delete": exc.as_result_error()}}
            except httpx.HTTPError:
                return {"status": "removal_pending_manual", "instruction": instruction,
                        "graph_response": {"delete": {"code": "NETWORK_ERROR", "message": "No se pudo contactar Meta Graph"}}}
        safe_response = {"success": response.get("success")}
        if response.get("success") is True:
            return {"status": "removed", "graph_response": {"delete": safe_response}}
        return {"status": "removal_pending_manual", "instruction": instruction,
                "graph_response": {"delete": safe_response}}


_image_publisher: ImagePublisher | None = None


def get_image_publisher() -> ImagePublisher:
    """Compone el publicador con el archivo local y los tokens actuales."""
    global _image_publisher
    if _image_publisher is None:
        from src.adapters.data.publication_factory import get_publication_components
        from src.adapters.publishing.factory import get_publisher_facade

        components = get_publication_components()
        facade = get_publisher_facade()

        async def persist_remote(spec: DeliverySpec, partial: dict[str, Any]) -> None:
            publication_id = str(value(spec, "publication_id", ""))
            delivery_id = str(value(spec, "delivery_id", ""))
            for _ in range(3):
                record = components.repository.get(publication_id)
                if record is None:
                    raise KeyError(publication_id)
                delivery = next((row for row in record.deliveries if row.delivery_id == delivery_id), None)
                if delivery is None:
                    raise KeyError(delivery_id)
                current_remote = delivery.remote.model_dump(mode="json")
                current_remote.update(partial)
                try:
                    await components.repository.append_delivery_event(
                        publication_id,
                        delivery_id,
                        {"remote": current_remote},
                        expected_record_version=record.record_version,
                    )
                    return
                except ValueError as exc:
                    if "REVISION_CONFLICT" not in str(exc):
                        raise
            raise RuntimeError("Could not persist remote IDs after concurrent updates")

        _image_publisher = ImagePublisher(
            facade._token_manager,
            components.media,
            reel_publisher=facade,
            remote_persister=persist_remote,
            publication_loader=components.repository.get,
        )
    return _image_publisher


def reset_image_publisher() -> None:
    """Limpia el singleton al aislar componentes en pruebas."""
    global _image_publisher
    _image_publisher = None
