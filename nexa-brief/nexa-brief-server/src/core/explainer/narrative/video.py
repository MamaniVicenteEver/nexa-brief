"""Dónde queda la narrativa de un video: `assets/config.json` (la lee el kit), `manifest.json` (la
lee el catálogo) y `publish.json → strategies_used.narrative` (con qué se armó el video).

Leer lo grabado nunca carga la estrategia: un video viejo o una narrativa borrada no rompen nada.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from src.core.explainer.narrative.models import NarrativeStrategy


@dataclass(frozen=True)
class RecordedNarrative:
    narrative_id: str | None = None
    label: str | None = None
    title_level: str | None = None


def _read(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _active_config(config: dict) -> dict:
    configs = config.get("configs")
    return configs[0] if isinstance(configs, list) and configs and isinstance(configs[0], dict) else config


def recorded(video_dir: Path) -> RecordedNarrative:
    config = _active_config(_read(video_dir / "assets" / "config.json"))
    manifest = _read(video_dir / "manifest.json")
    pick = lambda key: config.get(key) or manifest.get(key) or None  # noqa: E731
    return RecordedNarrative(pick("narrative_id"), pick("narrative_label"), pick("title_level"))


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def record(video_dir: Path, narrative: NarrativeStrategy, title_level: str | None, *, design: str) -> None:
    """Graba la narrativa elegida en config.json y manifest.json del video."""
    fields = {"narrative_id": narrative.id, "narrative_label": narrative.label}
    if title_level:
        fields["title_level"] = title_level

    config_path = video_dir / "assets" / "config.json"
    config = _read(config_path) or {"design": design}
    _active_config(config).update(fields)
    _write(config_path, config)

    manifest_path = video_dir / "manifest.json"
    _write(manifest_path, {**_read(manifest_path), **fields})


def stamp_publish(video_dir: Path, used: dict[str, str] | None = None) -> dict[str, str]:
    """`strategies_used` con la narrativa grabada del video (sin tocar el resto)."""
    out = dict(used or {})
    narrative_id = recorded(video_dir).narrative_id
    if narrative_id:
        out["narrative"] = narrative_id
    return out


def stamp_publish_file(video_dir: Path) -> None:
    path = video_dir / "publish.json"
    publish = _read(path)
    publish["strategies_used"] = stamp_publish(video_dir, publish.get("strategies_used"))
    _write(path, publish)
