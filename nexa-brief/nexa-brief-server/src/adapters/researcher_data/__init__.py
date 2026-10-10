"""Adaptadores independientes para investigación y búsqueda de datos abiertos.

Este paquete no se registra en FastAPI ni en el pipeline de Nexa Brief todavía.
Se puede usar directamente desde scripts o tests mediante ``ResearcherDataAdapter``.
"""

from src.adapters.researcher_data.config import ResearcherSettings, settings
from src.adapters.researcher_data.factory import (
    ResearcherDataAdapter,
    build_researcher_data,
)
from src.adapters.researcher_data.models import (
    ProviderIssue,
    ResearchResponse,
    ResearchResult,
)

__all__ = [
    "ProviderIssue",
    "ResearchResponse",
    "ResearchResult",
    "ResearcherDataAdapter",
    "ResearcherSettings",
    "build_researcher_data",
    "settings",
]
