"""SFXMint biblioteca: solo GET, sin generación de pago ni claves."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import httpx

from src.core.ports.sound_effects_port import SoundCandidate, SoundDesignError

_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SFXMintAdapter:
    name = "sfxmint"
    base_url = "https://sfxmint.com"

    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None):
        self.transport = transport

    def _candidate(self, item: dict) -> SoundCandidate:
        slug = str(item.get("slug", ""))
        if not _SLUG.fullmatch(slug):
            raise SoundDesignError("Identificador SFXMint inválido.")
        if item.get("license") != "CC0":
            raise SoundDesignError("Solo importamos sonidos de biblioteca con licencia CC0 confirmada.")
        metadata = (item.get("format_metadata") or {}).get("wav") or {}
        return SoundCandidate(
            self.name,
            slug,
            str(item.get("title", slug)),
            str(item.get("description", "")),
            float(item.get("duration_ms", 0)) / 1000,
            tuple(str(x) for x in item.get("tags", [])),
            self.base_url + "/sounds/" + slug,
            self.base_url + "/dl/" + slug + ".wav",
            "CC0",
            "https://creativecommons.org/publicdomain/zero/1.0/",
            str(metadata.get("sha256", "")),
        )

    async def search(self, query: str, *, max_duration: float | None = None, limit: int = 10) -> list[SoundCandidate]:
        params = {"q": query, "response": "structured", "limit": min(30, max(1, limit))}
        if max_duration is not None:
            params["max_duration_ms"] = round(max_duration * 1000)
        async with httpx.AsyncClient(transport=self.transport, timeout=30) as client:
            response = await client.get(self.base_url + "/api/v1/search", params=params)
            response.raise_for_status()
            data = response.json()
        # Nunca convertimos near_matches en candidatos aptos.
        items = data.get("candidates", []) if isinstance(data, dict) else data
        return [self._candidate(item) for item in items if item.get("license") == "CC0"][:limit]

    async def get(self, provider_sound_id: str) -> SoundCandidate:
        if not _SLUG.fullmatch(provider_sound_id):
            raise SoundDesignError("Identificador SFXMint inválido.")
        async with httpx.AsyncClient(transport=self.transport, timeout=30) as client:
            response = await client.get(self.base_url + "/api/v1/sounds/" + provider_sound_id)
            response.raise_for_status()
        candidate = self._candidate(response.json())
        if candidate.provider_sound_id != provider_sound_id:
            raise SoundDesignError("El proveedor devolvió otro sonido.")
        return candidate

    async def download(self, candidate: SoundCandidate, destination: Path) -> None:
        expected = self.base_url + "/dl/" + candidate.provider_sound_id + ".wav"
        parsed = urlparse(candidate.download_url)
        if candidate.provider != self.name or candidate.download_url != expected or parsed.hostname != "sfxmint.com":
            raise SoundDesignError("Origen de descarga no permitido.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            async with httpx.AsyncClient(transport=self.transport, timeout=90, follow_redirects=False) as client:
                async with client.stream("GET", expected) as response:
                    response.raise_for_status()
                    if response.is_redirect:
                        raise SoundDesignError("SFXMint devolvió una redirección inesperada.")
                    mime = response.headers.get("content-type", "").split(";", 1)[0].lower()
                    if mime and not (mime.startswith("audio/") or mime == "application/octet-stream"):
                        raise SoundDesignError("El proveedor no entregó contenido de audio.")
                    size = 0
                    with destination.open("wb") as stream:
                        async for chunk in response.aiter_bytes():
                            size += len(chunk)
                            if size > 50 * 1024 * 1024:
                                raise SoundDesignError("El sonido supera el límite de 50 MB.")
                            stream.write(chunk)
                    if size < 44:
                        raise SoundDesignError("El proveedor no entregó un archivo de audio válido.")
        except Exception:
            destination.unlink(missing_ok=True)
            raise
