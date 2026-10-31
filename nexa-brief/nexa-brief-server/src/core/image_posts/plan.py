"""Esquema estricto y hash canónico de los planes de imagen."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any, Mapping


class ImagePlanError(ValueError):
    """El plan no cumple el contrato de imagen."""


def _object(value: Any, name: str, allowed: set[str], required: set[str]) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ImagePlanError(f"{name} debe ser un objeto")
    unknown = set(value) - allowed
    missing = required - set(value)
    if unknown:
        raise ImagePlanError(f"{name} contiene campos desconocidos: {sorted(unknown)}")
    if missing:
        raise ImagePlanError(f"{name} no contiene campos requeridos: {sorted(missing)}")
    return value


def _text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ImagePlanError(f"{name} debe ser texto no vacío")
    return value.strip()


def _optional_text(value: Any, name: str) -> str | None:
    if value is None:
        return None
    return _text(value, name)


def _optional_https(value: Any, name: str) -> str | None:
    result = _optional_text(value, name)
    if result is not None and not result.startswith("https://"):
        raise ImagePlanError(f"{name} debe usar HTTPS")
    return result


def _hash(value: Any, name: str) -> str:
    result = _text(value, name).lower()
    if not re.fullmatch(r"[a-f0-9]{64}", result):
        raise ImagePlanError(f"{name} debe ser SHA-256 hexadecimal")
    return result


def _strings(value: Any, name: str) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise ImagePlanError(f"{name} debe ser una lista de textos no vacíos")
    return tuple(item.strip() for item in value)


@dataclass(frozen=True)
class ClaimRef:
    id: str
    source_id: str
    locator: str
    url: str

    @classmethod
    def from_dict(cls, raw: Any) -> ClaimRef:
        data = _object(raw, "claim_ref", {"id", "source_id", "locator", "url"}, {"id", "source_id", "locator", "url"})
        url = _text(data["url"], "claim_ref.url")
        if not url.startswith("https://"):
            raise ImagePlanError("claim_ref.url debe usar HTTPS")
        return cls(
            id=_text(data["id"], "claim_ref.id"),
            source_id=_text(data["source_id"], "claim_ref.source_id"),
            locator=_text(data["locator"], "claim_ref.locator"),
            url=url,
        )

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "source_id": self.source_id, "locator": self.locator, "url": self.url}


@dataclass(frozen=True)
class MediaRef:
    asset_id: str
    sha256: str
    license_id: str
    author: str
    url: str
    license_url: str | None = None
    changes: str | None = None
    focus: tuple[float, float] = (0.5, 0.5)

    @classmethod
    def from_dict(cls, raw: Any) -> MediaRef:
        data = _object(
            raw,
            "media",
            {"asset_id", "sha256", "license_id", "license_url", "author", "url", "changes", "focus"},
            {"asset_id", "sha256", "license_id", "author", "url"},
        )
        focus = data.get("focus", [0.5, 0.5])
        if not isinstance(focus, list) or len(focus) != 2:
            raise ImagePlanError("media.focus debe tener coordenadas x e y")
        try:
            coordinates = (float(focus[0]), float(focus[1]))
        except (TypeError, ValueError) as exc:
            raise ImagePlanError("media.focus debe ser numérico") from exc
        if any(value < 0 or value > 1 for value in coordinates):
            raise ImagePlanError("media.focus debe estar entre 0 y 1")
        url = _text(data["url"], "media.url")
        if not url.startswith("https://"):
            raise ImagePlanError("media.url debe usar HTTPS")
        return cls(
            asset_id=_text(data["asset_id"], "media.asset_id"),
            sha256=_hash(data["sha256"], "media.sha256"),
            license_id=_text(data["license_id"], "media.license_id"),
            license_url=_optional_https(data.get("license_url"), "media.license_url"),
            author=_text(data["author"], "media.author"),
            url=url,
            changes=_optional_text(data.get("changes"), "media.changes"),
            focus=coordinates,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "sha256": self.sha256,
            "license_id": self.license_id,
            "license_url": self.license_url,
            "author": self.author,
            "url": self.url,
            "changes": self.changes,
            "focus": list(self.focus),
        }


@dataclass(frozen=True)
class TextItem:
    role: str
    value: str
    claim_refs: tuple[str, ...]

    @classmethod
    def from_dict(cls, raw: Any) -> TextItem:
        data = _object(raw, "text", {"role", "value", "claim_refs"}, {"role", "value", "claim_refs"})
        refs = _strings(data["claim_refs"], "text.claim_refs")
        return cls(
            role=_text(data["role"], "text.role"),
            value=_text(data["value"], "text.value"),
            claim_refs=refs,
        )

    def to_dict(self) -> dict[str, Any]:
        return {"role": self.role, "value": self.value, "claim_refs": list(self.claim_refs)}


@dataclass(frozen=True)
class Element:
    type: str
    asset_id: str | None = None
    value: str | None = None

    @classmethod
    def from_dict(cls, raw: Any) -> Element:
        data = _object(raw, "element", {"type", "asset_id", "value"}, {"type"})
        kind = _text(data["type"], "element.type")
        asset_id = data.get("asset_id")
        value = data.get("value")
        if asset_id is not None:
            asset_id = _text(asset_id, "element.asset_id")
        if value is not None:
            value = _text(value, "element.value")
        if kind == "photo" and not asset_id:
            raise ImagePlanError("element photo requiere asset_id")
        return cls(type=kind, asset_id=asset_id, value=value)

    def to_dict(self) -> dict[str, str]:
        result = {"type": self.type}
        if self.asset_id:
            result["asset_id"] = self.asset_id
        if self.value:
            result["value"] = self.value
        return result


@dataclass(frozen=True)
class SlidePlan:
    slide_id: str
    order: int
    layout: str
    elements: tuple[Element, ...]
    texts: tuple[TextItem, ...]
    media: tuple[MediaRef, ...]
    claim_refs: tuple[ClaimRef, ...]

    @classmethod
    def from_dict(cls, raw: Any) -> SlidePlan:
        data = _object(
            raw,
            "slide",
            {"slide_id", "order", "layout", "elements", "texts", "media", "claim_refs"},
            {"slide_id", "order", "layout", "elements", "texts", "media", "claim_refs"},
        )
        order = data["order"]
        if not isinstance(order, int) or order < 1:
            raise ImagePlanError("slide.order debe ser un entero positivo")
        for key in ("elements", "texts", "media", "claim_refs"):
            if not isinstance(data[key], list):
                raise ImagePlanError(f"slide.{key} debe ser una lista")
        return cls(
            slide_id=_text(data["slide_id"], "slide.slide_id"),
            order=order,
            layout=_text(data["layout"], "slide.layout"),
            elements=tuple(Element.from_dict(item) for item in data["elements"]),
            texts=tuple(TextItem.from_dict(item) for item in data["texts"]),
            media=tuple(MediaRef.from_dict(item) for item in data["media"]),
            claim_refs=tuple(ClaimRef.from_dict(item) for item in data["claim_refs"]),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "slide_id": self.slide_id,
            "order": self.order,
            "layout": self.layout,
            "elements": [item.to_dict() for item in self.elements],
            "texts": [item.to_dict() for item in self.texts],
            "media": [item.to_dict() for item in self.media],
            "claim_refs": [item.to_dict() for item in self.claim_refs],
        }


@dataclass(frozen=True)
class ImagePlan:
    schema_version: int
    plan_id: str
    category_id: str
    source_video_id: str
    source_revision: str
    style_id: str
    style_version: str
    template_id: str
    format: str
    slides: tuple[SlidePlan, ...]
    seed: int
    renderer_version: str

    @classmethod
    def from_dict(cls, raw: Any) -> ImagePlan:
        data = _object(
            raw,
            "ImagePlan",
            {
                "schema_version",
                "plan_id",
                "category_id",
                "source_video_id",
                "source_revision",
                "style_id",
                "style_version",
                "template_id",
                "format",
                "slides",
                "seed",
                "renderer_version",
            },
            {
                "schema_version",
                "plan_id",
                "category_id",
                "source_video_id",
                "source_revision",
                "style_id",
                "style_version",
                "template_id",
                "format",
                "slides",
                "seed",
                "renderer_version",
            },
        )
        if data["schema_version"] != 1:
            raise ImagePlanError("schema_version debe ser 1")
        if not isinstance(data["slides"], list):
            raise ImagePlanError("slides debe ser una lista")
        seed = data["seed"]
        if not isinstance(seed, int):
            raise ImagePlanError("seed debe ser entero")
        return cls(
            schema_version=1,
            plan_id=_text(data["plan_id"], "plan_id"),
            category_id=_text(data["category_id"], "category_id"),
            source_video_id=_text(data["source_video_id"], "source_video_id"),
            source_revision=_text(data["source_revision"], "source_revision"),
            style_id=_text(data["style_id"], "style_id"),
            style_version=_text(data["style_version"], "style_version"),
            template_id=_text(data["template_id"], "template_id"),
            format=_text(data["format"], "format"),
            slides=tuple(SlidePlan.from_dict(item) for item in data["slides"]),
            seed=seed,
            renderer_version=_text(data["renderer_version"], "renderer_version"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "plan_id": self.plan_id,
            "category_id": self.category_id,
            "source_video_id": self.source_video_id,
            "source_revision": self.source_revision,
            "style_id": self.style_id,
            "style_version": self.style_version,
            "template_id": self.template_id,
            "format": self.format,
            "slides": [slide.to_dict() for slide in self.slides],
            "seed": self.seed,
            "renderer_version": self.renderer_version,
        }


def parse_image_plan(raw: Mapping[str, Any] | ImagePlan) -> ImagePlan:
    return raw if isinstance(raw, ImagePlan) else ImagePlan.from_dict(raw)


def canonical_json(value: Any) -> bytes:
    """Serializa JSON sin variaciones por orden de claves o espacios."""
    if hasattr(value, "to_dict"):
        value = value.to_dict()
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def plan_hash(plan: ImagePlan | Mapping[str, Any], style: Any) -> str:
    """Hash del plan, estilo y referencias hashadas de fuentes/medios."""
    normalized = parse_image_plan(plan)
    style_data = style.to_dict() if hasattr(style, "to_dict") else style
    return hashlib.sha256(canonical_json({"plan": normalized.to_dict(), "style": style_data})).hexdigest()


def build_image_plan(
    *,
    category_id: str,
    source_video_id: str,
    source_revision: str,
    template_id: str,
    slides: list[Mapping[str, Any]],
    style: Any,
    seed: int = 0,
    renderer_version: str = "image-stage-1.0.0",
) -> ImagePlan:
    """Crea un plan estable desde láminas editoriales ya ligadas a sus fuentes."""
    style_data = style.to_dict() if hasattr(style, "to_dict") else style
    style_category = style_data.get("category_id")
    if category_id != style_category:
        raise ImagePlanError("La categoría del estilo y del plan deben coincidir")
    draft = {
        "schema_version": 1,
        "category_id": category_id,
        "source_video_id": source_video_id,
        "source_revision": source_revision,
        "style_id": style_data["style_id"],
        "style_version": style_data["version"],
        "template_id": template_id,
        "format": "4:5",
        "slides": list(slides),
        "seed": seed,
        "renderer_version": renderer_version,
    }
    stable_id = hashlib.sha256(canonical_json(draft)).hexdigest()[:20]
    return ImagePlan.from_dict({"plan_id": f"plan_{stable_id}", **draft})
