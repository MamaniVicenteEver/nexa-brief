"""Copia apta para Reels de un MP4 antes de subirlo a Instagram.

Meta rechaza el contenedor (error 2207077) si el archivo pasa los 300 MB, si el
audio supera 128 kbps o si el video dura más de 15 minutos. YouTube y Facebook
aceptan mucho más, así que el render original se deja tal cual y para Instagram
se genera (una sola vez) `<nombre>-ig.mp4` al lado, dentro de OUTPUT_DIR, para
que la URL firmada lo acepte.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path

import structlog

from src.config.exceptions import PlatformAPIError

logger = structlog.get_logger(__name__)

_PLATFORM = "instagram"
MAX_BYTES = 290 * 1024 * 1024        # margen bajo el límite de 300 MB
TARGET_BYTES = 280 * 1024 * 1024     # tamaño al que apunta la copia
MAX_DURATION_SECONDS = 900           # Reels: hasta 15 min
# El AAC pedido a 128k suele reportar ~128–130 kbps; más que eso se recodifica.
MAX_AUDIO_BPS = 130_000
AUDIO_BPS = 128_000
MAX_VIDEO_BPS = 6_000_000
MIN_VIDEO_BPS = 800_000

# Una copia por archivo aunque se publique a la vez en varias cuentas.
_locks: dict[Path, asyncio.Lock] = {}


@dataclass(frozen=True)
class MediaInfo:
    size_bytes: int
    duration_seconds: float
    audio_bps: int | None
    pix_fmt: str | None


async def _run(*cmd: str) -> tuple[int, bytes, bytes]:
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode or 0, stdout, stderr


async def probe(path: Path) -> MediaInfo:
    code, out, err = await _run(
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration:stream=codec_type,bit_rate,pix_fmt",
        "-of", "json", str(path),
    )
    if code != 0:
        raise PlatformAPIError(
            f"Could not read the video for Instagram ({path.name}): {err.decode(errors='ignore')[:200]}",
            platform=_PLATFORM,
            status_code=400,
        )
    data = json.loads(out or b"{}")
    streams = data.get("streams") or []
    audio = next((s for s in streams if s.get("codec_type") == "audio"), {})
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio_rate = str(audio.get("bit_rate") or "")
    return MediaInfo(
        size_bytes=path.stat().st_size,
        duration_seconds=float((data.get("format") or {}).get("duration") or 0),
        audio_bps=int(audio_rate) if audio_rate.isdigit() else None,
        pix_fmt=video.get("pix_fmt"),
    )


def needs_transcode(info: MediaInfo) -> bool:
    # Solo el tamaño: es lo que Meta rechazó (2207077 con 381 MB). Videos en yuvj420p con audio a
    # ~170 kbps se publicaron bien (Apolo 11, 2026-10-13), así que no se re-codifica cada video por eso;
    # la copia, cuando se hace, sale igual en yuv420p y con audio a 128 kbps.
    return info.size_bytes > MAX_BYTES


def video_bitrate_for(duration_seconds: float) -> int:
    """Bitrate de video para que la copia quede en ~280 MB (3 % de margen para el contenedor)."""
    budget = TARGET_BYTES * 8 / max(duration_seconds, 1.0) - AUDIO_BPS
    return int(max(MIN_VIDEO_BPS, min(MAX_VIDEO_BPS, budget * 0.97)))


def reels_copy_path(path: Path) -> Path:
    return path.with_name(f"{path.stem}-ig.mp4")


async def _transcode(source: Path, target: Path, duration_seconds: float) -> None:
    rate = video_bitrate_for(duration_seconds)
    partial = target.with_name(f"{target.stem}.part.mp4")
    code, _, err = await _run(
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", "scale=out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high",
        "-b:v", str(rate), "-maxrate", str(rate), "-bufsize", str(rate * 2),
        "-color_range", "tv",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(partial),
    )
    if code != 0:
        partial.unlink(missing_ok=True)
        raise PlatformAPIError(
            f"Could not prepare a Reels-compatible copy of {source.name}: {err.decode(errors='ignore')[-300:]}",
            platform=_PLATFORM,
            status_code=500,
        )
    partial.replace(target)


async def reels_safe_video(path: Path, *, output: Path | None = None) -> Path:
    """Devuelve `path` si Instagram lo acepta tal cual; si no, una copia apta (reutilizada si ya existe)."""
    info = await probe(path)
    if info.duration_seconds > MAX_DURATION_SECONDS:
        raise PlatformAPIError(
            f"Instagram Reels accept up to 15 minutes; this video lasts {info.duration_seconds / 60:.1f} min.",
            platform=_PLATFORM,
            status_code=400,
        )
    if not needs_transcode(info):
        return path

    target = output or reels_copy_path(path)
    lock = _locks.setdefault(target.resolve(), asyncio.Lock())
    async with lock:
        if target.is_file() and target.stat().st_mtime >= path.stat().st_mtime:
            return target
        logger.info(
            "instagram_reels_copy_start",
            video_file=path.name,
            size_mb=round(info.size_bytes / 1_048_576, 1),
            audio_kbps=round((info.audio_bps or 0) / 1000),
            pix_fmt=info.pix_fmt,
        )
        await _transcode(path, target, info.duration_seconds)
    logger.info(
        "instagram_reels_copy_done",
        video_file=target.name,
        size_mb=round(target.stat().st_size / 1_048_576, 1),
    )
    return target
