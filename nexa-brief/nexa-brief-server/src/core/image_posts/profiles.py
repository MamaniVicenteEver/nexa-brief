"""Image-only output profiles shared by plans, previews and JPEG exports.

The plan keeps its format as editable data. Existing 4:5 plans retain their
dimensions; only newly built plans use the portrait default.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping


@dataclass(frozen=True)
class ImageFormatProfile:
    format: str
    width: int
    height: int

    @property
    def size(self) -> tuple[int, int]:
        return self.width, self.height

    def to_dict(self) -> dict[str, str | int]:
        return {"format": self.format, "width": self.width, "height": self.height}


DEFAULT_IMAGE_FORMAT = "9:16"
IMAGE_FORMAT_PROFILES: Mapping[str, ImageFormatProfile] = MappingProxyType(
    {
        "4:5": ImageFormatProfile("4:5", 1080, 1350),
        "3:5": ImageFormatProfile("3:5", 1080, 1800),
        "9:16": ImageFormatProfile("9:16", 1080, 1920),
    }
)
IMAGE_FORMATS = tuple(IMAGE_FORMAT_PROFILES)


def get_image_profile(format: str | None = None) -> ImageFormatProfile:
    """Resolve a registered format, rejecting unsupported arbitrary dimensions."""
    selected = DEFAULT_IMAGE_FORMAT if format is None else format
    try:
        return IMAGE_FORMAT_PROFILES[selected]
    except (KeyError, TypeError):
        raise ValueError(f"Formato de imagen no admitido: {selected}. Usa {', '.join(IMAGE_FORMATS)}") from None
