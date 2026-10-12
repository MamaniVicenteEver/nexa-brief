"""Valida un paquete de publicación contra las estrategias activas y el video real.

Los límites salen de los archivos de estrategia (nada está fijo en el código).
Además de largos y conteos, revisa lo que cuesta ver a ojo: que la miniatura no
repita su título de pareja, que los capítulos cumplan las reglas de YouTube, que
la imagen de la miniatura exista y tenga crédito y que cada cifra de títulos,
miniaturas e intro esté en el guion o en la transcripción.

Las cifras se verifican solo cuando están escritas con dígitos («37», «6.000
millones»): una cifra escrita con palabras en el título no se controla.

`error` = no se publica así. `warning` = conviene revisarlo.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from src.core.explainer.publishing.description import (
    GratitudeError,
    gratitude_text,
    gratitude_variant,
    render_youtube,
)
from src.core.explainer.publishing.numbers import digit_numbers, numbers_in
from src.core.explainer.publishing.package import PublishPackage, words_of
from src.core.explainer.publishing.strategies import ActiveStrategies
from src.core.metadata.sanitize import youtube_tags_length

Level = Literal["error", "warning"]


@dataclass(frozen=True)
class Issue:
    level: Level
    field: str
    message: str


def _in_range(value: int, bounds: tuple[int, int]) -> bool:
    return bounds[0] <= value <= bounds[1]


def _range_text(bounds: tuple[int, int]) -> str:
    return str(bounds[0]) if bounds[0] == bounds[1] else f"{bounds[0]}–{bounds[1]}"


def _shared_words(a: str, b: str, min_length: int) -> set[str]:
    def norm(text: str) -> set[str]:
        return {w.lower() for w in words_of(text) if len(w) >= min_length}

    return norm(a) & norm(b)


def _video_numbers(video_dir: Path) -> set[str]:
    """Cifras que el video dice: guion (palabras o dígitos) + transcripción de Whisper."""
    assets = video_dir / "assets"
    found: set[str] = set()
    script_path = assets / "script.json"
    if script_path.exists():
        script = json.loads(script_path.read_text(encoding="utf-8"))
        for segment in script.get("segments", []):
            found |= numbers_in(segment.get("text", ""))
    lyrics_path = assets / "lyrics.json"
    if lyrics_path.exists():
        lyrics = json.loads(lyrics_path.read_text(encoding="utf-8"))
        text = " ".join(
            w.get("word", w.get("text", "")) for s in lyrics.get("segments", []) for w in s.get("words", [])
        )
        found |= numbers_in(text)
    return found


def _credited_files(video_dir: Path) -> str:
    credits_path = video_dir / "assets" / "media" / "CREDITS.md"
    return credits_path.read_text(encoding="utf-8") if credits_path.exists() else ""


def check_package(
    package: PublishPackage,
    strategies: ActiveStrategies,
    video_dir: Path,
    duration_seconds: float | None,
) -> list[Issue]:
    issues: list[Issue] = []

    def error(field: str, message: str) -> None:
        issues.append(Issue("error", field, message))

    def warning(field: str, message: str) -> None:
        issues.append(Issue("warning", field, message))

    title_rules, thumb_rules = strategies.title, strategies.thumbnail
    platform_rules, desc_rules, tag_rules = strategies.platforms, strategies.description, strategies.tags
    titles = package.titles

    # ── títulos de YouTube ────────────────────────────────────────────────────
    if len(titles.youtube) != title_rules.options:
        error("titles.youtube", f"hacen falta {title_rules.options} títulos, hay {len(titles.youtube)}")
    for t in titles.youtube:
        if len(t.text) > title_rules.max_chars:
            error(f"titles.youtube.{t.option}", f"{len(t.text)} caracteres (máximo {title_rules.max_chars}): «{t.text}»")
        if str(t.strategy) not in title_rules.hook_strategies:
            error(f"titles.youtube.{t.option}", f"estrategia de gancho {t.strategy} no existe en {title_rules.id}")
    if title_rules.distinct_emotions:
        emotions = [t.emotion.lower() for t in titles.youtube]
        if len(set(emotions)) != len(emotions):
            warning("titles.youtube", f"emociones repetidas {emotions}: Test & Compare compararía lo mismo")

    # ── miniaturas y su título de pareja ──────────────────────────────────────
    text_only = package.thumbnail.text_only
    n_words = len(words_of(text_only.text))
    if not _in_range(n_words, thumb_rules.text_only.words):
        error("thumbnail.text_only", f"{n_words} palabras (deben ser {_range_text(thumb_rules.text_only.words)})")
    if not _in_range(len(text_only.lines), thumb_rules.text_only.lines):
        error("thumbnail.text_only", f"{len(text_only.lines)} renglones (deben ser {_range_text(thumb_rules.text_only.lines)})")
    for line in text_only.lines:
        if len(line) > thumb_rules.text_only.max_chars_per_line:
            error("thumbnail.text_only", f"renglón de {len(line)} caracteres (máximo {thumb_rules.text_only.max_chars_per_line}): «{line}»")
    with_image = package.thumbnail.with_image
    n_words = len(words_of(with_image.text))
    if not _in_range(n_words, thumb_rules.with_image.words):
        error("thumbnail.with_image", f"{n_words} palabras (deben ser {_range_text(thumb_rules.with_image.words)})")
    if with_image.image is None:
        severity = error if package.thumbnail.chosen == "with_image" else warning
        severity("thumbnail.with_image", "falta conseguir la imagen: hasta entonces se usa la opción solo texto")
    else:
        if not (video_dir / "assets" / "media" / with_image.image).is_file():
            error("thumbnail.with_image", f"la imagen {with_image.image} no está en assets/media/")
        elif with_image.image not in _credited_files(video_dir):
            error("thumbnail.with_image", f"la imagen {with_image.image} no tiene crédito en assets/media/CREDITS.md")
    for field, text, pair in (
        ("thumbnail.text_only", text_only.text, text_only.pair_title),
        ("thumbnail.with_image", with_image.text, with_image.pair_title),
    ):
        pair_title = titles.option(pair)
        if pair_title is None:
            error(field, f"el título de pareja «{pair}» no existe")
            continue
        repeated = _shared_words(text, pair_title.text, thumb_rules.min_shared_word_length)
        if repeated:
            error(field, f"repite palabras de su título de pareja {pair}: {sorted(repeated)}")

    # ── Facebook y TikTok/Reels ───────────────────────────────────────────────
    first_line = titles.facebook.first_line
    if len(first_line) > platform_rules.facebook_first_line_max_chars:
        error("titles.facebook", f"primera línea de {len(first_line)} caracteres (máximo {platform_rules.facebook_first_line_max_chars})")
    caption = titles.tiktok.caption
    if len(caption) > platform_rules.tiktok_caption_max_chars:
        error("titles.tiktok", f"caption de {len(caption)} caracteres (máximo {platform_rules.tiktok_caption_max_chars})")
    n_words = len(words_of(package.intro.text))
    if not _in_range(n_words, platform_rules.screen_text_words):
        error("intro", f"texto de 0–3 s de {n_words} palabras (deben ser {_range_text(platform_rules.screen_text_words)})")
    forbidden = {h.lower() for h in platform_rules.forbidden_hashtags}
    for field, tags in (("tags.tiktok", package.tags.tiktok), ("tags.facebook", package.tags.facebook)):
        for tag in tags:
            if tag.lower() in forbidden:
                error(field, f"{tag} está prohibido (no clasifica el tema)")

    # ── descripción ───────────────────────────────────────────────────────────
    chapters = package.description.chapters
    if len(chapters) < desc_rules.chapters.min_count:
        error("description.chapters", f"{len(chapters)} capítulos (mínimo {desc_rules.chapters.min_count})")
    if chapters and chapters[0].seconds != 0:
        error("description.chapters", f"el primer capítulo empieza en {chapters[0].at}, debe ser 0:00")
    for prev, cur in zip(chapters, chapters[1:]):
        gap = cur.seconds - prev.seconds
        if gap < desc_rules.chapters.min_gap_seconds:
            error("description.chapters", f"{prev.at} → {cur.at}: {gap} s (mínimo {desc_rules.chapters.min_gap_seconds})")
    if chapters and duration_seconds is not None:
        last_gap = duration_seconds - chapters[-1].seconds
        if last_gap < desc_rules.chapters.min_gap_seconds:
            error(
                "description.chapters",
                f"el capítulo {chapters[-1].at} dura {max(last_gap, 0):.0f} s hasta el final "
                f"(mínimo {desc_rules.chapters.min_gap_seconds})",
            )
    try:
        variant = gratitude_variant(video_dir.name, package, strategies.gratitude)
        gratitude = gratitude_text(variant, package, strategies.gratitude)
    except GratitudeError as exc:
        error("description.gratitude", str(exc))
    else:
        length = len(render_youtube(package, gratitude, desc_rules))
        if length > desc_rules.max_chars:
            error("description", f"la descripción armada tiene {length} caracteres (máximo {desc_rules.max_chars})")
    if not package.sources:
        error("sources", "sin fuentes: el bloque FUENTES quedaría vacío (completar desde PLAN.md)")
    if not package.credits:
        error("credits", "sin créditos de imágenes: las licencias CC BY-SA exigen atribución")

    # ── tags y hashtags ───────────────────────────────────────────────────────
    tags = package.tags
    if not _in_range(len(tags.youtube), tag_rules.youtube_tags):
        error("tags.youtube", f"{len(tags.youtube)} tags (deben ser {_range_text(tag_rules.youtube_tags)})")
    total_chars = youtube_tags_length(tags.youtube)
    if total_chars > tag_rules.youtube_tags_max_chars:
        error("tags.youtube", f"{total_chars} caracteres (máximo {tag_rules.youtube_tags_max_chars})")
    for field, values, bounds in (
        ("tags.youtube_hashtags", tags.youtube_hashtags, tag_rules.youtube_hashtags),
        ("tags.tiktok", tags.tiktok, tag_rules.tiktok_hashtags),
        ("tags.facebook", tags.facebook, tag_rules.facebook_hashtags),
    ):
        if not _in_range(len(values), bounds):
            error(field, f"{len(values)} hashtags (deben ser {_range_text(bounds)})")
        for value in values:
            if not value.startswith("#") or " " in value:
                error(field, f"«{value}» no es un hashtag")
    for platform, required in strategies.category.required_hashtags.items():
        present = {"youtube": tags.youtube_hashtags, "tiktok": tags.tiktok, "facebook": tags.facebook}[platform]
        missing = [h for h in required if h.lower() not in {p.lower() for p in present}]
        if missing:
            error(f"tags.{platform}", f"faltan los hashtags fijos de {strategies.category.channel}: {missing}")

    # ── cifras: lo que se promete tiene que estar en el video ─────────────────
    said = _video_numbers(video_dir)
    promised = [
        *((f"titles.youtube.{t.option}", t.text) for t in titles.youtube),
        ("titles.facebook", f"{titles.facebook.title} {titles.facebook.first_line}"),
        ("titles.tiktok", caption),
        ("thumbnail.text_only", text_only.text),
        ("thumbnail.with_image", with_image.text),
        ("intro", f"{package.intro.text} {package.intro.sub}"),
    ]
    for field, text in promised:
        missing = sorted(digit_numbers(text) - said)
        if missing:
            error(field, f"cifras que el video no dice: {missing}")

    return issues
