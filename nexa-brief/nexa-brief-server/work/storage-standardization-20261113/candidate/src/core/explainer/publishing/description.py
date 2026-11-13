"""Public descriptions: a brief opening, one question and a few hashtags.

The full research package keeps chapters, sources and credits as separate data.
"""

from __future__ import annotations

import hashlib

from src.core.social_caption import brief_caption

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
    return brief_caption(package.description.hook, package.description.question, package.tags.youtube_hashtags)


def render_facebook(package: PublishPackage) -> str:
    return brief_caption(package.titles.facebook.first_line, package.description.question, package.tags.facebook)
