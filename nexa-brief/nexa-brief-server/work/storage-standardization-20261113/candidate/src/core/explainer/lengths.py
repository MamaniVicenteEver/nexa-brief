"""Duración de los videos explainer: lee `explainer-kit/lengths.json`, la fuente única.

La misma tabla la usan el kit (kit.py new/status/check/voice, tools/lengths.py), el brief, la
producción (minutos objetivo y tiempo máximo del agente) y la web (opciones de duración).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache

from src.core.explainer.designs import KIT_DIR

LENGTHS_FILE = KIT_DIR / "lengths.json"


@dataclass(frozen=True)
class LengthPreset:
    minutes: int
    id: str
    label: str


@lru_cache(maxsize=1)
def _spec() -> dict:
    return json.loads(LENGTHS_FILE.read_text(encoding="utf-8"))


def min_minutes(format_id: str | None = None) -> float:
    if format_id:
        from src.core.editions.formats import load_format
        return load_format(format_id).duration_seconds.min / 60
    return int(_spec()["min_minutes"])


def max_minutes(format_id: str | None = None) -> float:
    if format_id:
        from src.core.editions.formats import load_format
        return load_format(format_id).duration_seconds.max / 60
    return int(_spec()["max_minutes"])


def default_minutes(format_id: str | None = None) -> float:
    if format_id:
        from src.core.editions.formats import load_format
        return load_format(format_id).duration_seconds.default / 60
    return int(_spec()["default_minutes"])


def presets() -> list[LengthPreset]:
    return [LengthPreset(int(p["minutes"]), p["id"], p["label"]) for p in _spec()["presets"]]


def clamp_minutes(minutes: float | None, format_id: str | None = None) -> float:
    return max(min_minutes(format_id), min(max_minutes(format_id), float(minutes or default_minutes(format_id))))


def chapters_range(minutes: float, format_id: str | None = None) -> tuple[int, int]:
    """Capítulos esperados para la duración (cada uno de 75–150 s)."""
    if format_id:
        from src.core.editions.formats import targets
        return tuple(targets(minutes * 60, format_id)["chapters"])
    lo, hi = _spec()["chapter_seconds"]
    seconds = clamp_minutes(minutes) * 60
    return max(2, math.floor(seconds / hi)), max(2, math.ceil(seconds / lo))


def agent_timeout_seconds(minutes: float | None, format_id: str | None = None) -> int:
    """Tiempo máximo del agente que produce el video (investigar, voz, Whisper en CPU, storyboard)."""
    a = _spec()["agent_minutes"]
    return int((a["base"] + a["per_video_minute"] * clamp_minutes(minutes, format_id)) * 60)


def host_timeout_seconds(minutes: float | None, format_id: str | None = None) -> int:
    """Tiempo máximo por paso de voz o transcripción ejecutado por el host."""
    host = _spec()["host_minutes"]
    return int((host["base"] + host["per_video_minute"] * clamp_minutes(minutes, format_id)) * 60)


def targets(minutes: float | None, format_id: str, wpm=(120, 130)) -> dict:
    """Explicit format counts use seconds, density and the identity voice speed."""
    from src.core.editions.formats import targets as format_targets
    return format_targets(None if minutes is None else minutes * 60, format_id, wpm)
