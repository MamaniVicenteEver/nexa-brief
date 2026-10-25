"""Estrategia «La prueba a la vista» — imagen única 4:5 con una foto real de Wikimedia Commons.

Objetivo: comprensión y compartidos cuando la foto aporta lo que la cifra sola no transmite (el
objeto, el lugar, la persona o el documento del hecho). La foto es evidencia o contexto
identificable, nunca decoración: su crédito va separado de la fuente del dato.
Fundamento: docs/investigaciones/principios-diseno-imagenes-2026-10.md §4 y §7.

Receta según la foto (proporción ancho/alto):
  · `photo_top`  (B, por defecto)  foto horizontal arriba, explicación en panel sólido abajo.
  · `photo_side` (C)               foto vertical/estrecha a la derecha, texto a la izquierda.
  · `photo_full` (A)               foto casi 4:5 a sangre, velo local bajo el texto.
"""
from __future__ import annotations

from typing import Any

from .base import Copy, Fact, Strategy, StrategyContext, pick_facts, slide, source_label, text

ID = "prueba_a_la_vista"

# Mínimos de la foto de origen por receta (px), derivados de la geometría de exportación (§7.2).
_MIN_SIZE = {"photo_full": (1080, 1350), "photo_top": (1080, 620), "photo_side": (505, 920)}


def recipe_for(width: int, height: int) -> str:
    """Receta por proporción; si la foto no alcanza el mínimo de A o C, cae a B."""
    ratio = width / max(height, 1)
    recipe = "photo_top" if ratio >= 1.15 else "photo_side" if ratio <= 0.75 else "photo_full"
    min_w, min_h = _MIN_SIZE[recipe]
    return recipe if width >= min_w and height >= min_h else "photo_top"


def _media_ref(image: Any) -> dict[str, Any]:
    focus = [0.67, 0.42] if image.width / max(image.height, 1) < 1.15 else [0.5, 0.45]
    return {"asset_id": f"img_{image.sha256[:12]}", "sha256": image.sha256, "license_id": image.license,
            "author": image.author or "Autor desconocido", "url": image.source_url, "focus": focus}


def build(facts: list[Fact], ctx: StrategyContext, copy: dict[str, Copy], media: list[Any] | None = None) -> list[dict]:
    if not media:
        raise ValueError("La prueba a la vista necesita una foto con licencia")
    fact, image = facts[0], media[0]
    piece = copy[fact.claim_id]
    refs = [fact.claim_id]
    ref = _media_ref(image)
    page = slide(1, ID, recipe_for(image.width, image.height), [
        text("kicker", ctx.topic or "Imagen y dato"),
        text("headline", piece.headline, refs),
        text("body", piece.body, refs),
        text("credit", image.attribution),
        text("source", "Dato: " + source_label(facts).removeprefix("Fuente: "), refs),
        text("handle", ctx.handle),
    ], facts)
    page["elements"] = [{"type": "photo", "asset_id": ref["asset_id"], "value": image.title or "Foto de contexto"}]
    page["media"] = [ref]
    return [page]


def media_query(facts: list[Fact], ctx: StrategyContext, extras: dict[str, str]) -> tuple[str, str | None]:
    """Qué buscar en Commons: lo que propuso el redactor o, si no, el tema del video."""
    query = extras.get("image_query") or ctx.topic or ctx.hook
    article = extras.get("wiki_article") or ctx.topic or None
    return query, article


STRATEGY = Strategy(
    id=ID,
    name="La prueba a la vista",
    description="Una foto real (Wikimedia, con licencia) del objeto, lugar o persona del dato, con el titular y su fuente.",
    goal="Comprensión y compartidos",
    template_id="daily_fact",
    facts_needed=1,
    pick=lambda facts: pick_facts(facts, 1),
    headline_max=42,
    body_max=80,
    brief=("La foto muestra el sujeto del hecho. El titular dice qué prueba o qué muestra esa imagen sobre "
           "el dato, en pocas palabras; el contexto da quién/cuándo. No describas la foto: explícala."),
    build=build,
    needs_media=True,
    media_query=media_query,
)
