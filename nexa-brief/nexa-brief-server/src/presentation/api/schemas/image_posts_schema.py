"""Esquemas HTTP estrictos para el editor de publicaciones de imagen."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.core.image_posts.models import MusicOption, PlanSlide


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)


class PlanCreateRequest(StrictSchema):
    category_id: str
    source_video_id: str
    template_id: Literal["daily_fact", "five_slides"]
    strategy_id: str | None = None
    style_id: str
    seed: int | None = None
    focus_claim_ids: list[str] | None = None


class PlanUpdateRequest(StrictSchema):
    schema_version: Literal[1] = 1
    plan_id: str
    category_id: str
    source_video_id: str
    source_revision: str
    style_id: str
    style_version: str
    template_id: Literal["daily_fact", "five_slides"]
    format: Literal["4:5"] = "4:5"
    slides: list[PlanSlide]
    seed: int
    renderer_version: str
    plan_hash: str | None = None


class RenderRequest(StrictSchema):
    review_required: bool = True


class ReconcileRequest(StrictSchema):
    remote_post_id: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_]+$")


class CopyByNetwork(StrictSchema):
    caption: str = ""
    first_comment: str | None = None
    caption_claim_refs: list[str] = Field(default_factory=list)
    first_comment_claim_refs: list[str] = Field(default_factory=list)


class EditorialCopy(StrictSchema):
    facebook: CopyByNetwork = Field(default_factory=CopyByNetwork)
    instagram: CopyByNetwork = Field(default_factory=CopyByNetwork)
    hashtags: list[str] = Field(default_factory=list)


class EditorialSlidePatch(StrictSchema):
    slide_id: str
    alt_text_fb: str = ""
    alt_text_ig: str = ""


class ImagePostPatchRequest(StrictSchema):
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, max_length=120)
    copy_data: EditorialCopy | None = Field(default=None, alias="copy")
    slides: list[EditorialSlidePatch] | None = None
    music: MusicOption | None = None
    review_required: bool | None = None


class ReviewRequest(StrictSchema):
    revision: int = Field(ge=1)
    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=1000)


class DeliveryTarget(StrictSchema):
    platform: Literal["facebook", "instagram"]
    account_alias: str
    placement: Literal["image", "carousel", "reel"] | None = None
    scheduled_at: datetime | None = None
    slot_id: str | None = None
    timezone: str = "UTC"


class CreateDeliveriesRequest(StrictSchema):
    revision: int = Field(ge=1)
    targets: list[DeliveryTarget] = Field(min_length=1, max_length=4)
    client_request_id: str


class GalleryMetricResponse(StrictSchema):
    snapshot_id: str
    delivery_id: str
    window: str
    observed_at: datetime
    source: str
    status: str
    metrics: dict[str, int | float | None] | None = None
