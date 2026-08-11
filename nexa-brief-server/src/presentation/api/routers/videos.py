"""Videos router — POST /videos triggers a batch generation job."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from src.config.exceptions import AssetNotFoundError
from src.config.niche_config import get_niche_config
from src.core.job import (
    AssetSourceType,
    DurationConfig,
    DurationMode,
    ImageSource,
    MusicSource,
    SongInfo,
    VideoSource,
)
from src.core.library import asset_library
from src.core.orchestrator import Orchestrator
from src.presentation.api.schemas.video_schema import (
    BatchResponse,
    JobStatusResponse,
    VideoGenerationRequest,
)

router = APIRouter(tags=["videos"])
logger = structlog.get_logger(__name__)


@router.post("/videos", response_model=BatchResponse, status_code=202)
async def generate_videos(request: VideoGenerationRequest) -> BatchResponse:
    """Trigger a batch of video generation jobs.

    Returns 202 with the full result once all jobs complete.
    `elapsed_seconds` in the response shows the total wall-clock time for auditing.
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

    if request.publishing.enabled:
        from src.adapters.publishing.factory import get_publisher_facade
        try:
            facade = get_publisher_facade()
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Publisher is not configured: {exc}. Check accounts.json and encryption key.",
            )
        
        for account in request.publishing.accounts:
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

    try:
        orchestrator = Orchestrator()
        result = await orchestrator.run_batch(
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
        )
    except Exception as exc:
        logger.exception("api_generate_videos_error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return BatchResponse(
        total=result.total,
        succeeded=result.success_count,
        failed=result.failure_count,
        elapsed_seconds=result.elapsed_seconds,
        jobs=[
            JobStatusResponse(
                job_id=j.job_id,
                stage=j.stage,
                category=j.input.category_name,
                output_dir=str(j.artifacts.output_dir) if j.artifacts.output_dir else None,
                errors=j.errors,
            )
            for j in result.succeeded + result.failed
        ],
    )


# ── Variante multipart/form-data — botones reales de "Choose file" en Swagger ──

async def _save_upload_to_temp(upload: UploadFile, default_suffix: str) -> Path:
    """Guarda un UploadFile en un archivo temporal y devuelve su ruta.

    El caller es responsable de borrar tmp_path.parent cuando termine
    (asset_library.register_image/register_music copian el archivo, no lo mueven).
    """
    suffix = Path(upload.filename).suffix if upload.filename else ""
    tmp_dir = Path(tempfile.mkdtemp(prefix="nb_upload_"))
    dest = tmp_dir / f"upload{suffix or default_suffix}"
    dest.write_bytes(await upload.read())
    return dest


def _clean_filename_label(filename: str | None) -> str:
    """Convierte un nombre de archivo subido en una etiqueta legible de respaldo.

    Ej. "Midnight_Blade-DarkComposer.mp3" -> "Midnight Blade DarkComposer".
    Se usa SOLO cuando no vino un nombre explícito (song_name / label) — el
    nombre de archivo real suele ser más útil que dejar el campo vacío.
    """
    if not filename:
        return ""
    stem = Path(filename).stem
    return " ".join(stem.replace("_", " ").replace("-", " ").split())


@router.post("/videos/upload", response_model=BatchResponse, status_code=202)
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
    manual_seconds: int | None = Form(default=None, ge=60, le=300, description="Solo si duration_mode='manual'."),
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
) -> BatchResponse:
    """Igual que POST /videos, pero como formulario — para elegir un archivo de
    imagen y/o de audio directamente ("Choose file" en Swagger) en vez de mandar
    una URL. Publicación siempre desactivada acá; usar POST /videos con
    `publishing` si hace falta publicar automáticamente.
    """
    niche_cfg = get_niche_config(category_name)

    image_source = ImageSource()
    if image_file is not None:
        tmp_path = await _save_upload_to_temp(image_file, ".jpg")
        try:
            category = niche_cfg.image.library_category or category_name
            entry = await asset_library.register_image(
                tmp_path, category=category, source="upload", provider="user_upload",
                # Respaldo débil hasta que visual_designer lo reemplace con la
                # descripción real del Vision Extractor (solo nichos config-driven).
                label=_clean_filename_label(image_file.filename),
            )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        image_source = ImageSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    music_source = MusicSource()
    if music_file is not None:
        resolved_track_name = song_name or _clean_filename_label(music_file.filename)
        # Si ya existe una canción archivada con este mismo nombre (+ artista, si
        # se dio), reusar esa entrada en vez de duplicar el archivo — clave para
        # nichos de letras: evita re-transcribir una canción que ya se procesó
        # antes (ver asset_library.find_music_by_name / lyrics_transcriber.py).
        existing = asset_library.find_music_by_name(resolved_track_name, artist)
        if existing is not None:
            await asset_library.touch_usage(existing.asset_id, "music")
            music_source = MusicSource(type=AssetSourceType.LIBRARY, asset_id=existing.asset_id)
        else:
            tmp_path = await _save_upload_to_temp(music_file, ".mp3")
            try:
                category = niche_cfg.audio.library_category or category_name
                entry = await asset_library.register_music(
                    tmp_path, category=category, source="upload", provider="user_upload",
                    # song_name/artist del form son la fuente más confiable (el usuario los
                    # escribió a propósito); si no vinieron, el nombre del archivo subido.
                    track_name=resolved_track_name,
                    artist=artist or "",
                )
            finally:
                shutil.rmtree(tmp_path.parent, ignore_errors=True)
            music_source = MusicSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    video_source = None
    if video_file is not None:
        tmp_path = await _save_upload_to_temp(video_file, ".mp4")
        try:
            entry = await asset_library.register_video(
                tmp_path, category=category_name, source="upload", provider="user_upload",
                label=_clean_filename_label(video_file.filename),
            )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        video_source = VideoSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

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

    try:
        orchestrator = Orchestrator()
        result = await orchestrator.run_batch(
            category_name=category_name,
            quantity=quantity,
            user_context=user_context,
            image_source=image_source,
            music_source=music_source,
            video_source=video_source,
            song_info=song_info,
            duration_config=duration_config,
        )
    except Exception as exc:
        logger.exception("api_generate_videos_upload_error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return BatchResponse(
        total=result.total,
        succeeded=result.success_count,
        failed=result.failure_count,
        elapsed_seconds=result.elapsed_seconds,
        jobs=[
            JobStatusResponse(
                job_id=j.job_id,
                stage=j.stage,
                category=j.input.category_name,
                output_dir=str(j.artifacts.output_dir) if j.artifacts.output_dir else None,
                errors=j.errors,
            )
            for j in result.succeeded + result.failed
        ],
    )
