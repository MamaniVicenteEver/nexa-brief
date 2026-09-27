"""Estadísticas para la landing (públicas) y el dashboard (privadas).

Capas:
  context.py   → carga cada fuente una vez por request (DataStore + cuentas inyectadas)
  sections/    → una función pura por sección
  registry.py  → qué secciones van en cada respuesta
  models.py    → contrato de cada sección
"""

from src.core.stats.registry import build_dashboard_summary, build_public_stats

__all__ = ["build_dashboard_summary", "build_public_stats"]
