"""Estrategias editoriales de los posts de imagen.

Para agregar una: crear `<id>.py` con una constante `STRATEGY` (ver `cifra_que_frena.py`) y
sumarla a `_REGISTRY`. Nada más cambia: el servicio, la API y la web leen este registro.
"""
from __future__ import annotations

from . import copywriter
from .base import Copy, Fact, Strategy, StrategyContext, extract_stat, trim_words
from .cifra_que_frena import STRATEGY as CIFRA_QUE_FRENA
from .hilo_guardable import STRATEGY as HILO_GUARDABLE
from .prueba_a_la_vista import STRATEGY as PRUEBA_A_LA_VISTA

_REGISTRY: dict[str, Strategy] = {s.id: s for s in (CIFRA_QUE_FRENA, HILO_GUARDABLE, PRUEBA_A_LA_VISTA)}
DEFAULT_BY_TEMPLATE = {"daily_fact": CIFRA_QUE_FRENA.id, "five_slides": HILO_GUARDABLE.id}


class UnknownStrategy(ValueError):
    """La estrategia pedida no existe o no corresponde al formato."""


def list_strategies() -> list[Strategy]:
    return list(_REGISTRY.values())


def resolve(strategy_id: str | None, template_id: str) -> Strategy:
    """Estrategia pedida, o la predeterminada del formato."""
    chosen = _REGISTRY.get(strategy_id or DEFAULT_BY_TEMPLATE.get(template_id, ""))
    if chosen is None:
        raise UnknownStrategy(f"Estrategia desconocida: {strategy_id}")
    if chosen.template_id != template_id:
        raise UnknownStrategy(f"La estrategia {chosen.id} es para {chosen.template_id}, no {template_id}")
    return chosen


__all__ = ["Copy", "copywriter", "trim_words", "Fact", "Strategy", "StrategyContext", "extract_stat", "list_strategies", "resolve",
           "DEFAULT_BY_TEMPLATE", "UnknownStrategy"]
