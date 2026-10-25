"""Estrategia «Cifra que frena el scroll» — imagen única 4:5.

Objetivo: alcance y compartidos. En el feed se decide en menos de un segundo, así que la cifra
va primero y enorme; el titular dice qué significa; el contexto es breve y la fuente visible.

Orden (receta `hero`): tema → CIFRA → qué significa → contexto → fuente + @cuenta.
Si el hecho no tiene cifra, el titular ocupa el centro (receta `hero_text`).
"""
from __future__ import annotations

from .base import Copy, Fact, Strategy, StrategyContext, pick_facts, slide, source_label, text

ID = "cifra_que_frena"


def build(facts: list[Fact], ctx: StrategyContext, copy: dict[str, Copy]) -> list[dict]:
    fact = facts[0]
    piece = copy[fact.claim_id]
    refs = [fact.claim_id]
    return [slide(1, ID, "hero" if piece.stat else "hero_text", [
        text("kicker", ctx.topic or "Dato del día"),
        text("stat", piece.stat, refs),
        text("headline", piece.headline, refs),
        text("body", piece.body, refs),
        text("source", source_label(facts), refs),
        text("handle", ctx.handle),
    ], facts)]


STRATEGY = Strategy(
    id=ID,
    name="Cifra que frena el scroll",
    description="Una sola imagen con la cifra del dato enorme arriba, qué significa y la fuente.",
    goal="Alcance y compartidos",
    template_id="daily_fact",
    facts_needed=1,
    pick=lambda facts: pick_facts(facts, 1),
    headline_max=55,
    body_max=115,
    brief=("Pieza única. La cifra se lee primero y en grande; el titular explica en una frase qué "
           "significa esa cifra para la gente; el contexto dice quién lo midió y cuándo."),
    build=build,
)
