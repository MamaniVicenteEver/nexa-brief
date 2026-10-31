"""Sincronización de Canales: trae de cada plataforma lo que la cuenta ya tiene publicado.

El registro local (`published_videos`, ver publish_log.py) solo conoce lo que publicó Nexa, y se
pierde si se pierde `data/`. Esto lo reconstruye y lo mantiene al día leyendo el catálogo real de
la cuenta (ChannelCatalogPort), sin depender de qué red es:

  - un post que ya está en el registro → solo se actualizan sus números (vistas, likes…);
  - un post que no está → se agrega con origin="imported" y su fecha real de publicación;
  - los totales de la cuenta (videos, seguidores, vistas) quedan en el canal (`channels`).

La clave de un post es (platform, alias, post_id): sincronizar dos veces nunca duplica.
Se corre al conectar una cuenta, con el botón «Sincronizar» y una vez al día (scheduler).
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass

import structlog

from src.core import publish_log
from src.core.data import collection
from src.core.ports.channel_catalog_port import ChannelCatalogPort, ChannelStats, RemoteVideo

logger = structlog.get_logger(__name__)

ORIGIN_NEXA = "nexa"
ORIGIN_IMPORTED = "imported"


@dataclass(frozen=True)
class SyncSummary:
    platform: str
    alias: str
    remote_total: int        # videos que la plataforma devolvió
    imported: int            # nuevos en el registro
    updated: int             # ya estaban: se refrescaron sus números
    stats: ChannelStats
    synced_at: float


def _details(video: RemoteVideo, now: float) -> dict:
    """Lo que cambia con el tiempo en un post: se reescribe en cada sincronización."""
    return {
        "url": video.url,  # el permalink de la red manda (el armado al publicar puede quedar viejo)
        "privacy": video.privacy,
        "kind": video.kind,
        "duration_seconds": video.duration_seconds,
        "thumbnail_url": video.thumbnail_url,
        "metrics": {"views": video.views, "likes": video.likes, "comments": video.comments, "synced_at": now},
    }


# Un registro de Nexa y un post de la red son el mismo si coinciden el título y la fecha (± 2 días:
# la hora local de publicación vs. la que informa la red, o una publicación programada).
_RECONCILE_WINDOW_SECONDS = 2 * 86_400


def _norm(title: str) -> str:
    return " ".join(title.casefold().split())


def _matching_orphan(video: RemoteVideo, orphans: list[dict]) -> dict | None:
    title = _norm(video.title)
    if not title:
        return None
    return next(
        (
            e for e in orphans
            if _norm(e.get("title") or "") == title
            and abs((e.get("published_at") or 0) - video.published_at) <= _RECONCILE_WINDOW_SECONDS
        ),
        None,
    )


async def sync_channel(platform: str, alias: str, catalog: ChannelCatalogPort) -> SyncSummary:
    """Sincroniza una cuenta. Los errores de la plataforma (PublisherError) suben tal cual."""
    remote = await catalog.list_channel_videos(alias)
    stats = await catalog.get_channel_stats(alias)
    now = time.time()

    local = publish_log.list_published_videos(platform, alias)
    known = {entry.get("post_id") for entry in local}
    remote_ids = {video.post_id for video in remote}
    # Registros de Nexa cuyo id no existe en la red (p. ej. guardaron un id de sesión de subida en
    # vez del id del video): candidatos a corregirse con el post real en lugar de duplicarlo.
    orphans = [e for e in local if e.get("origin", ORIGIN_NEXA) == ORIGIN_NEXA and e.get("post_id") not in remote_ids]
    imported = updated = 0
    for video in remote:
        details = _details(video, now)
        if video.post_id in known:
            await publish_log.update_published_video(platform, alias, video.post_id, details)
            updated += 1
            continue
        orphan = _matching_orphan(video, orphans)
        if orphan is not None:
            orphans.remove(orphan)
            await publish_log.update_published_video(
                platform, alias, orphan["post_id"], {"post_id": video.post_id, **details}
            )
            logger.info("channel_sync_reconciled", platform=platform, alias=alias,
                        old_post_id=orphan["post_id"], post_id=video.post_id)
            known.add(video.post_id)
            updated += 1
            continue
        await publish_log.record_published_video(
            platform=platform, alias=alias, post_id=video.post_id, url=video.url, title=video.title,
            published_at=video.published_at, origin=ORIGIN_IMPORTED, extra=details,
        )
        known.add(video.post_id)
        imported += 1

    await collection("channels").update_where(
        {"platform": platform, "alias": alias},
        {"stats": asdict(stats), "synced_at": now},
    )
    summary = SyncSummary(platform, alias, len(remote), imported, updated, stats, now)
    logger.info(
        "channel_sync_done", platform=platform, alias=alias,
        remote_total=summary.remote_total, imported=imported, updated=updated,
    )
    return summary
