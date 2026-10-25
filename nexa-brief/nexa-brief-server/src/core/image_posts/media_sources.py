"""Licensed image sources for image-post strategies.

This module speaks to the stock port and its factory registry, so strategies do
not depend on Wikimedia's adapter or its API response format.
"""

from __future__ import annotations

import hashlib
import io
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Literal
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps

from src.core.image_posts.image_licensing import accepted_license, license_simplicity
from src.core.ports.article_image_port import ArticleImagePort
from src.core.ports.image_post_resources import CachedImage, ImageMediaCache
from src.core.ports.stock_media_port import StockItem, StockMediaPort, StockProviderError
from src.core.stock.service import get_stock_providers

Aspect = Literal["4:5", "16:9"]
_USER_AGENT = "NexaBriefWikimediaBot/1.0 (+https://nexa-brief.everdev.space)"
_MAX_FILE_BYTES = 30 * 1024 * 1024
_MAX_SIDE = 2160
_TARGET_RATIOS: dict[str, float] = {"4:5": 4 / 5, "16:9": 16 / 9}
# A replaceable transport keeps download behavior easy to exercise without a network.
_download_transport: httpx.AsyncBaseTransport | None = None


@dataclass(frozen=True)
class SourcedImage:
    provider: str
    provider_id: str
    title: str
    description: str
    width: int
    height: int
    original_width: int
    original_height: int
    url: str
    thumburl: str
    author: str
    author_url: str
    credit: str
    source_url: str
    article_url: str
    license: str
    license_url: str
    attribution: str
    sha256: str
    content: bytes = field(repr=False, compare=False)
    why: str = ""
    source: Literal["search", "article"] = "search"

    @property
    def bytes(self) -> bytes:
        return self.content


def _target_aspect(aspect: Aspect) -> float:
    if aspect not in _TARGET_RATIOS:
        raise ValueError("aspect debe ser '4:5' o '16:9'")
    return _TARGET_RATIOS[aspect]


def pick_best(
    items: Iterable[StockItem | SourcedImage],
    aspect: Aspect = "4:5",
    min_side: int = 1080,
) -> tuple[StockItem | SourcedImage | None, str]:
    """Choose a candidate by resolution, aspect match, and license simplicity."""
    target = _target_aspect(aspect)
    candidates: list[tuple[float, StockItem | SourcedImage, str]] = []
    for item in items:
        if not accepted_license(item.license) or item.width <= 0 or item.height <= 0:
            continue
        ratio = item.width / item.height
        resolution_score = min(1.0, min(item.width, item.height) / max(1, min_side))
        aspect_score = max(0.0, 1.0 - abs(math.log(ratio / target)) / math.log(2))
        license_score = license_simplicity(item.license)
        score = 0.45 * resolution_score + 0.45 * aspect_score + 0.10 * license_score
        why = (
            f"puntaje {score:.3f}: resolución {resolution_score:.2f}, "
            f"aspecto {aspect_score:.2f}, licencia {license_score:.2f} ({item.license})"
        )
        candidates.append((score, item, why))
    if not candidates:
        return None, "sin imágenes con licencia permitida y dimensiones válidas"
    _, chosen, why = max(candidates, key=lambda candidate: candidate[0])
    return chosen, why


def _image_cache_metadata(
    item: StockItem, *, actual_width: int, actual_height: int, sha256: str, extension: str
) -> dict:
    return {
        "provider": item.provider,
        "provider_id": item.provider_id,
        "title": item.title,
        "description": item.description,
        "width": actual_width,
        "height": actual_height,
        "original_width": item.original_width,
        "original_height": item.original_height,
        "url": item.original_url or item.download_url,
        "thumburl": item.thumb_url or item.download_url,
        "author": item.author,
        "author_url": item.author_url,
        "credit": item.credit,
        "source_url": item.source_url,
        "article_url": item.article_url,
        "license": item.license,
        "license_url": item.license_url,
        "attribution": item.attribution,
        "sha256": sha256,
        "extension": extension,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }


def _from_cache(item: StockItem, cache: ImageMediaCache) -> CachedImage | None:
    try:
        cached = cache.get_by_url(item.download_url)
        if cached is None:
            return None
        metadata = dict(cached.metadata)
        cached_at = datetime.fromisoformat(metadata["cached_at"])
        if (datetime.now(timezone.utc) - cached_at).total_seconds() > 7 * 24 * 3600:
            return None
        actual_hash = hashlib.sha256(cached.content).hexdigest()
        if actual_hash != metadata.get("sha256"):
            return None
        # Keep API metadata fresh while reusing the already downloaded bytes.
        refreshed = _image_cache_metadata(
            item,
            actual_width=int(metadata["width"]),
            actual_height=int(metadata["height"]),
            sha256=actual_hash,
            extension=str(metadata["extension"]),
        )
        return cache.put_by_url(item.download_url, cached.content, refreshed)
    except (OSError, ValueError, KeyError, TypeError):
        return None


def _encode_image(content: bytes) -> tuple[bytes, str, int, int]:
    try:
        with Image.open(io.BytesIO(content)) as source:
            image_format = source.format or "JPEG"
            image = ImageOps.exif_transpose(source)
            image.load()
            width, height = image.size
            if max(width, height) > _MAX_SIDE:
                image.thumbnail((_MAX_SIDE, _MAX_SIDE), Image.Resampling.LANCZOS)
                width, height = image.size
                output = io.BytesIO()
                save_format = image_format.upper()
                if save_format == "JPG":
                    save_format = "JPEG"
                if save_format not in {"JPEG", "PNG", "WEBP", "GIF", "TIFF", "BMP"}:
                    save_format = "JPEG"
                if save_format == "JPEG" and image.mode not in ("RGB", "L"):
                    image = image.convert("RGB")
                save_options: dict[str, object] = {}
                if save_format in {"JPEG", "WEBP"}:
                    save_options["quality"] = 90
                if save_format in {"JPEG", "PNG"}:
                    save_options["optimize"] = True
                image.save(output, format=save_format, **save_options)
                content = output.getvalue()
                image_format = save_format
            extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif", "TIFF": ".tiff", "BMP": ".bmp"}.get(image_format.upper())
            if not extension:
                raise ValueError(f"formato de imagen no soportado: {image_format}")
            return content, extension, width, height
    except (OSError, Image.DecompressionBombError) as exc:
        raise ValueError("la descarga no es una imagen válida") from exc


async def _download_and_cache(
    item: StockItem, port: StockMediaPort, cache: ImageMediaCache
) -> CachedImage:
    url = item.download_url
    parsed = urlparse(url)
    if not port.accepts_download_url(url) or parsed.scheme != "https":
        raise StockProviderError("wikimedia", "bad_response", "Wikimedia devolvió una URL de imagen no permitida")
    cached = _from_cache(item, cache)
    if cached:
        return cached

    chunks: list[bytes] = []
    total = 0
    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            transport=_download_transport,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                response_host = (urlparse(str(response.url)).hostname or "").lower()
                if not any(response_host == host or response_host.endswith("." + host) for host in port.download_hosts):
                    raise StockProviderError("wikimedia", "bad_response", "Wikimedia redirigió a un host no permitido")
                length = int(response.headers.get("Content-Length", "0") or 0)
                if length > _MAX_FILE_BYTES:
                    raise StockProviderError("wikimedia", "bad_response", "La imagen supera el tamaño máximo de descarga")
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > _MAX_FILE_BYTES:
                        raise StockProviderError("wikimedia", "bad_response", "La imagen supera el tamaño máximo de descarga")
                    chunks.append(chunk)
    except httpx.HTTPError as exc:
        raise StockProviderError("wikimedia", "network", f"Wikimedia: {type(exc).__name__}") from exc

    content, extension, width, height = _encode_image(b"".join(chunks))
    digest = hashlib.sha256(content).hexdigest()
    metadata = _image_cache_metadata(
        item, actual_width=width, actual_height=height, sha256=digest, extension=extension
    )
    return cache.put_by_url(url, content, metadata)


def _as_sourced_image(item: StockItem, why: str, cached: CachedImage, source: Literal["search", "article"]) -> SourcedImage:
    content, metadata = cached.content, cached.metadata
    return SourcedImage(
        provider=item.provider,
        provider_id=item.provider_id,
        title=item.title,
        description=item.description,
        width=int(metadata["width"]),
        height=int(metadata["height"]),
        original_width=item.original_width,
        original_height=item.original_height,
        url=item.original_url or item.download_url,
        thumburl=item.thumb_url or item.download_url,
        author=item.author,
        author_url=item.author_url,
        credit=item.credit,
        source_url=item.source_url,
        article_url=item.article_url,
        license=item.license,
        license_url=item.license_url,
        attribution=item.attribution,
        sha256=str(metadata["sha256"]),
        content=content,
        why=why,
        source=source,
    )


async def find_images(
    query: str,
    cache: ImageMediaCache,
    article: str | None = None,
    lang: str = "es",
    n: int = 3,
) -> list[SourcedImage]:
    """Find, license-filter, rank, download, and cache Commons images."""
    if n <= 0:
        return []
    registry = get_stock_providers()
    provider = registry.get("wikimedia")
    if not provider:
        raise StockProviderError("wikimedia", "unavailable", "Wikimedia no está registrada en la fábrica de stock")
    items = await provider.search(query, "image", per_page=min(50, max(n * 6, 12)))
    candidates = list(items)
    preferred_article: StockItem | None = None
    if article and isinstance(provider, ArticleImagePort):
        article_item = await provider.article_image(article, lang=lang)
        if article_item:
            duplicate = next((candidate for candidate in candidates if candidate.provider_id == article_item.provider_id), None)
            if duplicate:
                duplicate.article_url = article_item.article_url
                duplicate.source_url = article_item.source_url
                preferred_article = duplicate
            else:
                candidates.append(article_item)
                preferred_article = article_item

    candidates = [item for item in candidates if accepted_license(item.license)]
    chosen_images: list[SourcedImage] = []
    if preferred_article in candidates and preferred_article is not None:
        article_choice, article_why = pick_best([preferred_article])
        if article_choice is not None:
            candidates.remove(preferred_article)
            try:
                cached = await _download_and_cache(article_choice, provider, cache)
                chosen_images.append(_as_sourced_image(article_choice, f"imagen principal del artículo; {article_why}", cached, "article"))
            except (httpx.HTTPError, OSError, ValueError, StockProviderError):
                pass
    while candidates and len(chosen_images) < n:
        chosen, why = pick_best(candidates)
        if chosen is None:
            break
        candidates.remove(chosen)
        try:
            cached = await _download_and_cache(chosen, provider, cache)
        except (httpx.HTTPError, OSError, ValueError, StockProviderError):
            continue
        source: Literal["search", "article"] = "article" if chosen.article_url else "search"
        chosen_images.append(_as_sourced_image(chosen, why, cached, source))
    return chosen_images


