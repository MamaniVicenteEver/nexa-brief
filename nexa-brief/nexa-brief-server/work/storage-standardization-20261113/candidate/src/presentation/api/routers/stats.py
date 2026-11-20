"""GET /stats/public (landing) y GET /dashboard/summary (panel).

El router solo compone: inyecta el cargador de cuentas (vive en adapters, por
eso no lo importa core) y delega en `src.core.stats`.
"""

from __future__ import annotations

from fastapi import APIRouter

from src.adapters.publishing.factory import get_publisher_facade
from src.core.stats import build_dashboard_summary, build_public_stats
from src.core.stats.models import DashboardSummary, PublicStats

router = APIRouter(tags=["stats"])


def _load_accounts() -> list[dict]:
    return get_publisher_facade().list_accounts()


@router.get("/stats/public", response_model=PublicStats)
async def public_stats() -> PublicStats:
    """Agregados seguros para mostrar en la landing pública."""
    return build_public_stats(_load_accounts)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary() -> DashboardSummary:
    """Todo lo que muestra el dashboard, en una sola respuesta."""
    return build_dashboard_summary(_load_accounts)
