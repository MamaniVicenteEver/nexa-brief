"""Pydantic schemas for video generation requests and responses."""

from typing import Literal

from pydantic import BaseModel, Field

from src.config.settings import settings
from src.core.job import DurationConfig, ImageSource, JobPublishingConfig, MusicSource, SongInfo, VideoSource
from src.core import job_tracker
from src.core.progress import JobProgress, get_progress


class VideoGenerationRequest(BaseModel):
    category_name: str = Field(..., description="Name of the musical category")
    quantity: int = Field(default=1, ge=1, le=10, description="Number of videos to generate")
    duration_seconds: int = Field(
        default=settings.video_min_duration_seconds,
        ge=settings.video_min_duration_seconds,
        le=settings.video_max_duration_seconds,
        description="Duration of each video in seconds. Ignorado si se manda duration_config.",
    )
    duration_config: DurationConfig | None = Field(
        default=None,
        description=(
            "Opcional. mode='auto': la duración final = duración real de la canción resuelta × "
            "repeat_count (1-10). mode='manual': duración final = manual_seconds. Si se omite este "
            "campo por completo, se usa duration_seconds tal cual (comportamiento sin cambios)."
        ),
    )
    user_context: str | None = Field(
        default=None,
        max_length=500,
        description=(
            "Optional creative direction for this batch. "
            "Describe the mood, theme, visual idea, or any specific request. "
            "Example: 'Quiero un ambiente más oscuro tipo midnight, con referencias a cafés japoneses y lluvia'"
        ),
    )
    image_source: ImageSource = Field(
        default_factory=ImageSource,
        description=(
            "Cómo resolver la imagen de fondo. type='auto' (default): el sistema busca como siempre. "
            "type='library': reutiliza un asset ya archivado en data/image_library (requiere asset_id). "
            "type='url': descarga directamente de una URL (requiere url), sin buscar."
        ),
    )
    music_source: MusicSource = Field(
        default_factory=MusicSource,
        description="Igual que image_source, pero para la pista de audio (data/music_library).",
    )
    video_source: VideoSource | None = Field(
        default=None,
        description=(
            "Solo para nichos con video de fondo (ej. motion_backdrop_showcase). "
            "type='library' (requiere asset_id) o type='url' (requiere url) — no hay "
            "type='auto', no existe proveedor de stock de video integrado."
        ),
    )
    song_info: SongInfo | None = Field(
        default=None,
        description=(
            "Información que el usuario ya sabe sobre la canción (nombre, de qué trata, artista, "
            "descripción). input_analyzer la recolecta y la usa como hechos autoritativos en vez "
            "de inventarla — solo completa con IA lo que falte."
        ),
    )
    publishing: JobPublishingConfig = Field(default_factory=JobPublishingConfig)
    render_target: Literal["local", "aws"] | None = Field(
        default=None,
        description=(
            "Override del motor de render (Remotion o HyperFrames) para este batch. Solo válido "
            "si el motor efectivo (recorder_engine_override o el del nicho) es 'remotion' o "
            "'hyperframes' — se rechaza con 400 en cualquier otro caso. None usa el default "
            "global del servidor."
        ),
    )
    recorder_engine_override: Literal["remotion", "hyperframes", "playwright"] | None = Field(
        default=None,
        description=(
            "Override del motor de grabación para este batch, en vez del recorder_engine "
            "default del nicho. 'remotion'/'hyperframes' se rechazan con 400 si el nicho todavía "
            "no tiene una composición portada para ese motor. None usa el default del nicho."
        ),
    )


# ── Fire-and-forget: creación (respuesta casi instantánea) ───────────────────

class JobAcceptedItem(BaseModel):
    job_id: str
    category: str
    stage: str  # siempre "pending" en este punto


class BatchAcceptedResponse(BaseModel):
    """Respuesta inmediata de POST /videos y /videos/upload.

    Ya NO es el resultado final del batch — solo confirma que los jobs
    fueron aceptados y arrancaron a correr en background. El estado real se
    consulta con GET /videos/jobs/{job_id}.
    """
    total: int
    jobs: list[JobAcceptedItem]
    status_url_template: str = "/api/v1/videos/jobs/{job_id}"


# ── Polling / historial ───────────────────────────────────────────────────────

_TERMINAL_STAGES = {"packaged", "published", "failed"}
_SUCCESS_STAGES = {"packaged", "published"}


class JobFileInfo(BaseModel):
    format: str  # "youtube" | "reels" | "tiktok" | "thumbnail"
    ready: bool
    url: str | None = None


class JobSummaryInfo(BaseModel):
    """Copia generada por IA (Stage 7) — ver `core.job.VideoSummary`. Se lee
    de `job_tracker.get_summary()`, que a su vez lee `08_resumen_final.json`
    en disco (el índice de job_tracker no guarda estos campos)."""
    youtube_title: str
    youtube_description: str
    youtube_tags: list[str] = []
    tiktok_caption: str = ""
    tiktok_hashtags: list[str] = []
    language: str | None = None     # "es" | "en"; None en jobs anteriores a este campo
    pinned_comment: str = ""
    platform_copies: dict = {}

    @classmethod
    def from_raw(cls, raw: dict) -> "JobSummaryInfo":
        # Explainer jobs store per-platform copy; pipeline jobs store flat fields.
        copies = raw.get("platform_copies") or {}
        youtube = copies.get("youtube") or {}
        tiktok = copies.get("tiktok") or {}
        return cls(
            youtube_title=raw.get("youtube_title") or youtube.get("title", ""),
            youtube_description=raw.get("youtube_description") or youtube.get("description", ""),
            youtube_tags=raw.get("youtube_tags") or youtube.get("tags", []),
            tiktok_caption=raw.get("tiktok_caption") or tiktok.get("description", ""),
            language=raw.get("language") or youtube.get("language"),
            tiktok_hashtags=raw.get("tiktok_hashtags") or tiktok.get("tags", []),
            pinned_comment=raw.get("pinned_comment") or "",
            platform_copies=copies,
        )


class JobDetailResponse(BaseModel):
    job_id: str
    category: str
    title: str
    stage: str
    is_terminal: bool
    is_success: bool
    errors: list[str] = []
    created_at: str
    updated_at: str
    duration_seconds: float | None = None
    # Segundos que tardó en generarse (aceptado → listo/falló); None si sigue en curso.
    generation_seconds: float | None = None
    files: list[JobFileInfo] = []
    # Relaciones de aspecto grabadas ("16x9", "9x16") — para elegir formato al publicar.
    formats: list[str] = []
    summary: JobSummaryInfo | None = None
    # Live progress (queue position, % and ETA) — only for jobs this server
    # process is running or ran recently; also pushed as `job_progress` events.
    progress: JobProgress | None = None

    @classmethod
    def from_record(cls, record: dict, summary: dict | None = None) -> "JobDetailResponse":
        stage = record["stage"]
        job_id = record["job_id"]
        ready_formats = set(record.get("ready_formats", []))
        # Older explainer records saved the vertical file as "instagram".
        if record.get("source") == "explainer" and "instagram" in ready_formats:
            ready_formats.add("reels")
        files = [
            JobFileInfo(
                format=fmt,
                ready=fmt in ready_formats,
                url=f"/api/v1/videos/jobs/{job_id}/file/{fmt}" if fmt in ready_formats else None,
            )
            for fmt in ("youtube", "reels", "tiktok", "thumbnail")
        ]
        return cls(
            job_id=job_id,
            category=record["category"],
            title=record.get("title", record["category"]),
            stage=stage,
            is_terminal=stage in _TERMINAL_STAGES,
            is_success=stage in _SUCCESS_STAGES,
            errors=record.get("errors", []),
            created_at=record["created_at"],
            updated_at=record["updated_at"],
            duration_seconds=record.get("duration_seconds"),
            generation_seconds=job_tracker.generation_seconds(record),
            files=files,
            formats=sorted(job_tracker.format_paths(record)),
            summary=JobSummaryInfo.from_raw(summary) if summary else None,
            progress=get_progress(job_id),
        )


class JobListItem(BaseModel):
    job_id: str
    category: str
    title: str
    stage: str
    is_terminal: bool
    created_at: str
    updated_at: str
    duration_seconds: float | None = None
    generation_seconds: float | None = None

    @classmethod
    def from_record(cls, record: dict) -> "JobListItem":
        stage = record["stage"]
        return cls(
            job_id=record["job_id"],
            category=record["category"],
            title=record.get("title", record["category"]),
            stage=stage,
            is_terminal=stage in _TERMINAL_STAGES,
            created_at=record["created_at"],
            updated_at=record["updated_at"],
            duration_seconds=record.get("duration_seconds"),
            generation_seconds=job_tracker.generation_seconds(record),
        )


class JobListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    jobs: list[JobListItem]


# ── Ficha técnica (pestaña "Info técnica" de Biblioteca) ──────────────────────

class JobTechnicalFile(BaseModel):
    """Un MP4 del job, medido con ffprobe. None = ffprobe no lo informó."""
    key: str                                  # "16x9" | "9x16" | "tiktok" | "instagram"
    file_name: str                            # relativo a la carpeta de salida
    size_mb: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    video_codec: str | None = None
    video_bitrate_kbps: int | None = None
    total_bitrate_kbps: int | None = None
    audio_codec: str | None = None
    audio_bitrate_kbps: int | None = None
    audio_sample_rate_khz: float | None = None
    audio_channels: int | None = None
    duration_seconds: float | None = None


class JobTechnicalResponse(BaseModel):
    """GET /videos/jobs/{job_id}/technical — ver `src.core.job_technical`."""
    job_id: str
    source: Literal["pipeline", "explainer"]
    category: str | None = None
    title: str | None = None
    stage: str | None = None
    template: str | None = None               # template_id (pipeline) o diseño (explainer)
    template_label: str | None = None
    engine: str | None = None                 # hyperframes | remotion | playwright | explainer-kit
    engine_target: str | None = None          # local | aws
    render_seconds: float | None = None
    render_passes: list[str] = []
    duration_seconds: float | None = None
    generation_seconds: float | None = None
    formats: list[str] = []
    files: list[JobTechnicalFile] = []
    language: str | None = None
    # Estrategia de copy por plataforma (pipeline) o por pieza del paquete (explainer).
    strategies: dict[str, str] = {}
    created_at: str | None = None
    updated_at: str | None = None
    output_dir: str | None = None
