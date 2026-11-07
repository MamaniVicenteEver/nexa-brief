"""Índice de metadatos de logs; el contenido permanece en archivos separados."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.data import collection


@dataclass(frozen=True)
class ExecutionLog:
    log_id: str
    path: Path


async def register_execution_log(
    key: str | Path, *, kind: str, production_id: str | None = None,
    video_id: str | None = None,
) -> ExecutionLog:
    """Registra una clave relativa al perfil sin abrir ni guardar el contenido."""
    root = layout_for_settings(settings).root.resolve()
    key = Path(key)
    if key.is_absolute() or not key.parts or ".." in key.parts:
        raise ValueError("La clave del log debe ser relativa al perfil")
    path = (root / key).resolve()
    if path == root or not path.is_relative_to(root):
        raise ValueError("La clave del log sale del perfil")
    log_id = uuid.uuid4().hex
    await collection("execution_logs").insert({
        "log_id": log_id, "key": key.as_posix(), "kind": kind,
        "production_id": production_id, "video_id": video_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return ExecutionLog(log_id=log_id, path=path)
