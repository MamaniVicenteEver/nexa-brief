"""Asset Library — local, JSON-indexed store of reusable images/music/configs.

Not a database engine: just folders + flat JSON index files (same style as
`data/channels.json`), organized by category. Populated both by resources the
pipeline finds automatically (Stage 3, `resource_fetcher.py`) and by resources
the user explicitly provides via `ImageSource`/`MusicSource` (URL or an
existing library reference) — so every asset ever used becomes reusable.

Structure on disk:
    data/image_library/{category}/{asset_id}.{ext}
    data/image_library/_index.json
    data/image_library/_vision_cache/{asset_id}.json      # cached Prompt-1 output
    data/music_library/{category}/{asset_id}.{ext}
    data/music_library/_index.json
    data/template_configs/{template_id}/{job_id}.json      # archived config.json
    data/template_configs/_index.json

Concurrency: `max_parallel_jobs` runs `resource_fetcher` for several jobs at
once, and each may write to the same index file. Every read-modify-write on
an index goes through a per-file `asyncio.Lock` (module-level, one lock per
index path) to avoid lost updates — the same "read all / modify / write all"
pattern already used for `data/channels.json`, but that file is only touched
by rare manual OAuth flows, never once-per-job, so it never needed a lock.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import structlog
from pydantic import BaseModel, Field

from src.config.exceptions import AssetDownloadError, AssetNotFoundError
from src.config.settings import settings

logger = structlog.get_logger(__name__)

# ── Per-index-file locks (module-level, keyed by resolved path) ──────────────
_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)


def _lock_for(path: Path) -> asyncio.Lock:
    return _locks[path]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Entry models ──────────────────────────────────────────────────────────────

class ImageLibraryEntry(BaseModel):
    asset_id: str
    category: str
    relative_path: str                # relative to settings.image_library_dir
    source: str                       # "auto" | "url"
    provider: str = ""                # "unsplash" | "pexels" | "pixabay" | "css_fallback" | "user_url"
    original_url: str | None = None
    # Nombre/descripción humana del sujeto de la imagen. Al registrar, respaldo
    # débil (nombre de archivo subido, si lo hay); visual_designer.py lo
    # reemplaza con la descripción real del Vision Extractor (main_subject.label
    # + scene_overview.short_description) en cuanto está disponible — ver
    # update_image_label(). Solo nichos config-driven llegan a tener la versión buena.
    label: str = ""
    photographer: str = ""
    width: int = 0
    height: int = 0
    orientation: str | None = None
    color_filter_used: str | None = None
    validation_score: float | None = None
    license_note: str = "unknown"
    added_at: str = ""
    added_by_job_id: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    tags: str = ""
    has_vision_cache: bool = False


class MusicLibraryEntry(BaseModel):
    asset_id: str
    category: str
    relative_path: str                # relative to settings.music_library_dir
    source: str                       # "auto" | "url"
    provider: str = ""                # "pixabay" | "jamendo" | "ytdlp" | "user_url"
    original_url: str | None = None
    track_name: str = ""
    artist: str = ""
    genre: str = ""
    duration_seconds: int = 0
    license_note: str = "unknown"
    added_at: str = ""
    added_by_job_id: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    has_lyrics_cache: bool = False


class VideoLibraryEntry(BaseModel):
    """Video de fondo (ej. motion-backdrop) — solo LIBRARY/URL/UPLOAD, no hay
    proveedor de stock de video integrado (a diferencia de imagen/música)."""
    asset_id: str
    category: str
    relative_path: str                # relative to settings.video_library_dir
    source: str                       # "url" | "upload"
    provider: str = ""                # "user_url" | "user_upload"
    original_url: str | None = None
    label: str = ""
    width: int = 0
    height: int = 0
    duration_seconds: float = 0.0
    license_note: str = "unknown"
    added_at: str = ""
    added_by_job_id: str = ""
    usage_count: int = 0
    last_used_at: str | None = None
    has_vision_cache: bool = False


class TemplateConfigEntry(BaseModel):
    job_id: str
    template_id: str
    niche_id: str
    config_path: str                  # relative to settings.template_configs_dir
    image_asset_id: str | None = None
    music_asset_id: str | None = None
    video_asset_id: str | None = None
    created_at: str = ""
    texts: dict[str, str] = Field(default_factory=dict)


# ── Index path helpers ────────────────────────────────────────────────────────

def _image_index_path() -> Path:
    return settings.image_library_dir / "_index.json"


def _music_index_path() -> Path:
    return settings.music_library_dir / "_index.json"


def _video_index_path() -> Path:
    return settings.video_library_dir / "_index.json"


def _template_configs_index_path() -> Path:
    return settings.template_configs_dir / "_index.json"


# ── Low-level index I/O (atomic write, same pattern as TokenStorage) ─────────

def _read_index(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("asset_library_index_corrupt", path=str(path))
        return []


def _write_index(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


async def _append_entry(path: Path, entry: dict[str, Any]) -> None:
    async with _lock_for(path):
        data = _read_index(path)
        data.append(entry)
        _write_index(path, data)


def _find_raw(path: Path, asset_id: str) -> dict[str, Any] | None:
    for item in _read_index(path):
        if item.get("asset_id") == asset_id:
            return item
    return None


# ── Physical copy helper ──────────────────────────────────────────────────────

def _copy_into_library(src_path: Path, library_dir: Path, category: str) -> tuple[str, Path]:
    """Copy *src_path* into library_dir/category/{new_asset_id}{ext}. Returns (asset_id, dest_path)."""
    asset_id = uuid.uuid4().hex[:8]
    ext = src_path.suffix or ""
    dest_dir = library_dir / category
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / f"{asset_id}{ext}"
    shutil.copy2(src_path, dest_path)
    return asset_id, dest_path


# ── Images ────────────────────────────────────────────────────────────────────

async def register_image(
    path: Path,
    *,
    category: str,
    source: str,
    provider: str = "",
    original_url: str | None = None,
    job_id: str = "",
    **meta: Any,
) -> ImageLibraryEntry:
    """Archive an image (already downloaded/provided at *path*) into the library.

    *path* is copied, not moved — the caller keeps using its own copy
    (e.g. the job's output_dir/bg.jpg) untouched.
    """
    asset_id, dest_path = _copy_into_library(path, settings.image_library_dir, category)
    entry = ImageLibraryEntry(
        asset_id=asset_id,
        category=category,
        relative_path=str(dest_path.relative_to(settings.image_library_dir)),
        source=source,
        provider=provider,
        original_url=original_url,
        label=meta.get("label", "") or "",
        photographer=meta.get("photographer", ""),
        width=meta.get("width", 0),
        height=meta.get("height", 0),
        orientation=meta.get("orientation"),
        color_filter_used=meta.get("color_filter_used"),
        validation_score=meta.get("validation_score"),
        license_note=meta.get("license_note", "unknown"),
        added_at=_now_iso(),
        added_by_job_id=job_id,
        usage_count=1,
        last_used_at=_now_iso(),
        tags=meta.get("tags", "") or "",
        has_vision_cache=False,
    )
    await _append_entry(_image_index_path(), entry.model_dump())
    logger.info("asset_library_image_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_image_entry(asset_id: str) -> ImageLibraryEntry:
    raw = _find_raw(_image_index_path(), asset_id)
    if raw is None:
        raise AssetNotFoundError(f"Image asset_id '{asset_id}' not found in the local library.")
    return ImageLibraryEntry(**raw)


def list_images(category: str | None = None) -> list[ImageLibraryEntry]:
    entries = [ImageLibraryEntry(**d) for d in _read_index(_image_index_path())]
    if category:
        entries = [e for e in entries if e.category == category]
    return entries


def resolve_image_path(asset_id: str) -> Path:
    entry = get_image_entry(asset_id)
    return settings.image_library_dir / entry.relative_path


# ── Music ─────────────────────────────────────────────────────────────────────

async def register_music(
    path: Path,
    *,
    category: str,
    source: str,
    provider: str = "",
    original_url: str | None = None,
    job_id: str = "",
    **meta: Any,
) -> MusicLibraryEntry:
    asset_id, dest_path = _copy_into_library(path, settings.music_library_dir, category)
    entry = MusicLibraryEntry(
        asset_id=asset_id,
        category=category,
        relative_path=str(dest_path.relative_to(settings.music_library_dir)),
        source=source,
        provider=provider,
        original_url=original_url,
        track_name=meta.get("track_name", ""),
        artist=meta.get("artist", ""),
        genre=meta.get("genre", ""),
        duration_seconds=meta.get("duration_seconds", 0),
        license_note=meta.get("license_note", "unknown"),
        added_at=_now_iso(),
        added_by_job_id=job_id,
        usage_count=1,
        last_used_at=_now_iso(),
    )
    await _append_entry(_music_index_path(), entry.model_dump())
    logger.info("asset_library_music_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_music_entry(asset_id: str) -> MusicLibraryEntry:
    raw = _find_raw(_music_index_path(), asset_id)
    if raw is None:
        raise AssetNotFoundError(f"Music asset_id '{asset_id}' not found in the local library.")
    return MusicLibraryEntry(**raw)


def list_music(category: str | None = None) -> list[MusicLibraryEntry]:
    entries = [MusicLibraryEntry(**d) for d in _read_index(_music_index_path())]
    if category:
        entries = [e for e in entries if e.category == category]
    return entries


def resolve_music_path(asset_id: str) -> Path:
    entry = get_music_entry(asset_id)
    return settings.music_library_dir / entry.relative_path


def _normalize_track_name(text: str) -> str:
    return " ".join(text.strip().lower().split())


def find_music_by_name(track_name: str, artist: str | None = None) -> MusicLibraryEntry | None:
    """Busca una canción ya archivada por nombre (y artista, si se da) —
    comparación normalizada (case-insensitive, espacios colapsados).

    register_music() no dedupea por contenido (asset_id es un UUID random),
    así que esta es la única forma de detectar "esta canción ya existe" al
    subir un archivo — clave para no re-registrar NI re-transcribir (Fase 4 de
    lyrics_video_*: la transcripción es cara, evitar duplicados evita pagarla
    dos veces por la misma canción)."""
    if not track_name:
        return None
    target_name = _normalize_track_name(track_name)
    target_artist = _normalize_track_name(artist) if artist else None
    for entry in list_music():
        if _normalize_track_name(entry.track_name) != target_name:
            continue
        if target_artist and _normalize_track_name(entry.artist) != target_artist:
            continue
        return entry
    return None


# ── Video ─────────────────────────────────────────────────────────────────────

async def register_video(
    path: Path,
    *,
    category: str,
    source: str,
    provider: str = "",
    original_url: str | None = None,
    job_id: str = "",
    **meta: Any,
) -> VideoLibraryEntry:
    asset_id, dest_path = _copy_into_library(path, settings.video_library_dir, category)
    entry = VideoLibraryEntry(
        asset_id=asset_id,
        category=category,
        relative_path=str(dest_path.relative_to(settings.video_library_dir)),
        source=source,
        provider=provider,
        original_url=original_url,
        label=meta.get("label", "") or "",
        width=meta.get("width", 0),
        height=meta.get("height", 0),
        duration_seconds=meta.get("duration_seconds", 0.0),
        license_note=meta.get("license_note", "unknown"),
        added_at=_now_iso(),
        added_by_job_id=job_id,
        usage_count=1,
        last_used_at=_now_iso(),
        has_vision_cache=False,
    )
    await _append_entry(_video_index_path(), entry.model_dump())
    logger.info("asset_library_video_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_video_entry(asset_id: str) -> VideoLibraryEntry:
    raw = _find_raw(_video_index_path(), asset_id)
    if raw is None:
        raise AssetNotFoundError(f"Video asset_id '{asset_id}' not found in the local library.")
    return VideoLibraryEntry(**raw)


def list_videos(category: str | None = None) -> list[VideoLibraryEntry]:
    entries = [VideoLibraryEntry(**d) for d in _read_index(_video_index_path())]
    if category:
        entries = [e for e in entries if e.category == category]
    return entries


def resolve_video_path(asset_id: str) -> Path:
    entry = get_video_entry(asset_id)
    return settings.video_library_dir / entry.relative_path


# ── Usage tracking (shared by images, music and video) ────────────────────────

_KIND_INDEX_PATHS = {
    "image": _image_index_path,
    "music": _music_index_path,
    "video": _video_index_path,
}


async def touch_usage(asset_id: str, kind: str) -> None:
    """Increment usage_count / bump last_used_at for a library asset.

    kind: "image" | "music" | "video"
    """
    path = _KIND_INDEX_PATHS[kind]()
    async with _lock_for(path):
        data = _read_index(path)
        for item in data:
            if item.get("asset_id") == asset_id:
                item["usage_count"] = int(item.get("usage_count", 0)) + 1
                item["last_used_at"] = _now_iso()
                _write_index(path, data)
                return
        raise AssetNotFoundError(f"{kind} asset_id '{asset_id}' not found — cannot record usage.")


# ── Vision cache (Prompt-1 output, keyed by image asset_id) ──────────────────

def get_vision_cache(asset_id: str) -> dict[str, Any] | None:
    path = settings.image_library_dir / "_vision_cache" / f"{asset_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("asset_library_vision_cache_corrupt", asset_id=asset_id)
        return None


async def save_vision_cache(asset_id: str, vision_json: dict[str, Any]) -> None:
    cache_dir = settings.image_library_dir / "_vision_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{asset_id}.json").write_text(
        json.dumps(vision_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    index_path = _image_index_path()
    async with _lock_for(index_path):
        data = _read_index(index_path)
        for item in data:
            if item.get("asset_id") == asset_id:
                item["has_vision_cache"] = True
                _write_index(index_path, data)
                break
    logger.info("asset_library_vision_cache_saved", asset_id=asset_id)


async def update_image_label(asset_id: str, label: str) -> None:
    """Patchea el campo `label` de una entrada ya registrada en image_library.

    Se llama desde visual_designer.py tras correr el Vision Extractor —
    reemplaza el respaldo débil (nombre de archivo subido, si lo hubo) por la
    descripción real del sujeto/escena que ve la IA. No-op si `label` viene vacío
    (evita pisar un buen respaldo con un dato vacío).
    """
    if not label:
        return
    index_path = _image_index_path()
    async with _lock_for(index_path):
        data = _read_index(index_path)
        for item in data:
            if item.get("asset_id") == asset_id:
                item["label"] = label
                _write_index(index_path, data)
                break
    logger.info("asset_library_image_label_updated", asset_id=asset_id)


# ── Video vision cache (analysis of an extracted frame, keyed by video asset_id) ─

def get_video_vision_cache(asset_id: str) -> dict[str, Any] | None:
    path = settings.video_library_dir / "_vision_cache" / f"{asset_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("asset_library_video_vision_cache_corrupt", asset_id=asset_id)
        return None


async def save_video_vision_cache(asset_id: str, vision_json: dict[str, Any]) -> None:
    cache_dir = settings.video_library_dir / "_vision_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{asset_id}.json").write_text(
        json.dumps(vision_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    index_path = _video_index_path()
    async with _lock_for(index_path):
        data = _read_index(index_path)
        for item in data:
            if item.get("asset_id") == asset_id:
                item["has_vision_cache"] = True
                _write_index(index_path, data)
                break
    logger.info("asset_library_video_vision_cache_saved", asset_id=asset_id)


# ── Lyrics cache (transcripción word-level, keyed by music asset_id) ─────────
# Mismo patrón que get_vision_cache/save_vision_cache — evita retranscribir
# (caro: varios minutos por canción, ver settings.whisper_*) una canción que
# ya se usó en un video anterior.

def get_lyrics_cache(asset_id: str) -> dict[str, Any] | None:
    path = settings.music_library_dir / "_lyrics_cache" / f"{asset_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("asset_library_lyrics_cache_corrupt", asset_id=asset_id)
        return None


async def save_lyrics_cache(asset_id: str, lyrics_json: dict[str, Any]) -> None:
    cache_dir = settings.music_library_dir / "_lyrics_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{asset_id}.json").write_text(
        json.dumps(lyrics_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    index_path = _music_index_path()
    async with _lock_for(index_path):
        data = _read_index(index_path)
        for item in data:
            if item.get("asset_id") == asset_id:
                item["has_lyrics_cache"] = True
                _write_index(index_path, data)
                break
    logger.info("asset_library_lyrics_cache_saved", asset_id=asset_id)


# ── Archived template configs ─────────────────────────────────────────────────

async def register_template_config(
    job_id: str,
    template_id: str,
    niche_id: str,
    config_json: dict[str, Any],
    image_asset_id: str | None = None,
    music_asset_id: str | None = None,
    video_asset_id: str | None = None,
) -> TemplateConfigEntry:
    dest_dir = settings.template_configs_dir / template_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    config_path = dest_dir / f"{job_id}.json"
    config_path.write_text(json.dumps(config_json, indent=2, ensure_ascii=False), encoding="utf-8")

    texts = config_json.get("texts")
    entry = TemplateConfigEntry(
        job_id=job_id,
        template_id=template_id,
        niche_id=niche_id,
        config_path=str(config_path.relative_to(settings.template_configs_dir)),
        image_asset_id=image_asset_id,
        music_asset_id=music_asset_id,
        video_asset_id=video_asset_id,
        created_at=_now_iso(),
        texts=texts if isinstance(texts, dict) else {},
    )
    await _append_entry(_template_configs_index_path(), entry.model_dump())
    logger.info("asset_library_template_config_registered", job_id=job_id, template_id=template_id)
    return entry


def list_template_configs(template_id: str | None = None) -> list[TemplateConfigEntry]:
    entries = [TemplateConfigEntry(**d) for d in _read_index(_template_configs_index_path())]
    if template_id:
        entries = [e for e in entries if e.template_id == template_id]
    return entries


def get_template_config(job_id: str) -> dict[str, Any]:
    """Return the full archived config.json content for *job_id*."""
    for entry_raw in _read_index(_template_configs_index_path()):
        if entry_raw.get("job_id") == job_id:
            path = settings.template_configs_dir / entry_raw["config_path"]
            return json.loads(path.read_text(encoding="utf-8"))
    raise AssetNotFoundError(f"No archived template config found for job_id '{job_id}'.")


# ── URL download ──────────────────────────────────────────────────────────────

async def download_url_to(url: str, dest_path: Path) -> None:
    """Stream-download *url* to *dest_path*. Raises AssetDownloadError on failure."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    timeout = httpx.Timeout(
        connect=10.0,
        read=settings.download_timeout_seconds,
        write=settings.download_timeout_seconds,
        pool=10.0,
    )
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                if response.status_code != 200:
                    raise AssetDownloadError(
                        f"Failed to download '{url}': HTTP {response.status_code}"
                    )
                with open(dest_path, "wb") as fh:
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        fh.write(chunk)
    except httpx.HTTPError as exc:
        raise AssetDownloadError(f"Network error downloading '{url}': {exc}") from exc

    logger.info("asset_library_url_downloaded", url=url, dest=str(dest_path))
