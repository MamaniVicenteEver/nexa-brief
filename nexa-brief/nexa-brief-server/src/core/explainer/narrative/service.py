"""Servicio de narrativas: listar, obtener y resolver la de un video.

Aislamiento: si las narrativas no cargan (carpeta borrada, JSON roto) y nadie eligió una a mano,
`resolve()` devuelve None y quien llama sigue con el comportamiento de siempre (storytelling.md §3).
Solo una elección explícita inválida es un error (la API lo devuelve como 400).
"""

from __future__ import annotations

import structlog

from src.core.explainer.narrative.errors import NarrativeError
from src.core.explainer.narrative.models import NarrativeStrategy
from src.core.ports.narrative_port import NarrativeRepositoryPort

logger = structlog.get_logger(__name__)

# El arco documental de siempre: con él los prompts quedan exactamente como antes del módulo.
DOCUMENTAL_ID = "narrative_documental_v1"


class NarrativeService:
    def __init__(self, repository: NarrativeRepositoryPort) -> None:
        self.repository = repository

    def list(self) -> list[NarrativeStrategy]:
        """Las que cargan bien; una rota se registra en el log y no tumba la lista."""
        out = []
        for narrative_id in self.repository.list_ids():
            try:
                out.append(self.repository.load(narrative_id))
            except NarrativeError as exc:
                logger.warning("narrative_skipped", **exc.context())
        return out

    def get(self, narrative_id: str) -> NarrativeStrategy:
        return self.repository.load(narrative_id)

    def default_id(self, category_id: str) -> str:
        return self.repository.default_id(category_id)

    def resolve(self, category_id: str, narrative_id: str | None = None) -> NarrativeStrategy | None:
        if narrative_id:
            return self.get(narrative_id)       # elegida a mano: si no existe, que se sepa
        try:
            return self.get(self.default_id(category_id))
        except NarrativeError as exc:
            logger.error("narrative_default_unavailable", category=category_id, **exc.context())
            return None


_service: NarrativeService | None = None


def get_service() -> NarrativeService:
    global _service
    if _service is None:
        from src.adapters.narrative.factory import get_narrative_repository

        _service = NarrativeService(get_narrative_repository())
    return _service


def set_service(service: NarrativeService | None) -> None:
    """Para tests: inyectar un repositorio propio (None vuelve al de la factory)."""
    global _service
    _service = service
