"""Completa la ficha de una canción con datos de fuentes abiertas.

Botón «Completar datos» de Recursos. Tres pasos:
1. MusicBrainz identifica la grabación: artista, lanzamiento, fecha y géneros.
2. Wikipedia aporta un extracto de qué trata la canción, si hay un artículo que coincide.
3. Un modelo básico redacta la ficha SOLO con esos datos.

Reglas: rellena únicamente campos vacíos (nunca título, categoría, licencia ni lo que
escribió una persona), no envía la letra a ningún buscador y, si no hay coincidencia
clara, no inventa nada. Las consultas HTTP y el modelo llegan inyectados desde el router,
así que esta capa se prueba sin red.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel, Field

from src.core.library import asset_library as lib

FIELDS = ("artist", "genre", "description", "tags")
# Lo que el botón exige. El género es opcional: muchas fuentes no lo traen, pero si lo traen se completa.
REQUIRED_FIELDS = ("artist", "description", "tags")
# «Regenerar» reemplaza estos aunque ya tengan texto. Título, categoría y licencia nunca cambian.
OVERWRITTEN_FIELDS = ("description", "tags")
MIN_RECORDING_SCORE = 90
MIN_EXTRACT_CHARS = 120
EXTRACT_LIMIT = 1500

_PARENTHESES = re.compile(r"\([^)]*\)|\[[^\]]*\]")
_FEATURING = re.compile(r"\s+(?:con|feat\.?|ft\.?|featuring)\s+.*$", re.IGNORECASE)


class MusicResearch(BaseModel):
    """Respuesta del modelo. `identified` dice si las fuentes describen esta canción."""

    identified: bool = False
    artist: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=600)
    genre: str = Field(default="", max_length=60)
    tags: list[str] = Field(default_factory=list, max_length=8)
    confidence: str = "baja"


class MusicSources(Protocol):
    async def recordings(self, title: str, artist: str) -> list[dict[str, Any]]: ...

    async def articles(self, title: str, artist: str) -> list[dict[str, Any]]: ...


Ask = Callable[[dict[str, Any]], Awaitable[MusicResearch]]


class MusicSourceUnavailable(Exception):
    """La fuente no respondió (red, límite de consultas o error del servicio)."""


@dataclass(frozen=True)
class EnrichmentReport:
    status: str  # actualizado | sin_cambios | completo | no_encontrada | error
    fields: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()


def _empty_fields(entry: Any, names: tuple[str, ...]) -> list[str]:
    values = {
        "artist": entry.artist,
        "genre": entry.genre,
        "description": entry.description,
        "tags": entry.tags,
    }
    return [name for name in names if not str(values[name] or "").strip()]


def missing_fields(entry: Any) -> list[str]:
    """Campos obligatorios que hoy están vacíos. Lista vacía = el botón no hace falta."""
    return _empty_fields(entry, REQUIRED_FIELDS)


def _norm(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.findall(r"[a-z0-9]+", folded))


def _label_from_filename(filename: str | None) -> str:
    if not filename:
        return ""
    return " ".join(Path(filename).stem.replace("_", " ").replace("-", " ").split())


def search_hints(entry: Any) -> tuple[str, str]:
    """Título y artista para buscar, sin notas de edición ni colaboradores.

    «K/DA - THE BADDEST con (G)I-DLE» queda como artista «K/DA» y título «THE BADDEST».
    """
    artist = str(entry.artist or "").strip()
    raw = str(entry.track_name or "").strip() or _label_from_filename(entry.original_filename)
    if artist and raw.lower().startswith(artist.lower() + " - "):
        raw = raw[len(artist) + 3 :]
    elif " - " in raw and not artist:
        artist, raw = (part.strip() for part in raw.split(" - ", 1))
    title = _FEATURING.sub("", _PARENTHESES.sub(" ", raw)).strip(" -")
    return " ".join((title or raw).split()), artist


def pick_recording(candidates: list[dict[str, Any]], title: str, artist: str) -> dict[str, Any] | None:
    """La grabación cuyo título es exactamente el buscado. Sin artista indicado, solo si es única."""
    want = _norm(title)
    if not want:
        return None
    exact = [
        cand
        for cand in candidates
        if int(cand.get("score") or 0) >= MIN_RECORDING_SCORE and _norm(str(cand.get("title") or "")) == want
    ]
    if artist:
        wanted_artist = _norm(artist)
        for cand in exact:
            got = _norm(str(cand.get("artist") or ""))
            if got and (wanted_artist in got or got in wanted_artist):
                return cand
        return None
    return exact[0] if len(exact) == 1 else None


def pick_article(candidates: list[dict[str, Any]], title: str, artist: str) -> dict[str, Any] | None:
    """Primer artículo cuyo título contiene la canción y, si se conoce, el artista."""
    want = _norm(title)
    if len(want) < 4:
        return None
    for cand in candidates:
        head = _norm(str(cand.get("title") or ""))
        extract = str(cand.get("extract") or "").strip()
        if len(extract) < MIN_EXTRACT_CHARS or want not in head:
            continue
        if artist and _norm(artist) not in head and _norm(artist) not in _norm(extract):
            continue
        return {**cand, "extract": extract[:EXTRACT_LIMIT]}
    return None


def _facts_recording(recording: dict[str, Any] | None) -> dict[str, Any] | None:
    if recording is None:
        return None
    return {
        "titulo": recording.get("title", ""),
        "artistas": recording.get("artist", ""),
        "lanzamiento": recording.get("release", ""),
        "fecha": recording.get("date", ""),
        "generos": recording.get("tags", []),
        "url": recording.get("url", ""),
    }


def _facts_article(article: dict[str, Any] | None) -> dict[str, Any] | None:
    if article is None:
        return None
    return {
        "titulo": article.get("title", ""),
        "extracto": article.get("extract", ""),
        "url": article.get("url", ""),
    }


def _changes(
    missing: list[str],
    research: MusicResearch,
    recording: dict[str, Any] | None,
    article: dict[str, Any] | None,
) -> dict[str, str]:
    """Valor propuesto por campo. MusicBrainz manda en artista; el modelo solo redacta."""
    tags_from_record = (recording or {}).get("tags") or []
    proposed = {
        "artist": (recording or {}).get("artist") or (research.artist if research.identified else ""),
        "genre": (research.genre if research.identified else "") or (tags_from_record[0] if tags_from_record else ""),
        # Con texto de Wikipedia, la descripción sale de él; solo con MusicBrainz, de sus datos.
        "description": research.description if research.identified and (article or recording) else "",
        "tags": ", ".join(tag.strip() for tag in research.tags if tag.strip()) if research.identified else "",
    }
    changes: dict[str, str] = {}
    for name in missing:
        value = str(proposed.get(name) or "").strip()
        if value:
            changes[name] = value
    return changes


async def enrich_music(
    asset_id: str,
    *,
    sources: MusicSources,
    ask: Ask,
    library: Any = lib,
    overwrite: bool = False,
) -> EnrichmentReport:
    """Investiga la canción y escribe solo los campos vacíos; con `overwrite` (Regenerar) también
    reemplaza descripción y etiquetas. Nunca lanza por falta de datos."""
    entry = library.get_music_entry(asset_id)
    if not overwrite and not missing_fields(entry):
        return EnrichmentReport(status="completo")

    title, hint_artist = search_hints(entry)
    if not title:
        return EnrichmentReport(status="no_encontrada")

    unavailable = False
    try:
        candidates = await sources.recordings(title, hint_artist)
    except MusicSourceUnavailable:
        candidates, unavailable = [], True
    recording = pick_recording(candidates, title, hint_artist)
    artist = hint_artist or str((recording or {}).get("artist") or "")
    # Sin artista ni grabación, buscar en Wikipedia sería adivinar: el título suele ser genérico.
    article = None
    if artist or recording is not None:
        try:
            found = await sources.articles(title, artist)
        except MusicSourceUnavailable:
            found, unavailable = [], True
        article = pick_article(found, title, artist)
    used = tuple(url for url in ((recording or {}).get("url"), (article or {}).get("url")) if url)
    if recording is None and article is None:
        # Un servicio caído no es lo mismo que una canción sin ficha: no se le dice al usuario «no existe».
        return EnrichmentReport(status="error" if unavailable else "no_encontrada")

    research = await ask(
        {
            "pedido": {"titulo": title, "artista_indicado": hint_artist},
            "musicbrainz": _facts_recording(recording),
            "wikipedia": _facts_article(article),
        }
    )
    if recording is None and not research.identified:
        return EnrichmentReport(status="no_encontrada", sources=used)

    targets = _empty_fields(entry, FIELDS)
    if overwrite:
        # Regenerar: descripción y etiquetas se reemplazan; artista y género solo si faltan.
        targets = [name for name in FIELDS if name in targets or name in OVERWRITTEN_FIELDS]
    changes = _changes(targets, research, recording, article)
    if not changes:
        return EnrichmentReport(status="sin_cambios", sources=used)
    await library.update_asset_metadata("music", asset_id, changes)
    return EnrichmentReport(status="actualizado", fields=tuple(changes), sources=used)
