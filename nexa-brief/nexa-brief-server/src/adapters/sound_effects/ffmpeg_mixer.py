"""Mezcla offline: solo el bus de efectos se normaliza, atenúa o comprime."""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import tempfile
from pathlib import Path

import numpy as np

from src.core.ports.sound_effects_port import AudioFacts, ResolvedSoundCue, SoundDesignError


async def _command(*args: str, timeout: float = 180) -> bytes:
    process = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        process.kill()
        await process.wait()
        raise
    if process.returncode:
        raise SoundDesignError("No se pudo procesar el audio: " + stderr.decode(errors="replace")[-600:])
    return stdout


class FFmpegSoundMixer:
    async def inspect(self, path: Path) -> AudioFacts:
        if not path.is_file():
            raise SoundDesignError("No se encontró el archivo de audio.")
        metadata = json.loads(
            await _command(
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=sample_rate,channels:format=duration",
                "-of",
                "json",
                str(path),
            )
        )
        streams = metadata.get("streams") or []
        if not streams:
            raise SoundDesignError("El archivo no contiene una pista de audio.")
        if float(metadata.get("format", {}).get("duration", 0)) > 3600:
            raise SoundDesignError("La pista supera el límite de una hora.")
        # Duración decodificada: evita sumar el padding de MP3 a la voz.
        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-vn",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-f",
            "f32le",
            "-",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        errors = asyncio.create_task(process.stderr.read())
        count, peak = 0, 0.0

        async def measure():
            nonlocal count, peak
            remaining = b""
            while True:
                block = await process.stdout.read(65536)
                if not block:
                    break
                block = remaining + block
                boundary = len(block) // 4 * 4
                samples = np.frombuffer(block[:boundary], dtype="<f4")
                remaining = block[boundary:]
                if not np.isfinite(samples).all():
                    raise SoundDesignError("El sonido contiene muestras inválidas.")
                count += len(samples)
                if len(samples):
                    peak = max(peak, float(np.abs(samples).max()))
            await process.wait()

        try:
            await asyncio.wait_for(measure(), 120)
        except BaseException:
            if process.returncode is None:
                process.kill()
            await process.wait()
            await errors
            raise
        stderr = await errors
        if process.returncode or not count:
            raise SoundDesignError("El sonido no se pudo decodificar: " + stderr.decode(errors="replace")[-300:])
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        return AudioFacts(
            count / 96000,
            digest.hexdigest(),
            int(streams[0]["sample_rate"]),
            int(streams[0]["channels"]),
            20 * math.log10(peak) if peak else -120,
        )

    async def mix(self, narration: Path, cues: list[ResolvedSoundCue], destination: Path, *, ducking: bool) -> None:
        if destination.suffix.lower() not in {".wav", ".mp3"}:
            raise SoundDesignError("La mezcla debe guardarse como WAV o MP3.")
        outputs = {destination.resolve(), destination.with_name(destination.stem + "-effects.wav").resolve()}
        if any(path.resolve() in outputs for path in [narration, *(cue.path for cue in cues)]):
            raise SoundDesignError("Los destinos no pueden sobrescribir la voz ni los efectos originales.")
        voice = await self.inspect(narration)
        headroom = 0.985 - 10 ** (voice.peak_dbfs / 20)
        if cues and headroom <= 0:
            raise SoundDesignError("La voz no tiene margen para sumar efectos sin saturar; revisá su nivel de origen.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        filters = []
        args = ["ffmpeg", "-y", "-v", "error", "-i", str(narration)]
        if cues:
            filters.append(
                "[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,asplit=2[voice][detector]"
                if ducking
                else "[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[voice]"
            )
            for index, cue in enumerate(cues, 1):
                args += ["-i", str(cue.path)]
                filters.append(
                    f"[{index}:a]atrim=start={cue.source_in:.6f}:duration={cue.duration:.6f},asetpts=PTS-STARTPTS,"
                    f"aresample=48000,aformat=channel_layouts=stereo,asettb=1/48000,asetpts=N/SR/TB,volume={cue.gain_db:.3f}dB,"
                    f"afade=t=in:d={cue.fade_in:.6f},afade=t=out:st={cue.duration - cue.fade_out:.6f}:d={cue.fade_out:.6f},"
                    f"adelay={round(cue.start * 48000)}S|{round(cue.start * 48000)}S[fx{index}]"
                )
            labels = "".join(f"[fx{i}]" for i in range(1, len(cues) + 1))
            filters.append(
                labels
                + f"amix=inputs={len(cues)}:duration=longest:normalize=0,asettb=1/48000,asetpts=N/SR/TB,apad=whole_len={round(voice.duration_seconds * 48000)},atrim=end_sample={round(voice.duration_seconds * 48000)}[effects]"
            )
            if ducking:
                filters.append(
                    "[effects][detector]sidechaincompress=threshold=0.04:ratio=3:attack=15:release=250:makeup=1[ducked]"
                )
            # Limitador SOLO de efectos. La rama de voz nunca se comprime ni se pausa.
            limit = min(1, max(0.0625, headroom))
            scale = min(1, headroom / limit)
            filters.append(
                f"[{'ducked' if ducking else 'effects'}]alimiter=limit={limit:.9f}:level=false:latency=true,volume={scale:.9f},asplit=2[safe][stem]"
            )
            filters.append(
                f"[voice][safe]amix=inputs=2:duration=first:normalize=0,atrim=duration={voice.duration_seconds:.9f}[out]"
            )
            args += ["-filter_complex", ";".join(filters), "-map", "[out]"]
        else:
            filters.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={voice.duration_seconds:.9f}[stem]")
            args += ["-filter_complex", ";".join(filters), "-map", "0:a:0"]
        args += ["-vn", "-ar", "48000", "-t", str(voice.duration_seconds)]
        args += (
            ["-c:a", "pcm_s24le"] if destination.suffix.lower() == ".wav" else ["-c:a", "libmp3lame", "-b:a", "192k"]
        )
        fd, temporary = tempfile.mkstemp(prefix=".sound-mix-", suffix=destination.suffix, dir=destination.parent)
        os.close(fd)
        effects = destination.with_name(destination.stem + "-effects.wav")
        fd, temporary_effects = tempfile.mkstemp(prefix=".sound-effects-", suffix=".wav", dir=destination.parent)
        os.close(fd)
        try:
            await _command(
                *args,
                temporary,
                "-map",
                "[stem]",
                "-ar",
                "48000",
                "-t",
                str(voice.duration_seconds),
                "-c:a",
                "pcm_s24le",
                temporary_effects,
                timeout=300,
            )
            os.replace(temporary, destination)
            os.replace(temporary_effects, effects)
        finally:
            Path(temporary).unlink(missing_ok=True)
            Path(temporary_effects).unlink(missing_ok=True)
