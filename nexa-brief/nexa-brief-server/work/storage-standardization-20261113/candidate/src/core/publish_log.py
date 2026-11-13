"""Published-videos log — registro de cada publicación exitosa (colección "published_videos").

Única fuente de "qué video salió en qué cuenta" (la lista "Últimos videos" y
el contador de Canales salen de acá). TODOS los caminos que publican tienen
que registrar acá: el endpoint manual `POST /publish/`, el auto-publish del
pipeline (`social_publisher.py`) y la cola — "Publicar ahora" y los horarios
programados (`schedule/engine.py`). Vive en `core` (solo depende del
DataStore) justamente para que el engine pueda usarlo sin importar adapters.
"""

from __future__ import annotations

import time

from src.core.data import collection


def _published():
    return collection("published_videos")


async def record_published_video(
    platform: str,
    alias: str,
    post_id: str,
    url: str,
    title: str,
    job_id: str | None = None,
    *,
    published_at: float | None = None,
    origin: str = "nexa",
    extra: dict | None = None,
) -> None:
    """Append one entry to the published-videos log.

    `job_id` enlaza la publicación con el video de Biblioteca, para poder
    ofrecer "eliminar también de las plataformas" al borrar ese video. Es
    None en publicaciones manuales hechas fuera del pipeline.

    `origin`: "nexa" (lo publicó Nexa) o "imported" (lo trajo la sincronización de Canales, con
    su `published_at` real). `extra`: privacidad, duración y métricas (ver channel_sync.py)."""
    await _published().insert({
        "platform": platform,
        "alias": alias,
        "post_id": post_id,
        "url": url,
        "title": title,
        "published_at": published_at if published_at is not None else time.time(),
        "job_id": job_id,
        "origin": origin,
        **(extra or {}),
    })


async def update_published_video(platform: str, alias: str, post_id: str, patch: dict) -> int:
    """Actualiza toda entrada de ese post (puede haber duplicadas). Devuelve cuántas tocó."""
    changed = await _published().update_where({"platform": platform, "alias": alias, "post_id": post_id}, patch)
    return len(changed)


async def remove_published_video(platform: str, alias: str, post_id: str) -> int:
    """Quita del log toda entrada de ese post (puede haber duplicadas). Devuelve cuántas quitó."""
    removed = await _published().delete_where({"platform": platform, "alias": alias, "post_id": post_id})
    return len(removed)


def list_published_videos(platform: str | None = None, alias: str | None = None) -> list[dict]:
    """Return logged publishes, optionally filtered by platform and/or alias."""
    filters = {"platform": platform, "alias": alias}
    return _published().list({k: v for k, v in filters.items() if v is not None})


def list_published_for_job(job_id: str) -> list[dict]:
    return _published().list({"job_id": job_id})
