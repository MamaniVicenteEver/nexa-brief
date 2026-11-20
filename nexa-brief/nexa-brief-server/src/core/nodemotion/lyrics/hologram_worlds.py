"""Compatibilidad. La adaptación a la canción elegida vive ahora en `song_adapter.py`
(genérica y guiada por `adaptacion.json` + `contenido-static.json` de cada plantilla)."""
from __future__ import annotations

from typing import Any

from src.core.nodemotion.lyrics.song_adapter import apply_song_lyrics


def apply_selected_song_lyrics(config: dict[str, Any], job: Any) -> int:
    report = apply_song_lyrics("lyrics-hologram-worlds", config, job)
    return int(report.get("frasesUsadas", 0)) if report else 0
