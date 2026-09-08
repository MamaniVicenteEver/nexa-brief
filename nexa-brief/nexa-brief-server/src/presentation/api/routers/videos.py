"""Videos router — POST /videos triggers a batch generation job (fire-and-forget:
responde casi al instante con job_id(s); el estado se consulta con GET /videos/jobs/{id})."""

from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from starlette.responses import Response

from src.adapters.recorder.infrastructure import remotion_adapter
from src.config.exceptions import AssetNotFoundError
from src.config.niche_config import NicheConfig, get_niche_config
from src.config.settings import settings
from src.core import history_tracker, job_tracker, notification_tracker
from src.core.history import HistoryEvent
from src.core.job import (
    AssetSourceType,
    DurationConfig,
    DurationMode,
    Job,
    JobPublishingConfig,
    JobStage,
    SongInfo,
)
from src.core.library import asset_library
from src.core.notification import Notification
from src.core.orchestrator import Orchestrator
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.resource_sources import (
    resolve_image_source,
    resolve_music_source,
    resolve_video_source,
)
from src.presentation.api.schemas.video_schema import (
    BatchAcceptedResponse,
    JobAcceptedItem,
    JobDetailResponse,
    JobListItem,
    JobListResponse,
    VideoGenerationRequest,
)

router = APIRouter(tags=["videos"])
logger = structlog.get_logger(__name__)

# Referencias fuertes a las tasks de background — asyncio.create_task no
# mantiene viva la Task por sí sola si nadie la referencia (puede ser
# garbage-collected a mitad de camino); se remueven solas al terminar.
_background_tasks: set[asyncio.Task] = set()


def _log_task_exception(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error("background_job_task_failed", error=str(exc))


async def _notify_terminal(job: Job) -> None:
    """Crea una notificación cuando `job` llega a un stage terminal.

    PACKAGED solo notifica si publishing está desactivado (si está activado,
    el mismo job sigue hasta PUBLISHED — notificar en ambos duplicaría el
    aviso). FAILED puede ocurrir en cualquier stage del pipeline, no solo en
    publicación.
    """
    if job.stage == JobStage.PUBLISHED:
        await notification_tracker.create(Notification(
            type="video_ready",
            severity="info",
            title="Video publicado",
            message=f"El video de '{job.input.category_name}' se publicó correctamente.",
            job_id=job.job_id,
        ))
    elif job.stage == JobStage.PACKAGED and not job.input.publishing.enabled:
        await notification_tracker.create(Notification(
            type="video_ready",
            severity="info",
            title="Video listo",
            message=f"El video de '{job.input.category_name}' terminó de generarse.",
            job_id=job.job_id,
        ))
    elif job.stage == JobStage.FAILED:
        await notification_tracker.create(Notification(
            type="video_failed",
            severity="error",
            title="Falló la generación del video",
            message=job.errors[-1] if job.errors else f"El job de '{job.input.category_name}' falló.",
            job_id=job.job_id,
        ))


async def _on_stage(job: Job) -> None:
    """Callback compuesto pasado a `pipeline.run` — se invoca después de cada
    stage: persiste el snapshot de estado actual (job_tracker), agrega el
    evento a la línea de tiempo (history_tracker), empuja un evento realtime
    con el detalle completo del job y, si el stage es terminal, crea la
    notificación correspondiente (que a su vez empuja su propio evento —
    una transición terminal dispara dos eventos seguidos, a propósito)."""
    await job_tracker.update(job)
    await history_tracker.append_event(HistoryEvent.from_job(job))

    record = job_tracker.get(job.job_id)
    if record is not None:
        await get_event_bus().publish(
            RealtimeEvent(
                type="job_stage_changed",
                data=JobDetailResponse.from_record(
                    record, summary=job_tracker.get_summary(job.job_id)
                ).model_dump(),
            )
        )

    await _notify_terminal(job)


def _run_batch_in_background(orchestrator: Orchestrator, jobs: list[Job]) -> None:
    task = asyncio.create_task(orchestrator.run_batch(jobs=jobs, on_stage=_on_stage))
    _background_tasks.add(task)
    task.add_done_callback(_log_task_exception)


async def _validate_publishing(publishing: JobPublishingConfig) -> None:
    """Shared by both /videos and /videos/upload — reject the request early
    (before Stage 1 even runs) if a selected channel doesn't exist or its
    token can't be refreshed, instead of failing silently at Stage 9."""
    if not publishing.enabled:
        return

    from src.adapters.publishing.factory import get_publisher_facade
    try:
        facade = get_publisher_facade()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Publisher is not configured: {exc}. Check accounts.json and encryption key.",
        )

    for account in publishing.accounts:
        if ":" not in account:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid account format: '{account}'. Expected 'platform:alias'.",
            )
        platform, alias = account.split(":", 1)
        if platform not in ["youtube", "facebook", "tiktok"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform: '{platform}'. Supported: youtube, facebook, tiktok.",
            )

        try:
            facade._token_manager._storage.get_state(platform, alias)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Account '{account}' is not configured in accounts.json: {exc}.",
            )

        try:
            await facade._token_manager.get_valid_token(platform, alias)
        except Exception as exc:
            raise HTTPException(
                status_code=401,
                detail=f"Token validation failed for account '{account}': {exc}. Re-authentication required.",
            )


def _check_background_capacity(quantity: int) -> None:
    active = job_tracker.count_active()
    if active + quantity > settings.max_background_jobs:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Too many jobs in progress ({active} active, limit "
                f"{settings.max_background_jobs}). Wait for some to finish."
            ),
        )


def _validate_recorder_engine_override(
    niche_cfg: NicheConfig, category_name: str, recorder_engine_override: str | None, render_target: str | None
) -> None:
    """Valida el override de motor (y, de paso, render_target contra el motor
    EFECTIVO — override si se dio, si no el default del niche) antes de
    aceptar el job. Mismo punto/estilo que las demás validaciones de esta API:
    rechazar temprano con 400 en vez de fallar recién dentro del pipeline."""
    if recorder_engine_override == "remotion" and not remotion_adapter.supports_niche(niche_cfg):
        raise HTTPException(
            status_code=400,
            detail=f"recorder_engine_override='remotion' no está disponible para "
                    f"'{category_name}' — todavía no tiene una composición Remotion portada.",
        )
    effective_engine = recorder_engine_override or niche_cfg.recorder_engine
    if render_target is not None and effective_engine != "remotion":
        raise HTTPException(
            status_code=400,
            detail=f"render_target solo aplica cuando el motor efectivo es 'remotion' "
                    f"(category_name='{category_name}' usa '{effective_engine}').",
        )


@router.post("/videos", response_model=BatchAcceptedResponse, status_code=202)
async def generate_videos(request: VideoGenerationRequest) -> BatchAcceptedResponse:
    """Acepta un lote de generación y lo dispara en background.

    Responde casi al instante con los `job_id` — el progreso se consulta con
    GET /videos/jobs/{job_id}, no esperando esta respuesta.
    """
    logger.info("api_generate_videos", **request.model_dump())

    # Validar temprano las referencias a la librería local — evita gastar
    # Stage 1 (llamada a Gemini) antes de descubrir que el asset_id no existe.
    if request.image_source.type == AssetSourceType.LIBRARY:
        try:
            asset_library.get_image_entry(request.image_source.asset_id)
        except AssetNotFoundError as exc:
            raise HTTPException(status_code=400, detail=f"image_source.asset_id not found: {exc}")
    if request.music_source.type == AssetSourceType.LIBRARY:
        try:
            asset_library.get_music_entry(request.music_source.asset_id)
        except AssetNotFoundError as exc:
            raise HTTPException(status_code=400, detail=f"music_source.asset_id not found: {exc}")
    if request.video_source and request.video_source.type == AssetSourceType.LIBRARY:
        try:
            asset_library.get_video_entry(request.video_source.asset_id)
        except AssetNotFoundError as exc:
            raise HTTPException(status_code=400, detail=f"video_source.asset_id not found: {exc}")

    await _validate_publishing(request.publishing)

    _check_background_capacity(request.quantity)
    niche_cfg = get_niche_config(request.category_name)
    _validate_recorder_engine_override(
        niche_cfg, request.category_name, request.recorder_engine_override, request.render_target
    )

    orchestrator = Orchestrator()
    jobs = orchestrator.build_jobs(
        category_name=request.category_name,
        quantity=request.quantity,
        duration_seconds=request.duration_seconds,
        duration_config=request.duration_config,
        user_context=request.user_context,
        publishing=request.publishing,
        image_source=request.image_source,
        music_source=request.music_source,
        video_source=request.video_source,
        song_info=request.song_info,
        render_target=request.render_target,
        recorder_engine_override=request.recorder_engine_override,
    )
    for j in jobs:
        await job_tracker.create(j, niche_cfg)

    _run_batch_in_background(orchestrator, jobs)

    return BatchAcceptedResponse(
        total=len(jobs),
        jobs=[JobAcceptedItem(job_id=j.job_id, category=j.input.category_name, stage=j.stage.value) for j in jobs],
    )


# ── Variante multipart/form-data — botones reales de "Choose file" en Swagger ──

@router.post("/videos/upload", response_model=BatchAcceptedResponse, status_code=202)
async def generate_videos_with_upload(
    category_name: str = Form(..., description="Nombre del nicho/categoría (ej. 'image_bg_portrait')."),
    quantity: int = Form(default=1, ge=1, le=10),
    user_context: str | None = Form(default=None, max_length=500),
    duration_mode: DurationMode = Form(
        default=DurationMode.AUTO,
        description=(
            "'auto' (default): la duración final es la duración REAL de la música (subida o "
            "buscada) × repeat_count — con repeat_count=1 (default) es exactamente la de la "
            "canción, tal cual se pidió. 'manual': duración exacta en manual_seconds."
        ),
    ),
    repeat_count: int = Form(default=1, ge=1, le=10, description="Solo si duration_mode='auto'."),
    manual_seconds: int | None = Form(default=None, ge=5, le=300, description="Solo si duration_mode='manual'."),
    song_name: str | None = Form(default=None),
    artist: str | None = Form(default=None),
    topic: str | None = Form(default=None, description="De qué trata la canción."),
    song_description: str | None = Form(default=None),
    language: str | None = Form(
        default=None,
        description=(
            "Código ISO del idioma de la canción (ej. 'es', 'en') — solo relevante para nichos "
            "lyrics_video_* (transcripción). Si se omite, se auto-detecta."
        ),
    ),
    image_file: UploadFile | None = File(default=None, description="Imagen de fondo. Si se omite, el sistema busca una automáticamente."),
    music_file: UploadFile | None = File(default=None, description="Canción/audio. Si se omite, el sistema busca una automáticamente."),
    video_file: UploadFile | None = File(
        default=None,
        description="Video de fondo — solo para nichos con template.requires_video=True (ej. motion_backdrop_showcase). No hay búsqueda automática de video.",
    ),
    image_asset_id: str | None = Form(
        default=None, description="Reusar una imagen YA archivada en la librería en vez de subir un archivo."
    ),
    music_asset_id: str | None = Form(
        default=None, description="Reusar una canción YA archivada en la librería en vez de subir un archivo."
    ),
    video_asset_id: str | None = Form(
        default=None, description="Reusar un video de fondo YA archivado en la librería en vez de subir un archivo."
    ),
    render_target: str | None = Form(
        default=None,
        description=(
            "'local'/'aws' — override del motor de render de Remotion para este batch. "
            "Solo válido si el motor efectivo (recorder_engine_override o el del nicho) es 'remotion'."
        ),
    ),
    recorder_engine_override: str | None = Form(
        default=None,
        description=(
            "'remotion'/'playwright' — override del motor de grabación para este batch, en vez "
            "del recorder_engine default del nicho. 'remotion' se rechaza con 400 si el nicho "
            "todavía no tiene una composición Remotion portada."
        ),
    ),
    publishing_accounts: list[str] = Form(
        default_factory=list,
        description="Repetir el campo una vez por cuenta, formato 'platform:alias' (ej. 'youtube:canal_1').",
    ),
) -> BatchAcceptedResponse:
    """Igual que POST /videos, pero como formulario — para elegir un archivo de
    imagen y/o de audio directamente ("Choose file" en Swagger) en vez de mandar
    una URL. Fire-and-forget: ver docstring de generate_videos.
    """
    niche_cfg = get_niche_config(category_name)
    publishing = JobPublishingConfig(
        enabled=bool(publishing_accounts),
        accounts=publishing_accounts,
    )
    await _validate_publishing(publishing)
    _check_background_capacity(quantity)
    _validate_recorder_engine_override(niche_cfg, category_name, recorder_engine_override, render_target)

    image_source = await resolve_image_source(niche_cfg, category_name, image_file, image_asset_id)
    music_source = await resolve_music_source(niche_cfg, category_name, music_file, music_asset_id, song_name, artist)
    video_source = await resolve_video_source(category_name, video_file, video_asset_id)

    song_info = None
    if any([song_name, artist, topic, song_description, language]):
        song_info = SongInfo(
            song_name=song_name, artist=artist, topic=topic,
            description=song_description, language=language,
        )

    duration_config = DurationConfig(mode=duration_mode, repeat_count=repeat_count, manual_seconds=manual_seconds)

    logger.info(
        "api_generate_videos_upload",
        category_name=category_name,
        quantity=quantity,
        has_image_file=image_file is not None,
        has_music_file=music_file is not None,
        has_video_file=video_file is not None,
        duration_mode=duration_mode.value,
        repeat_count=repeat_count,
    )

    orchestrator = Orchestrator()
    jobs = orchestrator.build_jobs(
        category_name=category_name,
        quantity=quantity,
        user_context=user_context,
        publishing=publishing,
        image_source=image_source,
        music_source=music_source,
        video_source=video_source,
        song_info=song_info,
        duration_config=duration_config,
        render_target=render_target,
        recorder_engine_override=recorder_engine_override,
    )
    for j in jobs:
        await job_tracker.create(j, niche_cfg)

    _run_batch_in_background(orchestrator, jobs)

    return BatchAcceptedResponse(
        total=len(jobs),
        jobs=[JobAcceptedItem(job_id=j.job_id, category=j.input.category_name, stage=j.stage.value) for j in jobs],
    )


# ── Polling / historial / archivo ─────────────────────────────────────────────

@router.get("/videos/jobs/{job_id}", response_model=JobDetailResponse)
async def get_job(job_id: str) -> JobDetailResponse:
    record = job_tracker.get(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return JobDetailResponse.from_record(record, summary=job_tracker.get_summary(job_id))


@router.get("/videos/jobs", response_model=JobListResponse)
async def list_jobs(stage: str | None = None, limit: int = 20, offset: int = 0) -> JobListResponse:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    records, total = job_tracker.list_jobs(stage=stage, limit=limit, offset=offset)
    return JobListResponse(
        total=total, limit=limit, offset=offset,
        jobs=[JobListItem.from_record(r) for r in records],
    )


@router.get("/videos/jobs/{job_id}/file/{format}")
async def get_job_file(job_id: str, format: str, request: Request) -> Response:
    if format not in job_tracker.FILE_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{format}'. Must be one of {job_tracker.FILE_FORMATS}.",
        )
    record = job_tracker.get(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    file_path_str = record.get("file_paths", {}).get(format)
    if not file_path_str:
        raise HTTPException(
            status_code=404,
            detail=f"File not ready for job '{job_id}' (stage={record['stage']}).",
        )
    path = Path(file_path_str)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)
