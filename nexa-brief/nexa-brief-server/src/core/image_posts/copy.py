"""Copy para posts de imagen a partir de material v2 ya verificado."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .plan import ImagePlan, parse_image_plan


class CopyError(ValueError):
    """El paquete fuente no permite redactar un copy verificable."""


@dataclass(frozen=True)
class PlatformCopy:
    caption: str
    first_comment: str | None
    alt_texts: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "caption": self.caption,
            "first_comment": self.first_comment,
            "alt_texts": list(self.alt_texts),
        }


@dataclass(frozen=True)
class ImageCopy:
    title: str
    hashtags: tuple[str, ...]
    facebook: PlatformCopy
    instagram: PlatformCopy
    claim_refs: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "hashtags": list(self.hashtags),
            "claim_refs": list(self.claim_refs),
            "facebook": self.facebook.to_dict(),
            "instagram": self.instagram.to_dict(),
        }


def _clean_hashtags(publish: Mapping[str, Any]) -> tuple[str, ...]:
    raw = publish.get("tags", [])
    candidates: list[str] = []
    if isinstance(raw, Mapping):
        for value in raw.values():
            if isinstance(value, list):
                candidates.extend(str(item) for item in value)
            elif isinstance(value, str):
                candidates.extend(value.split())
    elif isinstance(raw, list):
        candidates.extend(str(item) for item in raw)
    tags = []
    for item in candidates:
        tag = item.strip()
        if not tag:
            continue
        if not tag.startswith("#"):
            tag = "#" + tag
        if tag[1:].replace("_", "").isalnum() and tag not in tags:
            tags.append(tag)
    return tuple(tags[:5])


def _pinned_comment(publish: Mapping[str, Any]) -> str | None:
    raw = publish.get("pinned_comment")
    if isinstance(raw, str):
        return raw.strip() or None
    if isinstance(raw, Mapping):
        text = raw.get("text") or raw.get("comment") or raw.get("copy")
        return text.strip() if isinstance(text, str) and text.strip() else None
    return None


def _role(slide: Any, role: str) -> str | None:
    return next((item.value for item in slide.texts if item.role == role), None)


def _alt_text(slide: Any) -> str:
    parts = []
    for role in ("headline", "stat", "body", "label"):
        value = _role(slide, role)
        if value:
            parts.append(value.strip())
    photo = next((item.value for item in slide.elements if item.type == "photo" and item.value), None)
    if photo:
        parts.append(photo.strip())
    return ". ".join(parts).strip()[:1000]


def build_copy(
    plan: ImagePlan | Mapping[str, Any],
    publish_v2: Mapping[str, Any],
    *,
    title_override: str | None = None,
    question_override: str | None = None,
    copy_claim_refs: Sequence[str] | None = None,
) -> ImageCopy:
    """Toma el copy del paquete v2; el override es una decisión editorial explícita."""
    image_plan = parse_image_plan(plan)
    if publish_v2.get("schema_version") != 2:
        raise CopyError("Se requiere publish.json v2")
    titles = publish_v2.get("titles")
    description = publish_v2.get("description")
    if not isinstance(titles, Mapping) or not isinstance(description, Mapping):
        raise CopyError("publish.json no contiene títulos y descripción v2")
    facebook_title = titles.get("facebook")
    title = title_override
    if not title and isinstance(facebook_title, Mapping):
        title = facebook_title.get("title") or facebook_title.get("first_line")
    if not title:
        chosen = titles.get("chosen")
        options = titles.get("youtube")
        if isinstance(options, list):
            title = next((item.get("text") for item in options if isinstance(item, Mapping) and item.get("option") == chosen), None)
    if not isinstance(title, str) or not title.strip():
        raise CopyError("No se encontró un título editorial en publish.json")
    if not any(slide.claim_refs for slide in image_plan.slides):
        raise CopyError("El plan no tiene afirmaciones enlazadas a fuentes")
    all_claims = {claim.id for slide in image_plan.slides for claim in slide.claim_refs}
    requested_claims = tuple(copy_claim_refs) if copy_claim_refs is not None else tuple(sorted(all_claims))
    if not requested_claims or any(claim not in all_claims for claim in requested_claims):
        raise CopyError("El copy referencia afirmaciones que no están en el plan")
    if not publish_v2.get("sources"):
        raise CopyError("publish.json no registra fuentes")
    tags = _clean_hashtags(publish_v2)
    question = question_override if question_override is not None else description.get("question")
    question = question.strip() if isinstance(question, str) else ""
    title = title.strip()
    if image_plan.template_id == "five_slides":
        editorial_line = "Desliza las cinco láminas y revisa el contexto y las fuentes de cada dato."
    else:
        editorial_line = next(
            (value for slide in image_plan.slides for value in [_role(slide, "body")] if value),
            "",
        )
    sources = []
    seen_sources = set()
    for slide in image_plan.slides:
        for claim in slide.claim_refs:
            if claim.id not in requested_claims or claim.source_id in seen_sources:
                continue
            sources.append(claim.url)
            seen_sources.add(claim.source_id)
    if not sources:
        raise CopyError("Las afirmaciones del copy no tienen URL")
    source_line = "Fuentes: " + " · ".join(sources)
    credits = []
    seen_media = set()
    for slide in image_plan.slides:
        for media in slide.media:
            key = (media.author, media.license_id, media.url)
            if key in seen_media:
                continue
            seen_media.add(key)
            credits.append(f"{media.author} ({media.license_id}) — {media.url}")
    credits_line = "Créditos visuales: " + " · ".join(credits) if credits else ""
    caption_base = "\n\n".join(part for part in (title, editorial_line, source_line, credits_line, question) if part)
    caption_fb = caption_base
    caption_ig = caption_base
    if tags:
        caption_ig = f"{caption_ig}\n\n{' '.join(tags)}"
    first_comment = _pinned_comment(publish_v2)
    facebook_alt = tuple(_alt_text(slide) for slide in image_plan.slides)
    instagram_alt = facebook_alt
    if any(not alt for alt in facebook_alt):
        raise CopyError("Cada lámina necesita texto o descripción visual para el alt text")
    return ImageCopy(
        title=title,
        hashtags=tags,
        facebook=PlatformCopy(caption_fb, first_comment, facebook_alt),
        instagram=PlatformCopy(caption_ig, first_comment, instagram_alt),
        claim_refs=requested_claims,
    )
