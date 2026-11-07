"""Bounded stock-image downloads and JPEG conversion for host-owned workflows."""
from __future__ import annotations

import io
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from PIL import Image, ImageOps

MAX_IMAGE = 8 * 1024 * 1024


class SafeImageError(ValueError):
    """An image URL or image supplied by a stock provider is unsafe."""


def public_url(url: str) -> str:
    try:
        parsed = urlsplit(url or '')
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
            return ''
        return urlunsplit(('https', parsed.netloc, parsed.path, '', ''))
    except ValueError:
        return ''


def allowed(provider, url: str) -> bool:
    try:
        parsed = urlsplit(url)
        return bool(public_url(url) and parsed.port in (None, 443) and provider.accepts_download_url(url))
    except ValueError:
        return False


async def download(provider, url: str, *, transport=None) -> bytes:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20, connect=8), follow_redirects=False,
                                     trust_env=False, transport=transport,
                                     headers={'User-Agent': 'nexa-brief-host-media/1.0'}) as client:
            for _ in range(4):
                if not allowed(provider, url):
                    raise SafeImageError('URL de proveedor no autorizada')
                async with client.stream('GET', url) as response:
                    if response.is_redirect:
                        location = response.headers.get('location')
                        if not location:
                            raise SafeImageError('Redirección de imagen inválida')
                        url = urljoin(url, location)
                        continue
                    response.raise_for_status()
                    length = response.headers.get('content-length')
                    if length and int(length) > MAX_IMAGE:
                        raise SafeImageError('Imagen demasiado grande')
                    result = bytearray()
                    async for chunk in response.aiter_bytes():
                        result.extend(chunk)
                        if len(result) > MAX_IMAGE:
                            raise SafeImageError('Imagen demasiado grande')
                    return bytes(result)
        raise SafeImageError('Demasiadas redirecciones de imagen')
    except (httpx.HTTPError, OSError) as exc:
        raise SafeImageError('Descarga de imagen no disponible') from exc


def to_jpeg(raw: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in {'JPEG', 'PNG', 'WEBP'} or source.width * source.height > 25_000_000:
                raise ValueError
            image = ImageOps.exif_transpose(source).convert('RGB')
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            image.save(out, format='JPEG', quality=88, optimize=True)
            return out.getvalue()
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise SafeImageError('El proveedor no devolvió una imagen válida') from exc
