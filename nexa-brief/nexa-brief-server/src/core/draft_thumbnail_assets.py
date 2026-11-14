"""Recursos estáticos de miniaturas: fuentes locales, imágenes y fotogramas cacheados."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError

from src.core.job import Job

FONT_ROOT = Path(__file__).parents[1] / "templates/nodemotion/assets/fonts"


@lru_cache(maxsize=1)
def font_index() -> dict:
    return json.loads((FONT_ROOT / "index.json").read_text())


def font_descriptor(family: str, weight: int, style: str) -> dict | None:
    for ident, item in font_index().items():
        if (item["family"], item["weight"], item["style"]) == (family, weight, style):
            return {"family": family, "weight": weight, "style": style, "url": f"/api/v1/drafts/thumbnail-fonts/{ident}"}
    return None


def font_path(ident: str) -> Path | None:
    item = font_index().get(ident)
    return FONT_ROOT / item["file"] if item else None


def background_spec(config: dict) -> dict:
    for key in ("bg", "background", "video", "image"):
        value = config.get(key)
        if isinstance(value, dict) and value.get("src"):
            return value
    return {}


def background_style(config: dict, template_id: str) -> dict:
    """Medio original sin filtros de color, con una única capa negra al 20%."""
    return {"overlay": .2, "edgeDarkening": 0, "filter": "", "overlayMode": "template"}


def background_kind(job: Job) -> str:
    source = background_source(job)
    if source is None:
        return "none"
    return "video" if source.suffix.lower() in {".mp4", ".webm", ".mov"} else "image"


def _resolve_medium(name: Any, roots: list[Path | None]) -> Path | None:
    if not isinstance(name, str) or not name or ":" in name or Path(name).is_absolute():
        return None
    for root in roots:
        if root is None:
            continue
        root = root.resolve()
        for relative in (name, name.removeprefix("assets/")):
            candidate = (root / relative).resolve()
            if candidate.is_relative_to(root) and candidate.is_file() and candidate.suffix.lower() in {".mp4", ".webm", ".mov", ".jpg", ".jpeg", ".png", ".webp"}:
                return candidate
    return None


def background_sources(job: Job) -> dict[str, Path]:
    """Current media first; retain the template's existing alternative image/video."""
    from src.core.draft_thumbnails import _active_config, _read_config, _template_id, DESIGN_ROOT
    sources: dict[str, Path] = {}
    def add(path: Path | None) -> None:
        if path and path.is_file():
            kind = "video" if path.suffix.lower() in {".mp4", ".webm", ".mov"} else "image"
            sources.setdefault(kind, path)
    for path in (job.artifacts.video_path, job.artifacts.image_path):
        add(path)
    roots = [job.artifacts.output_dir, job.artifacts.content_dir, job.artifacts.html_path.parent if job.artifacts.html_path else None]
    config = _active_config(_read_config(job))
    tid = _template_id(job)
    def add_config_media(config: dict, roots: list[Path | None]) -> None:
        for key in ("bg", "background", "video", "image"):
            spec = config.get(key)
            if isinstance(spec, dict):
                add(_resolve_medium(spec.get("src"), roots))
        # Las plantillas por escenas declaran sus clips originales en `media`.
        media = config.get("media")
        if tid in {"lyrics-mixtas", "lyrics-grunge", "lyrics-lluvia-gris", "lyrics-memoria", "lyrics-ceniza", "lyrics-vacio", "promo-editorial", "promo-dynamic", "promo-trendy", "promo-urban", "promo-sports", "promo-breaking", "promo-pulse"} and isinstance(media, list):
            # El plano nocturno conserva mejor el contraste del texto fino de Lluvia Gris.
            preferred = "street-rain" if tid == "lyrics-lluvia-gris" else None
            candidates = sorted(media, key=lambda item: 0 if isinstance(item, dict) and item.get("id") == preferred else 1)
            for spec in candidates:
                if isinstance(spec, dict):
                    add(_resolve_medium(spec.get("src"), roots))
        # Estas plantillas declaran videos dentro de escenas, no en `bg`.
        scene_key = {"lyrics-night-journey": "scenes", "lyrics-cristal": "worlds"}.get(tid)
        scenes = config.get(scene_key) if scene_key else None
        if isinstance(scenes, list):
            for scene in scenes:
                if isinstance(scene, dict):
                    spec = scene.get("video") if isinstance(scene.get("video"), dict) else scene
                    add(_resolve_medium(spec.get("src"), roots))
    add_config_media(config, roots)
    if re.fullmatch(r"[a-z0-9-]{1,80}", tid):
        template = next(DESIGN_ROOT.glob(f"*/{tid}/assets/config.json"), None)
        if template:
            config = _active_config(json.loads(template.read_text()))
            add_config_media(config, [template.parent.parent])
    return sources


def background_source(job: Job, source: str = "auto") -> Path | None:
    sources = background_sources(job)
    return sources.get(source) if source in {"image", "video"} else next(iter(sources.values()), None)


def media_version(job: Job) -> str:
    descriptor = [(kind, str(path), path.stat().st_size, path.stat().st_mtime_ns) for kind, path in background_sources(job).items()]
    return hashlib.sha256(json.dumps(descriptor).encode()).hexdigest()[:20]


def save_background(job: Job, data: bytes) -> str:
    from src.core.draft_thumbnails import directory

    if not data or len(data) > 8 * 1024 * 1024:
        raise ValueError("La imagen debe pesar como máximo 8 MB")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 30_000_000 or image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Usá una imagen JPG, PNG o WebP de hasta 30 megapíxeles")
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=94)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
        raise ValueError("No se pudo leer la imagen") from error
    payload = output.getvalue()
    ident = hashlib.sha256(payload).hexdigest()[:24]
    destination = directory(job) / "backgrounds" / f"{ident}.jpg"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return ident


_duration_cache: dict[str, float] = {}


async def _video_duration(source: Path) -> float:
    stat = source.stat()
    key = f"{source}:{stat.st_size}:{stat.st_mtime_ns}"
    if key in _duration_cache:
        return _duration_cache[key]
    process = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(source),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        output, _ = await asyncio.wait_for(process.communicate(), timeout=5)
        duration = float(output.strip()) if process.returncode == 0 else 0
        if not 0 < duration < 1_000_000:
            return 0
        _duration_cache[key] = duration
        while len(_duration_cache) > 32:
            del _duration_cache[next(iter(_duration_cache))]
        return duration
    except (ValueError, asyncio.TimeoutError):
        return 0
    finally:
        if process.returncode is None:
            process.kill()
        await process.wait()


async def background_file(job: Job, design: dict[str, Any]) -> Path | None:
    from src.core.draft_thumbnails import directory

    kind = design.get("kind", "frame")
    if kind == "solid":
        return None
    asset = design.get("asset", "")
    if kind == "image":
        if not isinstance(asset, str) or not re.fullmatch(r"[a-f0-9]{24}", asset):
            raise ValueError("Elegí una imagen para el fondo")
        path = directory(job) / "backgrounds" / f"{asset}.jpg"
        if not path.is_file():
            raise ValueError("La imagen de fondo ya no está disponible")
        return path
    source = background_source(job, design.get("mediaSource", "auto"))
    if source is None:
        return None  # Plantillas sin medios conservan su campo de color original.
    if source.suffix.lower() not in {".mp4", ".webm", ".mov"}:
        return source
    raw_time = design.get("time", 12)
    time = max(0, min(86400, float(raw_time)))
    stat = source.stat()
    key = hashlib.sha256(f"frame-v2:{source}:{stat.st_size}:{stat.st_mtime_ns}:{time:.2f}".encode()).hexdigest()[:24]
    destination = directory(job) / "frames" / f"{key}.jpg"
    if destination.is_file():
        return destination
    from src.core.heavy_work import heavy_work_slot
    async with heavy_work_slot("thumbnail_background", key):
        if destination.is_file():
            return destination
        destination.parent.mkdir(parents=True, exist_ok=True)
        pending = destination.with_suffix(".pending.jpg")
        try:
            duration = await _video_duration(source)
            # Los fondos de las plantillas se repiten; no volver siempre al cuadro cero.
            seek_time = round(time % duration, 6) if duration else time
            for seek in (seek_time, 0):
                process = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-threads", "1", "-ss", str(seek), "-i", str(source),
                    "-frames:v", "1", "-vf", "scale=1280:720:force_original_aspect_ratio=decrease", "-q:v", "2", "-threads", "1", "-y", str(pending),
                    stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
                )
                try:
                    await asyncio.wait_for(process.wait(), timeout=18)
                except BaseException:
                    if process.returncode is None:
                        process.kill()
                    await process.wait()
                    raise
                if process.returncode == 0 and pending.is_file() and pending.stat().st_size:
                    os.replace(pending, destination)
                    # Caché acotada por proyecto, sin tocar imágenes subidas.
                    for old in sorted(destination.parent.glob("*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)[12:]:
                        old.unlink(missing_ok=True)
                    return destination
            raise ValueError("No se pudo extraer un fotograma de este video")
        finally:
            pending.unlink(missing_ok=True)


def data_url(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


async def embedded_assets(job: Job, design: dict) -> dict:
    typography = design.get("typography", {})
    fonts = []
    for font in (typography.get("font"), typography.get("outlineFont"), typography.get("subtitleFont")):
        if not font or any((item["family"],item["weight"],item["style"]) == (font["family"],font["weight"],font["style"]) for item in fonts):
            continue
        path = font_path(font["url"].rsplit("/", 1)[-1])
        if path:
            fonts.append({**font, "data": data_url(path, "font/woff2" if path.suffix == ".woff2" else "font/ttf")})
    background = await background_file(job, design.get("background", {}))
    return {"fonts": fonts, "backgroundData": data_url(background, "image/" + ("jpeg" if background.suffix.lower() in {".jpg", ".jpeg"} else background.suffix[1:])) if background else ""}
