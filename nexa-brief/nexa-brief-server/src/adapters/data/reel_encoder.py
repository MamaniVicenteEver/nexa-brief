"""Codifica cuadros PNG del motor y una pista verificada como Reel."""

from __future__ import annotations

import asyncio
import math
import tempfile
from pathlib import Path
from typing import AsyncIterator

from src.core.image_posts.render import ReelFrame


class ReelEncodingError(ValueError):
    pass


class FfmpegReelEncoder:
    async def encode(
        self, frames: AsyncIterator[ReelFrame], audio: Path, *,
        duration: int, trim_start: float = 0, gain_db: float = 0,
    ) -> bytes:
        if (not isinstance(duration, int) or not 8 <= duration <= 20
                or not math.isfinite(trim_start) or trim_start < 0
                or not math.isfinite(gain_db) or not -60 <= gain_db <= 12):
            raise ReelEncodingError("Duración o recorte de Reel inválidos")
        with tempfile.TemporaryDirectory(prefix="nexa-reel-") as temp_dir:
            output = Path(temp_dir) / "reel.mp4"
            fade_out = duration - 0.4
            command = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "image2pipe", "-framerate", "30", "-vcodec", "png", "-i", "pipe:0",
                "-stream_loop", "-1", "-ss", str(trim_start), "-i", str(audio),
                "-map", "0:v:0", "-map", "1:a:0", "-t", str(duration),
                "-vf", f"fade=t=in:st=0:d=0.4,fade=t=out:st={fade_out}:d=0.4,format=yuv420p",
                "-af", f"volume={gain_db}dB,loudnorm=I=-14:TP=-1:LRA=11,afade=t=in:st=0:d=0.4,afade=t=out:st={fade_out}:d=0.4,alimiter=limit=0.891",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-r", "30",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                "-movflags", "+faststart", str(output),
            ]
            process = await asyncio.create_subprocess_exec(
                *command, stdin=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            count = 0
            try:
                assert process.stdin is not None
                async for frame in frames:
                    if frame.frame_index != count or frame.width != 1080 or frame.height != 1920 or frame.mime != "image/png":
                        raise ReelEncodingError("Secuencia de cuadros inválida")
                    process.stdin.write(frame.content)
                    await process.stdin.drain()
                    count += 1
                process.stdin.close()
                await process.stdin.wait_closed()
                error = await process.stderr.read() if process.stderr else b""
                code = await process.wait()
                if count != duration * 30 or code != 0 or not output.is_file():
                    raise ReelEncodingError(f"ffmpeg no produjo un Reel completo: {error.decode(errors='replace')[-500:]}")
                return output.read_bytes()
            finally:
                if process.returncode is None:
                    process.kill()
                    await process.wait()
