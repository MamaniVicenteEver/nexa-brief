"""Schemas de /explainer — catálogo, grabación, textos, producción con agente local."""

from __future__ import annotations

from pydantic import BaseModel, Field


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


class RecordExplainerRequest(BaseModel):
    duration: str = Field(
        "10",
        pattern="^(10|20|full)$",
        description="'10' o '20' = preview rápido de N segundos (no se programa ni publica); 'full' = video completo.",
    )
    publish: bool = False
    privacy: str = Field("private", pattern="^(private|unlisted|public)$")
    account_selectors: list[str] = Field(
        default_factory=list,
        description="Varios canales a la vez: ['youtube:canal_1', 'tiktok:alias', 'facebook:pagina'].",
    )
    account_selector: str | None = Field(
        None,
        description="Requerido si publish=true, p. ej. 'youtube:canal_1' o 'tiktok:alias'.",
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


class ExplainerOptionsResponse(BaseModel):
    agents: list[ProviderStatus]
    text_providers: list[ProviderStatus]
    default_agent: str
    default_text_provider: str


class BriefRequest(BaseModel):
    category_path: str
    topic: str = Field(..., min_length=3, max_length=300)
    description: str = Field("", max_length=2000)
    design: str | None = None
    provider: str | None = Field(None, description="claude | codex | deepseek (default: settings)")
    media_names: list[str] = Field(default_factory=list)


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
