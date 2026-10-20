"""Cifras de un texto, en dígitos o escritas en español, normalizadas a un mismo valor.

El guion escribe los números con palabras («treinta y siete», «seis mil
millones») para la voz y la transcripción de Whisper los trae en dígitos
(«37», «6.000 millones»): para verificar que una cifra del título o de la
miniatura está en el video, las dos formas se llevan al mismo número.

Valor canónico: el entero en dígitos («6000000000»); si no es entero, con coma
decimal («0,048»).
"""

from __future__ import annotations

import re
from decimal import Decimal

_UNITS = {
    "cero": 0, "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6,
    "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12, "trece": 13, "catorce": 14,
    "quince": 15, "dieciséis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19, "veinte": 20,
    "veintiún": 21, "veintiuno": 21, "veintiuna": 21, "veintidós": 22, "veintitrés": 23, "veinticuatro": 24,
    "veinticinco": 25, "veintiséis": 26, "veintisiete": 27, "veintiocho": 28, "veintinueve": 29,
    "treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80,
    "noventa": 90, "cien": 100, "ciento": 100, "doscientos": 200, "doscientas": 200, "trescientos": 300,
    "trescientas": 300, "cuatrocientos": 400, "cuatrocientas": 400, "quinientos": 500, "quinientas": 500,
    "seiscientos": 600, "seiscientas": 600, "setecientos": 700, "setecientas": 700, "ochocientos": 800,
    "ochocientas": 800, "novecientos": 900, "novecientas": 900,
}
_THOUSAND = "mil"
_MILLION = {"millón", "millones"}
_SCALES = {"mil": 1_000, "millón": 1_000_000, "millones": 1_000_000, "mil millones": 1_000_000_000}

# 1.178 · 13.500 · 2012 · 0,048, opcionalmente seguido de su escala: «6.000 millones», «7 mil millones»
_DIGITS = re.compile(
    r"(\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:,\d+)?)(?:\s+(mil\s+millones|millones|millón|mil)\b)?",
    re.IGNORECASE,
)
# Palabras y signos que cortan un número («sesenta y nueve. Mil novecientos setenta» son dos).
_TOKENS = re.compile(r"[\wÀ-ÿ]+|[.,;:!?¿¡()«»\"]")


def _canonical(value: Decimal) -> str:
    if value == value.to_integral_value():
        return str(int(value))
    return format(value.normalize(), "f").replace(".", ",")


def digit_numbers(text: str) -> set[str]:
    """Cifras escritas con dígitos (y su escala, si la tienen), en forma canónica."""
    found: set[str] = set()
    for digits, scale in _DIGITS.findall(text):
        value = Decimal(digits.replace(".", "").replace(",", "."))
        if scale:
            value *= _SCALES[" ".join(scale.lower().split())]
        found.add(_canonical(value))
    return found


def word_numbers(text: str) -> set[str]:
    """Cifras escritas con palabras («mil novecientos sesenta y nueve» → «1969»)."""
    found: set[str] = set()
    total = current = last = 0
    in_number = after_tens_and = False

    def flush() -> None:
        nonlocal total, current, last, in_number, after_tens_and
        if in_number:
            found.add(str(total + current))
        total = current = last = 0
        in_number = after_tens_and = False

    for token in _TOKENS.findall(text.lower()):
        if token in _UNITS:
            value = _UNITS[token]
            # Empieza otro número: dos menores que 100 seguidos sin «y» («dos tres»)
            # o una centena cuando el grupo ya tiene centenas («doscientos trescientos»).
            if in_number and not after_tens_and and (
                (0 < last < 100 and value < 100) or (value >= 100 and current >= 100)
            ):
                flush()
            current += value
            last, in_number, after_tens_and = value, True, False
        elif token == _THOUSAND:
            # «mil mil» son dos números; «dos mil», «mil novecientos» son uno.
            if in_number and last == 1000 and current == 0:
                flush()
            total += max(current, 1) * 1000
            current, last, in_number = 0, 1000, True
        elif token in _MILLION:
            total = max(total + current, 1) * 1_000_000
            current, last, in_number = 0, 1_000_000, True
        elif token == "y" and in_number and last in range(30, 100, 10):
            # «y» solo une decenas con unidades: «treinta y siete».
            after_tens_and = True
        else:
            flush()
    flush()
    return found


def numbers_in(text: str) -> set[str]:
    return digit_numbers(text) | word_numbers(text)
