"""Prueba compacta en vivo de los 13 proveedores de ``researcher_data``."""

from __future__ import annotations

import asyncio
import json
import mimetypes
import re
import sys
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


ROOT = Path(__file__).resolve().parent
DOWNLOADS = ROOT / "descargas"
RESULTS_FILE = ROOT / "resultados.json"
TOPIC = "volcanoes"
OSM_BBOX = "-155.0,19.3,-154.9,19.4"
OVERPASS_BBOX = "-155.9,18.8,-154.7,20.3"
MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024
MAX_MEDIA_PER_PROVIDER = 3


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
    """Conserva solo campos útiles para leer un resultado humano."""
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
    )
    important = {
        key: _redact(metadata[key])
        for key in important_keys
        if metadata.get(key) not in (None, "", [], {})
    }
    if important:
        compact["informacion_importante"] = important
    return _redact(compact)


def _safe_name(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._")
    return value[:80] or "media"


def _extension(url: str, content_type: str) -> str:
    mime = content_type.split(";", 1)[0].strip().lower()
    guessed = mimetypes.guess_extension(mime)
    if guessed:
        return guessed
    suffix = Path(urlparse(url).path).suffix.lower()
    allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp3", ".wav", ".mp4", ".webm"}
    return suffix if suffix in allowed else ".bin"


async def _download(
    client: httpx.AsyncClient,
    provider: str,
    index: int,
    candidate: dict[str, Any],
) -> dict[str, Any] | None:
    url = str(candidate.get("url") or "")
    if not url.startswith(("http://", "https://")):
        return None
    try:
        async with client.stream("GET", url) as response:
            content_type = response.headers.get("content-type", "").lower()
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > MAX_DOWNLOAD_BYTES:
                return None
            if response.status_code != 200 or not content_type.startswith(
                ("image/", "video/", "audio/")
            ):
                return None
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > MAX_DOWNLOAD_BYTES:
                    return None
            filename = f"{_safe_name(provider)}_{index}{_extension(url, content_type)}"
            destination = DOWNLOADS / filename
            destination.write_bytes(data)
            return {
                "file": str(destination.relative_to(ROOT)),
                "provider": provider,
                "type": candidate.get("result", {}).get("kind", "media"),
                "title": candidate.get("result", {}).get("title", ""),
                "description": candidate.get("result", {}).get("description", ""),
                "creator": candidate.get("result", {}).get("creator", ""),
                "license": candidate.get("result", {}).get("license", ""),
                "date": candidate.get("result", {}).get("date", ""),
                "source_url": _redact(url),
                "catalog_url": candidate.get("result", {}).get("url", ""),
                "bytes": len(data),
                "content_type": content_type,
                "informacion_importante": candidate.get("result", {}).get(
                    "informacion_importante", {}
                ),
            }
    except Exception:
        return None


def _candidate(result: Any, url: str, source: str) -> dict[str, Any]:
    return {
        "url": url,
        "source": source,
        "result": _compact_result(result),
    }


async def _run_search(
    provider: Any,
    provider_name: str,
    query: str,
    **filters: Any,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    response = await provider.search(query, limit=3, **filters)
    candidates: list[dict[str, Any]] = []
    for result in response.results:
        if result.media_url:
            candidates.append(_candidate(result, result.media_url, "media_url"))
        elif result.thumbnail_url:
            candidates.append(_candidate(result, result.thumbnail_url, "thumbnail_url"))
    sample = []
    for result in response.results[:1]:
        compact = _compact_result(result)
        sample.append(
            {
                key: compact[key]
                for key in ("kind", "title", "url")
                if compact.get(key)
            }
        )
    return (
        {
            "status": "ok",
            "query": query,
            "filters": filters,
            "muestra": sample,
            "result_count": len(response.results),
            "total": response.total,
        },
        candidates,
    )


async def _run_openverse(
    adapter: Any,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    provider = adapter.provider("openverse")
    calls: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    used_anonymous = False
    for media_type in ("image", "audio"):
        try:
            result, found = await _run_search(
                provider, "openverse", TOPIC, media_type=media_type
            )
        except Exception as exc:
            # Openverse permite acceso anónimo. Si el token guardado está
            # vencido, se prueba el proveedor sin token, sin editar el .env.
            if "credencial rechazada" not in str(exc):
                calls.append(
                    {
                        "status": "error",
                        "media_type": media_type,
                        "error": _redact(str(exc)),
                    }
                )
                continue
            anonymous = OpenverseProvider(
                config=ResearcherSettings(OPENVERSE_API_TOKEN="")
            )
            try:
                result, found = await _run_search(
                    anonymous, "openverse", TOPIC, media_type=media_type
                )
                result["status"] = "ok_anonymous_fallback"
                result["nota"] = "El token guardado fue rechazado; se probó acceso anónimo."
                used_anonymous = True
            except Exception as anonymous_exc:
                calls.append(
                    {
                        "status": "error",
                        "media_type": media_type,
                        "error": _redact(str(anonymous_exc)),
                    }
                )
                continue
        result["media_type"] = media_type
        calls.append(result)
        candidates.extend(found)
    status = "ok_anonymous_fallback" if used_anonymous else "ok"
    if any(call.get("status") == "error" for call in calls):
        status = "partial"
    return (
        {
            "provider": "openverse",
            "status": status,
            "calls": calls,
            "result_count": sum(call.get("result_count", 0) for call in calls),
        },
        candidates,
    )


async def main() -> None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    adapter = build_researcher_data()
    cases = [
        ("wikipedia", TOPIC, {"language": "en"}),
        ("wikidata", TOPIC, {"language": "en"}),
        ("wikimedia_commons", TOPIC, {}),
        ("wikimedia_enterprise", "Volcano", {"project": "enwiki"}),
        ("library_of_congress", TOPIC, {}),
        ("europeana", TOPIC, {}),
        ("nasa", TOPIC, {}),
        ("nasa_image_video_library", TOPIC, {"media_type": "video"}),
        ("world_bank", "population", {"catalog_limit": 1000}),
        ("openstreetmap", OSM_BBOX, {"bbox": OSM_BBOX}),
        ("overpass", "Kilauea", {"bbox": OVERPASS_BBOX}),
        ("dpla", TOPIC, {}),
    ]

    provider_reports: list[dict[str, Any]] = []
    candidates_by_provider: dict[str, list[dict[str, Any]]] = {}

    for provider_name, query, filters in cases:
        if provider_name == "europeana" and not settings.europeana_api_key:
            provider_reports.append(
                {
                    "provider": provider_name,
                    "status": "pendiente_falta_key",
                    "query": query,
                    "result_count": 0,
                    "nota": "Completar EUROPEANA_API_KEY.",
                }
            )
            continue
        try:
            provider = adapter.provider(provider_name)
            report, candidates = await _run_search(
                provider, provider_name, query, **filters
            )
            report["provider"] = provider_name
            provider_reports.append(report)
            candidates_by_provider.setdefault(provider_name, []).extend(candidates)
        except Exception as exc:
            provider_reports.append(
                {
                    "provider": provider_name,
                    "status": "error",
                    "query": query,
                    "result_count": 0,
                    "error": _redact(str(exc)),
                }
            )

    openverse_report, openverse_candidates = await _run_openverse(adapter)
    provider_reports.append(openverse_report)
    candidates_by_provider["openverse"] = openverse_candidates

    # Añadir el artículo detallado de Wikipedia y los assets reales de NASA.
    wikipedia = adapter.provider("wikipedia")
    try:
        search = await wikipedia.search(TOPIC, language="en", limit=3)
        if search.results:
            article = await wikipedia.article(search.results[0].title, language="en")
            candidates_by_provider.setdefault("wikipedia", []).extend(
                _candidate(article, article.media_url, "article_media_url")
                for _ in [0]
                if article.media_url
            )
    except Exception:
        pass

    nasa_library = adapter.provider("nasa_image_video_library")
    try:
        nasa_search = await nasa_library.search(TOPIC, limit=3, media_type="video")
        if nasa_search.results:
            assets = await nasa_library.asset(nasa_search.results[0].resource_id)
            candidates_by_provider.setdefault("nasa_image_video_library", []).extend(
                _candidate(nasa_search.results[0], url, "asset_url") for url in assets[:2]
            )
    except Exception:
        pass

    downloaded: list[dict[str, Any]] = []
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(45.0),
        headers={"User-Agent": settings.researcher_user_agent},
    ) as client:
        for provider_name, candidates in candidates_by_provider.items():
            unique: list[dict[str, Any]] = []
            seen: set[str] = set()
            for candidate in candidates:
                url = candidate.get("url", "")
                if url and url not in seen:
                    unique.append(candidate)
                    seen.add(url)
            if provider_name == "nasa_image_video_library":
                unique.sort(key=lambda item: item.get("source") != "asset_url")
            for index, candidate in enumerate(unique[:MAX_MEDIA_PER_PROVIDER], 1):
                item = await _download(client, provider_name, index, candidate)
                if item:
                    downloaded.append(item)

    counts = {
        "proveedores": len(provider_reports),
        "correctos": sum(
            item.get("status") in {"ok", "ok_anonymous_fallback"}
            for item in provider_reports
        ),
        "con_error": sum(item.get("status") in {"error", "partial"} for item in provider_reports),
        "pendientes": sum(item.get("status") == "pendiente_falta_key" for item in provider_reports),
        "archivos_descargados": len(downloaded),
    }
    report = {
        "ejecucion": datetime.now(timezone.utc).isoformat(),
        "tema": TOPIC,
        "resumen": counts,
        "proveedores": provider_reports,
        "multimedia_descargada": downloaded,
    }
    RESULTS_FILE.write_text(
        json.dumps(_redact(report), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"REPORT={RESULTS_FILE}")
    print(json.dumps(counts, ensure_ascii=False))
    for item in provider_reports:
        print(f"{item['provider']}: {item['status']} results={item.get('result_count', 0)}")
    print(f"DOWNLOADS={len(downloaded)}")


if __name__ == "__main__":
    asyncio.run(main())
