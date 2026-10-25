"""Schemas de /explainer — catálogo, grabación, textos, producción con agente local."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from src.core.explainer.publishing import PublishPackage


class ExplainerJobResponse(BaseModel):
    job_id: str
    video_id: str
    state: str
    category_path: str
    duration: str
    publish: bool
    privacy: str
    account_selector: str | None = None
    account_selectors: list[str] = Field(default_factory=list)
    scheduled_job_id: str | None = None
    error: str | None = None
    outputs: list[str] = Field(default_factory=list)
    output_dir: str | None = None
    publish_result: dict | None = None
    publish_results: list[dict] = Field(default_factory=list)
    formats: list[str] = Field(default_factory=list)
    render_seconds: float | None = None
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    progress_format: str | None = None
    progress_phase: Literal["capturing", "encoding"] | None = None
    started_at: datetime | None = None
    eta_seconds: int | None = None
    title: str | None = None
    poster_url: str | None = None


class PublishIssueResponse(BaseModel):
    level: Literal["error", "warning"]
    field: str
    message: str


class PublishPackageResponse(BaseModel):
    """publish.json v2 (src/core/explainer/publishing) y lo que falta corregir antes de publicar."""

    # None si el archivo no se pudo leer: el motivo va en `issues`.
    package: PublishPackage | None = None
    issues: list[PublishIssueResponse] = Field(default_factory=list)
    thumbnail_image_url: str | None = None
    # Nombre de cada estrategia de gancho ("4" → "Casi no pasa"), de la estrategia de títulos activa.
    hook_strategy_names: dict[str, str] = Field(default_factory=dict)
    # Largo máximo de un título de YouTube según la estrategia activa.
    title_max_chars: int | None = None


class ThumbnailOptionResponse(BaseModel):
    option: Literal["A", "B"]
    component: str                 # <diseño>.introv1 (A, solo texto) / <diseño>.introv2 (B, texto + foto)
    # params del componente tal como abren el video (mismos que la captura): la web los usa para la vista previa
    params: dict = Field(default_factory=dict)
    url: str | None = None         # captura render/thumbnail-<opción>.jpg (None = todavía no se capturó)


class ThumbnailsResponse(BaseModel):
    """Miniaturas de YouTube: capturas de la intro del diseño. Vacío si el diseño no tiene intros."""

    chosen: Literal["A", "B"] | None = None
    options: list[ThumbnailOptionResponse] = Field(default_factory=list)


class ThumbnailChoiceRequest(BaseModel):
    option: Literal["A", "B"]


class ExplainerVideoResponse(BaseModel):
    video_id: str
    design: str
    category_id: str
    category_name: str
    category_path: str
    title: str
    topic: str = ""
    status: str
    ready: bool
    publish_ready: bool
    rendered: list[str] = Field(default_factory=list)
    duration_seconds: float | None = None
    youtube_title: str = ""
    youtube_description: str = ""
    youtube_tags: list[str] = Field(default_factory=list)
    facebook_title: str = ""
    facebook_description: str = ""
    tiktok_caption: str = ""
    tiktok_hashtags: list[str] = Field(default_factory=list)
    design_name: str = ""
    demo: bool = False
    preview_url: str
    poster_url: str | None = None
    last_job: ExplainerJobResponse | None = None
    # Solo en videos con paquete de publicación v2.
    publish_package: PublishPackageResponse | None = None
    thumbnails: ThumbnailsResponse = Field(default_factory=ThumbnailsResponse)


class SandboxItemResponse(BaseModel):
    id: str
    folder: str
    subcategory: str | None = None
    path: str
    kind: Literal[
        "explainer_kit",
        "nodeaction",
        "mapas",
        "pizarra",
        "proto",
        "hyperframes",
        "reference",
        "other",
    ]
    title: str
    status: str | None = None
    design: str | None = None
    has_index: bool
    has_poster: bool
    has_info: bool = False
    total_tokens: int | None = None
    thumbnail_url: str | None = None
    player: Literal["protocol", "video", "none"] = "none"
    videos: list[str] = Field(default_factory=list)
    notes_file: str | None = None
    updated_at: str | None = None
    promotable: bool = False
    promote_blocker: str | None = None


class SandboxPromotionResponse(BaseModel):
    video_id: str
    from_path: str
    to_path: str
    category_path: str


class SandboxFolderResponse(BaseModel):
    folder: str
    label: str
    role: Literal["projects", "references"] = "projects"
    category_id: str | None = None
    items: list[SandboxItemResponse] = Field(default_factory=list)


class SandboxModelUsageResponse(BaseModel):
    provider: str
    model: str
    input_tokens: int
    cached_input_tokens: int
    fresh_input_tokens: int
    output_tokens: int
    reasoning_tokens: int
    total_tokens: int


class SandboxBaselineResponse(BaseModel):
    id: str
    total_tokens: int


class SandboxForecastResponse(BaseModel):
    min: float
    max: float
    basis: str


class SandboxInfoResponse(BaseModel):
    info: dict | None = None
    totals_by_model: list[SandboxModelUsageResponse] = Field(default_factory=list)
    fresh_input_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    estimated: bool = False
    baseline: SandboxBaselineResponse | None = None
    ratio_vs_baseline: float | None = None
    forecast_next: SandboxForecastResponse | None = None
    verdict: Literal["eficiente", "aceptable", "caro"] | None = None


class RecordExplainerRequest(BaseModel):
    duration: str = Field(
        "10",
        pattern="^(10|20|full)$",
        description="'10' o '20' = preview rápido de N segundos (no se programa ni publica); 'full' = video completo.",
    )
    publish: bool = False
    privacy: str = Field("private", pattern="^(private|unlisted|public)$")
    formats: list[Literal["16x9", "9x16"]] = Field(
        default_factory=lambda: ["16x9"],
        min_length=1,
        description="Qué grabar: '16x9' (desktop) y/o '9x16' (móvil). Publicar agrega el que exija cada red.",
    )
    account_selectors: list[str] = Field(
        default_factory=list,
        description="Varios canales a la vez: ['youtube:canal_1', 'tiktok:alias', 'facebook:pagina'].",
    )
    account_formats: dict[str, list[Literal["16x9", "9x16"]]] | None = Field(
        default=None, description="Formatos elegidos por destino de publicación."
    )
    account_selector: str | None = Field(
        None,
        description="Requerido si publish=true, p. ej. 'youtube:canal_1' o 'tiktok:alias'.",
    )
    thumbnail: Literal["A", "B"] | None = Field(
        None,
        description="Miniatura elegida: 'A' (introv1, solo texto) o 'B' (introv2, texto + foto). None = la guardada.",
    )


class DesignResponse(BaseModel):
    design_id: str
    name: str
    tagline: str
    topics: list[str] = Field(default_factory=list)
    voice: str = ""
    category_path: str | None = None
    preview_url: str | None = None
    poster_url: str | None = None
    # MP4 grabados del video demo (para vistas livianas como el catálogo de la landing).
    video_url: str | None = None
    video_portrait_url: str | None = None


class DesignGroupResponse(BaseModel):
    category_path: str
    category_name: str
    designs: list[DesignResponse]


class CategoryDesignsResponse(BaseModel):
    category_path: str
    shared: bool = Field(description="True si la categoría no tiene diseños propios y usa los del kit")
    designs: list[DesignResponse]


class ProviderStatus(BaseModel):
    name: str
    available: bool


class LengthPresetResponse(BaseModel):
    minutes: int
    id: str
    label: str


class LengthOptionsResponse(BaseModel):
    """Duración de los videos (explainer-kit/lengths.json)."""

    presets: list[LengthPresetResponse]
    default_minutes: int
    min_minutes: int
    max_minutes: int


class ExplainerOptionsResponse(BaseModel):
    agents: list[ProviderStatus]
    text_providers: list[ProviderStatus]
    default_agent: str
    default_text_provider: str
    lengths: LengthOptionsResponse


class BriefRequest(BaseModel):
    category_path: str
    topic: str = Field(..., min_length=3, max_length=300)
    description: str = Field("", max_length=2000)
    design: str | None = None
    provider: str | None = Field(None, description="claude | codex | deepseek (default: settings)")
    media_names: list[str] = Field(default_factory=list)
    minutes: float | None = Field(None, ge=5, le=60, description="Duración objetivo (default: lengths.json)")


class PublishTextsRequest(BaseModel):
    provider: str | None = None
    overwrite: bool = False


class PublishTextsResponse(BaseModel):
    video_id: str
    written: bool
    brief: dict


class ProductionRequest(BaseModel):
    """Campo `payload` (JSON) del multipart de POST /explainer/productions."""

    category_path: str
    design: str
    topic: str = Field(..., min_length=3, max_length=300)
    description: str = Field("", max_length=2000)
    agent: str | None = None
    brief: dict | None = None
    auto_record: bool = False
    plan_item_id: str | None = None
    minutes: float | None = Field(None, ge=5, le=60, description="Duración objetivo (default: lengths.json)")


class ProductionResponse(BaseModel):
    production_id: str
    video_id: str
    category_path: str
    design: str
    topic: str
    description: str = ""
    agent: str
    auto_record: bool = False
    state: str
    error: str | None = None
    video_status: str | None = None
    record_job_id: str | None = None
    media: list[str] = Field(default_factory=list)
    brief: dict | None = None
    agent_report: str | None = None
    plan_item_id: str | None = None
    created_at: str
    updated_at: str
    log_tail: str | None = None
