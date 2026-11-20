"""Recursos estáticos de miniaturas: fuentes locales, imágenes y fotogramas cacheados."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import os
import re
from contextlib import contextmanager
from contextvars import ContextVar
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
        from src.core.nodemotion.service import load_project, resolve_project
        project_root = root if (root / "project.json").is_file() else root.parent
        if (project_root / "project.json").is_file() and load_project(project_root):
            resolved = resolve_project(project_root, name)
            if isinstance(resolved, Path) and resolved.suffix.lower() in {".mp4", ".webm", ".mov", ".jpg", ".jpeg", ".png", ".webp"}:
                return resolved
        for relative in (name, name.removeprefix("assets/")):
            candidate = (root / relative).resolve()
            from src.config.template_manifest import resolve_template_content
            shared = resolve_template_content(root / relative)
            if isinstance(shared, Path) and shared.is_file():
                candidate = shared
            if (isinstance(shared, Path) or candidate.is_relative_to(root)) and candidate.is_file() and candidate.suffix.lower() in {".mp4", ".webm", ".mov", ".jpg", ".jpeg", ".png", ".webp"}:
                return candidate
    return None


_background_snapshot: ContextVar[dict[int, dict[str, Path]] | None] = ContextVar(
    "thumbnail_background_snapshot", default=None,
)


@contextmanager
def background_sources_snapshot():
    """Share one resolved snapshot during a single thumbnail preparation."""
    token = _background_snapshot.set({})
    try:
        yield
    finally:
        _background_snapshot.reset(token)


def background_sources(job: Job) -> dict[str, Path]:
    snapshot = _background_snapshot.get()
    if snapshot is None:
        return _resolve_background_sources(job)
    key = id(job)
    if key not in snapshot:
        snapshot[key] = _resolve_background_sources(job)
    return dict(snapshot[key])


def _resolve_background_sources(job: Job) -> dict[str, Path]:
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
    if kind == "design":
        try:
            return await design_frame(job, design)
        except Exception:
            return None  # sin captura la miniatura vuelve al estilo de texto sobre color
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


DESIGN_FRAME_FRACTION = .5
DESIGN_FRAME_FALLBACK_SECONDS = 60.0
_DESIGN_HOST = "http://nexa-design.invalid"
_FONT_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com"}


def design_id_for(job: Job) -> str | None:
    """Diseño compartido del prototipo, si está registrado en el motor."""
    from src.core.draft_thumbnails import _template_id
    from src.core.nodemotion.service import load_project
    from src.templates._tools.nodemotion.shared.assemble import registered

    project = load_project(Path(job.artifacts.output_dir)) if job.artifacts.output_dir else None
    candidate = (project or {}).get("design_id") or _template_id(job)
    return candidate if candidate and registered(candidate) else None


def design_signature(job: Job) -> str | None:
    """Huella del motor, sus estilos y el config: si cambia, el tablero se vuelve a capturar."""
    from src.templates._tools.nodemotion.shared.assemble import _design_root, assemble

    design_id = design_id_for(job)
    if design_id is None:
        return None
    root = _design_root(design_id)
    digest = hashlib.sha256(assemble(design_id))
    for path in sorted([*(root / "runtime").rglob("*.js"), *(root / "styles").glob("*.css")]):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    config = job.artifacts.config_json_path
    if config and Path(config).is_file():
        digest.update(Path(config).read_bytes())
    return digest.hexdigest()[:20]


async def _design_seconds(job: Job, design: dict[str, Any]) -> float:
    try:
        exact = float(design.get("seconds", -1))
    except (TypeError, ValueError):
        exact = -1
    if exact >= 0:
        return round(exact, 2)
    try:
        fraction = min(1.0, max(0.0, float(design.get("at", DESIGN_FRAME_FRACTION))))
    except (TypeError, ValueError):
        fraction = DESIGN_FRAME_FRACTION
    song = job.artifacts.music_path
    duration = await _video_duration(Path(song)) if song and Path(song).is_file() else 0
    return round(duration * fraction if duration else DESIGN_FRAME_FALLBACK_SECONDS, 2)


def _lyrics_bytes(job: Job) -> bytes | None:
    """La letra como la usa la vista previa; si no se puede leer, el archivo de la carpeta del prototipo."""
    from src.core.nodemotion.service import lyrics_for_job

    try:
        data = lyrics_for_job(job)
    except Exception:
        data = None
    if data is not None:
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    folder = job.artifacts.assets_dir or job.artifacts.content_dir
    path = folder / "lyrics.json" if folder else None
    return path.read_bytes() if path and path.is_file() else None


def _design_zoom(design: dict[str, Any]) -> float:
    try:
        return min(2.5, max(1.0, float(design.get("zoom", 1))))
    except (TypeError, ValueError):
        return 1.0


def _config_with_phrase_layout(raw: bytes, phrase: str, layout: str, bg: str) -> bytes:
    """Config con la frase de la miniatura en una sola escena y con un layout que la muestra completa."""
    try:
        data = json.loads(raw)
        words = len(phrase.split())
        for cfg in data.get("configs", []):
            scenes = cfg.setdefault("scenes", {})
            scenes["maxWords"] = max(int(scenes.get("maxWords", 4)), words + 1)
            scenes["maxChars"] = max(int(scenes.get("maxChars", 22)), len(phrase) + 2)
            if words >= 3:
                names = ("giant", "type", "editorial", "build", "mirror", "sandwich", "pair", "tracking", "stack", "outline", "band", "duo", "side", "scatter", "dash", "split")
                cfg["layouts"] = {n: {"weight": 0} for n in names}
                cfg["layouts"][layout] = {"weight": 1.0, "bgs": [bg]}
                scenes["cooldown"] = 0
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    except (ValueError, TypeError, AttributeError):
        return raw


def _lyrics_with_phrase(raw: bytes | None, phrase: str, seconds: float) -> bytes | None:
    """Letra con la frase activa en `seconds` sustituida por `phrase` (mismos tiempos): el motor dibuja su propia escena."""
    if raw is None or not phrase.strip():
        return raw
    try:
        data = json.loads(raw)
        segments = data.get("segments") if isinstance(data, dict) else None
        if not segments:
            return raw
        index = next((i for i, s in enumerate(segments) if s.get("start", 0) <= seconds < s.get("end", 0)), None)
        if index is None:
            index = min(range(len(segments)), key=lambda i: abs(float(segments[i].get("start", 0)) - seconds))
        seg = segments[index]
        words = phrase.split()
        start = float(seg.get("start", seconds))
        span = max(float(seg.get("end", start + 1)) - start, 0.6)
        if not (start <= seconds < float(seg.get("end", start))):
            # Hueco entre frases: la frase más cercana se desplaza para que cubra ese segundo (solo en la captura).
            start = max(0.0, seconds - 1.2)  # el texto ya está asentado en ese segundo
            span = max(span, 3.0)
            seg["start"], seg["end"] = round(start, 3), round(seconds + span, 3)
        if os.environ.get("NB_SPAN"):
            span = float(os.environ["NB_SPAN"])
        # La frase del usuario no hereda la confianza baja de un ruido de la transcripción: el motor la descartaría.
        for key in ("avg_logprob", "no_speech_prob", "compression_ratio", "temperature"):
            seg.pop(key, None)
        seg["text"] = " " + phrase.strip()
        # Todas las palabras entran a la vez: la miniatura muestra la frase completa.
        seg["words"] = [{"word": " " + w, "start": round(start + i * 0.02, 3), "end": round(start + span, 3)}
                        for i, w in enumerate(words)]
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    except (ValueError, TypeError, AttributeError):
        return raw


def _webm_copy(job: Job, source: Path) -> Path:
    """Copia WebM (VP8, 12 s, 960 px) en cache del prototipo para que el navegador de captura pueda decodificarla."""
    import subprocess
    from src.core.draft_thumbnails import directory

    stat = source.stat()
    key = hashlib.sha256(f"webm-v2|{source}|{stat.st_size}|{stat.st_mtime_ns}".encode()).hexdigest()[:20]
    out = directory(job) / "frames" / f"vp-{key}.webm"
    if out.is_file():
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    pending = out.with_suffix(".pending.webm")
    try:
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-t", "12", "-an",
             "-vf", "scale=960:-2", "-c:v", "libvpx", "-deadline", "good", "-cpu-used", "4", "-crf", "8", "-b:v", "12M", str(pending)],
            check=True, timeout=90, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        os.replace(pending, out)
    finally:
        pending.unlink(missing_ok=True)
    return out


async def _capture_design_frame(job: Job, design_id: str, seconds: float, destination: Path, zoom: float = 1.0, phrase: str = "", hooks: dict | None = None) -> None:
    """Captura el diseño como se ve en la vista previa, en el segundo pedido (1280x720)."""
    from urllib.parse import unquote, urlsplit
    from playwright.async_api import async_playwright
    from src.config.settings import settings
    from src.templates._tools.nodemotion.shared.assemble import _design_root, assemble

    hooks = hooks or {}
    root = _design_root(design_id).resolve()
    manifest_data = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    aliases = manifest_data.get("runtime_aliases", {})
    resource_aliases = manifest_data.get("demo_resource_aliases", {})
    from src.templates._tools.nodemotion.shared import assemble as _assemble_module
    shared_resources = Path(_assemble_module.__file__).parent / "resources"
    html = assemble(design_id)
    config = job.artifacts.config_json_path
    song = job.artifacts.music_path
    lyrics = _lyrics_bytes(job)
    if hooks.get("phraseMode") == "lyrics" and phrase:
        lyrics = _lyrics_with_phrase(lyrics, phrase, seconds)
    config_bytes = None
    if hooks.get("phraseMode") == "lyrics" and phrase and hooks.get("phraseLayout") and config and Path(config).is_file():
        config_bytes = _config_with_phrase_layout(Path(config).read_bytes(), phrase, str(hooks["phraseLayout"]), str(hooks.get("phraseBg", "black")))

    def body_for(rel: str) -> tuple[bytes, str] | None:
        if rel in ("", "index.html"):
            return html, "text/html; charset=utf-8"
        if rel in ("config.json", "assets/config.json") and config and Path(config).is_file():
            return (config_bytes if config_bytes is not None else Path(config).read_bytes()), "application/json"
        if rel in ("lyrics.json", "assets/lyrics.json") and lyrics is not None:
            return lyrics, "application/json"
        if rel in ("song.mp3", "assets/song.mp3") and song and Path(song).is_file():
            return Path(song).read_bytes(), "audio/mpeg"
        if rel in aliases or rel.startswith(("components/", "runtime/", "scripts/", "styles/")):
            target = (root / aliases.get(rel, rel)).resolve()
            if target.is_file() and target.is_relative_to(root):
                mime = "text/css; charset=utf-8" if target.suffix == ".css" else "application/javascript; charset=utf-8"
                return target.read_bytes(), mime
        import mimetypes
        shared = resource_aliases.get(rel)
        if shared and (shared_resources / shared).is_file():  # fuentes y medios compartidos del diseno
            path = shared_resources / shared
            if path.suffix.lower() in (".mp4", ".mov", ".m4v"):
                return _webm_copy(job, path).read_bytes(), "video/webm"
            return path.read_bytes(), mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if rel and job.artifacts.output_dir:
            try:
                from src.core.nodemotion.service import resolve_project
                value = resolve_project(Path(job.artifacts.output_dir), rel, expected_revision=None)
            except Exception:
                value = None
            if value is not None:
                path = None if isinstance(value, bytes) else Path(value)
                if path is not None and path.suffix.lower() in (".mp4", ".mov", ".m4v"):
                    path = _webm_copy(job, path)  # el Chromium de Playwright no decodifica H.264
                    return path.read_bytes(), "video/webm"
                data = value if isinstance(value, bytes) else path.read_bytes()
                return data, mimetypes.guess_type(rel)[0] or "application/octet-stream"
        for base in (job.artifacts.output_dir, job.artifacts.assets_dir, job.artifacts.content_dir):
            if rel and base:
                target = (Path(base) / rel).resolve()
                if target.is_file() and target.is_relative_to(Path(base).resolve()):
                    return target.read_bytes(), mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        return None

    async def handle(route) -> None:
        url = route.request.url
        if not url.startswith(_DESIGN_HOST):
            # Solo las fuentes tipográficas del diseño salen a la red; el resto se corta.
            if urlsplit(url).hostname in _FONT_HOSTS:
                await route.continue_()
            else:
                await route.abort()
            return
        found = await asyncio.to_thread(body_for, unquote(urlsplit(url).path).lstrip("/"))
        if found is None:
            await route.fulfill(status=404, body=b"")
            return
        body, mime = found
        headers = {"Cache-Control": "no-cache", "Accept-Ranges": "bytes"}
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", route.request.headers.get("range", "").strip())
        if match and body:
            # El audio se busca con rangos, igual que en el servidor real; sin esto el seek no se aplica.
            start = int(match.group(1)) if match.group(1) else 0
            end = min(int(match.group(2)) if match.group(2) else len(body) - 1, len(body) - 1)
            headers["Content-Range"] = f"bytes {start}-{end}/{len(body)}"
            await route.fulfill(status=206, body=body[start:end + 1], content_type=mime, headers=headers)
        else:
            await route.fulfill(status=200, body=body, content_type=mime, headers=headers)

    launch: dict[str, Any] = {
        "args": ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
        "timeout": 15000,
    }
    if settings.playwright_chromium_executable_path:
        launch["executable_path"] = settings.playwright_chromium_executable_path
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(**launch)
        try:
            page = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
            page.set_default_timeout(15000)
            await page.route("**/*", handle)
            if os.environ.get("NB_THUMB_DEBUG"):
                page.on("response", lambda r: print("RESP", r.status, r.url[-70:], flush=True) if r.status >= 400 else None)
                page.on("requestfailed", lambda r: print("FAIL", r.url[-70:], r.failure, flush=True))
                page.on("console", lambda m: print("CONSOLE", m.text[:160], flush=True))
            await page.goto(f"{_DESIGN_HOST}/index.html", wait_until="domcontentloaded")
            if hooks.get("seekApi"):  # motores con su propia linea de tiempo (window.<api>.seek)
                api = str(hooks["seekApi"])
                await page.wait_for_function(f"() => window.{api} && typeof window.{api}.seek === 'function'", timeout=20000)
                await page.evaluate(f"(t) => window.{api}.seek(t)", seconds)
                try:  # espera a que algun video tenga datos (se transcodifica la primera vez) y vuelve a posicionar
                    await page.wait_for_function(
                        "() => { const vs = [...document.querySelectorAll('video')]; return vs.length === 0 || vs.some((v) => v.readyState >= 2); }",
                        timeout=45000)
                except Exception:
                    pass
                await page.evaluate(f"(t) => window.{api}.seek(t)", seconds)
                await page.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true")
                await page.wait_for_timeout(int(hooks.get("settleMs", 600)))
            else:
                await page.wait_for_function(
                    "() => { const a = document.querySelector('audio'); return !!a && a.readyState >= 1; }", timeout=15000)
                await page.evaluate(
                    "(t) => { const a = document.querySelector('audio'); a.pause(); a.currentTime = t; }", seconds)
                await page.wait_for_function(
                    "(t) => { const a = document.querySelector('audio'); return !a.seeking && Math.abs(a.currentTime - t) < .25; }",
                    arg=seconds, timeout=15000)
                await page.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true")
                # Pausa el reloj y deja que la cámara del diseño llegue a su sitio: se mueve con easing por cuadro.
                if hooks.get("playClock"):  # el diseno lee el reloj del audio solo si suena: reproduccion muda breve
                    await page.evaluate("() => { const a = document.querySelector('audio'); a.muted = true; return a.play().catch(() => {}); }")
                    await page.wait_for_timeout(int(hooks.get("settleMs", 600)))
                    await page.evaluate("() => document.querySelector('audio').pause()")
                else:
                    await page.evaluate("() => document.querySelector('audio').pause()")
                    await page.wait_for_timeout(2500)
            if phrase and hooks.get("phraseMode") == "words":  # la frase como palabras separadas, cada una con su estilo
                await page.evaluate(
                    """([text, h]) => {
                      const stage = document.querySelector(h.stageSelector);
                      if (!stage) return;
                      stage.querySelectorAll('.clip, .figure').forEach((e) => e.remove());
                      const vw = innerWidth, vh = innerHeight, pal = h.palette || {};
                      const words = text.replace(/[¿?¡!.,;:]/g, '').split(/ +/).filter(Boolean);
                      const rowsN = words.length > 5 ? 3 : words.length > 2 ? 2 : 1;
                      const total = words.reduce((n, w) => n + w.length, 0);
                      const rows = [[]]; let acc = 0;
                      words.forEach((w) => {
                        if (rows.length < rowsN && acc >= total * rows.length / rowsN) rows.push([]);
                        rows[rows.length - 1].push(w); acc += w.length;
                      });
                      const kinds = h.kinds || ['poster', 'hollow', 'stencil', 'marker'];
                      let i = 0;
                      const made = rows.map((row) => row.map((w) => {
                        const kind = kinds[i % kinds.length]; const el = document.createElement('div');
                        el.className = 'clip ' + kind; el.dataset.mine = '1'; el.textContent = w;
                        el.style.fontSize = (vh * (kind === 'hollow' ? 0.17 : 0.125)) + 'px';
                        el.style.setProperty('--rot', ((i % 2 ? 1 : -1) * (1.5 + (i % 3))).toFixed(1) + 'deg');
                        if (kind === 'poster') {
                          const light = i % 2 === 0;
                          el.style.background = light ? pal.paperWhite : pal.ink;
                          el.style.color = light ? pal.ink : pal.paperWhite;
                        } else if (kind === 'stencil') el.style.color = pal.red;
                        else if (kind === 'marker') el.style.color = pal.ink;
                        else el.style.color = i % 2 ? pal.red : pal.ink;
                        stage.appendChild(el); i++; return el;
                      }));
                      const gap = vw * 0.028, rowGap = vh * 0.045;
                      const measure = () => made.map((row) => ({ w: row.reduce((n, e) => n + e.offsetWidth, 0) + gap * (row.length - 1), h: Math.max(...row.map((e) => e.offsetHeight)) }));
                      let m = measure();
                      const widest = Math.max(...m.map((r) => r.w));
                      if (widest > vw * 0.88) {
                        const f = vw * 0.88 / widest;
                        made.flat().forEach((e) => { e.style.fontSize = (parseFloat(e.style.fontSize) * f) + 'px'; });
                        m = measure();
                      }
                      const block = m.reduce((n, r) => n + r.h, 0) + rowGap * (m.length - 1);
                      let y = (vh - block) / 2;
                      made.forEach((row, r) => {
                        let x = (vw - m[r].w) / 2;
                        row.forEach((e) => { e.style.left = x + 'px'; e.style.top = (y + (m[r].h - e.offsetHeight) / 2) + 'px'; x += e.offsetWidth + gap; e.classList.add('enterL'); });
                        y += m[r].h + rowGap;
                      });
                    }""", [phrase, hooks])
                await page.wait_for_timeout(1000)
                await page.evaluate("() => document.querySelectorAll('.clip:not([data-mine]), .figure').forEach((e) => e.remove())")
            if os.environ.get("NB_THUMB_DEBUG"):
                if hooks.get("seekApi"):
                    print("SCENES", await page.evaluate("() => (window[%r].scenes() || []).slice(0, 80).map((s) => [+s.t0.toFixed(1), +(s.t1 ?? 0).toFixed(1), s.kind, s.type, s.clip, s.text || (s.words || []).map((w) => w.text).join(" ")])" % hooks["seekApi"]), flush=True)
                print("VIDEOS", await page.evaluate("() => [...document.querySelectorAll('video')].map((v) => [v.src.slice(-40), v.readyState, v.error && v.error.code, getComputedStyle(v).display, v.currentTime])"), flush=True)
            if hooks.get("keepOnlyPhrase") and phrase:  # oculta el texto de lineas previas que la escena apila
                await page.evaluate(
                    """(text) => {
                      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, '').trim();
                      const keep = new Set(norm(text).split(/ +/));
                      document.querySelectorAll('#stage *').forEach((e) => {
                        if (e.children.length) return;
                        const w = norm(e.textContent || '');
                        if (w && !w.split(/ +/).every((x) => keep.has(x))) e.style.visibility = 'hidden';
                      });
                    }""", phrase)
            if hooks.get("hideSelectors"):
                await page.evaluate("(list) => list.forEach((sel) => document.querySelectorAll(sel).forEach((e) => { e.style.display = 'none'; }))",
                                    hooks["hideSelectors"])
            if phrase and hooks.get("phraseSelector"):  # la frase elegida es un papel más del tablero, en el centro de la vista
                await page.evaluate(
                    """([text, selector]) => {
                      const world = document.getElementById('world');
                      const m = new DOMMatrix(world ? getComputedStyle(world).transform : undefined);
                      const scale = Math.hypot(m.a, m.b) || 1;
                      const cx = innerWidth / 2, cy = innerHeight / 2;
                      let best = null, bestD = 1e9;
                      for (const c of document.querySelectorAll(selector)) {
                        const r = c.getBoundingClientRect();
                        const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
                        if (d < bestD) { best = c; bestD = d; }
                      }
                      if (!best) return;
                      best.textContent = text;
                      best.style.whiteSpace = 'normal';
                      best.style.width = (innerWidth * 0.62 / scale) + 'px';
                      best.style.textAlign = 'center';
                      best.style.fontSize = (innerHeight * 0.10 / scale) + 'px';
                      best.style.lineHeight = '1.1';
                      best.style.clipPath = 'none';
                      best.style.zIndex = '5';
                      const r = best.getBoundingClientRect();
                      best.style.left = (parseFloat(best.style.left) + (cx - (r.left + r.width / 2)) / scale) + 'px';
                      best.style.top = (parseFloat(best.style.top) + (cy - (r.top + r.height / 2)) / scale) + 'px';
                    }""", [phrase, hooks["phraseSelector"]])
                await page.wait_for_timeout(300)
            if zoom > 1 and hooks.get("zoomSelector"):  # cartel de la intro más grande para la miniatura
                await page.evaluate("([sel, base, z]) => document.querySelectorAll(sel).forEach(f => { f.style.transform = `${base} scale(${z})`; })",
                    [hooks["zoomSelector"], hooks.get("zoomBase", ""), zoom])
                await page.wait_for_timeout(200)
            await page.screenshot(path=str(destination), type="jpeg", quality=90)
        finally:
            await browser.close()


async def design_frame(job: Job, design: dict[str, Any]) -> Path | None:
    """Cuadro del tablero animado del propio diseño: fondo «design» de una opción de miniatura."""
    from src.core.draft_thumbnails import directory
    from src.core.heavy_work import heavy_work_slot

    design_id = design_id_for(job)
    signature = design_signature(job)
    if design_id is None or signature is None:
        return None
    from src.core.draft_thumbnails import _thumbnail_style
    hooks = _thumbnail_style(design_id).get("capture") or {}
    seconds = await _design_seconds(job, design)
    key = hashlib.sha256(f"design-frame-v5|{json.dumps(hooks, sort_keys=True)}|{signature}|{seconds:.2f}|{_design_zoom(design):.2f}|{str(design.get('phrase') or '')}".encode()).hexdigest()[:24]
    destination = directory(job) / "frames" / f"design-{key}.jpg"
    if destination.is_file():
        return destination
    async with heavy_work_slot("thumbnail_background", key):
        if destination.is_file():
            return destination
        destination.parent.mkdir(parents=True, exist_ok=True)
        pending = destination.with_suffix(".pending.jpg")
        try:
            await _capture_design_frame(job, design_id, seconds, pending, _design_zoom(design), str(design.get("phrase") or "").strip()[:200], hooks)
            if not pending.is_file() or not pending.stat().st_size:
                raise ValueError("No se pudo capturar el fondo del diseño")
            os.replace(pending, destination)
        finally:
            pending.unlink(missing_ok=True)
    return destination


def data_url(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


async def embedded_assets(job: Job, design: dict, text: str = "") -> dict:
    typography = design.get("typography", {})
    fonts = []
    for font in (typography.get("font"), typography.get("outlineFont"), typography.get("subtitleFont")):
        if not font or any((item["family"],item["weight"],item["style"]) == (font["family"],font["weight"],font["style"]) for item in fonts):
            continue
        path = font_path(font["url"].rsplit("/", 1)[-1])
        if path:
            fonts.append({**font, "data": data_url(path, "font/woff2" if path.suffix == ".woff2" else "font/ttf")})
    background = await background_file(job, {**design.get("background", {}), "phrase": text} if design.get("background", {}).get("inside") else design.get("background", {}))
    return {"fonts": fonts, "backgroundData": data_url(background, "image/" + ("jpeg" if background.suffix.lower() in {".jpg", ".jpeg"} else background.suffix[1:])) if background else ""}
