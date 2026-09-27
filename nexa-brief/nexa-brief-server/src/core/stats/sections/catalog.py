from __future__ import annotations

from src.core.stats.context import StatsContext
from src.core.stats.models import CatalogStats

# Motores disponibles en el servidor (ver adapters/recorder/factory.py).
_ENGINES = ["remotion", "hyperframes", "playwright"]


def collect(ctx: StatsContext) -> CatalogStats:
    lyric = sum(1 for t in ctx.templates if t.template.requires_lyrics)
    return CatalogStats(
        templates=len(ctx.templates),
        lyric_templates=lyric,
        visual_templates=len(ctx.templates) - lyric,
        active_niches=len(ctx.active_niches),
        engines=_ENGINES,
    )
