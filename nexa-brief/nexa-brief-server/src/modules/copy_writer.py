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


# ── facts ───────────────────────────────────────────────────────────────────

def _lyrics_excerpt(lyrics_json: dict[str, Any] | None) -> str:
    segments = (lyrics_json or {}).get("segments") or []
    text = " / ".join(s.get("text", "").strip() for s in segments if s.get("text", "").strip())
    return text[:_LYRICS_EXCERPT_CHARS].rsplit(" ", 1)[0] if len(text) > _LYRICS_EXCERPT_CHARS else text


def _section(title: str, lines: list[str]) -> str:
    lines = [line for line in lines if line]
    return f"{title}:\n" + "\n".join(f"- {line}" for line in lines) if lines else ""


def build_facts(job: Job, niche_cfg: NicheConfig) -> str:
    """Only what is actually known about this video — the AI must not go beyond it."""
    artifacts = job.artifacts
    song = job.input.song_info
    music = artifacts.music_meta or {}
    vision = artifacts.vision_analysis
    analyzed = artifacts.analyzed_input

    sections = [
        _section("Tipo de video", [
            "video con la letra de la canción en pantalla (lyric video)" if niche_cfg.template.requires_lyrics
            else "video musical con visuales animados (sin letra en pantalla)"
        ]),
    ]
    if song:
        sections.append(_section("Canción según el usuario (fuente más confiable, usar tal cual)", [
            f"Nombre: {song.song_name}" if song.song_name else "",
            f"Artista: {song.artist}" if song.artist else "",
            f"De qué trata: {song.topic}" if song.topic else "",
            f"Descripción: {song.description}" if song.description else "",
        ]))
    sections.append(_section("Pista de audio (nombre de archivo o catálogo: puede traer ruido como 'Audio', 'Official', números)", [
        f"Nombre: {music.get('track_name')}" if music.get("track_name") else "",
        f"Artista: {music.get('artist')}" if music.get("artist") else "",
        f"Género: {music.get('genre')}" if music.get("genre") else "",
    ]))
    excerpt = _lyrics_excerpt(artifacts.lyrics_json)
    if excerpt:
        sections.append(_section("Letra (transcrita del audio, puede tener pequeños errores)", [excerpt]))
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


# ── generation ──────────────────────────────────────────────────────────────

async def write_copy(
    ai: AIPort,
    facts: str,
    language: ContentLanguage,
    seed: str,
    strategies: dict[str, CopyStrategy] | None = None,
) -> CopyResult:
    strategies = strategies or active_strategies()
    system, user = build_copy_prompt(strategies, facts, language)

    raw = await ai.complete_json(system, user)
    raws = [raw]
    pieces, errors = parse_pieces(raw, strategies)
    if errors:
        logger.info("copy_writer_retry", errors=errors)
        raw = await ai.complete_json(system, user + build_retry_note(errors))
        raws.append(raw)
        retry_pieces, retry_errors = parse_pieces(raw, strategies)
        if len(retry_errors) <= len(errors):
            pieces, errors = retry_pieces, retry_errors

    copies = {platform: render_copy(strategy, pieces, language, seed) for platform, strategy in strategies.items()}
    if errors:
        logger.warning("copy_writer_unresolved_errors", errors=errors)
    return CopyResult(copies, pieces, system, user, raws, errors)
