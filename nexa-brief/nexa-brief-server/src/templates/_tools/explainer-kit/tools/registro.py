"""Registro de videos del kit en el perfil: la misma fuente que usa la app.

`find_video` (places.py) solo acepta videos cuyo registro en content_videos apunta a una
carpeta productions/<categoría>/<id> o sandbox/<categoría>/<id>. Sin ese registro, el kit no
puede trabajar con un video aunque la carpeta exista. Este módulo es la única forma en que el
kit registra un video, nuevo o existente. No mueve carpetas ni cambia otros datos del registro.
"""
from __future__ import annotations

import asyncio
import pathlib
import uuid

from src.config.content_paths import production_root, sandbox_root
from src.core.content_registry import get_video, upsert_video


def folder_key(d: pathlib.Path) -> str:
    """Clave de carpeta con el mismo formato que escribe la app: productions/<cat>/<id>."""
    real = pathlib.Path(d).resolve()
    for prefix, root in (("productions", production_root()), ("sandbox", sandbox_root())):
        try:
            rel = real.relative_to(pathlib.Path(root).resolve())
        except ValueError:
            continue
        if len(rel.parts) != 2:
            break
        return f"{prefix}/{rel.as_posix()}"
    raise ValueError(f"{real} no está en productions/<categoría>/ ni en sandbox/<categoría>/ del perfil")


def registrar(video_id: str, d: pathlib.Path, *, details: dict | None = None) -> dict:
    """Registra el video apuntando a su carpeta. Es idempotente y nunca lo reasigna a otra carpeta."""
    key = folder_key(d)
    actual = get_video(video_id)
    actual_details = dict((actual or {}).get("details") or {})
    previa = actual_details.get("folder_key")
    if previa == key:
        return {"estado": "ya registrado", "folder_key": key}
    if previa:
        raise ValueError(f"{video_id} ya está registrado en {previa}; no lo reasigno a {key}")
    pid = (actual or {}).get("production_id") or f"kit-{uuid.uuid4().hex[:12]}"
    merged = {**actual_details, **(details or {}), "folder_key": key}
    asyncio.run(upsert_video(video_id, production_id=pid, details=merged))
    return {"estado": "registrado", "folder_key": key}
