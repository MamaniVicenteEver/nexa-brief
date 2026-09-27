"""Audio production for the source-led editorial recut.

The module deliberately keeps voice providers behind one small contract.  The
prototype works offline with eSpeak-NG so the complete video pipeline can be
verified on a clean machine; Novita/MiniMax is used when ``NOVITA_IA`` is
configured.  It never attempts to imitate the source speaker's voice.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import httpx

from src.config.settings import settings
from src.explainer.models import EditorialPlan


class EditorialAudioError(RuntimeError):
    pass


def _run(*args: str) -> None:
    result = subprocess.run(list(args), capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise EditorialAudioError(
            f"Comando de audio falló: {' '.join(args[:3])} — {result.stderr[-500:]}"
        )


def _duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise EditorialAudioError(f"No se pudo medir el audio: {result.stderr[-300:]}")
    return float(result.stdout.strip() or 0)


def _atempo_chain(factor: float) -> str:
    """Build an ffmpeg atempo chain for factors outside the 0.5..2 range."""
    factor = max(0.25, min(4.0, factor))
    parts: list[str] = []
    while factor < 0.5:
        parts.append("atempo=0.5")
        factor /= 0.5
    while factor > 2.0:
        parts.append("atempo=2.0")
        factor /= 2.0
    parts.append(f"atempo={factor:.8f}")
    return ",".join(parts)


def _local_voice(text: str, destination: Path, emotion: str) -> None:
    if not shutil.which("espeak-ng"):
        raise EditorialAudioError("No se encontró espeak-ng y NOVITA_IA tampoco está configurado.")
    speed = {"urgent": "158", "warm": "142", "resolute": "132", "serious": "138"}.get(emotion, "138")
    pitch = {"urgent": "48", "warm": "54", "resolute": "42", "serious": "45"}.get(emotion, "45")
    destination.parent.mkdir(parents=True, exist_ok=True)
    _run(
        "espeak-ng",
        "-v", "es-419",
        "-s", speed,
        "-p", pitch,
        "-a", "100",
        "-w", str(destination),
        text,
    )


async def _novita_voice(text: str, destination: Path, *, voice: str | None, emotion: str) -> None:
    if not settings.novita_api_key:
        raise EditorialAudioError("NOVITA_IA no está configurado.")
    endpoint = "https://api.novita.ai/v3/minimax-speech-2.8-turbo"
    body = {
        "text": text,
        "voice_setting": {
            "voice_id": voice or settings.novita_tts_voice,
            "vol": 1.0,
            "pitch": 0,
            "speed": 0.95,
            "emotion": emotion if emotion in {"happy", "sad", "angry", "fearful", "disgusted", "surprised", "calm"} else "calm",
        },
        "audio_setting": {"format": "mp3", "bitrate": 128000, "sample_rate": 32000, "channel": 1},
        "language_boost": "Spanish",
        "stream": False,
        "output_format": "hex",
    }
    headers = {"Authorization": f"Bearer {settings.novita_api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(headers=headers, timeout=180) as client:
        response = await client.post(endpoint, json=body)
        response.raise_for_status()
        payload = response.json()
    if payload.get("base_resp", {}).get("status_code", 0) != 0:
        raise EditorialAudioError(f"Novita rechazó el audio: {payload.get('base_resp')}")
    audio = bytes.fromhex(payload["data"]["audio"])
    destination.write_bytes(audio)


async def _make_line(text: str, destination: Path, provider: str, voice: str | None, emotion: str) -> str:
    if provider == "novita" and settings.novita_api_key:
        await _novita_voice(text, destination.with_suffix(".mp3"), voice=voice, emotion=emotion)
        return "novita/minimax-turbo"
    await asyncio.to_thread(_local_voice, text, destination.with_suffix(".wav"), emotion)
    return "local/espeak-ng"


def _fit_line(source: Path, destination: Path, target_seconds: float) -> None:
    actual = max(0.05, _duration(source))
    factor = actual / max(0.05, target_seconds)
    filters = _atempo_chain(factor)
    _run(
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-af", f"{filters},apad=pad_dur=0.2",
        "-ar", "44100", "-ac", "2", "-t", f"{target_seconds:.3f}",
        str(destination),
    )


def _silence(path: Path, seconds: float) -> None:
    _run(
        "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo", "-t", f"{max(0.01, seconds):.3f}",
        "-ar", "44100", "-ac", "2", str(path),
    )


def _concat_wav(files: list[Path], destination: Path) -> None:
    list_path = destination.with_suffix(".concat.txt")
    list_path.write_text("\n".join(f"file '{path.as_posix()}'" for path in files), encoding="utf-8")
    try:
        _run(
            "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
            "-i", str(list_path), "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2",
            str(destination),
        )
    finally:
        list_path.unlink(missing_ok=True)


async def synthesize_editorial_audio(
    plan: EditorialPlan,
    output_dir: Path,
    *,
    provider: str = "local",
    voice: str | None = None,
) -> tuple[Path, dict[str, Any]]:
    """Synthesize one timed line per editorial segment and concatenate them."""
    audio_dir = output_dir / "editorial_audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    silence_before = audio_dir / "00-intro-silence.wav"
    silence_after = audio_dir / "99-outro-silence.wav"
    _silence(silence_before, plan.segments[0].timeline_start if plan.segments else 3.0)
    _silence(silence_after, max(0.1, plan.duration_seconds - (plan.segments[-1].timeline_end if plan.segments else plan.duration_seconds)))

    lines: list[Path] = [silence_before]
    used_provider = "local/espeak-ng"
    line_meta: list[dict[str, Any]] = []
    for index, segment in enumerate(plan.segments):
        raw = audio_dir / f"{index:02d}-raw"
        line_provider = await _make_line(segment.narration, raw, provider, voice, segment.emotion)
        used_provider = line_provider
        fitted = audio_dir / f"{index:02d}-fitted.wav"
        target = max(0.2, segment.timeline_end - segment.timeline_start)
        _fit_line(raw.with_suffix(".mp3" if line_provider.startswith("novita") else ".wav"), fitted, target)
        lines.append(fitted)
        line_meta.append({
            "id": segment.id,
            "target_seconds": round(target, 3),
            "raw_seconds": round(_duration(raw.with_suffix(".mp3" if line_provider.startswith("novita") else ".wav")), 3),
            "emotion": segment.emotion,
        })
    lines.append(silence_after)
    destination = output_dir / "editorial-narration.wav"
    _concat_wav(lines, destination)
    meta = {
        "provider": used_provider,
        "voice": voice or (settings.novita_tts_voice if used_provider.startswith("novita") else "es-419-default"),
        "language": "es",
        "duration_seconds": round(_duration(destination), 3),
        "synthetic_voice_disclosure": "Voz sintética genérica; no imita a la persona del video.",
        "lines": line_meta,
    }
    (output_dir / "editorial-audio.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return destination, meta


def prepare_editorial_source(
    source: Path,
    destination: Path,
    *,
    intro_seconds: float,
    outro_seconds: float,
    total_duration: float | None = None,
) -> None:
    """Create a silent source timeline with deterministic black intro/outro."""
    command = [
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-vf", (
            f"tpad=start_mode=add:start_duration={intro_seconds}:"
            f"stop_mode=add:stop_duration={outro_seconds}:color=black,format=yuv420p"
        ),
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30",
        "-movflags", "+faststart",
    ]
    if total_duration is not None:
        command.extend(["-t", f"{total_duration:.3f}"])
    command.append(str(destination))
    _run(*command)


async def prepare_external_audio(source: Path, destination: Path, *, intro_seconds: float, duration_seconds: float) -> dict[str, Any]:
    """Pad/trim a user supplied narration so it follows the director timeline."""
    _run(
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-af", f"adelay={round(intro_seconds * 1000)}:all=1,apad=pad_dur=1",
        "-ar", "44100", "-ac", "2", "-t", f"{duration_seconds:.3f}", str(destination),
    )
    return {
        "provider": "uploaded",
        "language": "es",
        "duration_seconds": round(_duration(destination), 3),
        "synthetic_voice_disclosure": "Audio proporcionado por el usuario.",
    }
