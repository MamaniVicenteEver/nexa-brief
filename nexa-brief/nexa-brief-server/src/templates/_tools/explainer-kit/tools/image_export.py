#!/usr/bin/env python3
"""Renderer determinista de láminas y cuadros base para Reel."""
from __future__ import annotations

import argparse
import os
import asyncio
import base64
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import sys
import secrets
import time
from typing import Any, AsyncIterator, Mapping
import urllib.parse

import PIL
from PIL import Image, ImageCms

SERVER_ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(SERVER_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import shoot  # noqa: E402
from src.core.image_posts.plan import ImagePlan, parse_image_plan, plan_hash  # noqa: E402
from src.core.image_posts.profiles import get_image_profile, IMAGE_FORMATS  # noqa: E402
from src.core.image_posts.style import StyleSystem, parse_style  # noqa: E402
from src.core.image_posts.validate import validate_jpeg, validate_plan  # noqa: E402


RENDERER_VERSION = "image-stage-1.1.1"
SUPPORTED_RENDERER_VERSIONS = frozenset({"image-stage-1.0.0", "image-stage-1.1.0", RENDERER_VERSION})
STAGE_SIZE = (1080, 1350)  # Legacy constant; static exports resolve the plan profile.
JPEG_QUALITY = 95
REEL_SIZE = (1080, 1920)
REEL_FPS = 30
REEL_DURATION_SECONDS = 15
KIT = Path(__file__).resolve().parents[1]
TEMPLATES = KIT.parents[1]
IMAGE_SKIN_SCRIPTS = {
    "rough": ("vendor/rough.js", "designs/rough/image-components.js"),
    "binary": ("designs/binary/image-components.js",),
}
PREVIEW_FONTS = SERVER_ROOT / "src/skills/image_posts/styles/fonts/preview"


class ImageExportError(RuntimeError):
    """El stage o la validación no pudieron producir un asset válido."""


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _parse_style(style: StyleSystem | Mapping[str, Any]) -> StyleSystem:
    return style if isinstance(style, StyleSystem) else parse_style(style)


@dataclass(frozen=True)
class RenderedAsset:
    asset_id: str
    plan_hash: str
    slide_id: str
    sha256: str
    mime: str
    format: str
    width: int
    height: int
    aspect_ratio: str
    bytes: int
    color_profile: str
    rendered_at: str
    qc: dict[str, Any]
    content: bytes = field(repr=False, compare=False)

    def to_record(self) -> dict[str, Any]:
        """Metadatos técnicos para PublicationRecord; B asigna storage_key."""
        return {
            "asset_id": self.asset_id,
            "slide_id": self.slide_id,
            "mime": self.mime,
            "format": self.format,
            "width": self.width,
            "height": self.height,
            "aspect_ratio": self.aspect_ratio,
            "bytes": self.bytes,
            "color_profile": self.color_profile,
            "sha256": self.sha256,
            "rendered_at": self.rendered_at,
        }


@dataclass(frozen=True)
class RenderManifest:
    plan_id: str
    plan_hash: str
    category_id: str
    template_id: str
    assets: tuple[RenderedAsset, ...]
    started_at: str
    finished_at: str
    duration_seconds: float
    engine: str
    engine_version: str
    renderer_version: str
    source_hash: str = ""

    def to_record(self, plan: ImagePlan) -> dict[str, Any]:
        return {
            "technical": {
                "kind": "image" if self.template_id == "daily_fact" else "carousel",
                "template_id": self.template_id,
                "slides": [asset.to_record() for asset in self.assets],
                "reel": None,
                "composition_plan": {
                    **plan.to_dict(),
                    "plan_hash": self.plan_hash,
                },
                "render": {
                    "started_at": self.started_at,
                    "finished_at": self.finished_at,
                    "duration_seconds": self.duration_seconds,
                    "engine": self.engine,
                    "engine_version": self.engine_version,
                    "renderer_version": self.renderer_version,
                    **({"source_hash": self.source_hash} if self.source_hash else {}),
                },
                "music": {"mode": "none"},
                "ai_usage": [],
                "validations": [
                    {
                        "name": "jpeg_srgb_dimensions",
                        "version": "1",
                        "passed": all((asset.width, asset.height) == get_image_profile(plan.format).size for asset in self.assets),
                        "checked_at": self.finished_at,
                        "details": {"max_bytes": 3_984_588, "format": plan.format, "jpeg_quality": JPEG_QUALITY, "chroma_subsampling": "4:4:4"},
                    },
                    {
                        "name": "readability_contrast",
                        "version": "1",
                        "passed": all(asset.qc["overflow"] is False and asset.qc["contrast"] and asset.qc["readability"] for asset in self.assets),
                        "checked_at": self.finished_at,
                        "details": {"overflow": any(asset.qc["overflow"] for asset in self.assets)},
                    },
                ],
            }
        }


@dataclass(frozen=True)
class ReelFrame:
    frame_index: int
    slide_index: int
    pts_seconds: float
    sha256: str
    width: int
    height: int
    mime: str
    content: bytes = field(repr=False, compare=False)


@dataclass(frozen=True)
class ReelFrameSet:
    width: int
    height: int
    fps: int
    duration_seconds: int
    frame_count: int
    slide_duration_seconds: int
    transition_seconds: float
    source_plan_hash: str


def _stage_url(design_id: str, port: int) -> str:
    stage_path = (KIT / "showcase" / "image-stage.html").relative_to(TEMPLATES).as_posix()
    return f"http://127.0.0.1:{port}/{stage_path}?" + urllib.parse.urlencode({"d": design_id})


def _base64_items(items: Mapping[str, bytes]) -> dict[str, str]:
    return {key: base64.b64encode(value).decode("ascii") for key, value in items.items()}


def _font_payload(style: StyleSystem) -> dict[str, bytes]:
    try:
        return style.font_bytes()
    except (OSError, ValueError) as exc:
        raise ImageExportError(str(exc)) from exc


def _preview_font_payload(style: StyleSystem) -> tuple[dict[str, bytes], dict[str, str]]:
    """Use verified, lossless WOFF2 copies; export/video TTF assets stay intact."""
    fonts = _font_payload(style)
    formats = {path: "truetype" for path in fonts}
    manifest_path = PREVIEW_FONTS / "manifest.json"
    if not manifest_path.is_file():
        return fonts, formats
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("schema_version") != 1 or manifest.get("format") != "woff2":
            raise ValueError("versión de manifiesto no admitida")
        by_source = {row["source_sha256"]: row for row in manifest["fonts"]}
        for asset in style.font_assets:
            row = by_source.get(asset.sha256)
            if row is None:
                continue  # A newly registered font still has its verified TTF fallback.
            name = row["preview_path"]
            if not isinstance(name, str) or Path(name).name != name or not name.endswith(".woff2"):
                raise ValueError("ruta de fuente de vista previa inválida")
            content = (PREVIEW_FONTS / name).read_bytes()
            if hashlib.sha256(content).hexdigest() != row["sha256"]:
                raise ValueError("hash de fuente WOFF2 incorrecto")
            fonts[asset.path] = content
            formats[asset.path] = "woff2"
    except (KeyError, OSError, TypeError, ValueError) as exc:
        raise ImageExportError("No se pudo verificar la fuente de vista previa") from exc
    return fonts, formats


def renderer_source_hash(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
) -> str:
    """Fingerprint the application-owned sources behind a preview/export.

    Plan/style hashes identify editable data and licensed media. This separate
    hash identifies the code and prevents stale previews after an engine update.
    Versions still need to be bumped for intentional renderer changes.
    """
    image_plan = parse_image_plan(plan)
    style_system = _parse_style(style)
    get_image_profile(image_plan.format)
    if style_system.design_id not in IMAGE_SKIN_SCRIPTS:
        raise ImageExportError("El diseño no tiene una piel de imágenes registrada")
    files = (
        "tools/image_export.py", "engine/image-engine.js", "engine/image-stage-runtime.js",
        "engine/image-engine.css", "engine/image-skins.css", *IMAGE_SKIN_SCRIPTS[style_system.design_id],
    )
    digest = hashlib.sha256()
    for relative in files:
        digest.update(relative.encode("utf-8") + b"\x00" + (KIT / relative).read_bytes())
    digest.update((SERVER_ROOT / "src/core/image_posts/profiles.py").read_bytes())
    preview_manifest = PREVIEW_FONTS / "manifest.json"
    if preview_manifest.is_file():
        digest.update(preview_manifest.read_bytes())
    return digest.hexdigest()


def build_preview_html(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
    *,
    slide_id: str,
    format: str | None = None,
) -> str:
    """Return an offline, isolated HTML view of the editable composition.

    The same engine, skin, font bytes and layout/QC runtime render the final JPEG.
    No browser process or JPEG conversion is needed for this responsive preview.
    Embed with an iframe sandbox containing only ``allow-scripts``.
    """
    image_plan = parse_image_plan(plan)
    if format is not None:
        image_plan = replace(image_plan, format=get_image_profile(format).format)
    profile = get_image_profile(image_plan.format)
    style_system = _parse_style(style)
    media = dict(media_bytes or {})
    validate_plan(image_plan, style_system, media_bytes=media).require()
    if image_plan.renderer_version not in SUPPORTED_RENDERER_VERSIONS:
        raise ImageExportError(f"renderer_version debe ser {RENDERER_VERSION}")
    slide_index = next((index for index, slide in enumerate(image_plan.slides) if slide.slide_id == slide_id), None)
    if slide_index is None:
        raise ImageExportError("La lámina no pertenece al plan")
    if style_system.design_id not in IMAGE_SKIN_SCRIPTS:
        raise ImageExportError("El diseño no tiene una piel de imágenes registrada")
    # All local files are application-owned and explicitly registered above.
    scripts = ["engine/image-engine.js", "engine/image-stage-runtime.js", *IMAGE_SKIN_SCRIPTS[style_system.design_id]]
    script_source = "\n".join((KIT / path).read_text(encoding="utf-8") for path in scripts)
    styles = "\n".join((KIT / path).read_text(encoding="utf-8") for path in ("engine/image-engine.css", "engine/image-skins.css"))
    selected_media = {ref.asset_id for ref in image_plan.slides[slide_index].media}
    preview_fonts, font_formats = _preview_font_payload(style_system)
    payload = {
        "plan": image_plan.to_dict(),
        "style": style_system.to_dict(),
        "media": {key: "data:image/jpeg;base64," + base64.b64encode(value).decode("ascii") for key, value in media.items() if key in selected_media},
        "fonts": _base64_items(preview_fonts),
        "font_formats": font_formats,
        "slide_index": slide_index,
        "width": profile.width,
        "height": profile.height,
        "progress": 0,
        "mode": "image",
    }
    # Inert JSON avoids a second base64 layer around large fonts/photos. Escaping
    # HTML delimiters and JS separators prevents script-closing text injection.
    encoded = (json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
               .replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")
               .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))
    nonce = secrets.token_urlsafe(24)
    bootstrap = """
    (async () => {
      const status = document.getElementById('preview-status');
      const stage = document.getElementById('stage');
      const fit = () => {
        const scale = Math.min(innerWidth / payload.width, innerHeight / payload.height);
        stage.style.transform = 'scale(' + scale + ')';
        stage.style.left = ((innerWidth - payload.width * scale) / 2) + 'px';
        stage.style.top = ((innerHeight - payload.height * scale) / 2) + 'px';
      };
      let payload;
      try {
        payload = JSON.parse(document.getElementById('preview-payload').textContent);
        window.ImageStage = window.createImageStage();
        const qc = await window.ImageStage.render(payload);
        if (qc.overflow || !qc.contrast || !qc.readability) throw new Error('Revisar la composición: el contenido no supera el control de calidad.');
        window.__imagePreviewQc = qc;
        window.__imagePreviewReady = true;
        document.documentElement.dataset.renderState = 'ready';
        fit();
        addEventListener('resize', fit);
        status.hidden = true;
        stage.style.visibility = 'visible';
        document.body.setAttribute('aria-busy', 'false');
      } catch (error) {
        document.documentElement.dataset.renderState = 'failed';
        status.textContent = error.message || 'No se pudo mostrar la composición.';
        document.body.setAttribute('aria-busy', 'false');
      }
    })();
    """
    safe_source = (script_source + "\n" + bootstrap).replace("</script", "<\\/script")
    return f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-{nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Vista previa del post</title><style>
*{{box-sizing:border-box}}html,body{{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}}
#stage{{position:absolute;transform-origin:top left;overflow:hidden;visibility:hidden}}
#preview-status{{margin:0;position:absolute;inset:0;display:grid;place-items:center;padding:24px;color:#d5d5d5;background:#0b0b0b;font:14px/1.4 sans-serif;text-align:center}}
#preview-status[hidden]{{display:none}}
{styles}
</style></head><body aria-busy="true"><p id="preview-status" role="status">Preparando vista previa…</p><div id="stage" aria-label="Composición editable del post"></div>
<script id="preview-payload" type="application/json" nonce="{nonce}">{encoded}</script>
<script nonce="{nonce}">{safe_source}</script></body></html>'''


async def _render_pngs(
    plan: ImagePlan,
    style: StyleSystem,
    media_bytes: Mapping[str, bytes],
    *,
    size: tuple[int, int],
    mode: str = "image",
) -> tuple[list[tuple[bytes, dict[str, Any]]], list[str], str]:
    report = validate_plan(plan, style, media_bytes=media_bytes)
    if not report.passed:
        raise ImageExportError("; ".join(report.errors))
    if plan.renderer_version not in SUPPORTED_RENDERER_VERSIONS:
        raise ImageExportError(f"renderer_version debe ser {RENDERER_VERSION}")
    font_bytes = _font_payload(style)
    media_ids = {media.asset_id for slide in plan.slides for media in slide.media}
    missing = media_ids - set(media_bytes)
    if missing:
        raise ImageExportError(f"Faltan medios: {', '.join(sorted(missing))}")
    data_urls = {
        key: "data:image/jpeg;base64," + base64.b64encode(value).decode("ascii")
        for key, value in media_bytes.items()
    }
    font_payload = _base64_items(font_bytes)
    server = shoot.serve(TEMPLATES)
    errors: list[str] = []
    outputs: list[tuple[bytes, dict[str, Any]]] = []
    browser_version = "unknown"
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=shoot.CHROMIUM)
            browser_version = browser.version
            page = await browser.new_page(
                viewport={"width": size[0], "height": size[1]},
                device_scale_factor=1,
                color_scheme="dark",
                reduced_motion="reduce",
            )
            origin = f"http://127.0.0.1:{server.server_port}/"

            async def local_only(route):
                if route.request.url.startswith(origin):
                    await route.continue_()
                else:
                    await route.abort()

            await page.route("**/*", local_only)
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(_stage_url(style.design_id, server.server_port), wait_until="domcontentloaded", timeout=120_000)
            await page.wait_for_function("window.ImageStage && window.ImageStage.ready", timeout=60_000)
            plan_data = plan.to_dict()
            for index, slide in enumerate(plan.slides):
                payload = {
                    "plan": plan_data,
                    "style": style.to_dict(),
                    "media": data_urls,
                    "fonts": font_payload,
                    "slide_index": index,
                    "width": size[0],
                    "height": size[1],
                    "progress": 0,
                    "mode": mode,
                }
                qc = await page.evaluate("payload => window.ImageStage.render(payload)", payload)
                if errors:
                    raise ImageExportError("; ".join(errors))
                if qc.get("overflow") or not qc.get("contrast") or not qc.get("readability"):
                    debug_dir = os.environ.get("IMAGE_QC_DEBUG_DIR")
                    if debug_dir:  # ver la lámina que falló sin abrir el navegador
                        await page.screenshot(path=str(Path(debug_dir) / f"qc-fail-{slide.slide_id}.png"))
                    error = ImageExportError(f"Control de composición fallido en {slide.slide_id}: {qc}")
                    error.slide_id, error.qc = slide.slide_id, qc
                    raise error
                png = await page.screenshot(type="png", animations="disabled")
                outputs.append((png, qc))
            await browser.close()
    finally:
        server.shutdown()
    if errors:
        raise ImageExportError("; ".join(errors))
    engine_version = f"Chromium/{browser_version} + Pillow/{PIL.__version__}"
    return outputs, errors, engine_version


def _jpeg(png: bytes) -> bytes:
    image = Image.open(io.BytesIO(png)).convert("RGB")
    profile = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes())
    # La fecha de creación ICC cambia en cada proceso; fijarla conserva el perfil y el hash.
    profile[24:36] = b"\x07\xe8\x00\x01\x00\x01\x00\x00\x00\x00\x00\x00"
    output = io.BytesIO()
    image.save(
        output,
        format="JPEG",
        quality=JPEG_QUALITY,
        optimize=False,
        progressive=False,
        subsampling=0,
        icc_profile=bytes(profile),
        exif=b"",
    )
    return output.getvalue()


async def render_images_async(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
) -> RenderManifest:
    """Renderiza el código a JPEG sRGB en el perfil del plan, sin escribir rutas."""
    image_plan = parse_image_plan(plan)
    style_system = _parse_style(style)
    media = dict(media_bytes or {})
    profile = get_image_profile(image_plan.format)
    started = time.perf_counter()
    started_at = _timestamp()
    outputs, _, engine_version = await _render_pngs(image_plan, style_system, media, size=profile.size)
    digest = plan_hash(image_plan, style_system)
    assets: list[RenderedAsset] = []
    for slide, (png, qc) in zip(image_plan.slides, outputs, strict=True):
        jpeg = _jpeg(png)
        validation = validate_jpeg(jpeg, style_system, expected_size=profile.size, qc=qc)
        validation.require()
        assets.append(
            RenderedAsset(
                asset_id=f"asset_{slide.slide_id}",
                plan_hash=digest,
                slide_id=slide.slide_id,
                sha256=hashlib.sha256(jpeg).hexdigest(),
                mime="image/jpeg",
                format="JPEG",
                width=profile.width,
                height=profile.height,
                aspect_ratio=profile.format,
                bytes=len(jpeg),
                color_profile="sRGB",
                rendered_at=_timestamp(),
                qc=qc,
                content=jpeg,
            )
        )
    finished_at = _timestamp()
    return RenderManifest(
        plan_id=image_plan.plan_id,
        plan_hash=digest,
        category_id=image_plan.category_id,
        template_id=image_plan.template_id,
        assets=tuple(assets),
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(time.perf_counter() - started, 3),
        engine="Playwright + Pillow",
        engine_version=engine_version,
        renderer_version=RENDERER_VERSION,
        source_hash=renderer_source_hash(image_plan, style_system),
    )


def render_images(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
) -> RenderManifest:
    """Wrapper síncrono para scripts y pruebas."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(render_images_async(plan, style, media_bytes))
    raise ImageExportError("Dentro de un event loop usa render_images_async")


async def render_reel_frames(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
    *,
    fps: int = REEL_FPS,
    duration_seconds: int = REEL_DURATION_SECONDS,
) -> AsyncIterator[ReelFrame]:
    """Emite cuadros PNG 9:16; el adaptador C agrega audio y codifica el MP4."""
    image_plan = parse_image_plan(plan)
    style_system = _parse_style(style)
    validate_plan(image_plan, style_system, media_bytes=dict(media_bytes or {})).require()
    if fps != REEL_FPS or not isinstance(duration_seconds, int) or not 8 <= duration_seconds <= 20:
        raise ImageExportError("Reel requiere 30 fps y una duración entera de 8 a 20 segundos")
    font_bytes = _font_payload(style_system)
    media_data = {
        key: "data:image/jpeg;base64," + base64.b64encode(value).decode("ascii")
        for key, value in (media_bytes or {}).items()
    }
    font_data = _base64_items(font_bytes)
    count = fps * duration_seconds
    slide_duration = duration_seconds / len(image_plan.slides)
    server = shoot.serve(TEMPLATES)
    from playwright.async_api import async_playwright

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=shoot.CHROMIUM)
            page = await browser.new_page(
                viewport={"width": REEL_SIZE[0], "height": REEL_SIZE[1]},
                device_scale_factor=1,
                color_scheme="dark",
                reduced_motion="reduce",
            )
            origin = f"http://127.0.0.1:{server.server_port}/"

            async def local_only(route):
                if route.request.url.startswith(origin):
                    await route.continue_()
                else:
                    await route.abort()

            await page.route("**/*", local_only)
            await page.goto(_stage_url(style_system.design_id, server.server_port), wait_until="domcontentloaded", timeout=120_000)
            await page.wait_for_function("window.ImageStage && window.ImageStage.ready", timeout=60_000)
            for frame_index in range(count):
                pts = frame_index / fps
                slide_index = min(int(pts / slide_duration), len(image_plan.slides) - 1)
                within_slide = (pts - slide_index * slide_duration) / slide_duration
                payload = {
                    "plan": image_plan.to_dict(),
                    "style": style_system.to_dict(),
                    "media": media_data,
                    "fonts": font_data,
                    "slide_index": slide_index,
                    "width": REEL_SIZE[0],
                    "height": REEL_SIZE[1],
                    "progress": within_slide,
                    "mode": "reel",
                }
                qc = await page.evaluate("payload => window.ImageStage.render(payload)", payload)
                if qc.get("overflow") or not qc.get("contrast") or not qc.get("readability"):
                    raise ImageExportError(f"Control de composición fallido en cuadro {frame_index}: {qc}")
                await page.evaluate("progress => window.ImageStage.setProgress(progress)", within_slide)
                png = await page.screenshot(type="png", animations="disabled")
                yield ReelFrame(
                    frame_index=frame_index,
                    slide_index=slide_index,
                    pts_seconds=pts,
                    sha256=hashlib.sha256(png).hexdigest(),
                    width=REEL_SIZE[0],
                    height=REEL_SIZE[1],
                    mime="image/png",
                    content=png,
                )
            await browser.close()
    finally:
        server.shutdown()


def reel_frame_manifest(plan: ImagePlan | Mapping[str, Any], style: StyleSystem | Mapping[str, Any]) -> ReelFrameSet:
    image_plan = parse_image_plan(plan)
    style_system = _parse_style(style)
    return ReelFrameSet(
        width=REEL_SIZE[0],
        height=REEL_SIZE[1],
        fps=REEL_FPS,
        duration_seconds=REEL_DURATION_SECONDS,
        frame_count=REEL_FPS * REEL_DURATION_SECONDS,
        slide_duration_seconds=REEL_DURATION_SECONDS // len(image_plan.slides),
        transition_seconds=0.25,
        source_plan_hash=plan_hash(image_plan, style_system),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta láminas deterministas de un ImagePlan.")
    parser.add_argument("plan", type=Path)
    parser.add_argument("--style", required=True, choices=("node_tech", "node_history"))
    parser.add_argument("--media", action="append", default=[], metavar="ASSET_ID=PATH")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--format", choices=IMAGE_FORMATS, help="Perfil de exportación; conserva el plan si no se indica")
    args = parser.parse_args()
    plan = parse_image_plan(json.loads(args.plan.read_text(encoding="utf-8")))
    if args.format is not None:
        plan = replace(plan, format=args.format)
    from src.adapters.data.local_image_post_resources import LocalImagePostResources

    media = {}
    for item in args.media:
        asset_id, separator, file_path = item.partition("=")
        if not separator:
            parser.error("--media debe tener el formato ASSET_ID=PATH")
        media[asset_id] = Path(file_path).read_bytes()
    manifest = render_images(plan, LocalImagePostResources().get_style(args.style), media)
    args.out.mkdir(parents=True, exist_ok=True)
    for index, asset in enumerate(manifest.assets, start=1):
        path = args.out / f"{index:02d}.jpg"
        path.write_bytes(asset.content)
        print(f"✓ {path} ({asset.width}×{asset.height}, {asset.bytes} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
