"""Biblioteca de efectos reutilizables; persistencia detrás del puerto DataStore.

El proveedor entrega un archivo y metadata. Este módulo registra el recurso una
vez, sin conocer APIs externas ni transcribirlo como una canción.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
import uuid

from pydantic import BaseModel, Field

from src.core.data import collection, files

ApprovalStatus = Literal["pending", "approved", "rejected"]

class SoundLibraryEntry(BaseModel):
    video_id: str | None = None
    production_id: str | None = None
    production_name: str = ""
    schema_version: int = 1
    asset_id: str
    category: str = "sound_effects"
    source: str = "auto"
    relative_path: str
    original_filename: str = ""
    title: str = Field(min_length=1, max_length=240)
    description: str = ""
    duration_seconds: float = Field(default=0, ge=0)
    recommended_uses: list[str] = Field(default_factory=list)
    tags: str = ""
    provider: str = ""
    provider_sound_id: str = ""
    original_url: str | None = None
    license_note: str = "unknown"
    license_url: str = ""
    content_hash: str = ""
    approval_status: ApprovalStatus = "pending"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None

_register_lock = asyncio.Lock()

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_sound(asset_id: str) -> SoundLibraryEntry:
    from src.core.library.asset_library import get_entry
    return get_entry("sound", asset_id)


def resolve_sound_path(asset_id: str) -> Path:
    from src.core.library.asset_library import resolve_asset_path
    return resolve_asset_path("sound", asset_id)


def search_sounds(q: str | None = None, category: str | None = None, approved_only: bool = False) -> list[SoundLibraryEntry]:
    from src.core.library.asset_library import search_assets, resolve_asset_path
    entries = search_assets("sound", q=q, category=category)
    return [e for e in entries if (not approved_only or e.approval_status == "approved")
            and resolve_asset_path("sound", e.asset_id).is_file()]

async def register_sound(source_path: Path, *, title: str, description: str = "", recommended_uses: list[str] | None = None,
                         tags: str | list[str] = "", provider: str = "", provider_sound_id: str = "", original_url: str | None = None,
                         license_note: str = "unknown", license_url: str = "", approval_status: ApprovalStatus = "pending",
                         category: str = "sound_effects", source: str = "auto", filename: str | None = None) -> SoundLibraryEntry:
    from src.core.library.asset_library import hash_file, normalize_tags, probe_media, publish_asset_changed
    source_path = Path(source_path)
    digest = hash_file(source_path)
    # Validar antes de copiar, para que un fallo de metadata no deje un archivo huérfano.
    probe = await probe_media(source_path)
    duration = float(probe.get("duration_seconds", 0))
    if duration <= 0:
        raise ValueError("El efecto debe ser un archivo de audio válido con duración positiva.")
    candidate = SoundLibraryEntry(asset_id=uuid.uuid4().hex, relative_path="", original_filename=Path(filename or source_path.name).name,
        title=title.strip(), description=description.strip(), recommended_uses=[s.strip() for s in (recommended_uses or []) if s.strip()],
        tags=normalize_tags(tags), provider=provider, provider_sound_id=provider_sound_id, original_url=original_url,
        license_note=license_note, license_url=license_url, approval_status=approval_status, category=category,
        source=source, duration_seconds=duration, content_hash=digest, added_at=_now())
    async with _register_lock:
        records = collection("sound_assets")
        existing = records.first({"provider": provider, "provider_sound_id": provider_sound_id}) if provider and provider_sound_id else None
        existing = existing or records.first({"content_hash": digest})
        if existing:
            entry = SoundLibraryEntry(**existing)
            if not files("sounds").local_path(entry.relative_path).is_file():
                candidate = entry.model_copy(update={"original_filename": source_path.name})
            else:
                return entry
        storage = files("sounds")
        from src.config.profile_layout import layout_for_settings
        from src.config.settings import settings
        key = (storage.save_asset(source_path, asset_id=candidate.asset_id, filename=candidate.original_filename)
               if layout_for_settings(settings).schema_version >= 3 and hasattr(storage, "save_asset") else
               storage.save(source_path, folder=candidate.category, filename=candidate.original_filename))
        candidate = candidate.model_copy(update={"relative_path": key})
        try:
            await records.upsert(candidate.model_dump(), match=("asset_id",))
        except Exception:
            files("sounds").delete(key)
            raise
    await publish_asset_changed("sound", candidate.asset_id, action="created")
    return candidate

def find_sound_by_hash(content_hash: str) -> SoundLibraryEntry | None:
    raw = collection("sound_assets").first({"content_hash": content_hash})
    return SoundLibraryEntry(**raw) if raw else None

async def mark_sound_used(asset_id: str) -> SoundLibraryEntry:
    from src.core.library.asset_library import touch_usage
    await touch_usage(asset_id, "sound")
    return get_sound(asset_id)
