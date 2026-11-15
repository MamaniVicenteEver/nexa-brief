"""Obtiene evidencia pública; el contenido descargado no verifica afirmaciones."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import shutil
import sys
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit
from uuid import uuid4

import httpx

MAX_URLS = 12
MAX_BYTES = 2 * 1024 * 1024
TIMEOUT = 12
MAX_REDIRECTS = 4
_URL = re.compile(r'https?://[^\s<>"\']+', re.I)
_SECRET = re.compile(r"(?:^|[?&])[^=&]*(token|key|secret|password|authorization|signature|credential)[^=&]*=", re.I)


class EvidenceError(ValueError):
    pass


def public_urls_from_text(text):
    if not isinstance(text, str):
        return []
    urls = []
    for match in _URL.finditer(text):
        url = match.group().rstrip(".,;:!?…»”’] }")
        while url.endswith(")") and url.count(")") > url.count("("):
            url = url[:-1]
        urls.append(url)
    return list(dict.fromkeys(urls))[:MAX_URLS]


def public_urls_from_proposal(value):
    urls = []

    def visit(item):
        if isinstance(item, str):
            urls.extend(public_urls_from_text(item))
        elif isinstance(item, dict):
            for v in item.values():
                visit(v)
        elif isinstance(item, list):
            for v in item:
                visit(v)

    visit(value)
    return list(dict.fromkeys(urls))[:MAX_URLS]


# Nombre público usado por el pipeline.
urls_from_proposal = public_urls_from_proposal


def _safe_label(url):
    try:
        parsed = urlsplit(url)
        if not parsed.hostname:
            return "URL inválida"
        host = parsed.hostname
        if ":" in host:
            host = f"[{host}]"
        return urlunsplit((parsed.scheme, host, "/…", "", ""))[:500]
    except (ValueError, TypeError):
        return "URL inválida"


async def _resolve(url):
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        port = parsed.port
    except ValueError:
        raise EvidenceError("URL inválida") from None
    if (
        parsed.scheme not in ("http", "https")
        or not host
        or parsed.username
        or parsed.password
        or port not in (None, 443 if parsed.scheme == "https" else 80)
        or _SECRET.search(parsed.query and "?" + parsed.query or "")
        or "%" in host
    ):
        raise EvidenceError("URL no permitida")
    try:
        ip = ipaddress.ip_address(host)
        addresses = {str(ip)}
    except ValueError:
        if host.lower() == "localhost" or host.lower().endswith((".localhost", ".local")):
            raise EvidenceError("Destino no público") from None
        try:
            records = await asyncio.get_running_loop().getaddrinfo(
                host, port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM
            )
            addresses = {row[4][0] for row in records}
        except OSError:
            raise EvidenceError("No se pudo resolver el destino") from None
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise EvidenceError("Destino no público")
    address = sorted(addresses, key=lambda address: (ipaddress.ip_address(address).version != 4, address))[0]
    authority = f"[{address}]" if ":" in address else address
    pinned = urlunsplit((parsed.scheme, authority, parsed.path or "/", parsed.query, ""))
    return pinned, host


class _HTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.titles = []
        self.hidden = 0
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg", "nav", "footer"):
            self.hidden += 1
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "nav", "footer") and self.hidden:
            self.hidden -= 1
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.titles.append(data)
        elif not self.hidden:
            self.parts.append(data)


async def _extract(body, content_type):
    if body.startswith(b"%PDF-") or "application/pdf" in content_type:
        converter = shutil.which("pdftotext")
        if converter:
            command = (converter, "-f", "1", "-l", "20", "-nopgbrk", "-", "-")
        else:
            # Un proceso aislado limita los PDFs malformados o excesivamente complejos.
            script = """import io, resource, sys
resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
from pypdf import PdfReader
reader = PdfReader(io.BytesIO(sys.stdin.buffer.read()))
parts = []
remaining = 100000
for i in range(min(len(reader.pages), 20)):
    value = reader.pages[i].extract_text() or ''
    parts.append(value[:remaining])
    remaining -= len(parts[-1])
    if remaining <= 0: break
sys.stdout.buffer.write('\\n'.join(parts).encode('utf-8', 'replace'))
"""
            command = (sys.executable, "-c", script)
        try:
            proc = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
        except FileNotFoundError:
            raise EvidenceError("Extractor PDF no disponible") from None
        try:
            output, _ = await asyncio.wait_for(proc.communicate(body), timeout=TIMEOUT)
        except BaseException:
            if proc.returncode is None:
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
            await proc.wait()
            raise
        if proc.returncode:
            raise EvidenceError("No se pudo extraer el PDF")
        return "", output.decode("utf-8", errors="replace")[:100000]
    if "html" not in content_type and not body.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        raise EvidenceError("Formato no compatible")
    parser = _HTML()
    parser.feed(body.decode("utf-8", errors="replace"))
    return " ".join(" ".join(parser.titles).split())[:500], " ".join(" ".join(parser.parts).split())[:100000]


async def _fetch(url):
    original = url
    async with httpx.AsyncClient(
        follow_redirects=False, trust_env=False, timeout=TIMEOUT, limits=httpx.Limits(max_keepalive_connections=0)
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            pinned, host = await _resolve(url)
            async with client.stream(
                "GET",
                pinned,
                headers={
                    "Host": f"[{host}]" if ":" in host else host,
                    "Accept": "text/html,application/pdf",
                    "User-Agent": "NexaBriefResearch/1.0",
                },
                extensions={"sni_hostname": host},
            ) as response:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")
                    if not location:
                        raise EvidenceError("Redirección sin destino")
                    url = urljoin(url, location)
                    continue
                if response.status_code != 200:
                    raise EvidenceError(f"Respuesta HTTP {response.status_code}")
                length = response.headers.get("content-length")
                if length and length.isdigit() and int(length) > MAX_BYTES:
                    raise EvidenceError("Documento excede el límite de tamaño")
                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > MAX_BYTES:
                        raise EvidenceError("Documento excede el límite de tamaño")
                body = bytes(chunks)
                title, text = await _extract(body, response.headers.get("content-type", "").lower())
                if not text.strip():
                    raise EvidenceError("El documento no contiene texto extraíble")
                return {
                    "url": original,
                    "canonical_url": url,
                    "title": title,
                    "text": text,
                    "accessed_at": datetime.now(timezone.utc).isoformat(),
                    "sha256": hashlib.sha256(body).hexdigest(),
                }
        raise EvidenceError("Demasiadas redirecciones")


async def gather_evidence(urls, project: Path, progress) -> list[dict]:
    import time

    unique = list(dict.fromkeys(u for u in urls if isinstance(u, str)))[:MAX_URLS]
    root = Path(project).resolve()
    directory = (root / "work" / "research").resolve()
    if not directory.is_relative_to(root):
        raise EvidenceError("Ruta de evidencia fuera del proyecto")
    semaphore = asyncio.Semaphore(2)
    docs, errors = {}, {}

    async def run(index, url):
        start = time.monotonic()
        ok = False
        try:
            async with semaphore:
                docs[index] = await asyncio.wait_for(_fetch(url), timeout=TIMEOUT)
                ok = True
        except asyncio.TimeoutError:
            errors[index] = {"url": _safe_label(url), "error": "Tiempo agotado"}
        except Exception as exc:
            # Solo errores propios, sin mensajes de red que puedan revelar datos.
            errors[index] = {
                "url": _safe_label(url),
                "error": str(exc) if type(exc) is EvidenceError else "No se pudo descargar el documento",
            }
        finally:
            usage = {
                "stage": "research-fetch",
                "provider": "public-web",
                "model": None,
                "reasoning_effort": None,
                "revision": None,
                "ok": ok,
                "seconds": max(0, time.monotonic() - start),
                "input_tokens": None,
                "cached_input_tokens": None,
                "output_tokens": None,
                "reasoning_tokens": None,
                "total_tokens": None,
                "cost_usd": None,
            }
            await progress("research-fetch", {"usage": usage})

    await asyncio.gather(*(run(i, url) for i, url in enumerate(unique)))
    result = [docs[i] for i in sorted(docs)]
    directory.mkdir(parents=True, exist_ok=True)
    target, temp = directory / "evidence.json", directory / f".evidence-{uuid4().hex}.tmp"
    try:
        temp.write_text(
            json.dumps(
                {
                    "kind": "fetched_evidence",
                    "validated": False,
                    "documents": result,
                    "errors": [errors[i] for i in sorted(errors)],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        temp.replace(target)
        (directory / f"evidence-attempt-{uuid4().hex}.json").write_bytes(target.read_bytes())
    finally:
        temp.unlink(missing_ok=True)
    return result
