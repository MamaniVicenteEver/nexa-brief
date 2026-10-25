"""Validaciones editoriales, de medios y de archivos exportados."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Mapping

from PIL import Image, ImageCms

from .copy import ImageCopy
from .plan import ImagePlan, parse_image_plan
from .style import StyleSystem


MAX_JPEG_BYTES = 3_984_588
SERVER_ROOT = Path(__file__).resolve().parents[3]
NICHES_PATH = SERVER_ROOT / "niches.json"


@dataclass(frozen=True)
class ValidationReport:
    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()

    @property
    def passed(self) -> bool:
        return not self.errors

    def require(self) -> None:
        if self.errors:
            raise ValueError("; ".join(self.errors))

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "errors": list(self.errors),
            "warnings": list(self.warnings),
        }


# Roles de texto de una lámina. Los factuales afirman algo y deben citar su hecho verificado;
# los otros son navegación o marca (tema, paso, "Deslizá", @cuenta, llamada a la acción).
FACTUAL_ROLES = frozenset({"headline", "stat", "body", "source", "label"})
NON_FACTUAL_ROLES = frozenset({"kicker", "cta", "handle", "step", "swipe", "tagline", "credit"})

def _niche_designs(category_id: str) -> set[str]:
    try:
        categories = json.loads(NICHES_PATH.read_text(encoding="utf-8")).get("categories", {})
    except (OSError, json.JSONDecodeError):
        return set()
    category = categories.get(category_id, {})
    return set(category.get("designs") or [])


def validate_plan(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem,
    *,
    media_bytes: Mapping[str, bytes] | None = None,
) -> ValidationReport:
    errors: list[str] = []
    image_plan = parse_image_plan(plan)
    if image_plan.category_id != style.category_id:
        errors.append("La categoría del plan no coincide con el estilo")
    if image_plan.style_id != style.style_id or image_plan.style_version != style.version:
        errors.append("El plan referencia una versión de estilo distinta")
    if style.design_id not in _niche_designs(image_plan.category_id):
        errors.append("El diseño no está permitido para esta categoría en niches.json")
    if image_plan.template_id not in {"daily_fact", "five_slides"}:
        errors.append("template_id debe ser daily_fact o five_slides")
    expected_slides = 1 if image_plan.template_id == "daily_fact" else 5
    if len(image_plan.slides) != expected_slides:
        errors.append(f"{image_plan.template_id} requiere {expected_slides} lámina(s)")
    if image_plan.format != "4:5":
        errors.append("Las plantillas iniciales usan formato 4:5")
    if [slide.order for slide in image_plan.slides] != list(range(1, len(image_plan.slides) + 1)):
        errors.append("El orden de las láminas debe ser consecutivo desde 1")
    if len({slide.slide_id for slide in image_plan.slides}) != len(image_plan.slides):
        errors.append("slide_id debe ser único dentro del plan")
    allowed_components = set(style.composition["allowed_components"])
    expected_component = f"image.{style.design_id}.{image_plan.template_id}"
    if expected_component not in allowed_components:
        errors.append(f"El estilo no autoriza el componente {expected_component}")
    if not image_plan.renderer_version:
        errors.append("renderer_version es obligatorio")
    for slide in image_plan.slides:
        claim_ids = {claim.id for claim in slide.claim_refs}
        if not claim_ids:
            errors.append(f"{slide.slide_id}: falta una fuente con claim_ref")
        for item in slide.texts:
            if item.role not in FACTUAL_ROLES | NON_FACTUAL_ROLES:
                errors.append(f"{slide.slide_id}: rol de texto desconocido: {item.role}")
            if item.role in FACTUAL_ROLES and not item.claim_refs:
                errors.append(f"{slide.slide_id}: el texto factual {item.role} no tiene claim_refs")
            if any(ref not in claim_ids for ref in item.claim_refs):
                errors.append(f"{slide.slide_id}: texto referencia un claim que no está en la lámina")
            if item.role == "headline" and len(item.value.splitlines()) > style.composition["headline_lines_max"]:
                errors.append(f"{slide.slide_id}: el titular supera las líneas permitidas")
            if item.role == "body" and len(item.value.splitlines()) > style.composition["body_lines_max"]:
                errors.append(f"{slide.slide_id}: el cuerpo supera las líneas permitidas")
        media_ids = {item.asset_id for item in slide.media}
        if len(media_ids) != len(slide.media):
            errors.append(f"{slide.slide_id}: asset_id duplicado en media")
        for media in slide.media:
            if not media.license_id or media.license_id.casefold() in {"unknown", "desconocida", "none"}:
                errors.append(f"{slide.slide_id}: medio sin licencia válida")
            if media_bytes is not None:
                raw = media_bytes.get(media.asset_id)
                if raw is None:
                    errors.append(f"{slide.slide_id}: falta el medio {media.asset_id}")
                elif hashlib.sha256(raw).hexdigest() != media.sha256:
                    errors.append(f"{slide.slide_id}: hash incorrecto para {media.asset_id}")
        for element in slide.elements:
            if element.type not in {"photo", "diagram", "ornament"}:
                errors.append(f"{slide.slide_id}: elemento desconocido {element.type}")
            if element.type == "photo" and element.asset_id not in media_ids:
                errors.append(f"{slide.slide_id}: foto sin MediaRef correspondiente")
    return ValidationReport(tuple(errors))


def contrast_ratio(foreground: str, background: str) -> float:
    def luminance(color: str) -> float:
        channels = [int(color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
        linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    light = max(luminance(foreground), luminance(background))
    dark = min(luminance(foreground), luminance(background))
    return (light + 0.05) / (dark + 0.05)


def validate_palette(style: StyleSystem) -> ValidationReport:
    palette = style.palette
    minimum = float(style.composition["contrast_min"])
    pairs = {
        "tinta/fondo": (palette["ink"], palette["bg"]),
        "tinta/fondo2": (palette["ink"], palette["bg2"]),
        "acento/fondo": (palette["accentInk"], palette["accent"]),
        "atenuado/fondo2": (palette["muted"], palette["bg2"]),
    }
    errors = [
        f"Contraste insuficiente para {name}: {contrast_ratio(*colors):.2f} < {minimum:.2f}"
        for name, colors in pairs.items()
        if contrast_ratio(*colors) < minimum
    ]
    return ValidationReport(tuple(errors))


def validate_jpeg(
    data: bytes,
    style: StyleSystem,
    *,
    expected_size: tuple[int, int] = (1080, 1350),
    qc: Mapping[str, Any] | None = None,
) -> ValidationReport:
    errors: list[str] = []
    if len(data) > MAX_JPEG_BYTES:
        errors.append(f"El JPEG excede {MAX_JPEG_BYTES} bytes")
    try:
        image = Image.open(__import__("io").BytesIO(data))
        image.load()
    except Exception as exc:
        return ValidationReport((f"JPEG inválido: {exc}",))
    if image.format != "JPEG":
        errors.append("El archivo no es JPEG")
    if image.size != expected_size:
        errors.append(f"Dimensiones incorrectas: {image.width}x{image.height}")
    if image.mode != "RGB":
        errors.append("El JPEG debe ser RGB")
    if image.getexif():
        errors.append("El JPEG no debe incluir metadatos EXIF")
    icc = image.info.get("icc_profile")
    if not icc:
        errors.append("El JPEG no incluye perfil de color sRGB")
    else:
        try:
            name = ImageCms.getProfileName(ImageCms.ImageCmsProfile(__import__("io").BytesIO(icc)))
            if "srgb" not in name.casefold():
                errors.append(f"Perfil de color inesperado: {name.strip()}")
        except Exception:
            errors.append("No se pudo verificar el perfil de color")
    errors.extend(validate_palette(style).errors)
    if qc:
        if qc.get("overflow") is not False:
            errors.append("El stage informa desbordamiento de texto")
        if qc.get("contrast") is not True:
            errors.append("El stage informa contraste insuficiente")
        if qc.get("readability") is not True:
            errors.append("El stage informa texto ilegible")
    return ValidationReport(tuple(errors))


def validate_copy(copy: ImageCopy, plan: ImagePlan | Mapping[str, Any]) -> ValidationReport:
    image_plan = parse_image_plan(plan)
    errors: list[str] = []
    if len(copy.title) > 60:
        errors.append("El título supera 60 caracteres")
    if len(copy.facebook.caption) > 1500:
        errors.append("El caption de Facebook supera 1.500 caracteres")
    if len(copy.instagram.caption) > 2200:
        errors.append("El caption de Instagram supera 2.200 caracteres")
    if len(copy.hashtags) > 30:
        errors.append("El copy supera 30 hashtags")
    mentions = re.findall(r"(?<!\w)@[A-Za-z0-9_.]+", copy.instagram.caption)
    if len(mentions) > 20:
        errors.append("El caption de Instagram supera 20 menciones")
    if len(copy.facebook.alt_texts) != len(image_plan.slides) or len(copy.instagram.alt_texts) != len(image_plan.slides):
        errors.append("Cada lámina necesita alt text por red")
    for alt in (*copy.facebook.alt_texts, *copy.instagram.alt_texts):
        if not alt or len(alt) > 1000:
            errors.append("El alt text debe tener entre 1 y 1.000 caracteres")
        if alt in {copy.facebook.caption, copy.instagram.caption}:
            errors.append("El alt text no debe duplicar el caption")
    known_claims = {claim.id for slide in image_plan.slides for claim in slide.claim_refs}
    if not copy.claim_refs or any(claim not in known_claims for claim in copy.claim_refs):
        errors.append("El copy debe apuntar a afirmaciones verificadas del plan")
    return ValidationReport(tuple(errors))
