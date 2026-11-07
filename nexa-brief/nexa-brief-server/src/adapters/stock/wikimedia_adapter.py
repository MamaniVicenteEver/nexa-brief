"""Licensed Wikimedia Commons search and Wikipedia lead-image resolution."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from urllib.parse import quote, unquote, urlparse

import httpx

from src.adapters.stock._http import fit_within
from src.core.image_posts.image_licensing import accepted_license
from src.core.ports.article_image_port import ArticleImagePort
from src.core.ports.stock_media_port import (
    StockItem,
    StockKind,
    StockMediaPort,
    StockOrientation,
    StockProviderError,
)

_COMMONS_API = "https://commons.wikimedia.org/w/api.php"
_WIKI_API = "https://{lang}.wikipedia.org/w/api.php"
_USER_AGENT = "NexaBriefWikimediaBot/1.0 (+https://nexa-brief.everdev.space)"
_THUMB_MAX_SIDE = 2160
_EXTMETA_KEYS = "LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription"
_MAX_RETRIES = 2
_MAX_LAG_WAIT = 30.0


class _TextOnly(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def plain_text(value: object) -> str:
    """Turn API extmetadata HTML into compact, publishable text."""
    if not value:
        return ""
    if isinstance(value, dict):
        value = value.get("value", "")
    parser = _TextOnly()
    parser.feed(unescape(str(value)))
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def _deduplicate_repeated_tail(value: str) -> str:
    words = value.split()
    for size in range(len(words) // 2, 0, -1):
        if [word.casefold() for word in words[-2 * size:-size]] == [word.casefold() for word in words[-size:]]:
            return " ".join(words[:-size])
    return value


def _retry_after(response: httpx.Response, default: float) -> float:
    value = response.headers.get("Retry-After", "").strip()
    if not value:
        return default
    try:
        return min(_MAX_LAG_WAIT, max(0.0, float(value)))
    except ValueError:
        try:
            when = parsedate_to_datetime(value)
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            return min(_MAX_LAG_WAIT, max(0.0, (when - datetime.now(timezone.utc)).total_seconds()))
        except (TypeError, ValueError, OverflowError):
            return default


def _article_title(article: str) -> str:
    value = article.strip()
    if "://" in value:
        parsed = urlparse(value)
        value = unquote(parsed.path.rsplit("/wiki/", 1)[-1])
    value = value.split("#", 1)[0].replace("_", " ").strip()
    return re.sub(r"\s+", " ", value)


class WikimediaCommonsAdapter(StockMediaPort, ArticleImagePort):
    """Commons-backed image-only provider; no API key is needed."""

    name = "wikimedia"
    kinds = frozenset({"image"})
    download_hosts = ("upload.wikimedia.org", "commons.wikimedia.org")
    cache_ttl_seconds = 7 * 24 * 3600

    def __init__(
        self,
        transport: httpx.AsyncBaseTransport | None = None,
        *,
        user_agent: str = _USER_AGENT,
        min_request_interval: float = 1.0,
    ) -> None:
        self._transport = transport
        self._user_agent = user_agent
        self._min_request_interval = max(0.0, min_request_interval)
        self._request_lock = asyncio.Lock()
        self._last_request_at = 0.0

    @property
    def configured(self) -> bool:
        return True

    async def search(
        self,
        query: str,
        kind: StockKind,
        *,
        orientation: StockOrientation | None = None,
        page: int = 1,
        per_page: int = 15,
    ) -> list[StockItem]:
        if kind != "image" or not query.strip():
            return []
        limit = min(50, max(1, int(per_page)))
        params: dict[str, object] = {
            "action": "query",
            "format": "json",
            "formatversion": 2,
            "generator": "search",
            "gsrsearch": f"{query.strip()} filetype:bitmap",
            "gsrnamespace": 6,
            "gsrlimit": limit,
            "gsroffset": max(0, (page - 1) * limit),
            **self._imageinfo_params(),
        }
        body = await self._get_json(_COMMONS_API, params)
        pages = (body.get("query") or {}).get("pages") or []
        if isinstance(pages, dict):
            pages = list(pages.values())
        items = [item for page_data in pages if (item := self._item_from_page(page_data))]
        if orientation:
            if orientation == "portrait":
                items = [item for item in items if item.height > item.width]
            elif orientation == "landscape":
                items = [item for item in items if item.width > item.height]
            else:
                items = [item for item in items if item.width and item.height and 0.9 <= item.width / item.height <= 1.1]
        return items

    async def article_image(self, article: str, *, lang: str = "es") -> StockItem | None:
        """Resolve a Wikipedia page's pageprops.page_image filename in Commons."""
        if lang not in {"es", "en"}:
            lang = "es"
        title = _article_title(article)
        if not title:
            return None
        body = await self._get_json(
            _WIKI_API.format(lang=lang),
            {
                "action": "query",
                "format": "json",
                "formatversion": 2,
                "prop": "pageimages|pageprops",
                "piprop": "thumbnail|original",
                "pithumbsize": _THUMB_MAX_SIDE,
                "titles": title,
                "redirects": 1,
                "maxlag": 5,
            },
        )
        pages = (body.get("query") or {}).get("pages") or []
        if isinstance(pages, dict):
            pages = list(pages.values())
        page = next((entry for entry in pages if not entry.get("missing")), None)
        pageprops = (page or {}).get("pageprops") or {}
        file_name = pageprops.get("page_image_free") or pageprops.get("page_image")
        if not file_name:
            return None
        file_title = str(file_name)
        if not file_title.casefold().startswith("file:"):
            file_title = f"File:{file_title}"
        commons = await self._get_json(
            _COMMONS_API,
            {
                "action": "query",
                "format": "json",
                "formatversion": 2,
                "titles": file_title,
                **self._imageinfo_params(),
            },
        )
        commons_pages = (commons.get("query") or {}).get("pages") or []
        if isinstance(commons_pages, dict):
            commons_pages = list(commons_pages.values())
        item = next((result for result in (self._item_from_page(p) for p in commons_pages) if result), None)
        if item and page:
            item.title = item.title or file_name
            item.article_url = f"https://{lang}.wikipedia.org/wiki/{quote(str(page.get('title', title)).replace(' ', '_'))}"
        return item

    def _imageinfo_params(self) -> dict[str, object]:
        return {
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "iiurlwidth": _THUMB_MAX_SIDE,
            "iiextmetadatafilter": _EXTMETA_KEYS,
            "iiextmetadatalanguage": "en",
            "maxlag": 5,
        }

    async def _get_json(self, url: str, params: dict[str, object]) -> dict:
        headers = {"User-Agent": self._user_agent, "Accept": "application/json"}
        for attempt in range(_MAX_RETRIES + 1):
            async with self._request_lock:
                delay = self._min_request_interval - (asyncio.get_running_loop().time() - self._last_request_at)
                if delay > 0:
                    await asyncio.sleep(delay)
                try:
                    async with httpx.AsyncClient(
                        timeout=20.0,
                        transport=self._transport,
                        follow_redirects=True,
                        headers=headers,
                    ) as client:
                        response = await client.get(url, params=params)
                except httpx.HTTPError as exc:
                    raise StockProviderError(self.name, "network", f"wikimedia: {type(exc).__name__}") from exc
                finally:
                    self._last_request_at = asyncio.get_running_loop().time()

            if response.status_code == 429 or response.status_code == 503:
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_retry_after(response, 5.0 * (attempt + 1)))
                    continue
                raise StockProviderError(self.name, "rate_limited", "Wikimedia: límite de solicitudes alcanzado")
            if response.status_code != 200:
                code = "invalid_key" if response.status_code in (401, 403) else "http_error"
                raise StockProviderError(self.name, code, f"Wikimedia: HTTP {response.status_code}")
            try:
                body = response.json()
            except ValueError as exc:
                raise StockProviderError(self.name, "bad_response", "Wikimedia: respuesta no es JSON") from exc
            if not isinstance(body, dict):
                raise StockProviderError(self.name, "bad_response", "Wikimedia: respuesta JSON inválida")
            error = body.get("error") or {}
            if error.get("code") == "maxlag" and attempt < _MAX_RETRIES:
                await asyncio.sleep(_retry_after(response, 5.0))
                continue
            if error:
                if error.get("code") == "maxlag":
                    raise StockProviderError(self.name, "rate_limited", "Wikimedia: API con retraso")
                raise StockProviderError(self.name, "bad_response", f"Wikimedia: {error.get('code', 'error')}")
            return body
        raise StockProviderError(self.name, "rate_limited", "Wikimedia: límite de solicitudes alcanzado")

    def _item_from_page(self, page: dict) -> StockItem | None:
        info = next(iter(page.get("imageinfo") or []), None)
        if not info:
            return None
        meta = info.get("extmetadata") or {}
        short_name = plain_text(meta.get("LicenseShortName"))
        if not accepted_license(short_name):
            return None
        author = _deduplicate_repeated_tail(plain_text(meta.get("Artist")))
        credit = plain_text(meta.get("Credit"))
        if not author:
            author = _deduplicate_repeated_tail(credit)
        if not author and not (short_name.casefold().startswith("pd") or "public domain" in short_name.casefold() or "cc0" in short_name.casefold()):
            return None
        original_url = info.get("url") or ""
        thumb_url = info.get("thumburl") or original_url
        width = int(info.get("thumbwidth") or 0)
        height = int(info.get("thumbheight") or 0)
        original_width = int(info.get("width") or 0)
        original_height = int(info.get("height") or 0)
        if not width or not height:
            width, height = fit_within(original_width, original_height, _THUMB_MAX_SIDE)
        description = plain_text(meta.get("ImageDescription"))
        canonical_title = str(page.get("title") or "")
        if not original_url or not thumb_url or not self.accepts_download_url(thumb_url):
            return None
        if max(width, height) > _THUMB_MAX_SIDE:
            width, height = fit_within(width, height, _THUMB_MAX_SIDE)
        attribution_author = author or "autor no identificado"
        attribution = f"Foto: {attribution_author} · {short_name} · Wikimedia Commons"
        source_url = "https://commons.wikimedia.org/wiki/" + quote(canonical_title.replace(" ", "_"), safe=":()'!,._-" )
        return StockItem(
            provider=self.name,
            provider_id=str(page.get("pageid") or canonical_title),
            kind="image",
            title=description or canonical_title.removeprefix("File:"),
            preview_url=thumb_url,
            download_url=thumb_url,
            width=width,
            height=height,
            author=author,
            source_url=source_url,
            license=short_name,
            license_url=plain_text(meta.get("LicenseUrl")),
            credit=credit,
            description=description,
            attribution=attribution,
            original_url=original_url,
            thumb_url=thumb_url,
            original_width=original_width,
            original_height=original_height,
        )
