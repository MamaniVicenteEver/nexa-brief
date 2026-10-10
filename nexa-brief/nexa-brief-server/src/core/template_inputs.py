"""TemplateInputs — lo que el usuario eligió para una plantilla, más allá de
canción/imagen/video de fondo (que siguen en MusicSource/ImageSource/VideoSource).

Contrato compartido entre:
  - drafts (src/core/drafts.py): lo guarda y lo pasa al Job;
  - requisitos de plantilla (`inputs` en templates.json): define qué slots y
    textos existen;
  - aplicación al config (src/modules/template_inputs_applier.py): lo vuelca
    en el config.json del job antes de generar el HTML.

Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TemplateInputs(BaseModel):
    # slot declarado en `inputs.media[].slot` → asset_ids de la librería, en orden.
    media: dict[str, list[str]] = Field(default_factory=dict)
    # clave declarada en `inputs.texts[].key` (notación con puntos, ej. "brand.tag") → valor.
    texts: dict[str, str] = Field(default_factory=dict)
    # descripción libre de lo que el usuario quiere (la usa el director de medios / config mapper).
    brief: str | None = None
