"""Pydantic schemas for the local asset library (listado, subida, edición).

Los campos nuevos de F1 (description, tags, file_url, transcription_*…) tienen
default, así que los clientes que solo leían los campos viejos no cambian.
`tags` sigue siendo el string separado por comas que ya usaba la librería;
`tag_list` es la misma información ya partida, para que el front no la parsee.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

TranscriptionStatus = Literal["none", "pending", "running", "done", "failed"]


class ImageLibraryEntryResponse(BaseModel):
    asset_id: str
    category: str
    source: str
    provider: str
    original_url: str | None = None
    original_filename: str = ""
    label: str = ""
    description: str = ""
    photographer: str = ""
    width: int = 0
    height: int = 0
    orientation: str | None = None
    license_note: str = "unknown"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    tags: str = ""
    tag_list: list[str] = Field(default_factory=list)
    has_vision_cache: bool = False
    file_url: str = ""


class MusicLibraryEntryResponse(BaseModel):
    asset_id: str
    category: str
    source: str
    provider: str
    original_url: str | None = None
    original_filename: str = ""
    track_name: str = ""
    artist: str = ""
    genre: str = ""
    description: str = ""
    tags: str = ""
    tag_list: list[str] = Field(default_factory=list)
    language: str = ""
    duration_seconds: int = 0
    license_note: str = "unknown"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    has_lyrics_cache: bool = False
    transcription_status: TranscriptionStatus = "none"
    transcription_error: str = ""
    file_url: str = ""
    # Solo cuando hay letra cacheada; None = todavía no (ver transcription_status).
    lyrics_url: str | None = None


class VideoLibraryEntryResponse(BaseModel):
    asset_id: str
    category: str
    source: str
    provider: str
    original_url: str | None = None
    original_filename: str = ""
    label: str = ""
    description: str = ""
    tags: str = ""
    tag_list: list[str] = Field(default_factory=list)
    width: int = 0
    height: int = 0
    duration_seconds: float = 0.0
    license_note: str = "unknown"
    added_at: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    has_vision_cache: bool = False
    file_url: str = ""


class LibraryAssetPatch(BaseModel):
    """Cuerpo de PATCH /library/{kind}/{asset_id}. Todos opcionales: solo se
    aplica lo que viene. Los campos que no corresponden al kind se ignoran
    (ej. `artist` en una imagen). `tags` acepta lista o string con comas."""

    category: str | None = None
    label: str | None = None
    track_name: str | None = None
    artist: str | None = None
    genre: str | None = None
    description: str | None = None
    tags: list[str] | str | None = None
    language: str | None = None
    photographer: str | None = None
    license_note: str | None = None


class LibraryDeleteResponse(BaseModel):
    kind: Literal["images", "music", "videos"]
    asset_id: str
    deleted: bool = True


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
