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

import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import httpx
import structlog
from pydantic import BaseModel, Field

from src.config.exceptions import AssetDownloadError, AssetNotFoundError
from src.config.settings import settings
from src.core.data import collection, documents, files

logger = structlog.get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Entry models ──────────────────────────────────────────────────────────────

class ImageLibraryEntry(BaseModel):
    asset_id: str
    category: str
    relative_path: str                # clave en FileStorage "images" ({categoría}/{archivo})
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


class MusicLibraryEntry(BaseModel):
    asset_id: str
    category: str
    relative_path: str                # clave en FileStorage "music" ({categoría}/{archivo})
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


class VideoLibraryEntry(BaseModel):
    """Video de fondo (ej. motion-backdrop) — solo LIBRARY/URL/UPLOAD, no hay
    proveedor de stock de video integrado (a diferencia de imagen/música)."""
    asset_id: str
    category: str
    relative_path: str                # clave en FileStorage "videos" ({categoría}/{archivo})
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
    key = _storage(kind).save(path, folder=category, filename=original)
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
        tags=meta.get("tags", "") or "",
        has_vision_cache=False,
    )
    await _records("image").insert(entry.model_dump())
    logger.info("asset_library_image_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_image_entry(asset_id: str) -> ImageLibraryEntry:
    return ImageLibraryEntry(**_find("image", asset_id))


def list_images(category: str | None = None) -> list[ImageLibraryEntry]:
    return [ImageLibraryEntry(**d) for d in _records("image").list({"category": category} if category else None)]


def resolve_image_path(asset_id: str) -> Path:
    return _storage("image").local_path(get_image_entry(asset_id).relative_path)


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
    )
    await _records("music").insert(entry.model_dump())
    logger.info("asset_library_music_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_music_entry(asset_id: str) -> MusicLibraryEntry:
    return MusicLibraryEntry(**_find("music", asset_id))


def list_music(category: str | None = None) -> list[MusicLibraryEntry]:
    return [MusicLibraryEntry(**d) for d in _records("music").list({"category": category} if category else None)]


def resolve_music_path(asset_id: str) -> Path:
    return _storage("music").local_path(get_music_entry(asset_id).relative_path)


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
    )
    await _records("video").insert(entry.model_dump())
    logger.info("asset_library_video_registered", asset_id=asset_id, category=category, source=source)
    return entry


def get_video_entry(asset_id: str) -> VideoLibraryEntry:
    return VideoLibraryEntry(**_find("video", asset_id))


def list_videos(category: str | None = None) -> list[VideoLibraryEntry]:
    return [VideoLibraryEntry(**d) for d in _records("video").list({"category": category} if category else None)]


def resolve_video_path(asset_id: str) -> Path:
    return _storage("video").local_path(get_video_entry(asset_id).relative_path)


# ── Usage tracking (shared by images, music and video) ────────────────────────

async def touch_usage(asset_id: str, kind: str) -> None:
    """Increment usage_count / bump last_used_at for a library asset.

    kind: "image" | "music" | "video"
    """
    updated = await _records(kind).increment(
        asset_id, "usage_count", patch={"last_used_at": _now_iso()}
    )
    if updated is None:
        raise AssetNotFoundError(f"{kind} asset_id '{asset_id}' not found — cannot record usage.")


# ── Cachés por asset (visión de imagen/video, transcripción de letras) ────────
# Evitan repetir llamadas caras (Vision Extractor, Whisper: varios minutos por
# canción) para un asset que ya se usó en un video anterior.

def _get_cache(store: str, asset_id: str) -> dict[str, Any] | None:
    return documents(store).get(asset_id)


async def _save_cache(store: str, kind: str, flag: str, asset_id: str, body: dict[str, Any]) -> None:
    documents(store).put(asset_id, body)
    await _records(kind).update(asset_id, {flag: True})
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
    await _records("image").update(asset_id, {"label": label})
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
