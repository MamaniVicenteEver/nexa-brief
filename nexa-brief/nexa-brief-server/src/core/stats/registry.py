"""Qué secciones lleva cada respuesta. Este es el ÚNICO lugar a tocar para
mostrar u ocultar un dato en la landing o en el dashboard.

Agregar un dato nuevo:
  1. modelo en `models.py` (y el campo en PublicStats / DashboardSummary);
  2. función `(StatsContext) -> modelo` en `sections/`;
  3. una línea en PUBLIC_SECTIONS y/o DASHBOARD_SECTIONS.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from src.core.stats.context import AccountsLoader, StatsContext
from src.core.stats.models import DashboardSummary, PublicStats
from src.core.stats.sections import (
    activity,
    alerts,
    catalog,
    channels,
    performance,
    publications,
    showcase,
    upcoming,
    videos,
)

Section = Callable[[StatsContext], Any]

PUBLIC_SECTIONS: dict[str, Section] = {
    "videos": videos.collect,
    "publications": publications.collect,
    "channels": channels.summary,
    "channel_list": channels.public_list,
    "catalog": catalog.collect,
    "performance": performance.collect,
    "showcase": showcase.collect,
}

DASHBOARD_SECTIONS: dict[str, Section] = {
    "videos": videos.collect,
    "publications": publications.collect,
    "channels": channels.summary,
    "channel_list": channels.details,
    "catalog": catalog.collect,
    "performance": performance.collect,
    "alerts": alerts.collect,
    "upcoming": upcoming.collect,
    "activity": activity.collect,
}


def _build(sections: dict[str, Section], ctx: StatsContext) -> dict[str, Any]:
    return {name: collect(ctx) for name, collect in sections.items()}


def build_public_stats(accounts_loader: AccountsLoader | None = None) -> PublicStats:
    return PublicStats(**_build(PUBLIC_SECTIONS, StatsContext(accounts_loader=accounts_loader)))


def build_dashboard_summary(accounts_loader: AccountsLoader | None = None) -> DashboardSummary:
    return DashboardSummary(**_build(DASHBOARD_SECTIONS, StatsContext(accounts_loader=accounts_loader)))
