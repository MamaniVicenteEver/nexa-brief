"""Casos de uso de imagen: plan, revisión, archivo y entrega."""

from __future__ import annotations

import dataclasses

import asyncio
from dataclasses import asdict, is_dataclass
import hashlib
import hmac
import inspect
import json
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Protocol
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import structlog
from src.config.settings import settings

from src.core.image_posts.models import (
    Delivery, DeliverySpec, DeliveryStatus, EditorialRecord, EditorialReview,
    EditorialSlide, PostCopy, PostStatus, PublicationRecord, RemoteResult, SourceReference,
    RenderedSlide, TechnicalRecord, ValidationResult,
    AIUsage, MusicOption, ReelManifest,
)
from src.core.image_posts.plan import ImagePlan as EngineImagePlan
from src.core.image_posts.plan import parse_image_plan, plan_hash as engine_plan_hash
from src.core.image_posts.repository import ImagePostRepository
from src.core.image_posts.security import redact_persisted_text
from src.core.image_posts.schedule import (
    daily_image_limit, delivery_idempotency_key, local_occurrence_to_utc,
    occurrence_key, stable_plan_choice,
)
from src.core.ports.media_storage_port import MediaStoragePort
from src.core.ports.image_post_resources import (
    ImageAccountMapping,
    ImageMediaCache,
    ImageStyleCatalog,
    VerifiedImageMaterialSource,
)

logger = structlog.get_logger(__name__)
_render_tasks: set[asyncio.Task] = set()
_DELIVERY_HEARTBEAT_SECONDS = 30
_PHOTO_CHANGES = "recortada y convertida a B/N"


class ImageRenderer(Protocol):
    def render(self, plan: EngineImagePlan, style: Any) -> Any: ...


class ImagePublisher(Protocol):
    def publish_image_delivery(self, spec: DeliverySpec) -> Any: ...
    def reconcile_image_delivery(self, spec: DeliverySpec, remote: dict[str, Any]) -> Any: ...


class ImagePostError(ValueError):
    def __init__(self, code: str, message: str | None = None, status_code: int = 422):
        super().__init__(message or code)
        self.code = code
        self.status_code = status_code


@dataclasses.dataclass(frozen=True)
class _BuiltImagePlan:
    plan: Any
    strategy_id: str
    copy_sources: dict[str, str]
    ai_usage: list[dict[str, Any]] = dataclasses.field(default_factory=list)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "to_dict"):
        return _jsonable(value.to_dict())
    if is_dataclass(value):
        return _jsonable(asdict(value))
    if hasattr(value, "value") and isinstance(value.value, str):
        return value.value
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


def _plan_data(value: Any) -> dict[str, Any]:
    data = _jsonable(value)
    if not isinstance(data, dict):
        raise ImagePostError("INVALID_PLAN", "El motor no devolvió un plan objeto")
    # plan_hash pertenece al manifiesto persistido, no al esquema estricto de A.
    return {key: item for key, item in data.items() if key != "plan_hash"}


def _parse_plan(value: Any) -> EngineImagePlan:
    try:
        return parse_image_plan(_plan_data(value))
    except (TypeError, ValueError) as exc:
        raise ImagePostError("INVALID_PLAN", str(exc)) from exc


def _field(value: Any, name: str, default: Any = None) -> Any:
    return value.get(name, default) if isinstance(value, dict) else getattr(value, name, default)


def _source_references(plan_data: dict[str, Any]) -> list[dict[str, Any]]:
    sources: dict[str, dict[str, Any]] = {}
    for slide in plan_data.get("slides", []):
        for claim in slide.get("claim_refs", []):
            source_id = str(claim.get("source_id") or claim.get("id") or "")
            if not source_id:
                continue
            row = sources.setdefault(source_id, {
                "source_id": source_id, "claim_ids": [], "title": claim.get("title", ""),
                "url": claim.get("url") or claim.get("source_url"),
                "locator": claim.get("locator") or claim.get("location"),
                "verified_at": claim.get("verified_at"),
            })
            claim_id = str(claim.get("id") or source_id)
            if claim_id not in row["claim_ids"]:
                row["claim_ids"].append(claim_id)
    return list(sources.values())


def _meaningful_number(fact: str) -> str | None:
    for raw in re.findall(r"\d[\d.,]*%?", fact):
        value = raw.rstrip(".,%")
        try:
            number = float(value.replace(",", ""))
        except ValueError:
            continue
        if not 1900 <= number <= 2100:
            return value + ("%" if raw.endswith("%") else "")
    return None


def _approved_for_publication(usage: str) -> bool:
    """Acepta solo una marca afirmativa al inicio de la columna cotejo/uso."""
    marker = usage.strip().strip("`*_ ").casefold()
    if re.search(r"\bno\s+(?:publicar|publicable|aprobado|aprobada)\b", marker):
        return False
    return bool(re.match(r"^(?:sí|si|aprobado|aprobada|publicar)(?=$|[\s:;—-])", marker))


def _copy_source_for_record(source: str) -> str:
    """Keep persisted provenance within the record's model/rules source convention."""
    if source == "modelo" or source.startswith("reglas:"):
        return source
    if source.startswith("modelo; por reglas:"):
        substituted = source.partition("por reglas:")[2].strip()
        return f"reglas: salida mixta; campos sustituidos: {substituted}"
    if source == "reglas":
        return "reglas: origen no especificado"
    return f"reglas: {source}"


def _complete_photo_attribution(slides: list[dict[str, Any]], images: list[Any]) -> None:
    """Guarda licencia y cambios en el plan y en el crédito visible de la lámina."""
    by_hash = {str(image.sha256): image for image in images}
    for slide in slides:
        for media in slide.get("media", []):
            image = by_hash.get(str(media.get("sha256") or ""))
            if image is None:
                continue
            license_url = str(getattr(image, "license_url", "") or "")
            source_url = str(getattr(image, "source_url", "") or media.get("url", ""))
            author = str(getattr(image, "author", "") or "Autor desconocido")
            license_id = str(getattr(image, "license", "") or media.get("license_id", ""))
            media.update({"license_url": license_url or None, "changes": _PHOTO_CHANGES})
            visible = (
                f"{author} ({license_id}) · {license_url} · {source_url} · "
                f"Cambios: {_PHOTO_CHANGES}"
            )
            for item in slide.get("texts", []):
                if item.get("role") == "credit":
                    item["value"] = visible


def _verified_fact_texts(plan_text: str) -> dict[str, str]:
    facts: dict[str, str] = {}
    in_facts = False
    for line in plan_text.splitlines():
        if line.startswith("## "):
            in_facts = line.startswith("## 3.")
        if not in_facts or not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) >= 4 and cells[0].isdigit() and _approved_for_publication(cells[3]):
            facts[f"claim_{cells[0]}"] = cells[1]
    return facts


def _caption_factual_text(caption: str) -> str:
    paragraphs = []
    for paragraph in caption.splitlines():
        clean = paragraph.strip()
        if clean.casefold().startswith(("fuentes:", "créditos visuales:")):
            continue
        paragraphs.append(clean)
    return re.sub(r"https?://\S+", " ", " ".join(paragraphs))


_NUMBER_TOKEN = re.compile(r"(?<!\w)\d+(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?(?!\w)")


def _number_values(text: str) -> set[str]:
    """Normaliza miles sin confundir un decimal con un entero."""
    values = set()
    for match in _NUMBER_TOKEN.finditer(text):
        token = match.group(0)
        decimal = re.search(r"[.,](\d{1,2})$", token)
        integer_part = token[:decimal.start()] if decimal else token
        integer = str(int(re.sub(r"[.,\s]", "", integer_part)))
        fraction = decimal.group(1).rstrip("0") if decimal else ""
        values.add(f"{integer}.{fraction}" if fraction else integer)
    return values


def _cached_media(plan: Any, cache: ImageMediaCache) -> dict[str, bytes]:
    """Bytes de las fotos del plan desde la caché de medios, por sha256 (sin red al renderizar)."""
    out: dict[str, bytes] = {}
    for slide in plan.slides:
        for ref in slide.media:
            content = cache.get_by_sha256(ref.sha256)
            if content is None:
                raise ImagePostError("MEDIA_NOT_CACHED", f"Falta en caché la foto {ref.asset_id}", 422)
            out[ref.asset_id] = content
    return out


class ImagePostService:
    def __init__(
        self, repository: ImagePostRepository, media: MediaStoragePort, *,
        plan_builder: Any = None, renderer: ImageRenderer | Any = None,
        publisher: ImagePublisher | Any = None, account_provider: Any = None,
        material_source: VerifiedImageMaterialSource,
        account_mapping: ImageAccountMapping,
        style_catalog: ImageStyleCatalog,
        image_cache: ImageMediaCache,
        music_catalog: Any = None,
        reel_encoder: Any = None,
    ) -> None:
        self.repository = repository
        self.media = media
        self.plan_builder = plan_builder
        self.renderer = renderer
        self.publisher = publisher
        self.account_provider = account_provider
        self.material_source = material_source
        self.account_mapping = account_mapping
        self.style_catalog = style_catalog
        self.image_cache = image_cache
        self.music_catalog = music_catalog
        self.reel_encoder = reel_encoder

    async def _encode_reel(self, record: PublicationRecord) -> ReelManifest:
        """Archiva el MP4 antes de aprobar, siempre desde audio local verificado."""
        option = record.technical.music
        if not self.music_catalog or not self.reel_encoder:
            raise ImagePostError("REEL_UNAVAILABLE", "No hay codificador musical configurado", 503)
        try:
            track = self.music_catalog.resolve(option)
        except ValueError as exc:
            raise ImagePostError("UNLICENSED_MEDIA", str(exc), 422) from exc
        duration = option.duration_sec or 15
        if duration != int(duration) or not 8 <= int(duration) <= 20:
            raise ImagePostError("INVALID_REEL", "La duración debe ser de 8 a 20 segundos enteros")
        plan = _parse_plan(record.technical.composition_plan)
        style = self._style(plan.category_id, plan.style_id)
        from src.core.image_posts.render import render_reel
        frames = render_reel(plan, style, _cached_media(plan, self.image_cache), duration_seconds=int(duration))
        try:
            content = await self.reel_encoder.encode(
                frames, track.path, duration=int(duration), trim_start=option.trim_start_sec or 0,
                gain_db=option.gain_db or 0,
            )
        except (OSError, ValueError) as exc:
            raise ImagePostError("INVALID_REEL", _safe_error(exc), 422) from exc
        digest = hashlib.sha256(content).hexdigest()
        created = record.created_at.astimezone(timezone.utc)
        key = f"{record.editorial.category_id}/{created:%Y/%m}/{record.publication_id}/reels/{digest}.mp4"
        media_object = self.media.put(key, content, "video/mp4", digest, if_absent=True)
        return ReelManifest(
            asset_id=f"reel_{digest[:24]}", storage_key=media_object.key,
            width=1080, height=1920, duration_sec=int(duration),
            fps=30, codec="h264", audio_codec="aac", bytes=media_object.bytes,
            sha256=media_object.sha256, rendered_at=_now(),
        )

    async def _invoke(self, operation: Any, *args: Any, **kwargs: Any) -> Any:
        result = operation(*args, **kwargs)
        return await result if inspect.isawaitable(result) else result

    def _plan_builder(self) -> Any:
        if self.plan_builder:
            return self.plan_builder
        return self._build_plan_from_source

    def _style(self, category_id: str, style_id: str | None = None) -> Any:
        try:
            return self.style_catalog.get_style(category_id, style_id)
        except (OSError, ValueError, KeyError) as exc:
            raise ImagePostError("STYLE_NOT_FOUND", str(exc)) from exc

    async def _build_plan_from_source(self, **request: Any) -> _BuiltImagePlan:
        category_id = str(request["category_id"])
        style = self._style(category_id, str(request["style_id"]))
        material = self.material_source.load_verified_material(
            str(request["source_video_id"]), category_id
        )
        if material is None:
            raise ImagePostError("SOURCE_NOT_VERIFIED", "No hay material verificado disponible para ese video", 422)
        publish = material.publish
        published_sources = {
            match.group(0).rstrip(".,;")
            for item in publish.get("sources", [])
            for match in [re.search(r"https://[^\s]+", str(item))]
            if match
        }
        facts: list[tuple[str, str, str, str, str]] = []
        plan_text = material.plan_text
        in_verified_facts = False
        for line in plan_text.splitlines():
            if line.startswith("## "):
                in_verified_facts = line.startswith("## 3.")
            if not in_verified_facts:
                continue
            if not line.lstrip().startswith("|"):
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) < 4 or not cells[0].isdigit():
                continue
            usage = cells[3]
            if not _approved_for_publication(usage):
                continue
            url_match = re.search(r"https://[^\s|]+", cells[2])
            fact = cells[1].strip()
            if url_match and fact:
                url = url_match.group(0).rstrip(".,;")
                if url in published_sources:
                    source_name = re.split(r"[:,]", cells[2], maxsplit=1)[0].strip()
                    if source_name in {"https", "http"}:
                        source_name = urlsplit(url).hostname or "Fuente"
                    facts.append((f"claim_{cells[0]}", fact, url, source_name, usage))
        by_id = {claim_id: (fact, url, source_name, usage)
                 for claim_id, fact, url, source_name, usage in facts}
        focus = request.get("focus_claim_ids")
        if focus:
            requested = [str(value) for value in focus]
            selected = [(claim_id, *by_id[claim_id]) for claim_id in requested if claim_id in by_id]
            if len(selected) != len(requested):
                raise ImagePostError("INVALID_PLAN", "focus_claim_ids debe apuntar a hechos marcados como verificados")
        else:
            measurable = [row for row in facts if _meaningful_number(row[1])]
            selected = measurable + [row for row in facts if row not in measurable]
        from src.core.image_posts import strategies
        try:
            strategy = strategies.resolve(request.get("strategy_id"), str(request["template_id"]))
        except strategies.UnknownStrategy as exc:
            raise ImagePostError("INVALID_STRATEGY", str(exc), 422) from None
        if len(selected) < strategy.facts_needed:
            raise ImagePostError("SOURCE_NOT_VERIFIED",
                                 f"Se necesitan {strategy.facts_needed} hechos verificados en PLAN.md §3", 422)
        brand = style.brand or {}
        context = strategies.StrategyContext(
            category_id=category_id,
            hook=str(publish.get("youtube_title") or material.video_title),
            topic="",
            handle=str(brand.get("handle", "")),
            brand=str(brand.get("name", "")),
            voice=str(style.tone.get("voice", "")),
        )
        usage_by_claim = {claim_id: usage for claim_id, _fact, _url, _source, usage in selected}
        facts = strategy.pick([strategies.Fact(claim_id, fact, url, source_name)
                               for claim_id, fact, url, source_name, _usage in selected])
        ai_usage: list[dict[str, Any]] = []
        copy, topic, extras = await strategies.copywriter.write(strategy, facts, context, usage_out=ai_usage)
        for claim_id, piece in copy.items():  # de dónde salió cada texto: modelo o reglas (y por qué)
            logger.info("image_post_copy", claim_id=claim_id, strategy=strategy.id, source=piece.source)
        copy_sources = {
            claim_id: _copy_source_for_record(piece.source)
            for claim_id, piece in copy.items()
        }
        topic = topic or strategies.trim_words(str(material.topic or ""), 28)
        context = dataclasses.replace(context, topic=topic)
        sourced_images = []
        if not strategy.needs_media:
            slides = strategy.build(facts, context, copy)
        else:
            sourced_images = await self._licensed_images(strategy, facts, context, extras)
            slides = strategy.build(facts, context, copy, sourced_images)
            _complete_photo_attribution(slides, sourced_images)
        for slide in slides:
            for claim in slide.get("claim_refs", []):
                usage = usage_by_claim.get(str(claim.get("id", "")))
                if usage:
                    claim["locator"] = f"{claim.get('locator', 'PLAN.md §3')}; cotejo/uso aprobado: {usage}"
        from src.core.image_posts.plan import build_image_plan
        plan = build_image_plan(
            category_id=category_id, source_video_id=str(request["source_video_id"]),
            source_revision=material.source_revision, template_id=str(request["template_id"]),
            slides=slides, style=style, seed=int(request.get("seed") or 0),
        )
        return _BuiltImagePlan(plan=plan, strategy_id=strategy.id, copy_sources=copy_sources, ai_usage=ai_usage)

    async def _licensed_images(self, strategy: Any, facts: list[Any], context: Any, extras: dict[str, str]) -> list[Any]:
        """Fotos con licencia (Wikimedia) para estrategias con imagen; la primera es la elegida."""
        from src.core.image_posts.media_sources import find_images
        query, article = strategy.media_query(facts, context, extras)
        images = await find_images(query, self.image_cache, article=article, lang="es", n=3)
        logger.info("image_post_media", strategy=strategy.id, query=query, article=article,
                    found=[f"{image.title} ({image.license}, {image.width}x{image.height})" for image in images])
        if not images:
            raise ImagePostError("NO_LICENSED_IMAGE", f"No hay foto con licencia para «{query}»", 422)
        return images

    def _renderer(self) -> Any:
        if self.renderer:
            return self.renderer
        try:
            from src.core.image_posts.render import render_async
            return render_async
        except ImportError:
            raise ImagePostError("RENDERER_UNAVAILABLE", "El renderer todavía no está disponible.", 503) from None

    def _publisher(self) -> Any:
        if self.publisher:
            return self.publisher
        try:
            from src.adapters.publishing.image_publisher import get_image_publisher
            return get_image_publisher()
        except (ImportError, AttributeError):
            raise ImagePostError("META_ADAPTER_UNAVAILABLE", "El publicador de imágenes todavía no está configurado.", 503) from None

    async def create_plan(self, request: dict[str, Any], idempotency_key: str | None = None) -> tuple[EngineImagePlan, PublicationRecord]:
        from src.core.image_posts import strategies

        category_id = str(request.get("category_id", ""))
        if not self.material_source.category_exists(category_id):
            raise ImagePostError("INVALID_CATEGORY", f"Categoría desconocida: {category_id}")
        try:
            strategy = strategies.resolve(request.get("strategy_id"), str(request.get("template_id", "")))
        except strategies.UnknownStrategy as exc:
            raise ImagePostError("INVALID_STRATEGY", str(exc), 422) from None
        request = {**request, "strategy_id": strategy.id}
        request_hash = hashlib.sha256(
            json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        ).hexdigest()
        if idempotency_key:
            existing = self.repository.get_idempotent(f"plans:{idempotency_key}", request_hash)
            if existing:
                return _parse_plan(existing.technical.composition_plan), existing
        builder = self._plan_builder()
        try:
            built = await self._invoke(builder, **request)
        except ImagePostError:
            raise
        except Exception as exc:
            raise ImagePostError("PLAN_BUILDER_FAILED", _safe_error(exc), 422) from exc
        copy_sources: dict[str, str] = {}
        ai_usage: list[AIUsage] = []
        if isinstance(built, _BuiltImagePlan):
            raw_plan = built.plan
            strategy_id = built.strategy_id
            copy_sources = dict(built.copy_sources)
            ai_usage = [AIUsage.model_validate(usage) for usage in built.ai_usage]
        else:
            raw_plan = built
            strategy_id = strategy.id
        plan = _parse_plan(raw_plan)
        if plan.category_id != category_id:
            raise ImagePostError("INVALID_PLAN", "El motor devolvió un plan de otra categoría")
        style = self._style(category_id, plan.style_id)
        if plan.style_version != style.version:
            raise ImagePostError("INVALID_PLAN", "El plan referencia otra versión del estilo")
        from src.core.image_posts.validate import validate_plan
        report = validate_plan(plan, style)
        if not report.passed:
            raise ImagePostError("INVALID_PLAN", "; ".join(report.errors))
        plan_data = plan.to_dict()
        plan_data["plan_hash"] = engine_plan_hash(plan, style)
        now = _now()
        publication_id, post_id = _id("pub"), _id("img")
        is_carousel = plan.template_id == "five_slides"
        title = str(request.get("topic") or "")
        topic = title
        hashtags: list[str] = []
        editorial_slides = [
            EditorialSlide(
                slide_id=slide["slide_id"],
                claim_refs=[claim["id"] for claim in slide["claim_refs"]],
            )
            for slide in plan_data["slides"]
        ]
        copy = {
            "facebook": {"caption": "", "first_comment": None},
            "instagram": {"caption": "", "first_comment": None},
        }
        if self.plan_builder is None:
            material = self.material_source.load_verified_material(plan.source_video_id, category_id)
            if material is None:
                raise ImagePostError("SOURCE_NOT_VERIFIED", status_code=422)
            from src.core.image_posts.copy import CopyError, build_copy
            try:
                generated_copy = build_copy(plan, material.publish)
            except CopyError as exc:
                raise ImagePostError("SOURCE_NOT_VERIFIED", str(exc), 422) from exc
            topic = material.topic or material.video_title
            title = generated_copy.title
            hashtags = list(generated_copy.hashtags)
            claim_ids = list(generated_copy.claim_refs)
            copy = {
                "facebook": {
                    "caption": generated_copy.facebook.caption,
                    "first_comment": generated_copy.facebook.first_comment,
                    "caption_claim_refs": claim_ids,
                    "first_comment_claim_refs": claim_ids if generated_copy.facebook.first_comment else [],
                },
                "instagram": {
                    "caption": generated_copy.instagram.caption,
                    "first_comment": generated_copy.instagram.first_comment,
                    "caption_claim_refs": claim_ids,
                    "first_comment_claim_refs": claim_ids if generated_copy.instagram.first_comment else [],
                },
                "hashtags": hashtags,
            }
            editorial_slides = [
                EditorialSlide(slide_id=slide["slide_id"],
                               alt_text_fb=generated_copy.facebook.alt_texts[index],
                               alt_text_ig=generated_copy.instagram.alt_texts[index],
                               claim_refs=claim_ids)
                for index, slide in enumerate(plan_data["slides"])
            ]
        record = PublicationRecord(
            publication_id=publication_id, post_id=post_id, revision=1, record_version=1,
            created_at=now, updated_at=now, status=PostStatus.DRAFT,
            technical=TechnicalRecord(
                kind="carousel" if is_carousel else "image", template_id=plan.template_id,
                composition_plan=plan_data, copy_sources=copy_sources,
                ai_usage=ai_usage,
            ),
            editorial=EditorialRecord(
                category_id=category_id, strategy_id=strategy_id, source_video_id=plan.source_video_id,
                topic=topic, title=title,
                source_video_url=plan_data.get("source_video_url"), sources=_source_references(plan_data),
                hashtags=hashtags,
                slides=editorial_slides,
                copy=copy, review=EditorialReview(required=True),
            ),
        )
        saved = await self.repository.create(
            record, f"plans:{idempotency_key}" if idempotency_key else None,
            idempotency_request_hash=request_hash if idempotency_key else None,
        )
        return plan, saved

    def get(self, publication_id: str) -> PublicationRecord | None:
        return self.repository.get(publication_id)

    def list(self, filters: dict[str, Any] | None = None, *, limit: int = 24, cursor: str | None = None, sort: str = "desc"):
        return self.repository.list(filters, limit=limit, cursor=cursor, sort=sort)

    def get_styles(self, category_id: str) -> list[dict[str, Any]]:
        if not self.material_source.category_exists(category_id):
            raise ImagePostError("INVALID_CATEGORY", status_code=422)
        try:
            return self.style_catalog.list_styles(category_id)
        except (OSError, TypeError, ValueError) as exc:
            raise ImagePostError("INVALID_STYLE", str(exc), 422) from exc

    def capabilities(self, category_id: str) -> dict[str, Any]:
        rows = self.account_mapping.accounts_for_category(category_id)
        try:
            accounts = self.account_provider() if self.account_provider else []
            if not accounts:
                from src.adapters.publishing.factory import get_publisher_facade
                accounts = get_publisher_facade().list_accounts()
        except Exception:
            accounts = []
        by_key = {(row.get("platform"), row.get("alias")): row for row in accounts}
        results = []
        for row in rows:
            live = by_key.get((row["platform"], row["account_alias"]))
            configured = bool(live and live.get("status") == "ok")
            results.append({
                "platform": row["platform"], "alias": row["account_alias"],
                "name": (live or {}).get("name", row["name"]),
                "target_id": (live or {}).get("target_id") or None,
                "can_publish": bool(row.get("active") and configured),
                "can_comment": bool(row.get("can_comment")),
                "can_insights": bool(row.get("can_insights")),
                "ig_account_subtype": row.get("ig_account_subtype"),
            })
        return {"accounts": results, "review_required": True}

    async def save_plan(self, plan: EngineImagePlan | dict[str, Any], expected_revision: int | None = None) -> PublicationRecord:
        plan = _parse_plan(plan)
        style = self._style(plan.category_id, plan.style_id)
        if plan.style_version != style.version:
            raise ImagePostError("INVALID_PLAN", "El plan referencia otra versión del estilo")
        from src.core.image_posts.validate import validate_plan
        report = validate_plan(plan, style)
        if not report.passed:
            raise ImagePostError("INVALID_PLAN", "; ".join(report.errors))
        plan_data = plan.to_dict()
        plan_data["plan_hash"] = engine_plan_hash(plan, style)
        record = None
        for item in self._all_summaries({"category_id": plan.category_id}):
            candidate = self.repository.get(item["publication_id"])
            if candidate and candidate.technical.composition_plan.plan_id == plan.plan_id:
                record = candidate
                break
        if record is None:
            raise ImagePostError("PLAN_NOT_FOUND", status_code=404)
        if expected_revision is not None and record.revision != expected_revision:
            raise ImagePostError("REVISION_CONFLICT", status_code=409)
        if record.technical.composition_plan.plan_hash == plan_data["plan_hash"]:
            return record
        published_statuses = {
            DeliveryStatus.PUBLISHED, DeliveryStatus.REMOVED_API, DeliveryStatus.REMOVED_MANUALLY,
            DeliveryStatus.REMOVED, DeliveryStatus.REMOVAL_PENDING_MANUAL,
        }
        if not any(delivery.status in published_statuses for delivery in record.deliveries):
            cancelled = await self._cancel_queued_deliveries(record)
            await self.repository.update(record.publication_id, {
                "status": PostStatus.CANCELLED.value,
                "deliveries": [item.model_dump(mode="json") for item in cancelled],
                "updated_at": _now().isoformat().replace("+00:00", "Z"),
            }, record.record_version)
        now = _now()
        updated_technical = TechnicalRecord.model_validate({
            **record.technical.model_dump(mode="json"),
            "composition_plan": plan_data, "slides": [], "validations": [], "render": {},
        })
        updated_editorial = record.editorial.model_copy(update={
            "title": "", "sources": [
                SourceReference.model_validate(item) for item in _source_references(plan_data)
            ], "hashtags": [],
            "slides": [
                EditorialSlide(
                    slide_id=slide["slide_id"],
                    claim_refs=list(dict.fromkeys(
                        str(claim.get("id")) for claim in slide.get("claim_refs", [])
                        if claim.get("id")
                    )),
                ) for slide in plan_data["slides"]
            ],
            "copy": PostCopy(), "review": EditorialReview(required=True),
        })
        changed = record.model_copy(update={
            "publication_id": _id("pub"), "revision": record.revision + 1, "record_version": 1,
            "supersedes_publication_id": record.publication_id, "created_at": now, "updated_at": now,
            "status": PostStatus.DRAFT, "deliveries": [], "metrics_snapshots": [],
            "technical": updated_technical, "editorial": updated_editorial,
        })
        return await self.repository.create(changed)

    async def _cancel_queued_deliveries(self, record: PublicationRecord) -> list[Delivery]:
        active = {DeliveryStatus.PUBLISHING, DeliveryStatus.OUTCOME_UNKNOWN}
        if any(delivery.status in active for delivery in record.deliveries):
            raise ImagePostError("ALREADY_SENT", "Hay entregas en curso o pendientes de conciliación", 409)
        from src.core.schedule import queue_repository

        entries, _total = queue_repository.list_entries(limit=10_000)
        by_delivery = {entry.delivery_id: entry for entry in entries if entry.delivery_id}
        now = _now()
        cancelled = []
        for delivery in record.deliveries:
            if delivery.status != DeliveryStatus.QUEUED:
                cancelled.append(delivery)
                continue
            entry = by_delivery.get(delivery.delivery_id)
            if entry and entry.status.value == "queued":
                try:
                    await queue_repository.cancel(entry.entry_id)
                except ValueError as exc:
                    raise ImagePostError("ALREADY_SENT", str(exc), 409) from exc
            elif entry and entry.status.value != "cancelled":
                raise ImagePostError("ALREADY_SENT", "La entrega salió de la cola y requiere conciliación", 409)
            cancelled.append(delivery.model_copy(update={
                "status": DeliveryStatus.CANCELLED, "updated_at": now, "lease_until": None,
            }))
        return cancelled

    async def start_render(self, plan_id: str, *, review_required: bool = True) -> PublicationRecord:
        record = self._record_for_plan(plan_id)
        if record is None:
            raise ImagePostError("PLAN_NOT_FOUND", status_code=404)
        if record.status in {PostStatus.RENDERING, PostStatus.RENDERED, PostStatus.READY_FOR_REVIEW, PostStatus.APPROVED}:
            return record
        updated = await self.repository.update(record.publication_id, {
            "status": PostStatus.RENDERING.value,
            "editorial": record.editorial.model_copy(update={"review": EditorialReview(required=review_required)}).model_dump(mode="json"),
            "updated_at": _now().isoformat().replace("+00:00", "Z"),
        }, record.record_version)
        task = asyncio.create_task(self._render_background(plan_id))
        _render_tasks.add(task)
        task.add_done_callback(_render_tasks.discard)
        return updated

    async def _render_background(self, plan_id: str) -> None:
        try:
            await self.render_plan(plan_id)
        except Exception as exc:
            record = self._record_for_plan(plan_id)
            if record and record.status == PostStatus.RENDERING:
                try:
                    await self.repository.update(record.publication_id, {
                        "status": PostStatus.FAILED.value,
                        "updated_at": _now().isoformat().replace("+00:00", "Z"),
                    }, record.record_version)
                except Exception:
                    pass
            logger.warning("image_post_render_failed", plan_id=plan_id, error=_safe_error(exc))

    def _record_for_plan(self, plan_id: str) -> PublicationRecord | None:
        matches = []
        for summary in self._all_summaries():
            record = self.repository.get(summary["publication_id"])
            if record and record.technical.composition_plan.plan_id == plan_id:
                matches.append(record)
        return max(matches, key=lambda item: (item.revision, item.created_at)) if matches else None

    async def render_plan(self, plan_id: str) -> PublicationRecord:
        record = self._record_for_plan(plan_id)
        if record is None:
            raise ImagePostError("PLAN_NOT_FOUND", status_code=404)
        renderer = self._renderer()
        plan = _parse_plan(record.technical.composition_plan)
        styles = self.get_styles(plan.category_id)
        style_data = next((row for row in styles if row["style_id"] == plan.style_id), None)
        if style_data is None:
            raise ImagePostError("STYLE_NOT_FOUND")
        style = self._style(plan.category_id, plan.style_id)
        from src.core.image_posts.validate import validate_plan
        report = validate_plan(plan, style)
        if not report.passed:
            raise ImagePostError("INVALID_PLAN", "; ".join(report.errors))
        media_bytes = _cached_media(plan, self.image_cache)
        result = await self._invoke(renderer.render if hasattr(renderer, "render") else renderer, plan, style, media_bytes)
        manifest = result.to_record(plan) if hasattr(result, "to_record") else _jsonable(result)
        technical_manifest = manifest.get("technical", {}) if isinstance(manifest, dict) else {}
        assets = _field(result, "assets") or manifest.get("assets") or manifest.get("slides") or []
        if len(assets) != (5 if plan.template_id == "five_slides" else 1):
            raise ImagePostError("INVALID_IMAGE", "El render debe devolver el número exacto de JPEG")
        created = record.created_at.astimezone(timezone.utc)
        prefix = f"{record.editorial.category_id}/{created:%Y/%m}/{record.publication_id}"
        stored_slides = []
        now = _now()
        for index, asset in enumerate(assets, 1):
            content = _field(asset, "content") or _field(asset, "data") or _field(asset, "bytes_data")
            if content is None and isinstance(_field(asset, "bytes"), (bytes, bytearray)):
                content = bytes(_field(asset, "bytes"))
            if content is None:
                raise ImagePostError("INVALID_IMAGE", "El manifiesto debe incluir los bytes JPEG de cada lámina")
            digest = hashlib.sha256(content).hexdigest()
            if _field(asset, "sha256") and _field(asset, "sha256") != digest:
                raise ImagePostError("INVALID_IMAGE", "El hash del manifiesto no coincide")
            slide_id = str(_field(asset, "slide_id") or plan.slides[index - 1].slide_id)
            asset_id = str(_field(asset, "asset_id") or _id("asset"))
            key = f"{prefix}/slides/{index:02}.jpg"
            media_object = self.media.put(key, content, "image/jpeg", digest, if_absent=True)
            stored_slides.append(RenderedSlide(
                slide_id=slide_id, order=index, asset_id=asset_id, storage_key=media_object.key,
                width=int(_field(asset, "width", 1080)), height=int(_field(asset, "height", 1350)),
                aspect_ratio="4:5", bytes=media_object.bytes, sha256=media_object.sha256,
                rendered_at=now,
            ))
        validations_data = technical_manifest.get("validations", manifest.get("validations", []))
        validations = [ValidationResult.model_validate(item) for item in validations_data]
        if not validations or any(not item.passed for item in validations):
            raise ImagePostError("INVALID_IMAGE", "El renderer no presentó validaciones obligatorias aprobadas")
        status = PostStatus.READY_FOR_REVIEW if record.editorial.review.required else PostStatus.APPROVED
        updated_technical = record.technical.model_copy(update={
            "slides": stored_slides, "validations": validations,
            "render": technical_manifest.get("render", manifest.get("render", {})),
        })
        updated_editorial = record.editorial.model_copy(update={
            "slides": [
                EditorialSlide(slide_id=slide.slide_id,
                               alt_text_fb=record.editorial.slides[index].alt_text_fb if index < len(record.editorial.slides) else "",
                               alt_text_ig=record.editorial.slides[index].alt_text_ig if index < len(record.editorial.slides) else "",
                               claim_refs=[claim.id for claim in plan.slides[index].claim_refs])
                for index, slide in enumerate(stored_slides)
            ],
            "review": record.editorial.review.model_copy(update={
                "approved_at": now if status == PostStatus.APPROVED else None,
                "approval_source": "automatic" if status == PostStatus.APPROVED else None,
            }),
        })
        if status == PostStatus.APPROVED:
            editorial_validation = self._require_publishable(record, stored_slides, updated_editorial)
            updated_technical = updated_technical.model_copy(update={
                "validations": [*validations, editorial_validation],
            })
        updated = await self.repository.update(record.publication_id, {
            "technical": updated_technical.model_dump(mode="json"),
            "editorial": updated_editorial.model_dump(mode="json"),
            "status": status.value, "updated_at": now.isoformat().replace("+00:00", "Z"),
        }, record.record_version)
        await self._emit("image_post_changed", {"publication_id": updated.publication_id, "status": updated.status.value})
        return updated

    async def patch_post(self, publication_id: str, body: dict[str, Any]) -> PublicationRecord:
        record = self.repository.get(publication_id)
        if record is None:
            raise ImagePostError("NOT_FOUND", status_code=404)
        if body.get("revision") != record.revision:
            raise ImagePostError("REVISION_CONFLICT", status_code=409)
        editorial_data = record.editorial.model_dump(mode="json")
        if "title" in body:
            editorial_data["title"] = body["title"]
        if "copy" in body:
            previous_copy = editorial_data.get("copy", {})
            updated_copy = dict(body["copy"])
            for platform in ("facebook", "instagram"):
                previous_network = previous_copy.get(platform, {})
                network = dict(updated_copy.get(platform, {}))
                for field in ("caption_claim_refs", "first_comment_claim_refs"):
                    network.setdefault(field, previous_network.get(field, []))
                updated_copy[platform] = network
            editorial_data["copy"] = updated_copy
            if "hashtags" in body["copy"]:
                editorial_data["hashtags"] = body["copy"]["hashtags"]
        if "slides" in body:
            previous_slides = {slide["slide_id"]: slide for slide in editorial_data.get("slides", [])}
            editorial_data["slides"] = [
                {**previous_slides.get(slide["slide_id"], {}), **slide}
                for slide in body["slides"]
            ]
        title = editorial_data.get("title", "")
        if len(title) > 60:
            raise ImagePostError("COPY_LIMIT", "El título editorial no puede superar 60 caracteres")
        copy = editorial_data.get("copy", {})
        facebook = copy.get("facebook", {})
        instagram = copy.get("instagram", {})
        if len(facebook.get("caption", "")) > 1500:
            raise ImagePostError("COPY_LIMIT", "Caption de Facebook supera 1500 caracteres")
        ig_caption = instagram.get("caption", "")
        if len(ig_caption) > 2200 or len(re.findall(r"(?<!\w)@[A-Za-z0-9_.]+", ig_caption)) > 20:
            raise ImagePostError("COPY_LIMIT", "Caption de Instagram supera los límites editoriales")
        hashtags = copy.get("hashtags", [])
        if len(hashtags) > 30:
            raise ImagePostError("COPY_LIMIT", "Instagram admite como máximo 30 hashtags")
        if any(len(slide.get("alt_text_ig", "")) > 1000 for slide in editorial_data.get("slides", [])):
            raise ImagePostError("COPY_LIMIT", "Alt text de Instagram supera 1000 caracteres")
        review_required = body.get("review_required")
        if review_required is None:
            review_required = record.editorial.review.required
        editorial_data["review"] = EditorialReview(required=review_required).model_dump(mode="json")
        technical_data = record.technical.model_dump(mode="json")
        if "music" in body:
            technical_data["music"] = body["music"]
            technical_data["reel"] = None
            if body["music"].get("mode") not in {"none", "convert_to_reel"}:
                raise ImagePostError("INVALID_PLAN", "Modo de música no admitido")
            if body["music"].get("mode") == "convert_to_reel":
                if not self.music_catalog:
                    raise ImagePostError("REEL_UNAVAILABLE", "No hay catálogo musical", 503)
                try:
                    self.music_catalog.resolve(MusicOption.model_validate(body["music"]))
                except ValueError as exc:
                    raise ImagePostError("UNLICENSED_MEDIA", str(exc), 422) from exc
        now = _now()
        published = any(delivery.status in {
            DeliveryStatus.PUBLISHED, DeliveryStatus.REMOVED_API, DeliveryStatus.REMOVED_MANUALLY,
            DeliveryStatus.REMOVED, DeliveryStatus.REMOVAL_PENDING_MANUAL,
        } for delivery in record.deliveries)
        if published:
            changed = record.model_copy(update={
                "publication_id": _id("pub"), "revision": record.revision + 1, "record_version": 1,
                "supersedes_publication_id": record.publication_id, "created_at": now, "updated_at": now,
                "status": PostStatus.DRAFT, "deliveries": [], "metrics_snapshots": [],
                "editorial": EditorialRecord.model_validate(editorial_data),
                "technical": TechnicalRecord.model_validate(technical_data),
            })
            return await self.repository.create(changed)
        cancelled_deliveries = await self._cancel_queued_deliveries(record)
        updated = await self.repository.update(record.publication_id, {
            "revision": record.revision + 1, "status": PostStatus.DRAFT.value,
            "editorial": EditorialRecord.model_validate(editorial_data).model_dump(mode="json"),
            "technical": TechnicalRecord.model_validate(technical_data).model_dump(mode="json"),
            "deliveries": [item.model_dump(mode="json") for item in cancelled_deliveries],
            "updated_at": now.isoformat().replace("+00:00", "Z"),
        }, record.record_version)
        return updated

    async def review(
        self, publication_id: str, revision: int, decision: str, note: str | None = None
    ) -> PublicationRecord:
        record = self.repository.get(publication_id)
        if record is None:
            raise ImagePostError("NOT_FOUND", status_code=404)
        if revision != record.revision:
            raise ImagePostError("REVISION_CONFLICT", status_code=409)
        if decision not in {"approve", "reject"}:
            raise ImagePostError("INVALID_REVIEW")
        if decision == "approve":
            if not record.technical.slides or not record.technical.validations or any(not item.passed for item in record.technical.validations):
                raise ImagePostError("INVALID_IMAGE", "Falta render validado", 422)
            editorial_validation = self._require_publishable(record, record.technical.slides, record.editorial)
        now = _now()
        review = EditorialReview(
            required=record.editorial.review.required,
            approved_at=now if decision == "approve" else None,
            approval_source="human" if decision == "approve" else None,
            reviewer_id="internal", note=note,
        )
        status = PostStatus.APPROVED if decision == "approve" else PostStatus.DRAFT
        updated_editorial = record.editorial.model_copy(update={"review": review})
        technical = record.technical
        if decision == "approve":
            technical = technical.model_copy(update={
                "validations": [
                    *(item for item in technical.validations if item.name != "claims_sources_license"),
                    editorial_validation,
                ],
            })
        if decision == "approve" and technical.music.mode == "convert_to_reel" and technical.reel is None:
            technical = technical.model_copy(update={"reel": await self._encode_reel(record)})
        updated = await self.repository.update(record.publication_id, {
            "editorial": updated_editorial.model_dump(mode="json"), "status": status.value,
            "technical": technical.model_dump(mode="json"),
            "updated_at": now.isoformat().replace("+00:00", "Z"),
        }, record.record_version)
        await self._emit("image_post_changed", {"publication_id": updated.publication_id, "status": updated.status.value})
        return updated

    async def schedule_deliveries(
        self, publication_id: str, revision: int, targets: list[dict[str, Any]],
        client_request_id: str, *, immediate: bool = False, request_idempotency_key: str | None = None,
    ) -> list[Delivery]:
        request_hash = hashlib.sha256(json.dumps({
            "publication_id": publication_id, "revision": revision, "targets": targets,
            "client_request_id": client_request_id, "immediate": immediate,
        }, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode()).hexdigest()
        request_key = f"deliveries:{request_idempotency_key or client_request_id}"
        record = self.repository.get(publication_id)
        if record is None:
            raise ImagePostError("NOT_FOUND", status_code=404)
        previous = self.repository.get_request(request_key, request_hash)
        if previous is not None:
            by_id = {delivery.delivery_id: delivery for delivery in record.deliveries}
            delivery_ids = previous.get("delivery_ids", [])
            if any(delivery_id not in by_id for delivery_id in delivery_ids):
                raise ImagePostError("DELIVERY_NOT_FOUND", "El recibo no coincide con el archivo", 409)
            claimed = [by_id[delivery_id] for delivery_id in delivery_ids]
            await self._queue_deliveries(publication_id, claimed, immediate=immediate)
            return claimed
        if revision != record.revision:
            raise ImagePostError("REVISION_CONFLICT", status_code=409)
        if record.editorial.review.required and record.status != PostStatus.APPROVED:
            raise ImagePostError("REVIEW_REQUIRED", status_code=409)
        if record.status not in {PostStatus.APPROVED, PostStatus.SCHEDULED, PostStatus.PARTIAL}:
            raise ImagePostError("INVALID_IMAGE", "La publicación todavía no está aprobada", 422)
        if not record.technical.slides or not record.technical.validations or any(not item.passed for item in record.technical.validations):
            raise ImagePostError("INVALID_IMAGE", "Falta render validado", 422)
        try:
            live_accounts = self.account_provider() if self.account_provider else None
            if live_accounts is None:
                from src.adapters.publishing.factory import get_publisher_facade
                live_accounts = get_publisher_facade().list_accounts()
        except Exception:
            live_accounts = []
        now = _now()
        new_deliveries: list[Delivery] = []
        seen_keys: set[str] = set()
        music = record.technical.music
        if music.mode == "convert_to_reel":
            raise ImagePostError("MUSIC_COMING_SOON", "La música estará disponible próximamente", 409)
        for target in targets:
            platform, alias = target["platform"], target["account_alias"]
            mapping = self.account_mapping.resolve_account(record.editorial.category_id, platform, alias)
            live = next((row for row in live_accounts if row.get("platform") == platform and row.get("alias") == alias), None)
            if not live or live.get("status") != "ok" or not live.get("target_id"):
                raise ImagePostError("ACCOUNT_NOT_LINKED", status_code=403)
            if not mapping.get("active"):
                raise ImagePostError("ACCOUNT_NOT_LINKED", status_code=403)
            requested_placement = target.get("placement")
            expected_placement = "reel" if music.mode == "convert_to_reel" else "carousel" if record.technical.kind == "carousel" else "image"
            if requested_placement and requested_placement != expected_placement:
                raise ImagePostError("INVALID_PLAN", "El destino no coincide con el arte o la música")
            scheduled_at = target.get("scheduled_at")
            scheduled = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00")) if isinstance(scheduled_at, str) else scheduled_at
            if scheduled and scheduled.tzinfo is None:
                raise ImagePostError("INVALID_PLAN", "scheduled_at debe incluir zona horaria")
            if scheduled:
                scheduled = scheduled.astimezone(timezone.utc)
            if not immediate and scheduled is None:
                raise ImagePostError("INVALID_PLAN", "Cada destino programado requiere scheduled_at")
            occurrence = f"manual:{client_request_id}" if immediate else f"{target.get('slot_id') or 'manual'}:{scheduled.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')}"
            idem_key = delivery_idempotency_key(record.post_id, revision, platform, alias, expected_placement, occurrence)
            if idem_key in seen_keys:
                continue
            seen_keys.add(idem_key)
            existing = next((d for d in record.deliveries if d.idempotency_key == idem_key), None)
            if existing:
                new_deliveries.append(existing)
                continue
            if scheduled and expected_placement in {"image", "carousel"}:
                timezone_name = target.get("timezone", "UTC")
                try:
                    local_date = scheduled.astimezone(ZoneInfo(timezone_name)).date()
                except Exception as exc:
                    raise ImagePostError("INVALID_PLAN", f"Zona horaria inválida: {timezone_name}") from exc
                await self._enforce_daily_ramp(record, platform, alias, expected_placement,
                                               target.get("slot_id"), local_date, scheduled)
            destination = "facebook" if platform == "facebook" else "instagram"
            copy_model = getattr(record.editorial.copy_data, destination)
            copy = copy_model.model_dump(mode="json")
            comment = copy.get("first_comment")
            comment_status = "pending" if comment and mapping.get("can_comment") else "skipped_permission" if comment else "not_requested"
            new_deliveries.append(Delivery(
                delivery_id=_id("del"), revision=revision, platform=platform, account_alias=alias,
                target_id=str(live["target_id"]), placement=expected_placement, scheduled_at=scheduled,
                timezone=target.get("timezone", "UTC"), slot_id=target.get("slot_id"), idempotency_key=idem_key,
                status=DeliveryStatus.QUEUED, caption=copy.get("caption", ""), hashtags=record.editorial.hashtags,
                first_comment=comment, comment_status=comment_status,
                alt_text_sent=[slide.alt_text_fb if platform == "facebook" else slide.alt_text_ig for slide in record.editorial.slides],
                created_at=now, updated_at=now,
            ))
        status = PostStatus.SCHEDULED if any(delivery.scheduled_at for delivery in new_deliveries) else PostStatus.APPROVED
        claimed, replayed = await self.repository.claim_deliveries(
            publication_id, request_key, request_hash, revision, new_deliveries, status.value
        )
        await self._queue_deliveries(publication_id, claimed, immediate=immediate)
        if not replayed:
            updated = self.repository.get(publication_id)
            await self._emit("image_post_changed", {
                "publication_id": publication_id,
                "status": updated.status.value if updated else status.value,
            })
        return claimed

    @staticmethod
    async def _queue_deliveries(publication_id: str, deliveries: list[Delivery], *, immediate: bool) -> None:
        from src.core.schedule import queue_repository
        from src.core.schedule.models import QueueSource

        for delivery in deliveries:
            if delivery.status != DeliveryStatus.QUEUED:
                continue
            await queue_repository.create(
                job_id=None, platform=delivery.platform, account_alias=delivery.account_alias,
                scheduled_at=delivery.scheduled_at.isoformat().replace("+00:00", "Z") if delivery.scheduled_at else None,
                source=QueueSource.IMMEDIATE if immediate else QueueSource.MANUAL,
                slot_id=delivery.slot_id, content_kind="reel" if delivery.placement == "reel" else delivery.placement,
                content_id=publication_id, delivery_id=delivery.delivery_id,
            )

    async def reconcile_queued_deliveries(self) -> int:
        """Recrea entradas ausentes tras una caída entre archivo y cola."""
        from src.core.schedule import queue_repository

        recovered = 0
        for summary in self._all_summaries():
            record = self.repository.get(summary["publication_id"])
            if record is None:
                continue
            missing = [
                delivery for delivery in record.deliveries
                if delivery.status == DeliveryStatus.QUEUED
                and queue_repository.find_for_delivery(delivery.delivery_id) is None
            ]
            if missing:
                await self._queue_deliveries(
                    record.publication_id, missing,
                    immediate=all(delivery.scheduled_at is None for delivery in missing),
                )
                recovered += len(missing)
        return recovered

    async def purge_publication(self, publication_id: str, policy: str) -> bool:
        """Elimina registro, plan, cola y JPEG/MP4 con hash comprobado."""
        if policy != "authorized_legal_purge":
            raise PermissionError("Purgar publicaciones requiere política explícita")
        record = self.repository.get(publication_id)
        if record is None:
            return False
        if any(delivery.status == DeliveryStatus.PUBLISHING for delivery in record.deliveries):
            raise ImagePostError("PURGE_IN_PROGRESS", "Hay una entrega publicándose", 409)

        assets = [*record.technical.slides]
        if record.technical.reel:
            assets.append(record.technical.reel)
        media = {asset.storage_key: asset.sha256 for asset in assets}
        for key, digest in media.items():
            try:
                stream = self.media.get(key)
            except FileNotFoundError:
                continue
            content = stream.read()
            if digest and not hmac.compare_digest(hashlib.sha256(content).hexdigest(), digest.lower()):
                raise ImagePostError("PURGE_MEDIA_CHANGED", "No se purgó un medio cuyo hash cambió", 409)

        from src.core.schedule import queue_repository

        for delivery in record.deliveries:
            await queue_repository.delete_for_delivery(delivery.delivery_id)
        for key, digest in media.items():
            self.media.delete(key, digest)
        deleted = await self.repository.delete(publication_id, policy)
        if deleted:
            await self._emit("image_post_purged", {"publication_id": publication_id})
        return deleted

    async def remove_publication(
        self, publication_id: str, reason: str, remover: Any, *, retry_api: bool = False
    ) -> PublicationRecord:
        """Retira cada entrega remota y conserva el estudio completo como archivo."""
        record = self.repository.get(publication_id)
        if record is None:
            raise ImagePostError("PUBLICATION_NOT_FOUND", "Publicación no encontrada", 404)
        if not reason.strip() or len(reason) > 300:
            raise ImagePostError("INVALID_REMOVAL_REASON", "Indica un motivo de hasta 300 caracteres", 422)
        if any(delivery.status == DeliveryStatus.PUBLISHING for delivery in record.deliveries):
            raise ImagePostError("PUBLISH_IN_PROGRESS", "Hay una entrega publicándose", 409)
        removable = {DeliveryStatus.PUBLISHED, DeliveryStatus.REMOVAL_PENDING_MANUAL,
                     DeliveryStatus.REMOVED, DeliveryStatus.REMOVED_API,
                     DeliveryStatus.REMOVED_MANUALLY}
        skipped = {DeliveryStatus.FAILED_PERMANENT, DeliveryStatus.CANCELLED}
        if not record.deliveries or not any(d.status in removable for d in record.deliveries) or any(
            d.status not in removable | skipped for d in record.deliveries
        ):
            raise ImagePostError("NOT_PUBLISHED", "Solo se retiran publicaciones ya enviadas", 409)

        for delivery in record.deliveries:
            if delivery.status in {DeliveryStatus.REMOVED, DeliveryStatus.REMOVED_API,
                                   DeliveryStatus.REMOVED_MANUALLY} | skipped:
                continue
            outcome = await (
                remover.remove_remote_delivery(delivery, retry_api=True)
                if retry_api and delivery.status == DeliveryStatus.REMOVAL_PENDING_MANUAL
                else remover.remove_remote_delivery(delivery)
            )
            now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            await self.repository.append_delivery_event(
                publication_id, delivery.delivery_id,
                {
                    "status": outcome["status"],
                    "removed_at": now if outcome["status"] == "removed" else None,
                    "removal_requested_at": delivery.removal_requested_at or now,
                    "removal_reason": delivery.removal_reason or reason.strip(),
                    "removal_instruction": outcome.get("instruction"),
                    "removal_graph_response": {
                        **(delivery.removal_graph_response or {}),
                        **(outcome.get("graph_response") or {}),
                    },
                },
            )
            if outcome["status"] == "removed" and delivery.remote.post_id:
                from src.core.schedule import queue_repository

                await queue_repository.mark_removed_by_post(
                    delivery.platform, delivery.account_alias, delivery.remote.post_id
                )
        record = self.repository.get(publication_id)
        assert record is not None
        pending = any(delivery.status == DeliveryStatus.REMOVAL_PENDING_MANUAL for delivery in record.deliveries)
        next_status = (PostStatus.REMOVAL_PENDING_MANUAL if pending else
                       PostStatus.PARTIAL if any(d.status in skipped for d in record.deliveries)
                       else PostStatus.REMOVED)
        if record.status != next_status:
            record = await self.repository.update(
                publication_id, {"status": next_status.value}, record.record_version
            )
        await self._emit("image_post_removal_changed", {"publication_id": publication_id})
        return record

    async def publish_delivery(self, delivery_id: str) -> Delivery:
        record, delivery = self._find_delivery(delivery_id)
        if delivery is None or record is None:
            raise ImagePostError("DELIVERY_NOT_FOUND", status_code=404)
        if delivery.status == DeliveryStatus.PUBLISHED:
            return delivery
        if delivery.status == DeliveryStatus.OUTCOME_UNKNOWN:
            raise ImagePostError("OUTCOME_UNKNOWN", status_code=409)
        if delivery.status != DeliveryStatus.QUEUED:
            raise ImagePostError("ALREADY_SENT", "La entrega ya no está en cola", 409)
        for _ in range(3):
            now = _now()
            try:
                claimed = await self.repository.append_delivery_event(
                    record.publication_id, delivery.delivery_id, {
                        "status": DeliveryStatus.PUBLISHING.value,
                        "attempt_count": delivery.attempt_count + 1,
                        "lease_until": (now + timedelta(minutes=10)).isoformat().replace("+00:00", "Z"),
                    }, expected_record_version=record.record_version,
                )
                delivery = next(item for item in claimed.deliveries if item.delivery_id == delivery_id)
                break
            except ValueError as exc:
                if "REVISION_CONFLICT" not in str(exc):
                    raise
                record, delivery = self._find_delivery(delivery_id)
                if record is None or delivery is None or delivery.status != DeliveryStatus.QUEUED:
                    raise ImagePostError("ALREADY_SENT", "La entrega ya fue reclamada", 409) from exc
        else:
            raise ImagePostError("REVISION_CONFLICT", "La entrega cambió durante el reclamo", 409)
        if delivery.placement == "reel" and not record.technical.reel:
            await self._set_delivery(record, delivery, {
                "status": DeliveryStatus.FAILED_PERMANENT.value,
                "last_error": {"code": "INVALID_IMAGE", "message": "Falta el manifiesto del Reel derivado."},
                "lease_until": None,
            })
            raise ImagePostError("INVALID_IMAGE", "Falta el manifiesto del Reel derivado", 422)
        spec = DeliverySpec(
            publication_id=record.publication_id, delivery_id=delivery.delivery_id,
            revision=delivery.revision, platform=delivery.platform, account_alias=delivery.account_alias,
            target_id=delivery.target_id, placement=delivery.placement, idempotency_key=delivery.idempotency_key,
            caption=delivery.caption, hashtags=delivery.hashtags, first_comment=delivery.first_comment,
            media_keys=([record.technical.reel.storage_key] if delivery.placement == "reel" and record.technical.reel else
                        [slide.storage_key for slide in record.technical.slides]),
            media_sha256=([record.technical.reel.sha256] if delivery.placement == "reel" and record.technical.reel and record.technical.reel.sha256 else
                          [slide.sha256 for slide in record.technical.slides]),
            alt_text=[text or "" for text in delivery.alt_text_sent],
            comment_allowed=delivery.comment_status == "pending",
            expected_at=delivery.scheduled_at or delivery.created_at,
            expected_duration_sec=(
                record.technical.reel.duration_sec
                if delivery.placement == "reel" and record.technical.reel else None
            ),
        )
        heartbeat = asyncio.create_task(self._delivery_heartbeat(delivery_id))
        try:
            publisher = self._publisher()
            result = await self._invoke(publisher.publish_image_delivery if hasattr(publisher, "publish_image_delivery") else publisher, spec)
            remote = RemoteResult.model_validate(_jsonable(result))
        except Exception as exc:
            if isinstance(exc, ImagePostError) and exc.code == "META_ADAPTER_UNAVAILABLE":
                await self._set_delivery(record, delivery, {
                    "status": DeliveryStatus.FAILED_PERMANENT.value,
                    "last_error": {"code": exc.code, "message": _safe_error(exc)}, "lease_until": None,
                })
                raise
            failure_kind = getattr(exc, "status", None)
            ambiguous = bool(getattr(exc, "outcome_unknown", False)) or failure_kind not in {
                "failed_permanent", "failed_retryable",
            }
            status = (
                DeliveryStatus.OUTCOME_UNKNOWN if ambiguous
                else DeliveryStatus.FAILED_PERMANENT if failure_kind == "failed_permanent"
                else DeliveryStatus.FAILED_RETRYABLE
            )
            details = getattr(exc, "details", None)
            code = details.get("code") if isinstance(details, dict) else None
            safe_message = _safe_error(exc)
            await self._set_delivery(record, delivery, {
                "status": status.value,
                "last_error": {"code": str(code or ("OUTCOME_UNKNOWN" if ambiguous else "META_UNAVAILABLE")),
                               "message": safe_message},
                "lease_until": None,
                "next_attempt_at": (_now() + timedelta(seconds=30)).isoformat().replace("+00:00", "Z") if ambiguous else None,
            })
            await self._emit("image_delivery_changed", {"delivery_id": delivery_id, "status": status.value})
            await self._recompute_post_status(record.publication_id)
            raise ImagePostError(
                "OUTCOME_UNKNOWN" if ambiguous else "META_FAILED_PERMANENT" if status == DeliveryStatus.FAILED_PERMANENT else "META_UNAVAILABLE",
                safe_message, 409 if ambiguous else 422 if status == DeliveryStatus.FAILED_PERMANENT else 503,
            ) from exc
        finally:
            heartbeat.cancel()
            try:
                await heartbeat
            except asyncio.CancelledError:
                pass
        final_status = DeliveryStatus.PUBLISHED
        published = await self._set_delivery(record, delivery, {
            "status": final_status.value, "remote": remote.model_dump(mode="json", exclude={"comment_status"}),
            "comment_status": remote.comment_status,
            "published_at": _now().isoformat().replace("+00:00", "Z"), "lease_until": None,
            "last_error": None,
        })
        await self._recompute_post_status(record.publication_id)
        await self._emit("image_delivery_changed", {"delivery_id": delivery_id, "status": final_status.value,
                                                       "post_id": remote.post_id, "permalink": remote.permalink})
        return published

    async def _delivery_heartbeat(self, delivery_id: str) -> None:
        """Renueva la lease del registro y de la cola mientras Graph siga trabajando."""
        from src.core.schedule import queue_repository

        while True:
            await asyncio.sleep(_DELIVERY_HEARTBEAT_SECONDS)
            record, delivery = self._find_delivery(delivery_id)
            if record is None or delivery is None or delivery.status != DeliveryStatus.PUBLISHING:
                return
            renewed_until = _now() + timedelta(minutes=2)
            await self._set_delivery(record, delivery, {
                "lease_until": renewed_until.isoformat().replace("+00:00", "Z"),
            })
            entry = queue_repository.find_for_delivery(delivery_id)
            if entry and entry.status.value == "publishing":
                await queue_repository.heartbeat(entry.entry_id, lease_until=renewed_until)

    def _find_delivery(self, delivery_id: str) -> tuple[PublicationRecord | None, Delivery | None]:
        for summary in self._all_summaries():
            record = self.repository.get(summary["publication_id"])
            if record:
                delivery = next((item for item in record.deliveries if item.delivery_id == delivery_id), None)
                if delivery:
                    return record, delivery
        return None, None

    def _all_summaries(self, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        results = []
        cursor = None
        while True:
            page = self.repository.list(filters, limit=100, cursor=cursor)
            results.extend(page.items)
            if not page.next_cursor:
                return results
            cursor = page.next_cursor

    async def _set_delivery(self, record: PublicationRecord, delivery: Delivery, event: dict[str, Any]) -> Delivery:
        await self.repository.append_delivery_event(record.publication_id, delivery.delivery_id, event)
        refreshed = self.repository.get(record.publication_id)
        return next(item for item in refreshed.deliveries if item.delivery_id == delivery.delivery_id)

    async def cancel_delivery(self, delivery_id: str) -> Delivery:
        record, delivery = self._find_delivery(delivery_id)
        if record is None or delivery is None:
            raise ImagePostError("DELIVERY_NOT_FOUND", status_code=404)
        if delivery.status != DeliveryStatus.QUEUED:
            raise ImagePostError("ALREADY_SENT", "La entrega ya no se puede cancelar", 409)
        from src.core.schedule import queue_repository
        entry = queue_repository.find_for_delivery(delivery_id)
        if entry:
            try:
                await queue_repository.cancel(entry.entry_id)
            except ValueError:
                raise ImagePostError("ALREADY_SENT", status_code=409) from None
        return await self._set_delivery(record, delivery, {"status": DeliveryStatus.CANCELLED.value})

    async def _recompute_post_status(self, publication_id: str) -> None:
        record = self.repository.get(publication_id)
        if record is None or not record.deliveries:
            return
        statuses = [delivery.status for delivery in record.deliveries]
        published = sum(status == DeliveryStatus.PUBLISHED for status in statuses)
        failed = sum(status in {DeliveryStatus.FAILED_RETRYABLE, DeliveryStatus.FAILED_PERMANENT, DeliveryStatus.OUTCOME_UNKNOWN} for status in statuses)
        status = (
            PostStatus.COMPLETED if published == len(statuses)
            else PostStatus.PARTIAL if published and failed
            else PostStatus.FAILED if failed == len(statuses)
            else PostStatus.SCHEDULED
        )
        await self.repository.update(publication_id, {
            "status": status.value, "updated_at": _now().isoformat().replace("+00:00", "Z"),
        }, record.record_version)

    async def reconcile_interrupted(self) -> int:
        """No reenvía `publishing` tras reinicio; deja la conciliación explícita."""
        changed = 0
        for summary in self._all_summaries():
            record = self.repository.get(summary["publication_id"])
            if not record:
                continue
            for delivery in record.deliveries:
                if delivery.status == DeliveryStatus.PUBLISHING and (not delivery.lease_until or delivery.lease_until <= _now()):
                    await self._set_delivery(record, delivery, {
                        "status": DeliveryStatus.OUTCOME_UNKNOWN.value,
                        "last_error": {"code": "OUTCOME_UNKNOWN", "message": "Se requiere conciliación remota después del reinicio."},
                        "lease_until": None,
                        "next_attempt_at": (_now() + timedelta(seconds=30)).isoformat().replace("+00:00", "Z"),
                    })
                    changed += 1
        return changed

    async def reconcile_delivery(
        self, delivery_id: str, *, manual: bool = False, remote_post_id: str | None = None,
    ) -> Delivery:
        """Consulta Meta con los IDs archivados; nunca ejecuta un POST de publicación."""
        record, delivery = self._find_delivery(delivery_id)
        if record is None or delivery is None:
            raise ImagePostError("DELIVERY_NOT_FOUND", status_code=404)
        if delivery.status != DeliveryStatus.OUTCOME_UNKNOWN:
            return delivery
        if remote_post_id:
            if not manual or not re.fullmatch(r"[A-Za-z0-9_]{1,100}", remote_post_id):
                raise ImagePostError("INVALID_REMOTE_ID", "ID remoto inválido", 422)
            if delivery.remote.post_id and delivery.remote.post_id != remote_post_id:
                raise ImagePostError("REMOTE_ID_CONFLICT", "La entrega ya tiene otro ID remoto", 409)
        now = _now()
        if delivery.lease_until and delivery.lease_until > now:
            return delivery
        if not manual and (delivery.attempt_count >= 6 or
                           delivery.next_attempt_at and delivery.next_attempt_at > now):
            return delivery
        # El CAS impide que dos procesos consulten y escriban el mismo resultado a la vez.
        try:
            claimed = await self.repository.append_delivery_event(
                record.publication_id, delivery_id,
                {"lease_until": (now + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
                 "attempt_count": delivery.attempt_count + 1},
                expected_record_version=record.record_version,
            )
        except ValueError:
            return self._find_delivery(delivery_id)[1] or delivery
        delivery = next(item for item in claimed.deliveries if item.delivery_id == delivery_id)
        remote_data = delivery.remote.model_dump(mode="json")
        lookup_remote = {**remote_data, "post_id": remote_post_id} if remote_post_id else remote_data
        spec = DeliverySpec(
            publication_id=record.publication_id, delivery_id=delivery.delivery_id,
            revision=delivery.revision, platform=delivery.platform,
            account_alias=delivery.account_alias, target_id=delivery.target_id,
            placement=delivery.placement, idempotency_key=delivery.idempotency_key,
            caption=delivery.caption, hashtags=delivery.hashtags,
            first_comment=delivery.first_comment,
            media_keys=(
                [record.technical.reel.storage_key]
                if delivery.placement == "reel" and record.technical.reel
                else [slide.storage_key for slide in record.technical.slides]
            ),
            media_sha256=(
                [record.technical.reel.sha256]
                if delivery.placement == "reel" and record.technical.reel and record.technical.reel.sha256
                else [slide.sha256 for slide in record.technical.slides]
            ),
            alt_text=[text or "" for text in delivery.alt_text_sent],
            comment_allowed=False,
            expected_at=delivery.scheduled_at or delivery.created_at,
            expected_duration_sec=(
                record.technical.reel.duration_sec
                if delivery.placement == "reel" and record.technical.reel else None
            ),
        )
        try:
            result = await self._invoke(self._publisher().reconcile_image_delivery, spec, lookup_remote)
            confirmed = RemoteResult.model_validate(_jsonable(result))
        except Exception as exc:
            failure_kind = getattr(exc, "status", None)
            details = getattr(exc, "details", None)
            confirmed = None
            error = {"code": str(details.get("code") if isinstance(details, dict) and details.get("code") else
                                 "RECONCILIATION_PENDING"), "message": _safe_error(exc)}
            status = (DeliveryStatus.FAILED_PERMANENT if failure_kind == "failed_permanent"
                      else DeliveryStatus.OUTCOME_UNKNOWN)
            if remote_post_id and not delivery.remote.post_id:
                status = DeliveryStatus.OUTCOME_UNKNOWN
            else:
                remote_data = _jsonable(getattr(exc, "remote", None)) or remote_data
        else:
            status = DeliveryStatus.PUBLISHED
            error = None
            remote_data = confirmed.model_dump(mode="json", exclude={"comment_status"})
        delay = min(30 * 2 ** min(max(delivery.attempt_count - 1, 0), 8), 3600)
        updated = await self._set_delivery(claimed, delivery, {
            "status": status.value, "remote": remote_data,
            "comment_status": confirmed.comment_status if confirmed else delivery.comment_status,
            "last_error": error, "lease_until": None,
            "next_attempt_at": (_now() + timedelta(seconds=delay)).isoformat().replace("+00:00", "Z")
            if status == DeliveryStatus.OUTCOME_UNKNOWN and delivery.attempt_count < 6 else None,
            "published_at": _now().isoformat().replace("+00:00", "Z") if confirmed else delivery.published_at,
        })
        if status != DeliveryStatus.OUTCOME_UNKNOWN:
            await self._recompute_post_status(record.publication_id)
            from src.core.schedule import queue_repository
            entry = queue_repository.find_for_delivery(delivery_id)
            if entry:
                if status == DeliveryStatus.PUBLISHED:
                    await queue_repository.mark_published(entry.entry_id, remote_data.get("post_id") or "",
                                                          remote_data.get("permalink") or "")
                else:
                    await queue_repository.mark_failed(entry.entry_id, error["message"] if error else "Meta confirmó fallo")
        await self._emit("image_delivery_changed", {"delivery_id": delivery_id, "status": status.value})
        return updated

    async def reconcile_due_deliveries(self, now: datetime | None = None) -> int:
        """Job periódico con backoff; una entrega ambigua nunca se vuelve a enviar."""
        now = now or _now()
        changed = 0
        for summary in self._all_summaries():
            record = self.repository.get(summary["publication_id"])
            if not record:
                continue
            for delivery in record.deliveries:
                if (delivery.status == DeliveryStatus.OUTCOME_UNKNOWN
                        and delivery.attempt_count < 6
                        and (not delivery.next_attempt_at or delivery.next_attempt_at <= now)
                        and (not delivery.lease_until or delivery.lease_until <= now)):
                    try:
                        await self.reconcile_delivery(delivery.delivery_id)
                        changed += 1
                    except Exception as exc:
                        logger.warning("image_delivery_reconcile_error", delivery_id=delivery.delivery_id,
                                       error=_safe_error(exc))
        return changed

    def _records_for_category(self, category_id: str) -> list[PublicationRecord]:
        return [record for item in self._all_summaries({"category_id": category_id})
                if (record := self.repository.get(item["publication_id"]))]

    async def _enforce_daily_ramp(
        self, record: PublicationRecord, platform: str, alias: str, placement: str,
        slot_id: str | None, local_date: date, scheduled: datetime,
    ) -> None:
        from src.core.schedule import slot_repository

        slot = slot_repository.get(slot_id) if slot_id else None
        records = self._records_for_category(record.editorial.category_id)
        rollout_start = (
            datetime.fromisoformat(slot.created_at.replace("Z", "+00:00")) if slot
            else min((item.created_at for item in records), default=record.created_at)
        )
        stable = not any(
            delivery.status in {DeliveryStatus.FAILED_RETRYABLE, DeliveryStatus.FAILED_PERMANENT,
                                DeliveryStatus.OUTCOME_UNKNOWN}
            for item in records for delivery in item.deliveries
            if delivery.platform == platform and delivery.account_alias == alias
        )
        if stable:
            snapshots = [snapshot for item in records for snapshot in item.metrics_snapshots
                         if snapshot.status == "ok" and snapshot.metrics is not None
                         and any(snapshot.metrics.get(name) is not None for name in ("saves", "shares"))]
            stable = bool(snapshots)
        limit = daily_image_limit(rollout_start, scheduled, stable=stable)
        count = 0
        zone = ZoneInfo(slot.timezone if slot else "UTC")
        for item in records:
            for delivery in item.deliveries:
                if delivery.platform != platform or delivery.account_alias != alias:
                    continue
                if delivery.placement not in {"image", "carousel"} or delivery.status == DeliveryStatus.CANCELLED:
                    continue
                if delivery.scheduled_at and delivery.scheduled_at.astimezone(zone).date() == local_date:
                    count += 1
        if count >= limit:
            raise ImagePostError("RAMP_LIMIT", f"La rampa permite {limit} publicación(es) de imagen para esta cuenta en {local_date}.", 409)

    async def fill_due_image_slots(self, now: datetime) -> int:
        """Rellena solo slots de imagen ya vencidos y con piezas aprobadas."""
        from src.core.schedule import queue_repository, slot_repository

        filled = 0
        slots = slot_repository.list_slots(enabled=True)
        for slot in slots:
            if slot.content_kind == "video" or not slot.category_id:
                continue
            local_now = now.astimezone(ZoneInfo(slot.timezone))
            if local_now.weekday() not in slot.days:
                continue
            for hhmm in slot.times:
                occurrence = local_occurrence_to_utc(local_now.date(), hhmm, slot.timezone)
                if occurrence is None or occurrence > now.astimezone(timezone.utc):
                    continue
                scheduled_iso = occurrence.isoformat().replace("+00:00", "Z")
                if queue_repository.find_pending_for_slot_occurrence(slot.slot_id, scheduled_iso):
                    continue
                try:
                    self.account_mapping.resolve_account(slot.category_id, slot.platform, slot.account_alias)
                except LookupError:
                    logger.warning("image_slot_unmapped_account", slot_id=slot.slot_id)
                    continue
                records = self._records_for_category(slot.category_id)
                candidates = []
                for record in records:
                    if record.status != PostStatus.APPROVED:
                        continue
                    if slot.content_kind == "image" and record.technical.kind != "image":
                        continue
                    if slot.content_kind == "carousel" and record.technical.kind != "carousel":
                        continue
                    if slot.content_kind == "reel" and record.technical.music.mode != "convert_to_reel":
                        continue
                    if any(delivery.platform == slot.platform and delivery.account_alias == slot.account_alias
                           and delivery.status in {DeliveryStatus.QUEUED, DeliveryStatus.PUBLISHING, DeliveryStatus.PUBLISHED}
                           for delivery in record.deliveries):
                        continue
                    candidates.append(record)
                candidate_id = stable_plan_choice([r.publication_id for r in candidates], slot.category_id, local_now.date())
                candidate = next((r for r in candidates if r.publication_id == candidate_id), None)
                if candidate is None:
                    continue
                if slot.content_kind != "reel":
                    try:
                        await self._enforce_daily_ramp(candidate, slot.platform, slot.account_alias,
                                                       candidate.technical.kind, slot.slot_id,
                                                       local_now.date(), occurrence)
                    except ImagePostError:
                        continue
                await self.schedule_deliveries(
                    candidate.publication_id, candidate.revision,
                    [{"platform": slot.platform, "account_alias": slot.account_alias,
                      "placement": slot.content_kind, "scheduled_at": scheduled_iso,
                      "slot_id": slot.slot_id, "timezone": slot.timezone}],
                    client_request_id=occurrence_key(slot.slot_id, occurrence), immediate=False,
                )
                filled += 1
        return filled

    async def _emit(self, event_type: str, data: dict[str, Any]) -> None:
        try:
            from src.core.realtime.event_bus import get_event_bus
            from src.core.realtime.events import RealtimeEvent
            await get_event_bus().publish(RealtimeEvent(type=event_type, data=data))
        except Exception as exc:
            logger.debug("image_post_event_not_sent", event=event_type, error=_safe_error(exc))

    async def publish_now(self, delivery_id: str) -> Delivery:
        record, delivery = self._find_delivery(delivery_id)
        if record is None or delivery is None:
            raise ImagePostError("DELIVERY_NOT_FOUND", status_code=404)
        if delivery.status != DeliveryStatus.QUEUED:
            raise ImagePostError("ALREADY_SENT", status_code=409)
        from src.core.schedule import queue_repository
        entry = queue_repository.find_for_delivery(delivery_id)
        if entry is None:
            raise ImagePostError("DELIVERY_NOT_QUEUED", status_code=409)
        due_at = _now().isoformat().replace("+00:00", "Z")
        entry = await queue_repository.reschedule(entry.entry_id, due_at)
        if entry is None:
            raise ImagePostError("ALREADY_SENT", status_code=409)
        if delivery.scheduled_at is not None:
            delivery = await self._set_delivery(record, delivery, {"scheduled_at": None})
        return delivery

    def _require_publishable(
        self, record: PublicationRecord, rendered_slides: list[Any], editorial: EditorialRecord
    ) -> ValidationResult:
        claims = [claim for slide in record.technical.composition_plan.slides for claim in slide.claim_refs]
        sources = {source.source_id: source for source in editorial.sources}
        if not claims or any(
            not claim.url or not claim.locator or claim.source_id not in sources
            or sources[claim.source_id].url != claim.url
            or claim.id not in sources[claim.source_id].claim_ids
            for claim in claims
        ):
            raise ImagePostError("UNSOURCED_CLAIM", status_code=422)
        media = [item for slide in record.technical.composition_plan.slides for item in slide.media]
        from src.core.image_posts.image_licensing import accepted_license
        if any(not accepted_license(item.license_id) or not item.author or not item.url for item in media):
            raise ImagePostError("UNLICENSED_MEDIA", status_code=422)
        captions = (
            editorial.copy_data.facebook.caption,
            editorial.copy_data.instagram.caption,
        )
        if any(
            any(part not in caption for part in (item.author, item.license_id, item.url))
            for item in media for caption in captions
        ):
            raise ImagePostError("UNLICENSED_MEDIA", "Falta el crédito de la foto en un caption", 422)
        for slide in record.technical.composition_plan.slides:
            visible_credits = [text.value for text in slide.texts if text.role == "credit"]
            for item in slide.media:
                license_name = item.license_id.casefold()
                requires_attribution = "cc0" not in license_name and bool(re.search(r"\bcc\s*by\b|\battribution\b", license_name))
                if requires_attribution and (not item.license_url or not item.changes):
                    raise ImagePostError(
                        "UNLICENSED_MEDIA", "Falta el enlace de licencia o la declaración de cambios CC BY", 422
                    )
                if requires_attribution and any(
                    part not in caption for part in (item.license_url or "", item.changes or "")
                    for caption in captions
                ):
                    raise ImagePostError(
                        "UNLICENSED_MEDIA", "Cada caption debe incluir URL de licencia y cambios de la foto", 422
                    )
                if requires_attribution:
                    required = (item.author, item.license_id, item.license_url or "", item.changes or "")
                    if not any(all(part in credit for part in required) for credit in visible_credits):
                        raise ImagePostError(
                            "UNLICENSED_MEDIA", "La lámina debe mostrar autor, licencia, enlace y cambios CC BY", 422
                        )
        if not rendered_slides or len(editorial.slides) != len(rendered_slides):
            raise ImagePostError("INVALID_IMAGE", "Láminas publicadas y manifiesto no coinciden", 422)
        if any(not slide.alt_text_fb or not slide.alt_text_ig for slide in editorial.slides):
            raise ImagePostError("INVALID_PLAN", "Falta alt text por lámina y red", 422)
        self._validate_caption_numbers(record, editorial)
        return ValidationResult(
            name="claims_sources_license", version="1", passed=True, checked_at=_now(),
            details={"claim_count": len(claims), "source_count": len(sources),
                     "license_count": len(media)},
        )

    def _validate_caption_numbers(self, record: PublicationRecord, editorial: EditorialRecord) -> None:
        plan_claims = {
            claim.id: claim
            for slide in record.technical.composition_plan.slides
            for claim in slide.claim_refs
        }
        cited_texts: dict[str, str] = {}
        if self.material_source is not None:
            material = self.material_source.load_verified_material(
                record.editorial.source_video_id, record.editorial.category_id
            )
            if material is not None:
                cited_texts = _verified_fact_texts(material.plan_text)
        for platform in ("facebook", "instagram"):
            network = getattr(editorial.copy_data, platform)
            for label, content, refs in (
                ("caption", network.caption, network.caption_claim_refs),
                ("primer comentario", network.first_comment or "", network.first_comment_claim_refs),
            ):
                content_numbers = _number_values(_caption_factual_text(content))
                if not content_numbers:
                    continue
                fact_numbers = set()
                for claim_id in refs:
                    claim = plan_claims.get(claim_id)
                    fact = cited_texts.get(claim_id)
                    if claim is not None and fact is not None:
                        fact_numbers.update(_number_values(fact))
                unsupported = sorted(content_numbers - fact_numbers)
                if unsupported:
                    values = ", ".join(unsupported)
                    raise ImagePostError(
                        "UNSOURCED_CAPTION_NUMBER",
                        f"El {label} de {platform} contiene cifras que no aparecen en los hechos citados: {values}.",
                        422,
                    )


def _safe_error(exc: Exception) -> str:
    text = redact_persisted_text(str(exc).replace("\n", " "))
    for secret in (settings.nexa_internal_token, settings.publisher_encryption_key):
        if secret:
            text = text.replace(secret, "[redacted]")
    return text[:500]
