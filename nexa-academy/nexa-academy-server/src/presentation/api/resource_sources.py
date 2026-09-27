"""Resuelve ImageSource/VideoSource desde form fields multipart: archivo
subido, referencia a un asset ya archivado (asset_id), o automático.

Compartido entre POST /videos/upload y POST /templates/{id}/preview — ambos
necesitan exactamente la misma resolución de "de dónde sale la imagen/video
de este job".
"""

from __future__ import annotations

import shutil

from fastapi import HTTPException, UploadFile

from src.config.exceptions import AssetNotFoundError
from src.config.niche_config import NicheConfig
from src.core.job import AssetSourceType, ImageSource, VideoSource
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
            )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        return ImageSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    return ImageSource()


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
            )
        finally:
            shutil.rmtree(tmp_path.parent, ignore_errors=True)
        return VideoSource(type=AssetSourceType.LIBRARY, asset_id=entry.asset_id)

    return None
