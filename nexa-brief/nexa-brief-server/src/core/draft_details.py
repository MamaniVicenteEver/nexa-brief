"""Detalles de un prototipo (draft) de NodeMotion: los textos de publicación preparados ANTES de grabar.

«Preparar» genera, sobre el Job del preview (ya tiene la canción y la letra transcrita), lo mismo que
la etapa result_summarizer del pipeline: nombre de la canción, artista y título/descripción/etiquetas
por red con las estrategias activas (src/skills/output/copy/active.json). La persona los revisa y edita
en «Detalles»; al grabar se vuelcan al Job y result_summarizer los usa tal cual, sin volver a la IA.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from typing import Any

from pydantic import BaseModel, Field

from src.core.job import Job, PlatformCopyText, VideoSummary

PLATFORMS = ("youtube", "facebook", "instagram", "tiktok")


class PlatformDetails(BaseModel):
    title: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list)
    strategy: str = ""
    # YouTube: el comentario que se publica y se fija.
    pinned_comment: str = Field(default="", max_length=1000)


class DraftDetails(BaseModel):
    song_name: str = Field(default="", max_length=200)
    artist: str = Field(default="", max_length=200)
    language: str | None = None
    copies: dict[str, PlatformDetails] = Field(default_factory=dict)
    generated_at: str | None = None
    # «Investigación previa»: lo que la IA ordenó de la información que dio la persona (si la dio).
    research: str = ""
    # True cuando la persona los editó: volver a «Preparar» los pisaría.
    edited: bool = False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def song_of(job: Job, detected_song: str | None = None, detected_artist: str | None = None) -> tuple[str, str]:
    """Nombre y artista: lo que dijo la persona; si no, lo que reconoció la IA al escribir los textos
    («Dueles Tan Bien» · «Bruses»); y por último el nombre del archivo («Bruses Dueles Tan Bien Audio»)."""
    song = job.input.song_info
    music = job.artifacts.music_meta or {}
    name = (song.song_name if song else None) or detected_song or music.get("track_name") or ""
    artist = (song.artist if song else None) or detected_artist or music.get("artist") or ""
    return str(name).strip(), str(artist).strip()


_RESEARCH_SYSTEM = """Ordenas lo que se sabe de una canción para quien va a escribir sus textos de publicación.
Respondes ÚNICAMENTE con un objeto JSON válido: {"song": str|null, "artist": str|null, "facts": [str, ...]}.
- facts: de 3 a 5 frases cortas sobre de qué trata la canción, a quién le habla, su contexto o su género.
- Solo lo que dice la persona o se desprende de la letra. Nunca inventes fechas, álbumes, premios ni datos que no te dieron.
- song/artist: como aparecen en plataformas de música, o null si no se sabe con seguridad."""


async def research(ai: Any, notes: str, facts: str) -> str:
    """Investigación previa breve: ordena la información que dio la persona junto con la letra."""
    raw = await ai.complete_json(_RESEARCH_SYSTEM, f"LO QUE CUENTA LA PERSONA:\n{notes.strip()}\n\nDATOS DEL VIDEO:\n{facts}")
    lines = [f"- {f.strip()}" for f in (raw.get("facts") or []) if isinstance(f, str) and f.strip()][:5]
    if raw.get("song"):
        lines.insert(0, f"- Canción: {raw['song']}" + (f" · {raw['artist']}" if raw.get("artist") else ""))
    return "\n".join(lines)


async def generate(job: Job, niche_id: str, seed: str, notes: str = "") -> DraftDetails:
    """Pide los textos con las estrategias activas (una llamada a la IA, como al grabar). Con `notes`
    (información de la canción que escribió la persona) antes hace una investigación breve."""
    # imports diferidos: arrastran adaptadores de IA y la config de nichos
    from src.adapters.ai.factory import get_copy_ai
    from src.config.niche_config import get_niche_config
    from src.modules.content_language import resolve_content_language
    from src.modules.copy_writer import build_facts, copy_language, copy_profile, write_copy

    niche_cfg = get_niche_config(niche_id)
    profile = copy_profile(niche_cfg)
    language_code = copy_language(profile, (await resolve_content_language(job)).code)
    ai = get_copy_ai()
    found = await research(ai, notes, build_facts(job, niche_cfg, notes)) if notes.strip() else ""
    result = await write_copy(
        ai, build_facts(job, niche_cfg, notes, found), language_code, seed=seed, profile=profile
    )
    name, artist = song_of(job, result.pieces.song, result.pieces.artist)
    return DraftDetails(
        song_name=name,
        artist=artist,
        language=language_code,
        copies={
            platform: PlatformDetails(
                title=c.title, description=c.description, tags=list(c.tags), strategy=c.strategy_id,
                pinned_comment=c.pinned_comment,
            )
            for platform, c in result.copies.items()
        },
        generated_at=_now_iso(),
        research=found,
    )


def to_summary(details: DraftDetails) -> VideoSummary:
    """Los detalles como el VideoSummary que publica el pipeline (y lee Biblioteca)."""
    copies = {
        platform: PlatformCopyText(
            title=c.title, description=c.description, tags=c.tags, strategy=c.strategy, pinned_comment=c.pinned_comment
        )
        for platform, c in details.copies.items()
    }
    youtube, tiktok = copies.get("youtube"), copies.get("tiktok")
    return VideoSummary(
        youtube_title=youtube.title if youtube else "",
        youtube_description=youtube.description if youtube else "",
        youtube_tags=youtube.tags if youtube else [],
        tiktok_caption=tiktok.title if tiktok else "",
        tiktok_hashtags=tiktok.tags if tiktok else [],
        language=details.language,
        platform_copies=copies,
        pinned_comment=youtube.pinned_comment if youtube else "",
    )


def apply_to_intro(output_dir: Path | None, details: DraftDetails) -> bool:
    """La tarjeta de intro del video muestra la canción de los Detalles (config.intro.title/artist del
    config.json del prototipo): así no queda el texto de ejemplo de la plantilla («CAUTION · Skrxlla»).
    El álbum de ejemplo se borra; `sub`/`feats` (firmas del canal) no se tocan. True si cambió algo."""
    if output_dir is None or not details.song_name.strip():
        return False
    path = Path(output_dir) / "config.json"
    if not path.is_file():
        return False
    raw = json.loads(path.read_text(encoding="utf-8"))
    cases = raw.get("configs") if isinstance(raw.get("configs"), list) else [raw]
    changed = False
    for case in cases:
        intro = case.get("intro") if isinstance(case, dict) else None
        if not isinstance(intro, dict):
            continue
        wanted = {"title": details.song_name.strip(), "artist": details.artist.strip()}
        if "album" in intro:
            wanted["album"] = ""
        for key, value in wanted.items():
            if intro.get(key) != value:
                intro[key] = value
                changed = True
    if changed:
        path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed
