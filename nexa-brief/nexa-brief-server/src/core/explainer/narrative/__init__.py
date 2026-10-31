"""Estrategias narrativas de los explainers: el arco que sigue el guion (ver README.md).

Fuera de este paquete solo se usa lo que exporta este archivo.

  models    esquema del JSON (actos sin tiempos, niveles de título, pregunta final, checks)
  errors    NarrativeError / NarrativeNotFound / NarrativeInvalid (con id, archivo y campo)
  service   listar / obtener / resolver la de un video (puerto NarrativeRepositoryPort)
  prompts   lo que reciben el estratega del brief y el agente de producción
  video     dónde queda grabada en el video (config.json, manifest.json, publish.json)
  checks    lo que valida `publishing check` (comentario fijado = pregunta del video)
"""

from src.core.explainer.narrative.checks import pinned_question_issue
from src.core.explainer.narrative.errors import NarrativeError, NarrativeInvalid, NarrativeNotFound
from src.core.explainer.narrative.models import NarrativeStrategy
from src.core.explainer.narrative.prompts import brief_context, production_lines
from src.core.explainer.narrative.service import DOCUMENTAL_ID, NarrativeService, get_service, set_service
from src.core.explainer.narrative.video import RecordedNarrative, record, recorded, stamp_publish, stamp_publish_file

__all__ = [
    "DOCUMENTAL_ID",
    "NarrativeError",
    "NarrativeInvalid",
    "NarrativeNotFound",
    "NarrativeService",
    "NarrativeStrategy",
    "RecordedNarrative",
    "brief_context",
    "get_service",
    "pinned_question_issue",
    "production_lines",
    "record",
    "recorded",
    "set_service",
    "stamp_publish",
    "stamp_publish_file",
]
