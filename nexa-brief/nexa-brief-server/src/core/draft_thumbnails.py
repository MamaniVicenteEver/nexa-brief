"""Lightweight NodeMotion thumbnail manifests and capture-on-record support.

Editing a draft builds a small A/B manifest. The browser preview and the JPEG
saved during preparation use the same dependency-free SVG renderer in
``draft_thumbnail_renderer.js``. Capture is batched, bounded and cached by
destination format; recording only reuses a prepared image or its cache entry.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import time
from functools import lru_cache
from pathlib import Path

from src.core.nodemotion.service import lyrics_for_job
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
import structlog

from src.core.draft_details import DraftDetails
from src.core.job import Job
from src.core.nodemotion.promo.prompts import TEMPLATES
from src.core.template_config import active_config as _active_config

logger = structlog.get_logger(__name__)

Option = Literal["A", "B"]
ThumbnailFormat = Literal["16x9", "9x16"]
THUMBNAIL_SIZE: dict[ThumbnailFormat, tuple[int, int]] = {
    "16x9": (1280, 720),
    # Portrait output matches the 9:16 video and stays within the existing
    # five-image/10 MiB batch budget at JPEG quality 90.
    "9x16": (720, 1280),
}
VERSION = 31
# Promos con composición propia en el renderer: sin «LETRAS», B limitada a las palabras de A.
PROMO_DESIGNS = TEMPLATES
DESIGN_ROOT = Path(__file__).parents[1] / "templates" / "nodemotion"
RENDERER_PATH = Path(__file__).with_name("draft_thumbnail_renderer.js")


class ThumbnailOption(BaseModel):
    text: str = Field(default="NodeMotion", max_length=200)
    design: dict[str, Any] = Field(default_factory=dict)


class ThumbnailSet(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fingerprint: str
    renderer_version: int = 0
    # Legacy manifests omit this and remain landscape unless migrated by the
    # output-aware draft contract.
    format: ThumbnailFormat = "16x9"
    selected: Option = "A"
    urls: dict[Option, str] = Field(default_factory=dict)
    options: dict[Option, ThumbnailOption] = Field(default_factory=dict)
    artist: str = ""
    template_id: str = Field(default="", validation_alias=AliasChoices("templateId", "template_id"), serialization_alias="templateId")


def directory(job: Job) -> Path:
    if job.artifacts.content_dir is None:
        raise ValueError("El prototipo no tiene recursos preparados")
    return job.artifacts.content_dir / "thumbnails"


def image_path(job: Job, thumbs: ThumbnailSet, option: Option) -> Path:
    # Fingerprints are persisted data; validate before using them in a path.
    if len(thumbs.fingerprint) != 20 or any(c not in "0123456789abcdef" for c in thumbs.fingerprint):
        raise ValueError("Identificador de miniatura inválido")
    if option not in ("A", "B"):
        raise ValueError("Opción de miniatura inválida")
    return directory(job) / f"{thumbs.fingerprint}-{option}.jpg"


def title_of(job: Job, details: DraftDetails) -> str:
    publication = details.copies.get("youtube")
    return (
        details.song_name.strip()
        or str((job.artifacts.music_meta or {}).get("track_name") or "").strip()
        or (publication.title.strip() if publication else "")
        or "NodeMotion"
    )[:200]


def _template_id(job: Job) -> str:
    try:
        from src.config.niche_config import get_niche_config

        niche = get_niche_config(job.input.category_name)
        return str(niche.template.template_id or job.input.category_name or "")
    except Exception:
        # Older or test-only jobs may only retain the niche name.
        return str(job.input.category_name or "")[:100]


def _read_config(job: Job) -> dict[str, Any]:
    artifacts = job.artifacts
    candidates = [
        artifacts.config_json_path,
        (artifacts.content_dir / "config.json") if artifacts.content_dir else None,
        (artifacts.content_dir / "assets" / "config.json") if artifacts.content_dir else None,
        (artifacts.output_dir / "config.json") if artifacts.output_dir else None,
        (artifacts.output_dir / "assets" / "config.json") if artifacts.output_dir else None,
    ]
    for path in candidates:
        if path is None:
            continue
        try:
            if Path(path).is_file():
                value = json.loads(Path(path).read_text(encoding="utf-8"))
                if isinstance(value, dict):
                    return value
        except (OSError, ValueError, TypeError):
            continue
    return artifacts.template_config if isinstance(artifacts.template_config, dict) else {}


def _hex(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if len(value) == 4 and value.startswith("#"):
        value = "#" + "".join(char * 2 for char in value[1:])
    if len(value) == 7 and value.startswith("#") and all(char in "0123456789abcdefABCDEF" for char in value[1:]):
        return value.upper()
    return None


def _luminance(color: str) -> float:
    value = color.lstrip("#")
    channels = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _config_colors(config: dict[str, Any]) -> dict[str, str]:
    colors: dict[str, str] = {}
    for group_name in ("palette", "colors"):
        group = config.get(group_name)
        if isinstance(group, dict):
            for name, value in group.items():
                color = _hex(value)
                if color:
                    colors[str(name).lower()] = color
    return colors


_THEMES: dict[str, dict[str, str]] = {
    "promo-editorial": {"layout": "editorial", "font": "sans", "accent": "black", "background": "paper", "pattern_a": "paper", "pattern_b": "grid", "badge": "PROMO", "sub_badge": "EDITORIAL"},
    "promo-kinetic": {"layout": "kinetic", "font": "condensed", "accent": "red", "background": "bg", "pattern_a": "stripes", "pattern_b": "dots", "badge": "PROMO", "sub_badge": "KINETIC"},
    "promo-trendy": {"layout": "trendy", "font": "condensed", "accent": "lime", "background": "navy", "pattern_a": "rings", "pattern_b": "grid", "badge": "PROMO", "sub_badge": "TRENDY"},
    "promo-dynamic": {"layout": "dynamic", "font": "condensed", "accent": "neon", "background": "ink", "pattern_a": "rings", "pattern_b": "stripes", "badge": "PROMO", "sub_badge": "DYNAMIC"},
    "promo-urban": {"layout": "urban", "font": "condensed", "accent": "orange", "background": "black", "pattern_a": "stripes", "pattern_b": "dots", "badge": "PROMO", "sub_badge": "URBAN"},
    "promo-sports": {"layout": "sports", "font": "condensed", "accent": "yellow", "background": "dark", "pattern_a": "stripes", "pattern_b": "grid", "badge": "PROMO", "sub_badge": "SPORTS"},
    "promo-breaking": {"layout": "breaking", "font": "sans", "accent": "red", "background": "ink", "pattern_a": "none", "pattern_b": "none", "badge": "PROMO", "sub_badge": "BREAKING"},
    "promo-pulse": {"layout": "pulse", "font": "condensed", "accent": "green", "background": "ink", "pattern_a": "none", "pattern_b": "none", "badge": "PROMO", "sub_badge": "PULSE"},
    "lyrics-manifiesto": {"layout": "manifesto", "font": "sans", "accent": "ink", "background": "paper", "pattern_a": "paper", "pattern_b": "grid", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-caution": {"layout": "caution", "font": "condensed", "accent": "primary", "background": "dark", "pattern_a": "stripes", "pattern_b": "dots", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-mixtas": {"layout": "mixtas", "font": "condensed", "accent": "lime", "background": "black", "pattern_a": "dots", "pattern_b": "stripes", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-rasgado": {"layout": "rasgado", "font": "condensed", "accent": "lime", "background": "paper", "pattern_a": "none", "pattern_b": "none", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-hologram": {"layout": "hologram", "font": "condensed", "accent": "h1", "background": "void", "pattern_a": "none", "pattern_b": "none", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-hologram-worlds": {"layout": "hologram", "font": "condensed", "accent": "h1", "background": "void", "pattern_a": "none", "pattern_b": "none", "badge": "NODEMOTION", "sub_badge": "LETRA"},
}

_FALLBACK_PALETTES: dict[str, dict[str, str]] = {
    "promo-editorial": {"paper": "#ECECEA", "black": "#050505", "white": "#FBFBFB"},
    "promo-kinetic": {"bg": "#1C1C1D", "white": "#BDBDB8", "red": "#9B1F1F", "yellow": "#D9C21A"},
    "promo-trendy": {"lime": "#A6EB35", "limeDark": "#0E1A06", "paper": "#F2EFE6", "ink": "#101114", "navy": "#000012", "navy2": "#0B0B24"},
    "promo-dynamic": {"neon": "#C9FF1F", "ink": "#1E1E1E"},
    "promo-urban": {"black": "#050505", "white": "#F4F4F2", "orange": "#F2681A", "red": "#E4261C", "redDark": "#140102"},
    "promo-sports": {"yellow": "#EBE609", "dark": "#050607", "white": "#F3F3F1", "ink": "#0B0B0B"},
    "promo-breaking": {"red": "#F2070F", "deep": "#6E0006", "ink": "#0A0A0A", "white": "#FFFFFF"},
    "promo-pulse": {"green": "#2BF51A", "cream": "#E3DDCB", "ink": "#0B0C0B"},
    "lyrics-expediente": {"paper": "#EFE6CF", "ink": "#14110C", "red": "#E0503E"},
    "lyrics-resaltado": {"paper": "#F1E6C8", "ink": "#241A0E", "marker": "#FFE066"},
    "lyrics-manifiesto": {"paper": "#F4F2EE", "ink": "#0A0A0A"},
    "lyrics-caution": {"primary": "#C80202", "dark": "#000000", "light": "#FFFFFF"},
    "lyrics-mixtas": {"lime": "#BEFF0A", "red": "#B70004", "orange": "#F16F05", "white": "#FFFFFF", "paper": "#F4F4F2", "black": "#0B0B0C", "ink": "#111111"},
    "lyrics-rasgado": {"lime": "#90DE66", "ink": "#262626", "paper": "#DEDEE4"},
    "lyrics-hologram": {"void": "#09090F", "white": "#F4F2FB", "h1": "#C9B6FF"},
    "lyrics-hologram-worlds": {"void": "#08090C", "white": "#F4F2FB", "h1": "#B6B0FF"},
}


def _role_color(colors: dict[str, str], preferred: list[str], fallback: str | None = None) -> str | None:
    for name in preferred:
        if name in colors:
            return colors[name]
    return fallback


@lru_cache(maxsize=1)
def _design_tokens() -> dict[str, Any]:
    return json.loads((DESIGN_ROOT / "design-tokens.json").read_text())["templates"]


@lru_cache(maxsize=64)
def _thumbnail_style(template_id: str) -> dict:
    if not re.fullmatch(r"[a-z0-9-]{1,80}", template_id):
        return {}
    path = next(DESIGN_ROOT.glob(f"*/{template_id}/thumbnail-style.json"), None)
    return json.loads(path.read_text()) if path else {}


def _intro_seconds(template_id: str) -> float:
    """Segundo en que la intro del diseno esta completa (`@nexa thumbnail-at` de su intro.js)."""
    try:
        from src.templates._tools.nodemotion.shared.assemble import _design_root
        text = (_design_root(template_id) / "runtime/components/intro.js").read_text(encoding="utf-8")
    except (KeyError, OSError):
        return 2.0
    match = re.search(r"@nexa\s+thumbnail-at:\s*([0-9]+(?:\.[0-9]+)?)", text)
    return float(match.group(1)) if match else 2.0


def _component_spec(template_id: str, visual_style: dict, option: str) -> dict | None:
    """Fondo de la opcion: el que declara la plantilla o, en los disenos de letras, miniatura v1 (A) / v2 (B)."""
    explicit = (visual_style.get("backgrounds") or {}).get(option)
    if isinstance(explicit, dict):
        return explicit
    if not template_id.startswith("lyrics-") or not visual_style.get("capture"):
        return None  # opt-in: el diseno declara `capture` en su thumbnail-style.json
    try:
        from src.templates._tools.nodemotion.shared.assemble import registered
        if not registered(template_id):
            return None
    except ImportError:
        return None
    hooks = visual_style.get("capture") or {}
    if option in (hooks.get("photoOptions") or []):
        return None  # esta opcion usa la foto del usuario con el texto, no un cuadro del diseno
    label = (hooks.get("label") or {}).get(option) or {}
    place = {"labelX": label.get("x", -1), "labelY": label.get("y", -1), "labelColor": label.get("color", "")}
    fixed = (hooks.get("frames") or {}).get(option)
    if isinstance(fixed, dict) and fixed.get("seconds") is not None:  # cuadro fijo elegido para el diseno
        writable = bool(hooks.get("phraseMode") or hooks.get("phraseSelector"))  # el motor puede escribir la frase en su letra
        # Por defecto el cuadro es el diseño original tal cual; solo con "overlay": true el renderer escribe encima.
        overlay_only = bool(fixed.get("overlay"))
        by_lyrics = (not overlay_only) and bool(fixed.get("inside", hooks.get("phraseMode") == "lyrics"))
        spec = {"kind": "design", "seconds": float(fixed["seconds"]), "bare": not overlay_only, "zoom": 1, "inside": by_lyrics, **place}
        if overlay_only:
            spec["overlay"] = .6
        return spec
    if option == "A":
        return {"kind": "design", "seconds": _intro_seconds(template_id), "bare": True, "zoom": hooks.get("zoom", 1), **place}
    inside = bool(hooks.get("phraseSelector") or hooks.get("phraseMode"))
    return {"kind": "design", "at": 0.5, "bare": inside, "inside": inside, **place}


def has_stale_design_defaults(template_id: str, thumbnails: Any) -> bool:
    """True si las opciones guardadas conservan el fondo automatico antiguo y el diseno ya declara miniatura v1/v2."""
    if not template_id.startswith("lyrics-") or thumbnails is None:
        return False
    style = _thumbnail_style(template_id)
    for option in ("A", "B"):
        spec = _component_spec(template_id, style, option)
        item = thumbnails.options.get(option) if hasattr(thumbnails, "options") else None
        design = getattr(item, "design", None) or {}
        background = design.get("background") if isinstance(design, dict) else None
        if spec is None:
            if isinstance(background, dict) and background.get("kind") == "design":
                return True
            if option in ((style.get("capture") or {}).get("artistOptions") or []) and isinstance(design, dict) and "artist" not in design:
                return True
            continue
        if not isinstance(background, dict):
            return True
        if background.get("kind") == "frame" and not background.get("asset") and background.get("time", 12) == 12:
            return True
        if background.get("kind") == "design" and "inside" not in background:
            return True
        # Fondo automático antiguo (liso) o cuadro del diseño distinto del que la plantilla declara hoy.
        if background.get("kind") == "solid" and spec.get("kind") != "solid":
            return True
        if background.get("kind") == "design" and isinstance(spec, dict):
            for key in ("seconds", "inside", "bare", "labelX", "labelY", "labelColor"):
                expected = spec.get(key)
                if expected is not None and background.get(key) != expected and not (isinstance(expected, (int, float)) and not isinstance(expected, bool) and isinstance(background.get(key), (int, float)) and abs(float(background[key]) - float(expected)) < 1e-6):
                    return True
    return False


def _option_background(visual_style: dict, option: str, color: str, media_style: dict, template_id: str = "") -> dict[str, Any]:
    """Fondo por defecto de una opcion: un cuadro del propio diseno si la plantilla lo declara."""
    spec = _component_spec(template_id, visual_style, option)
    if isinstance(spec, dict) and spec.get("kind") == "design":
        return {"kind": "design", "at": _number(spec.get("at"), .5, 0, 1), "seconds": _number(spec.get("seconds"), -1, -1, 86400),
                "bare": spec.get("bare") is True, "zoom": _number(spec.get("zoom"), 1, 1, 2.5), "inside": spec.get("inside") is True,
                "labelColor": str(spec.get("labelColor") or ""), "labelX": _number(spec.get("labelX"), -1, -1, 1280), "labelY": _number(spec.get("labelY"), -1, -1, 720),
                "asset": "", "x": .5, "y": .5, "color": color, "pattern": "none", **media_style, **({"overlay": spec["overlay"]} if "overlay" in spec else {})}
    if isinstance(spec, dict) and spec.get("kind") == "solid":
        return {"kind": "solid", "asset": "", "x": .5, "y": .5, "color": color, "pattern": "none", **media_style}
    if isinstance(spec, dict) and spec.get("kind") == "frame":
        return {"kind": "frame", "time": _number(spec.get("time"), 12, 0, 86400), "asset": "", "x": .5, "y": .5, "color": color, "pattern": "none", **media_style}
    return {"kind": "frame", "time": 12, "asset": "", "x": .5, "y": .5, "color": color, "pattern": "none", **media_style}


def _build_designs(template_id: str, config: dict[str, Any]) -> dict[Option, dict[str, Any]]:
    from src.core.draft_thumbnail_assets import font_descriptor, background_style

    config = _active_config(config)
    tokens = _design_tokens().get(template_id, {})
    colors = {**_FALLBACK_PALETTES.get(template_id, {}), **_config_colors(config)}
    # Dos plantillas guardan la paleta dentro de escenas o esquemas.
    nested = {}
    if template_id == "lyrics-stylish-kinetic":
        palette = config.get("palette") or {}
        schemes, order = palette.get("schemes") or {}, palette.get("order") or []
        nested = schemes.get(order[0], {}) if order and isinstance(schemes, dict) else {}
    elif template_id == "lyrics-night-journey":
        nested = next((item.get("palette", {}) for item in config.get("scenes", [])
                       if isinstance(item, dict) and item.get("type") == "path"), {})
    if isinstance(nested, dict):
        colors.update({str(key).lower(): color for key, value in nested.items() if (color := _hex(value))})
    colors.update({key: value for key, value in (config.get("neon") or {}).items() if _hex(value)})
    theme = _THEMES.get(template_id, {})
    fallback = tokens.get("fallback", {})
    background = fallback.get("background") or _role_color(colors, [theme.get("background", ""), "bg", "background", "black", "dark", "night", "charcoal", "navy", "ink"], "#111111")
    foreground = fallback.get("foreground") or _role_color(colors, ["light", "white", "paper", "cream", "bone", "pale", "text"], "#F4F4F2")
    if _luminance(background) > .48:
        foreground = _role_color(colors, ["ink", "black", "dark"], "#0A0A0A")
    accent = fallback.get("accent") or _role_color(colors, [theme.get("accent", ""), "primary", "glow", "lime", "neon", "red", "orange", "yellow"], foreground)
    roles = tokens.get("roles", {})
    background = colors.get(roles.get("background"), background)
    foreground = colors.get(roles.get("foreground"), foreground)
    accent = colors.get(roles.get("accent"), accent)
    if foreground == "#F4F4F2" and colors and "#F4F4F2" not in colors.values():
        foreground = max(colors.values(), key=_luminance)
    visual_style = _thumbnail_style(template_id)
    media_style = background_style(config, template_id)
    designs = {}
    for option in ("A", "B"):
        family = tokens.get("displayB" if option == "B" else "display", "Arial")
        weight = tokens.get("weightB" if option == "B" else "weight", 700)
        slant = tokens.get("slantB" if option == "B" else "slant", tokens.get("slant", "normal"))
        option_roles = {**roles, **tokens.get("rolesB" if option == "B" else "rolesA", {})}
        option_foreground = colors.get(option_roles.get("foreground"), foreground)
        designs[option] = {
            "styleVersion": 5, "templateId": template_id,
            "layout": theme.get("layout", "poster"), "style": tokens.get("style", "minimal"),
            "rowTreatments": visual_style.get("treatments", {}).get(option, []), "outlineWidth": visual_style.get("outlineWidth", .013),
            "composition": "center", "palette": {"background": background, "foreground": option_foreground, "accent": accent, "subtitle": colors.get(option_roles.get("subtitle"), option_foreground), "deep": colors.get("deep", accent), "secondary": option_foreground, "panel": background, "brand": _role_color(colors, ["muted", "feats", "hint"], foreground)},
            "background": _option_background(visual_style, option, background, media_style, template_id),
            "typography": {"display": family, "mono": family, "weight": weight, "slant": slant, "tracking": 0 if family in {"Monoton", "Great Vibes"} else -1.5, "transform": "none" if family == "Great Vibes" else "uppercase", "font": font_descriptor(family, weight, slant), "outlineDisplay": "Archivo Black" if template_id == "lyrics-neon" else family, "outlineFont": font_descriptor("Archivo Black", 400, "normal") if template_id == "lyrics-neon" else None, "subtitleDisplay": "Playfair Display" if template_id == "lyrics-romantic" else "Archivo Black" if template_id == "lyrics-neon" else family, "subtitleWeight": 700 if template_id == "lyrics-romantic" else weight, "subtitleSlant": "italic" if template_id == "lyrics-romantic" else slant, "subtitleFont": font_descriptor("Playfair Display", 700, "italic") if template_id == "lyrics-romantic" else None},
            "subtitle": "" if template_id in PROMO_DESIGNS else "LETRAS", "badges": [],
        }
        # Colores propios de una opción (p. ej. el fondo de A igual al de B), declarados en thumbnail-style.json.
        designs[option]["palette"].update((visual_style.get("palettes") or {}).get(option, {}))
    return designs


_CTA_BLOCKED = re.compile(r"@|https?:|www\.|\.com\b|nexa|node ?motion|suscr|subscr|\bintro\b|\bpromo\b|\bvideo\b", re.I)


def valid_cta(text: Any) -> bool:
    """Un llamado a la acción de miniatura no lleva marca, enlaces ni textos de relleno."""
    value = " ".join(str(text or "").split())
    return bool(value) and not _CTA_BLOCKED.search(value)


def _clean_copy(text: str, artist: str = "") -> str:
    text = re.sub(r"\s*[·|—-]?\s*\(?(?:VIDEO DE LETRAS?|LETRAS?|LYRICS|OFFICIAL (?:VIDEO|AUDIO))\)?\s*$", "", text, flags=re.I)
    if artist:
        text = re.sub(r"\s*[·|—-]?\s*" + re.escape(artist) + r"\s*$", "", text, flags=re.I)
    return " ".join(text.split()).strip(" ·|—-")[:200] or "Música"


def _lyric_moment(template_id: str, option: str) -> float | None:
    """Segundo del video que muestra el cuadro de la opción (lo declara la plantilla en thumbnail-style.json)."""
    style = _thumbnail_style(template_id)
    frame = ((style.get("capture") or {}).get("frames") or {}).get(option)
    if isinstance(frame, dict) and frame.get("seconds") is not None:
        return float(frame["seconds"])
    background = (style.get("backgrounds") or {}).get(option)
    if isinstance(background, dict) and background.get("kind") == "frame" and background.get("time") is not None:
        return float(background["time"])
    return None


def _lyric_part(job: Job, seconds: float) -> str:
    """Frase de la letra que suena en ese segundo o acaba de sonar."""
    # Sin créditos ni ruido de una palabra: solo frases de la letra.
    lines = [item for item in (lyrics_for_job(job) or {}).get("segments", [])
             if isinstance(item, dict) and len(str(item.get("text", "")).split()) >= 3]
    if not lines:
        return ""
    current = next((item for item in lines if float(item.get("start", 0)) <= seconds < float(item.get("end", 0))), None)
    before = [item for item in lines if float(item.get("start", 0)) <= seconds]
    chosen = current or (before[-1] if before else lines[0])
    return " ".join(" ".join(str(chosen["text"]).split()).split(" ")[:12])[:200]


def _default_options(job: Job, details: DraftDetails, raw: dict[str, Any] | None = None) -> dict[Option, dict[str, Any]]:
    designs = _build_designs(_template_id(job), raw if raw is not None else _read_config(job))
    from src.core.draft_thumbnail_assets import background_sources
    # Ambas opciones usan las mismas fuentes; resolverlas una sola vez evita
    # repetir validaciones de medios y lecturas de la biblioteca.
    sources = background_sources(job)
    first_source = next(iter(sources.values()), None)
    source_kind = ("none" if first_source is None else
                   "video" if first_source.suffix.lower() in {".mp4", ".webm", ".mov"} else "image")
    descriptor = [(kind, str(path), path.stat().st_size, path.stat().st_mtime_ns)
                  for kind, path in sources.items()]
    version = hashlib.sha256(json.dumps(descriptor).encode()).hexdigest()[:20]
    for design in designs.values():
        design["background"].update(sourceKind=source_kind, availableSources=list(sources), mediaVersion=version)
    title = _clean_copy(title_of(job, details), details.artist)
    if _template_id(job) == "promo-editorial":
        config = _active_config(raw if raw is not None else _read_config(job))
        brand = config.get("brand") if isinstance(config.get("brand"), dict) else {}
        title = _clean_copy(str(brand.get("round") or brand.get("name") or title))
        # Dos composiciones de la misma promoción: el copy parte del contenido real.
        text = " ".join(title.split()[:5])
        # Placa secundaria con datos reales de la marca: nombre y cruce, sin inventar frases.
        def short(value: Any) -> str:
            return " ".join(str(value or "").split())[:40]
        kicker = short(brand.get("name")) if short(brand.get("name")).lower() != title.lower() else ""
        left, right = short(brand.get("left")), short(brand.get("right"))
        tagline = f"{left} vs {right}" if left and right else short(brand.get("tagline"))
        for option, design in designs.items():
            design.update(kicker=kicker, tagline=tagline[:40], side="right")
        return {"A": {"text": text, "design": designs["A"]}, "B": {"text": text, "design": designs["B"]}}
    if _template_id(job) in ("promo-dynamic", "promo-trendy", "promo-urban"):
        config = _active_config(raw if raw is not None else _read_config(job))
        brand = config.get("brand") if isinstance(config.get("brand"), dict) else {}
        # El titular es el primer rótulo de dos filas del guion de la promo (p. ej. «FUERZA PURA»).
        segments = (lyrics_for_job(job) or {}).get("segments", [])
        headlines = [" ".join(item["lines"]) for item in segments if isinstance(item, dict)
                     and isinstance(item.get("lines"), list) and len(item["lines"]) == 2
                     and all(isinstance(line, str) and line.strip() for line in item["lines"])
                     and valid_cta(" ".join(item["lines"]))]
        headline = headlines[0] if headlines else ""
        alternate = headlines[1] if len(headlines) > 1 else headline
        # Urban marca estilos con ^ ~ * delante de las palabras; no forman parte del texto.
        text = " ".join(_clean_copy(re.sub(r"[\^~*]", "", headline or title)).split()[:5])
        text_b = " ".join(_clean_copy(re.sub(r"[\^~*]", "", alternate or title)).split()[:5])
        # La miniatura lleva el llamado a la acción; la marca queda en el video.
        for design in designs.values():
            design.update(kicker="", tagline="", side="right", vertical="")
            if _template_id(job) == "promo-urban":
                # Rótulos reales del HUD del video: esquina, serie, año y texto pequeño.
                design.update(corner=str(brand.get("tagTop") or "")[:60], tagline=" ".join(str(brand.get("tagRight") or "").split())[:40],
                              year=" ".join(str(brand.get("year") or "").split())[:12], blurb=str(brand.get("blurb") or "")[:180])
        return {"A": {"text": text, "design": designs["A"]}, "B": {"text": text_b, "design": designs["B"]}}
    if _template_id(job) in ("promo-breaking", "promo-pulse"):
        # Titular = renglón 1 del primer segmento (la intro); placa = su renglón 2 o el subtítulo de marca.
        config = _active_config(raw if raw is not None else _read_config(job))
        brand = config.get("brand") if isinstance(config.get("brand"), dict) else {}
        segments = (lyrics_for_job(job) or {}).get("segments", [])
        first = next((item["lines"] for item in segments if isinstance(item, dict) and isinstance(item.get("lines"), list)
                      and item["lines"] and str(item["lines"][0]).strip()), [])
        text = " ".join(_clean_copy(str(first[0]).replace("~", "") if first else title).split()[:5])
        for design in designs.values():
            design.update(kicker="", tagline="", side="right", vertical="")
        return {"A": {"text": text, "design": designs["A"]}, "B": {"text": text, "design": designs["B"]}}
    if _template_id(job) in ("promo-sports", "promo-kinetic"):
        # Sports y Kinetic no tienen un rótulo de dos filas útil: el titular es su primer rótulo («DEPORTE»).
        segments = (lyrics_for_job(job) or {}).get("segments", [])
        first = next((" ".join(str(line) for line in item.get("lines") or [item.get("text", "")]) for item in segments
                      if isinstance(item, dict) and " ".join(str(line) for line in item.get("lines") or [item.get("text", "")]).strip()), "")
        text = " ".join(_clean_copy(re.sub(r"[#\^~*]", "", first or title)).split()[:5])
        return {"A": {"text": text, "design": designs["A"]}, "B": {"text": text, "design": designs["B"]}}
    artist_options = (_thumbnail_style(_template_id(job)).get("capture") or {}).get("artistOptions") or []
    for name in artist_options:
        if name in designs and details.artist.strip():
            designs[name]["artist"] = details.artist.strip()[:60]
    return {"A": {"text": " ".join(title.split()[:5]), "design": designs["A"]},
            "B": {"text": _lyric_text_b(job, details, title), "design": designs["B"]}}


def _lyric_text_b(job: Job, details: DraftDetails, title: str) -> str:
    """Opción B de las plantillas de letra: una parte de la canción en el segundo de su cuadro."""
    template_id = _template_id(job)
    moment = _lyric_moment(template_id, "B") if template_id.startswith("lyrics-") else None
    part = _lyric_part(job, moment) if moment is not None else ""
    return part or _alternate_title(job, details, title)


def _alternate_title(job: Job, details: DraftDetails, title: str) -> str:
    # Una frase real de la canción evita inventar letra o añadir metadatos.
    segments = (lyrics_for_job(job) or {}).get("segments", [])
    phrases = [" ".join(str(item.get("text", "")).split()) for item in segments if isinstance(item, dict)]
    phrases = [text for text in phrases if 5 <= len(text.split()) <= 14]
    if phrases:
        emotional = {"amor", "nunca", "siempre", "duele", "dueles", "olvidar", "vida", "corazón", "ti", "sin"}
        return max(phrases, key=lambda text: (len(set(text.lower().split()) & emotional), min(len(text), 70)))[:200]
    return title


def _number(value: Any, fallback: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, float(value))) if isinstance(value, (int, float)) and math.isfinite(value) else fallback


def _safe_design(value: Any, default: dict[str, Any], template_id: str) -> dict[str, Any]:
    # Colores, tipografía y LETRAS pertenecen a la plantilla; se conserva el fondo elegido.
    source = value if isinstance(value, dict) else {}
    result = {**default}
    candidate = source.get("background") if source.get("styleVersion") in (2, 3, 4, 5) and isinstance(source.get("background"), dict) else {}
    asset = candidate.get("asset", "")
    asset = asset if isinstance(asset, str) and re.fullmatch(r"[a-f0-9]{24}", asset) else ""
    # Sin fondo guardado (o con el fotograma automático antiguo) se usa el default del diseño.
    default_design = default["background"].get("kind") == "design"
    stale_default = (candidate.get("kind") == "frame" and not asset and _number(candidate.get("time"), 12, 0, 86400) == 12) or candidate.get("kind") == "solid"
    old_design = candidate.get("kind") == "design" and "inside" not in candidate  # defaults anteriores
    revert_design = not default_design and candidate.get("kind") == "design"  # el diseno ya no declara miniatura v1/v2
    # El fondo `design` lo define el diseno (no se edita en el panel): un valor guardado no lo pisa.
    # Fondo automático de siempre (segundo 12, sin fuente ni ajuste elegidos): se renueva con el de la plantilla.
    auto_frame = (default["background"].get("kind") in ("frame", "solid") and candidate.get("kind") == "frame" and not asset
                  and _number(candidate.get("time"), 12, 0, 86400) == 12 and candidate.get("mediaSource", "auto") == "auto"
                  and candidate.get("overlayMode", "template") != "manual")
    use_default = (default_design and (not candidate or stale_default or old_design or candidate.get("kind") == "design")) or revert_design or auto_frame
    result["background"] = dict(default["background"]) if use_default else {
        **default["background"],
        "mediaSource": candidate.get("mediaSource") if candidate.get("mediaSource") in default["background"].get("availableSources", []) else "auto",
        "kind": candidate.get("kind") if candidate.get("kind") in ("frame", "image", "solid", "design") else "frame",
        "time": round(_number(candidate.get("time"), 12, 0, 86400), 2),
        "asset": asset,
        "overlay": _number(candidate.get("overlay"), default["background"]["overlay"], 0, .85) if candidate.get("overlayMode") == "manual" else default["background"]["overlay"],
        "overlayMode": "manual" if candidate.get("overlayMode") == "manual" else "template",
        "x": _number(candidate.get("x"), .5, 0, 1), "y": _number(candidate.get("y"), .5, 0, 1),
        **({"at": _number(candidate.get("at"), default["background"].get("at", .5), 0, 1),
            "seconds": _number(candidate.get("seconds"), default["background"].get("seconds", -1), -1, 86400),
            "bare": candidate.get("bare", default["background"].get("bare", False)) is True,
            "zoom": _number(candidate.get("zoom"), default["background"].get("zoom", 1), 1, 2.5),
            "inside": candidate.get("inside", default["background"].get("inside", False)) is True} if candidate.get("kind") == "design" else {}),
    }
    result["subtitle"] = "" if template_id in PROMO_DESIGNS else "LETRAS"
    if template_id in PROMO_DESIGNS and source.get("side") in ("left", "right"):
        result["side"] = source["side"]
    return result


def _normalize_options(job: Job, details: DraftDetails, options: Any = None, raw: dict[str, Any] | None = None) -> dict[Option, dict[str, Any]]:
    defaults = _default_options(job, details, raw)
    source = options.model_dump(mode="json") if hasattr(options, "model_dump") else options
    if isinstance(source, dict) and isinstance(source.get("options"), dict):
        source = source["options"]
    source = source if isinstance(source, dict) else {}
    normalized = {}
    for option in ("A", "B"):
        item = source.get(option)
        item = item.model_dump(mode="json") if hasattr(item, "model_dump") else item
        item = item if isinstance(item, dict) else {}
        candidate = item.get("text")
        if _template_id(job) in PROMO_DESIGNS and not valid_cta(candidate):
            candidate = ""
        text = _clean_copy(candidate or defaults[option]["text"], details.artist)
        if option == "A":
            text = " ".join(text.split()[:5])
        normalized[option] = {"text": text, "design": _safe_design(item.get("design"), defaults[option]["design"], _template_id(job))}
    if _template_id(job) in PROMO_DESIGNS:
        limit = max(1, min(5, len(normalized["A"]["text"].split())))
        normalized["A"]["design"]["maxWords"] = 5
        normalized["B"]["text"] = " ".join(normalized["B"]["text"].split()[:limit])
        normalized["B"]["design"]["maxWords"] = limit
    return normalized


def fingerprint(
    job: Job, details: DraftDetails, options: Any = None,
    output_format: ThumbnailFormat = "16x9",
) -> str:
    raw = _read_config(job)
    normalized = _normalize_options(job, details, options, raw)
    content = job.artifacts.content_dir
    digest = hashlib.sha256(json.dumps(
        [VERSION, output_format, title_of(job, details), details.artist.strip(), normalized],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8"))
    # Solo Kinetic cambió la composición de A; invalida sus JPEG anteriores.
    if _template_id(job) == "promo-kinetic":
        digest.update(b"promo-kinetic-marker-a-v1")
    if _template_id(job) == "promo-dynamic":
        digest.update(b"promo-dynamic-cta-a-v2")
    if _template_id(job) == "promo-trendy":
        digest.update(b"promo-trendy-legible-a-v1")
    from src.core.nodemotion.service import load_project
    from src.templates._tools.nodemotion.shared.assemble import engine_revision
    project = load_project(Path(job.artifacts.output_dir)) if job.artifacts.output_dir else None
    if project:
        digest.update(engine_revision(project["design_id"], project.get("engine", {}).get("revision")).encode())
        digest.update(json.dumps(project, sort_keys=True).encode())
    if any(isinstance(item.get("design"), dict) and item["design"].get("background", {}).get("kind") == "design"
           for item in normalized.values()):
        from src.core.draft_thumbnail_assets import design_signature
        digest.update(f"design-bg:{design_signature(job)}".encode())
    paths = [job.artifacts.html_path, DESIGN_ROOT / "design-tokens.json"]
    from src.core.draft_thumbnail_assets import background_source
    media = background_source(job)
    if media is not None:
        stat = media.stat()
        digest.update(f"{stat.st_size}:{stat.st_mtime_ns}".encode())
    if content is not None:
        paths.extend([content / "config.json", content / "assets" / "config.json", content / "components" / "intro.js"])
    if job.artifacts.config_json_path is not None:
        paths.append(job.artifacts.config_json_path)
    seen: set[Path] = set()
    for path in paths:
        if path is None:
            continue
        path = Path(path)
        if path in seen:
            continue
        seen.add(path)
        try:
            if path.is_file():
                digest.update(path.read_bytes())
        except OSError:
            continue
    return digest.hexdigest()[:20]


def preview_manifest(
    job: Job, details: DraftDetails, options: Any = None,
    output_format: ThumbnailFormat = "16x9",
) -> dict[str, Any]:
    """Return the complete local-preview contract without launching a browser or writing files."""
    normalized = _normalize_options(job, details, options)
    return {
        "schemaVersion": 2,
        "renderer_version": VERSION,
        "format": output_format,
        "templateId": _template_id(job),
        "fingerprint": fingerprint(job, details, normalized, output_format),
        "selected": "A",
        "artist": details.artist.strip()[:160],
        "options": normalized,
    }


def is_current(job: Job | None, details: DraftDetails, thumbnails: ThumbnailSet | None) -> bool:
    if job is None or thumbnails is None or job.artifacts.content_dir is None:
        return False
    manifest = preview_manifest(job, details, thumbnails.options, thumbnails.format)
    return thumbnails.fingerprint == manifest["fingerprint"] and set(thumbnails.options) == {"A", "B"}


async def prepare(
    draft_id: str,
    job: Job,
    details: DraftDetails,
    previous: ThumbnailSet | None = None,
    options: Any = None,
) -> ThumbnailSet | None:
    """Prepare A/B JSON for the editor; this intentionally performs no capture."""
    from src.core.nodemotion.service import load_project
    has_project = bool(job.artifacts.output_dir and load_project(Path(job.artifacts.output_dir)))
    if not has_project and (job.artifacts.html_path is None or not job.artifacts.html_path.is_file()):
        return None
    existing_options = options if options is not None else previous.options if previous else None
    manifest = preview_manifest(job, details, existing_options, previous.format if previous else "16x9")
    selected = previous.selected if previous else "A"
    manifest["selected"] = selected
    fingerprint_value = manifest["fingerprint"]
    return ThumbnailSet(
        fingerprint=fingerprint_value,
        format=manifest["format"],
        selected=selected,
        # No image URL is published before capture; the editor renders `options` locally.
        urls={},
        options=manifest["options"],
        artist=manifest["artist"],
        templateId=manifest["templateId"],
    )


def _capture_dimensions(manifest: dict[str, Any]) -> tuple[ThumbnailFormat, int, int]:
    output_format = manifest.get("format", "16x9")
    if output_format not in THUMBNAIL_SIZE:
        raise ValueError("Formato de miniatura inválido")
    width, height = THUMBNAIL_SIZE[output_format]
    return output_format, width, height


def _capture_html(manifest: dict[str, Any], option: Option) -> str:
    """Build a fixed host page. The only dynamic data is passed as Playwright JSON."""
    _, width, height = _capture_dimensions(manifest)
    # No content is interpolated into HTML or executable JavaScript here.
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<meta name='viewport' content='width={width},height={height},initial-scale=1'>"
        f"</head><body style='margin:0;width:{width}px;height:{height}px;overflow:hidden;background:#000'>"
        f"<img id='thumbnail' style='display:block;width:{width}px;height:{height}px' />"
        "</body></html>"
    )


async def _capture_svg_batch(items: list[tuple[dict[str, Any], Option, Path]]) -> None:
    """Capture several selected options in one bounded Chromium session."""
    if not items:
        return
    from playwright.async_api import async_playwright
    from src.config.settings import settings

    launch: dict[str, Any] = {
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
        "timeout": 15000,
    }
    if settings.playwright_chromium_executable_path:
        launch["executable_path"] = settings.playwright_chromium_executable_path
    _, first_width, first_height = _capture_dimensions(items[0][0])
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(**launch)
        try:
            page = await browser.new_page(viewport={"width": first_width, "height": first_height}, device_scale_factor=1)
            page.set_default_timeout(10000)
            await page.set_content(_capture_html(items[0][0], items[0][1]), wait_until="domcontentloaded")
            await page.add_script_tag(path=str(RENDERER_PATH))
            current_size = (first_width, first_height)
            for manifest, option, destination in items:
                _, width, height = _capture_dimensions(manifest)
                if current_size != (width, height):
                    await page.set_viewport_size({"width": width, "height": height})
                    current_size = (width, height)
                await page.evaluate("""({width, height}) => {
                  document.documentElement.style.width = `${width}px`;
                  document.documentElement.style.height = `${height}px`;
                  document.body.style.width = `${width}px`;
                  document.body.style.height = `${height}px`;
                  const image = document.getElementById('thumbnail');
                  image.style.width = `${width}px`;
                  image.style.height = `${height}px`;
                }""", {"width": width, "height": height})
                await page.evaluate("""async ({manifest, option, width, height}) => {
                  const renderer = globalThis.NexaDraftThumbnailRenderer;
                  if (!renderer || typeof renderer.renderSvgAsync !== 'function') throw new Error('No se cargó el renderer de miniaturas');
                  const svg = await renderer.renderSvgAsync(manifest, option, width, height, {assets: manifest.embeddedAssets});
                  const blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
                  const url = URL.createObjectURL(blob);
                  const image = document.getElementById('thumbnail');
                  image.src = url;
                  await image.decode();
                  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                }""", {"manifest": manifest, "option": option, "width": width, "height": height})
                destination.parent.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=str(destination), type="jpeg", quality=90, timeout=12000)
                await page.evaluate("""() => {
                  const image = document.getElementById('thumbnail');
                  const oldUrl = image.dataset.objectUrl;
                  if (oldUrl) URL.revokeObjectURL(oldUrl);
                  image.dataset.objectUrl = image.src;
                }""")
        finally:
            await browser.close()


async def _capture_svg(manifest: dict[str, Any], option: Option, dest: Path) -> None:
    """Compatibility wrapper for the one-image capture API."""
    await _capture_svg_batch([(manifest, option, dest)])


def _validate(path: Path, output_format: ThumbnailFormat = "16x9") -> None:
    from PIL import Image, ImageStat

    expected_size = THUMBNAIL_SIZE[output_format]
    with Image.open(path) as image:
        if image.size != expected_size or max(ImageStat.Stat(image.convert("RGB")).stddev) < 2:
            raise ValueError(f"El renderer produjo una miniatura vacía o con formato incorrecto para {output_format}")
    if path.stat().st_size > 2 * 1024 * 1024:
        raise ValueError("La miniatura supera el tamaño permitido por YouTube")



async def capture_selected_batch(
    draft_id: str,
    job: Job,
    details: DraftDetails,
    manifests: dict[str, ThumbnailSet],
) -> tuple[dict[str, Path], dict[str, int]]:
    """Capture one selected JPEG per output, reusing identical fingerprints."""
    started = time.perf_counter()
    if len(manifests) > 5:
        raise ValueError("No se pueden capturar más de cinco destinos en una preparación")
    if not manifests:
        return {}, {"requested": 0, "captured": 0, "cache_hits": 0, "bytes": 0, "elapsed_ms": 0}
    from src.core.nodemotion.service import load_project
    has_project = bool(job.artifacts.output_dir and load_project(Path(job.artifacts.output_dir)))
    if not has_project and (job.artifacts.html_path is None or not job.artifacts.html_path.is_file()):
        raise ValueError("El prototipo no tiene una vista previa disponible")

    paths: dict[str, Path] = {}
    to_capture: dict[Path, tuple[dict[str, Any], Option]] = {}
    for output, thumbs in manifests.items():
        selected = thumbs.selected
        if selected not in ("A", "B"):
            raise ValueError(f"Selección de miniatura inválida para {output}")
        if selected not in thumbs.options or not thumbs.options[selected].text.strip():
            raise ValueError(f"La opción seleccionada para {output} no tiene texto")
        manifest = preview_manifest(job, details, thumbs.options, thumbs.format)
        captured_manifest = ThumbnailSet(
            fingerprint=manifest["fingerprint"], format=thumbs.format,
            selected=selected, options=manifest["options"], artist=manifest["artist"],
            templateId=manifest["templateId"],
        )
        destination = image_path(job, captured_manifest, selected)
        paths[output] = destination
        if destination.is_file():
            try:
                _validate(destination, thumbs.format)
                continue
            except (OSError, ValueError):
                destination.unlink(missing_ok=True)
        to_capture.setdefault(destination, (manifest, selected))

    from src.core.heavy_work import heavy_work_slot
    assets_by_design: dict[str, Any] = {}
    pending: list[tuple[dict[str, Any], Option, Path, Path]] = []
    for destination, (manifest, selected) in to_capture.items():
        temporary = destination.with_suffix(".pending.jpg")
        design = manifest["options"][selected]["design"]
        option_text = str(manifest["options"][selected].get("text") or "")
        design_key = json.dumps([design, option_text], sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        if design_key not in assets_by_design:
            from src.core.draft_thumbnail_assets import embedded_assets
            assets_by_design[design_key] = await embedded_assets(job, design, option_text)
        manifest["embeddedAssets"] = assets_by_design[design_key]
        pending.append((manifest, selected, temporary, destination))

    total_bytes = 0
    if pending:
        async with heavy_work_slot("thumbnail_capture", draft_id):
            try:
                await asyncio.wait_for(
                    _capture_svg_batch([(manifest, option, temporary) for manifest, option, temporary, _ in pending]),
                    timeout=35 * len(pending),
                )
                for manifest, _, temporary, destination in pending:
                    _validate(temporary, manifest.get("format", "16x9"))
                    total_bytes += temporary.stat().st_size
                    if total_bytes > 10 * 1024 * 1024:
                        raise ValueError("Las miniaturas seleccionadas superan el límite total de 10 MiB")
                    os.replace(temporary, destination)
            finally:
                for _, _, temporary, _ in pending:
                    temporary.unlink(missing_ok=True)

    cache_hits = len(manifests) - len(to_capture)
    stats = {
        "requested": len(manifests), "captured": len(to_capture), "cache_hits": cache_hits,
        "bytes": total_bytes, "elapsed_ms": round((time.perf_counter() - started) * 1000),
    }
    logger.info("draft_thumbnail_batch_ready", draft_id=draft_id, **stats)
    return paths, stats




async def capture_selected(
    draft_id: str,
    job: Job,
    details: DraftDetails,
    option: Option,
    options: Any = None,
    output_format: ThumbnailFormat = "16x9",
) -> Path:
    """Capture the selected SVG as one JPEG when recording starts."""
    if option not in ("A", "B"):
        raise ValueError("Opción de miniatura inválida")
    from src.core.nodemotion.service import load_project
    has_project = bool(job.artifacts.output_dir and load_project(Path(job.artifacts.output_dir)))
    if not has_project and (job.artifacts.html_path is None or not job.artifacts.html_path.is_file()):
        raise ValueError("El prototipo no tiene una vista previa disponible")
    manifest = preview_manifest(job, details, options, output_format)
    thumbs = ThumbnailSet(
        fingerprint=manifest["fingerprint"],
        format=output_format,
        selected=option,
        options=manifest["options"],
        artist=manifest["artist"],
        templateId=manifest["templateId"],
    )
    destination = image_path(job, thumbs, option)
    if destination.is_file():
        return destination

    from src.core.heavy_work import heavy_work_slot

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".pending.jpg")
    async with heavy_work_slot("thumbnail_capture", draft_id):
        try:
            from src.core.draft_thumbnail_assets import embedded_assets
            manifest["embeddedAssets"] = await embedded_assets(job, manifest["options"][option]["design"], str(manifest["options"][option].get("text") or ""))
            await asyncio.wait_for(_capture_svg(manifest, option, temporary), timeout=35)
            _validate(temporary, output_format)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
    return destination

