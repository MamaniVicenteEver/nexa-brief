"""Portadas por formato, compartidas por publicación manual, inmediata y programada.

Reutiliza la intro capturada del Explainer. Para grabaciones anteriores, obtiene
un cuadro estable de la intro del MP4 del formato solicitado, sin alterar el video.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from PIL import Image, ImageStat

from src.modules.thumbnail_maker import capture_at, make_thumbnail

_locks: dict[Path, asyncio.Lock] = {}


class VideoCoverError(ValueError):
    pass


async def video_geometry(video: Path) -> tuple[str, float]:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration", "-of", "json", str(video),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    try:
        info = json.loads(stdout)
        stream = info["streams"][0]
        width, height = int(stream["width"]), int(stream["height"])
        if proc.returncode or min(width, height) <= 0:
            raise ValueError("invalid dimensions")
        return ("9x16" if height > width else "16x9"), float(info.get("format", {}).get("duration") or 0)
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise VideoCoverError("No se pudo leer el formato del video para preparar su miniatura.") from exc


def usable_cover(path: Path, orientation: str) -> bool:
    try:
        if path.stat().st_size > 8 * 1024 * 1024:
            return False
        with Image.open(path) as image:
            expected = 9 / 16 if orientation == "9x16" else 16 / 9
            if abs(image.width / image.height - expected) > 0.05:
                return False
            sample = image.convert("L").resize((96, 96))
            return image.format == "JPEG" and ImageStat.Stat(sample).stddev[0] >= 6
    except (OSError, ValueError, ZeroDivisionError):
        return False


def _intro_time(folder: Path) -> float:
    try:
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        return capture_at(manifest.get("template_id"))
    except (OSError, ValueError, TypeError):
        return 1.0


async def ensure_video_cover(video: Path, requested: Path | None = None) -> Path:
    video = video.resolve()
    async with _locks.setdefault(video, asyncio.Lock()):
        orientation, duration = await video_geometry(video)
        target = video.parent / f"thumbnail-{orientation}.jpg"
        candidates = [requested, target]
        if orientation == "16x9":
            candidates.append(video.parent / "thumbnail.jpg")
        for candidate in candidates:
            if candidate and usable_cover(Path(candidate), orientation):
                return Path(candidate)
        # El primer cuadro puede ser negro; se busca la intro ya visible.
        for at in dict.fromkeys((_intro_time(video.parent), 4.5, 2.0)):
            if duration:
                at = min(at, max(0, duration - 0.15))
            generated = await make_thumbnail(
                video, video.parent, at, orientation=orientation, filename=target.name,
            )
            if generated and usable_cover(generated, orientation):
                return generated
        raise VideoCoverError(
            "No se pudo obtener una miniatura legible de la intro. Revisa o vuelve a grabar el video antes de publicar."
        )
