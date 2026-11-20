"""Copy writer — produces the publishable title/description/tags for every platform.

Flow (one AI call, at most one retry):
  facts about the song ─► prompt built from voice.md + active strategies
  ─► AI returns the pieces as JSON ─► pieces validated (retry once with the
  list of broken rules) ─► each platform's strategy templates assemble the
  final text.

Kept independent from the pipeline (takes plain inputs, returns a result) so
scripts/preview_copy.py can run it in isolation to try strategies on a song.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import structlog

from src.config.niche_config import NicheConfig
from src.core.job import Job
from src.core.metadata import (
    ContentLanguage,
    CopyPieces,
    CopyStrategy,
    RenderedCopy,
    active_strategies,
    build_copy_prompt,
    build_retry_note,
    parse_pieces,
    render_copy,
)
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

_LYRICS_EXCERPT_CHARS = 900


@dataclass
class CopyResult:
    copies: dict[str, RenderedCopy]
    pieces: CopyPieces
    system_prompt: str
    user_prompt: str
    raw_responses: list[dict[str, Any]] = field(default_factory=list)
    unresolved_errors: list[str] = field(default_factory=list)
    thumbnail_options: dict[str, str] = field(default_factory=dict)
    thumbnail_selected: str = "A"
    promo_prompt_reference: dict[str, Any] | None = None


def _thumbnail_prompt(profile: str | None, promo_prompt_version: str | None = None) -> str:
    if profile == "commercial":
        from src.core.nodemotion.promo.prompts import compose
        guidance = compose("miniaturas", version=promo_prompt_version, include_base=False)
    else:
        guidance = (
            "A usa de 1 a 5 palabras del nombre limpio de la canción. B propone una frase distinta, "
            "breve (máximo 60 caracteres) y fiel a la letra o al tema. No inventes hechos."
        )
    return (
        "\n\nTEXTOS PARA LAS DOS OPCIONES DE MINIATURA\n"
        f"{guidance}\n"
        "Añade al objeto JSON raíz la clave \"thumbnail_options\" con esta forma exacta: "
        "{\"A\": \"texto breve\", \"B\": \"otro texto distinto\"}. "
        "Completa ambos textos en el idioma obligatorio. No incluyas artista, marca, LETRA, LYRIC VIDEO, emojis, hashtags ni comillas. "
        "B puede ser más larga que A, pero debe proceder de la letra o del contenido disponible. "
        "Añade al objeto raíz thumbnail_selected con el valor A o B: elegí la miniatura más clara y atractiva para este contenido."
    )


def _parse_thumbnail_options(raw: dict[str, Any]) -> tuple[dict[str, str], list[str]]:
    section = raw.get("thumbnail_options")
    if not isinstance(section, dict):
        return {}, ["falta la sección 'thumbnail_options' con A y B"]
    options: dict[str, str] = {}
    errors: list[str] = []
    for option in ("A", "B"):
        value = section.get(option)
        text = " ".join(value.split()) if isinstance(value, str) else ""
        if not text:
            errors.append(f"thumbnail_options.{option} está vacío o falta")
        elif len(text) > 60:
            errors.append(f"thumbnail_options.{option} tiene {len(text)} caracteres (máximo 60)")
        else:
            options[option] = text
    if len(options) == 2 and options["A"].casefold() == options["B"].casefold():
        errors.append("thumbnail_options.A y B deben tener textos distintos")
    return options, errors


# ── facts ───────────────────────────────────────────────────────────────────

def _lyrics_excerpt(lyrics_json: dict[str, Any] | None) -> str:
    segments = (lyrics_json or {}).get("segments") or []
    text = " / ".join(s.get("text", "").strip() for s in segments if s.get("text", "").strip())
    return text[:_LYRICS_EXCERPT_CHARS].rsplit(" ", 1)[0] if len(text) > _LYRICS_EXCERPT_CHARS else text


def _section(title: str, lines: list[str]) -> str:
    lines = [line for line in lines if line]
    return f"{title}:\n" + "\n".join(f"- {line}" for line in lines) if lines else ""


def _design_style(niche_cfg: NicheConfig) -> str:
    """La descripción visual del diseño (templates.json), sin su nombre."""
    from src.config.template_manifest import get_template_description

    template_id = niche_cfg.template.template_id if niche_cfg.template else None
    return get_template_description(template_id, "") if template_id else ""


def build_facts(job: Job, niche_cfg: NicheConfig, user_notes: str = "", research: str = "") -> str:
    """Only what is actually known about this video — the AI must not go beyond it."""
    artifacts = job.artifacts
    song = job.input.song_info
    music = artifacts.music_meta or {}
    vision = artifacts.vision_analysis
    analyzed = artifacts.analyzed_input

    commercial = copy_profile(niche_cfg) == "commercial"
    if commercial:
        kind = ("promo (comercial) editada con textos animados al ritmo de la música; la música solo acompaña,"
                " no es una canción para presentar")
    elif niche_cfg.template.requires_lyrics:
        kind = "video con la letra de la canción en pantalla (lyric video)"
    else:
        kind = "video musical con visuales animados (sin letra en pantalla)"
    sections = [_section("Tipo de video", [kind])]
    style = _design_style(niche_cfg)
    if style:
        sections.append(_section("Cómo se ve el video (descríbelo con tus palabras; nunca lo nombres)", [style]))
    if song:
        sections.append(_section("Canción según el usuario (fuente más confiable, usar tal cual)", [
            f"Nombre: {song.song_name}" if song.song_name else "",
            f"Artista: {song.artist}" if song.artist else "",
            f"De qué trata: {song.topic}" if song.topic else "",
            f"Descripción: {song.description}" if song.description else "",
        ]))
    if user_notes.strip():
        sections.append(_section("Lo que cuenta la persona sobre el contenido (fuente proporcionada; no inventes datos)",
                                 [user_notes.strip()]))
    if research.strip():
        sections.append(_section("Investigación previa (resumen de lo anterior y de la letra)", [research.strip()]))
    sections.append(_section("Pista de audio (nombre de archivo o catálogo: puede traer ruido como 'Audio', 'Official', números)", [
        f"Nombre: {music.get('track_name')}" if music.get("track_name") else "",
        f"Artista: {music.get('artist')}" if music.get("artist") else "",
        f"Género: {music.get('genre')}" if music.get("genre") else "",
    ]))
    from src.core.nodemotion.service import lyrics_for_job
    excerpt = _lyrics_excerpt(lyrics_for_job(job))
    if excerpt:
        title = ("Textos que aparecen en pantalla (los nombres de evento, equipos o marca salen de acá)" if commercial
                 else "Letra (transcrita del audio, puede tener pequeños errores)")
        sections.append(_section(title, [excerpt]))
    if vision is not None:
        overview = vision.get("scene_overview") or {}
        sections.append(_section("Imagen del video", [
            f"Sujeto: {(vision.get('main_subject') or {}).get('label', '')}",
            f"Escena: {overview.get('short_description', '')}",
        ]))
    meta = niche_cfg.metadata
    sections.append(_section("Guía del nicho", [
        f"Género: {meta.genre}" if meta.genre else "",
        f"Mood: {', '.join(meta.mood_tags)}" if meta.mood_tags else "",
    ]))
    if analyzed and niche_cfg.pipeline_type != "config_driven_template" and not meta.genre:
        sections.append(_section("Análisis automático (aproximado)", [
            f"Género: {analyzed.genre}",
            f"Mood: {', '.join(analyzed.mood_tags)}",
        ]))
    return "\n\n".join(s for s in sections if s)


# ── profile ─────────────────────────────────────────────────────────────────

def copy_profile(niche_cfg: NicheConfig) -> str | None:
    """Qué juego de estrategias usa este video: "commercial" para las promos (categoría
    `commercial` de templates.json), "visual" para los videos sin letra en pantalla (fondos,
    instrumental); None = el de canciones con letra."""
    from src.config.template_manifest import get_template_category_id

    template_id = niche_cfg.template.template_id if niche_cfg.template else None
    if template_id and get_template_category_id(template_id) == "commercial":
        return "commercial"
    if not niche_cfg.template.requires_lyrics:
        return "visual"
    return None


def copy_language(profile: str | None, detected: str) -> str:
    """Los textos van en el idioma del canal (COPY_LANGUAGE, español), sea canción o promo y
    aunque la canción esté en otro idioma: el nombre de la canción se deja como es."""
    from src.config.settings import settings

    return settings.copy_language or detected


# ── generation ──────────────────────────────────────────────────────────────

async def write_copy(
    ai: AIPort,
    facts: str,
    language: ContentLanguage,
    seed: str,
    strategies: dict[str, CopyStrategy] | None = None,
    profile: str | None = None,
    include_thumbnail_options: bool = False,
    promo_prompt_version: str | None = None,
) -> CopyResult:
    strategies = strategies or active_strategies(profile=profile)
    system, user = build_copy_prompt(strategies, facts, language, profile)
    promo_reference = None
    if profile == "commercial":
        from src.core.nodemotion.promo.prompts import compose, reference
        promo_reference = reference(version=promo_prompt_version)
        system = compose("publicar", version=promo_reference["version"]) + "\n\n" + system
    if include_thumbnail_options:
        user += _thumbnail_prompt(profile, promo_reference["version"] if promo_reference else None)

    raw = await ai.complete_json(system, user)
    raws = [raw]
    pieces, errors = parse_pieces(raw, strategies)
    thumbnail_options: dict[str, str] = {}
    if include_thumbnail_options:
        thumbnail_options, thumbnail_errors = _parse_thumbnail_options(raw)
        errors.extend(thumbnail_errors)
    selected_raw = raw.get("thumbnail_selected") if include_thumbnail_options else None
    thumbnail_selected = selected_raw.strip().upper() if isinstance(selected_raw, str) and selected_raw.strip().upper() in thumbnail_options else "A"
    if errors:
        logger.info("copy_writer_retry", errors=errors)
        raw = await ai.complete_json(system, user + build_retry_note(errors))
        raws.append(raw)
        retry_pieces, retry_errors = parse_pieces(raw, strategies)
        retry_thumbnail_options: dict[str, str] = {}
        if include_thumbnail_options:
            retry_thumbnail_options, retry_thumbnail_errors = _parse_thumbnail_options(raw)
            retry_errors.extend(retry_thumbnail_errors)
        if len(retry_errors) <= len(errors):
            pieces, errors = retry_pieces, retry_errors
            thumbnail_options = retry_thumbnail_options
            selected_raw = raw.get("thumbnail_selected") if include_thumbnail_options else None
            thumbnail_selected = selected_raw.strip().upper() if isinstance(selected_raw, str) and selected_raw.strip().upper() in thumbnail_options else "A"

    copies = {platform: render_copy(strategy, pieces, language, seed) for platform, strategy in strategies.items()}
    if errors:
        logger.warning("copy_writer_unresolved_errors", errors=errors)
    return CopyResult(copies, pieces, system, user, raws, errors, thumbnail_options, thumbnail_selected, promo_reference)
