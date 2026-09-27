"""Recorder Adapter Factory."""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.core.ports.recorder_port import RecorderPort

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig


def get_recorder(niche_cfg: "NicheConfig | None" = None, engine_override: str | None = None) -> RecorderPort:
    """Return the recorder implementation selected by `engine_override` (si se
    pasó — ver JobInput.recorder_engine_override) o si no `niche_cfg.recorder_engine`.

    Default (sin niche_cfg): Playwright + FFmpeg. "remotion": render
    frame-by-frame via the Node/Remotion project — ver
    infrastructure/remotion_adapter.py. "hyperframes": vía el CLI del proyecto
    Node nexa-brief-hyperframes — ver infrastructure/hyperframes_adapter.py.
    El router valida `engine_override` contra `<engine>_adapter.supports_niche()`
    antes de llegar acá.
    """
    engine = engine_override or (niche_cfg.recorder_engine if niche_cfg is not None else "playwright")
    if engine == "remotion":
        from src.adapters.recorder.infrastructure.remotion_adapter import RemotionAdapter
        return RemotionAdapter()

    if engine == "hyperframes":
        from src.adapters.recorder.infrastructure.hyperframes_adapter import HyperframesAdapter
        return HyperframesAdapter()

    from src.adapters.recorder.infrastructure.playwright_ffmpeg_adapter import PlaywrightFFmpegAdapter
    return PlaywrightFFmpegAdapter()
