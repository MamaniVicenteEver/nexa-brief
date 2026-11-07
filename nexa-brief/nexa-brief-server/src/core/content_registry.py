"""Índice v2 de videos y recursos; los archivos siguen en su ubicación original."""

from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path
from typing import Any

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.data import collection, documents

_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


def _id(value: str, name: str) -> str:
    if not isinstance(value, str) or not _ID.fullmatch(value):
        raise ValueError(f"{name} inválido")
    return value


def _layout():
    layout = layout_for_settings(settings)
    if layout.schema_version < 2:
        raise ValueError("El registro de contenido requiere un perfil v2")
    return layout


def _resource_path(key: str | Path) -> tuple[str, Path]:
    layout = _layout()
    key = Path(key)
    if key.is_absolute() or not key.parts or ".." in key.parts or "\\" in str(key):
        raise ValueError("storage_key debe ser una ruta relativa válida")
    root = layout.root.resolve()
    unresolved = root / key
    for part in (unresolved, *unresolved.parents):
        if part.is_symlink():
            raise ValueError("storage_key no puede atravesar enlaces simbólicos")
        if part == root:
            break
    path = (root / key).resolve()
    allowed = (layout.productions_dir, layout.renders_dir, layout.resources_dir, layout.sandbox_dir)
    if not path.is_relative_to(root) or not any(
        path != directory.resolve() and path.is_relative_to(directory.resolve()) for directory in allowed
    ):
        raise ValueError("storage_key fuera de las carpetas de contenido del perfil")
    return key.as_posix(), path


async def upsert_video(video_id: str, production_id: str, *, details: dict[str, Any] | None = None) -> dict:
    """Registra identidad y opcionalmente reemplaza el documento de detalles."""
    _layout()
    _id(video_id, "video_id")
    _id(production_id, "production_id")
    if details is not None and not isinstance(details, dict):
        raise ValueError("details debe ser un objeto")
    record = await collection("content_videos").upsert(
        {"video_id": video_id, "production_id": production_id}, match=("video_id",)
    )
    if details is not None:
        documents("content_video_details").put(video_id, details)
    return record


async def register_resource(video_id: str, storage_key: str | Path, *, kind: str,
                            asset_id: str | None = None) -> dict:
    """Referencia un archivo por ID sin abrirlo ni copiarlo."""
    _layout()
    _id(video_id, "video_id")
    _id(kind, "kind")
    asset_id = _id(asset_id or uuid.uuid4().hex, "asset_id")
    key, _ = _resource_path(storage_key)
    if collection("content_videos").get(video_id) is None:
        raise ValueError("video no registrado")
    records = collection("content_resources")
    old = records.get(asset_id)
    if old and old.get("video_id") != video_id:
        raise ValueError("asset_id pertenece a otro video")
    return await records.upsert({"asset_id": asset_id, "video_id": video_id,
                                 "storage_key": key, "kind": kind}, match=("asset_id",))


def resolve_resource(asset_id: str) -> Path | None:
    """Resuelve exclusivamente recursos registrados en el perfil seleccionado."""
    _layout()
    _id(asset_id, "asset_id")
    record = collection("content_resources").get(asset_id)
    if record is None:
        return None
    key, path = _resource_path(record["storage_key"])
    if path.is_file() or _layout().schema_version < 3:
        return path
    # Older migrations retained some registered resource keys after moving the
    # corresponding media. Resolve only an exact, profile-local recorded alias.
    alias = documents("legacy_path_aliases").get(hashlib.sha256(key.encode()).hexdigest())
    if alias is None:
        return path
    if not isinstance(alias, dict) or alias.get("legacy_key") != key:
        raise ValueError("Alias de recurso inválido")
    target = alias.get("storage_key")
    if not isinstance(target, str) or not target:
        raise ValueError("Destino de alias inválido")
    target_path = Path(target)
    if target_path.is_absolute():
        root = _layout().root.resolve()
        if not target_path.is_relative_to(root):
            raise ValueError("Alias fuera del perfil")
        target_path = target_path.relative_to(root)
    return _resource_path(target_path)[1]


def get_video(video_id: str) -> dict | None:
    """Reúne detalles y referencias sin leer archivos de contenido ni logs."""
    _layout()
    _id(video_id, "video_id")
    video = collection("content_videos").get(video_id)
    if video is None:
        return None
    return {**video, "details": documents("content_video_details").get(video_id),
            "resources": collection("content_resources").list(where={"video_id": video_id}),
            "logs": collection("execution_logs").list(where={"video_id": video_id})}


async def update_video_details(video_id: str, patch: dict[str, Any]) -> dict:
    """Fusiona detalles sin reemplazar los campos de otras etapas."""
    from src.core.data import get_data_store
    _layout()
    _id(video_id, "video_id")
    async with get_data_store().coordination("content-video-" + video_id):
        if collection("content_videos").get(video_id) is None:
            raise ValueError("video no registrado")
        store = documents("content_video_details")
        details = {**(store.get(video_id) or {}), **patch}
        store.put(video_id, details)
        return details


async def index_production_assets(video_id: str, production_dir: Path, inventory) -> list[dict]:
    """Indexa archivos multimedia sin leerlos; una clave conserva su ID al reintentar."""
    import hashlib
    root = _layout().root.resolve()
    records = []
    for path, kind in inventory.assets(production_dir):
        key = path.relative_to(root).as_posix()
        asset_id = hashlib.sha256(f"{video_id}:{key}".encode()).hexdigest()
        records.append(await register_resource(video_id, key, kind=kind, asset_id=asset_id))
    return records


async def register_recording(video_id: str, recording_id: str, *, outputs: list[Path],
                             log_id: str, duration: str) -> dict:
    """Agrega una grabación y sus archivos sin duplicar sus bytes."""
    import hashlib
    from src.core.data import get_data_store
    root = _layout().root.resolve()
    _id(video_id, "video_id")
    _id(recording_id, "recording_id")
    refs = []
    for path in outputs:
        key = path.relative_to(root).as_posix()
        asset_id = hashlib.sha256(f"{video_id}:{key}".encode()).hexdigest()
        refs.append((await register_resource(video_id, key, kind="video", asset_id=asset_id))["asset_id"])
    async with get_data_store().coordination("content-video-" + video_id):
        store = documents("content_video_details")
        details = store.get(video_id) or {}
        recordings = dict(details.get("recordings") or {})
        recordings[recording_id] = {"recording_id": recording_id, "asset_ids": refs,
                                    "log_id": log_id, "duration": duration}
        details["recordings"] = recordings
        store.put(video_id, details)
    return recordings[recording_id]
