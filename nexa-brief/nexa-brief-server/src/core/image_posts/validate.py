"""Validaciones editoriales, de medios y de archivos exportados."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from typing import Any, Mapping

from PIL import Image, ImageCms

from .copy import ImageCopy
from .plan import ImagePlan, parse_image_plan
from .style import StyleSystem
from .profiles import get_image_profile


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
NON_FACTUAL_ROLES = frozenset({"kicker", "cta", "handle", "step", "swipe", "tagline", "credit", "question"})

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
    if style.design_id not in _niche_designs(image_plan.category_id) and not (image_plan.category_id == "node_motion" and style.design_id == "motion"):
        errors.append("El diseño no está permitido para esta categoría en niches.json")
    if image_plan.template_id not in {"daily_fact", "five_slides"}:
        errors.append("template_id debe ser daily_fact o five_slides")
    amar = any(s.layout.startswith("amarillista:") for s in image_plan.slides)
    hilo = amar and any(any(t.role == 'kicker' and t.value == 'DESARROLLO' for t in s.texts) for s in image_plan.slides)
    expected_slides = 1 if image_plan.template_id == "daily_fact" else 5
    if amar:
        from .strategies.amarillista import CONFIG
        fmt = CONFIG['hilo'] if hilo else CONFIG['formato']
        if image_plan.template_id != CONFIG['predeterminado']['template_id'] or not fmt['min_laminas'] <= len(image_plan.slides) <= fmt['max_laminas']:
            errors.append(f"amarillista requiere de {fmt['min_laminas']} a {fmt['max_laminas']} láminas")
    elif len(image_plan.slides) != expected_slides:
        errors.append(f"{image_plan.template_id} requiere {expected_slides} lámina(s)")
    if amar and hilo:
        from .strategies.amarillista_hilo import plan_errors
        errors.extend(plan_errors(image_plan))
    if amar and not hilo:
        from .strategies.amarillista import CONFIG, LEVELS
        levels = [s.layout.split(":", 1)[1].split("_")[1] if len(s.layout.split(":", 1)[1].split("_")) >= 3 else "" for s in image_plan.slides]
        if len(set(levels)) != 1 or levels[0] not in LEVELS:
            errors.append("Nivel de amarillista inválido o inconsistente")
        if not all(sl.layout.startswith('amarillista:') for sl in image_plan.slides):
            errors.append('No mezclar estrategias en un carrusel amarillista')
        from .strategies.amarillista_copy import validate_reflection
        by_label = {r['etiqueta']: r['id'] for r in CONFIG['roles']}
        actual_roles = []
        for index, sl in enumerate(image_plan.slides):
            label = next((t.value for t in sl.texts if t.role == 'kicker'), '')
            role = 'portada' if index == 0 else ('cierre' if sl.layout.endswith('_close') else by_label.get(label,''))
            actual_roles.append(role)
            if role != 'cierre' and not any(t.role == 'source' and t.value.strip().removeprefix('Fuente:').strip() for t in sl.texts):
                errors.append(f'{sl.slide_id}: falta fuente visible')
            if role == 'reflexion':
                if '_reflexion_' not in sl.layout:
                    errors.append('reflexion requiere diseño destacado')
                if not sl.claim_refs or not any(t.role == 'body' and t.claim_refs for t in sl.texts):
                    errors.append('reflexion requiere evidencia y fuente con claim_refs')
                value = next((t.value for t in sl.texts if t.role == 'body'), '')
                try:
                    validate_reflection(value, levels[0])
                except (ValueError, KeyError) as exc:
                    errors.append(f'reflexion inválida: {exc}')
            for item in sl.texts:
                if item.role == 'body' and len(item.value) > CONFIG['limites']['body_caracteres']:
                    errors.append(f'{sl.slide_id}: body supera límite')
        if actual_roles not in CONFIG['composiciones'].get(str(len(image_plan.slides)),[]):
            errors.append('Roles y orden inválidos: portada, prueba, giro, reflexion y cierre obligatorios')
        hashes = [m.sha256 for sl in image_plan.slides for m in sl.media]
        if len(hashes) != len(set(hashes)):
            errors.append("amarillista no permite fotos repetidas")
        for sl in image_plan.slides[:-1]:
            photos = [e for e in sl.elements if e.type == "photo" and any(m.asset_id == e.asset_id for m in sl.media)]
            diagrams = [e for e in sl.elements if e.type == "diagram"]
            if not photos and not diagrams:
                errors.append(f"{sl.slide_id}: lámina factual sin visual informativo")
            if photos and not sl.layout.endswith("_photo"):
                errors.append(f"{sl.slide_id}: la receta no dibuja la foto")
            if diagrams and not (sl.layout.endswith("_visual") or (photos and sl.layout.endswith("_photo") and '_reflexion_' not in sl.layout)):
                errors.append(f"{sl.slide_id}: la receta no dibuja el gráfico")
            from .strategies.amarillista_visuals import validate_diagram
            for element in diagrams:
                try:
                    diagram = validate_diagram(json.loads(element.value or ""), {c.id for c in sl.claim_refs})
                    if diagram['kind'] not in CONFIG['visuales']['fallback_permitidos']:
                        errors.append(f'{sl.slide_id}: visual inválido; tarjeta de texto no sustituye gráfico, comparación o línea de tiempo')
                except (ValueError, TypeError, KeyError) as exc:
                    errors.append(f"{sl.slide_id}: visual inválido: {exc}")
        cover = image_plan.slides[0]
        headline = next((t.value for t in cover.texts if t.role == "headline"), "")
        if not headline or len(unicodedata.normalize("NFC", headline)) > 60 or len(headline.split()) > 8:
            errors.append("La portada requiere título de hasta 8 palabras y 60 caracteres")
        if not any(t.role == "source" for t in cover.texts):
            errors.append("La portada requiere fuente visible")
        close = image_plan.slides[-1]
        question = next((t.value for t in close.texts if t.role == "question"), "")
        if not question.endswith("?") or len(question.split()) > 8:
            errors.append("El cierre requiere pregunta de hasta 8 palabras")
        if not all(any(t.role == role for t in close.texts) for role in ("kicker", "cta", "handle")):
            errors.append("El cierre requiere marca, CTA y @")
        for sl in image_plan.slides:
            for item in sl.texts:
                normalized = unicodedata.normalize("NFKD", item.value.casefold())
                normalized = ''.join(ch for ch in normalized if not unicodedata.combining(ch))
                for phrase in CONFIG["controles"]["frases_prohibidas"]:
                    p = unicodedata.normalize("NFKD", phrase.casefold())
                    p = ''.join(ch for ch in p if not unicodedata.combining(ch))
                    if p in normalized:
                        errors.append(f"{sl.slide_id}: frase de engagement bait prohibida")
                        break
    try:
        get_image_profile(image_plan.format)
    except ValueError as exc:
        errors.append(str(exc))
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
        if not claim_ids and not (amar and slide is image_plan.slides[-1] and not any(t.role in FACTUAL_ROLES for t in slide.texts)):
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
        if qc.get("overflow") is not False or qc.get("overflow_blocks"):
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
