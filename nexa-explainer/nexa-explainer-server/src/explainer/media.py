"""Media ingestion and deterministic first-frame analysis."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image

from src.config.settings import settings
from src.explainer.models import FrameAnalysis
from src.explainer.prompts import FRAME_ANALYSIS_PROMPT


VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}


async def _run_command(*args: str) -> tuple[int, str, str]:
    # Some ffprobe builds keep their child pipe open when a container has no
    # audio stream if launched from a Python worker thread. Keep this helper
    # synchronous and short-lived; the long Playwright render is still isolated
    # in the recorder adapter.
    result = subprocess.run(list(args), capture_output=True, check=False)
    return result.returncode, result.stdout.decode(errors="replace"), result.stderr.decode(errors="replace")


async def probe_video(path: Path) -> dict[str, Any]:
    if not shutil.which("ffprobe"):
        raise RuntimeError("ffprobe no está instalado; es necesario para validar el video.")
    code, stdout, stderr = await _run_command(
        "ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)
    )
    if code != 0:
        raise ValueError(f"El video no pudo ser leído por ffprobe: {stderr[-500:]}")
    payload = json.loads(stdout)
    video = next((s for s in payload.get("streams", []) if s.get("codec_type") == "video"), None)
    if not video:
        raise ValueError("El archivo no contiene una pista de video válida.")
    duration = float(video.get("duration") or payload.get("format", {}).get("duration") or 0)
    if duration <= 0:
        raise ValueError("No se pudo determinar la duración del video.")
    return {
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "duration_seconds": duration,
        "video_codec": video.get("codec_name"),
        "has_audio": any(s.get("codec_type") == "audio" for s in payload.get("streams", [])),
    }


async def extract_assets(source: Path, project_dir: Path) -> tuple[Path, Path, dict[str, Any]]:
    """Copy the source and derive first frame plus normalized mono audio."""
    project_dir.mkdir(parents=True, exist_ok=True)
    info = await probe_video(source)
    ratio = info["width"] / info["height"] if info["height"] else 0
    if ratio < 1.25:
        raise ValueError("El video debe ser horizontal. Se espera una composición 16:9 con la persona a la izquierda.")

    extension = source.suffix.lower() if source.suffix.lower() in VIDEO_EXTENSIONS else ".mp4"
    video_path = project_dir / f"presenter{extension}"
    if source.resolve() != video_path.resolve():
        shutil.copy2(source, video_path)
    frame_path = project_dir / "first-frame.jpg"
    code, _, stderr = await _run_command(
        "ffmpeg", "-y", "-v", "error", "-i", str(video_path), "-frames:v", "1", "-q:v", "2", str(frame_path)
    )
    if code != 0 or not frame_path.exists():
        raise ValueError(f"No se pudo extraer el primer frame: {stderr[-500:]}")

    audio_path = project_dir / "audio.wav"
    code, _, stderr = await _run_command(
        "ffmpeg", "-y", "-v", "error", "-i", str(video_path), "-vn", "-ac", "1", "-ar", "16000", str(audio_path)
    )
    if code != 0 or not audio_path.exists():
        code, _, silent_error = await _run_command(
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
            "-t", str(info["duration_seconds"]), str(audio_path)
        )
        if code != 0:
            raise ValueError(f"No se pudo extraer ni crear el audio: {stderr[-300:]} {silent_error[-300:]}")
        info["has_audio"] = False
    info["aspect_ratio"] = ratio
    info["source_extension"] = extension
    return frame_path, audio_path, info


async def analyze_first_frame(frame_path: Path, *, allow_ai: bool = True) -> FrameAnalysis:
    with Image.open(frame_path) as image:
        width, height = image.size
    deterministic = FrameAnalysis(
        width=width,
        height=height,
        aspect_ratio=round(width / height, 4) if height else 0,
    )
    if not allow_ai or not settings.gemini_api_key:
        return deterministic
    try:
        from src.adapters.ai.factory import get_analysis_ai

        response = await get_analysis_ai().analyze_image_full(
            frame_path, FRAME_ANALYSIS_PROMPT, max_output_tokens=1200
        )
        presenter = response.get("presenter_region") or deterministic.presenter_region
        graphics = response.get("graphics_region") or deterministic.graphics_region
        return deterministic.model_copy(update={
            "presenter_region": presenter,
            "graphics_region": graphics,
            "presenter_position": response.get("presenter_position", "left"),
            "framing_notes": response.get("framing_notes", deterministic.framing_notes),
            "confidence": float(response.get("confidence", deterministic.confidence)),
            "provider": "gemini-vision",
        })
    except Exception:
        return deterministic.model_copy(update={"provider": "deterministic-fallback"})
