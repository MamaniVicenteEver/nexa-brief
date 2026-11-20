"""Versioned, closed contracts for edition layers and their frozen result."""
from __future__ import annotations
from typing import Literal
from pathlib import PurePosixPath
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Layer(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Persona(Layer):
    schema_: Literal["nexa.persona/1"] = Field(alias="schema")
    persona_id: str
    archetype: str
    traits: list[str]
    values: list[str]
    relationship_with_viewer: str
    emotional_range: dict[str, str]
    humor: str
    never: list[str]


class Voice(Layer):
    voice: str
    alternatives: list[str] = []
    models: list[str]
    base: str
    direction: str
    target_wpm: tuple[int, int]
    lead: float = Field(ge=0)
    tail: float = Field(ge=0)
    lexicon_ref: str | None = None

    @field_validator("target_wpm")
    @classmethod
    def ordered_wpm(cls, value):
        if not 0 < value[0] <= value[1]:
            raise ValueError("target_wpm must be positive and ordered")
        return value


class OutroTexts(Layer):
    thanks: str
    cta: str
    support: str
    channel: str
    handle: str


class OutroSpoken(Layer):
    """Texto hablado del cierre del canal en el idioma y palabras clave que marcan like,
    suscripción, campana y apoyo (el componente de cierre se sincroniza con ellas)."""
    text: str
    cues: dict[str, str] = {}


class IdentityTexts(Layer):
    outro: OutroTexts
    outro_spoken: OutroSpoken | None = None
    visual_outro_defaults: OutroTexts | None = None


class Expression(Layer):
    register_: str = Field(alias="register")
    sentence_length: str
    rhetorical_devices: list[str]
    signature_phrases: list[str]
    avoid: list[str]


class Brand(Layer):
    name: str
    handle: str
    language: str
    note: str | None = None


class IdentityMarket(Layer):
    schema_: Literal["nexa.identity-market/1"] = Field(alias="schema")
    persona_id: str
    market: str
    status: Literal["draft", "approved"]
    voice: Voice
    channel: Brand
    expression: Expression
    texts: IdentityTexts
    examples: list[dict[str, str]]


class Duration(Layer):
    min: int = Field(gt=0)
    default: int
    max: int
    step: int = Field(gt=0)

    @model_validator(mode="after")
    def ordered(self):
        if not self.min <= self.default <= self.max:
            raise ValueError("Invalid duration range")
        return self


class Selection(Layer):
    default_below_seconds: int
    below_format: str
    otherwise_format: str


class Structure(Layer):
    acts: tuple[int, int]
    hook_max_seconds: float
    chapters: bool
    ending: str


class MediaPolicy(Layer):
    photos: bool
    clips: bool
    generated_images: bool
    only_components: bool


class Format(Layer):
    schema_: Literal["nexa.format/1"] = Field(alias="schema")
    format_id: str
    label: str
    duration_seconds: Duration
    selection: Selection
    structure: Structure
    media: MediaPolicy
    density: dict[str, tuple[float, float]]
    words_margin: tuple[float, float]
    chapter_seconds: tuple[int, int]
    domain_components: list[dict[str, int]]
    aspects: list[Literal["9:16", "16:9"]]
    legacy_source: str | None = None
    narrative: dict[str, str] = {}
    publication: dict[str, str | bool] = {}

    @field_validator("density")
    @classmethod
    def density_ranges(cls, value):
        if any(not 0 <= lo <= hi for lo, hi in value.values()):
            raise ValueError("Invalid density range")
        return value


class DesignFormat(Layer):
    status: Literal["draft", "approved"]
    components: list[str]
    excluded: list[str] = []
    visual_rhythm: dict[str, tuple[float, float]]


class DesignFormats(Layer):
    schema_: Literal["nexa.design-formats/1"] = Field(alias="schema")
    design_id: str
    supports: dict[str, DesignFormat]


class TextField(Layer):
    type: str
    max_chars: int = Field(ge=0)
    translate: bool = True
    note: str = ""

    @field_validator("type")
    @classmethod
    def known_type(cls, value):
        if value not in {"label", "title", "narration", "question", "enum", "media"} and not value.startswith("substring:"):
            raise ValueError(f"Unknown localizable type: {value}")
        return value

    @model_validator(mode="after")
    def protected_fields(self):
        if self.type in ("enum", "media") and self.translate:
            raise ValueError("Enums and media cannot be translated")
        if self.translate and self.max_chars < 1:
            raise ValueError("Text needs a positive editorial character limit")
        return self


class ComponentTexts(Layer):
    source: str
    fields: dict[str, TextField]
    notes: str = ""


class Localizable(Layer):
    schema_: Literal["nexa.localizable/1"] = Field(alias="schema")
    design_id: str
    limit_policy: str
    components: dict[str, ComponentTexts]
    script: dict[str, TextField]
    storyboard: dict[str, TextField]


class Category(Layer):
    """Legacy source schema; brand and language-specific publication data stay out of editorial rules."""
    id: str
    channel: str
    emotion: str
    anchors: list[str]
    preferred_title_strategies: list[int]
    avoid: list[str]
    required_hashtags: dict[str, list[str]]


class Paths(Layer):
    script: str
    storyboard: str
    lyrics: str
    audio: str
    audio_with_outro: str
    config: str
    publish: str

    @field_validator("*")
    @classmethod
    def relative_path(cls, value):
        p = PurePosixPath(value)
        if not value or p.is_absolute() or ".." in p.parts or "\\" in value:
            raise ValueError("Edition paths must stay relative to the production")
        return value


class Outro(OutroTexts):
    audio: str
    use: str
    audio_scope: Literal["kit"] = "kit"


class Edition(Layer):
    schema_: Literal["nexa.edition/1"] = Field("nexa.edition/1", alias="schema")
    production_id: str
    category: str
    category_rules: dict
    design_id: str
    style_id: str | None = None
    format_id: str
    duration_seconds: float = Field(gt=0)
    locale: str
    source_locale: str = "es-419"
    source_revision: str
    revision: str
    persona_id: str
    persona: Persona
    identity_status: Literal["draft", "approved"]
    expression: Expression
    channel: Brand
    voice: Voice
    transcription: dict[str, str]
    lexicon: dict[str, str] = {}
    outro: Outro
    outro_spoken: OutroSpoken | None = None
    paths: Paths
    strategies: dict[str, str]
    resolved_strategies: dict[str, dict]
    format: Format
    design_format: DesignFormat
    localizable: Localizable
    provenance: dict[str, str]


class VoiceOverride(Layer):
    voice: str | None = None
    direction: str | None = None
    target_wpm: tuple[int, int] | None = None
    lead: float | None = Field(default=None, ge=0)
    tail: float | None = Field(default=None, ge=0)


class Overrides(Layer):
    """Only these keys are writable by an account or episode layer."""
    format_id: str | None = None
    duration_seconds: float | None = Field(default=None, gt=0)
    voice: VoiceOverride | None = None
    channel: Brand | None = None
    outro: OutroTexts | None = None
