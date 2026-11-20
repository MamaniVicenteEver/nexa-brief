"""Resuelve ImageSource/MusicSource/VideoSource desde form fields multipart:
archivo subido, referencia a un asset ya archivado (asset_id), o automático.

Compartido entre POST /videos/upload y POST /templates/{id}/preview — ambos
necesitan exactamente la misma resolución de "de dónde sale la imagen/música/
video de este job".
"""

from __future__ import annotations

import shutil

from fastapi import HTTPException, UploadFile

from src.config.exceptions import AssetNotFoundError
from src.config.niche_config import NicheConfig
from src.core.job import AssetSourceType, ImageSource, MusicSource, VideoSource
from src.core.library import asset_library
from src.presentation.api.upload_helpers import clean_filename_label, save_upload_to_temp


async def resolve_image_source(
    niche_cfg: NicheConfig,
    category_name: str,
    image_file: UploadFile | None,
    image_asset_id: str | None,
) -> ImageSource:
    if image_asset_id:
        try:
            asset_library.get_image_entry(image_asset_id)
        except AssetNotFoundError as exc:
            raise HTTPException(status_code=400, detail=f"image_asset_id not found: {exc}") from exc
        return ImageSource(type=AssetSourceType.LIBRARY, asset_id=image_asset_id)

    if image_file is not None:
        tmp_path = await save_upload_to_temp(image_file, ".jpg")
        try:
            category = niche_cfg.image.library_category or category_name
            entry = await asset_library.register_image(
                tmp_path, category=category, source="upload", provider="user_upload",
                label=clean_filename_label(image_file.filename),
                filename=image_file.filename,
            )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        return ImageSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    return ImageSource()


async def resolve_music_source(
    niche_cfg: NicheConfig,
    category_name: str,
    music_file: UploadFile | None,
    music_asset_id: str | None,
    song_name: str | None,
    artist: str | None,
) -> MusicSource:
    if music_asset_id:
        try:
            asset_library.get_music_entry(music_asset_id)
        except AssetNotFoundError as exc:
            raise HTTPException(status_code=400, detail=f"music_asset_id not found: {exc}") from exc
        return MusicSource(type=AssetSourceType.LIBRARY, asset_id=music_asset_id)

    if music_file is not None:
        resolved_track_name = song_name or clean_filename_label(music_file.filename)
        # Si ya existe una canción archivada con este mismo nombre (+ artista, si
        # se dio), reusar esa entrada en vez de duplicar el archivo.
        existing = asset_library.find_music_by_name(resolved_track_name, artist)
        if existing is not None:
            await asset_library.touch_usage(existing.asset_id, "music")
            return MusicSource(type=AssetSourceType.LIBRARY, asset_id=existing.asset_id)

        # El nombre no matcheó, pero el nombre de archivo varía seguido entre
        # descargas de la misma canción — comparar por hash de contenido antes
        # de duplicar el asset (ver docs/dedup-audio-por-hash.md).
        tmp_path = await save_upload_to_temp(music_file, ".mp3")
        try:
            content_hash = asset_library.hash_file(tmp_path)
            by_hash = asset_library.find_music_by_hash(content_hash)
            if by_hash is not None:
                await asset_library.touch_usage(by_hash.asset_id, "music")
                entry = by_hash
            else:
                category = niche_cfg.audio.library_category or category_name
                entry = await asset_library.register_music(
                    tmp_path, category=category, source="upload", provider="user_upload",
                    track_name=resolved_track_name,
                    artist=artist or "",
                    content_hash=content_hash,
                    filename=music_file.filename,
                )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        return MusicSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    return MusicSource()


async def resolve_video_source(
    category_name: str,
    video_file: UploadFile | None,
    video_asset_id: str | None,
) -> VideoSource | None:
    if video_asset_id:
        try:
            asset_library.get_video_entry(video_asset_id)
        except AssetNotFoundError as exc:
            raise HTTPException(status_code=400, detail=f"video_asset_id not found: {exc}") from exc
        return VideoSource(type=AssetSourceType.LIBRARY, asset_id=video_asset_id)

    if video_file is not None:
        tmp_path = await save_upload_to_temp(video_file, ".mp4")
        try:
            entry = await asset_library.register_video(
                tmp_path, category=category_name, source="upload", provider="user_upload",
                label=clean_filename_label(video_file.filename),
                filename=video_file.filename,
            )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        return VideoSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    return None
