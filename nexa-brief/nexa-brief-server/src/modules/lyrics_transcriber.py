"""Module — Lyrics Transcriber (solo niches con template.requires_lyrics=True).

Reemplaza al Vision Extractor en el lugar del pipeline donde estos niches no
tienen ninguna imagen que analizar (ver niche_cfg.template.requires_vision_extraction
=False) — en su lugar, transcribe la canción real (ya resuelta por
resource_fetcher, que corre antes) a un JSON con timestamps por palabra que el
motor de la plantilla usa para sincronizar las letras con el audio real.

Cachea por music_asset_id (mismo patrón que el cache de visión en
visual_designer.py) — transcribir es caro (varios minutos en CPU, ver
settings.whisper_*), así que reusar la misma canción entre jobs no debe pagar
ese costo más de una vez.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import structlog

from src.adapters.lyrics.factory import get_lyrics_transcriber
from src.config.niche_config import NicheConfig
from src.core.job import Job, JobStage
from src.core.library import transcription

logger = structlog.get_logger(__name__)


async def run(job: Job, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    artifacts = job.artifacts
    music_path = artifacts.music_path
    music_asset_id = artifacts.music_asset_id
    if music_path is None or music_asset_id is None:
        raise RuntimeError(
            "lyrics_transcriber: job.artifacts.music_path/music_asset_id son None. "
            "resource_fetcher debe ejecutarse ANTES que lyrics_transcriber — "
            "revisar el orden de stages en pipeline.py."
        )

    logger.info(
        "lyrics_transcriber_start",
        job_id=job.job_id,
        music=str(music_path),
        asset_id=music_asset_id,
        template=niche_cfg.template.template_id,
    )

    language = job.input.song_info.language if job.input.song_info else None

    # Caché por asset + lock + semáforo viven en core/library/transcription.py,
    # compartidos con la transcripción en segundo plano de la librería: si la
    # canción se subió recién y Whisper ya la está procesando, esperamos ese
    # resultado en vez de transcribirla dos veces.
    lyrics_json, cache_hit = await transcription.ensure_lyrics(
        music_asset_id, music_path, get_lyrics_transcriber, language=language
    )

    logger.info("lyrics_transcriber_done_analyzing", job_id=job.job_id, cache_hit=cache_hit)

    output_dir: Path = artifacts.output_dir
    logs_dir = output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    lyrics_path = output_dir / "lyrics.json"
    lyrics_text = json.dumps(lyrics_json, indent=2, ensure_ascii=False)
    lyrics_path.write_text(lyrics_text, encoding="utf-8")
    (logs_dir / "02_lyrics_transcripcion.json").write_text(lyrics_text, encoding="utf-8")

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info("lyrics_transcriber_end", job_id=job.job_id, elapsed=elapsed, cache_hit=cache_hit)

    new_artifacts = artifacts.model_copy(update={"lyrics_json": lyrics_json})
    return job.model_copy(update={"artifacts": new_artifacts}).advance(JobStage.DESIGN_COMPLETE)
