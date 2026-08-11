"""Pydantic schemas for video generation requests and responses."""

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


class JobStatusResponse(BaseModel):
    job_id: str
    stage: str
    category: str
    output_dir: str | None = None
    errors: list[str] = []


class BatchResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    elapsed_seconds: float = Field(description="Total wall-clock time for the entire batch")
    jobs: list[JobStatusResponse]
