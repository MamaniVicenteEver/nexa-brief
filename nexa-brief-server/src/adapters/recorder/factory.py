"""Recorder Adapter Factory."""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.core.ports.recorder_port import RecorderPort

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig


def get_recorder(niche_cfg: "NicheConfig | None" = None) -> RecorderPort:
    """Return the recorder implementation selected by niche_cfg.recorder_engine.

    Default (no niche_cfg, or recorder_engine == "playwright"): Playwright + FFmpeg.
    "remotion": render frame-by-frame via the Node/Remotion project — ver
    infrastructure/remotion_adapter.py. Solo niches con una composición
    Remotion equivalente deben declarar este engine en niches.json.
    """
    engine = niche_cfg.recorder_engine if niche_cfg is not None else "playwright"
    if engine == "remotion":
        from src.adapters.recorder.infrastructure.remotion_adapter import RemotionAdapter
        return RemotionAdapter()

    from src.adapters.recorder.infrastructure.playwright_ffmpeg_adapter import PlaywrightFFmpegAdapter
    return PlaywrightFFmpegAdapter()
