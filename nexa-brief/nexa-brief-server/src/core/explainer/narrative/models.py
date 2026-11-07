"""Esquema de una estrategia narrativa (`strategies/narrative/<id>.json`).

Una narrativa describe el ORDEN de los actos del guion, su peso relativo y su intensidad, nunca
segundos ni porcentajes: la IA decide cuánto dura cada acto según la duración del video. Lo único
que se valida en un guion es la forma (ver `checks.py`).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Cuánto ocupa un acto dentro del video (relativo, nunca medido).
Weight = Literal["apertura", "primer_tramo", "corto", "medio", "mayor_parte", "cierre"]
# Intensidad cualitativa; el guion usa `intensity` 0–1 y estos son sus mínimos.
Intensity = Literal["baja", "media", "alta", "maxima"]
INTENSITY_MIN: dict[str, float] = {"baja": 0.0, "media": 0.4, "alta": 0.7, "maxima": 0.9}
TitleLevelId = Literal["basico", "medio", "alto", "negro"]


class _Strict(BaseModel):
    # Un campo desconocido (typo) es un error, nunca se ignora en silencio.
    model_config = ConfigDict(extra="forbid", frozen=True)


class NarrativeAct(_Strict):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    weight: Weight
    intensity: Intensity
    spoken: bool = True     # False: no va en script.json (el título, el outro con voz del canal)
    function: str
    rules: list[str] = Field(default_factory=list)


class HookRules(_Strict):
    rules: list[str] = Field(default_factory=list)
    allowed_techniques: list[str] = Field(default_factory=list)
    prohibited: list[str] = Field(default_factory=list)
    hedge_words: list[str] = Field(default_factory=list)


class RetentionTechnique(_Strict):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    act: str
    how: str
    example: str


class TitleLevel(_Strict):
    name: str
    description: str
    rules: list[str] = Field(default_factory=list)
    examples: dict[str, list[str]] = Field(default_factory=dict)    # por categoría


class TitleRules(_Strict):
    image_criteria: list[str] = Field(default_factory=list)
    default_level: TitleLevelId
    levels: dict[TitleLevelId, TitleLevel]

    @model_validator(mode="after")
    def _default_exists(self) -> TitleRules:
        if self.default_level not in self.levels:
            raise ValueError(f"default_level '{self.default_level}' no está en levels {sorted(self.levels)}")
        return self


class VoiceRules(_Strict):
    allowed_tones: dict[str, list[str]] = Field(default_factory=dict)


class ScriptChecks(_Strict):
    hedge_acts: list[str] = Field(default_factory=list)
    concrete_act: str | None = None
    second_person_act: str | None = None
    second_person_words: list[str] = Field(default_factory=list)
    number_words: list[str] = Field(default_factory=list)


class ThumbnailRules(_Strict):
    preferred_option: Literal["C"]
    max_words: int = Field(ge=1, le=6)
    rules: list[str] = Field(min_length=1)
    require_bullet: bool = False
    require_image_review: bool = False


class QuestionRules(_Strict):
    act: str                                  # el acto que dibuja la pregunta en pantalla
    screen_max_words: int = Field(ge=2, le=15)
    tone: str                                 # tono de narrate.py para ese segmento
    delivery_note: str
    do: list[str] = Field(default_factory=list)
    dont: list[str] = Field(default_factory=list)


class ShapeChecks(_Strict):
    script: ScriptChecks = Field(default_factory=ScriptChecks)
    opening_intensity: Intensity | None = None        # mínimo del primer segmento hablado
    required_acts: list[str] = Field(default_factory=list)
    order: list[str] = Field(default_factory=list)    # estos actos aparecen en este orden
    question_on_screen: bool = False                  # beat common.question con la pregunta exacta
    pinned_repeats_question: bool = False             # 1ª pregunta del comentario fijado = la de pantalla


class NarrativeExample(_Strict):
    titles: dict[TitleLevelId, list[str]] = Field(default_factory=dict)
    thumbnail: list[str] = Field(default_factory=list)
    hook: str = ""
    hook_correct: str = ""
    hook_incorrect: str = ""
    fear_correct: str = ""
    fear_incorrect: str = ""
    turn: list[str] = Field(default_factory=list)
    question: str = ""
    screen_question: str = ""


class NarrativeStrategy(_Strict):
    id: str = Field(pattern=r"^narrative_[a-z0-9_]+$")
    label: str                       # corto, para la UI
    name: str
    description: str                 # una línea
    status: Literal["active", "draft"] = "active"
    acts: list[NarrativeAct] = Field(min_length=2)
    hook: HookRules = Field(default_factory=HookRules)
    voice: VoiceRules = Field(default_factory=VoiceRules)
    retention: list[RetentionTechnique] = Field(default_factory=list)
    title: TitleRules | None = None
    thumbnail: ThumbnailRules | None = None
    question: QuestionRules | None = None
    checks: ShapeChecks = Field(default_factory=ShapeChecks)
    examples: dict[str, NarrativeExample] = Field(default_factory=dict)   # por categoría

    @model_validator(mode="after")
    def _coherent(self) -> NarrativeStrategy:
        ids = [a.id for a in self.acts]
        if len(set(ids)) != len(ids):
            raise ValueError(f"actos con id repetido: {ids}")
        retention_ids = [technique.id for technique in self.retention]
        if len(set(retention_ids)) != len(retention_ids):
            raise ValueError(f"técnicas de retención con id repetido: {retention_ids}")
        refs = set(self.checks.required_acts) | set(self.checks.order)
        if self.question:
            refs.add(self.question.act)
        unknown = sorted(refs - set(ids))
        if unknown:
            raise ValueError(f"checks/question nombran actos que no existen: {unknown}")
        if (self.checks.question_on_screen or self.checks.pinned_repeats_question) and not self.question:
            raise ValueError("checks pide pregunta en pantalla pero falta el bloque 'question'")
        if self.thumbnail and not self.title:
            raise ValueError("thumbnail necesita el bloque 'title' para usar el nivel elegido")
        return self

    @property
    def spoken_acts(self) -> list[NarrativeAct]:
        return [a for a in self.acts if a.spoken]

    def title_level(self, level: str | None) -> TitleLevelId | None:
        """El nivel pedido si existe; si no, el default. None si la narrativa no define títulos."""
        if not self.title:
            return None
        return level if level in self.title.levels else self.title.default_level  # type: ignore[return-value]
