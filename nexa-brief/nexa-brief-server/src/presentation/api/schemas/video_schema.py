"""Pydantic schemas for video generation requests and responses."""

from typing import Literal

from pydantic import BaseModel, Field

from src.config.settings import settings


from src.core.job import DurationConfig, ImageSource, JobPublishingConfig, MusicSource, SongInfo, VideoSource


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

    @classmethod
    def from_raw(cls, raw: dict) -> "JobSummaryInfo":
        return cls(
            youtube_title=raw["youtube_title"],
            youtube_description=raw["youtube_description"],
            youtube_tags=raw.get("youtube_tags", []),
            tiktok_caption=raw.get("tiktok_caption", ""),
            tiktok_hashtags=raw.get("tiktok_hashtags", []),
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
    files: list[JobFileInfo] = []
    summary: JobSummaryInfo | None = None

    @classmethod
    def from_record(cls, record: dict, summary: dict | None = None) -> "JobDetailResponse":
        stage = record["stage"]
        job_id = record["job_id"]
        ready_formats = set(record.get("ready_formats", []))
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
            files=files,
            summary=JobSummaryInfo.from_raw(summary) if summary else None,
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
        )


class JobListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    jobs: list[JobListItem]
