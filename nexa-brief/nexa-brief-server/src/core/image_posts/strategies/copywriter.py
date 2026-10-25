"""Redactor de las piezas: convierte hechos verificados en cifra + titular + contexto.

Usa el modelo del rol `copy_draft` (src/skills/models/roles.json). Nunca agrega información:
cada cifra de la respuesta tiene que estar en el hecho; si no, ese hecho usa `fallback_copy`.
Si el modelo no está disponible o falla, todo usa `fallback_copy` (el post sale igual).
`NEXA_IMAGE_COPY_MODEL=off` apaga el modelo (tests, o para comparar contra las reglas).
"""
from __future__ import annotations

import json
import os
from typing import Any

from .base import Copy, Fact, Strategy, StrategyContext, fallback_copy, numbers_in, spanish_numbers, trim_words

ROLE = "copy_draft"

SYSTEM = """Eres editor de posts de imagen para Instagram y Facebook del canal {brand}.
Tono: {voice}. Escribes en español neutro (sin voseo ni modismos regionales).
Conviertes hechos verificados en piezas que detienen el scroll SIN cambiar ni agregar información.

Para cada hecho devuelves:
- stat: la cifra más reveladora del hecho, copiada del hecho, con su unidad corta (máx. 9
  caracteres; abrevia unidades: s, min, h, km, M, mil). Formato español: miles con punto (15.000), decimales con coma (7,3), "%" separado
  ("7,3 %"). Si una caída es explícita, puedes anteponer "−". Si la cifra no se entiende sola,
  agrega una palabra de unidad ("15.000 devs", "3 años"). Si no hay cifra que importe: "".
- headline: qué significa ese dato para la gente, en una frase directa de máx. {headline_max}
  caracteres. No repitas la cifra del stat. Sin signos de exclamación, sin emojis, sin preguntas
  retóricas vacías.
- body: el contexto mínimo para entenderlo (quién lo midió, cuándo, a quién abarca), máx.
  {body_max} caracteres. No repitas el titular. Si la cifra es un porcentaje, el contexto dice
  de quiénes (el total o la población) y cuándo.
- short: el titular en máx. 36 caracteres, para un resumen.
- topic: tema del conjunto en 2 a 4 palabras (máx. 24 caracteres), para la etiqueta superior.
- image_query: (solo si se pide foto) búsqueda en inglés para Wikimedia Commons del objeto, lugar
  o persona concretos del hecho (p. ej. "RMS Titanic Southampton 1912"); wiki_article: título exacto
  del artículo de Wikipedia en español sobre ese sujeto.

Prohibido: cifras, fechas, nombres o afirmaciones que no estén en el hecho; opiniones; palabras
como "increíble", "impactante", "brutal"; presentar una proyección como hecho observado.
Pieza: {brief}
Responde SOLO JSON: {{"topic": "...", "image_query": "", "wiki_article": "", "items": [{{"claim_id": "...", "stat": "...", "headline": "...", "body": "...", "short": "..."}}]}}"""


def _user_prompt(facts: list[Fact], ctx: StrategyContext, wants_media: bool = False) -> str:
    lines = [f"Gancho del video: {ctx.hook}", "Se pide foto: " + ("sí" if wants_media else "no"), "Hechos verificados:"]
    lines += [f"- {fact.claim_id} ({fact.source_name}): {fact.text}" for fact in facts]
    return "\n".join(lines)


def _faithful(value: str, fact: Fact) -> bool:
    """Toda cifra del texto redactado tiene que existir en el hecho."""
    allowed = numbers_in(fact.text)
    return all(number in allowed or number.lstrip("0") in allowed for number in numbers_in(value))


def _piece(raw: dict[str, Any], fact: Fact, strategy: Strategy) -> Copy:
    """Acepta campo por campo: un campo con una cifra inventada se reemplaza por el de reglas."""
    rules = fallback_copy(fact, strategy.headline_max, strategy.body_max)
    fields = {
        "stat": str(raw.get("stat") or "").strip(),
        "headline": trim_words(str(raw.get("headline") or ""), strategy.headline_max),
        "body": trim_words(str(raw.get("body") or ""), strategy.body_max),
    }
    if len(fields["stat"]) > 9:
        fields["stat"] = ""
    replaced = [name for name, value in fields.items() if not value and name == "headline" or not _faithful(value, fact)]
    for name in replaced:
        fields[name] = getattr(rules, name) or ""
    if "body" in replaced and "headline" not in replaced:
        # El resto del hecho no combina con un titular del modelo: va el hecho completo, recortado.
        fields["body"] = trim_words(spanish_numbers(fact.text), strategy.body_max)
    source = "modelo" if not replaced else "modelo; por reglas: " + ", ".join(replaced)
    short = trim_words(str(raw.get("short") or ""), 36)
    if not short or not _faithful(short, fact):
        short = trim_words(fields["headline"], 36)
    return Copy(stat=fields["stat"] or rules.stat, headline=fields["headline"], body=fields["body"] or None,
                source=source, short=short)


async def write(strategy: Strategy, facts: list[Fact], ctx: StrategyContext,
                ai: Any = None, usage_out: list[dict[str, Any]] | None = None) -> tuple[dict[str, Copy], str, dict[str, str]]:
    """Textos por claim_id + tema sugerido + extras (búsqueda de foto). Sin modelo → reglas."""
    if ai is None and os.environ.get("NEXA_IMAGE_COPY_MODEL", "").lower() == "off":
        return {fact.claim_id: fallback_copy(fact, strategy.headline_max, strategy.body_max, "modelo apagado")
                for fact in facts}, "", {}
    try:
        if ai is None:
            from src.adapters.models.hub import text_json_with_usage
        system = SYSTEM.format(brand=ctx.brand, voice=ctx.voice or "curioso y preciso",
                               headline_max=strategy.headline_max, body_max=strategy.body_max,
                               brief=strategy.brief)
        prompt = _user_prompt(facts, ctx, strategy.needs_media)
        if ai is None:
            result, usage = await text_json_with_usage(ROLE, system, prompt)
            if usage_out is not None:
                usage_out.append(usage)
        else:
            result = await ai.complete_json(system, prompt)
    except Exception as exc:  # sin clave, sin red o JSON inválido: el post sale con reglas
        reason = f"modelo no disponible ({type(exc).__name__})"
        return {fact.claim_id: fallback_copy(fact, strategy.headline_max, strategy.body_max, reason)
                for fact in facts}, "", {}
    by_id = {str(item.get("claim_id")): item for item in result.get("items", []) if isinstance(item, dict)}
    copy = {fact.claim_id: _piece(by_id[fact.claim_id], fact, strategy) if fact.claim_id in by_id
            else fallback_copy(fact, strategy.headline_max, strategy.body_max, "el modelo omitió el hecho")
            for fact in facts}
    topic = trim_words(str(result.get("topic") or ""), 24)
    extras = {key: " ".join(str(result.get(key) or "").split())[:90] for key in ("image_query", "wiki_article")}
    return copy, (topic if not numbers_in(topic) else ""), {k: v for k, v in extras.items() if v}


def to_json(copy: dict[str, Copy]) -> str:
    return json.dumps({key: vars(value) for key, value in copy.items()}, ensure_ascii=False)
