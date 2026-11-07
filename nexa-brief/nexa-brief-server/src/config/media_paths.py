"""Pure, validated logical keys for schema 3 media."""
from __future__ import annotations

import re
from pathlib import PurePosixPath

_PART = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")
_CATEGORY_FOLDERS = {
    "node_tech": "nodetech",
    "node_history": "nodehistory",
    "node_politics": "nodepolitics",
    "node_economy": "nodeeconomy",
    "node_action": "nodeaction",
    "node_motion": "nodemotion",
    "node_atlas": "nodeatlas",
}


def _part(value: str) -> str:
    if not isinstance(value, str) or not _PART.fullmatch(value):
        raise ValueError("Invalid media identifier")
    return value


def category_folder(category: str) -> str:
    """Use the top-level folder for a category or nested category path."""
    parts = category.split("/") if isinstance(category, str) else []
    if not parts or any(not _PART.fullmatch(p) for p in parts):
        raise ValueError("Invalid media category")
    return _CATEGORY_FOLDERS.get(parts[0], parts[0])


def image_key(category: str, post_id: str, publication_id: str, asset_id: str) -> str:
    return str(PurePosixPath("images", category_folder(category), _part(post_id),
                             _part(publication_id), _part(asset_id) + ".jpg"))


def reel_key(category: str, post_id: str, publication_id: str, digest: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("Invalid media digest")
    render_id = _part(publication_id) + "-reel-" + digest[:24]
    return str(PurePosixPath("videos", category_folder(category), _part(post_id), render_id, "video.mp4"))


def video_key(category: str, video_id: str, recording_id: str, orientation: str, *, preview: bool = False) -> str:
    if orientation not in {"9x16", "16x9"}:
        raise ValueError("Invalid video orientation")
    render_id = ("preview-" if preview else "") + _part(recording_id) + "-" + orientation
    return str(PurePosixPath("videos", category_folder(category), _part(video_id), render_id, "video.mp4"))


def pipeline_video_key(category: str, video_id: str, format_id: str, aspect_ratio: str) -> str:
    orientation = {"9:16": "9x16", "16:9": "16x9"}.get(aspect_ratio)
    if orientation is None:
        raise ValueError("Invalid video aspect ratio")
    return video_key(category, video_id, _part(video_id) + "-" + _part(format_id), orientation)
