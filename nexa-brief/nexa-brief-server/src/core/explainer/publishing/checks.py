"""Valida un paquete de publicación contra las estrategias activas y el video real.

Los límites salen de los archivos de estrategia (nada está fijo en el código).
Además de largos y conteos, revisa lo que cuesta ver a ojo: que la miniatura no
repita su título de pareja, que los capítulos cumplan las reglas de YouTube, que
la imagen de la miniatura exista y tenga crédito y que cada cifra de títulos,
miniaturas y antetítulo esté en el guion o en la transcripción.

Las cifras se verifican solo cuando están escritas con dígitos («37», «6.000
millones»): una cifra escrita con palabras en el título no se controla.

`error` = no se publica así. `warning` = conviene revisarlo.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from src.core.explainer.publishing.description import (
    GratitudeError,
    gratitude_text,
    gratitude_variant,
    render_youtube,
)
from src.core.explainer.publishing.numbers import bullet_numbers_in, digit_numbers, numbers_in
from src.core.explainer.publishing.package import PublishPackage, words_of
from src.core.explainer.publishing.strategies import ActiveStrategies
from src.core.explainer import narrative
from src.core.metadata.sanitize import has_emoji, youtube_tags_length

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


def _bullet_evidence_numbers(video_dir: Path, sources: list[str]) -> set[str]:
    """El dato del bullet debe estar en el guion o texto de fuentes, no solo en Whisper o una URL."""
    script_path = video_dir / "assets" / "script.json"
    script = json.loads(script_path.read_text(encoding="utf-8")) if script_path.exists() else {}
    text = " ".join(s.get("text", "") for s in script.get("segments", []))
    source_text = re.sub(r"https?://\S+", " ", " ".join(sources))
    return bullet_numbers_in(text) | bullet_numbers_in(source_text)


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
        # las dos opciones tienen que existir: la persona elige con cuál abre el video
        error("thumbnail.with_image", "falta la foto de la miniatura B (texto + imagen): las dos opciones son obligatorias")
    else:
        if not (video_dir / "assets" / "media" / with_image.image).is_file():
            error("thumbnail.with_image", f"la imagen {with_image.image} no está en assets/media/")
        elif with_image.image not in _credited_files(video_dir):
            error("thumbnail.with_image", f"la imagen {with_image.image} no tiene crédito en assets/media/CREDITS.md")
    tabloid = package.thumbnail.tabloid
    tabloid_text = (tabloid.text.strip() if tabloid else "") or text_only.text
    tabloid_active = tabloid is not None or package.thumbnail.chosen == "tabloid"
    if tabloid_active:
        tabloid_words = len(words_of(tabloid_text))
        if tabloid_words > 6:
            error("thumbnail.tabloid", f"{tabloid_words} palabras (máximo 6)")
    if tabloid:
        if tabloid.image and (tabloid.marker or tabloid.seal) and not tabloid.focus:
            warning("thumbnail.tabloid.focus", "marcador y sello requieren focus [x, y, r] sobre el recorte visible; se omitirán")
        for name in ("image", "image_after"):
            image_name = getattr(tabloid, name)
            if image_name and not (video_dir / "assets" / "media" / image_name).is_file():
                error(f"thumbnail.tabloid.{name}", f"la imagen {image_name} no está en assets/media/")
            elif image_name and image_name not in _credited_files(video_dir):
                error(f"thumbnail.tabloid.{name}", f"la imagen {image_name} no tiene crédito en assets/media/CREDITS.md")
        if tabloid.seal and tabloid.seal.casefold() in tabloid.strap.casefold():
            warning("thumbnail.tabloid.seal", "el sello repite el cintillo")
    recorded_story = narrative.recorded(video_dir).narrative_id
    story = None
    if recorded_story:
        try:
            story = narrative.get_service().get(recorded_story)
        except narrative.NarrativeError as exc:
            error("thumbnail.tabloid", f"no se pudo cargar la narrativa: {exc}")
    thumb_policy = story.thumbnail if story else None
    try:
        saved_config = json.loads((video_dir / "assets" / "config.json").read_text(encoding="utf-8"))
        saved_config = saved_config["configs"][0] if "configs" in saved_config else saved_config
        saved_manifest = json.loads((video_dir / "manifest.json").read_text(encoding="utf-8"))
        legacy_ready = (saved_config.get("quality_policy_version", 1) < 2
                        and saved_manifest.get("status") in ("listo", "renderizado"))
    except (OSError, ValueError, KeyError, TypeError):
        legacy_ready = False
    if thumb_policy and thumb_policy.preferred_option == "C" and package.thumbnail.chosen != "tabloid":
        error("thumbnail.chosen", "la narrativa amarillista exige la opción C: common.tabloid con dato rojo/amarillo")
    if thumb_policy and tabloid_active:
        if thumb_policy.require_bullet:
            bullet = tabloid.bullet if tabloid else ""
            nums = numbers_in(bullet)
            evidence = _bullet_evidence_numbers(video_dir, [])
            if not nums or (not digit_numbers(bullet) and nums <= {"1"} and "uno" not in bullet.casefold().split()):
                error("thumbnail.tabloid.bullet", "falta el 20 % rojo/amarillo: agrega un dato real del guion (ejemplo: «250 PUESTOS»)")
            elif nums - evidence:
                error("thumbnail.tabloid.bullet", f"cifra {sorted(nums - evidence)} ausente del guion; usa una cifra documentada")
        if thumb_policy.require_image_review:
            image_name = (tabloid.image if tabloid else None) or with_image.image
            reviews = tabloid.image_review if tabloid else []
            if not image_name or not any(r.image == image_name and r.verdict == "elegida" and r.reason.strip() for r in reviews):
                report = warning if legacy_ready else error
                report("thumbnail.tabloid.image_review", "revisa la foto elegida: indica image, verdict elegida y por qué comunica el tema de un vistazo")
    pairs = [
        ("thumbnail.text_only", text_only.text, text_only.pair_title),
        ("thumbnail.with_image", with_image.text, with_image.pair_title),
    ]
    if tabloid_active:
        pairs.append(("thumbnail.tabloid", tabloid_text, tabloid.pair_title if tabloid else "C"))
    for field, text, pair in pairs:
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

    # ── comentario fijado: dato extra + preguntas, natural ────────────────────
    pinned_rules, pinned = strategies.pinned, package.pinned_comment.strip()
    if len(pinned) > pinned_rules.max_chars:
        error("pinned_comment", f"{len(pinned)} caracteres (máximo {pinned_rules.max_chars}): más corto, como un comentario")
    if not pinned.startswith(pinned_rules.opener):
        error("pinned_comment", f"tiene que empezar con «{pinned_rules.opener}» y el dato")
    for opener in pinned_rules.forbidden_openers:
        if opener.lower() in pinned.lower():
            error("pinned_comment", f"«{opener}…» suena a plantilla: va directo al dato")
    questions = pinned.count("?")
    if questions != pinned_rules.questions or not pinned.endswith("?"):
        error("pinned_comment", f"termina con {pinned_rules.questions} preguntas (una sobre el tema, otra sobre qué quieren ver); tiene {questions}")
    if (issue := narrative.pinned_question_issue(video_dir, pinned)) is not None:
        error("pinned_comment", issue)   # la narrativa del video pide repetir su pregunta final

    # ── sin emojis (regla de los canales) ─────────────────────────────────────
    d = package.description
    texts = [
        *((f"titles.youtube.{t.option}", t.text) for t in titles.youtube),
        ("titles.facebook", f"{titles.facebook.title} {titles.facebook.first_line}"),
        ("titles.tiktok", caption),
        ("thumbnail", f"{text_only.text} {with_image.text}"),
        ("thumbnail.kicker", package.thumbnail.kicker),
        ("description", " ".join([d.hook, d.context, d.reflection, d.question, *(c.title for c in d.chapters)])),
        ("tags", " ".join([*tags.youtube, *tags.youtube_hashtags, *tags.tiktok, *tags.facebook])),
        ("pinned_comment", package.pinned_comment),
    ]
    if tabloid_active:
        texts.append(("thumbnail.tabloid", f"{tabloid_text} {tabloid.strap if tabloid else ''} {tabloid.seal if tabloid else ''} {tabloid.tape_text if tabloid else ''} {tabloid.bullet if tabloid else ''} {tabloid.before_label if tabloid else ''} {tabloid.after_label if tabloid else ''}"))
    for field, text in texts:
        if has_emoji(text):
            error(field, "tiene emojis: los canales no los usan (en ningún texto)")

    # ── cifras: lo que se promete tiene que estar en el video ─────────────────
    said = _video_numbers(video_dir)
    promised = [
        *((f"titles.youtube.{t.option}", t.text) for t in titles.youtube),
        ("titles.facebook", f"{titles.facebook.title} {titles.facebook.first_line}"),
        ("titles.tiktok", caption),
        ("thumbnail.text_only", text_only.text),
        ("thumbnail.with_image", with_image.text),
        ("thumbnail.kicker", package.thumbnail.kicker),
        ("pinned_comment", package.pinned_comment),
    ]
    if tabloid_active:
        promised.append(("thumbnail.tabloid", tabloid_text))
        if tabloid:
            promised.extend((f"thumbnail.tabloid.{name}", getattr(tabloid, name)) for name in
                            ("strap", "seal", "tape_text", "bullet", "before_label", "after_label"))
    for field, text in promised:
        evidence = (_bullet_evidence_numbers(video_dir, package.sources)
                    if field == "thumbnail.tabloid.bullet" and thumb_policy and thumb_policy.require_bullet
                    else said)
        missing = sorted(digit_numbers(text) - evidence)
        if missing:
            error(field, f"cifras que el video no dice: {missing}")

    return issues
