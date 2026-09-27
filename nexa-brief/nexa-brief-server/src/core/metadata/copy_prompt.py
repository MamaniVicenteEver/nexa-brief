"""Builds the AI prompt from the voice guide + the active strategies + the song facts.

The prompt is generated from the strategy files, so adding a field or a new
strategy never requires editing this module.
"""

from __future__ import annotations

import json

from src.core.metadata.language import ContentLanguage
from src.core.metadata.strategies import CopyStrategy, FieldSpec, Platform, load_voice

_LANGUAGE_NAMES: dict[ContentLanguage, str] = {"es": "español", "en": "inglés (English)"}
_PLATFORM_NAMES: dict[str, str] = {"youtube": "YOUTUBE", "tiktok": "TIKTOK", "facebook": "FACEBOOK"}

_SYSTEM = """\
{voice}

## Formato
Respondes ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después y sin bloques de código.
"""

_USER = """\
IDIOMA OBLIGATORIO: {language_name} (código "{language}"). Todo lo que escribas va en ese idioma.

DATOS DE LA CANCIÓN (son los únicos hechos conocidos):
{facts}

QUÉ TIENES QUE ESCRIBIR
Los ejemplos de abajo son de OTRAS canciones: úsalos como modelo de estilo y de largo, nunca los copies ni los adaptes palabra por palabra. Todo tiene que salir de esta canción.

Primero identifica la canción (sirve para todas las plataformas):
- artist: nombre del artista, limpio. null si no se conoce con seguridad.
- song: nombre de la canción, limpio (sin "Audio", "Official", "Video", números ni extensiones), escrito como aparece en plataformas de música: mayúscula inicial en cada palabra ("Dueles Tan Bien"). null si no se conoce.

{platform_sections}

Cada plataforma tiene su propio texto: no repitas la misma frase entre plataformas.

RESPONDE CON ESTE JSON (mismas claves, tus valores):
{skeleton}
"""


def _describe_field(name: str, spec: FieldSpec, language: ContentLanguage) -> str:
    if spec.type == "text":
        kind = f"texto, máximo {spec.max_chars} caracteres" if spec.max_chars else "texto"
    else:
        count = (
            f"exactamente {spec.min_items}" if spec.min_items == spec.max_items and spec.min_items
            else f"entre {spec.min_items or 1} y {spec.max_items or 'varios'}"
        )
        kind = f"lista de {count} elementos"
    lines = [f"- {name} ({kind}): {spec.instruction}"]
    good = spec.examples.get(language) or []
    if good:
        rendered = " | ".join(json.dumps(e, ensure_ascii=False) for e in good)
        lines.append(f"    Así sí: {rendered}")
    bad = spec.avoid.get(language) or []
    if bad:
        lines.append(f"    Así no: {' | '.join(json.dumps(e, ensure_ascii=False) for e in bad)}")
    return "\n".join(lines)


def _skeleton(strategies: dict[Platform, CopyStrategy]) -> str:
    shape: dict = {"artist": "...", "song": "..."}
    for platform, strategy in strategies.items():
        shape[platform] = {
            name: (["..."] if spec.type == "list" else "...") for name, spec in strategy.fields.items()
        }
    return json.dumps(shape, ensure_ascii=False, indent=2)


def build_copy_prompt(
    strategies: dict[Platform, CopyStrategy], facts: str, language: ContentLanguage
) -> tuple[str, str]:
    """Returns (system, user) prompts."""
    sections = []
    for platform, strategy in strategies.items():
        fields = "\n".join(_describe_field(n, s, language) for n, s in strategy.fields.items())
        sections.append(f"{_PLATFORM_NAMES[platform]} — {strategy.name}\n{strategy.description}\n{fields}")

    system = _SYSTEM.format(voice=load_voice().strip())
    user = _USER.format(
        language_name=_LANGUAGE_NAMES[language],
        language=language,
        facts=facts,
        platform_sections="\n\n".join(sections),
        skeleton=_skeleton(strategies),
    )
    return system, user


def build_retry_note(errors: list[str]) -> str:
    listed = "\n".join(f"- {e}" for e in errors)
    return f"\n\nTu respuesta anterior tenía estos problemas. Corrígelos y devuelve el JSON completo otra vez:\n{listed}"
