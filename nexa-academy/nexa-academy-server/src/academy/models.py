"""Pure Academy domain models.

These models describe the educational product, not an implementation detail of
the inherited Nexa Brief job pipeline. They are serializable so a later
database adapter can replace the JSON repository without changing the API.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class PlanStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    QUEUED = "queued"
    PILOT = "pilot"
    PUBLISHED = "published"
    NEEDS_REVISION = "needs_revision"


class LessonStatus(str, Enum):
    DRAFT = "draft"
    SCRIPTED = "scripted"
    AUDIO_READY = "audio_ready"
    VIDEO_READY = "video_ready"
    APPROVED = "approved"
    NEEDS_REVISION = "needs_revision"


class QueueItemStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TopicBlueprint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    objectives: list[str] = Field(default_factory=list)
    lesson_blueprints: list[dict[str, Any]] = Field(default_factory=list)


class LevelConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    recommended_lesson_count: int = Field(default=10, ge=1, le=200)
    topics: list[TopicBlueprint] = Field(default_factory=list)


class CategoryConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str
    template_family: str
    default_language: str = "es"
    levels: list[LevelConfig] = Field(default_factory=list)


class AcademyCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str
    categories: list[CategoryConfig]


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: MessageRole
    content: str = Field(min_length=1)
    created_at: datetime = Field(default_factory=utc_now)


class PlanningSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(default_factory=lambda: f"session_{uuid4().hex[:12]}")
    category_id: str | None = None
    level_id: str | None = None
    learner_profile: str | None = None
    target_language: str | None = None
    messages: list[ConversationMessage] = Field(default_factory=list)
    ready_for_plan: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class LessonSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    order: int = Field(ge=1)
    phase_id: str
    topic_id: str
    title: str
    description: str
    objectives: list[str] = Field(default_factory=list)
    scope_in: list[str] = Field(default_factory=list)
    scope_out: list[str] = Field(default_factory=list)
    target_duration_seconds: int = Field(default=900, ge=10, le=7200)
    pilot_duration_seconds: int = Field(default=15, ge=10, le=60)
    template_id: str
    voice_provider: str
    voice_model: str
    script_text: str
    status: LessonStatus = LessonStatus.DRAFT


class CurriculumPhase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    level_id: str
    lesson_ids: list[str]


class CurriculumPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(default_factory=lambda: f"plan_{uuid4().hex[:12]}")
    version: int = Field(default=1, ge=1)
    category_id: str
    category_name: str
    level_id: str
    level_name: str
    title: str
    purpose: str
    learner_profile: str
    language: str
    template_family: str
    template_id: str
    voice_provider: str
    voice_model: str
    target_duration_seconds: int = Field(default=900, ge=10, le=7200)
    pilot_duration_seconds: int = Field(default=15, ge=10, le=60)
    lesson_count: int = Field(ge=1, le=200)
    pilot_count: int = Field(default=3, ge=1, le=20)
    phases: list[CurriculumPhase]
    lessons: list[LessonSpec]
    status: PlanStatus = PlanStatus.DRAFT
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class QueueItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(default_factory=lambda: f"item_{uuid4().hex[:12]}")
    lesson_id: str
    order: int
    status: QueueItemStatus = QueueItemStatus.QUEUED
    attempts: int = 0
    output_path: str | None = None
    error: str | None = None
    updated_at: datetime = Field(default_factory=utc_now)


class GenerationBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(default_factory=lambda: f"batch_{uuid4().hex[:12]}")
    plan_id: str
    requested_count: int = Field(ge=1, le=200)
    pilot_count: int = Field(default=3, ge=1, le=20)
    items: list[QueueItem]
    status: QueueItemStatus = QueueItemStatus.QUEUED
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
