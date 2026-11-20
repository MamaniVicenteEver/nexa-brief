"""Narrative Adapter Factory — de dónde salen las estrategias narrativas.

Hoy solo JSON en `src/skills/explainer/strategies/narrative/`. Otro backend es un adapter más que
cumpla `NarrativeRepositoryPort` y una rama acá.
"""

from src.config.settings import settings
from src.core.ports.narrative_port import NarrativeRepositoryPort


def narrative_dir():
    return settings.skills_dir / "explainer" / "strategies" / "narrative"


def get_narrative_repository() -> NarrativeRepositoryPort:
    from src.adapters.narrative.json_repository import JsonNarrativeRepository

    return JsonNarrativeRepository(narrative_dir())
