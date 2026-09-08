"""
Job — the single data object that travels through the entire pipeline.

Each stage reads from `artifacts` (previous results) and writes its own
key back. Stages are never allowed to overwrite another stage's artifact.
"""

from __future__ import annotations

import uuid
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, model_validator


# ── Stage Enum ────────────────────────────────────────────────────────────────

class JobStage(str, Enum):
    PENDING = "pending"
    INPUT_ANALYZED = "input_analyzed"
    DESIGN_COMPLETE = "design_complete"
    RESOURCES_FETCHED = "resources_fetched"
    PROMPT_BUILT = "prompt_built"
    HTML_GENERATED = "html_generated"
    VIDEO_RECORDED = "video_recorded"
    SUMMARY_GENERATED = "summary_generated"
    PACKAGED = "packaged"
    PUBLISHING = "publishing"    # Stage 9 start
    PUBLISHED = "published"     # Stage 9 success
    FAILED = "failed"


class PlatformOptions(BaseModel):
    youtube_playlist_id: str | None = None
    youtube_publish_as_short: bool = False
    facebook_publish_as_reel: bool = True
    tiktok_privacy: str = "private"


class JobPublishingConfig(BaseModel):
    enabled: bool = False
    accounts: list[str] = Field(default_factory=list)
    options: PlatformOptions = Field(default_factory=PlatformOptions)


# ── Asset sources (image/music: auto-search vs. user-provided) ────────────────

class AssetSourceType(str, Enum):
    AUTO = "auto"        # default: resource_fetcher searches as before
    LIBRARY = "library"  # reuse an asset already archived in data/*_library/
    URL = "url"          # download directly from a URL, skip search


class ImageSource(BaseModel):
    type: AssetSourceType = AssetSourceType.AUTO
    asset_id: str | None = None   # required when type == LIBRARY
    url: str | None = None        # required when type == URL
    category: str | None = None   # optional override for the library category

    @model_validator(mode="after")
    def _check_required_fields(self) -> "ImageSource":
        if self.type == AssetSourceType.LIBRARY and not self.asset_id:
            raise ValueError("image_source.asset_id is required when type='library'")
        if self.type == AssetSourceType.URL and not self.url:
            raise ValueError("image_source.url is required when type='url'")
        return self


class MusicSource(BaseModel):
    type: AssetSourceType = AssetSourceType.AUTO
    asset_id: str | None = None   # required when type == LIBRARY
    url: str | None = None        # required when type == URL
    category: str | None = None

    @model_validator(mode="after")
    def _check_required_fields(self) -> "MusicSource":
        if self.type == AssetSourceType.LIBRARY and not self.asset_id:
            raise ValueError("music_source.asset_id is required when type='library'")
        if self.type == AssetSourceType.URL and not self.url:
            raise ValueError("music_source.url is required when type='url'")
        return self


class VideoSource(BaseModel):
    """Fuente del video de fondo — solo para niches con template.requires_video=True
    (ej. motion-backdrop). No existe modo AUTO: no hay proveedor de stock de video
    integrado, a diferencia de imagen/música — hay que darlo por library/url."""
    type: AssetSourceType = AssetSourceType.LIBRARY
    asset_id: str | None = None   # required when type == LIBRARY
    url: str | None = None        # required when type == URL
    category: str | None = None

    @model_validator(mode="after")
    def _check_required_fields(self) -> "VideoSource":
        if self.type == AssetSourceType.AUTO:
            raise ValueError(
                "video_source.type='auto' no está soportado — no hay proveedor de "
                "video de stock integrado. Usar 'library' o 'url'."
            )
        if self.type == AssetSourceType.LIBRARY and not self.asset_id:
            raise ValueError("video_source.asset_id is required when type='library'")
        if self.type == AssetSourceType.URL and not self.url:
            raise ValueError("video_source.url is required when type='url'")
        return self


class SongInfo(BaseModel):
    """Info that the user already knows about the song — collected verbatim
    by input_analyzer (logs/01a_song_info_usuario.json), never invented or
    overwritten by the AI. Gemini in Stage 1a only fills in what's missing."""
    song_name: str | None = None
    artist: str | None = None
    topic: str | None = Field(default=None, description="Qué trata la canción / de qué habla.")
    description: str | None = None
    extra_notes: str | None = None
    language: str | None = Field(
        default=None,
        description=(
            "Código ISO del idioma de la canción (ej. 'es', 'en') — usado por "
            "lyrics_transcriber.py (nichos lyrics_video_*) para la transcripción. "
            "Si se omite, faster-whisper auto-detecta el idioma."
        ),
    )


# ── Duration mode (auto = song duration × repeats, manual = exact seconds) ────

class DurationMode(str, Enum):
    AUTO = "auto"        # duración final = duración real de la canción × repeat_count
    MANUAL = "manual"    # duración final = manual_seconds (exacta)


class DurationConfig(BaseModel):
    """Cuando se omite (default), el pipeline usa JobInput.duration_seconds
    directamente, sin cambios — este campo es 100% opt-in y retrocompatible.

    Resuelto por resource_fetcher (Stage 3) justo después de descargar/resolver
    la música, porque el modo AUTO necesita la duración REAL del archivo — no
    se puede saber antes de tener la canción en disco. El resultado sobreescribe
    job.artifacts.analyzed_input.duration_seconds, que es lo que video_recorder
    y el resto del pipeline usan río abajo.
    """
    mode: DurationMode = DurationMode.MANUAL
    repeat_count: int = Field(
        default=1, ge=1, le=10,
        description="Solo para mode='auto': cuántas veces repetir la canción para calcular la duración total.",
    )
    manual_seconds: int | None = Field(
        default=None, ge=5, le=300,
        description="Solo para mode='manual': duración exacta en segundos. Si se omite, se usa duration_seconds.",
    )


# ── Input ─────────────────────────────────────────────────────────────────────

class JobInput(BaseModel):
    category_name: str
    quantity: int = Field(default=1, ge=1, le=100)
    duration_seconds: int = Field(default=60, ge=60, le=300)
    user_context: str | None = Field(
        default=None,
        max_length=500,
        description="Optional creative direction: describe the mood, theme, or specific ideas for this video.",
    )
    duration_config: DurationConfig | None = Field(
        default=None,
        description=(
            "Opcional. Si se omite, se usa duration_seconds tal cual (comportamiento actual). "
            "mode='auto': duración = duración real de la canción resuelta × repeat_count. "
            "mode='manual': duración = manual_seconds."
        ),
    )
    image_source: ImageSource = Field(default_factory=ImageSource)
    music_source: MusicSource = Field(default_factory=MusicSource)
    video_source: VideoSource | None = None
    song_info: SongInfo | None = None
    publishing: JobPublishingConfig = Field(default_factory=JobPublishingConfig)
    render_target: str | None = Field(
        default=None,
        description=(
            "Override por job del motor de render de Remotion ('local'/'aws'). "
            "Solo aplica a nichos con recorder_engine='remotion'; None usa el default "
            "global de settings.remotion_render_target. Ignorado por PlaywrightFFmpegAdapter."
        ),
    )
    recorder_engine_override: str | None = Field(
        default=None,
        description=(
            "Override por job de qué recorder usar ('remotion'/'playwright') en vez del "
            "recorder_engine default del niche. None = usa el default del niche. Validado "
            "contra remotion_adapter.supports_niche() en el router antes de aceptar el job."
        ),
    )


# ── Stage Artifacts (validated with Pydantic) ─────────────────────────────────

class AnalyzedInput(BaseModel):
    genre: str
    mood_tags: list[str]
    image_query: str
    description: str
    duration_seconds: int
    category_name: str


class SearchQueries(BaseModel):
    """Queries generados por la IA en input_analyzer a partir de search_instructions del nicho.

    image_queries: 4 queries de búsqueda de imágenes (Unsplash/Pexels), variados.
    music_queries: 4 términos de búsqueda de música (Jamendo/Pixabay), variados.
    """
    image_queries: list[str] = Field(default_factory=list)
    music_queries: list[str] = Field(default_factory=list)


class VisualDesign(BaseModel):
    genre: str
    style: str
    colors: list[str] = Field(min_length=2, max_length=4)
    fonts: list[str] = Field(min_length=1, max_length=2)
    animation: str
    background_style: str


class VideoSummary(BaseModel):
    youtube_title: str
    youtube_description: str
    youtube_tags: list[str]
    tiktok_caption: str
    tiktok_hashtags: list[str]


# ── Stage 9 — Publish Result ─────────────────────────────────────────────────

class PublishResult(BaseModel):
    """Outcome of a successful social-media publish operation (Stage 9)."""
    platform: str                   # 'tiktok' | 'youtube' | 'facebook'
    account_alias: str              # e.g. 'cuenta_1', 'canal_2'
    post_id: str                    # Platform-assigned video/post ID
    url: str                        # Public URL to the published video
    published_at: float             # Unix timestamp of successful publish
    publish_duration_seconds: float = 0.0  # Wall-clock time of the upload


class JobArtifacts(BaseModel):
    """Immutable bag of artifacts. Each stage adds its own key."""
    analyzed_input: AnalyzedInput | None = None
    search_queries: SearchQueries | None = None   # generado por input_analyzer si niche tiene search_instructions
    visual_design: VisualDesign | None = None      # None en niches pipeline_type="config_driven_template"
    image_path: Path | None = None
    image_meta: dict[str, Any] = Field(default_factory=dict)
    image_asset_id: str | None = None              # asset_id resuelto/archivado en data/image_library/
    music_path: Path | None = None
    music_meta: dict[str, Any] = Field(default_factory=dict)
    music_asset_id: str | None = None               # asset_id resuelto/archivado en data/music_library/
    video_path: Path | None = None                  # solo niches con template.requires_video=True
    video_meta: dict[str, Any] = Field(default_factory=dict)
    video_asset_id: str | None = None                # asset_id resuelto/archivado en data/video_library/
    # Config-driven pipeline only (Prompt 1 / Prompt 2 — ver src/templates/01-image-bg/)
    vision_analysis: dict[str, Any] | None = None   # JSON crudo del Vision Extractor (Prompt 1)
    lyrics_json: dict[str, Any] | None = None       # niches lyrics_video_* — ver lyrics_transcriber.py
    template_config: dict[str, Any] | None = None    # == contenido de config.json (Prompt 2)
    config_json_path: Path | None = None
    prompt_text: str | None = None
    html_path: Path | None = None
    youtube_video_path: Path | None = None
    tiktok_video_path: Path | None = None   # 9:16 clip 61s (TikTok)
    reels_video_path: Path | None = None    # 9:16 duración completa (Reels/Shorts)
    thumbnail_path: Path | None = None
    summary: VideoSummary | None = None
    output_dir: Path | None = None
    recording_stats: dict[str, Any] = Field(default_factory=dict)
    # Stage 9 — populated only when ENABLE_AUTO_PUBLISHING=true
    publish_result: PublishResult | None = None
    publish_results: dict[str, PublishResult] = Field(default_factory=dict)

    model_config = {"arbitrary_types_allowed": True}


# ── Job ───────────────────────────────────────────────────────────────────────

class Job(BaseModel):
    job_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    input: JobInput
    stage: JobStage = JobStage.PENDING
    artifacts: JobArtifacts = Field(default_factory=JobArtifacts)
    errors: list[str] = Field(default_factory=list)

    model_config = {"arbitrary_types_allowed": True}

    def advance(self, stage: JobStage) -> "Job":
        """Return a new Job with the updated stage (immutable update pattern)."""
        return self.model_copy(update={"stage": stage})

    def fail(self, reason: str) -> "Job":
        """Mark job as failed and record the reason."""
        return self.model_copy(
            update={
                "stage": JobStage.FAILED,
                "errors": [*self.errors, reason],
            }
        )
