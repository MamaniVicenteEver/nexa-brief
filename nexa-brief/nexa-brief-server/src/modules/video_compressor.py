"""Compresión de un video grabado antes de publicarlo: mismo aspecto, mucho menos peso.

Los motores graban con calidad de archivo maestro (HyperFrames "high" = H.264 CRF 15, ~30 Mbps
en 1080p), y las plantillas con grano o ruido disparan el peso. Se recomprime con H.264 CRF 18 y
un tope de bitrate: en la prueba del 2026-10-20 (lyrics-grunge, 1:12) bajó de 292 a 104 MB sin
diferencia visible, en ~1,6× la duración del video. YouTube, Facebook, Instagram y TikTok
recomprimen todo lo que reciben, así que un archivo más liviano sube y se procesa antes sin perder
calidad en la plataforma.

El archivo comprimido reemplaza al original en el mismo path (nada de lo que sigue cambia), y el
original queda en `masters/<nombre>` al lado, salvo que VIDEO_COMPRESS_KEEP_MASTER=false. Va en
una subcarpeta para que los listados de `*.mp4` no lo tomen como otro video.

Nunca rompe una grabación: si ffmpeg falla, tarda demasiado o el resultado no es más chico, el
video queda tal cual y solo se registra en el log.
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import structlog

from src.config.settings import settings

logger = structlog.get_logger(__name__)

MASTERS_DIR = "masters"
# Un video que ya está cerca del tope (otro motor, o ya comprimido) no se toca.
_ALREADY_LIGHT = 1.15
# Holgura del timeout: ~1,6× la duración en la laptop; 6× cubre una máquina más lenta.
_TIMEOUT_PER_SECOND = 6.0
_TIMEOUT_MIN = 120.0


def master_path(video: Path) -> Path:
    return video.parent / MASTERS_DIR / video.name


async def _probe(video: Path) -> tuple[float, float] | None:
    """(duración en s, bitrate total en bit/s) del video, o None si ffprobe no puede leerlo."""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate", "-of", "json", str(video),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0:
        return None
    try:
        fmt = json.loads(out)["format"]
        return float(fmt["duration"]), float(fmt["bit_rate"])
    except (KeyError, ValueError, TypeError):
        return None


def ffmpeg_args(src: Path, dest: Path) -> list[str]:
    maxrate = settings.video_compress_maxrate_mbps
    return [
        "ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", str(src),
        "-map", "0:v:0", "-map", "0:a?",
        "-c:v", "libx264", "-preset", settings.video_compress_preset,
        "-crf", str(settings.video_compress_crf),
        "-maxrate", f"{maxrate}M", "-bufsize", f"{maxrate * 2}M",
        # 4:2:0 y keyframe cada ~2 s: lo que piden YouTube y Meta para procesar rápido.
        "-pix_fmt", "yuv420p", "-g", "60", "-bf", "2",
        "-c:a", "aac", "-b:a", "192k",
        # moov al principio: la plataforma (y la web) empiezan a leer sin bajar todo el archivo.
        "-movflags", "+faststart",
        str(dest),
    ]


async def compress_for_publishing(video: Path, *, keep_master: bool | None = None) -> bool:
    """Comprime `video` en su lugar. True si lo reemplazó; False si lo dejó como estaba.

    keep_master: None = según VIDEO_COMPRESS_KEEP_MASTER; False cuando el original ya vive en
    otro lado (p. ej. la copia de un explainer, cuyo render/ queda intacto)."""
    if keep_master is None:
        keep_master = settings.video_compress_keep_master
    if not settings.video_compress_enabled or not video.is_file():
        return False
    if master_path(video).exists():
        return False  # ya se comprimió (p. ej. un reintento del empaquetado)
    probe = await _probe(video)
    if probe is None:
        logger.warning("video_compress_skipped", file=str(video), reason="ffprobe")
        return False
    duration, bitrate = probe
    if bitrate <= settings.video_compress_maxrate_mbps * 1_000_000 * _ALREADY_LIGHT:
        logger.info("video_compress_skipped", file=video.name, reason="already_light", mbps=round(bitrate / 1e6, 1))
        return False

    tmp = video.with_name(f".{video.stem}.compressing.mp4")
    t_start = time.monotonic()
    proc = await asyncio.create_subprocess_exec(
        *ffmpeg_args(video, tmp), stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, err = await asyncio.wait_for(
            proc.communicate(), timeout=max(_TIMEOUT_MIN, duration * _TIMEOUT_PER_SECOND)
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        tmp.unlink(missing_ok=True)
        logger.warning("video_compress_failed", file=video.name, reason="timeout")
        return False
    if proc.returncode != 0 or not tmp.is_file():
        tmp.unlink(missing_ok=True)
        logger.warning("video_compress_failed", file=video.name, error=err.decode(errors="replace")[-500:])
        return False

    before, after = video.stat().st_size, tmp.stat().st_size
    if after >= before:
        tmp.unlink()
        logger.info("video_compress_skipped", file=video.name, reason="not_smaller")
        return False

    if keep_master:
        master = master_path(video)
        master.parent.mkdir(exist_ok=True)
        video.replace(master)
    tmp.replace(video)
    logger.info(
        "video_compress_done",
        file=video.name,
        mb_before=round(before / 1_048_576, 1),
        mb_after=round(after / 1_048_576, 1),
        seconds=round(time.monotonic() - t_start, 1),
    )
    return True
