"""Module 3 — Resource Fetcher: resuelve imagen y video (auto / library / url).

Cada recurso se resuelve independientemente según `job.input.image_source.type` /
`job.input.video_source.type`:

  - AUTO (default, solo imagen):  comportamiento original — busca vía queries de
                        Stage 1b (o fallback a query_template del nicho), con
                        validación multimodal opcional. Sin cambios de lógica.
  - LIBRARY:            copia un asset ya archivado en data/image_library o
                        data/video_library (por asset_id), sin red ni IA.
  - URL:                descarga directo desde la URL provista, sin buscar.

En los 3 casos, el recurso resuelto queda archivado (o su uso incrementado)
en la librería local (src/core/library/asset_library.py) — así todo lo que
el sistema usa, buscado o provisto, queda disponible para reutilizar después.

Resolución de música quitada (ver docs/investigaciones — poda de dominio
musical, este proyecto no elige "nicho musical"). La resolución de duración
AUTO (antes derivada de la duración real de la canción) queda pendiente de
reintroducir contra el audio propio del dominio nuevo (TTS o video subido).
"""

from __future__ import annotations

import asyncio
import random
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import orjson
import structlog

from src.adapters.image.factory import fetch_image, fetch_image_candidates
from src.config.niche_config import NicheConfig
from src.core.job import AssetSourceType, Job, JobStage
from src.core.library import asset_library
from src.core.ports.ai_port import AIPort
from src.core.ports.image_port import ImageFetchResult
from src.modules import image_validator

logger = structlog.get_logger(__name__)


async def run(job: Job, niche_cfg: NicheConfig, analysis_ai: AIPort) -> Job:
    t_start = time.monotonic()
    output_dir = job.artifacts.output_dir
    logs_dir = output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    logger.info(
        "resource_fetcher_start",
        job_id=job.job_id,
        image_source_type=job.input.image_source.type.value,
        requires_image=niche_cfg.template.requires_image,
        requires_video=niche_cfg.template.requires_video,
    )

    # ── Imagen (solo si el nicho la usa — motion-backdrop no tiene imagen de
    # fondo, el video ES el fondo) ────────────────────────────────────────────
    image_path: Path | None = None
    image_asset_id: str | None = None
    image_meta: dict = {}
    if niche_cfg.template.requires_image:
        img_result, image_asset_id, image_queries_tried = await _resolve_image(
            job, niche_cfg, analysis_ai, output_dir, logs_dir
        )
        image_path = img_result.path
        image_meta = {
            "provider": img_result.provider,
            "query": img_result.query,
            "photographer": img_result.photographer,
            "tags": img_result.tags,
        }
        image_log = {
            "provider": img_result.provider,
            "image_id": img_result.image_id,
            "query": img_result.query,
            "source_type": job.input.image_source.type.value,
            "all_queries_tried": image_queries_tried,
            "tags": img_result.tags,
            "photographer": img_result.photographer,
            "image_url": img_result.image_url,
            "local_path": niche_cfg.template.media_src_filename,
            "width": img_result.width,
            "height": img_result.height,
            "color_filter": niche_cfg.image.color_filter,
            "validation_enabled": niche_cfg.image.validation.enabled,
            "asset_id": image_asset_id,
            "downloaded_at": now,
        }
        (logs_dir / "05_imagen_seleccionada.json").write_bytes(
            orjson.dumps(image_log, option=orjson.OPT_INDENT_2)
        )

    # ── Video (solo si el nicho lo usa — ej. motion-backdrop) ─────────────────
    # Sin imagen real que analizar, el Vision Extractor recibe un frame
    # representativo extraído del video — ver visual_designer.py.
    video_path: Path | None = None
    video_asset_id: str | None = None
    video_meta: dict = {}
    if niche_cfg.template.requires_video:
        video_path, video_asset_id, video_meta = await _resolve_video(job, niche_cfg, output_dir)
        (logs_dir / "05b_video_seleccionado.json").write_bytes(
            orjson.dumps(
                {**video_meta, "asset_id": video_asset_id, "local_path": niche_cfg.template.media_src_filename,
                 "source_type": job.input.video_source.type.value if job.input.video_source else None,
                 "downloaded_at": now},
                option=orjson.OPT_INDENT_2,
            )
        )
        frame_path = logs_dir / "00_video_frame.jpg"
        await _extract_video_frame(video_path, frame_path)
        image_path = frame_path  # lo que visual_designer analiza — nunca un image_asset_id real

    # Duración: sin música que resolver, analyzed_input.duration_seconds queda
    # tal cual lo dejó input_analyzer (Stage 1) — la resolución AUTO (antes
    # derivada de la duración real de la canción) se reintroduce en la Etapa 2
    # contra el audio propio del dominio nuevo (TTS o video subido).
    analyzed_input = job.artifacts.analyzed_input

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "resource_fetcher_done",
        job_id=job.job_id,
        image=str(image_path) if image_path else None,
        video=str(video_path) if video_path else None,
        duration_seconds=analyzed_input.duration_seconds,
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(
        update={
            "analyzed_input": analyzed_input,
            "image_path": image_path,
            "image_meta": image_meta,
            "image_asset_id": image_asset_id,
            "video_path": video_path,
            "video_meta": video_meta,
            "video_asset_id": video_asset_id,
        }
    )
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.RESOURCES_FETCHED)


def _library_image_category(job: Job, niche_cfg: NicheConfig, explicit: str | None) -> str:
    if explicit:
        return explicit
    if niche_cfg.image.library_category:
        return niche_cfg.image.library_category
    if job.artifacts.analyzed_input:
        return job.artifacts.analyzed_input.genre
    return niche_cfg.id


# ── Video: dispatcher por tipo de fuente (sin AUTO) ───────────────────────────

async def _extract_video_frame(video_path: Path, dest_path: Path) -> None:
    """Extrae el primer fotograma de video_path a dest_path (jpg) — es lo único
    que se manda al Vision Extractor cuando el nicho no tiene imagen real
    (ver capture_frame.py del prototipo 04-video-motion, misma lógica)."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-v", "error", "-i", str(video_path),
        "-frames:v", "1", "-q:v", "2", str(dest_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg no pudo extraer un frame de '{video_path}': {stderr.decode()[-300:]}")


async def _resolve_video(job: Job, niche_cfg: NicheConfig, output_dir: Path) -> tuple[Path, str, dict]:
    """Devuelve (video_path, video_asset_id, video_meta). Sin rama AUTO — no hay
    proveedor de stock de video integrado, solo LIBRARY/URL (upload pasa por
    LIBRARY, ver videos.py)."""
    src = job.input.video_source
    if src is None:
        raise RuntimeError(
            f"Niche '{niche_cfg.id}' requiere video_source (template.requires_video=True) "
            "pero job.input.video_source es None."
        )
    dest_path = output_dir / niche_cfg.template.media_src_filename

    if src.type == AssetSourceType.LIBRARY:
        entry = asset_library.get_video_entry(src.asset_id)
        source_path = asset_library.resolve_video_path(entry.asset_id)
        shutil.copy2(source_path, dest_path)
        await asset_library.touch_usage(entry.asset_id, "video")
        logger.info("video_resolved_from_library", job_id=job.job_id, asset_id=entry.asset_id)
        meta = {"provider": entry.provider, "label": entry.label, "width": entry.width, "height": entry.height}
        return dest_path, entry.asset_id, meta

    if src.type == AssetSourceType.URL:
        await asset_library.download_url_to(src.url, dest_path)
        logger.info("video_resolved_from_url", job_id=job.job_id, url=src.url)
        category = src.category or niche_cfg.id
        entry = await asset_library.register_video(
            dest_path, category=category, source="url", provider="user_url",
            original_url=src.url, job_id=job.job_id,
        )
        return dest_path, entry.asset_id, {"provider": "user_url"}

    raise RuntimeError(f"video_source.type='{src.type.value}' no soportado (solo library/url).")


# ── Imagen: dispatcher por tipo de fuente ─────────────────────────────────────

async def _resolve_image(
    job: Job, niche_cfg: NicheConfig, analysis_ai: AIPort, output_dir: Path, logs_dir: Path
) -> tuple[ImageFetchResult, str, list[str]]:
    """Devuelve (img_result, image_asset_id, queries_intentadas)."""
    src = job.input.image_source

    if src.type == AssetSourceType.LIBRARY:
        entry = asset_library.get_image_entry(src.asset_id)
        source_path = asset_library.resolve_image_path(entry.asset_id)
        dest_path = output_dir / niche_cfg.template.media_src_filename
        shutil.copy2(source_path, dest_path)
        await asset_library.touch_usage(entry.asset_id, "image")
        logger.info("image_resolved_from_library", job_id=job.job_id, asset_id=entry.asset_id)
        img_result = ImageFetchResult(
            path=dest_path,
            provider=entry.provider,
            image_id=entry.asset_id,
            query="",
            photographer=entry.photographer,
            image_url=entry.original_url or "",
            tags=entry.tags,
            width=entry.width,
            height=entry.height,
        )
        return img_result, entry.asset_id, []

    if src.type == AssetSourceType.URL:
        dest_path = output_dir / niche_cfg.template.media_src_filename
        await asset_library.download_url_to(src.url, dest_path)
        logger.info("image_resolved_from_url", job_id=job.job_id, url=src.url)
        img_result = ImageFetchResult(
            path=dest_path, provider="user_url", image_id="", query="",
            photographer="", image_url=src.url, tags="", width=0, height=0,
        )
        category = _library_image_category(job, niche_cfg, src.category)
        entry = await asset_library.register_image(
            dest_path,
            category=category,
            source="url",
            provider="user_url",
            original_url=src.url,
            job_id=job.job_id,
            orientation=niche_cfg.image.orientation,
        )
        return img_result, entry.asset_id, []

    # ── AUTO — comportamiento original, sin cambios de lógica ─────────────────
    img_result, image_queries = await _resolve_image_auto(job, niche_cfg, analysis_ai, output_dir, logs_dir)
    category = _library_image_category(job, niche_cfg, None)
    entry = await asset_library.register_image(
        img_result.path,
        category=category,
        source="auto",
        provider=img_result.provider,
        photographer=img_result.photographer,
        width=img_result.width,
        height=img_result.height,
        orientation=niche_cfg.image.orientation,
        color_filter_used=niche_cfg.image.color_filter,
        tags=img_result.tags,
        job_id=job.job_id,
    )
    return img_result, entry.asset_id, image_queries


async def _resolve_image_auto(
    job: Job, niche_cfg: NicheConfig, analysis_ai: AIPort, output_dir: Path, logs_dir: Path
) -> tuple[ImageFetchResult, list[str]]:
    analyzed = job.artifacts.analyzed_input
    sq = job.artifacts.search_queries  # generado en Stage 1b, puede ser None

    # ── Resolver lista de queries de imagen ───────────────────────────────────
    if sq and sq.image_queries:
        # Shuffle para que cada run empiece con una query diferente
        image_queries = list(sq.image_queries)
        random.shuffle(image_queries)
    elif niche_cfg.image.query_template:
        image_queries = [niche_cfg.image.query_template]
    else:
        image_queries = [analyzed.image_query]

    color_filter = niche_cfg.image.color_filter
    results_count = niche_cfg.image.results_count
    validation_cfg = niche_cfg.image.validation

    logger.info(
        "image_auto_search_start",
        job_id=job.job_id,
        image_queries=image_queries,
        color_filter=color_filter,
        validation_enabled=validation_cfg.enabled,
    )

    candidates_dir = output_dir / "candidates"
    img_result = None

    for idx, image_query in enumerate(image_queries):
        logger.info("image_query_attempt", job_id=job.job_id, idx=idx + 1, query=image_query)
        try:
            if validation_cfg.enabled and results_count > 1:
                # Flujo de validación multimodal con Gemini
                candidates = await fetch_image_candidates(
                    image_query,
                    candidates_dir / f"q{idx}",
                    count=results_count,
                    color_filter=color_filter,
                    orientation=niche_cfg.image.orientation,
                )
                best = await image_validator.pick_best_candidate(
                    candidates, validation_cfg, analysis_ai, logs_dir
                )

                if best is None and validation_cfg.fallback_query:
                    logger.warning("image_validation_fallback", job_id=job.job_id)
                    fallback_candidates = await fetch_image_candidates(
                        validation_cfg.fallback_query,
                        candidates_dir / f"q{idx}_fallback",
                        count=results_count,
                        color_filter=color_filter,
                        orientation=niche_cfg.image.orientation,
                    )
                    best = await image_validator.pick_best_candidate(
                        fallback_candidates, validation_cfg, analysis_ai, logs_dir
                    )
                    if best is None and fallback_candidates:
                        best = fallback_candidates[0]
                        logger.warning("image_validation_using_fallback_first", job_id=job.job_id)

                if best is None and candidates:
                    best = candidates[0]
                    logger.warning("image_validation_no_pass_using_first", job_id=job.job_id)

                if best is not None:
                    img_result_path = image_validator.copy_to_bg(
                        best, output_dir, filename=niche_cfg.template.media_src_filename
                    )
                    img_result = type(best)(
                        path=img_result_path,
                        provider=best.provider,
                        image_id=best.image_id,
                        query=image_query,
                        photographer=best.photographer,
                        image_url=best.image_url,
                        tags=best.tags,
                        width=best.width,
                        height=best.height,
                    )
                    break

            else:
                # Flujo simple: una sola imagen sin validación
                img_result = await fetch_image(
                    query=image_query,
                    dest_path=output_dir / niche_cfg.template.media_src_filename,
                )
                break

        except Exception as exc:
            logger.warning("image_query_failed", job_id=job.job_id, query=image_query, error=str(exc))

    if img_result is None:
        raise RuntimeError(f"All image queries failed. Tried: {image_queries}")

    return img_result, image_queries

