"""Busca y descarga medios relevantes para Alan Turing y Neil Armstrong.

La prueba usa el contrato real de ``researcher_data``. Consulta los 13
proveedores, puntúa los candidatos por relevancia y diversidad, y conserva
seis imágenes y cuatro vídeos por persona cuando las fuentes los permiten.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import mimetypes
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from src.adapters.researcher_data import (  # noqa: E402
    ResearcherSettings,
    build_researcher_data,
    settings,
)
from src.adapters.researcher_data.infrastructure.openverse import (  # noqa: E402
    OpenverseProvider,
)


ROOT = Path(__file__).resolve().parent / "personas"
TARGET_IMAGES = 6
TARGET_VIDEOS = 4
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_VIDEO_BYTES = 60 * 1024 * 1024
MIN_VIDEO_SECONDS: float | None = None
MAX_VIDEO_SECONDS: float | None = None
MEDIA_DOWNLOAD_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"

PEOPLE: dict[str, dict[str, Any]] = {
    "alan_turing": {
        "name": "Alan Turing",
        "aliases": ["alan turing", "turing", "enigma", "bletchley", "computing"],
        "media_aliases": ["alan turing", "turing", "enigma", "bletchley"],
        "video_include_terms": ["alan turing", "turing", "enigma", "bletchley"],
        "video_exclude_terms": [],
        "osm_bbox": "-0.79,51.99,-0.74,52.01",
        "overpass_term": "Bletchley",
    },
    "neil_armstrong": {
        "name": "Neil Armstrong",
        "aliases": [
            "neil armstrong",
            "armstrong",
            "apollo 11",
            "moon",
            "lunar",
            "astronaut",
            "eagle",
        ],
        "media_aliases": ["neil armstrong", "apollo 11", "moon", "lunar", "eagle"],
        "video_include_terms": [
            "neil armstrong",
            "apollo",
            "moon",
            "lunar",
            "eagle",
            "flag",
            "small step",
        ],
        "video_exclude_terms": [
            "drew morgan",
            "astronaut moments",
            "test facility",
            "research center",
            "facility",
        ],
        "osm_bbox": "-84.2,40.55,-84.05,40.65",
        "overpass_term": "Armstrong",
    },
}


def _secrets() -> list[str]:
    return [
        value
        for value in (
            settings.wikimedia_enterprise_access_token,
            settings.wikimedia_enterprise_refresh_token,
            settings.wikimedia_enterprise_password,
            settings.openverse_api_token,
            settings.europeana_api_key,
            settings.dpla_api_key,
            settings.nasa_api_key,
        )
        if value and len(value) >= 6
    ]


def _redact(value: Any) -> Any:
    if isinstance(value, str):
        for secret in _secrets():
            value = value.replace(secret, "[REDACTED]")
        return value
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, dict):
        return {key: _redact(item) for key, item in value.items()}
    return value


def _short(value: Any, length: int = 900) -> str:
    text = str(value or "").strip()
    return text if len(text) <= length else f"{text[: length - 1]}…"


def _compact_result(result: Any) -> dict[str, Any]:
    data = result.model_dump(mode="json")
    compact = {
        key: _short(data.get(key))
        for key in (
            "resource_id",
            "kind",
            "title",
            "description",
            "url",
            "media_url",
            "thumbnail_url",
            "creator",
            "license",
            "date",
            "language",
        )
        if data.get(key)
    }
    metadata = data.get("metadata") or {}
    important_keys = (
        "mime",
        "width",
        "height",
        "format",
        "original_format",
        "provider",
        "data_provider",
        "source",
        "attribution",
        "keywords",
        "tags",
        "center",
        "camera",
        "rover",
        "media_type",
        "asset_url",
    )
    important = {
        key: _redact(metadata[key])
        for key in important_keys
        if metadata.get(key) not in (None, "", [], {})
    }
    if important:
        compact["informacion_importante"] = important
    return _redact(compact)


def _score(candidate: dict[str, Any], aliases: list[str]) -> float:
    result = candidate["result"]
    title = str(result.get("title", "")).casefold()
    text = " ".join(
        str(result.get(key, ""))
        for key in ("title", "description", "creator", "url")
    ).casefold()
    score = 0.0
    for alias in aliases:
        normalized = alias.casefold()
        if normalized in title:
            score += 55
        elif normalized in text:
            score += 18
    if result.get("description"):
        score += 4
    if result.get("license"):
        score += 5
    provider_weights = {
        "nasa_image_video_library": 10,
        "wikimedia_commons": 9,
        "openverse": 8,
        "library_of_congress": 7,
        "dpla": 6,
        "europeana": 6,
        "wikipedia": 4,
        "internet_archive": 7,
    }
    if candidate["media_kind"] == "image":
        provider_weights.update(
            {
                "wikimedia_commons": 20,
                "nasa_image_video_library": 18,
                "library_of_congress": 17,
                "europeana": 16,
                "dpla": 14,
            }
        )
        important = result.get("informacion_importante", {})
        try:
            pixels = int(important.get("width", 0)) * int(important.get("height", 0))
        except (TypeError, ValueError):
            pixels = 0
        score += min(25, pixels / 250_000)
        if "original" in candidate["url"].casefold() or "~orig" in candidate["url"]:
            score += 6
    score += provider_weights.get(candidate["provider"], 1)
    # Desempate estable, sin depender del orden de la API.
    digest = hashlib.sha256(candidate["url"].encode()).hexdigest()
    score += int(digest[:4], 16) / 65535
    return score


def _candidate(
    provider: str, result: Any, url: str, media_kind: str, source: str, aliases: list[str]
) -> dict[str, Any]:
    compact = _compact_result(result)
    candidate = {
        "provider": provider,
        "url": url,
        "media_kind": media_kind,
        "source": source,
        "result": compact,
    }
    candidate["score"] = round(_score(candidate, aliases), 3)
    return candidate


def _add_result_candidates(
    candidates: list[dict[str, Any]],
    provider: str,
    result: Any,
    aliases: list[str],
) -> None:
    kind = str(result.kind or "").casefold()
    if kind in {"image", "article"}:
        url = result.media_url or result.thumbnail_url
        if url:
            candidates.append(_candidate(provider, result, url, "image", "media", aliases))
    elif kind == "video" and result.media_url:
        candidates.append(_candidate(provider, result, result.media_url, "video", "media", aliases))


def _is_relevant(candidate: dict[str, Any], required_terms: list[str]) -> bool:
    result = candidate["result"]
    text = _normalized_match_text(" ".join(
        str(result.get(key, ""))
        for key in ("title", "description", "creator")
    ))
    return any(_normalized_match_text(term) in text for term in required_terms)


def _normalized_match_text(value: Any) -> str:
    return re.sub(r"[\W_]+", " ", str(value or "").casefold()).strip()


def _is_relevant_video(candidate: dict[str, Any], person: dict[str, Any]) -> bool:
    """Keep videos whose title identifies the person or the specific event.

    Descriptions often mention a person only as historical context. Requiring
    a title match prevents results such as a video about another astronaut that
    merely mentions Neil Armstrong in its description.
    """
    result = candidate["result"]
    title = _normalized_match_text(result.get("title", ""))
    include_terms = person["video_include_terms"]
    exclude_terms = person["video_exclude_terms"]
    if any(_normalized_match_text(term) in title for term in exclude_terms):
        return False
    return any(_normalized_match_text(term) in title for term in include_terms)


def _sample(results: list[Any], limit: int = 2) -> list[dict[str, Any]]:
    output = []
    for result in results[:limit]:
        compact = _compact_result(result)
        output.append(
            {
                key: compact[key]
                for key in ("kind", "title", "url", "creator")
                if compact.get(key)
            }
        )
    return output


async def _search(
    provider: Any,
    provider_name: str,
    query: str,
    aliases: list[str],
    candidates: list[dict[str, Any]],
    limit: int = 25,
    **filters: Any,
) -> dict[str, Any]:
    response = await provider.search(query, limit=limit, **filters)
    for result in response.results:
        _add_result_candidates(candidates, provider_name, result, aliases)
    return {
        "status": "ok",
        "query": query,
        "filters": filters,
        "result_count": len(response.results),
        "total": response.total,
        "muestras": _sample(response.results),
    }


async def _search_openverse(
    adapter: Any,
    aliases: list[str],
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    provider = adapter.provider("openverse")
    calls = []
    anonymous_used = False
    for media_type in ("image", "audio"):
        try:
            call = await _search(
                provider,
                "openverse",
                " ".join(aliases[:2]),
                aliases,
                candidates if media_type == "image" else [],
                limit=20,
                media_type=media_type,
            )
        except Exception as exc:
            if "credencial rechazada" not in str(exc):
                calls.append(
                    {"status": "error", "media_type": media_type, "error": _redact(str(exc))}
                )
                continue
            anonymous = OpenverseProvider(
                config=ResearcherSettings(OPENVERSE_API_TOKEN="")
            )
            try:
                call = await _search(
                    anonymous,
                    "openverse",
                    " ".join(aliases[:2]),
                    aliases,
                    candidates if media_type == "image" else [],
                    limit=20,
                    media_type=media_type,
                )
                call["status"] = "ok_anonymous_fallback"
                call["nota"] = "Token rechazado; se probó acceso anónimo."
                anonymous_used = True
            except Exception as anonymous_exc:
                calls.append(
                    {
                        "status": "error",
                        "media_type": media_type,
                        "error": _redact(str(anonymous_exc)),
                    }
                )
                continue
        call["media_type"] = media_type
        calls.append(call)
    return {
        "provider": "openverse",
        "status": "ok_anonymous_fallback" if anonymous_used else "ok",
        "consultas": calls,
        "result_count": sum(call.get("result_count", 0) for call in calls),
    }


async def _search_nasa_library(
    adapter: Any,
    aliases: list[str],
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    provider = adapter.provider("nasa_image_video_library")
    calls = []
    for media_type in ("image", "video"):
        response = await provider.search(
            " ".join(aliases[:2]), limit=25, media_type=media_type
        )
        ranked_results = sorted(
            response.results,
            key=lambda result: _score(
                {
                    "provider": provider.name,
                    "url": result.url or result.resource_id,
                    "result": _compact_result(result),
                },
                aliases,
            ),
            reverse=True,
        )
        # Explorar toda la página ya ordenada: los vídeos más relevantes pueden
        # quedar después de resultados contextuales, por ejemplo instalaciones
        # o entrevistas que solo mencionan al personaje en la descripción.
        for result in ranked_results:
            try:
                assets = await provider.asset(result.resource_id)
            except Exception:
                assets = []
            extensions = (
                (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".svg")
                if media_type == "image"
                else (".mp4", ".mov", ".webm")
            )
            media_assets = [
                url for url in assets if url.casefold().endswith(extensions)
            ]
            if media_type == "image":
                media_assets.sort(
                    key=lambda url: (
                        "~orig" not in url,
                        "~large" not in url,
                        "~medium" not in url,
                        "~small" not in url,
                        "~preview" not in url,
                    )
                )
                if not media_assets:
                    _add_result_candidates(candidates, provider.name, result, aliases)
                media_assets = media_assets[:1]
            else:
                preferred_assets = [
                    url
                    for url in media_assets
                    if any(
                        marker in url
                        for marker in ("~medium", "~mobile", "~preview", "~small")
                    )
                ]
                if preferred_assets:
                    media_assets = preferred_assets
                media_assets.sort(
                    key=lambda url: (
                        "~medium" not in url
                        and "~preview" not in url
                        and "~small" not in url,
                        "~preview" not in url,
                        "~small" not in url,
                    )
                )
                media_assets = media_assets[:3]
            for url in media_assets:
                candidates.append(
                    _candidate(provider.name, result, url, media_type, "asset", aliases)
                )
        calls.append(
            {
                "status": "ok",
                "media_type": media_type,
                "result_count": len(response.results),
                "total": response.total,
                "muestras": _sample(response.results),
            }
        )
    return {
        "provider": "nasa_image_video_library",
        "status": "ok",
        "consultas": calls,
        "result_count": sum(call["result_count"] for call in calls),
    }


def _ordered_candidates(
    candidates: list[dict[str, Any]],
    media_kind: str,
    target: int,
    required_terms: list[str],
) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        if (
            candidate["media_kind"] == media_kind
            and _is_relevant(candidate, required_terms)
        ):
            if media_kind == "video":
                result = candidate["result"]
                identity = result.get("resource_id") or result.get("title") or candidate["url"]
                key = f'{candidate["provider"]}:{identity}'
            elif candidate["provider"] == "openverse":
                result = candidate["result"]
                identity = ":".join(
                    part
                    for part in (result.get("title", ""), result.get("creator", ""))
                    if part
                )
                key = f'openverse:{identity or candidate["url"]}'
            else:
                key = candidate["url"]
            unique.setdefault(key, candidate)
    ranked = sorted(unique.values(), key=lambda item: item["score"], reverse=True)
    selected_order: list[dict[str, Any]] = []
    used_providers: set[str] = set()
    # Primero diversifica fuentes; después completa con los mejores restantes.
    for candidate in ranked:
        if candidate["provider"] not in used_providers:
            selected_order.append(candidate)
            used_providers.add(candidate["provider"])
    for candidate in ranked:
        if candidate not in selected_order:
            selected_order.append(candidate)
    return selected_order


def _safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._")[:80] or "media"


def _extension(url: str, content_type: str) -> str:
    mime = content_type.split(";", 1)[0].strip().lower()
    guessed = mimetypes.guess_extension(mime)
    if guessed:
        return guessed
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp4", ".webm", ".mov"} else ".bin"


async def _download(
    client: httpx.AsyncClient,
    candidate: dict[str, Any],
    destination: Path,
    index: int,
) -> dict[str, Any] | None:
    url = candidate["url"]
    max_bytes = MAX_VIDEO_BYTES if candidate["media_kind"] == "video" else MAX_IMAGE_BYTES
    expected_prefix = "video/" if candidate["media_kind"] == "video" else "image/"
    data: bytes | None = None
    content_type = ""
    try:
        async with client.stream("GET", url) as response:
            content_type = response.headers.get("content-type", "").lower()
            if response.status_code == 200 and content_type.startswith(expected_prefix):
                size = response.headers.get("content-length")
                if size and int(size) > max_bytes:
                    return None
                buffer = bytearray()
                async for chunk in response.aiter_bytes():
                    buffer.extend(chunk)
                    if len(buffer) > max_bytes:
                        return None
                data = bytes(buffer)
    except Exception:
        data = None

    if data is None:
        fallback = _curl_download(url, max_bytes, expected_prefix)
        if fallback is None:
            return None
        data, content_type = fallback

    result = candidate["result"]
    filename = f"{index:02d}_{_safe_name(result.get('title', candidate['provider']))}{_extension(url, content_type)}"
    path = destination / filename
    path.write_bytes(data)
    duration_seconds = None
    if candidate["media_kind"] == "video":
        duration_seconds = _probe_duration(path)
        if duration_seconds is None or (
            MIN_VIDEO_SECONDS is not None and duration_seconds < MIN_VIDEO_SECONDS
        ) or (
            MAX_VIDEO_SECONDS is not None and duration_seconds > MAX_VIDEO_SECONDS
        ):
            path.unlink(missing_ok=True)
            return None
    return {
        "file": str(path.relative_to(ROOT)),
        "provider": candidate["provider"],
        "type": candidate["media_kind"],
        "score": candidate["score"],
        "title": result.get("title", ""),
        "description": result.get("description", ""),
        "creator": result.get("creator", ""),
        "license": result.get("license", ""),
        "date": result.get("date", ""),
        "source_url": _redact(url),
        "catalog_url": result.get("url", ""),
        "content_type": content_type,
        "bytes": len(data),
        "duration_seconds": duration_seconds,
        "informacion_importante": result.get("informacion_importante", {}),
    }


def _curl_download(
    url: str, max_bytes: int, expected_prefix: str
) -> tuple[bytes, str] | None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="researcher-media-", delete=False) as handle:
            temporary_path = Path(handle.name)
        completed = subprocess.run(
            [
                "curl",
                "--location",
                "--fail",
                "--silent",
                "--show-error",
                "--max-time",
                "20",
                "--user-agent",
                MEDIA_DOWNLOAD_USER_AGENT,
                "--output",
                str(temporary_path),
                url,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if completed.returncode != 0 or not temporary_path.exists():
            return None
        if temporary_path.stat().st_size > max_bytes:
            return None
        mime = subprocess.run(
            ["file", "--brief", "--mime-type", str(temporary_path)],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        ).stdout.strip().lower()
        if not mime.startswith(expected_prefix):
            return None
        return temporary_path.read_bytes(), mime
    except (OSError, subprocess.SubprocessError):
        return None
    finally:
        if temporary_path:
            temporary_path.unlink(missing_ok=True)


def _probe_duration(path: Path) -> float | None:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        value = completed.stdout.strip()
        return float(value) if completed.returncode == 0 and value else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


async def _add_wikipedia_articles(
    provider: Any,
    query: str,
    aliases: list[str],
    candidates: list[dict[str, Any]],
) -> None:
    search = await provider.search(query, language="en", limit=10)
    for article_result in search.results[:5]:
        try:
            article = await provider.article(article_result.title, language="en")
            _add_result_candidates(candidates, provider.name, article, aliases)
        except Exception:
            continue


async def _run_person(person_key: str, person: dict[str, Any]) -> dict[str, Any]:
    adapter = build_researcher_data()
    aliases = person["aliases"]
    media_aliases = person["media_aliases"]
    candidates: list[dict[str, Any]] = []
    video_references: list[dict[str, Any]] = []
    reports: list[dict[str, Any]] = []
    name = person["name"]
    search_query = person.get("search_query", name)

    simple_cases = [
        ("wikipedia", search_query, {"language": "en"}),
        ("wikidata", search_query, {"language": "en"}),
        ("wikimedia_commons", search_query, {"thumbnail_width": 2000}),
        ("wikimedia_enterprise", search_query, {"project": "enwiki"}),
        ("library_of_congress", search_query, {}),
        ("nasa", search_query, {}),
        ("world_bank", "population", {"catalog_limit": 1000}),
        ("openstreetmap", person["osm_bbox"], {"bbox": person["osm_bbox"]}),
        ("overpass", person["overpass_term"], {"bbox": person["osm_bbox"]}),
        ("dpla", search_query, {}),
        ("internet_archive", search_query, {"media_type": "video"}),
    ]

    for provider_name, query, filters in simple_cases:
        if provider_name in {"openstreetmap", "overpass"} and not person["osm_bbox"]:
            reports.append(
                {
                    "provider": provider_name,
                    "status": "not_applicable",
                    "reason": "El tema no tiene un área geográfica definida.",
                }
            )
            continue
        try:
            provider = adapter.provider(provider_name)
            report = await _search(
                provider, provider_name, query, aliases, candidates, **filters
            )
            report["provider"] = provider_name
            reports.append(report)
            if provider_name == "wikipedia":
                await _add_wikipedia_articles(
                    provider, search_query, aliases, candidates
                )
            if provider_name == "dpla":
                initial = await provider.search(search_query, limit=25)
                for result in initial.results:
                    if result.kind != "video" or not result.url:
                        continue
                    compact = _compact_result(result)
                    reference_candidate = {
                        "provider": "dpla",
                        "url": result.url,
                        "media_kind": "video",
                        "result": compact,
                    }
                    if _is_relevant_video(reference_candidate, person):
                        video_references.append(
                            {
                                "provider": "dpla",
                                "score": round(_score(reference_candidate, aliases), 3),
                                "title": compact.get("title", ""),
                                "description": compact.get("description", ""),
                                "creator": compact.get("creator", ""),
                                "date": compact.get("date", ""),
                                "license": compact.get("license", ""),
                                "catalog_url": compact.get("url", ""),
                                "preview_url": compact.get("media_url", ""),
                                "nota": "Referencia de vídeo; DPLA no entregó un archivo directo descargable.",
                            }
                        )
                for additional_query in (
                    f"{search_query} video",
                    f"{search_query} lecture",
                    f"{search_query} documentary",
                ):
                    try:
                        extra = await provider.search(additional_query, limit=25)
                        report.setdefault("consultas_adicionales", []).append(
                            {
                                "query": additional_query,
                                "result_count": len(extra.results),
                                "muestras": _sample(extra.results),
                            }
                        )
                        for result in extra.results:
                            if result.kind != "video" or not result.url:
                                continue
                            compact = _compact_result(result)
                            reference_candidate = {
                                "provider": "dpla",
                                "url": result.url,
                                "media_kind": "video",
                                "result": compact,
                            }
                            if not _is_relevant_video(reference_candidate, person):
                                continue
                            video_references.append(
                                {
                                    "provider": "dpla",
                                    "score": round(
                                        _score(reference_candidate, aliases), 3
                                    ),
                                    "title": compact.get("title", ""),
                                    "description": compact.get("description", ""),
                                    "creator": compact.get("creator", ""),
                                    "date": compact.get("date", ""),
                                    "license": compact.get("license", ""),
                                    "catalog_url": compact.get("url", ""),
                                    "preview_url": compact.get("media_url", ""),
                                    "nota": "Referencia de vídeo; DPLA no entregó un archivo directo descargable.",
                                }
                            )
                    except Exception:
                        continue
            for extra in person.get("additional_searches", []):
                if extra["provider"] != provider_name:
                    continue
                try:
                    extra_query = extra["query"]
                    extra_filters = extra.get("filters", {})
                    extra_report = await _search(
                        provider,
                        provider_name,
                        extra_query,
                        aliases,
                        candidates,
                        **extra_filters,
                    )
                    report.setdefault("consultas_adicionales", []).append(
                        {
                            "query": extra_query,
                            "result_count": extra_report["result_count"],
                            "total": extra_report.get("total"),
                            "muestras": extra_report["muestras"],
                        }
                    )
                    if provider_name == "wikipedia":
                        await _add_wikipedia_articles(
                            provider, extra_query, aliases, candidates
                        )
                except Exception as extra_exc:
                    report.setdefault("consultas_adicionales", []).append(
                        {
                            "query": extra.get("query", ""),
                            "status": "error",
                            "error": _redact(str(extra_exc)),
                        }
                    )
        except Exception as exc:
            reports.append(
                {
                    "provider": provider_name,
                    "status": "error",
                    "query": query,
                    "result_count": 0,
                    "error": _redact(str(exc)),
                }
            )

    if settings.europeana_api_key:
        try:
            provider = adapter.provider("europeana")
            report = await _search(
                provider, "europeana", search_query, aliases, candidates
            )
            report["provider"] = "europeana"
            reports.append(report)
        except Exception as exc:
            reports.append(
                {
                    "provider": "europeana",
                    "status": "error",
                    "query": search_query,
                    "error": _redact(str(exc)),
                }
            )
    else:
        reports.append(
            {
                "provider": "europeana",
                "status": "pendiente_falta_key",
                "query": search_query,
                "result_count": 0,
                "nota": "Completar EUROPEANA_API_KEY.",
            }
        )

    try:
        reports.append(await _search_openverse(adapter, aliases, candidates))
    except Exception as exc:
        reports.append(
            {"provider": "openverse", "status": "error", "error": _redact(str(exc))}
        )
    try:
        reports.append(await _search_nasa_library(adapter, aliases, candidates))
    except Exception as exc:
        reports.append(
            {
                "provider": "nasa_image_video_library",
                "status": "error",
                "error": _redact(str(exc)),
            }
        )

    # Quitar duplicados y ordenar por relevancia antes de descargar.
    image_candidates = _ordered_candidates(
        candidates, "image", TARGET_IMAGES, media_aliases
    )
    video_required_terms = list(
        dict.fromkeys(media_aliases + person["video_include_terms"])
    )
    video_candidates = _ordered_candidates(
        candidates, "video", TARGET_VIDEOS, video_required_terms
    )
    video_candidates = [
        candidate
        for candidate in video_candidates
        if _is_relevant_video(candidate, person)
    ]
    person_root = ROOT / person_key
    image_dir = person_root / "imagenes"
    video_dir = person_root / "videos"
    image_dir.mkdir(parents=True, exist_ok=True)
    video_dir.mkdir(parents=True, exist_ok=True)

    downloaded_images: list[dict[str, Any]] = []
    downloaded_videos: list[dict[str, Any]] = []
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(45.0),
        headers={"User-Agent": settings.researcher_user_agent},
    ) as client:
        for candidate in image_candidates:
            if len(downloaded_images) >= TARGET_IMAGES:
                break
            item = await _download(client, candidate, image_dir, len(downloaded_images) + 1)
            if item:
                downloaded_images.append(item)
        for candidate in video_candidates:
            if len(downloaded_videos) >= TARGET_VIDEOS:
                break
            item = await _download(client, candidate, video_dir, len(downloaded_videos) + 1)
            if item:
                downloaded_videos.append(item)

    report = {
        "persona": name,
        "tema": name,
        "ejecucion": datetime.now(timezone.utc).isoformat(),
        "objetivo": {"imagenes": TARGET_IMAGES, "videos": TARGET_VIDEOS},
        "obtenido": {
            "imagenes": len(downloaded_images),
            "videos": len(downloaded_videos),
        },
        "proveedores_consultados": reports,
        "imagenes": downloaded_images,
        "videos": downloaded_videos,
        "videos_referencias": sorted(
            {item["catalog_url"]: item for item in video_references}.values(),
            key=lambda item: item["score"],
            reverse=True,
        )[:TARGET_VIDEOS],
        "faltantes": {
            "imagenes": max(0, TARGET_IMAGES - len(downloaded_images)),
            "videos": max(0, TARGET_VIDEOS - len(downloaded_videos)),
        },
    }
    output = person_root / "resultados.json"
    output.write_text(
        json.dumps(_redact(report), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report


async def main() -> None:
    summaries = []
    for person_key, person in PEOPLE.items():
        print(f"START {person['name']}", flush=True)
        report = await _run_person(person_key, person)
        summary = {
            "persona": report["persona"],
            "imagenes": report["obtenido"]["imagenes"],
            "videos": report["obtenido"]["videos"],
            "videos_referencias": len(report["videos_referencias"]),
            "faltantes": report["faltantes"],
            "archivo": str((ROOT / person_key / "resultados.json")),
        }
        summaries.append(summary)
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    print(json.dumps({"personas": summaries}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
