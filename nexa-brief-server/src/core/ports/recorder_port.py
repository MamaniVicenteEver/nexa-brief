"""Recorder Port — abstract contract for screen-capture + audio-mix backends."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig


@dataclass
class RecordingResult:
    youtube_path: Path           # 16:9 MP4 duración completa (YouTube)
    reels_path: Path | None = None  # 9:16 MP4 duración completa (Reels/Shorts)
    # None cuando niche_cfg.video.generate_tiktok_clip=False — evita generar un
    # clip redundante con reels_path cuando el nicho no va a publicar en TikTok.
    tiktok_path: Path | None = None  # 9:16 clip 61s con fades (TikTok)
    stats: dict = field(default_factory=dict)


class RecorderPort(ABC):
    """Record an HTML visualiser and produce video files per niche config formats."""

    @abstractmethod
    async def record(
        self,
        html_path: Path,
        audio_path: Path,
        output_dir: Path,
        duration_seconds: int,
        niche_cfg: "NicheConfig | None" = None,
    ) -> RecordingResult:
        """Open *html_path* headlessly, record *duration_seconds*, mix audio.

        Produces (based on niche_cfg.video.formats):
          - youtube_video.mp4  — 16:9 duración completa
          - reels_video.mp4    — 9:16 duración completa (crop seguro del centro)
          - tiktok_video.mp4   — 9:16 clip 61s con fade in/out

        Raises RecordingError on failure.
        """
