"""DTO estrictos del dominio de publicaciones de imagen."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", validate_assignment=True, populate_by_name=True, serialize_by_alias=True
    )


class PostStatus(str, Enum):
    DRAFT = "draft"
    RENDERING = "rendering"
    RENDERED = "rendered"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REMOVED = "removed"
    REMOVAL_PENDING_MANUAL = "removal_pending_manual"


class DeliveryStatus(str, Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED_RETRYABLE = "failed_retryable"
    FAILED_PERMANENT = "failed_permanent"
    OUTCOME_UNKNOWN = "outcome_unknown"
    CANCELLED = "cancelled"
    REMOVED_API = "removed_api"
    REMOVED_MANUALLY = "removed_manually"
    REMOVED = "removed"
    REMOVAL_PENDING_MANUAL = "removal_pending_manual"


class RemoteState(StrictModel):
    photo_ids: list[str] = Field(default_factory=list)
    child_container_ids: list[str] = Field(default_factory=list)
    parent_container_id: str | None = None
    post_id: str | None = None
    permalink: str | None = None
    comment_id: str | None = None


class DeliveryError(StrictModel):
    code: str = Field(min_length=1, max_length=80)
    message: str = Field(max_length=500)


class Delivery(StrictModel):
    delivery_id: str
    revision: int = Field(ge=1)
    platform: Literal["facebook", "instagram"]
    account_alias: str
    target_id: str
    placement: Literal["image", "carousel", "reel"]
    scheduled_at: datetime | None = None
    timezone: str = "UTC"
    slot_id: str | None = None
    idempotency_key: str
    status: DeliveryStatus = DeliveryStatus.DRAFT
    attempt_count: int = Field(default=0, ge=0)
    next_attempt_at: datetime | None = None
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    first_comment: str | None = None
    comment_status: Literal[
        "not_requested", "pending", "published", "skipped_permission", "failed"
    ] = "not_requested"
    alt_text_sent: list[str | None] = Field(default_factory=list)
    remote: RemoteState = Field(default_factory=RemoteState)
    last_error: DeliveryError | None = None
    lease_until: datetime | None = None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None
    removed_at: datetime | None = None
    removal_requested_at: datetime | None = None
    removal_reason: str | None = None
    removal_instruction: str | None = None
    removal_graph_response: dict[str, Any] | None = None

    @field_validator("scheduled_at", "next_attempt_at", "lease_until", "created_at", "updated_at", "published_at", "removed_at", "removal_requested_at")
    @classmethod
    def delivery_timestamps_are_utc(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value)):
            raise ValueError("Delivery timestamps must use UTC")
        return value


class RenderedSlide(StrictModel):
    slide_id: str
    order: int = Field(ge=1)
    asset_id: str
    storage_key: str
    mime: Literal["image/jpeg"] = "image/jpeg"
    format: Literal["JPEG"] = "JPEG"
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    aspect_ratio: str = "4:5"
    bytes: int = Field(ge=0)
    color_profile: str = "sRGB"
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    rendered_at: datetime

    @field_validator("storage_key")
    @classmethod
    def slide_key_is_logical(cls, value: str) -> str:
        if (
            value.startswith("/") or ".." in value.split("/") or "\\" in value
            or value == "[ruta local omitida]"
        ):
            raise ValueError("storage_key debe ser un identificador lógico")
        return value

    @field_validator("rendered_at")
    @classmethod
    def rendered_at_is_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("rendered_at must use UTC")
        return value


class ValidationDetails(StrictModel):
    max_bytes: int | None = Field(default=None, ge=0)
    overflow: bool | None = None
    contrast: bool | None = None
    readability: bool | None = None
    claim_count: int | None = Field(default=None, ge=0)
    source_count: int | None = Field(default=None, ge=0)
    license_count: int | None = Field(default=None, ge=0)


class ValidationResult(StrictModel):
    name: str
    version: str
    passed: bool
    checked_at: datetime
    details: ValidationDetails = Field(default_factory=lambda: ValidationDetails())

    @field_validator("checked_at")
    @classmethod
    def checked_at_is_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("checked_at must use UTC")
        return value


class PlanClaimRef(StrictModel):
    id: str
    source_id: str
    locator: str
    url: str

    @field_validator("url")
    @classmethod
    def source_url_is_https(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("La fuente debe usar HTTPS")
        return value


class PlanMediaRef(StrictModel):
    asset_id: str
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    license_id: str
    license_url: str | None = None
    author: str
    url: str
    changes: str | None = None
    focus: tuple[float, float] = (0.5, 0.5)

    @field_validator("url")
    @classmethod
    def media_url_is_https(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("El medio debe usar HTTPS")
        return value

    @field_validator("license_url")
    @classmethod
    def license_url_is_https(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith("https://"):
            raise ValueError("La URL de licencia debe usar HTTPS")
        return value


class PlanElement(StrictModel):
    type: str
    asset_id: str | None = None
    value: str | None = None


class PlanText(StrictModel):
    role: str
    value: str
    claim_refs: list[str]


class PlanSlide(StrictModel):
    slide_id: str
    order: int = Field(ge=1)
    layout: str
    elements: list[PlanElement]
    texts: list[PlanText]
    media: list[PlanMediaRef]
    claim_refs: list[PlanClaimRef]


class CompositionPlan(StrictModel):
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
    plan_hash: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class RenderInfo(StrictModel):
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_seconds: float | None = Field(default=None, ge=0)
    engine: str | None = None
    engine_version: str | None = None
    renderer_version: str | None = None


class MusicLicense(StrictModel):
    spdx_or_name: str | None = None
    url: str | None = None
    author: str | None = None
    track_url: str | None = None
    attribution: str | None = None
    proof_ref: str | None = None


class MusicOption(StrictModel):
    mode: Literal["none", "convert_to_reel"] = "none"
    music_asset_id: str | None = None
    source_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    license: MusicLicense | None = None
    trim_start_sec: float | None = Field(default=None, ge=0)
    duration_sec: float | None = Field(default=None, ge=0)
    gain_db: float | None = None
    selection: Literal["manual", "auto_licensed"] | None = None


class ReelManifest(StrictModel):
    asset_id: str | None = None
    storage_key: str
    mime: Literal["video/mp4"] = "video/mp4"
    format: Literal["MP4"] = "MP4"
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    duration_sec: float = Field(gt=0)
    fps: int | None = Field(default=None, ge=1)
    codec: Literal["h264"] | None = None
    audio_codec: Literal["aac"] | None = None
    bytes: int | None = Field(default=None, ge=0)
    sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    rendered_at: datetime | None = None

    @field_validator("storage_key")
    @classmethod
    def reel_key_is_logical(cls, value: str) -> str:
        if (
            value.startswith("/") or ".." in value.split("/") or "\\" in value
            or value == "[ruta local omitida]"
        ):
            raise ValueError("storage_key debe ser un identificador lógico")
        return value


class AIUsage(StrictModel):
    role: str | None = None
    provider: str | None = None
    model: str | None = None
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    cached_input_tokens: int | None = Field(default=None, ge=0)
    reasoning_tokens: int | None = Field(default=None, ge=0)
    seconds: float | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    cost_usd: float | None = Field(default=None, ge=0)
    call_id: str | None = None
    used_at: datetime | None = None


class TechnicalRecord(StrictModel):
    kind: Literal["image", "carousel", "story", "reel"]
    source_kind: Literal["image", "carousel"] | None = None
    template_id: str
    copy_sources: dict[str, str] = Field(default_factory=dict)
    slides: list[RenderedSlide] = Field(default_factory=list)
    reel: ReelManifest | None = None
    composition_plan: CompositionPlan
    render: RenderInfo = Field(default_factory=RenderInfo)
    music: MusicOption = Field(default_factory=MusicOption)
    ai_usage: list[AIUsage] = Field(default_factory=list)
    validations: list[ValidationResult] = Field(default_factory=list)


class EditorialSlide(StrictModel):
    slide_id: str
    alt_text_fb: str = ""
    alt_text_ig: str = ""
    claim_refs: list[str] = Field(default_factory=list)


class EditorialReview(StrictModel):
    required: bool = True
    approved_at: datetime | None = None
    approval_source: Literal["human", "automatic"] | None = None
    reviewer_id: str | None = None
    note: str | None = None


class SourceReference(StrictModel):
    source_id: str
    claim_ids: list[str] = Field(default_factory=list)
    title: str = ""
    url: str | None = None
    locator: str | None = None
    verified_at: datetime | None = None


class MetricValues(StrictModel):
    reach: int | None = Field(default=None, ge=0)
    impressions: int | None = Field(default=None, ge=0)
    likes: int | None = Field(default=None, ge=0)
    comments: int | None = Field(default=None, ge=0)
    shares: int | None = Field(default=None, ge=0)
    saves: int | None = Field(default=None, ge=0)
    plays: int | None = Field(default=None, ge=0)


class NetworkCopy(StrictModel):
    caption: str = ""
    first_comment: str | None = None
    caption_claim_refs: list[str] = Field(default_factory=list)
    first_comment_claim_refs: list[str] = Field(default_factory=list)


class PostCopy(StrictModel):
    facebook: NetworkCopy = Field(default_factory=NetworkCopy)
    instagram: NetworkCopy = Field(default_factory=NetworkCopy)
    hashtags: list[str] = Field(default_factory=list)


class EditorialRecord(StrictModel):
    category_id: str
    strategy_id: str | None = None
    topic: str = ""
    title: str = ""
    source_video_id: str
    source_video_url: str | None = None
    sources: list[SourceReference] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    slides: list[EditorialSlide] = Field(default_factory=list)
    copy_data: PostCopy = Field(default_factory=PostCopy, alias="copy")
    review: EditorialReview = Field(default_factory=EditorialReview)


class MetricsSnapshot(StrictModel):
    snapshot_id: str
    delivery_id: str
    window: str
    observed_at: datetime
    source: str
    status: str
    metrics: MetricValues | None = None

    @field_validator("observed_at")
    @classmethod
    def observed_at_is_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("observed_at must use UTC")
        return value


class PublicationRecord(StrictModel):
    schema_version: Literal[2] = 2
    publication_id: str
    post_id: str
    revision: int = Field(ge=1)
    record_version: int = Field(default=1, ge=1)
    supersedes_publication_id: str | None = None
    created_at: datetime
    updated_at: datetime
    status: PostStatus = PostStatus.DRAFT
    technical: TechnicalRecord
    editorial: EditorialRecord
    deliveries: list[Delivery] = Field(default_factory=list)
    metrics_snapshots: list[MetricsSnapshot] = Field(default_factory=list)

    @field_validator("created_at", "updated_at")
    @classmethod
    def timestamps_are_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("Publication timestamps must include UTC timezone")
        return value


class DeliverySummary(StrictModel):
    delivery_id: str
    platform: Literal["facebook", "instagram"]
    account_alias: str
    placement: Literal["image", "carousel", "reel"]
    status: str
    published_at: datetime | None = None
    permalink: str | None = None
    metrics_48h: MetricValues | None = None
    metrics_7d: MetricValues | None = None


class PublicationSummary(StrictModel):
    publication_id: str
    record_key: str
    record_version: int
    category_id: str
    kind: str
    template_id: str
    strategy_id: str | None = None
    status: str
    created_at: datetime
    latest_published_at: datetime | None = None
    title: str
    cover_key: str | None = None
    delivery_summaries: list[DeliverySummary] = Field(default_factory=list)
    updated_at: datetime


def migrate_publication_record(value: Any) -> Any:
    """Upgrade archived v1 records with the metadata added in schema v2."""
    if not isinstance(value, dict) or value.get("schema_version") != 1:
        return value

    upgraded = dict(value)
    technical = dict(upgraded.get("technical") or {})
    editorial = dict(upgraded.get("editorial") or {})
    technical.setdefault("copy_sources", {})
    editorial.setdefault("strategy_id", None)
    upgraded["technical"] = technical
    upgraded["editorial"] = editorial
    upgraded["schema_version"] = 2
    return upgraded


class DeliverySpec(StrictModel):
    publication_id: str
    delivery_id: str
    revision: int
    platform: Literal["facebook", "instagram"]
    account_alias: str
    target_id: str
    placement: Literal["image", "carousel", "reel"]
    idempotency_key: str
    caption: str
    hashtags: list[str]
    first_comment: str | None = None
    media_keys: list[str]
    media_sha256: list[str] = Field(default_factory=list)
    alt_text: list[str]
    comment_allowed: bool = False
    expected_at: datetime | None = None
    expected_duration_sec: float | None = Field(default=None, gt=0)


class RemoteResult(StrictModel):
    photo_ids: list[str] = Field(default_factory=list)
    child_container_ids: list[str] = Field(default_factory=list)
    parent_container_id: str | None = None
    post_id: str | None = None
    permalink: str | None = None
    comment_id: str | None = None
    comment_status: Literal[
        "not_requested", "pending", "published", "skipped_permission", "failed"
    ] = "not_requested"


class Carousel(StrictModel):
    post_id: str
    slide_ids: list[str] = Field(min_length=5, max_length=5)
    cover_slide_id: str
    closing_slide_id: str


