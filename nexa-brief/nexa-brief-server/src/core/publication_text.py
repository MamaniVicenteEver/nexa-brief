"""Texto de publicación limpio: sin URL, sin dominios y sin créditos de medios."""

from __future__ import annotations

import re

from src.core.nodemotion.promo.credits import remove_credit_block

_URL = re.compile(r"(?:https?://|www\.)\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|tv|es|me|co|info)(?:/\S*)?\b", re.I)

# Líneas que son bloques de créditos o fuentes de medios: se quitan enteras.
_CREDIT_LINE = re.compile(
    r"^\s*(Cr[ée]ditos?\b|Licencias?\b|Fuentes?\b|Fotos? recortadas|Fotos? animadas|File:|Música:|"
    r"Adaptaci[oó]n audiovisual CC|Fin de cr[ée]ditos)"
    r"|(·\s*CC\b|CC BY|CC0|Pexels License|dominio p[uú]blico|Undaunted|Kevin MacLeod|"
    r"animad[ao]s? a partir|recortad[ao] y animad[ao]|Fotograf[ií]as hist[oó]ricas|cesi[oó]n del titular|autor supuesto)",
    re.I,
)
# Frases de nota de créditos dentro de un párrafo.
_CREDIT_SENTENCES = [
    re.compile(r"\s*Faltan [^.\n]*?(cr[ée]ditos|licencias)[^.\n]*\.", re.I),
    re.compile(r"\s*Música: [^.\n]*\.", re.I),
    re.compile(r"\s*Imagen: [^.\n]*\.", re.I),
    re.compile(r"\s*Cr[ée]ditos (de|del|para) [^.\n]*\.", re.I),
]


def strip_credit_text(text: str) -> str:
    lines = []
    for line in text.split("\n"):
        if _CREDIT_LINE.search(line) and len(line) < 300:
            continue
        for rx in _CREDIT_SENTENCES:
            line = rx.sub("", line)
        lines.append(line.rstrip())
    out = "\n".join(lines)
    out = re.sub(r"[ \t]+\n", "\n", out)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


def strip_urls(text: str) -> str:
    if not isinstance(text, str) or not text:
        return text
    text = strip_credit_text(remove_credit_block(text))
    lines = []
    for line in text.split("\n"):
        new = _URL.sub("", line)
        new = re.sub(r"\(\s*\)", "", new)
        new = re.sub(r"·\s*·", "·", new)
        new = re.sub(r"\s+([,;:.])", r"\1", new)
        new = re.sub(r"([:,])\s*;", ";", new)
        new = re.sub(r"\s*[·•|-]\s*$", "", new)
        new = re.sub(r"[ \t]{2,}", " ", new).rstrip()
        if line.strip() and not new.strip():
            continue
        lines.append(new)
    out = "\n".join(lines)
    out = re.sub(r"Licencias:\n(?=Fin de)", "", out)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


def strip_copies(copies: dict) -> dict:
    """Aplica strip_urls a title, description y pinned_comment de cada plataforma."""
    result = {}
    for platform, copy in copies.items():
        update = {field: strip_urls(getattr(copy, field)) for field in ("title", "description", "pinned_comment")
                  if isinstance(getattr(copy, field, None), str)}
        result[platform] = copy.model_copy(update=update) if update else copy
    return result
