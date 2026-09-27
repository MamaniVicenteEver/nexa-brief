"""Turns the AI's pieces into the final title/description/tags of each platform.

Two steps, both deterministic:
  1. `parse_pieces` normalizes the AI's JSON and lists every rule it broke
     (missing field, too long, wrong count) so the caller can ask once more.
  2. `render_copy` fills the strategy templates. Templates are tried in order:
     the first one whose placeholders all have a value and that fits the
     platform limit wins — e.g. without an artist, "{theme_question} |
     {artist} (Letra)" falls back to "{theme_question} | {song} (Letra)".
Rotating phrases are picked with a seed (the job id), so the same job always
renders the same text while different videos get different phrases.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from src.core.metadata.language import ContentLanguage
from src.core.metadata.sanitize import clean_description, clean_hashtags, clean_tags, clean_title, strip_emojis
from src.core.metadata.strategies import CopyStrategy, Platform, placeholders


class CopyRenderError(ValueError):
    """No template of a strategy could be rendered with the available pieces."""


@dataclass
class CopyPieces:
    artist: str | None
    song: str | None
    platforms: dict[str, dict[str, Any]] = field(default_factory=dict)


@dataclass(frozen=True)
class RenderedCopy:
    strategy_id: str
    title: str
    description: str
    tags: list[str]


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = strip_emojis(value).strip()
    return cleaned if cleaned and cleaned.lower() not in {"null", "none", "n/a"} else None


def parse_pieces(raw: dict[str, Any], strategies: dict[Platform, CopyStrategy]) -> tuple[CopyPieces, list[str]]:
    errors: list[str] = []
    pieces = CopyPieces(artist=_text(raw.get("artist")), song=_text(raw.get("song")))

    for platform, strategy in strategies.items():
        section = raw.get(platform) if isinstance(raw.get(platform), dict) else {}
        if not section:
            errors.append(f"falta la sección '{platform}'")
        values: dict[str, Any] = {}
        for name, spec in strategy.fields.items():
            value = section.get(name)
            if spec.type == "text":
                text = _text(value)
                if text is None:
                    errors.append(f"{platform}.{name} está vacío o falta")
                elif spec.max_chars and len(text) > spec.max_chars:
                    errors.append(f"{platform}.{name} tiene {len(text)} caracteres (máximo {spec.max_chars})")
                values[name] = text
            else:
                items = [t for t in (_text(v) for v in (value if isinstance(value, list) else [])) if t]
                if spec.min_items and len(items) < spec.min_items:
                    errors.append(f"{platform}.{name} tiene {len(items)} elementos (mínimo {spec.min_items})")
                if spec.max_items and len(items) > spec.max_items:
                    errors.append(f"{platform}.{name} tiene {len(items)} elementos (máximo {spec.max_items})")
                values[name] = items[: spec.max_items] if spec.max_items else items
        pieces.platforms[platform] = values
    return pieces, errors


def _pick_rotating(strategy: CopyStrategy, language: ContentLanguage, seed: str) -> dict[str, str]:
    return {
        key: random.Random(f"{seed}:{strategy.id}:{key}").choice(phrases[language])
        for key, phrases in strategy.rotating.items()
    }


def _render_first_fitting(templates: list[str], values: dict[str, Any], max_chars: int, kind: str, multiline: bool) -> str:
    candidates = [t for t in templates if all(values.get(p) for p in placeholders(t))]
    if not candidates:
        raise CopyRenderError(f"no {kind} template has all its pieces available")
    clean = clean_description if multiline else clean_title
    for template in candidates:
        text = clean(template.format(**values), limit=10_000)
        if len(text) <= max_chars:
            return text
    return clean(candidates[-1].format(**values), limit=max_chars)  # last resort: shortest option, trimmed


def render_copy(
    strategy: CopyStrategy,
    pieces: CopyPieces,
    language: ContentLanguage,
    seed: str,
) -> RenderedCopy:
    fields = pieces.platforms.get(strategy.platform, {})
    tag_items: list[str] = fields.get(strategy.output.tags.from_field) or []
    hashtag_items = clean_hashtags(fields.get("hashtags") or [], max_count=30)

    values: dict[str, Any] = {
        **{k: v for k, v in fields.items() if isinstance(v, str)},
        **_pick_rotating(strategy, language, seed),
        "artist": pieces.artist,
        "song": pieces.song,
        "hashtags": " ".join(f"#{h}" for h in hashtag_items) or None,
    }

    out = strategy.output
    title = _render_first_fitting(
        out.title.templates[language], values, out.title.max_chars, "title", out.title.multiline
    )
    if out.description.same_as == "title":
        description = title
    else:
        description = _render_first_fitting(
            out.description.templates[language], values, out.description.max_chars, "description", multiline=True
        )

    tags = clean_tags(tag_items) if out.tags.style == "keyword" else clean_hashtags(tag_items, max_count=30)
    return RenderedCopy(strategy_id=strategy.id, title=title, description=description, tags=tags)
