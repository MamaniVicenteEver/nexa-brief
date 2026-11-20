"""Validate shared clip files and their available playback duration."""
from __future__ import annotations

import asyncio
import json
import math
from urllib.parse import urlsplit

from .io import safe


async def probe_media(path):
    process = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json",
        str(path), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
    try:
        stdout, _ = await asyncio.wait_for(process.communicate(), 20)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise
    if process.returncode:
        raise ValueError(f"No se pudo leer el medio: {path.name}")
    info = json.loads(stdout)
    duration = float(info["format"]["duration"])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError(f"Duración inválida: {path.name}")
    return duration, {s["codec_type"] for s in info["streams"]}


async def validate_clips(production, storyboard, audio_duration, layers=None):
    cache = {}
    beats = storyboard["beats"]
    layers = layers or {}
    def layer(beat):
        return beat.get("layer") or layers.get(beat["use"], "main")
    for index, beat in enumerate(beats):
        if beat["use"] != "common.clip":
            continue
        params = beat.get("params", {})
        source = params.get("src", "")
        local = f"/productions/{production.parent.name}/{production.name}/"
        if source.startswith(local):
            source = source[len(local):]
        if urlsplit(source).scheme or source.startswith("/") or not source.startswith("assets/"):
            raise ValueError("Los clips de la edición deben usar medios compartidos del original")
        path = safe(production, source)
        if not path.is_file():
            raise ValueError(f"Falta el clip compartido: {source}")
        if path not in cache:
            duration, streams = await probe_media(path)
            if "video" not in streams:
                raise ValueError(f"El clip no contiene video: {source}")
            cache[path] = duration
        offset = float(params.get("start", 0))
        if not 0 <= offset < cache[path]:
            raise ValueError(f"Inicio del clip fuera del medio: {source}")
        if not params.get("loop"):
            next_start = next((b["t"] for b in beats[index + 1:] if layer(b) == layer(beat)), audio_duration)
            duration = float(beat.get("dur", next_start - beat["t"]))
            if duration * float(params.get("rate", 1)) + offset > cache[path] + .1:
                raise ValueError(f"El clip no cubre su escena: {source}")
