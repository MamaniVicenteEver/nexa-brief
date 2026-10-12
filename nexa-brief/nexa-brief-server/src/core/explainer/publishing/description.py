"""Arma las descripciones a partir de los bloques del paquete.

YouTube (9 bloques): gancho, contexto, capítulos, reflexión, agradecimiento,
pregunta, fuentes, créditos y hashtags. Facebook (más corta): primera línea,
reflexión, pregunta y hashtags. Un bloque vacío (p. ej. sin fuentes) no se
escribe: el validador lo reporta, pero el texto nunca lleva un marcador a medias.
"""

from __future__ import annotations

import hashlib

from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.publishing.strategies import DescriptionStrategy, GratitudeStrategy


def gratitude_variant(video_id: str, package: PublishPackage, strategy: GratitudeStrategy) -> str:
    """La variante elegida en el paquete o, si no hay, una fija por video (rota entre videos)."""
    if package.description.gratitude:
        return package.description.gratitude
    variants = sorted(strategy.variants)
    index = int(hashlib.sha1(video_id.encode()).hexdigest(), 16) % len(variants)
    return variants[index]


class GratitudeError(ValueError):
    """La variante de agradecimiento no existe o le falta el tema."""


def gratitude_text(variant: str, package: PublishPackage, strategy: GratitudeStrategy) -> str:
    template = strategy.variants.get(variant)
    if template is None:
        raise GratitudeError(f"la variante {variant} no existe en {strategy.id} ({sorted(strategy.variants)})")
    topic = package.description.gratitude_topic.strip()
    if "{tema}" in template and not topic:
        raise GratitudeError(f"la variante {variant} usa {{tema}}: completar description.gratitude_topic")
    return template.replace("{tema}", topic)


def _section(heading: str, lines: list[str]) -> str:
    return "\n".join([heading, *lines]) if lines else ""


def render_youtube(package: PublishPackage, gratitude: str, strategy: DescriptionStrategy) -> str:
    d = package.description
    blocks = [
        d.hook,
        d.context,
        _section(strategy.headings["chapters"], [f"{c.at} {c.title}" for c in d.chapters]),
        d.reflection,
        gratitude,
        d.question,
        _section(strategy.headings["sources"], [f"- {s}" for s in package.sources]),
        _section(strategy.headings["credits"], [f"- {c}" for c in package.credits]),
        " ".join(package.tags.youtube_hashtags),
    ]
    return "\n\n".join(block for block in blocks if block)


def render_facebook(package: PublishPackage) -> str:
    d = package.description
    blocks = [package.titles.facebook.first_line, d.reflection, d.question, " ".join(package.tags.facebook)]
    return "\n\n".join(block for block in blocks if block)
