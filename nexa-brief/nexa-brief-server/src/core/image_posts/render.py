"""Puerto público del motor de render estático."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, AsyncIterator, Mapping

from .plan import ImagePlan
from .style import StyleSystem

SERVER_ROOT = Path(__file__).resolve().parents[3]
EXPORT_TOOLS = SERVER_ROOT / "src" / "templates" / "_tools" / "explainer-kit" / "tools"
sys.path.insert(0, str(EXPORT_TOOLS))

from image_export import (  # noqa: E402
    ImageExportError,
    build_preview_html,
    renderer_source_hash,
    RENDERER_VERSION,
    ReelFrame,
    ReelFrameSet,
    RenderManifest,
    reel_frame_manifest,
    render_images,
    render_images_async,
    render_reel_frames,
)


def render(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
) -> RenderManifest:
    """Entrega bytes y manifiestos; B asigna storage_key y rutas definitivas."""
    return render_images(plan, style, media_bytes)


async def render_async(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
) -> RenderManifest:
    """Versión no bloqueante para el trabajo asíncrono del backend."""
    import time
    from .trace import emit
    started = time.monotonic()
    emit("render", label="Inicio de render", status="running")
    try:
        result = await render_images_async(plan, style, media_bytes)
    except Exception as exc:
        emit("render_qc", label="Render rechazado", status="failed", reason=str(exc),
             qc=getattr(exc, "qc", {}), slide_id=getattr(exc, "slide_id", None), seconds=round(time.monotonic()-started, 3))
        raise
    emit("render_qc", label="Render y QC aprobados", status="ok", seconds=round(time.monotonic()-started, 3),
         slides=[{"slide_id": asset.slide_id, "qc": asset.qc} for asset in result.assets])
    return result


async def render_reel(
    plan: ImagePlan | Mapping[str, Any],
    style: StyleSystem | Mapping[str, Any],
    media_bytes: Mapping[str, bytes] | None = None,
    *,
    fps: int = 30,
    duration_seconds: int = 15,
) -> AsyncIterator[ReelFrame]:
    """Renderiza los fotogramas; C agrega pista licenciada y codifica H.264/AAC."""
    async for frame in render_reel_frames(
        plan,
        style,
        media_bytes,
        fps=fps,
        duration_seconds=duration_seconds,
    ):
        yield frame


__all__ = [
    "ImageExportError",
    "ReelFrame",
    "ReelFrameSet",
    "RenderManifest",
    "reel_frame_manifest",
    "render",
    "render_async",
    "build_preview_html",
    "renderer_source_hash",
    "RENDERER_VERSION",
    "render_reel",
]
