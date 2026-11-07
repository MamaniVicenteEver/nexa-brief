"""Module 6 — Video Recorder: captura el visualizador HTML y mezcla audio."""

from __future__ import annotations

import time
import os
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

    recorder = get_recorder(niche_cfg, engine_override=job.input.recorder_engine_override)
    record_dir = artifacts.render_dir or artifacts.output_dir
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    layout = layout_for_settings(settings)
    if layout.schema_version >= 3:
        from src.adapters.data.runtime_paths import assert_profile_path
        record_dir = layout.runtime_dir / "recordings" / job.job_id / "pipeline"
        assert_profile_path(record_dir)
    record_dir.mkdir(parents=True, exist_ok=True)
    result = await recorder.record(
        html_path=artifacts.html_path,
        audio_path=artifacts.music_path,
        output_dir=record_dir,
        duration_seconds=artifacts.analyzed_input.duration_seconds,
        niche_cfg=niche_cfg,
        render_target=job.input.render_target,
    )

    if layout.schema_version >= 3:
        from src.config.media_paths import pipeline_video_key
        category = artifacts.output_dir.relative_to(layout.productions_dir).parts[0]
        planned = {}
        for fmt in niche_cfg.video.formats:
            source = record_dir / fmt.output_filename
            if not source.is_file() or source.is_symlink():
                raise ValueError(f"Falta el render {fmt.id}")
            destination = layout.renders_dir / pipeline_video_key(category, job.job_id, fmt.id, fmt.aspect_ratio)
            if source in planned and planned[source] != destination or destination in planned.values():
                raise ValueError("Los formatos de render entran en conflicto")
            planned[source] = destination
        if result.tiktok_path is not None and result.tiktok_path not in planned:
            source = result.tiktok_path
            if source.parent != record_dir or source.is_symlink() or not source.is_file():
                raise ValueError("El clip TikTok está fuera del directorio temporal")
            aspect = "9:16" if result.reels_path is not None else "16:9"
            planned[source] = layout.renders_dir / pipeline_video_key(category, job.job_id, "tiktok", aspect)
        for path in (result.youtube_path, result.reels_path, result.tiktok_path):
            if path is not None and path not in planned:
                raise ValueError("El grabador devolvió un formato no declarado")
        if len(set(planned.values())) != len(planned):
            raise ValueError("Los destinos de render entran en conflicto")
        for destination in planned.values():
            assert_profile_path(destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            assert_profile_path(destination)
            if destination.exists():
                raise FileExistsError("El render ya existe; no se reemplaza un máster")
        moved = {}
        for source, destination in planned.items():
            os.replace(source, destination)
            moved[source] = destination
        def moved_path(path):
            if path is None:
                return None
            if path not in moved:
                raise ValueError("El grabador devolvió un formato no declarado")
            return moved[path]
        result = result.__class__(youtube_path=moved_path(result.youtube_path),
                                  reels_path=moved_path(result.reels_path),
                                  tiktok_path=moved_path(result.tiktok_path), stats=result.stats)

    logs_dir = (artifacts.log_dir or artifacts.output_dir / "logs")
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "07_grabacion_stats.json").write_bytes(
        orjson.dumps(result.stats, option=orjson.OPT_INDENT_2)
    )

    recording_log_id = None
    if artifacts.render_dir is not None:
        from src.config.profile_layout import layout_for_settings
        from src.config.settings import settings
        from src.core.data import collection
        from src.core.execution_logs import register_execution_log
        key = (artifacts.log_dir / "07_grabacion_stats.json").relative_to(layout_for_settings(settings).root).as_posix()
        existing = collection("execution_logs").first({"video_id": job.job_id, "key": key})
        recording_log_id = existing["log_id"] if existing else (await register_execution_log(
            key, kind="recording", production_id=job.job_id, video_id=job.job_id)).log_id

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
            "recording_log_id": recording_log_id,
        }
    )
    return job.model_copy(update={"artifacts": new_artifacts}).advance(JobStage.VIDEO_RECORDED)
