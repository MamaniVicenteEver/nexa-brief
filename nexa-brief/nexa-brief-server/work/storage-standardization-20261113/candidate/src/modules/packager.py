"""Module 7b — Packager: verifica y finaliza el directorio de salida."""

from __future__ import annotations

import time
from pathlib import Path
from typing import TYPE_CHECKING

import orjson
import structlog

from src.config.exceptions import PackagingError
from src.config.settings import BASE_DIR, settings
from src.config.profile_layout import layout_for_settings
from src.core.job import Job, JobStage
from src.core.library import asset_library

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig

logger = structlog.get_logger(__name__)

def _required_files(niche_cfg: "NicheConfig") -> list[str]:
    """Archivos requeridos: los base + los definidos en video.formats del nicho."""
    extra = [fmt.output_filename for fmt in niche_cfg.video.formats]
    base = ["index.html", "song.mp3"]
    # El fondo (bg.jpg / bg.mp4) solo existe si la plantilla lo pide: las de letras sin fondo
    # propio (caution, mixtas…) no lo tienen y el empaquetado fallaba al final de la grabación.
    if niche_cfg.template.requires_image or niche_cfg.template.requires_video:
        base.append(niche_cfg.template.media_src_filename)
    if niche_cfg.pipeline_type == "config_driven_template":
        base.append("config.json")
        if niche_cfg.template.requires_lyrics:
            base.append("lyrics.json")
    return base + extra


def _asset_path(path: Path) -> str | None:
    layout = layout_for_settings(settings)
    if layout.schema_version >= 2:
        resolved = path.resolve()
        root = layout.root.resolve()
        return resolved.relative_to(root).as_posix() if resolved.is_relative_to(root) else None
    return str(path.relative_to(BASE_DIR))


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
        "path": _asset_path(asset_library.resolve_image_path(asset_id)),
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
        "path": _asset_path(asset_library.resolve_music_path(asset_id)),
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
        "path": _asset_path(asset_library.resolve_video_path(asset_id)),
        "label": entry.label,
        "provider": entry.provider,
    }


async def run(job: Job, niche_cfg: "NicheConfig") -> Job:
    t_start = time.monotonic()
    output_dir: Path = job.artifacts.output_dir
    required = _required_files(niche_cfg)
    render_dir = job.artifacts.render_dir or output_dir
    final_names = {fmt.output_filename for fmt in niche_cfg.video.formats}
    assets_dir = job.artifacts.content_dir
    layout = layout_for_settings(settings)
    formats_by_filename = {fmt.output_filename: fmt for fmt in niche_cfg.video.formats}
    def file_path(name: str) -> Path:
        if name in final_names:
            if layout.schema_version >= 3:
                from src.config.media_paths import pipeline_video_key
                fmt = formats_by_filename[name]
                category = output_dir.relative_to(layout.productions_dir).parts[0]
                return layout.renders_dir / pipeline_video_key(category, job.job_id, fmt.id, fmt.aspect_ratio)
            return render_dir / name
        return (output_dir if name == "index.html" else assets_dir) / name
    logger.info("packager_start", job_id=job.job_id, output_dir=str(output_dir), required=required)

    missing = [f for f in required if not file_path(f).exists()]
    if missing:
        raise PackagingError(f"Job {job.job_id}: missing output files: {missing}")

    # Antes del manifest, para que "files" registre el peso final que se publica.
    from src.modules.video_compressor import compress_for_publishing

    if job.artifacts.render_dir is None:
        for fmt in niche_cfg.video.formats:
            await compress_for_publishing(output_dir / fmt.output_filename)

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
        "files": {f: str(file_path(f).stat().st_size) for f in required},
        "image": _image_manifest_block(job.artifacts.image_asset_id),
        "music": _music_manifest_block(job.artifacts.music_asset_id),
        "background_video": _video_manifest_block(job.artifacts.video_asset_id),
    }
    if niche_cfg.pipeline_type == "config_driven_template":
        manifest["template_id"] = niche_cfg.template.template_id
    if job.artifacts.assets_dir is not None:
        manifest["composition"] = {"html": "index.html", "assets": assets_dir.relative_to(output_dir).as_posix()}
        if job.artifacts.config_json_path is not None:
            manifest["composition"]["config"] = job.artifacts.config_json_path.relative_to(output_dir).as_posix()
    (output_dir / "manifest.json").write_bytes(
        orjson.dumps(manifest, option=orjson.OPT_INDENT_2)
    )

    # Miniatura: el final de la intro (cartel con el nombre de la canción) del video 16:9.
    thumbnail = job.artifacts.thumbnail_path
    landscape = niche_cfg.get_16x9_format()
    if thumbnail is None and landscape is not None and file_path(landscape.output_filename).exists():
        from src.modules.thumbnail_maker import capture_at, make_thumbnail

        thumbnail_dir = assets_dir / "thumbnails" if layout.schema_version >= 3 else render_dir
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        thumbnail = await make_thumbnail(
            file_path(landscape.output_filename),
            thumbnail_dir,
            capture_at(niche_cfg.template.template_id)
        )
        if thumbnail is not None:
            job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"thumbnail_path": thumbnail})})

    if job.artifacts.render_dir is not None:
        import hashlib
        from src.core.content_registry import index_production_assets, register_recording, register_resource
        from src.adapters.content.local_inventory import LocalContentInventory
        root = layout_for_settings(settings).root
        if assets_dir != output_dir:
            await index_production_assets(job.job_id, output_dir, LocalContentInventory())
        for kind, path in (("image", job.artifacts.image_path), ("music", job.artifacts.music_path),
                           ("video", job.artifacts.video_path)):
            if path is None or not path.is_file() or not path.resolve().is_relative_to(output_dir.resolve()):
                continue
            key = path.relative_to(root).as_posix()
            asset_id = hashlib.sha256(f"{job.job_id}:{key}".encode()).hexdigest()
            await register_resource(job.job_id, key, kind=kind, asset_id=asset_id)
        outputs = list(dict.fromkeys(
            [file_path(fmt.output_filename) for fmt in niche_cfg.video.formats]
            + [path for path in (job.artifacts.youtube_video_path, job.artifacts.reels_video_path,
                                  job.artifacts.tiktok_video_path) if path is not None and path.is_file()]
        ))
        if job.artifacts.recording_log_id:
            await register_recording(job.job_id, job.job_id, outputs=outputs,
                                     log_id=job.artifacts.recording_log_id, duration="full")

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "packager_done",
        job_id=job.job_id,
        output_dir=str(output_dir),
        files=len(required),
        elapsed=elapsed,
    )
    return job.advance(JobStage.PACKAGED)
