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

import asyncio
import io
import mimetypes
import subprocess
from functools import lru_cache
import shutil
from pathlib import Path
from typing import Any, Literal

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi import Response as FastAPIResponse
from pydantic import BaseModel
from starlette.responses import FileResponse, Response

from src.adapters.library.music_researcher import ask_music_researcher
from src.adapters.library.music_sources import MusicSourcesHttp
from src.adapters.lyrics.factory import get_lyrics_transcriber
from src.config.exceptions import AssetNotFoundError
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.library import asset_library, music_enrichment, research_library, transcription, sound_library
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.schemas.library_schema import (
    ImageLibraryEntryResponse,
    LibraryAssetPatch,
    LibraryAssetPageResponse,
    LibraryDeleteResponse,
    MusicLibraryEntryResponse,
    MusicGroupResponse,
    MusicGroupPageResponse,
    SoundLibraryEntryResponse,
    TemplateConfigDetailResponse,
    TemplateConfigEntryResponse,
    VideoLibraryEntryResponse,
)
from src.presentation.api.schemas.research_schema import (
    ResearchCardResponse,
    ResearchCountsResponse,
    ResearchDetailResponse,
    ResearchFileResponse,
    ResearchImageResponse,
    ResearchPageResponse,
    ResearchSyncResponse,
)
from src.presentation.api.upload_helpers import clean_filename_label, save_upload_to_temp

router = APIRouter(prefix="/library", tags=["library"])
logger = structlog.get_logger(__name__)

ApiKind = Literal["images", "music", "videos", "sounds"]

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
        metadata_missing=asset_library.metadata_gaps("image", entry),
        tag_list=asset_library.tag_list(entry.tags),
        file_url=_file_url("image", entry.asset_id),
    )


def _music_response(entry: asset_library.MusicLibraryEntry) -> MusicLibraryEntryResponse:
    return MusicLibraryEntryResponse(
        **entry.model_dump(),
        metadata_missing=asset_library.metadata_gaps("music", entry),
        tag_list=asset_library.tag_list(entry.tags),
        file_url=_file_url("music", entry.asset_id),
        lyrics_url=(
            f"/api/v1/library/music/{entry.asset_id}/lyrics" if entry.has_lyrics_cache else None
        ),
    )


def _video_response(entry: asset_library.VideoLibraryEntry) -> VideoLibraryEntryResponse:
    return VideoLibraryEntryResponse(
        **entry.model_dump(),
        metadata_missing=asset_library.metadata_gaps("video", entry),
        tag_list=asset_library.tag_list(entry.tags),
        file_url=_file_url("video", entry.asset_id),
    )


def _response(kind: str, entry: Any) -> BaseModel:
    if kind == "image":
        return _image_response(entry)
    if kind == "music":
        return _music_response(entry)
    if kind == "sound":
        return _sound_response(entry)
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


# Miniaturas pequeñas para que el selector no decodifique imágenes originales
# ni mantenga una docena de reproductores de video abiertos.
_preview_semaphore = asyncio.Semaphore(2)

@lru_cache(maxsize=96)
def _preview_bytes(kind: str, filename: str, modified_ns: int, size: int) -> bytes:
    from PIL import Image, ImageOps

    if kind == "videos":
        result = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", filename, "-frames:v", "1", "-vf",
             "scale=320:180:force_original_aspect_ratio=decrease", "-f", "image2pipe",
             "-vcodec", "mjpeg", "pipe:1"],
            capture_output=True, timeout=15, check=True,
        )
        return result.stdout
    with Image.open(filename) as original:
        original.draft("RGB", (320, 180))
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail((320, 180))
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=76, optimize=True)
        return output.getvalue()

@router.get("/{kind}/{asset_id}/preview")
async def get_asset_preview(kind: Literal["images", "videos"], asset_id: str) -> Response:
    try:
        path = asset_library.resolve_asset_path("image" if kind == "images" else "video", asset_id)
        stat = path.stat()
        async with _preview_semaphore:
            content = await asyncio.to_thread(_preview_bytes, kind, str(path), stat.st_mtime_ns, stat.st_size)
    except (AssetNotFoundError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Resource not found") from exc
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        logger.warning("library_preview_failed", kind=kind, error=str(exc))
        raise HTTPException(status_code=422, detail="Could not create preview") from exc
    return Response(content, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


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
    entry = _get_or_404("music", asset_id)
    if entry.source == "production":
        raise HTTPException(status_code=409, detail="El recurso pertenece a una producción")
    if body and body.language is not None:
        await asset_library.update_asset_metadata("music", asset_id, {"language": body.language})
    entry = await transcription.enqueue(asset_id, get_lyrics_transcriber, force=True)
    return _music_response(entry)


class EnrichMusicResponse(BaseModel):
    status: Literal["actualizado", "sin_cambios", "completo", "no_encontrada", "error"]
    fields: list[str] = []
    sources: list[str] = []
    asset: MusicLibraryEntryResponse


@lru_cache(maxsize=1)
def _music_sources() -> MusicSourcesHttp:
    # Una sola instancia: el límite de una consulta por segundo de MusicBrainz es compartido.
    return MusicSourcesHttp()


_ENRICH_LOCKS: dict[str, asyncio.Lock] = {}


class EnrichMusicRequest(BaseModel):
    # «Regenerar» (overwrite) reemplaza descripción y etiquetas aunque ya existan.
    overwrite: bool = False


@router.post("/music/{asset_id}/enrich", response_model=EnrichMusicResponse)
async def enrich_music(asset_id: str, body: EnrichMusicRequest | None = None) -> EnrichMusicResponse:
    """«Completar datos» y «Regenerar»: busca la canción en MusicBrainz y Wikipedia. Sin `overwrite`
    rellena solo los campos vacíos; con `overwrite` reemplaza descripción y etiquetas. Título, categoría
    y licencia no cambian nunca."""
    entry = _get_or_404("music", asset_id)
    if entry.source == "production":
        raise HTTPException(status_code=409, detail="El recurso pertenece a una producción")
    overwrite = bool(body and body.overwrite)
    async with _ENRICH_LOCKS.setdefault(asset_id, asyncio.Lock()):
        try:
            report = await music_enrichment.enrich_music(
                asset_id, sources=_music_sources(), ask=ask_music_researcher, overwrite=overwrite
            )
        except Exception as exc:  # noqa: BLE001 — la ficha sigue válida si la investigación falla
            logger.warning("music_enrichment_failed", asset_id=asset_id, error=str(exc)[:300])
            report = music_enrichment.EnrichmentReport(status="error")
    return EnrichMusicResponse(
        status=report.status,
        fields=list(report.fields),
        sources=list(report.sources),
        asset=_music_response(asset_library.get_music_entry(asset_id)),
    )


# ── Investigaciones de los videos (pestaña Investigaciones de Recursos) ──────


def _research_file_url(research_id: str, path: str) -> str:
    return f"/api/v1/library/research/{research_id}/file/{path}"


def _research_card(item: dict[str, Any]) -> ResearchCardResponse:
    cover = item.get("cover_path")
    return ResearchCardResponse(
        research_id=item["research_id"],
        topic=item["topic"],
        researched_at=item["researched_at"],
        origin_root=item["origin_root"],
        origin_category=item["origin_category"],
        origin_video_id=item["origin_video_id"],
        origin_path=item["origin_path"],
        revision=item["revision"],
        version_count=item["version_count"],
        tags=item["tags"],
        counts=ResearchCountsResponse(**{**item["counts"], "videos": item["videos"]}),
        cover_url=_research_file_url(item["research_id"], cover) if cover else None,
    )


@router.post("/research/sync", response_model=ResearchSyncResponse)
async def sync_research() -> ResearchSyncResponse:
    """Registra las investigaciones de producciones y sandbox que aún no están en la librería.
    Es idempotente: lo ya registrado no se vuelve a copiar, y las carpetas originales no se tocan."""
    layout = layout_for_settings(settings)
    report = await research_library.sync(
        roots=[("production", layout.productions_dir), ("sandbox", layout.sandbox_dir)],
        profile_root=layout.root,
        resources_dir=layout.resources_dir,
    )
    return ResearchSyncResponse(
        folders=report.folders,
        created=report.created,
        merged=report.merged,
        skipped=report.skipped,
        errors=report.errors,
    )


@router.get("/research/categories", response_model=list[str])
async def list_research_categories() -> list[str]:
    return research_library.categories()


@router.get("/research", response_model=ResearchPageResponse)
async def list_research(
    q: str | None = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
) -> ResearchPageResponse:
    items, total = research_library.list_cards(
        q=q or "", category=category or "", page=page, page_size=page_size
    )
    return ResearchPageResponse(
        items=[_research_card(item) for item in items], total=total, page=page, page_size=page_size
    )


@router.get("/research/{research_id}", response_model=ResearchDetailResponse)
async def get_research(research_id: str) -> ResearchDetailResponse:
    layout = layout_for_settings(settings)
    detail = research_library.read_detail(research_id, layout.resources_dir)
    if detail is None:
        raise HTTPException(status_code=404, detail="Investigación no encontrada")
    origin = detail["origins"][0]
    used_by = detail.get("used_by") or []
    return ResearchDetailResponse(
        research_id=research_id,
        topic=detail["topic"],
        researched_at=detail["researched_at"],
        origin_root=origin["root"],
        origin_category=origin["category"],
        origin_video_id=origin["video_id"],
        origin_path=origin["path"],
        revision=detail.get("revision", ""),
        tags=detail.get("tags") or [],
        counts=ResearchCountsResponse(**{**detail["counts"], "videos": len(used_by)}),
        summary=detail["summary"],
        findings=detail["findings"],
        discarded=detail["discarded"],
        images=[
            ResearchImageResponse(
                path=image["path"],
                url=_research_file_url(research_id, image["path"]),
                source_url=image.get("source_url", ""),
                license=image.get("license", ""),
                credit=image.get("credit", ""),
            )
            for image in detail.get("images") or []
        ],
        files=[
            ResearchFileResponse(
                path=item["path"],
                url=_research_file_url(research_id, item["path"]),
                bytes=item.get("bytes", 0),
            )
            for item in detail.get("files") or []
        ],
        versions=detail["versions"],
        used_by=used_by,
    )


@router.get("/research/{research_id}/file/{file_path:path}")
async def get_research_file(research_id: str, file_path: str) -> FileResponse:
    layout = layout_for_settings(settings)
    target = research_library.file_location(research_id, file_path, layout.resources_dir)
    if target is None:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    # Archivos de fuentes externas (p. ej. SVG): sin scripts si se abren directamente en el navegador.
    return FileResponse(
        target,
        headers={"Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff"},
    )


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


def _sound_response(entry: sound_library.SoundLibraryEntry) -> SoundLibraryEntryResponse:
    return SoundLibraryEntryResponse(**entry.model_dump(), tag_list=asset_library.tag_list(entry.tags), file_url=_file_url("sound", entry.asset_id))


@router.get("/sounds", response_model=list[SoundLibraryEntryResponse])
async def list_sounds(category: str | None = None, q: str | None = None) -> list[SoundLibraryEntryResponse]:
    return [_sound_response(e) for e in asset_library.search_assets("sound", q=q, category=category)]


@router.get("/sounds/{asset_id}", response_model=SoundLibraryEntryResponse)
async def get_sound(asset_id: str) -> SoundLibraryEntryResponse:
    return _sound_response(_get_or_404("sound", asset_id))


@router.get("/sounds/{asset_id}/file")
async def get_sound_file(asset_id: str, request: Request) -> Response:
    return _serve_asset_file("sound", asset_id, request)


@router.post("/sounds", response_model=SoundLibraryEntryResponse, status_code=201)
async def upload_sound(response: FastAPIResponse, file: UploadFile = File(...), category: str = Form("sound_effects"), template_id: str = Form(""),
                       title: str | None = Form(None), label: str | None = Form(None), description: str = Form(""),
                       tags: str = Form(""), recommended_uses: str = Form("")) -> SoundLibraryEntryResponse:
    """Subir un efecto nunca inicia Whisper ni modifica una canción."""
    _validate_resource_context(category, template_id)
    _check_media_type("music", file)
    tmp = await save_upload_to_temp(file, ".wav")
    try:
        digest = asset_library.hash_file(tmp)
        existing = sound_library.find_sound_by_hash(digest)
        entry = await sound_library.register_sound(tmp, title=title or label or clean_filename_label(file.filename),
            description=description, tags=tags, category=category.strip() or "sound_effects", source="upload", provider="user_upload", filename=file.filename, template_id=template_id,
            recommended_uses=[s.strip() for s in recommended_uses.split("\n") if s.strip()])
        if existing:
            response.status_code = 200
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)
    return _sound_response(entry)


# ── Subida suelta ────────────────────────────────────────────────────────────

def _validate_resource_context(category: str, template_id: str) -> None:
    from src.core.library.resource_metadata import resource_metadata
    try:
        resource_metadata(category, template_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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


@router.post("/images", response_model=ImageLibraryEntryResponse, status_code=201)
async def upload_image(
    response: FastAPIResponse,
    file: UploadFile = File(...),
    category: str = Form(DEFAULT_UPLOAD_CATEGORY),
    template_id: str = Form(""),
    label: str | None = Form(None),
    description: str = Form(""),
    tags: str = Form(""),
) -> ImageLibraryEntryResponse:
    """Sube una imagen suelta a la librería (conserva el nombre original)."""
    _validate_resource_context(category, template_id)
    _check_media_type("image", file)
    tmp_path = await save_upload_to_temp(file, _DEFAULT_SUFFIX["image"])
    try:
        entry, created = await asset_library.register_uploaded_visual(
            "image", tmp_path, category=category.strip() or DEFAULT_UPLOAD_CATEGORY,
            filename=file.filename or f"archivo{tmp_path.suffix}", template_id=template_id,
            label=label or clean_filename_label(file.filename),
            description=description, tags=tags,
        )
    except asset_library.DuplicateFilenameError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finally:
        shutil.rmtree(tmp_path.parent, ignore_errors=True)
    if created:
        await asset_library.publish_asset_changed("image", entry.asset_id, action="created")
    else:
        response.status_code = 200
    return _image_response(entry)


@router.post("/music", response_model=MusicLibraryEntryResponse, status_code=201)
async def upload_music(
    response: FastAPIResponse,
    file: UploadFile = File(...),
    category: str = Form(DEFAULT_UPLOAD_CATEGORY),
    template_id: str = Form(""),
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
    _validate_resource_context(category, template_id)
    _check_media_type("music", file)
    tmp_path = await save_upload_to_temp(file, _DEFAULT_SUFFIX["music"])
    try:
        content_hash = asset_library.hash_file(tmp_path)
        existing = asset_library.find_music_by_hash(content_hash)
        if existing is not None:
            entry = await asset_library.attach_resource_origin("music", existing.asset_id, category, template_id)
            response.status_code = 200
        else:
            probe = await asset_library.probe_media(tmp_path)
            entry = await asset_library.register_music(
                tmp_path, category=category.strip() or DEFAULT_UPLOAD_CATEGORY,
                source="upload", provider="user_upload", template_id=template_id,
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
    response: FastAPIResponse,
    file: UploadFile = File(...),
    category: str = Form(DEFAULT_UPLOAD_CATEGORY),
    template_id: str = Form(""),
    label: str | None = Form(None),
    description: str = Form(""),
    tags: str = Form(""),
) -> VideoLibraryEntryResponse:
    """Sube un video de fondo suelto; duración y tamaño se leen con ffprobe."""
    _validate_resource_context(category, template_id)
    _check_media_type("video", file)
    tmp_path = await save_upload_to_temp(file, _DEFAULT_SUFFIX["video"])
    try:
        entry, created = await asset_library.register_uploaded_visual(
            "video", tmp_path, category=category.strip() or DEFAULT_UPLOAD_CATEGORY,
            filename=file.filename or f"archivo{tmp_path.suffix}", template_id=template_id,
            label=label or clean_filename_label(file.filename),
            description=description, tags=tags,
        )
    except asset_library.DuplicateFilenameError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finally:
        shutil.rmtree(tmp_path.parent, ignore_errors=True)
    if created:
        await asset_library.publish_asset_changed("video", entry.asset_id, action="created")
    else:
        response.status_code = 200
    return _video_response(entry)


# ── Edición / borrado (comunes a los tres kinds) ─────────────────────────────

@router.patch(
    "/{kind}/{asset_id}",
    response_model=SoundLibraryEntryResponse | ImageLibraryEntryResponse | MusicLibraryEntryResponse | VideoLibraryEntryResponse,
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
    except asset_library.LinkedProductionAssetError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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
    except asset_library.LinkedProductionAssetError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await asset_library.publish_asset_changed(internal, asset_id, action="deleted")
    return LibraryDeleteResponse(kind=kind, asset_id=asset_id)


# ── Categorías y configs archivadas ──────────────────────────────────────────

@router.get("/page/music/groups", response_model=MusicGroupPageResponse)
async def list_music_group_page(page: int = Query(1, ge=1),
                                page_size: int = Query(12, ge=1, le=48),
                                category: str | None = None,
                                q: str | None = None,
                                has_lyrics: bool | None = None) -> MusicGroupPageResponse:
    """Lista grupos de versiones sin alterar ni eliminar los recursos originales."""
    await _reconcile_transcriptions()
    groups, total = asset_library.page_music_groups(
        page=page, page_size=page_size, q=q, category=category, has_lyrics=has_lyrics
    )
    return MusicGroupPageResponse(
        items=[MusicGroupResponse(title=group[0].track_name, artist=group[0].artist,
                                  items=[_music_response(entry) for entry in group])
               for group in groups],
        total=total, page=page, page_size=page_size,
    )


@router.get("/page/{kind}", response_model=LibraryAssetPageResponse)
async def list_asset_page(kind: ApiKind, page: int = Query(1, ge=1),
                          page_size: int = Query(12, ge=1, le=48),
                          category: str | None = None, q: str | None = None) -> LibraryAssetPageResponse:
    if kind == "music":
        await _reconcile_transcriptions()
    internal = asset_library.API_KINDS[kind]
    entries, total = asset_library.page_assets(internal, page=page, page_size=page_size, q=q, category=category)
    return LibraryAssetPageResponse(items=[_response(internal, entry) for entry in entries],
                                    total=total, page=page, page_size=page_size)


@router.get("/categories", response_model=list[str])
async def list_categories(kind: str = "images") -> list[str]:
    """List distinct categories present in the library ("images" | "music" | "videos")."""
    if kind not in asset_library.API_KINDS:
        raise HTTPException(status_code=400, detail="kind must be 'images', 'music', 'videos' or 'sounds'")
    return sorted({category for e in asset_library.search_assets(asset_library.API_KINDS[kind])
                   for category in ([e.category_id] + [o.category_id for o in e.resource_origins] if e.category_id else [e.category])
                   if category})


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
