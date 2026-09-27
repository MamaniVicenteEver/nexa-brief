"""HTTP schemas for the Academy planning and generation flow."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from src.academy.models import CurriculumPlan, GenerationBatch, PlanningSession


class ConversationMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class CreatePlanRequest(BaseModel):
    category_id: str = Field(min_length=1)
    level_id: str = Field(min_length=1)
    learner_profile: str = Field(min_length=1, max_length=1000)
    lesson_count: int = Field(default=10, ge=1, le=200)
    target_duration_seconds: int = Field(default=900, ge=10, le=7200)
    pilot_duration_seconds: int = Field(default=15, ge=10, le=60)
    pilot_count: int = Field(default=3, ge=1, le=20)
    voice_provider: str = Field(default="gemini", min_length=1)
    voice_model: str = Field(default="gemini-2.5-flash-preview-tts", min_length=1)
    template_id: str | None = None
    language: str = Field(default="es", min_length=2, max_length=10)


class EnqueueBatchRequest(BaseModel):
    count: int | None = Field(default=None, ge=1, le=200)


class SessionResponse(BaseModel):
    session: PlanningSession
    next_action: str


class PlanResponse(BaseModel):
    plan: CurriculumPlan


class BatchResponse(BaseModel):
    batch: GenerationBatch


class AgentRunRequest(BaseModel):
    context: dict[str, Any] = Field(default_factory=dict)
    user_prompt: str = Field(min_length=1, max_length=12000)


class AgentRunResponse(BaseModel):
    agent_id: str
    prompt_version: str
    result: dict[str, Any]
