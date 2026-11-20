"""Descubrimiento público acotado; no certifica afirmaciones ni fuentes primarias."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
from uuid import uuid4

from src.adapters.researcher_data.factory import ResearcherDataAdapter

PROVIDERS = ("wikipedia", "nasa_image_video_library", "library_of_congress")
TIMEOUT_SECONDS = 30
_PATH = re.compile(r"(?<![\w:/])/(?!/)|(?:^|\s)~[/\\]|\b[A-Za-z]:\\|file://", re.I)


class _Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def _plain(value, limit):
    parser = _Text()
    parser.feed(str(value or ""))
    return " ".join(unescape(" ".join(parser.parts)).split())[:limit]


def _public_url(value):
    try:
        parsed = urlsplit(str(value or ""))
        host = parsed.hostname
        if parsed.scheme not in ("http", "https") or not host or parsed.username or parsed.password:
            return ""
        if host.lower() == "localhost" or host.lower().endswith((".localhost", ".local")):
            return ""
        try:
            if not ipaddress.ip_address(host).is_global:
                return ""
        except ValueError:
            pass
        return parsed.geturl()
    except ValueError:
        return ""


async def gather(topic: str, project: Path, progress) -> list[dict]:
    """Consulta catálogos públicos; los textos son fragmentos, no investigación validada.

    El consumidor debe contrastar cada afirmación con dos fuentes primarias antes de
    aprobar. Esta función nunca considera el descubrimiento como validación.
    """
    if not isinstance(topic, str) or not topic.strip() or len(topic) > 500 or _PATH.search(topic):
        raise ValueError("El tema debe tener entre 1 y 500 caracteres y no contener rutas privadas")
    topic = topic.strip()
    root = Path(project).resolve()
    directory = (root / "work" / "research").resolve()
    if not directory.is_relative_to(root):
        raise ValueError("La ruta de investigación debe permanecer dentro del proyecto")
    adapter = ResearcherDataAdapter()
    semaphore = asyncio.Semaphore(2)
    results: dict[str, list[dict]] = {}

    async def search(provider):
        started = time.monotonic()
        ok = False
        try:
            async with semaphore:
                response = await adapter.search_one(provider, topic, page=1, limit=3)
                accessed = datetime.now(timezone.utc).isoformat()
                documents = []
                for item in response.results[:3]:
                    url = _public_url(item.url)
                    if not url:
                        continue
                    documents.append(
                        {
                            "provider": provider,
                            "title": _plain(item.title, 1000),
                            "url": url,
                            "text": _plain(item.description, 8000),
                            "date": _plain(item.date, 100),
                            "accessed_at": accessed,
                        }
                    )
                results[provider] = documents
                ok = True
        except asyncio.CancelledError:
            raise
        except Exception:
            results[provider] = []
        finally:
            usage = {
                "stage": "research-search",
                "provider": provider,
                "model": None,
                "revision": None,
                "reasoning_effort": None,
                "ok": ok,
                "seconds": max(0.0, time.monotonic() - started),
                "input_tokens": None,
                "cached_input_tokens": None,
                "output_tokens": None,
                "reasoning_tokens": None,
                "total_tokens": None,
                "cost_usd": None,
            }
            await progress("research-search", {"usage": usage})

    tasks = [asyncio.create_task(search(provider)) for provider in PROVIDERS]
    try:
        _, pending = await asyncio.wait(tasks, timeout=TIMEOUT_SECONDS)
        for task in pending:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    documents = [document for provider in PROVIDERS for document in results.get(provider, [])]
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "discovery.json"
    temp = directory / f".discovery-{uuid4().hex}.tmp"
    try:
        temp.write_text(
            json.dumps({"kind": "discovery", "validated": False, "documents": documents}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temp.replace(target)
    finally:
        temp.unlink(missing_ok=True)
    return documents
