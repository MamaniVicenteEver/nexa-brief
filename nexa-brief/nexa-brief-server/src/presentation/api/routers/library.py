"""Library router — librería local de recursos (imágenes, música, videos).

Expone lo que se acumula en las colecciones image_assets / music_assets /
video_assets (ver src/core/library/asset_library.py) para la pantalla
"Recursos" y el buscador del Estudio
(docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.2):

- GET    /library/{kind}?q=&category=     listar / buscar
- POST   /library/{kind}                  subir un archivo suelto (multipart)
- PATCH  /library/{kind}/{asset_id}       editar metadata
- DELETE /library/{kind}/{asset_id}       borrar archivo + registro + cachés
- GET    /library/music/{id}/lyrics       letra transcrita (JSON de Whisper)
- POST   /library/music/{id}/transcribe   re-encolar la transcripción

Subir una canción dispara la transcripción en segundo plano
(core/library/transcription.py); cada cambio se avisa por WebSocket con el
evento "library_asset_changed" {kind, asset_id, action, transcription_status}.

El pipeline sigue escribiendo en la librería por su cuenta (resource_fetcher,
html_generator); estos endpoints son la puerta de entrada manual.
"""

from __future__ import annotations

import mimetypes
import shutil
from pathlib import Path
from typing import Any, Literal

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi import Response as FastAPIResponse
from pydantic import BaseModel
from starlette.responses import Response

from src.adapters.lyrics.factory import get_lyrics_transcriber
from src.config.exceptions import AssetNotFoundError
from src.core.library import asset_library, transcription
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.schemas.library_schema import (
    ImageLibraryEntryResponse,
    LibraryAssetPatch,
    LibraryDeleteResponse,
    MusicLibraryEntryResponse,
    TemplateConfigDetailResponse,
    TemplateConfigEntryResponse,
    VideoLibraryEntryResponse,
)
from src.presentation.api.upload_helpers import clean_filename_label, save_upload_to_temp

router = APIRouter(prefix="/library", tags=["library"])
logger = structlog.get_logger(__name__)

ApiKind = Literal["images", "music", "videos"]

# Categoría por defecto de lo que se sube desde Recursos. Separada de las que
# usa el pipeline ("songs_with_lyrics", "lyrics_backgrounds"…) para que una
# subida suelta no entre sola en la selección automática de un nicho.
DEFAULT_UPLOAD_CATEGORY = "uploads"

# Se valida por content-type O por extensión: muchos navegadores mandan
# application/octet-stream para .m4a/.mkv, y la extensión es lo que de verdad
# usan ffmpeg y los recorders.
_ALLOWED: dict[str, tuple[str, frozenset[str]]] = {
    "image": ("image/", frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"})),
    "music": ("audio/", frozenset({".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".flac", ".opus"})),
    "video": ("video/", frozenset({".mp4", ".mov", ".webm", ".mkv", ".m4v"})),
}
_DEFAULT_SUFFIX = {"image": ".jpg", "music": ".mp3", "video": ".mp4"}


# ── Serialización ────────────────────────────────────────────────────────────

def _file_url(kind: str, asset_id: str) -> str:
    return f"/api/v1/library/{asset_library.api_kind(kind)}/{asset_id}/file"


def _image_response(entry: asset_library.ImageLibraryEntry) -> ImageLibraryEntryResponse:
    return ImageLibraryEntryResponse(
        **entry.model_dump(),
        tag_list=asset_library.tag_list(entry.tags),
        file_url=_file_url("image", entry.asset_id),
    )


def _music_response(entry: asset_library.MusicLibraryEntry) -> MusicLibraryEntryResponse:
    return MusicLibraryEntryResponse(
        **entry.model_dump(),
        tag_list=asset_library.tag_list(entry.tags),
        file_url=_file_url("music", entry.asset_id),
        lyrics_url=(
            f"/api/v1/library/music/{entry.asset_id}/lyrics" if entry.has_lyrics_cache else None
        ),
    )


def _video_response(entry: asset_library.VideoLibraryEntry) -> VideoLibraryEntryResponse:
    return VideoLibraryEntryResponse(
        **entry.model_dump(),
        tag_list=asset_library.tag_list(entry.tags),
        file_url=_file_url("video", entry.asset_id),
    )


def _response(kind: str, entry: Any) -> BaseModel:
    if kind == "image":
        return _image_response(entry)
    if kind == "music":
        return _music_response(entry)
    return _video_response(entry)


# Las transcripciones en segundo plano viven en memoria: si el servidor se
# reinició a mitad de una, el registro quedó "pending"/"running" para siempre.
# Se corrige una vez por proceso, en la primera consulta de música (main.py no
# tiene hook de la librería en su lifespan).
_interrupted_checked = False


async def _reconcile_transcriptions() -> None:
    global _interrupted_checked
    if _interrupted_checked:
        return
    _interrupted_checked = True
    await transcription.mark_interrupted()


def _get_or_404(kind: str, asset_id: str) -> Any:
    try:
        return asset_library.get_entry(kind, asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _serve_asset_file(kind: str, asset_id: str, request: Request) -> Response:
    try:
        path = asset_library.resolve_asset_path(kind, asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


# ── Images ───────────────────────────────────────────────────────────────────

@router.get("/images", response_model=list[ImageLibraryEntryResponse])
async def list_images(
    category: str | None = None, q: str | None = None
) -> list[ImageLibraryEntryResponse]:
    """List archived images, optionally filtered by category and/or free text `q`
    (label, tags, nombre de archivo, descripción; sin distinguir acentos)."""
    return [_image_response(e) for e in asset_library.search_assets("image", q=q, category=category)]


@router.get("/images/{asset_id}", response_model=ImageLibraryEntryResponse)
async def get_image(asset_id: str) -> ImageLibraryEntryResponse:
    """Fetch a single archived image's metadata."""
    return _image_response(_get_or_404("image", asset_id))


@router.get("/images/{asset_id}/file")
async def get_image_file(asset_id: str, request: Request) -> Response:
    """Sirve el binario real de una imagen archivada (para <img src> en el admin)."""
    return _serve_asset_file("image", asset_id, request)


# ── Music ────────────────────────────────────────────────────────────────────

@router.get("/music", response_model=list[MusicLibraryEntryResponse])
async def list_music(
    category: str | None = None, q: str | None = None
) -> list[MusicLibraryEntryResponse]:
    """List archived music tracks, optionally filtered by category and/or free
    text `q` (nombre, artista, género, tags, archivo, descripción)."""
    await _reconcile_transcriptions()
    return [_music_response(e) for e in asset_library.search_assets("music", q=q, category=category)]


@router.get("/music/{asset_id}", response_model=MusicLibraryEntryResponse)
async def get_music(asset_id: str) -> MusicLibraryEntryResponse:
    """Fetch a single archived music track's metadata."""
    await _reconcile_transcriptions()
    return _music_response(_get_or_404("music", asset_id))


@router.get("/music/{asset_id}/file")
async def get_music_file(asset_id: str, request: Request) -> Response:
    """Sirve el binario real de una canción archivada (para <audio src> en el admin)."""
    return _serve_asset_file("music", asset_id, request)


@router.get("/music/{asset_id}/lyrics")
async def get_music_lyrics(asset_id: str) -> dict[str, Any]:
    """Letra transcrita (JSON de Whisper: metadata + segments con words). 404
    si la canción no existe o si todavía no tiene letra (ver transcription_status)."""
    _get_or_404("music", asset_id)
    lyrics = asset_library.get_lyrics_cache(asset_id)
    if lyrics is None:
        raise HTTPException(status_code=404, detail=f"Music asset '{asset_id}' has no transcription yet.")
    return lyrics


class TranscribeRequest(BaseModel):
    # Si viene, se guarda en la canción antes de transcribir (Whisper acierta
    # más con el idioma fijado que auto-detectando en pistas con mucho instrumental).
    language: str | None = None


@router.post("/music/{asset_id}/transcribe", response_model=MusicLibraryEntryResponse, status_code=202)
async def transcribe_music(asset_id: str, body: TranscribeRequest | None = None) -> MusicLibraryEntryResponse:
    """Re-encola la transcripción (aunque ya tenga letra: es el "reintentar" /
    "volver a transcribir" de la UI). La letra anterior sigue disponible hasta
    que la nueva la reemplaza."""
    _get_or_404("music", asset_id)
    if body and body.language is not None:
        await asset_library.update_asset_metadata("music", asset_id, {"language": body.language})
    entry = await transcription.enqueue(asset_id, get_lyrics_transcriber, force=True)
    return _music_response(entry)


# ── Videos ───────────────────────────────────────────────────────────────────

@router.get("/videos", response_model=list[VideoLibraryEntryResponse])
async def list_videos(
    category: str | None = None, q: str | None = None
) -> list[VideoLibraryEntryResponse]:
    """List archived background videos, optionally filtered by category and/or free text `q`."""
    return [_video_response(e) for e in asset_library.search_assets("video", q=q, category=category)]


@router.get("/videos/{asset_id}", response_model=VideoLibraryEntryResponse)
async def get_video(asset_id: str) -> VideoLibraryEntryResponse:
    """Fetch a single archived video's metadata."""
    return _video_response(_get_or_404("video", asset_id))


@router.get("/videos/{asset_id}/file")
async def get_video_file(asset_id: str, request: Request) -> Response:
    """Sirve el binario real de un video de fondo archivado (para <video src> en el admin)."""
    return _serve_asset_file("video", asset_id, request)


# ── Subida suelta ────────────────────────────────────────────────────────────

def _check_media_type(kind: str, upload: UploadFile) -> None:
    prefix, suffixes = _ALLOWED[kind]
    suffix = Path(upload.filename or "").suffix.lower()
    content_type = (upload.content_type or "").lower()
    if not (content_type.startswith(prefix) or suffix in suffixes):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file for {asset_library.api_kind(kind)}: "
            f"'{upload.filename}' ({content_type or 'unknown type'}).",
        )


def _orientation(width: int, height: int) -> str | None:
    if not width or not height:
        return None
    ratio = width / height
    if ratio > 1.1:
        return "landscape"
    if ratio < 0.9:
        return "portrait"
    return "squarish"


@router.post("/images", response_model=ImageLibraryEntryResponse, status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    category: str = Form(DEFAULT_UPLOAD_CATEGORY),
    label: str | None = Form(None),
    description: str = Form(""),
    tags: str = Form(""),
) -> ImageLibraryEntryResponse:
    """Sube una imagen suelta a la librería (conserva el nombre original)."""
    _check_media_type("image", file)
    tmp_path = await save_upload_to_temp(file, _DEFAULT_SUFFIX["image"])
    try:
        probe = await asset_library.probe_media(tmp_path)
        width, height = int(probe.get("width", 0)), int(probe.get("height", 0))
        entry = await asset_library.register_image(
            tmp_path, category=category.strip() or DEFAULT_UPLOAD_CATEGORY,
            source="upload", provider="user_upload", filename=file.filename,
            label=label or clean_filename_label(file.filename),
            description=description, tags=tags,
            width=width, height=height, orientation=_orientation(width, height),
        )
    finally:
        shutil.rmtree(tmp_path.parent, ignore_errors=True)
    await asset_library.publish_asset_changed("image", entry.asset_id, action="created")
    return _image_response(entry)


@router.post("/music", response_model=MusicLibraryEntryResponse, status_code=201)
async def upload_music(
    response: FastAPIResponse,
    file: UploadFile = File(...),
    category: str = Form(DEFAULT_UPLOAD_CATEGORY),
    track_name: str | None = Form(None),
    label: str | None = Form(None),
    artist: str = Form(""),
    genre: str = Form(""),
    description: str = Form(""),
    tags: str = Form(""),
    language: str = Form(""),
    transcribe: bool = Form(True),
) -> MusicLibraryEntryResponse:
    """Sube una canción suelta. Si los mismos bytes ya están en la librería
    (dedup por sha256, ver docs/dedup-audio-por-hash.md) devuelve la existente
    con 200 en vez de duplicarla; si es nueva, 201.

    Con `transcribe=true` (default) encola la transcripción en segundo plano y
    responde enseguida con `transcription_status: "pending"`. `false` sirve para
    pistas instrumentales (Whisper solo inventaría letra)."""
    await _reconcile_transcriptions()
    _check_media_type("music", file)
    tmp_path = await save_upload_to_temp(file, _DEFAULT_SUFFIX["music"])
    try:
        content_hash = asset_library.hash_file(tmp_path)
        existing = asset_library.find_music_by_hash(content_hash)
        if existing is not None:
            entry = existing
            response.status_code = 200
        else:
            probe = await asset_library.probe_media(tmp_path)
            entry = await asset_library.register_music(
                tmp_path, category=category.strip() or DEFAULT_UPLOAD_CATEGORY,
                source="upload", provider="user_upload",
                content_hash=content_hash, filename=file.filename,
                track_name=track_name or label or clean_filename_label(file.filename),
                artist=artist, genre=genre, description=description, tags=tags,
                language=language.strip(),
                duration_seconds=round(float(probe.get("duration_seconds", 0))),
            )
    finally:
        shutil.rmtree(tmp_path.parent, ignore_errors=True)

    if existing is None:
        await asset_library.publish_asset_changed(
            "music", entry.asset_id, action="created", transcription_status=entry.transcription_status
        )
    # También para una existente que nunca se transcribió o falló: subirla de
    # nuevo es la forma natural de "quiero la letra de esta canción".
    if transcribe and entry.transcription_status in ("none", "failed"):
        entry = await transcription.enqueue(entry.asset_id, get_lyrics_transcriber)
    return _music_response(entry)


@router.post("/videos", response_model=VideoLibraryEntryResponse, status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    category: str = Form(DEFAULT_UPLOAD_CATEGORY),
    label: str | None = Form(None),
    description: str = Form(""),
    tags: str = Form(""),
) -> VideoLibraryEntryResponse:
    """Sube un video de fondo suelto; duración y tamaño se leen con ffprobe."""
    _check_media_type("video", file)
    tmp_path = await save_upload_to_temp(file, _DEFAULT_SUFFIX["video"])
    try:
        probe = await asset_library.probe_media(tmp_path)
        entry = await asset_library.register_video(
            tmp_path, category=category.strip() or DEFAULT_UPLOAD_CATEGORY,
            source="upload", provider="user_upload", filename=file.filename,
            label=label or clean_filename_label(file.filename),
            description=description, tags=tags,
            width=int(probe.get("width", 0)), height=int(probe.get("height", 0)),
            duration_seconds=float(probe.get("duration_seconds", 0.0)),
        )
    finally:
        shutil.rmtree(tmp_path.parent, ignore_errors=True)
    await asset_library.publish_asset_changed("video", entry.asset_id, action="created")
    return _video_response(entry)


# ── Edición / borrado (comunes a los tres kinds) ─────────────────────────────

@router.patch(
    "/{kind}/{asset_id}",
    response_model=ImageLibraryEntryResponse | MusicLibraryEntryResponse | VideoLibraryEntryResponse,
)
async def update_asset(kind: ApiKind, asset_id: str, body: LibraryAssetPatch) -> BaseModel:
    """Edita la metadata (nombre, artista, descripción, tags, idioma, categoría…).
    Solo se aplican los campos enviados que correspondan al kind."""
    internal = asset_library.API_KINDS[kind]
    try:
        entry = await asset_library.update_asset_metadata(
            internal, asset_id, body.model_dump(exclude_unset=True)
        )
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await asset_library.publish_asset_changed(
        internal, asset_id, action="updated",
        transcription_status=getattr(entry, "transcription_status", None),
    )
    return _response(internal, entry)


@router.delete("/{kind}/{asset_id}", response_model=LibraryDeleteResponse)
async def delete_asset(kind: ApiKind, asset_id: str) -> LibraryDeleteResponse:
    """Borra el archivo, el registro y sus cachés (letra / análisis de visión)."""
    internal = asset_library.API_KINDS[kind]
    try:
        await asset_library.delete_asset(internal, asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await asset_library.publish_asset_changed(internal, asset_id, action="deleted")
    return LibraryDeleteResponse(kind=kind, asset_id=asset_id)


# ── Categorías y configs archivadas ──────────────────────────────────────────

@router.get("/categories", response_model=list[str])
async def list_categories(kind: str = "images") -> list[str]:
    """List distinct categories present in the library ("images" | "music" | "videos")."""
    if kind not in asset_library.API_KINDS:
        raise HTTPException(status_code=400, detail="kind must be 'images', 'music' or 'videos'")
    return sorted({e.category for e in asset_library.search_assets(asset_library.API_KINDS[kind])})


@router.get("/configs", response_model=list[TemplateConfigEntryResponse])
async def list_template_configs(template_id: str | None = None) -> list[TemplateConfigEntryResponse]:
    """List archived config.json entries, optionally filtered by template_id."""
    entries = asset_library.list_template_configs(template_id=template_id)
    return [TemplateConfigEntryResponse(**e.model_dump()) for e in entries]


@router.get("/configs/{job_id}", response_model=TemplateConfigDetailResponse)
async def get_template_config(job_id: str) -> TemplateConfigDetailResponse:
    """Fetch the full archived config.json content for a given job_id."""
    try:
        config = asset_library.get_template_config(job_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return TemplateConfigDetailResponse(job_id=job_id, config=config)
