"""Consultas a fuentes abiertas de metadatos musicales: MusicBrainz y Wikipedia.

Solo salen el título y el artista que ya están en la biblioteca: nunca la letra ni archivos.
Cualquier fallo de red devuelve listas vacías y la ficha queda como estaba.

Las consultas usan la biblioteca estándar (urllib) en un hilo: Wikipedia responde 403 al
cliente httpx del proyecto, pero acepta esta misma petición.
"""

from __future__ import annotations

import asyncio
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Awaitable, Callable
from typing import Any

import structlog

from src.core.library.music_enrichment import MusicSourceUnavailable

logger = structlog.get_logger(__name__)

# Identificador genérico del cliente: no lleva datos del usuario.
USER_AGENT = "NexaBrief/1.0 (metadatos de biblioteca)"
MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/recording/"
WIKIPEDIA_API = "https://{lang}.wikipedia.org/w/api.php"
TIMEOUT_SECONDS = 10.0
RETRYABLE_STATUS = (429, 503)
RETRY_SECONDS = 2.0

GetJson = Callable[[str, dict[str, Any]], Awaitable[Any]]


def _get_json(url: str, params: dict[str, Any]) -> Any:
    request = urllib.request.Request(
        f"{url}?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


async def _get_json_in_thread(url: str, params: dict[str, Any]) -> Any:
    return await asyncio.to_thread(_get_json, url, params)


def _escape(text: str) -> str:
    return text.replace('"', " ").strip()


def _credit_name(credit: dict[str, Any]) -> str:
    name = credit.get("name") or (credit.get("artist") or {}).get("name") or ""
    return f"{name}{credit.get('joinphrase') or ''}"


def _recording(item: dict[str, Any]) -> dict[str, Any]:
    release = (item.get("releases") or [{}])[0] or {}
    tags = sorted(
        (tag for tag in item.get("tags") or [] if tag.get("name")),
        key=lambda tag: -int(tag.get("count") or 0),
    )
    recording_id = item.get("id") or ""
    return {
        "id": recording_id,
        "title": item.get("title") or "",
        "score": int(item.get("score") or 0),
        "artist": "".join(_credit_name(credit) for credit in item.get("artist-credit") or []).strip(),
        "release": release.get("title") or "",
        "date": release.get("date") or "",
        "tags": [tag["name"] for tag in tags[:5]],
        "url": f"https://musicbrainz.org/recording/{recording_id}" if recording_id else "",
    }


class MusicSourcesHttp:
    """Implementa MusicSources. MusicBrainz pide como máximo una consulta por segundo."""

    def __init__(self, *, get_json: GetJson | None = None, min_interval: float = 1.1) -> None:
        self._get_json: GetJson = get_json or _get_json_in_thread
        self._min_interval = min_interval
        self._last_musicbrainz = 0.0
        self._musicbrainz_lock = asyncio.Lock()

    async def _fetch(self, url: str, params: dict[str, Any]) -> Any:
        """Una consulta y, si el servicio pide calma (429/503), un único reintento."""
        try:
            return await self._get_json(url, params)
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_STATUS:
                raise
        await asyncio.sleep(RETRY_SECONDS)
        return await self._get_json(url, params)

    async def recordings(self, title: str, artist: str) -> list[dict[str, Any]]:
        query = f'recording:"{_escape(title)}"'
        if artist:
            query += f' AND artist:"{_escape(artist)}"'
        async with self._musicbrainz_lock:
            pause = self._min_interval - (time.monotonic() - self._last_musicbrainz)
            if pause > 0:
                await asyncio.sleep(pause)
            try:
                payload = await self._fetch(MUSICBRAINZ_URL, {"query": query, "fmt": "json", "limit": 5})
            except (OSError, ValueError) as exc:
                logger.warning("music_sources_musicbrainz_failed", error=str(exc)[:200])
                raise MusicSourceUnavailable("MusicBrainz no respondió") from exc
            finally:
                self._last_musicbrainz = time.monotonic()
        return [_recording(item) for item in (payload or {}).get("recordings") or []]

    async def articles(self, title: str, artist: str) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        failures = 0
        for lang, kind in (("en", "song"), ("es", "canción")):
            query = " ".join(part for part in (f'"{_escape(title)}"', artist, kind) if part)
            try:
                payload = await self._fetch(
                    WIKIPEDIA_API.format(lang=lang),
                    {
                        "action": "query",
                        "format": "json",
                        "generator": "search",
                        "gsrsearch": query,
                        "gsrlimit": 3,
                        "prop": "extracts|info",
                        "inprop": "url",
                        "exintro": 1,
                        "explaintext": 1,
                        "exlimit": 3,
                    },
                )
            except (OSError, ValueError) as exc:
                failures += 1
                logger.warning("music_sources_wikipedia_failed", lang=lang, error=str(exc)[:200])
                continue
            pages = ((payload or {}).get("query") or {}).get("pages") or {}
            for page in sorted(pages.values(), key=lambda page: page.get("index", 0)):
                found.append(
                    {
                        "title": page.get("title") or "",
                        "extract": page.get("extract") or "",
                        "url": page.get("fullurl") or "",
                        "lang": lang,
                    }
                )
        if failures == 2:
            raise MusicSourceUnavailable("Wikipedia no respondió")
        return found
