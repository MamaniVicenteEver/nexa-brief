"""Estrategia «Hilo para guardar» — carrusel de 5 láminas 4:5.

Objetivo: guardados y seguidores. Se recorre como un hilo: portada con el gancho del video,
tres ideas (una por lámina) y un cierre que resume y pide guardar y seguir.

Orden: 1 `cover` (gancho + "Desliza") → 2–4 `point` (paso, cifra, idea, fuente) →
5 `close` (resumen de los 3 puntos + llamada a la acción + @cuenta).
"""
from __future__ import annotations

from .base import Copy, Fact, Strategy, StrategyContext, pick_facts, slide, source_label, text, trim_words

ID = "hilo_guardable"
POINTS = 3


def _cover(facts: list[Fact], ctx: StrategyContext) -> dict:
    return slide(1, ID, "cover", [
        text("kicker", ctx.topic or f"Hilo · {POINTS} datos"),
        text("headline", trim_words(ctx.hook, 55), [fact.claim_id for fact in facts]),
        text("tagline", f"{POINTS} datos con fuente"),
        text("swipe", "Desliza →"),
    ], facts)


def _point(order: int, number: int, fact: Fact, piece: Copy) -> dict:
    refs = [fact.claim_id]
    return slide(order, ID, "point", [
        text("step", f"{number:02d}"),
        text("stat", piece.stat, refs),
        text("headline", piece.headline, refs),
        text("body", piece.body, refs),
        text("source", source_label([fact]), refs),
    ], [fact])


def _close(facts: list[Fact], ctx: StrategyContext, copy: dict[str, Copy]) -> dict:
    recap = "\n".join(copy[fact.claim_id].short or trim_words(copy[fact.claim_id].headline, 36) for fact in facts)
    refs = [fact.claim_id for fact in facts]
    return slide(POINTS + 2, ID, "close", [
        text("kicker", "En resumen"),
        text("body", recap, refs),
        text("cta", f"Guarda estos {POINTS} datos"),
        text("handle", f"Sigue a {ctx.handle}"),
        text("source", source_label(facts), refs),
    ], facts)


def build(facts: list[Fact], ctx: StrategyContext, copy: dict[str, Copy]) -> list[dict]:
    points = facts[:POINTS]
    return [_cover(points, ctx),
            *[_point(index + 2, index + 1, fact, copy[fact.claim_id]) for index, fact in enumerate(points)],
            _close(points, ctx, copy)]


STRATEGY = Strategy(
    id=ID,
    name="Hilo para guardar",
    description="Carrusel de 5: portada con gancho, 3 ideas con su fuente y cierre que invita a guardar y seguir.",
    goal="Guardados y seguidores",
    template_id="five_slides",
    facts_needed=POINTS,
    pick=lambda facts: pick_facts(facts, POINTS),
    headline_max=48,
    body_max=115,
    brief=("Cada hecho es un paso de un hilo cuyo gancho es el título del video. El titular de cada "
           "paso es una idea que se entiende sola y que alguien querría guardar; el contexto aporta "
           "el dato concreto que la respalda."),
    build=build,
)
