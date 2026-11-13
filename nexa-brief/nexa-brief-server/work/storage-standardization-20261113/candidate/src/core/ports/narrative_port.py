"""Puerto de las estrategias narrativas de los explainers (el arco del guion).

El dominio (`src/core/explainer/narrative/`) no sabe dónde viven las estrategias: hoy son archivos
JSON en `src/skills/explainer/strategies/narrative/` (adapter `src/adapters/narrative/`). Otro
backend (una tabla, un CMS) es un adapter nuevo que cumpla este contrato.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from src.core.explainer.narrative.models import NarrativeStrategy


class NarrativeRepositoryPort(Protocol):
    def list_ids(self) -> list[str]:
        """Ids de todas las estrategias disponibles, en orden estable."""
        ...

    def load(self, narrative_id: str) -> NarrativeStrategy:
        """La estrategia validada. NarrativeNotFound / NarrativeInvalid si no se puede."""
        ...

    def default_id(self, category_id: str) -> str:
        """La estrategia por defecto de la categoría (o la general)."""
        ...
