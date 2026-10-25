"""Piezas comunes de las estrategias: hechos verificados, textos por pieza y armado de láminas.

Una estrategia decide QUÉ se dice y en qué ORDEN (láminas, roles de texto, layout).
El CÓMO se ve lo decide el motor JS (`engine/image-engine.js`) con la piel de cada diseño.
El layout de cada lámina es `<estrategia>:<receta>` (p. ej. `cifra_que_frena:hero`): el motor
lo usa para elegir la receta visual y queda dentro del hash del plan.

Los textos de cada hecho (cifra, titular, contexto) los redacta `copywriter.py`; si el modelo
no responde o inventa algo, se usa `fallback_copy` (reglas, sin modelo).
"""
from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any, Callable

_UNITS = (r"(?:\s?(?:%|mil millones|millones|millón|mil|años|año|meses|días|horas|h|minutos|min|segundos|seg"
          r"|veces|personas|habitantes|muertos|víctimas|soldados|barcos|botes|km|kilómetros|metros|m|millas"
          r"|yardas|toneladas|kg|°C|dólares|euros|USD)(?![\wáéíóú]))?")
_NUMBER = re.compile(r"(?<![\w.,])(\d{1,3}(?:[.,\s]\d{3})+(?!\d)|\d+)(?:[.,](\d{1,2})(?!\d))?" + _UNITS, re.IGNORECASE)
_FALL_WORDS = ("caída", "cae ", "baja", "bajó", "pierde", "perdió", "reducción", "descenso")
_CLAUSE_MARKS = ("; ", ": ", ", ", " y ", " que ", " con ", " en ")
# Una frase cortada no termina en estas palabras ("decisiones de" → "decisiones").
_DANGLING = {"de", "del", "la", "el", "los", "las", "en", "y", "o", "a", "al", "que", "con", "por", "para", "un", "una", "su", "sus"}


@dataclass(frozen=True)
class Fact:
    """Hecho verificado de PLAN.md §3, con su fuente publicada."""

    claim_id: str
    text: str
    url: str
    source_name: str

    def claim_ref(self) -> dict[str, str]:
        number = self.claim_id.removeprefix("claim_")
        return {"id": self.claim_id, "source_id": f"source_{number}",
                "locator": f"PLAN.md §3, hecho {number}", "url": self.url}


@dataclass(frozen=True)
class Copy:
    """Textos de una pieza para un hecho. `stat` puede faltar (hecho sin cifra)."""

    stat: str | None
    headline: str
    body: str | None
    source: str = "reglas"   # "modelo" o "reglas: <motivo>": queda registrado para estudiar resultados
    short: str | None = None  # versión de ≤36 caracteres para resúmenes (cierre del carrusel)


@dataclass(frozen=True)
class StrategyContext:
    """Datos del canal y del video que la estrategia puede usar (todos verificados)."""

    category_id: str
    hook: str            # título/gancho del video (publish.json v2)
    topic: str           # tema corto para el kicker ("" = la estrategia pone el suyo)
    handle: str          # @cuenta de la red principal
    brand: str           # nombre del canal
    voice: str = ""      # tono del StyleSystem (para el redactor)


@dataclass(frozen=True)
class Strategy:
    """Receta editorial registrada. `build` devuelve las láminas del plan."""

    id: str
    name: str
    description: str
    goal: str
    template_id: str
    facts_needed: int
    headline_max: int
    body_max: int
    brief: str                      # qué le pide la estrategia al redactor
    pick: Callable[[list[Fact]], list[Fact]] = field(repr=False)   # qué hechos usa
    build: Callable[..., list[dict[str, Any]]] = field(repr=False)   # (facts, ctx, copy[, media])
    needs_media: bool = False                                          # pide fotos con licencia
    media_query: Callable[..., tuple[str, str | None]] | None = field(default=None, repr=False)


def numbers_in(text: str) -> set[str]:
    """Cifras de un texto, normalizadas (sin separadores) para comparar."""
    pattern = r"\d+(?:[.,]\d+|\s\d{3}(?!\d))*"   # "13,756" / "72.9" / "15 000", sin unir cifras distintas
    return {re.sub(r"[.,\s]", "", match.group(0)) for match in re.finditer(pattern, text)}


def extract_stat(text: str) -> str | None:
    """Cifra más significativa con su unidad: primero %, después con unidad, después la mayor."""
    candidates: list[tuple[int, str]] = []
    for match in _NUMBER.finditer(text):
        integer, decimals = match.group(1), match.group(2)
        unit = match.group(0)[len(integer) + (len(decimals) + 1 if decimals else 0):].strip()
        # Formato español en la salida: miles con punto ("15,000"/"15 000" → "15.000"), decimales con coma.
        integer = re.sub(r"[.,\s]", ".", integer)
        plain = float(integer.replace(".", "") + ("." + decimals if decimals else ""))
        if not unit and (1900 <= plain <= 2100 or plain < 100):
            continue  # años y números chicos sueltos ("10 de noviembre") no son una cifra que diga algo
        value = integer + ("," + decimals if decimals else "")
        before = text[max(0, match.start() - 40):match.start()].lower()
        sign = "−" if unit == "%" and any(word in before for word in _FALL_WORDS) else ""
        rank = 0 if unit == "%" else 1 if unit else 2
        candidates.append((rank, f"{sign}{value} {unit}".strip()))
    return min(candidates, key=lambda item: item[0])[1] if candidates else None


def stat_strength(fact: Fact) -> int:
    """2 = porcentaje, 1 = cifra con unidad u otra cifra, 0 = sin cifra (para elegir hechos)."""
    stat = extract_stat(fact.text) or ""
    return 2 if stat.endswith("%") else 1 if stat else 0


def pick_facts(facts: list[Fact], count: int) -> list[Fact]:
    """Los `count` hechos con cifra más fuerte, en su orden original (el relato no se desordena)."""
    best = sorted(range(len(facts)), key=lambda index: (-stat_strength(facts[index]), index))[:count]
    return [facts[index] for index in sorted(best)]


def spanish_numbers(text: str) -> str:
    """Cifras en formato español: "72.9%" → "72,9 %", "13,756" → "13.756"."""
    text = re.sub(r"(?<![\d.,])(\d{1,3}),(\d{3})(?![\d,])", r"\1.\2", text)
    text = re.sub(r"(?<![\d.,])(\d+)\.(\d{1,2})(?!\d)", r"\1,\2", text)
    return re.sub(r"(\d)%", r"\1 %", text)


def _without_dangling(text: str) -> str:
    words = text.rstrip(" ,;:").split(" ")
    while len(words) > 1 and words[-1].lower() in _DANGLING:
        words.pop()
    return " ".join(words).rstrip(" ,;:")


def trim_words(text: str, limit: int) -> str:
    """Corta en el último límite natural (cláusula o palabra), nunca dentro de una cifra."""
    text = " ".join(text.split()).rstrip(".")
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for mark in _CLAUSE_MARKS:
        position = cut.rfind(mark)
        if position > limit * 0.55:
            return _without_dangling(cut[:position])
    return _without_dangling(cut.rsplit(" ", 1)[0])


def fallback_copy(fact: Fact, headline_max: int, body_max: int, reason: str = "sin modelo") -> Copy:
    """Textos por reglas: titular corto + resto como contexto (nunca el mismo texto dos veces)."""
    clean = spanish_numbers(" ".join(fact.text.split()).rstrip("."))
    headline = trim_words(clean, headline_max)
    rest = clean[len(headline):].lstrip(" ,;:").strip()
    body = trim_words(rest[0].upper() + rest[1:], body_max) if rest else None
    return Copy(stat=extract_stat(fact.text), headline=headline, body=body, source=f"reglas: {reason}",
                short=trim_words(headline, 36))


def text(role: str, value: str | None, refs: list[str] | None = None) -> dict[str, Any] | None:
    """Rol de texto del plan; None si no hay valor (el motor no deja huecos)."""
    if not value:
        return None
    return {"role": role, "value": value, "claim_refs": refs or []}


def slide(order: int, strategy_id: str, layout: str, texts: list[dict[str, Any] | None],
          facts: list[Fact]) -> dict[str, Any]:
    """Lámina en el formato estricto de `plan.py`."""
    return {
        "slide_id": f"slide_{order:02}", "order": order, "layout": f"{strategy_id}:{layout}",
        "elements": [], "texts": [item for item in texts if item], "media": [],
        "claim_refs": [fact.claim_ref() for fact in facts],
    }


# Dominios que se muestran con su nombre conocido; el resto, sin "www." ni subdominio de idioma.
_KNOWN_SOURCES = {"wikipedia.org": "Wikipedia", "britannica.com": "Britannica", "bls.gov": "BLS"}


def readable_source(name: str) -> str:
    """"en.wikipedia.org" → "Wikipedia"; "www.titanicinquiry.org" → "titanicinquiry.org"."""
    host = name.strip().lower()
    if " " in host or "." not in host:
        return name.strip()
    host = re.sub(r"^(www|[a-z]{2})\.", "", host)
    return _KNOWN_SOURCES.get(host, host)


def source_label(facts: list[Fact]) -> str:
    names: list[str] = []
    for name in (readable_source(fact.source_name) for fact in facts):
        if any(name in kept for kept in names):
            continue  # "Stack Overflow" ya está dentro de "Stack Overflow Developer Survey 2026"
        names = [kept for kept in names if kept not in name] + [name]
    return "Fuente: " + " · ".join(names[:3])
