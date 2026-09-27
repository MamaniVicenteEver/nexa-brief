"""Module — Voice Narrator: sintetiza narración TTS antes de video_recorder.

Stage OPCIONAL, corre entre html_generator y video_recorder (ver pipeline.py):
si `job.input.user_context` trae texto Y todavía no hay `audio_path` resuelto
(ningún otro stage lo llenó), sintetiza ese texto como la narración del video
y lo deja en `job.artifacts.audio_path`/`audio_meta` — el mismo hueco
genérico que `video_recorder.py` ya consume (ver ese archivo: hoy lanza
PipelineError si `audio_path` sigue None, este stage es lo que lo resuelve
quando corresponde).

Placeholder hasta que exista el dominio real de `Lesson` (Etapa 3, ver
nexa-academy/README.md) — hoy usa `user_context` como texto a narrar porque
todavía no hay un campo dedicado tipo `lesson.script`. La plantilla de estilo
(`_STYLE_TEMPLATE`) y el proveedor/motor (`get_voice_ai()`) son el punto de
extensión para cuando eso se exponga por API — cambiar cualquiera de los dos
no requiere tocar este archivo más que esa constante.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import time
from typing import TYPE_CHECKING

import structlog

from src.adapters.voice.factory import get_voice_ai
from src.adapters.voice.style_templates import render_style
from src.academy.transcription import transcribe_voiceover, write_timing_payload
from src.config.exceptions import VoiceSynthesisError
from src.core.job import Job, JobStage

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig

logger = structlog.get_logger(__name__)

# Punto de extensión: qué plantilla de estilo usa la narración por default.
# Ver src/adapters/voice/style_templates.py para las opciones y sus variables.
_STYLE_TEMPLATE = "documental_serio"
_STYLE_VARIABLES = {"voice_desc": "cálida y serena"}


async def run(job: Job, niche_cfg: "NicheConfig") -> Job:
    t_start = time.monotonic()

    if job.artifacts.audio_path is not None:
        if job.artifacts.transcript_path is None:
            logger.info("voice_narrator_transcribe_existing_audio", job_id=job.job_id)
            transcript_path, payload = await _transcribe_and_persist(
                job.artifacts.audio_path,
                job.artifacts.output_dir,
                language=getattr(niche_cfg, "default_language", "es"),
            )
            artifacts = _artifacts_with_transcript(job, transcript_path, payload)
            return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.AUDIO_SYNTHESIZED)

        logger.info("voice_narrator_skip_already_resolved", job_id=job.job_id)
        return job.advance(JobStage.AUDIO_SYNTHESIZED)

    text = job.input.user_context
    if not text:
        logger.info("voice_narrator_skip_no_text", job_id=job.job_id)
        return job.advance(JobStage.AUDIO_SYNTHESIZED)

    logger.info("voice_narrator_start", job_id=job.job_id, characters=len(text))

    instruction, emotion = render_style(_STYLE_TEMPLATE, **_STYLE_VARIABLES)
    voice_ai = get_voice_ai()
    output_dir = job.artifacts.output_dir
    result = await voice_ai.synthesize(
        text,
        output_dir / "song",  # el adapter decide la extensión real (.wav/.mp3)
        instruction=instruction,
        emotion=emotion,
    )

    # Convención de nombre fija en el resto del pipeline ("song.mp3" — ver
    # packager._required_files, remotion_adapter/hyperframes_adapter que
    # pasan audio_path.name tal cual al motor de render). Si el proveedor
    # devolvió WAV (Gemini), se necesita mp3 real — no un simple rename, el
    # contenido no es mp3 solo porque se le cambie la extensión.
    final_path = output_dir / "song.mp3"
    if result.format == "mp3":
        if result.path != final_path:
            shutil.move(str(result.path), final_path)
    else:
        await _convert_to_mp3(result.path, final_path)
        result.path.unlink(missing_ok=True)

    logs_dir = output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "05d_narracion_tts.json").write_text(
        json.dumps(
            {
                "provider": result.provider,
                "model": result.model,
                "voice": result.voice,
                "style_template": _STYLE_TEMPLATE,
                "duration_seconds": round(result.duration_seconds, 2),
                "characters": result.characters,
                "cost_usd_estimate": round(result.cost_usd_estimate, 5),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    transcript_path, transcript = await _transcribe_and_persist(
        final_path,
        output_dir,
        language=getattr(niche_cfg, "default_language", "es"),
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "voice_narrator_done",
        job_id=job.job_id,
        provider=result.provider,
        model=result.model,
        voice=result.voice,
        duration_seconds=round(result.duration_seconds, 2),
        cost_usd_estimate=round(result.cost_usd_estimate, 5),
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(
        update={
            "audio_path": final_path,
            "transcript_path": transcript_path,
            "audio_meta": {
                "provider": result.provider,
                "model": result.model,
                "voice": result.voice,
                "transcript_path": str(transcript_path),
                "transcript_segments": len(transcript["segments"]),
                "transcript_duration_seconds": transcript["metadata"].get("audio_duration_sec"),
            },
        }
    )
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.AUDIO_SYNTHESIZED)


async def _transcribe_and_persist(
    audio_path,
    output_dir,
    *,
    language: str,
):
    if output_dir is None:
        raise VoiceSynthesisError("No hay output_dir para guardar la transcripción de la narración")

    transcript = await transcribe_voiceover(audio_path, language=language)
    transcript_path = output_dir / "logs" / "05e_narracion_transcripcion.json"
    write_timing_payload(transcript, transcript_path)
    logger.info(
        "voice_narrator_transcription_done",
        audio=str(audio_path),
        transcript=str(transcript_path),
        segments=len(transcript["segments"]),
        duration_seconds=transcript["metadata"].get("audio_duration_sec"),
    )
    return transcript_path, transcript


def _artifacts_with_transcript(job: Job, transcript_path, transcript):
    audio_meta = {
        **job.artifacts.audio_meta,
        "transcript_path": str(transcript_path),
        "transcript_segments": len(transcript["segments"]),
        "transcript_duration_seconds": transcript["metadata"].get("audio_duration_sec"),
    }
    return job.artifacts.model_copy(
        update={"transcript_path": transcript_path, "audio_meta": audio_meta}
    )


async def _convert_to_mp3(src_wav, dest_mp3) -> None:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-v", "error", "-i", str(src_wav), str(dest_mp3),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise VoiceSynthesisError(f"ffmpeg no pudo convertir {src_wav} a mp3: {stderr.decode(errors='replace')[-300:]}")
