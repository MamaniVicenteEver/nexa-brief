"""Lleva la intro del paquete al video: cartel de apertura (beat 0) y guion.

En TikTok/Reels no hay miniatura: el primer cuadro hace de título, así que el
texto de 0–3 s del paquete es el que dibuja el cartel de apertura. Solo cambia
texto, cortes 9:16, antetítulo y subtítulo; el resto de los parámetros del beat
(acento, parpadeo, tiempos) es del diseño y no se toca.

Si la intro cambió, los renders del video quedan viejos (tienen el cartel
anterior) y el grabador los reutilizaría: se borran para que se vuelvan a grabar.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from src.core.explainer.publishing.package import Intro

# Componentes de apertura y si dibujan subtítulo (designs/<d>/components/*.js).
TITLE_COMPONENTS: dict[str, bool] = {"rough.title": True, "binary.title": False}


class IntroError(ValueError):
    """La intro no se puede aplicar a este video (storyboard o componente inesperado)."""


@dataclass
class IntroResult:
    changed: bool
    removed_renders: list[str] = field(default_factory=list)


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_intro(video_dir: Path, intro: Intro) -> IntroResult:
    storyboard_path = video_dir / "assets" / "storyboard.json"
    script_path = video_dir / "assets" / "script.json"
    storyboard, script = _read(storyboard_path), _read(script_path)

    beats = storyboard.get("beats") or []
    if not beats or beats[0].get("t") != 0:
        raise IntroError(f"{video_dir.name}: el storyboard no empieza con un beat en t=0")
    opening = beats[0]
    component = opening.get("use")
    if component not in TITLE_COMPONENTS:
        raise IntroError(f"{video_dir.name}: el beat 0 usa «{component}», no un cartel de apertura conocido")
    if intro.sub and not TITLE_COMPONENTS[component]:
        raise IntroError(f"{video_dir.name}: {component} no dibuja subtítulo; dejar intro.sub vacío")

    params = dict(opening.get("params") or {})
    params["text"] = "\n".join(intro.lines)
    params["textPortrait"] = "\n".join(intro.lines_portrait or intro.lines)
    params["kicker"] = intro.kicker
    if TITLE_COMPONENTS[component]:
        params["sub"] = intro.sub
    changed = params != opening.get("params")

    new_script = {**script, "title": intro.text, "kicker": intro.kicker, "subtitle": intro.sub}
    changed = changed or new_script != script
    if not changed:
        return IntroResult(changed=False)

    opening["params"] = params
    _write(storyboard_path, storyboard)
    _write(script_path, new_script)

    render_dir = video_dir / "render"
    stale = sorted(render_dir.glob("*.mp4")) + sorted((render_dir / "preview").glob("*.mp4"))
    for path in stale:
        path.unlink()
    return IntroResult(changed=True, removed_renders=[str(p.relative_to(video_dir)) for p in stale])
