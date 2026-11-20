"""Respuesta agregada del catálogo visual de plantillas."""

from pydantic import BaseModel, Field

from src.presentation.api.schemas.explainer_schema import ExplainerVideoResponse, SandboxItemResponse
from src.presentation.api.schemas.template_schema import TemplateResponse


class TemplateCatalogSummary(BaseModel):
    category_count: int
    active_category_count: int
    planned_category_count: int
    empty_category_count: int
    categories_with_items: int
    pipeline_template_count: int
    demo_count: int
    total_card_count: int


class TemplateCatalogSandboxDemo(BaseModel):
    item: SandboxItemResponse
    production_design: bool = False


class TemplateCatalogCategory(BaseModel):
    id: str
    path: str
    display_name: str
    topic: str = ""
    status: str
    engine: str
    template_count: int = 0
    demo_video_count: int = 0
    sandbox_demo_count: int = 0
    total_item_count: int = 0
    templates: list[TemplateResponse] = Field(default_factory=list)
    demo_videos: list[ExplainerVideoResponse] = Field(default_factory=list)
    sandbox_demos: list[TemplateCatalogSandboxDemo] = Field(default_factory=list)


class TemplateCatalogResponse(BaseModel):
    summary: TemplateCatalogSummary
    categories: list[TemplateCatalogCategory] = Field(default_factory=list)
