"""Schemas de /drafts — previews persistidos que se graban retomando el mismo job.

La respuesta es el `Draft` de `src/core/drafts.py` tal cual: el registro ya es
el contrato público (no guarda nada interno), así no hay dos modelos que
mantener en sincronía.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from src.core.draft_details import DraftDetails
from src.core.drafts import Draft, RenderOptions
from src.core.job import SongInfo
from src.core.template_inputs import TemplateInputs

DraftResponse = Draft


class DraftRenderRequest(RenderOptions):
    """POST /drafts/{id}/render — recorder_engine?, render_target?, publish_accounts?"""


class DraftCreateRequest(BaseModel):
    template_id: str
    name: str = Field(default="", max_length=120)
    music_asset_id: str | None = None
    image_asset_id: str | None = None
    video_asset_id: str | None = None
    template_inputs: TemplateInputs | None = None
    promo_timeline: dict[str, Any] | None = None
    timed_content: dict | None = None
    song_info: SongInfo | None = None
    user_context: str | None = Field(default=None, max_length=500)
    # Crear video en un paso: si viene, apenas el preview queda listo se graba
    # con estas opciones (validadas acá, al crear, no recién al encadenar).
    auto_render: RenderOptions | None = None


class DraftPrepareRequest(BaseModel):
    """POST /drafts/{id}/prepare y /templates/{id}/original-draft — información de la canción, opcional."""
    song_notes: str | None = Field(default=None, max_length=2000)


class DraftUpdateRequest(BaseModel):
    """PATCH /drafts/{id} — por ahora, el nombre del prototipo."""
    name: str = Field(..., min_length=1, max_length=120)


DraftDetailsRequest = DraftDetails


class DraftListResponse(BaseModel):
    total: int
    drafts: list[Draft]


class DraftRenderAcceptedResponse(BaseModel):
    draft_id: str
    job_id: str
    status: str


class DraftThumbnailRequest(BaseModel):
    option: Literal["A", "B"]


class DraftThumbnailOptionUpdateRequest(BaseModel):
    """Texto y diseño JSON de una sola opción A/B, sin activar una captura."""
    text: str = Field(..., min_length=1, max_length=200)
    design: dict[str, Any] = Field(default_factory=dict)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("El texto no puede estar vacío")
        return value

    @field_validator("design")
    @classmethod
    def validate_design(cls, value: dict[str, Any]) -> dict[str, Any]:
        def check(item: Any, depth: int = 0) -> None:
            if depth > 6:
                raise ValueError("design supera la profundidad permitida")
            if item is None or isinstance(item, (str, int, float, bool)):
                return
            if isinstance(item, list):
                for child in item:
                    check(child, depth + 1)
                return
            if isinstance(item, dict) and all(isinstance(key, str) for key in item):
                for child in item.values():
                    check(child, depth + 1)
                return
            raise ValueError("design solo puede contener datos JSON")

        check(value)
        if len(json.dumps(value, ensure_ascii=False)) > 12_000:
            raise ValueError("design supera el tamaño permitido")
        return value
