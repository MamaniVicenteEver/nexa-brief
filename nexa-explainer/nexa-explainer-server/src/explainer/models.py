"""Stable data contracts for the Nexa Explainer workflow."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ExplainerTemplateId(str, Enum):
    EDITORIAL_SPLIT = "editorial-split"
    DATA_BRIEF = "data-brief"
    SIGNAL_MINIMAL = "signal-minimal"
    IMMERSIVE_OVERLAY = "immersive-overlay"
    CENTERED_RAILS = "centered-rails"
    KINETIC_VOICE = "kinetic-voice"
    FIELD_NOTES = "field-notes"
    PRODUCT_SIGNAL = "product-signal"
    SYSTEMS_MAP = "systems-map"
    SPATIAL_ORBIT = "spatial-orbit"


class ExplainerStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class SceneKind(str, Enum):
    HOOK = "hook"
    CONCEPT = "concept"
    STAT = "stat"
    QUOTE = "quote"
    STEP = "step"
    CTA = "cta"


class VisualTreatment(str, Enum):
    """A single, transcript-triggered treatment for the empty side of the frame."""

    NONE = "none"
    TITLE = "title"
    ACTION = "action"
    MONEY = "money"
    CHANGE = "change"
    PROCESS = "process"
    QUOTE = "quote"
    DATA = "data"


class FrameAnalysis(BaseModel):
    width: int
    height: int
    aspect_ratio: float
    presenter_region: dict[str, float] = Field(
        default_factory=lambda: {"x": 0.0, "y": 0.0, "width": 0.5, "height": 1.0}
    )
    graphics_region: dict[str, float] = Field(
        default_factory=lambda: {"x": 0.5, "y": 0.0, "width": 0.5, "height": 1.0}
    )
    presenter_position: str = "left"
    framing_notes: str = "Composición segura en dos columnas: presentador a la izquierda y gráficos a la derecha."
    confidence: float = 0.78
    provider: str = "deterministic"


class TranscriptWord(BaseModel):
    text: str
    start: float
    end: float
    confidence: float | None = None


class TranscriptSegment(BaseModel):
    id: int
    start: float
    end: float
    text: str
    words: list[TranscriptWord] = Field(default_factory=list)


class Transcript(BaseModel):
    language: str = "es"
    provider: str
    model: str | None = None
    quality: str = "fallback"
    text: str
    segments: list[TranscriptSegment]
    warnings: list[str] = Field(default_factory=list)


class SemanticScene(BaseModel):
    id: str
    kind: SceneKind
    start: float
    end: float
    title: str
    body: str = ""
    highlight: str = ""
    icon: str = "layers"
    priority: int = 1
    evidence: str = ""
    visual_treatment: VisualTreatment = VisualTreatment.NONE


class CompositionSpec(BaseModel):
    template_id: ExplainerTemplateId
    width: int = 1920
    height: int = 1080
    fps: int = 30
    presenter_width_ratio: float = 0.5
    safe_margin: float = 0.055
    scenes: list[SemanticScene]
    design_notes: list[str] = Field(default_factory=list)


class ExplainerProject(BaseModel):
    id: str
    original_filename: str
    status: ExplainerStatus
    template_id: ExplainerTemplateId
    duration_seconds: float
    language: str | None = None
    created_at: str
    updated_at: str
    frame_analysis: FrameAnalysis | None = None
    transcript: Transcript | None = None
    composition: CompositionSpec | None = None
    paths: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    revision: int = 1
    ai_used: bool = False
    editorial_plan: "EditorialPlan | None" = None
    editorial_emotion_analysis: dict[str, Any] | None = None


class EditorialScriptSegment(BaseModel):
    """One translated/narrated source range for the editorial recut."""

    source_start: float
    source_end: float
    text: str = Field(min_length=1, max_length=4000)
    title: str = ""
    emphasis: list[str] = Field(default_factory=list)
    phase: str | None = None
    emotion: str = "serious"


class EditorialSegment(BaseModel):
    id: str
    source_start: float
    source_end: float
    timeline_start: float
    timeline_end: float
    title: str
    narration: str
    emphasis: list[str] = Field(default_factory=list)
    phase: str | None = None
    emotion: str = "serious"
    cut: str = "hard_cut"
    reframe: dict[str, float] = Field(default_factory=dict)


class EditorialAction(BaseModel):
    id: str
    type: str
    start: float
    end: float
    text: str = ""
    phase: str | None = None
    position: str = "left"
    intensity: float = 1.0
    payload: dict[str, Any] = Field(default_factory=dict)


class EditorialPlan(BaseModel):
    """Serializable director contract consumed by the renderer."""

    schema_version: int = 1
    mode: str = "source_led_editorial_recut"
    source_label: str
    source_duration_seconds: float
    duration_seconds: float
    canvas: dict[str, Any] = Field(default_factory=lambda: {
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "aspect_ratio": "16:9",
    })
    brand: dict[str, Any] = Field(default_factory=dict)
    audio: dict[str, Any] = Field(default_factory=dict)
    grade: dict[str, Any] = Field(default_factory=dict)
    segments: list[EditorialSegment] = Field(default_factory=list)
    actions: list[EditorialAction] = Field(default_factory=list)
    quality_gates: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class EditorialRecutRequest(BaseModel):
    provider: str = Field(default="local", pattern="^(local|novita|gemini)$")
    voice: str | None = None
    source_label: str = "Obama · discurso sobre Stonewall y la promesa de igualdad"
    script_segments: list[EditorialScriptSegment] | None = None


class EditorialVoiceVariantRequest(BaseModel):
    """A second synthetic narration for A/B review of the same locked plan."""

    voice: str = Field(min_length=2, max_length=64)


class EditorialEmotionAnalysisRequest(BaseModel):
    """Request for transcript-to-performance-direction analysis."""

    source: str = "editorial_plan"
    language: str = "es"


class FeedbackRequest(BaseModel):
    feedback: str = Field(min_length=1, max_length=2000)
    template_id: ExplainerTemplateId | None = None
    scenes: list[SemanticScene] | None = None


class ProjectResponse(BaseModel):
    project: ExplainerProject
    links: dict[str, str] = Field(default_factory=dict)


def model_dump_jsonable(value: Any) -> Any:
    """Return a JSON-safe representation on both Pydantic v2 and plain dicts."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    return value
