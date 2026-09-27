"""Physical image rotation — applies the correction reported by the Vision
Extractor prompt (orientation_check.rotation_to_correct_deg) BEFORE that JSON
is persisted, so every downstream consumer (Prompt 2, the vision cache,
video_recorder) sees an already-upright image on disk.
"""

from __future__ import annotations

from pathlib import Path

import structlog
from PIL import Image

logger = structlog.get_logger(__name__)


def apply_orientation_correction(image_path: Path, rotation_deg: int) -> None:
    """Rotate *image_path* in place by *rotation_deg* degrees CLOCKWISE.

    rotation_deg is exactly the value reported by the Vision Extractor's
    `orientation_check.rotation_to_correct_deg` (one of 0, 90, -90, 180).
    No-op when 0. PIL's Image.rotate() is counter-clockwise, so the clockwise
    degrees requested are negated before calling it.
    """
    normalized = rotation_deg % 360
    if normalized == 0:
        return

    with Image.open(image_path) as img:
        rotated = img.rotate(-rotation_deg, expand=True)
        rotated.save(image_path)

    logger.info("image_rotation_applied", path=str(image_path), rotation_deg=rotation_deg)


def verify_dimensions(image_path: Path, expected_width: int, expected_height: int) -> bool:
    """Soft assertion: compare the real post-rotation size against what the
    Vision Extractor reported in image_dimensions. Never raises — callers
    should just log a warning on mismatch, this is a cheap sanity net, not
    a hard requirement (the schema does not guarantee pixel-perfect values).
    """
    with Image.open(image_path) as img:
        actual_width, actual_height = img.size
    matches = actual_width == expected_width and actual_height == expected_height
    if not matches:
        logger.warning(
            "image_dimensions_mismatch",
            path=str(image_path),
            expected=(expected_width, expected_height),
            actual=(actual_width, actual_height),
        )
    return matches
