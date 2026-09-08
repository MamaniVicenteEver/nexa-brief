"""Module 7b — Packager: verifica y finaliza el directorio de salida."""

from __future__ import annotations

import time
from pathlib import Path
from typing import TYPE_CHECKING

import orjson
import structlog

from src.config.exceptions import PackagingError
from src.config.settings import BASE_DIR
from src.core.job import Job, JobStage
from src.core.library import asset_library

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig

logger = structlog.get_logger(__name__)

def _required_files(niche_cfg: "NicheConfig") -> list[str]:
    """Archivos requeridos: los base + los definidos en video.formats del nicho."""
    extra = [fmt.output_filename for fmt in niche_cfg.video.formats]
    base = ["index.html", niche_cfg.template.media_src_filename, "song.mp3"]
    if niche_cfg.pipeline_type == "config_driven_template":
        base.append("config.json")
        if niche_cfg.template.requires_lyrics:
            base.append("lyrics.json")
    return base + extra


def _image_manifest_block(asset_id: str | None) -> dict | None:
    """Referencia resoluble al asset real en data/image_library/ — se lee
    fresco de la librería (no de image_meta) porque el `label` real lo escribe
    visual_designer DESPUÉS de resource_fetcher (Vision Extractor corre entre
    medio de ambos stages)."""
    if not asset_id:
        return None
    entry = asset_library.get_image_entry(asset_id)
    return {
        "asset_id": asset_id,
        "path": str((asset_library.resolve_image_path(asset_id)).relative_to(BASE_DIR)),
        "label": entry.label,
        "provider": entry.provider,
        "photographer": entry.photographer,
    }


def _music_manifest_block(asset_id: str | None) -> dict | None:
    if not asset_id:
        return None
    entry = asset_library.get_music_entry(asset_id)
    return {
        "asset_id": asset_id,
        "path": str((asset_library.resolve_music_path(asset_id)).relative_to(BASE_DIR)),
        "track_name": entry.track_name,
        "artist": entry.artist,
        "genre": entry.genre,
        "provider": entry.provider,
    }


def _video_manifest_block(asset_id: str | None) -> dict | None:
    if not asset_id:
        return None
    entry = asset_library.get_video_entry(asset_id)
    return {
        "asset_id": asset_id,
        "path": str((asset_library.resolve_video_path(asset_id)).relative_to(BASE_DIR)),
        "label": entry.label,
        "provider": entry.provider,
    }


async def run(job: Job, niche_cfg: "NicheConfig") -> Job:
    t_start = time.monotonic()
    output_dir: Path = job.artifacts.output_dir
    required = _required_files(niche_cfg)
    logger.info("packager_start", job_id=job.job_id, output_dir=str(output_dir), required=required)

    missing = [f for f in required if not (output_dir / f).exists()]
    if missing:
        raise PackagingError(f"Job {job.job_id}: missing output files: {missing}")

    # job.artifacts.visual_design es None en niches pipeline_type="config_driven_template"
    # (ese flujo produce vision_analysis/template_config en su lugar, no un VisualDesign).
    style = job.artifacts.visual_design.style if job.artifacts.visual_design else niche_cfg.template.template_id

    manifest = {
        "job_id": job.job_id,
        "category": job.input.category_name,
        "niche_id": niche_cfg.id,
        "niche_display_name": niche_cfg.display_name,
        "pipeline_type": niche_cfg.pipeline_type,
        "genre": niche_cfg.metadata.genre or job.artifacts.analyzed_input.genre,
        "style": style,
        # analyzed_input.duration_seconds, no job.input.duration_seconds: si el request
        # trajo duration_config (auto/manual), resource_fetcher ya recalculó el valor
        # final ahí — este es el que realmente se usó para grabar el video.
        "duration_seconds": job.artifacts.analyzed_input.duration_seconds,
        "youtube_title": job.artifacts.summary.youtube_title,
        "youtube_description": job.artifacts.summary.youtube_description,
        "youtube_tags": job.artifacts.summary.youtube_tags,
        "tiktok_caption": job.artifacts.summary.tiktok_caption,
        "tiktok_hashtags": job.artifacts.summary.tiktok_hashtags,
        "video_formats": [fmt.model_dump() for fmt in niche_cfg.video.formats],
        "files": {f: str((output_dir / f).stat().st_size) for f in required},
        "image": _image_manifest_block(job.artifacts.image_asset_id),
        "music": _music_manifest_block(job.artifacts.music_asset_id),
        "background_video": _video_manifest_block(job.artifacts.video_asset_id),
    }
    if niche_cfg.pipeline_type == "config_driven_template":
        manifest["template_id"] = niche_cfg.template.template_id
    (output_dir / "manifest.json").write_bytes(
        orjson.dumps(manifest, option=orjson.OPT_INDENT_2)
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "packager_done",
        job_id=job.job_id,
        output_dir=str(output_dir),
        files=len(required),
        elapsed=elapsed,
    )
    return job.advance(JobStage.PACKAGED)
