"""Versiones livianas de los videos de las plantillas, solo para las vistas previas.

Por qué: muchos fondos de NodeMotion pesan 5–28 Mbit/s y el servidor sale a
internet con ~5 Mbit/s. Abierto por red (LAN/Tailscale), el navegador no llegaba
a bajarlos en tiempo real: la plantilla sonaba sin fondo, el fondo corría sin
música o tardaba >10 s en arrancar.

Qué hace: para cada video pedido desde una vista previa de la app (tarjeta,
modal, borrador del Estudio) sirve una copia en ≤540p a ~1 Mbit/s, sin audio (el
puente de preview silencia los videos igual), con la misma duración y cuadros, así
la sincronía con la canción no cambia. Las imágenes de más de 400 KB (fondos PNG de
1–3 MB) se sirven como WebP de ≤1920 px, que conserva la transparencia. Las copias viven en .cache/preview-media/
y se generan de a una, en segundo plano y con baja prioridad; mientras no existe,
se sirve el original. Las grabaciones NUNCA pasan por acá: los recorders leen los
archivos con su propio servidor local.

Pre-generar todas (por ejemplo después de `make media-pull`):
    uv run python -m src.presentation.api.preview_media src/templates
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import mimetypes
import subprocess
import sys
from pathlib import Path

import structlog
from fastapi import Request

from src.config.settings import BASE_DIR

logger = structlog.get_logger(__name__)

CACHE_DIR = BASE_DIR / ".cache" / "preview-media"
VIDEO_SUFFIXES = {".mp4", ".webm", ".mov"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg"}
MIN_IMAGE_BYTES = 400_000
mimetypes.add_type("image/webp", ".webp")
# Por debajo de esto el original ya entra en la conexión: no se genera copia.
MAX_ORIGINAL_BPS = 1_500_000
PREVIEW_QUERY_MARKERS = ("controls=1", "preview=card")

_queue: set[Path] = set()
_lock = asyncio.Lock()


def _key(path: Path) -> str:
    st = path.stat()
    return hashlib.sha1(f"{path.resolve()}|{st.st_size}|{st.st_mtime_ns}".encode()).hexdigest()


def _is_image(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_SUFFIXES


def _wants_variant(path: Path) -> bool:
    if path.suffix.lower() in VIDEO_SUFFIXES:
        return True
    return _is_image(path) and path.stat().st_size > MIN_IMAGE_BYTES


def _paths(path: Path) -> tuple[Path, Path]:
    key = _key(path)
    return CACHE_DIR / f"{key}{'.webp' if _is_image(path) else '.mp4'}", CACHE_DIR / f"{key}.skip"


def is_preview_request(request: Request) -> bool:
    """Pedido hecho desde una vista previa de la app (el iframe lleva esos query params)."""
    referer = request.headers.get("referer", "")
    return any(marker in referer for marker in PREVIEW_QUERY_MARKERS)


def _bitrate(path: Path) -> int | None:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=bit_rate", "-of", "json", str(path)],
            capture_output=True, text=True, timeout=30, check=True,
        ).stdout
        return int(json.loads(out)["format"]["bit_rate"])
    except Exception:  # noqa: BLE001 - sin bitrate conocido se genera la copia igual
        return None


def _image_cmd(src: Path, dst: Path) -> list[str]:
    # WebP conserva el canal alfa (sujetos recortados en PNG); ≤ 1920 px de ancho.
    return [
        "nice", "-n", "10", "ffmpeg", "-y", "-v", "error", "-i", str(src),
        "-vf", "scale='min(1920,iw)':-2", "-c:v", "libwebp", "-quality", "82",
        "-f", "webp", str(dst),
    ]


def _transcode_cmd(src: Path, dst: Path) -> list[str]:
    # Lado corto ≤ 540 px (sirve para 16:9 y 9:16), mismos cuadros y duración.
    scale = "scale='if(gt(iw,ih),-2,min(540,iw))':'if(gt(iw,ih),min(540,ih),-2)'"
    return [
        "nice", "-n", "10", "ffmpeg", "-y", "-v", "error", "-i", str(src),
        "-map", "0:v:0", "-an", "-vf", scale,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
        "-maxrate", "1200k", "-bufsize", "2400k", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-f", "mp4", str(dst),
    ]


def build_variant(src: Path) -> Path | None:
    """Genera (si hace falta) la copia liviana de `src`. Bloqueante: usar en CLI o en un hilo."""
    variant, skip = _paths(src)
    if variant.exists():
        return variant
    if skip.exists():
        return None
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    bps = None
    if not _is_image(src):
        bps = _bitrate(src)
        if bps is not None and bps <= MAX_ORIGINAL_BPS:
            skip.touch()
            return None
    tmp = variant.with_name(f"{variant.stem}.tmp{variant.suffix}")
    cmd = _image_cmd(src, tmp) if _is_image(src) else _transcode_cmd(src, tmp)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not tmp.exists():
        tmp.unlink(missing_ok=True)
        skip.touch()  # no reintentar en cada pedido: se sirve el original
        logger.warning("preview_media_failed", src=str(src), error=result.stderr[-300:])
        return None
    tmp.replace(variant)
    logger.info("preview_media_ready", src=str(src), original_bps=bps, size=variant.stat().st_size)
    return variant


async def _worker(src: Path) -> None:
    try:
        async with _lock:  # de a una: no competir con las grabaciones por la CPU
            await asyncio.to_thread(build_variant, src)
    finally:
        _queue.discard(src)


def preview_variant(path: Path) -> Path | None:
    """Copia liviana lista para servir, o None (y la encola si todavía no existe)."""
    if not _wants_variant(path):
        return None
    variant, skip = _paths(path)
    if variant.exists():
        return variant
    if not skip.exists() and path not in _queue:
        _queue.add(path)
        asyncio.get_running_loop().create_task(_worker(path))
    return None


def preview_config_json(content: str, request: Request) -> str:
    """config.json pedido desde una vista previa: sin la precarga de medios como blob.

    Las plantillas del motor comercial (promo-*, varias lyrics-*) bajan TODOS sus
    videos enteros como blob antes de arrancar (`config.preload`, pensado para el
    servidor del grabador, que no soporta Range). La API sí soporta Range: en la
    vista previa eso solo demoraba el arranque ~8 s. Las grabaciones no pasan por acá.
    """
    if not is_preview_request(request):
        return content
    try:
        data = json.loads(content)
    except ValueError:
        return content
    configs = data.get("configs") if isinstance(data, dict) else None
    if not isinstance(configs, list):
        return content
    for config in configs:
        if isinstance(config, dict):
            config["preload"] = False
    return json.dumps(data, ensure_ascii=False)


def media_for_request(path: Path, request: Request, *, always_preview: bool = False) -> Path:
    """El archivo a servir: la copia liviana si el pedido es de una vista previa y ya existe."""
    if always_preview or is_preview_request(request):
        variant = preview_variant(path)
        if variant is not None:
            return variant
    return path


def main(argv: list[str]) -> int:
    roots = [Path(a) for a in argv] or [BASE_DIR / "src" / "templates"]
    videos = sorted(
        p for root in roots for p in root.rglob("*")
        if p.is_file() and (p.suffix.lower() in VIDEO_SUFFIXES or p.suffix.lower() in IMAGE_SUFFIXES)
        and _wants_variant(p)
        and not any(part in {"work", "render", "sandbox", "media_originals", "_referencias"} for part in p.parts)
    )
    made = skipped = 0
    for i, video in enumerate(videos, 1):
        result = build_variant(video)
        made += result is not None
        skipped += result is None
        print(f"[{i}/{len(videos)}] {'copia' if result else 'original'}  {video}", flush=True)
    print(f"listo: {made} copias livianas, {skipped} se sirven tal cual. Caché: {CACHE_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
