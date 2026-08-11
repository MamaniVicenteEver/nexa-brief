"""Module 3 — Resource Fetcher: resuelve imagen y música (auto / library / url).

Cada recurso (imagen, música) se resuelve independientemente según
`job.input.image_source.type` / `job.input.music_source.type`:

  - AUTO (default):    comportamiento original — busca vía queries de Stage 1b
                        (o fallback a query_template/genre del nicho), con
                        validación multimodal opcional. Sin cambios de lógica.
  - LIBRARY:            copia un asset ya archivado en data/image_library o
                        data/music_library (por asset_id), sin red ni IA.
  - URL:                descarga directo desde la URL provista, sin buscar.

En los 3 casos, el recurso resuelto queda archivado (o su uso incrementado)
en la librería local (src/core/library/asset_library.py) — así todo lo que
el sistema usa, buscado o provisto, queda disponible para reutilizar después.
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
from src.adapters.music.factory import fetch_music
from src.config.exceptions import MusicFetchError
from src.config.niche_config import NicheConfig
from src.config.settings import settings
from src.core.job import AssetSourceType, DurationMode, Job, JobStage
from src.core.library import asset_library
from src.core.ports.ai_port import AIPort
from src.core.ports.image_port import ImageFetchResult
from src.core.ports.music_port import MusicFetchResult
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
        music_source_type=job.input.music_source.type.value,
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

    # ── Música ────────────────────────────────────────────────────────────────
    music_result, music_asset_id, music_queries_tried = await _resolve_music(
        job, niche_cfg, output_dir
    )

    music_log = {
        "provider": music_result.provider,
        "track_id": music_result.track_id,
        "track_name": music_result.track_name,
        "genre": music_result.genre,
        "artist": music_result.artist,
        "duration": music_result.duration,
        "url": music_result.url,
        "local_path": "song.mp3",
        "source_type": job.input.music_source.type.value,
        "all_queries_tried": music_queries_tried,
        "asset_id": music_asset_id,
        "downloaded_at": now,
    }
    (logs_dir / "06_musica_seleccionada.json").write_bytes(
        orjson.dumps(music_log, option=orjson.OPT_INDENT_2)
    )

    music_meta = {
        "provider": music_result.provider,
        "track_name": music_result.track_name,
        "genre": music_result.genre,
        "artist": music_result.artist,
    }

    # ── Duración (opcional): auto (canción × repeticiones) o manual ──────────
    # Se resuelve ACÁ porque el modo "auto" necesita la duración REAL del
    # archivo de música ya resuelto — recién ahora existe en disco. El
    # resultado sobreescribe analyzed_input.duration_seconds (lo que
    # video_recorder / packager / result_summarizer usan río abajo), no
    # job.input.duration_seconds (que es inmutable, solo el valor de entrada).
    analyzed_input = job.artifacts.analyzed_input
    if job.input.duration_config is not None:
        resolved_seconds = await _resolve_duration_seconds(job, music_result.path, logs_dir)
        analyzed_input = analyzed_input.model_copy(update={"duration_seconds": resolved_seconds})
        # Reescribir el log de Stage 1 para que quede consistente con la duración
        # que realmente se va a grabar (evita un 01_input_completado.json que
        # muestre un valor viejo/provisional distinto al video final).
        (logs_dir / "01_input_completado.json").write_text(
            analyzed_input.model_dump_json(indent=2), encoding="utf-8"
        )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "resource_fetcher_done",
        job_id=job.job_id,
        image=str(image_path) if image_path else None,
        video=str(video_path) if video_path else None,
        music=str(music_result.path),
        duration_seconds=analyzed_input.duration_seconds,
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(
        update={
            "analyzed_input": analyzed_input,
            "image_path": image_path,
            "image_meta": image_meta,
            "image_asset_id": image_asset_id,
            "music_path": music_result.path,
            "music_meta": music_meta,
            "music_asset_id": music_asset_id,
            "video_path": video_path,
            "video_meta": video_meta,
            "video_asset_id": video_asset_id,
        }
    )
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.RESOURCES_FETCHED)


async def _get_audio_duration_seconds(path: Path) -> float:
    """Lee la duración real de un archivo de audio con ffprobe (ya es dependencia del sistema)."""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0 or not stdout.strip():
        raise MusicFetchError(f"ffprobe no pudo leer la duración de '{path}': {stderr.decode()[-300:]}")
    return float(stdout.decode().strip())


async def _resolve_duration_seconds(job: Job, music_path: Path, logs_dir: Path) -> int:
    dc = job.input.duration_config
    detected_song_seconds: float | None = None
    was_clamped = False

    if dc.mode == DurationMode.MANUAL:
        resolved = dc.manual_seconds or job.input.duration_seconds
    else:  # AUTO
        detected_song_seconds = await _get_audio_duration_seconds(music_path)
        raw_total = round(detected_song_seconds * dc.repeat_count)
        resolved = max(settings.video_min_duration_seconds, min(settings.video_max_duration_seconds, raw_total))
        was_clamped = resolved != raw_total
        if was_clamped:
            logger.warning(
                "duration_auto_clamped",
                job_id=job.job_id,
                detected_song_seconds=round(detected_song_seconds, 2),
                repeat_count=dc.repeat_count,
                raw_total_seconds=raw_total,
                clamped_to=resolved,
            )

    duration_log = {
        "mode": dc.mode.value,
        "repeat_count": dc.repeat_count if dc.mode == DurationMode.AUTO else None,
        "detected_song_seconds": round(detected_song_seconds, 2) if detected_song_seconds is not None else None,
        "manual_seconds": dc.manual_seconds if dc.mode == DurationMode.MANUAL else None,
        "resolved_duration_seconds": resolved,
        "was_clamped": was_clamped,
        "allowed_range": [settings.video_min_duration_seconds, settings.video_max_duration_seconds],
    }
    (logs_dir / "05c_duracion_resuelta.json").write_bytes(
        orjson.dumps(duration_log, option=orjson.OPT_INDENT_2)
    )
    logger.info("duration_resolved", job_id=job.job_id, **{k: v for k, v in duration_log.items() if k != "allowed_range"})
    return resolved


def _library_image_category(job: Job, niche_cfg: NicheConfig, explicit: str | None) -> str:
    if explicit:
        return explicit
    if niche_cfg.image.library_category:
        return niche_cfg.image.library_category
    if job.artifacts.analyzed_input:
        return job.artifacts.analyzed_input.genre
    return niche_cfg.id


def _library_music_category(job: Job, niche_cfg: NicheConfig, explicit: str | None) -> str:
    if explicit:
        return explicit
    if niche_cfg.audio.library_category:
        return niche_cfg.audio.library_category
    return niche_cfg.audio.genre


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


# ── Música: dispatcher por tipo de fuente ─────────────────────────────────────

async def _resolve_music(
    job: Job, niche_cfg: NicheConfig, output_dir: Path
) -> tuple[MusicFetchResult, str, list[str]]:
    """Devuelve (music_result, music_asset_id, queries_intentadas)."""
    src = job.input.music_source

    if src.type == AssetSourceType.LIBRARY:
        entry = asset_library.get_music_entry(src.asset_id)
        source_path = asset_library.resolve_music_path(entry.asset_id)
        dest_path = output_dir / "song.mp3"
        shutil.copy2(source_path, dest_path)
        await asset_library.touch_usage(entry.asset_id, "music")
        logger.info("music_resolved_from_library", job_id=job.job_id, asset_id=entry.asset_id)
        music_result = MusicFetchResult(
            path=dest_path,
            provider=entry.provider,
            track_name=entry.track_name,
            artist=entry.artist,
            genre=entry.genre,
            track_id=entry.asset_id,
            duration=entry.duration_seconds,
            url=entry.original_url or "",
        )
        return music_result, entry.asset_id, []

    if src.type == AssetSourceType.URL:
        dest_path = output_dir / "song.mp3"
        await asset_library.download_url_to(src.url, dest_path)
        logger.info("music_resolved_from_url", job_id=job.job_id, url=src.url)
        song_info = job.input.song_info
        track_name = (song_info.song_name if song_info else "") or ""
        artist = (song_info.artist if song_info else "") or ""
        music_result = MusicFetchResult(
            path=dest_path, provider="user_url", track_name=track_name, artist=artist,
            genre="", track_id="", duration=0, url=src.url,
        )
        category = _library_music_category(job, niche_cfg, src.category)
        entry = await asset_library.register_music(
            dest_path,
            category=category,
            source="url",
            provider="user_url",
            original_url=src.url,
            job_id=job.job_id,
            track_name=track_name,
            artist=artist,
        )
        return music_result, entry.asset_id, []

    # ── AUTO — comportamiento original, sin cambios de lógica ─────────────────
    music_result, music_queries = await _resolve_music_auto(job, niche_cfg, output_dir)
    category = _library_music_category(job, niche_cfg, None)
    entry = await asset_library.register_music(
        music_result.path,
        category=category,
        source="auto",
        provider=music_result.provider,
        track_name=music_result.track_name,
        artist=music_result.artist,
        genre=music_result.genre,
        duration_seconds=music_result.duration,
        job_id=job.job_id,
    )
    return music_result, entry.asset_id, music_queries


async def _resolve_music_auto(
    job: Job, niche_cfg: NicheConfig, output_dir: Path
) -> tuple[MusicFetchResult, list[str]]:
    analyzed = job.artifacts.analyzed_input
    sq = job.artifacts.search_queries

    if sq and sq.music_queries:
        music_queries = sq.music_queries
    else:
        music_genre = niche_cfg.audio.genre or analyzed.genre
        music_queries = [music_genre]

    music_result = None
    last_music_error: Exception | None = None

    for music_query in music_queries:
        try:
            music_result = await fetch_music(
                genre=music_query,
                dest_path=output_dir / "song.mp3",
            )
            logger.info("music_query_success", job_id=job.job_id, query=music_query)
            break
        except Exception as exc:
            logger.warning("music_query_failed", job_id=job.job_id, query=music_query, error=str(exc))
            last_music_error = exc

    if music_result is None:
        raise MusicFetchError(
            f"All music queries failed for niche '{niche_cfg.id}'. "
            f"Tried: {music_queries}. Last error: {last_music_error}"
        )

    return music_result, music_queries
