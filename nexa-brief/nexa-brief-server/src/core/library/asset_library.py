"""Asset Library — imágenes, música, videos y configs reutilizables entre jobs.

Se alimenta con lo que el pipeline encuentra solo (Stage 3,
`resource_fetcher.py`) y con lo que el usuario sube o referencia
(`ImageSource`/`MusicSource`/`VideoSource`), así cada asset usado una vez
queda disponible para los siguientes videos.

Persistencia 100% vía DataStore (`src/core/data.py`) — este módulo no sabe si
detrás hay JSON en `data/` o una base de datos:
    colecciones   image_assets / music_assets / video_assets / template_configs
    documentos    image_vision / video_vision / lyrics / template_config_files
    archivos      images / music / videos   (clave = "{categoría}/{nombre original}")

Los archivos conservan el nombre con el que se subieron (ver
`adapters/data/local_file_storage.py`); `asset_id` sigue siendo el
identificador estable que usa el resto del sistema.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import unquote, urlparse

import httpx
import structlog
from pydantic import BaseModel, Field, model_validator

from src.config.exceptions import AssetDownloadError, AssetNotFoundError
from src.config.settings import settings
from src.config.profile_layout import layout_for_settings
from src.core.data import collection, coordination, documents, files
from src.core.library.sound_library import SoundLibraryEntry
from src.core.library.resource_metadata import ResourceMetadata, ResourceOrigin, resource_metadata, belongs_to
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Entry models ──────────────────────────────────────────────────────────────

class ImageLibraryEntry(ResourceMetadata):
    media_type: Literal["image"] = "image"
    video_id: str | None = None
    production_id: str | None = None
    production_name: str = ""
    asset_id: str
    category: str
    relative_path: str                # clave en FileStorage "images" ({categoría}/{archivo})
    bundled_key: str | None = None  # validated content-addressed NodeMotion demo resource
    original_filename: str = ""      # nombre con el que se subió/descargó
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
    # Librería de recursos (F1): texto libre que el usuario escribe al subir o
    # editar; entra en la búsqueda junto con label/tags.
    description: str = ""


TranscriptionStatus = Literal["none", "pending", "running", "done", "failed"]


class MusicLibraryEntry(ResourceMetadata):
    media_type: Literal["music"] = "music"
    video_id: str | None = None
    production_id: str | None = None
    production_name: str = ""
    asset_id: str
    category: str
    relative_path: str                # clave en FileStorage "music" ({categoría}/{archivo})
    bundled_key: str | None = None  # validated content-addressed NodeMotion demo resource
    original_filename: str = ""
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
    # FASE DE PRUEBAS (ver docs/dedup-audio-por-hash.md): sha256 del archivo,
    # usado por find_music_by_hash para detectar la misma canción aunque llegue
    # con nombre de archivo distinto. Evaluar en producción si se mantiene.
    content_hash: str = ""
    # Librería de recursos (F1) — todos con default para leer los registros
    # viejos tal cual. `tags` es un string separado por comas, igual que en
    # ImageLibraryEntry (ver normalize_tags).
    description: str = ""
    tags: str = ""
    language: str = ""                # ISO ("es", "en"); vacío = auto-detectar
    transcription_status: TranscriptionStatus = "none"
    transcription_error: str = ""

    @model_validator(mode="after")
    def _infer_transcription_status(self) -> MusicLibraryEntry:
        # Registros anteriores a F1 tienen la letra cacheada pero no el campo
        # de estado: si hay caché, la transcripción está hecha.
        if self.has_lyrics_cache and self.transcription_status == "none":
            self.transcription_status = "done"
        return self


class VideoLibraryEntry(ResourceMetadata):
    media_type: Literal["video"] = "video"
    """Video de fondo (ej. motion-backdrop) — solo LIBRARY/URL/UPLOAD, no hay
    proveedor de stock de video integrado (a diferencia de imagen/música)."""
    video_id: str | None = None
    production_id: str | None = None
    production_name: str = ""
    asset_id: str
    category: str
    relative_path: str                # clave en FileStorage "videos" ({categoría}/{archivo})
    bundled_key: str | None = None  # validated content-addressed NodeMotion demo resource
    original_filename: str = ""
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
    description: str = ""
    tags: str = ""


class TemplateConfigEntry(BaseModel):
    job_id: str
    template_id: str
    niche_id: str
    config_path: str                  # clave en DocumentStore "template_config_files"
    image_asset_id: str | None = None
    music_asset_id: str | None = None
    video_asset_id: str | None = None
    created_at: str = ""
    texts: dict[str, str] = Field(default_factory=dict)


# ── Nombres lógicos en el DataStore ──────────────────────────────────────────

_KINDS: dict[str, tuple[str, str]] = {
    # kind → (colección de metadata, FileStorage de archivos)
    "image": ("image_assets", "images"),
    "music": ("music_assets", "music"),
    "video": ("video_assets", "videos"),
    "sound": ("sound_assets", "sounds"),
}


def _records(kind: str):
    return collection(_KINDS[kind][0])


def _storage(kind: str):
    return files(_KINDS[kind][1])


def hash_file(path: Path) -> str:
    """Sha256 del contenido de *path*, en streaming (no carga todo a memoria).

    FASE DE PRUEBAS: soporta el dedup de música por contenido (find_music_by_hash),
    para detectar la misma canción subida/descargada con nombres de archivo
    distintos — ver docs/dedup-audio-por-hash.md sobre si se mantiene en producción."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def filename_from_url(url: str) -> str | None:
    """Último segmento del path de una URL, si parece un archivo ("foto.jpg")."""
    name = unquote(Path(urlparse(url).path).name)
    return name if Path(name).suffix else None


def _store_file(kind: str, path: Path, category: str, filename: str | None, fallback_stem: str) -> tuple[str, str, str]:
    """Guarda el archivo con su nombre original. Devuelve (asset_id, clave, nombre original)."""
    asset_id = uuid.uuid4().hex[:8]
    if filename:
        original = Path(filename).name
        if not Path(original).suffix:
            original += path.suffix
    else:
        original = f"{fallback_stem or asset_id}{path.suffix}"
    storage = _storage(kind)
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    key = (storage.save_asset(path, asset_id=asset_id, filename=original)
           if layout_for_settings(settings).schema_version >= 3 and hasattr(storage, "save_asset") else
           storage.save(path, folder=category, filename=original))
    return asset_id, key, original


def _find(kind: str, asset_id: str) -> dict[str, Any]:
    raw = _records(kind).get(asset_id)
    if raw is None:
        raise AssetNotFoundError(f"{kind.capitalize()} asset_id '{asset_id}' not found in the local library.")
    return raw


# ── Images ────────────────────────────────────────────────────────────────────

async def register_image(
    path: Path,
    *,
    category: str,
    source: str,
    provider: str = "",
    original_url: str | None = None,
    job_id: str = "",
    filename: str | None = None,
    **meta: Any,
) -> ImageLibraryEntry:
    """Archive an image (already downloaded/provided at *path*) into the library.

    *path* is copied, not moved — the caller keeps using its own copy
    (e.g. the job's output_dir/bg.jpg) untouched. *filename* es el nombre
    original (subida o URL); se conserva en el archivo guardado.
    """
    fallback = meta.get("label") or (f"{provider}-{meta['image_id']}" if meta.get("image_id") else "")
    asset_id, key, original = _store_file("image", path, category, filename, fallback)
    entry = ImageLibraryEntry(
        **resource_metadata(category, meta.get("template_id", "")),
        asset_id=asset_id,
        category=category,
        relative_path=key,
        original_filename=original,
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
        tags=normalize_tags(meta.get("tags")),
        has_vision_cache=False,
        description=meta.get("description", "") or "",
    )
    await _records("image").insert(entry.model_dump())
    logger.info("asset_library_image_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_image_entry(asset_id: str) -> ImageLibraryEntry:
    return get_entry("image", asset_id)


def list_images(category: str | None = None) -> list[ImageLibraryEntry]:
    return [ImageLibraryEntry(**d) for d in _records("image").list({"category": category} if category else None)]


def resolve_image_path(asset_id: str) -> Path:
    return resolve_asset_path("image", asset_id)


# ── Music ─────────────────────────────────────────────────────────────────────

async def register_music(
    path: Path,
    *,
    category: str,
    source: str,
    provider: str = "",
    original_url: str | None = None,
    job_id: str = "",
    content_hash: str | None = None,
    filename: str | None = None,
    **meta: Any,
) -> MusicLibraryEntry:
    track, artist = meta.get("track_name", ""), meta.get("artist", "")
    fallback = f"{track} - {artist}" if track and artist else track
    asset_id, key, original = _store_file("music", path, category, filename, fallback)
    entry = MusicLibraryEntry(
        **resource_metadata(category, meta.get("template_id", "")),
        asset_id=asset_id,
        category=category,
        relative_path=key,
        original_filename=original,
        source=source,
        provider=provider,
        original_url=original_url,
        track_name=meta.get("track_name", ""),
        artist=meta.get("artist", ""),
        genre=meta.get("genre", ""),
        duration_seconds=meta.get("duration_seconds", 0),
        license_note=meta.get("license_note", "unknown"),
        # FASE DE PRUEBAS: si el caller ya calculó el hash (para chequear dedup
        # antes de registrar), lo reusa en vez de leer el archivo dos veces.
        content_hash=content_hash or hash_file(path),
        added_at=_now_iso(),
        added_by_job_id=job_id,
        usage_count=1,
        last_used_at=_now_iso(),
        description=meta.get("description", "") or "",
        tags=normalize_tags(meta.get("tags")),
        language=meta.get("language", "") or "",
    )
    await _records("music").insert(entry.model_dump())
    logger.info("asset_library_music_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_music_entry(asset_id: str) -> MusicLibraryEntry:
    return get_entry("music", asset_id)


def list_music(category: str | None = None) -> list[MusicLibraryEntry]:
    return [MusicLibraryEntry(**d) for d in _records("music").list({"category": category} if category else None)]


def resolve_music_path(asset_id: str) -> Path:
    return resolve_asset_path("music", asset_id)


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


def find_music_by_hash(content_hash: str) -> MusicLibraryEntry | None:
    """Busca una canción ya archivada por hash de contenido (sha256) — dedup
    exacto de bytes, sin depender del nombre del archivo.

    FASE DE PRUEBAS (ver docs/dedup-audio-por-hash.md): complementa a
    find_music_by_name, que sigue existiendo sin cambios. find_music_by_name
    falla cuando la misma canción llega con nombres de archivo distintos entre
    descargas (caso frecuente); esto la detecta igual, comparando bytes. Evaluar
    en producción si conviene mantener ambos mecanismos o quedarse solo con este."""
    if not content_hash:
        return None
    raw = _records("music").first({"content_hash": content_hash})
    return MusicLibraryEntry(**raw) if raw else None


# ── Video ─────────────────────────────────────────────────────────────────────

async def register_video(
    path: Path,
    *,
    category: str,
    source: str,
    provider: str = "",
    original_url: str | None = None,
    job_id: str = "",
    filename: str | None = None,
    **meta: Any,
) -> VideoLibraryEntry:
    asset_id, key, original = _store_file("video", path, category, filename, meta.get("label", ""))
    entry = VideoLibraryEntry(
        **resource_metadata(category, meta.get("template_id", "")),
        asset_id=asset_id,
        category=category,
        relative_path=key,
        original_filename=original,
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
        description=meta.get("description", "") or "",
        tags=normalize_tags(meta.get("tags")),
    )
    await _records("video").insert(entry.model_dump())
    logger.info("asset_library_video_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_video_entry(asset_id: str) -> VideoLibraryEntry:
    return get_entry("video", asset_id)


class DuplicateFilenameError(ValueError):
    """Ya existe un archivo distinto con el mismo nombre en esta categoría."""


async def register_uploaded_visual(
    kind: Literal["image", "video"], path: Path, *, category: str, template_id: str,
    filename: str, label: str, description: str, tags: str,
) -> tuple[ImageLibraryEntry | VideoLibraryEntry, bool]:
    """Registra una carga visual sin duplicados dentro de su categoría.

    La coordinación pertenece al puerto de datos: cubre la consulta y la
    inserción incluso con varios workers, sin depender del almacenamiento JSON.
    """
    safe_name = Path(filename).name
    normalized = unicodedata.normalize("NFC", safe_name).casefold()
    async with coordination(f"library-upload-{kind}"):
        model = ImageLibraryEntry if kind == "image" else VideoLibraryEntry
        matches = [model(**raw) for raw in _records(kind).list()
                   if raw.get("original_filename")
                   and unicodedata.normalize("NFC", Path(raw["original_filename"]).name).casefold() == normalized]
        matches = [entry for entry in matches if belongs_to(entry, category)]
        if matches:
            digest = await asyncio.to_thread(hash_file, path)
            for entry in matches:
                try:
                    old_path = resolve_asset_path(kind, entry.asset_id)
                except (AssetNotFoundError, FileNotFoundError, ValueError):
                    continue
                if old_path.is_file() and await asyncio.to_thread(hash_file, old_path) == digest:
                    existing = await attach_resource_origin(kind, entry.asset_id, category, template_id)
                    return existing, False
            raise DuplicateFilenameError(f"Ya existe un recurso con el nombre '{safe_name}' en esta categoría.")
        probe = await probe_media(path)
        shared = dict(category=category, source="upload", provider="user_upload", filename=safe_name,
                      template_id=template_id, label=label, description=description, tags=tags,
                      width=int(probe.get("width", 0)), height=int(probe.get("height", 0)))
        if kind == "image":
            width, height = shared["width"], shared["height"]
            ratio = width / height if width and height else 0
            orientation = "landscape" if ratio > 1.1 else "portrait" if ratio and ratio < 0.9 else "squarish" if ratio else None
            entry = await register_image(path, **shared, orientation=orientation)
        else:
            entry = await register_video(path, **shared, duration_seconds=float(probe.get("duration_seconds", 0)))
        return entry, True


def list_videos(category: str | None = None) -> list[VideoLibraryEntry]:
    return [VideoLibraryEntry(**d) for d in _records("video").list({"category": category} if category else None)]


def resolve_video_path(asset_id: str) -> Path:
    return resolve_asset_path("video", asset_id)


# ── Usage tracking (shared by images, music and video) ────────────────────────

async def touch_usage(asset_id: str, kind: str) -> None:
    """Increment usage_count / bump last_used_at for a library asset.

    kind: "image" | "music" | "video"
    """
    records = _records(kind)
    if records.get(asset_id) is None and _production_record(kind, asset_id) is not None:
        records = collection("content_resources")
    updated = await records.increment(asset_id, "usage_count", patch={"last_used_at": _now_iso()})
    if updated is None:
        raise AssetNotFoundError(f"{kind} asset_id '{asset_id}' not found — cannot record usage.")


# ── Cachés por asset (visión de imagen/video, transcripción de letras) ────────
# Evitan repetir llamadas caras (Vision Extractor, Whisper: varios minutos por
# canción) para un asset que ya se usó en un video anterior.

def _get_cache(store: str, asset_id: str) -> dict[str, Any] | None:
    return documents(store).get(asset_id)


async def _save_cache(store: str, kind: str, flag: str, asset_id: str, body: dict[str, Any]) -> None:
    documents(store).put(asset_id, body)
    records = _records(kind)
    if records.get(asset_id) is None and _production_record(kind, asset_id) is not None:
        records = collection("content_resources")
    await records.update(asset_id, {flag: True})
    logger.info("asset_library_cache_saved", store=store, asset_id=asset_id)


def get_vision_cache(asset_id: str) -> dict[str, Any] | None:
    return _get_cache("image_vision", asset_id)


async def save_vision_cache(asset_id: str, vision_json: dict[str, Any]) -> None:
    await _save_cache("image_vision", "image", "has_vision_cache", asset_id, vision_json)


def get_video_vision_cache(asset_id: str) -> dict[str, Any] | None:
    return _get_cache("video_vision", asset_id)


async def save_video_vision_cache(asset_id: str, vision_json: dict[str, Any]) -> None:
    await _save_cache("video_vision", "video", "has_vision_cache", asset_id, vision_json)


def get_lyrics_cache(asset_id: str) -> dict[str, Any] | None:
    return _get_cache("lyrics", asset_id)


async def save_lyrics_cache(asset_id: str, lyrics_json: dict[str, Any]) -> None:
    await _save_cache("lyrics", "music", "has_lyrics_cache", asset_id, lyrics_json)


async def update_image_label(asset_id: str, label: str) -> None:
    """Patchea el campo `label` de una entrada ya registrada en image_library.

    Se llama desde visual_designer.py tras correr el Vision Extractor —
    reemplaza el respaldo débil (nombre de archivo subido, si lo hubo) por la
    descripción real del sujeto/escena que ve la IA. No-op si `label` viene vacío
    (evita pisar un buen respaldo con un dato vacío).
    """
    if not label:
        return
    records = _records("image")
    if records.get(asset_id) is None and _production_record("image", asset_id) is not None:
        records = collection("content_resources")
    await records.update(asset_id, {"label": label})
    logger.info("asset_library_image_label_updated", asset_id=asset_id)


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
    documents("template_config_files").put(job_id, config_json)

    texts = config_json.get("texts")
    entry = TemplateConfigEntry(
        job_id=job_id,
        template_id=template_id,
        niche_id=niche_id,
        config_path=job_id,
        image_asset_id=image_asset_id,
        music_asset_id=music_asset_id,
        video_asset_id=video_asset_id,
        created_at=_now_iso(),
        texts=texts if isinstance(texts, dict) else {},
    )
    await collection("template_configs").upsert(entry.model_dump(), match=("job_id",))
    for kind, ident in (("image", image_asset_id), ("music", music_asset_id), ("video", video_asset_id)):
        if ident:
            await attach_resource_origin(kind, ident, template_id=template_id)
    logger.info("asset_library_template_config_registered", job_id=job_id, template_id=template_id)
    return entry


def list_template_configs(template_id: str | None = None) -> list[TemplateConfigEntry]:
    where = {"template_id": template_id} if template_id else None
    return [TemplateConfigEntry(**d) for d in collection("template_configs").list(where)]


def get_template_config(job_id: str) -> dict[str, Any]:
    """Return the full archived config.json content for *job_id*."""
    entry_raw = collection("template_configs").get(job_id)
    config = documents("template_config_files").get(entry_raw["config_path"]) if entry_raw else None
    if config is not None:
        return config
    raise AssetNotFoundError(f"No archived template config found for job_id '{job_id}'.")


# ── Librería de recursos (F1): búsqueda, edición, borrado ────────────────────
# Lo que usa la pantalla "Recursos" y el buscador del Estudio
# (docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.2). Trabaja
# sobre las mismas colecciones que alimenta el pipeline: un asset subido a mano
# y uno que trajo resource_fetcher son indistinguibles para el resto del sistema.

# Nombre en la API (plural, como las rutas /library/images…) → kind interno.
API_KINDS: dict[str, str] = {"images": "image", "music": "music", "videos": "video", "sounds": "sound"}
_API_NAME = {kind: api for api, kind in API_KINDS.items()}

LibraryEntry = ImageLibraryEntry | MusicLibraryEntry | VideoLibraryEntry | SoundLibraryEntry

_MODELS: dict[str, type[BaseModel]] = {
    "image": ImageLibraryEntry,
    "music": MusicLibraryEntry,
    "video": VideoLibraryEntry,
    "sound": SoundLibraryEntry,
}

# Campos que el usuario puede editar por PATCH. El resto (relative_path, hash,
# usos, cachés…) lo mantiene el sistema y editarlo a mano rompería referencias.
EDITABLE_FIELDS: dict[str, frozenset[str]] = {
    "image": frozenset({"display_name", "label", "description", "tags", "category", "photographer", "license_note"}),
    "music": frozenset({
        "display_name", "track_name", "artist", "genre", "description", "tags", "language", "category", "license_note",
    }),
    "video": frozenset({"display_name", "label", "description", "tags", "category", "license_note"}),
    "sound": frozenset({"display_name", "title", "description", "tags", "category", "recommended_uses", "approval_status"}),
}

_SEARCH_FIELDS: dict[str, tuple[str, ...]] = {
    "image": ("label", "tags", "original_filename", "description", "photographer", "category"),
    "music": ("track_name", "artist", "genre", "tags", "original_filename", "description", "category"),
    "video": ("label", "tags", "original_filename", "description", "category"),
    "sound": ("title", "description", "recommended_uses", "tags", "provider", "original_filename", "category"),
}

# Cachés por asset que hay que limpiar al borrarlo (si no, quedan huérfanos y
# un asset nuevo nunca los reusa: el asset_id es un UUID que no se repite).
_CACHE_STORES: dict[str, tuple[str, ...]] = {
    "image": ("image_vision",),
    "music": ("lyrics",),
    "video": ("video_vision",),
    "sound": (),
}


def api_kind(kind: str) -> str:
    """kind interno ("image") → nombre de la API ("images")."""
    return _API_NAME[kind]


def normalize_tags(value: str | list[str] | tuple[str, ...] | None) -> str:
    """Tags como string separado por comas — el formato que ya usa
    ImageLibraryEntry.tags (lo llenan los proveedores de stock). Acepta lista o
    string, recorta espacios y quita repetidos sin cambiar el orden."""
    if not value:
        return ""
    parts = value.split(",") if isinstance(value, str) else [str(v) for v in value]
    seen: dict[str, str] = {}
    for raw in parts:
        tag = " ".join(raw.split())
        if tag and tag.casefold() not in seen:
            seen[tag.casefold()] = tag
    return ", ".join(seen.values())


def tag_list(tags: str) -> list[str]:
    return [t for t in (part.strip() for part in tags.split(",")) if t]


def _fold(text: str) -> str:
    """Minúsculas y sin acentos — "Canción" y "cancion" tienen que matchear."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()


class LinkedProductionAssetError(ValueError):
    """El recurso pertenece a una producción y no se puede editar o borrar aquí."""


def _production_record(kind: str, asset_id: str) -> dict | None:
    if layout_for_settings(settings).schema_version < 2:
        return None
    record = collection("content_resources").get(asset_id)
    return record if record and record.get("kind") == kind else None


def _production_metadata(record: dict, video: dict | None = None) -> dict:
    video = video or {}
    category = str(record.get("category_id") or video.get("category_id") or video.get("category") or "")
    parts = Path(record["storage_key"]).parts
    if not category and len(parts) > 2 and parts[0] in {"productions", "sandbox"}:
        category = parts[1]
    metadata = resource_metadata(category)
    for field in ("category_id", "category_name", "template_id", "template_name", "resource_origins"):
        if record.get(field):
            metadata[field] = record[field]
    return metadata


def _production_entry(kind: str, record: dict, *, video: dict | None = None, details: dict | None = None) -> LibraryEntry:
    video_id = record["video_id"]
    if video is None:
        video = collection("content_videos").get(video_id) or {}
    if details is None:
        details = documents("content_video_details").get(video_id) or {}
    title = str(details.get("title") or video_id)
    filename = Path(record["storage_key"]).name
    data = {**_production_metadata(record, video),
            "asset_id": record["asset_id"], "relative_path": record["storage_key"],
            "category": "production", "source": "production", "provider": "production",
            "original_filename": filename, "video_id": video_id,
            "production_id": video.get("production_id"), "production_name": title,
            "description": f"{title} · {video_id}"}
    data[{"image": "label", "video": "label", "music": "track_name", "sound": "title"}[kind]] = filename
    # Solo metadata auxiliar, nunca rutas, identidad ni titularidad de la producción.
    for field in ("usage_count", "last_used_at", "has_vision_cache", "has_lyrics_cache",
                  "transcription_status", "transcription_error", "language", "label", "approval_status",
                  "category_id", "category_name", "template_id", "template_name", "resource_origins"):
        if field in record:
            data[field] = record[field]
    metadata = record.get("library_metadata") or {}
    data.update({key: value for key, value in metadata.items() if key in EDITABLE_FIELDS[kind]})
    return _MODELS[kind](**data)  # type: ignore[return-value]


def metadata_gaps(kind: str, entry) -> list[str]:
    """Datos que faltan para publicar un recurso. Vacío = listo."""
    title = entry.track_name if kind == "music" else (getattr(entry, "label", "") or getattr(entry, "display_name", ""))
    gaps: list[str] = []
    if not str(title or "").strip():
        gaps.append("título")
    if not str(entry.description or "").strip():
        gaps.append("descripción")
    if not str(entry.tags or "").strip():
        gaps.append("etiquetas")
    if not str(entry.category or "").strip():
        gaps.append("categoría")
    if str(getattr(entry, "license_note", "") or "").strip().lower() in ("", "unknown"):
        gaps.append("licencia")
    return gaps


def get_entry(kind: str, asset_id: str) -> LibraryEntry:
    raw = _records(kind).get(asset_id)
    if raw is not None:
        return _MODELS[kind](**raw)  # type: ignore[return-value]
    record = _production_record(kind, asset_id)
    if record is None:
        raise AssetNotFoundError(f"{kind.capitalize()} asset_id '{asset_id}' not found in the local library.")
    return _production_entry(kind, record)


def resolve_asset_entry_path(kind: str, entry: LibraryEntry, *, from_collection: bool) -> Path:
    """Resolve a validated entry using its known DataStore provenance.

    ``from_collection=True`` is for entries obtained from the corresponding
    ``list_images/list_music/list_videos`` collection snapshot. A production
    registry entry must use ``False`` so it goes through the content registry.
    Storage and bundled-resource path validation are identical to ID lookup.
    This helper does not cache entries or promise that a snapshot stays current.
    """
    model = _MODELS.get(kind)
    if model is None or not isinstance(entry, model) or type(from_collection) is not bool:
        raise ValueError("Invalid library entry or provenance")
    bundled_key = getattr(entry, "bundled_key", None)
    if bundled_key is not None:
        if entry.source != "template" or kind not in {"music", "image", "video"}:
            raise ValueError("Invalid bundled library reference")
        from src.core.nodemotion.shared.bundled import resolve_bundled_key
        return resolve_bundled_key(bundled_key)
    if not from_collection:
        if entry.source != "production":
            raise ValueError("Invalid production resource provenance")
        from src.core.content_registry import resolve_resource
        try:
            path = resolve_resource(entry.asset_id)
        except (ValueError, KeyError) as exc:
            raise AssetNotFoundError("Ruta de recurso inválida") from exc
        if path is None:
            raise AssetNotFoundError("Recurso no encontrado")
        return path
    return _storage(kind).local_path(entry.relative_path)


def resolve_asset_path(kind: str, asset_id: str) -> Path:
    """Ruta local validada; las referencias de producción nunca se copian."""
    entry = get_entry(kind, asset_id)
    from_collection = True
    if entry.source == "production" and getattr(entry, "bundled_key", None) is None:
        from_collection = _records(kind).get(asset_id) is not None
    return resolve_asset_entry_path(kind, entry, from_collection=from_collection)


def search_assets(kind: str, q: str | None = None, category: str | None = None) -> list[LibraryEntry]:
    """Lista los assets de *kind* filtrando por categoría (igualdad exacta) y por
    texto libre: cada palabra de *q* tiene que aparecer en alguno de los campos
    de _SEARCH_FIELDS (case/acentos-insensible). Sin *q* devuelve todo.

    El filtro corre en Python sobre la colección completa: la librería es de
    cientos de assets, no millones, y el contrato del DataStore solo garantiza
    filtros por igualdad (ver core/ports/data_port.py)."""
    model = _MODELS[kind]
    entries = [model(**d) for d in _records(kind).list()]
    if layout_for_settings(settings).schema_version >= 2:
        existing = {entry.asset_id for entry in entries}
        # One metadata scan per request; never reread the whole resource section
        # for every production asset. Filter ownership before loading details.
        videos = {row["video_id"]: row for row in collection("content_videos").list()}
        detail_cache: dict[str, dict] = {}
        for record in collection("content_resources").list(where={"kind": kind}):
            if record.get("asset_id") in existing:
                continue
            video_id = record["video_id"]
            video = videos.get(video_id, {})
            if category and category != "production" and not belongs_to(
                ResourceMetadata(**_production_metadata(record, video)), category
            ):
                continue
            if video_id not in detail_cache:
                detail_cache[video_id] = documents("content_video_details").get(video_id) or {}
            entries.append(_production_entry(kind, record, video=video, details=detail_cache[video_id]))
    if category:
        entries = [entry for entry in entries if belongs_to(entry, category)]
    terms = _fold(q).split() if q else []
    if not terms:
        return entries  # type: ignore[return-value]
    fields = (*_SEARCH_FIELDS[kind], "display_name", "video_id", "production_id", "production_name")

    def matches(entry: BaseModel) -> bool:
        haystack = " ".join(_fold(str(getattr(entry, f, "") or "")) for f in fields)
        return all(term in haystack for term in terms)

    return [e for e in entries if matches(e)]  # type: ignore[misc]


async def attach_resource_origin(kind: str, asset_id: str, category: str = "", template_id: str = "") -> LibraryEntry:
    """Add provenance with a conditional merge; concurrent uploads retain both origins."""
    context = resource_metadata(category, template_id)
    if not context:
        return get_entry(kind, asset_id)
    origin = ResourceOrigin(**{k: context[k] for k in ("category_id", "category_name", "template_id", "template_name")})
    for _ in range(5):
        current = get_entry(kind, asset_id)
        records = _records(kind)
        raw = records.get(asset_id)
        if raw is None:
            records = collection("content_resources")
            raw = records.get(asset_id)
        if raw is None:
            raise AssetNotFoundError(f"Asset {asset_id} no longer exists")
        origins = list(current.resource_origins)
        if current.category_id and not origins:
            origins.append(ResourceOrigin(**current.model_dump(include={"category_id", "category_name", "template_id", "template_name"})))
        if origin in origins and current.category_id:
            return current
        if origin not in origins:
            origins.append(origin)
        patch = {"resource_origins": [o.model_dump() for o in origins], "media_type": kind}
        if not current.category_id:
            patch.update({k: context[k] for k in ("category_id", "category_name", "template_id", "template_name")})
        updated = await records.update(asset_id, patch, only_if={"resource_origins": raw.get("resource_origins")})
        if updated is not None:
            await publish_asset_changed(kind, asset_id, action="updated")
            return get_entry(kind, asset_id)
    raise RuntimeError("Concurrent changes to resource provenance; retry the request")


def page_music_groups(*, page: int = 1, page_size: int = 12,
                      q: str | None = None, category: str | None = None) -> tuple[list[list[MusicLibraryEntry]], int]:
    """Agrupa versiones por título y artista antes de paginar, sin fusionar IDs.

    El orden se deriva del registro más reciente de cada grupo y es estable;
    cada versión conserva su identidad, letra y metadatos. Un título vacío no
    identifica una canción, por eso sus registros no se agrupan entre sí.
    """
    entries = search_assets("music", q=q, category=category)
    entries.sort(key=lambda entry: (entry.added_at, entry.asset_id), reverse=True)
    groups: dict[tuple[str, str], list[MusicLibraryEntry]] = {}
    for entry in entries:
        title = " ".join(_fold(entry.track_name).split())
        artist = " ".join(_fold(entry.artist).split())
        key = (title, artist) if title else ("", entry.asset_id)
        groups.setdefault(key, []).append(entry)
    values = list(groups.values())
    start = (page - 1) * page_size
    return values[start:start + page_size], len(values)


def page_assets(kind: str, *, page: int = 1, page_size: int = 12,
                q: str | None = None, category: str | None = None) -> tuple[list[LibraryEntry], int]:
    """Página estable sobre los puertos del DataStore, sin acceder al almacenamiento concreto."""
    entries = search_assets(kind, q=q, category=category)
    entries.sort(key=lambda entry: (entry.added_at, entry.asset_id), reverse=True)
    start = (page - 1) * page_size
    return entries[start:start + page_size], len(entries)



async def register_bundled_resource(kind: str, template_id: str, bundled_key: str,
                                    logical_path: str, *, category: str = "template_originals") -> LibraryEntry:
    """Register a shared, verified demo resource without copying its bytes."""
    if kind not in {"music", "image", "video"}:
        raise ValueError("Unsupported bundled resource kind")
    from src.core.nodemotion.shared.bundled import demo_aliases, resolve_bundled_key
    if demo_aliases(template_id).get(logical_path) != bundled_key:
        raise ValueError("Resource is not declared by this demo")
    path = resolve_bundled_key(bundled_key)
    async with coordination(f"library-bundled-{kind}-{bundled_key[:64]}"):
        for raw in _records(kind).list():
            if raw.get("source") == "template" and raw.get("bundled_key") == bundled_key:
                return await attach_resource_origin(kind, raw["asset_id"], category, template_id)
        filename = Path(logical_path).name
        ident = uuid.uuid4().hex[:8]
        values: dict[str, Any] = {
            **resource_metadata(category, template_id), "asset_id": ident,
            "category": category, "relative_path": f"_bundled/{bundled_key}",
            "bundled_key": bundled_key, "original_filename": filename,
            "source": "template", "provider": "template", "added_at": _now_iso(),
            "last_used_at": _now_iso(), "usage_count": 1,
        }
        if kind == "music":
            stem = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
            values["track_name"] = "" if stem.lower() in {"song", "audio", "music", "track", "cancion", "musica"} else stem
            values["content_hash"] = bundled_key[:64]
        else:
            values["label"] = f"{template_id} (fondo)"
        entry = _MODELS[kind](**values)
        await _records(kind).insert(entry.model_dump())
        logger.info("asset_library_bundled_registered", kind=kind, asset_id=ident, path=str(path))
        return entry

async def update_asset_metadata(kind: str, asset_id: str, patch: dict[str, Any]) -> LibraryEntry:
    """Aplica una edición del usuario. Ignora campos no editables (ver
    EDITABLE_FIELDS) en vez de fallar, así el front puede mandar el objeto
    entero. Cambiar la categoría mueve también el archivo a la carpeta nueva,
    para que la clave siga siendo "{categoría}/{archivo}"."""
    current = get_entry(kind, asset_id)
    changes = {k: v for k, v in patch.items() if k in EDITABLE_FIELDS[kind] and v is not None}
    if "tags" in changes:
        changes["tags"] = normalize_tags(changes["tags"])
    if "category" in changes:
        changes["category"] = str(changes["category"]).strip() or current.category
    if current.source == "production" and _records(kind).get(asset_id) is None:
        record = _production_record(kind, asset_id)
        metadata = {**((record or {}).get("library_metadata") or {}), **changes}
        patch_record: dict[str, Any] = {"library_metadata": metadata}
        if "approval_status" in changes:
            patch_record["approval_status"] = changes["approval_status"]
        updated = await collection("content_resources").update(asset_id, patch_record)
        if updated is None:
            raise AssetNotFoundError("Recurso no encontrado")
        return _production_entry(kind, updated)
    if "category" in changes:
        new_category = str(changes["category"]).strip()
        if not new_category:
            changes.pop("category")
        elif new_category != current.category and not getattr(current, "bundled_key", None):
            storage = _storage(kind)
            old_key = current.relative_path
            old_path = storage.local_path(old_key)
            from src.config.profile_layout import layout_for_settings
            from src.config.settings import settings
            if old_path.exists() and layout_for_settings(settings).schema_version < 3:
                changes["relative_path"] = storage.save(
                    old_path, folder=new_category, filename=old_path.name
                )
                storage.delete(old_key)
            changes["category"] = new_category
        elif new_category != current.category:
            changes["category"] = new_category
    if not changes:
        return current
    updated = await _records(kind).update(asset_id, changes)
    if updated is None:
        raise AssetNotFoundError(f"{kind.capitalize()} asset_id '{asset_id}' not found in the local library.")
    logger.info("asset_library_metadata_updated", kind=kind, asset_id=asset_id, fields=sorted(changes))
    return _MODELS[kind](**updated)  # type: ignore[return-value]


async def delete_asset(kind: str, asset_id: str) -> LibraryEntry:
    """Borra archivo + registro + cachés (visión/letra) del asset. Los jobs ya
    grabados no se ven afectados: cada job trabaja con su propia copia en
    output/. Los config.json archivados que lo referencian quedan apuntando a
    un id inexistente, igual que cualquier referencia a un asset borrado."""
    entry = get_entry(kind, asset_id)
    if entry.source == "production" and _records(kind).get(asset_id) is None:
        raise LinkedProductionAssetError("El recurso pertenece a una producción")
    storage = _storage(kind)
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    shared = False
    if layout_for_settings(settings).schema_version >= 3 and not getattr(entry, "bundled_key", None):
        target = storage.local_path(entry.relative_path)
        for other in _records(kind).list():
            if other.get("asset_id") == asset_id or not other.get("relative_path") or other.get("bundled_key"):
                continue
            if storage.local_path(other["relative_path"]) == target:
                shared = True
                break
    if not shared and not getattr(entry, "bundled_key", None):
        storage.delete(entry.relative_path)
    for store in _CACHE_STORES[kind]:
        documents(store).delete(asset_id)
    await _records(kind).delete(asset_id)
    logger.info("asset_library_asset_deleted", kind=kind, asset_id=asset_id)
    return entry


async def set_transcription_status(
    asset_id: str, status: TranscriptionStatus, error: str = "", **extra: Any
) -> MusicLibraryEntry | None:
    """Actualiza el estado de transcripción de una canción. None si ya no existe
    (la borraron mientras se transcribía) — el caller lo trata como no-op."""
    records = _records("music")
    linked = records.get(asset_id) is None and _production_record("music", asset_id) is not None
    if linked:
        records = collection("content_resources")
    updated = await records.update(
        asset_id, {"transcription_status": status, "transcription_error": error, **extra}
    )
    if updated is None:
        return None
    return _production_entry("music", updated) if linked else MusicLibraryEntry(**updated)


async def publish_asset_changed(
    kind: str, asset_id: str, *, action: str, transcription_status: str | None = None
) -> None:
    """Evento en tiempo real para que la pantalla Recursos se refresque sin
    polling (mismo patrón que queue_repository._publish_event). *kind* interno;
    en el evento viaja el nombre de la API ("images" | "music" | "videos")."""
    await get_event_bus().publish(
        RealtimeEvent(
            type="library_asset_changed",
            data={
                "kind": api_kind(kind),
                "asset_id": asset_id,
                "action": action,
                "transcription_status": transcription_status,
            },
        )
    )


async def probe_media(path: Path) -> dict[str, float | int]:
    """Duración/ancho/alto de un audio, video o imagen con ffprobe (ya es
    dependencia del sistema, ver job_tracker._get_video_duration_seconds).

    Tolerante: es metadata informativa para la librería, así que si ffprobe no
    está o no entiende el archivo devuelve lo que pudo (o {}), nunca falla la
    subida por esto."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height:format=duration",
            "-of", "json",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            return {}
        info = json.loads(stdout.decode() or "{}")
    except Exception:
        logger.warning("asset_library_ffprobe_failed", path=str(path))
        return {}

    result: dict[str, float | int] = {}
    streams = info.get("streams") or []
    if streams:
        result["width"] = int(streams[0].get("width") or 0)
        result["height"] = int(streams[0].get("height") or 0)
    duration = (info.get("format") or {}).get("duration")
    try:
        # Las imágenes fijas reportan "N/A" o nada: no es una duración.
        if duration not in (None, "N/A"):
            result["duration_seconds"] = round(float(duration), 2)
    except ValueError:
        pass
    return result


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
