"""Lightweight NodeMotion thumbnail manifests and capture-on-record support.

Editing a draft only builds a small A/B manifest. The browser preview and the
JPEG saved for recording use the same dependency-free SVG renderer in
``draft_thumbnail_renderer.js``. Chromium is opened only by
``capture_selected`` when the recording flow asks for the chosen option.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from src.core.draft_details import DraftDetails
from src.core.job import Job

Option = Literal["A", "B"]
VERSION = 10
DESIGN_ROOT = Path(__file__).parents[1] / "templates" / "nodemotion"
RENDERER_PATH = Path(__file__).with_name("draft_thumbnail_renderer.js")


class ThumbnailOption(BaseModel):
    text: str = Field(default="NodeMotion", max_length=200)
    design: dict[str, Any] = Field(default_factory=dict)


class ThumbnailSet(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fingerprint: str
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


def _active_config(raw: dict[str, Any]) -> dict[str, Any]:
    cases = raw.get("configs")
    if isinstance(cases, list):
        active_id = raw.get("activeId")
        for case in cases:
            if isinstance(case, dict) and case.get("id") == active_id:
                return case
        for case in cases:
            if isinstance(case, dict):
                return case
    return raw


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
    "lyrics-manifiesto": {"layout": "manifesto", "font": "sans", "accent": "ink", "background": "paper", "pattern_a": "paper", "pattern_b": "grid", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-caution": {"layout": "caution", "font": "condensed", "accent": "primary", "background": "dark", "pattern_a": "stripes", "pattern_b": "dots", "badge": "NODEMOTION", "sub_badge": "LETRA"},
    "lyrics-mixtas": {"layout": "mixtas", "font": "condensed", "accent": "lime", "background": "black", "pattern_a": "dots", "pattern_b": "stripes", "badge": "NODEMOTION", "sub_badge": "LETRA"},
}

_FALLBACK_PALETTES: dict[str, dict[str, str]] = {
    "promo-editorial": {"paper": "#ECECEA", "black": "#050505", "white": "#FBFBFB"},
    "promo-kinetic": {"bg": "#1C1C1D", "white": "#BDBDB8", "red": "#9B1F1F", "yellow": "#D9C21A"},
    "promo-trendy": {"lime": "#A6EB35", "limeDark": "#0E1A06", "paper": "#F2EFE6", "ink": "#101114", "navy": "#000012", "navy2": "#0B0B24"},
    "promo-dynamic": {"neon": "#C9FF1F", "ink": "#1E1E1E"},
    "promo-urban": {"black": "#050505", "white": "#F4F4F2", "orange": "#F2681A", "red": "#E4261C", "redDark": "#140102"},
    "promo-sports": {"yellow": "#EBE609", "dark": "#050607", "white": "#F3F3F1", "ink": "#0B0B0B"},
    "lyrics-manifiesto": {"paper": "#F4F2EE", "ink": "#0A0A0A"},
    "lyrics-caution": {"primary": "#C80202", "dark": "#000000", "light": "#FFFFFF"},
    "lyrics-mixtas": {"lime": "#BEFF0A", "red": "#B70004", "orange": "#F16F05", "white": "#FFFFFF", "paper": "#F4F4F2", "black": "#0B0B0C", "ink": "#111111"},
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


def _build_designs(template_id: str, config: dict[str, Any]) -> dict[Option, dict[str, Any]]:
    from src.core.draft_thumbnail_assets import font_descriptor, background_style

    config = _active_config(config)
    tokens = _design_tokens().get(template_id, {})
    colors = {**_FALLBACK_PALETTES.get(template_id, {}), **_config_colors(config)}
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
            "styleVersion": 4, "templateId": template_id,
            "layout": theme.get("layout", "poster"), "style": tokens.get("style", "minimal"),
            "rowTreatments": visual_style.get("treatments", {}).get(option, []), "outlineWidth": visual_style.get("outlineWidth", .013),
            "composition": "center", "palette": {"background": background, "foreground": option_foreground, "accent": accent, "subtitle": colors.get(option_roles.get("subtitle"), option_foreground), "deep": colors.get("deep", accent), "secondary": option_foreground, "panel": background, "brand": _role_color(colors, ["muted", "feats", "hint"], foreground)},
            "background": {"kind": "frame", "time": 12, "asset": "", "x": .5, "y": .5, "color": background, "pattern": "none", **media_style},
            "typography": {"display": family, "mono": family, "weight": weight, "slant": slant, "tracking": 0 if family in {"Monoton", "Great Vibes"} else -1.5, "transform": "none" if family == "Great Vibes" else "uppercase", "font": font_descriptor(family, weight, slant), "outlineDisplay": "Archivo Black" if template_id == "lyrics-neon" else family, "outlineFont": font_descriptor("Archivo Black", 400, "normal") if template_id == "lyrics-neon" else None},
            "subtitle": "LETRAS", "badges": [],
        }
    return designs


def _clean_copy(text: str, artist: str = "") -> str:
    text = re.sub(r"\s*[·|—-]?\s*\(?(?:VIDEO DE LETRAS?|LETRAS?|LYRICS|OFFICIAL (?:VIDEO|AUDIO))\)?\s*$", "", text, flags=re.I)
    if artist:
        text = re.sub(r"\s*[·|—-]?\s*" + re.escape(artist) + r"\s*$", "", text, flags=re.I)
    return " ".join(text.split()).strip(" ·|—-")[:200] or "Música"


def _default_options(job: Job, details: DraftDetails, raw: dict[str, Any] | None = None) -> dict[Option, dict[str, Any]]:
    designs = _build_designs(_template_id(job), raw if raw is not None else _read_config(job))
    from src.core.draft_thumbnail_assets import background_kind
    source_kind = background_kind(job)
    for design in designs.values():
        design["background"]["sourceKind"] = source_kind
    title = _clean_copy(title_of(job, details), details.artist)
    return {"A": {"text": " ".join(title.split()[:5]), "design": designs["A"]},
            "B": {"text": _alternate_title(job, details, title), "design": designs["B"]}}


def _alternate_title(job: Job, details: DraftDetails, title: str) -> str:
    # Una frase real de la canción evita inventar letra o añadir metadatos.
    segments = (job.artifacts.lyrics_json or {}).get("segments", [])
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
    candidate = source.get("background") if source.get("styleVersion") in (2, 3, 4) and isinstance(source.get("background"), dict) else {}
    asset = candidate.get("asset", "")
    asset = asset if isinstance(asset, str) and re.fullmatch(r"[a-f0-9]{24}", asset) else ""
    result["background"] = {
        **default["background"],
        "kind": candidate.get("kind") if candidate.get("kind") in ("frame", "image", "solid") else "frame",
        "time": round(_number(candidate.get("time"), 12, 0, 86400), 2),
        "asset": asset,
        "overlay": _number(candidate.get("overlay"), default["background"]["overlay"], 0, .85) if candidate.get("overlayMode") == "manual" else default["background"]["overlay"],
        "overlayMode": "manual" if candidate.get("overlayMode") == "manual" else "template",
        "x": _number(candidate.get("x"), .5, 0, 1), "y": _number(candidate.get("y"), .5, 0, 1),
    }
    result["subtitle"] = "LETRAS"
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
        text = _clean_copy(item.get("text") or defaults[option]["text"], details.artist)
        if option == "A":
            text = " ".join(text.split()[:5])
        normalized[option] = {"text": text, "design": _safe_design(item.get("design"), defaults[option]["design"], _template_id(job))}
    return normalized


def fingerprint(job: Job, details: DraftDetails, options: Any = None) -> str:
    raw = _read_config(job)
    normalized = _normalize_options(job, details, options, raw)
    content = job.artifacts.content_dir
    digest = hashlib.sha256(json.dumps(
        [VERSION, title_of(job, details), details.artist.strip(), normalized],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8"))
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


def preview_manifest(job: Job, details: DraftDetails, options: Any = None) -> dict[str, Any]:
    """Return the complete local-preview contract without launching a browser or writing files."""
    normalized = _normalize_options(job, details, options)
    return {
        "schemaVersion": 2,
        "templateId": _template_id(job),
        "fingerprint": fingerprint(job, details, normalized),
        "selected": "A",
        "artist": details.artist.strip()[:160],
        "options": normalized,
    }


def is_current(job: Job | None, details: DraftDetails, thumbnails: ThumbnailSet | None) -> bool:
    if job is None or thumbnails is None or job.artifacts.content_dir is None:
        return False
    manifest = preview_manifest(job, details, thumbnails.options)
    return thumbnails.fingerprint == manifest["fingerprint"] and set(thumbnails.options) == {"A", "B"}


async def prepare(
    draft_id: str,
    job: Job,
    details: DraftDetails,
    previous: ThumbnailSet | None = None,
    options: Any = None,
) -> ThumbnailSet | None:
    """Prepare A/B JSON for the editor; this intentionally performs no capture."""
    if job.artifacts.html_path is None or not job.artifacts.html_path.is_file():
        return None
    existing_options = options if options is not None else previous.options if previous else None
    manifest = preview_manifest(job, details, existing_options)
    selected = previous.selected if previous else "A"
    manifest["selected"] = selected
    fingerprint_value = manifest["fingerprint"]
    return ThumbnailSet(
        fingerprint=fingerprint_value,
        selected=selected,
        # No image URL is published before capture; the editor renders `options` locally.
        urls={},
        options=manifest["options"],
        artist=manifest["artist"],
        templateId=manifest["templateId"],
    )


def _capture_html(manifest: dict[str, Any], option: Option) -> str:
    """Build a fixed host page. The only dynamic data is passed as Playwright JSON."""
    # No content is interpolated into HTML or executable JavaScript here.
    return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=1280,height=720,initial-scale=1'></head><body style='margin:0;width:1280px;height:720px;overflow:hidden;background:#000'><img id='thumbnail' style='display:block;width:1280px;height:720px' /></body></html>"


async def _capture_svg(manifest: dict[str, Any], option: Option, dest: Path) -> None:
    from playwright.async_api import async_playwright
    from src.config.settings import settings

    launch: dict[str, Any] = {
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
        "timeout": 15000,
    }
    if settings.playwright_chromium_executable_path:
        launch["executable_path"] = settings.playwright_chromium_executable_path
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(**launch)
        try:
            page = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
            page.set_default_timeout(10000)
            await page.set_content(_capture_html(manifest, option), wait_until="domcontentloaded")
            await page.add_script_tag(path=str(RENDERER_PATH))
            await page.evaluate("""async ({manifest, option}) => {
              const renderer = globalThis.NexaDraftThumbnailRenderer;
              if (!renderer || typeof renderer.renderSvg !== 'function') throw new Error('No se cargó el renderer de miniaturas');
              const svg = await renderer.renderSvgAsync(manifest, option, 1280, 720, {assets: manifest.embeddedAssets});
              const blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
              const url = URL.createObjectURL(blob);
              const image = document.getElementById('thumbnail');
              image.src = url;
              await image.decode();
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }""", {"manifest": manifest, "option": option})
            dest.parent.mkdir(parents=True, exist_ok=True)
            await page.screenshot(path=str(dest), type="jpeg", quality=90, timeout=12000)
        finally:
            await browser.close()


def _validate(path: Path) -> None:
    from PIL import Image, ImageStat

    with Image.open(path) as image:
        if image.size != (1280, 720) or max(ImageStat.Stat(image.convert("RGB")).stddev) < 2:
            raise ValueError("El renderer produjo una miniatura vacía")
    if path.stat().st_size > 2 * 1024 * 1024:
        raise ValueError("La miniatura supera el tamaño permitido por YouTube")


async def capture_selected(
    draft_id: str,
    job: Job,
    details: DraftDetails,
    option: Option,
    options: Any = None,
) -> Path:
    """Capture the selected SVG as one JPEG when recording starts."""
    if option not in ("A", "B"):
        raise ValueError("Opción de miniatura inválida")
    if job.artifacts.html_path is None or not job.artifacts.html_path.is_file():
        raise ValueError("El prototipo no tiene una vista previa disponible")
    manifest = preview_manifest(job, details, options)
    thumbs = ThumbnailSet(
        fingerprint=manifest["fingerprint"],
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
            manifest["embeddedAssets"] = await embedded_assets(job, manifest["options"][option]["design"])
            await asyncio.wait_for(_capture_svg(manifest, option, temporary), timeout=35)
            _validate(temporary)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
    return destination

