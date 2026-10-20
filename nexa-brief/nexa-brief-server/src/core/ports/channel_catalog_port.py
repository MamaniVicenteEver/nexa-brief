"""Channel Catalog Port — leer lo que una cuenta YA tiene publicado en su plataforma.

Separado de PublisherPort (publicar ≠ leer el catálogo): una red se suma a la sincronización de
Canales implementando estas dos lecturas, y las que todavía no pueden (p. ej. TikTok sin el
permiso `video.list`) simplemente no lo implementan. Ver src/core/channel_sync.py.

Todo sale normalizado: el resto del sistema nunca ve el JSON de cada red.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RemoteVideo:
    """Un video publicado en la plataforma, en el mismo formato para todas las redes."""
    post_id: str                         # id de la plataforma (el mismo que devuelve publish())
    url: str
    title: str
    published_at: float                  # epoch (s), fecha real de publicación en la red
    privacy: str = "public"              # 'public' | 'unlisted' | 'private' | 'unknown'
    duration_seconds: float | None = None
    thumbnail_url: str | None = None
    views: int | None = None             # None = la red no lo informa (≠ 0)
    likes: int | None = None
    comments: int | None = None
    kind: str = "video"                  # 'video' | 'short' | 'reel'


@dataclass(frozen=True)
class ChannelStats:
    """Totales de la cuenta según la plataforma."""
    video_count: int | None = None
    followers: int | None = None         # suscriptores (YouTube) / seguidores (Meta)
    views: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


class ChannelCatalogPort(ABC):
    """Lectura del catálogo de una cuenta. Errores: subclases de PublisherError, como en publicar."""

    @abstractmethod
    async def list_channel_videos(self, account_alias: str, *, limit: int | None = None) -> list[RemoteVideo]:
        """Videos publicados en la cuenta, del más nuevo al más viejo (todos, o los `limit` primeros)."""

    @abstractmethod
    async def get_channel_stats(self, account_alias: str) -> ChannelStats:
        """Totales actuales de la cuenta."""
