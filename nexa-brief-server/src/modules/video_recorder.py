"""Module 6 — Video Recorder: captura el visualizador HTML y mezcla audio."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

import orjson
import structlog

from src.adapters.recorder.factory import get_recorder
from src.core.job import Job, JobStage

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig

logger = structlog.get_logger(__name__)


async def run(job: Job, niche_cfg: "NicheConfig") -> Job:
    t_start = time.monotonic()
    artifacts = job.artifacts
    logger.info(
        "video_recorder_start",
        job_id=job.job_id,
        duration=artifacts.analyzed_input.duration_seconds,
        html=str(artifacts.html_path),
        has_reels=niche_cfg.has_reels_format(),
    )

    recorder = get_recorder(niche_cfg)
    result = await recorder.record(
        html_path=artifacts.html_path,
        audio_path=artifacts.music_path,
        output_dir=artifacts.output_dir,
        duration_seconds=artifacts.analyzed_input.duration_seconds,
        niche_cfg=niche_cfg,
    )

    logs_dir = artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "07_grabacion_stats.json").write_bytes(
        orjson.dumps(result.stats, option=orjson.OPT_INDENT_2)
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "video_recorder_done",
        job_id=job.job_id,
        youtube=str(result.youtube_path),
        tiktok=str(result.tiktok_path),
        reels=str(result.reels_path) if result.reels_path else None,
        elapsed=elapsed,
    )

    new_artifacts = artifacts.model_copy(
        update={
            "youtube_video_path": result.youtube_path,
            "tiktok_video_path": result.tiktok_path,
            "reels_video_path": result.reels_path,
            "recording_stats": result.stats,
        }
    )
    return job.model_copy(update={"artifacts": new_artifacts}).advance(JobStage.VIDEO_RECORDED)
