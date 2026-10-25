#!/usr/bin/env python3
"""Renderer determinista de láminas y cuadros base para Reel."""
from __future__ import annotations

import argparse
import os
import asyncio
import base64
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import sys
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
from src.core.image_posts.style import StyleSystem, parse_style  # noqa: E402
from src.core.image_posts.validate import validate_jpeg, validate_plan  # noqa: E402


RENDERER_VERSION = "image-stage-1.0.0"
STAGE_SIZE = (1080, 1350)
REEL_SIZE = (1080, 1920)
REEL_FPS = 30
REEL_DURATION_SECONDS = 15
KIT = Path(__file__).resolve().parents[1]
TEMPLATES = KIT.parents[1]


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
                },
                "music": {"mode": "none"},
                "ai_usage": [],
                "validations": [
                    {
                        "name": "jpeg_srgb_dimensions",
                        "version": "1",
                        "passed": all(asset.width == 1080 and asset.height == 1350 for asset in self.assets),
                        "checked_at": self.finished_at,
                        "details": {"max_bytes": 3_984_588},
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
    if plan.renderer_version != RENDERER_VERSION:
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
                    raise ImageExportError(f"Control de composición fallido en {slide.slide_id}: {qc}")
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
        quality=90,
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
    """Renderiza todas las láminas a JPEG sRGB 1080×1350, sin escribir rutas."""
    image_plan = parse_image_plan(plan)
    style_system = _parse_style(style)
    media = dict(media_bytes or {})
    started = time.perf_counter()
    started_at = _timestamp()
    outputs, _, engine_version = await _render_pngs(image_plan, style_system, media, size=STAGE_SIZE)
    digest = plan_hash(image_plan, style_system)
    assets: list[RenderedAsset] = []
    for slide, (png, qc) in zip(image_plan.slides, outputs, strict=True):
        jpeg = _jpeg(png)
        validation = validate_jpeg(jpeg, style_system, qc=qc)
        validation.require()
        assets.append(
            RenderedAsset(
                asset_id=f"asset_{slide.slide_id}",
                plan_hash=digest,
                slide_id=slide.slide_id,
                sha256=hashlib.sha256(jpeg).hexdigest(),
                mime="image/jpeg",
                format="JPEG",
                width=1080,
                height=1350,
                aspect_ratio="4:5",
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
    args = parser.parse_args()
    plan = parse_image_plan(json.loads(args.plan.read_text(encoding="utf-8")))
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
