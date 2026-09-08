"""Pydantic schemas for the local asset library (read-only listing endpoints)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ImageLibraryEntryResponse(BaseModel):
    asset_id: str
    category: str
    source: str
    provider: str
    original_url: str | None = None
    label: str = ""
    photographer: str = ""
    width: int = 0
    height: int = 0
    orientation: str | None = None
    license_note: str = "unknown"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    tags: str = ""
    has_vision_cache: bool = False


class MusicLibraryEntryResponse(BaseModel):
    asset_id: str
    category: str
    source: str
    provider: str
    original_url: str | None = None
    track_name: str = ""
    artist: str = ""
    genre: str = ""
    duration_seconds: int = 0
    license_note: str = "unknown"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None


class VideoLibraryEntryResponse(BaseModel):
    asset_id: str
    category: str
    source: str
    provider: str
    original_url: str | None = None
    label: str = ""
    width: int = 0
    height: int = 0
    duration_seconds: float = 0.0
    license_note: str = "unknown"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    has_vision_cache: bool = False


class TemplateConfigEntryResponse(BaseModel):
    job_id: str
    template_id: str
    niche_id: str
    image_asset_id: str | None = None
    music_asset_id: str | None = None
    created_at: str = ""
    texts: dict[str, str] = {}


class TemplateConfigDetailResponse(BaseModel):
    job_id: str
    config: dict[str, Any]
