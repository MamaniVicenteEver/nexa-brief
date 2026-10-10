"""Schemas de /drafts — previews persistidos que se graban retomando el mismo job.

La respuesta es el `Draft` de `src/core/drafts.py` tal cual: el registro ya es
el contrato público (no guarda nada interno), así no hay dos modelos que
mantener en sincronía.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from src.core.drafts import Draft, RenderOptions
from src.core.job import SongInfo
from src.core.template_inputs import TemplateInputs

DraftResponse = Draft


class DraftRenderRequest(RenderOptions):
    """POST /drafts/{id}/render — recorder_engine?, render_target?, publish_accounts?"""


class DraftCreateRequest(BaseModel):
    template_id: str
    music_asset_id: str | None = None
    image_asset_id: str | None = None
    video_asset_id: str | None = None
    template_inputs: TemplateInputs | None = None
    song_info: SongInfo | None = None
    user_context: str | None = Field(default=None, max_length=500)
    # Crear video en un paso: si viene, apenas el preview queda listo se graba
    # con estas opciones (validadas acá, al crear, no recién al encadenar).
    auto_render: RenderOptions | None = None


class DraftListResponse(BaseModel):
    total: int
    drafts: list[Draft]


class DraftRenderAcceptedResponse(BaseModel):
    draft_id: str
    job_id: str
    status: str
