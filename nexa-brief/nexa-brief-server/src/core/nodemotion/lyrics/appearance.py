"""Apply a lyric draft's visual settings without regenerating its media."""
from __future__ import annotations

import copy
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from src.core.draft_details import song_of
from src.core.job import Job

LYRIC_BACKGROUNDS = frozenset({"lyrics-impact", "lyrics-romantic", "lyrics-suave", "lyrics-triste"})
_OUTRO_FACTORS = {"lyrics-impact": 1, "lyrics-romantic": 0.5, "lyrics-suave": 0.12, "lyrics-triste": 0.1}


def _active(config: dict[str, Any]) -> dict[str, Any]:
    cases = config.get("configs")
    if not isinstance(cases, list):
        return config
    active_id = config.get("activeId")
    return next((v for v in cases if isinstance(v, dict) and v.get("id") == active_id), {})


def ensure_intro_title(config: dict[str, Any], job: Job, template_id: str) -> bool:
    """Complete an empty Impact intro with the selected song's known title."""
    if template_id != "lyrics-impact":
        return False
    case = _active(config)
    intro = case.get("intro")
    if not isinstance(intro, dict):
        intro = {}
        case["intro"] = intro
    if any(str(intro.get(key) or "").strip() for key in ("songTitle", "title", "trackTitle")):
        return False
    title, _ = song_of(job)
    intro["title"] = title or "Canción"
    return True


def _atomic_text(path: Path, content: str) -> None:
    fd, tmp = tempfile.mkstemp(prefix=".nexa-appearance-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(tmp, path.stat().st_mode & 0o777)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def prepare_render_appearance(job: Job, template_id: str, opacity: float | None) -> Job:
    """Persist the browser choice into the exact configuration the recorder consumes."""
    if template_id not in LYRIC_BACKGROUNDS:
        return job
    path = job.artifacts.config_json_path
    if path is None:
        if opacity is not None:
            raise ValueError("No existe la configuración del prototipo para aplicar el fondo")
        return job
    path = Path(path).resolve()
    output = Path(job.artifacts.output_dir).resolve()
    if not path.is_relative_to(output) or not path.is_file():
        raise ValueError("Configuración del prototipo fuera de su carpeta")
    config = json.loads(path.read_text(encoding="utf-8"))
    changed = ensure_intro_title(config, job, template_id)
    case = _active(config)
    if opacity is not None:
        bg = case.get("bg")
        if not isinstance(bg, dict):
            raise ValueError("El prototipo no tiene fondo configurable")
        bg["opacity"] = opacity
        changed = True
        from src.core.nodemotion.service import load_project
        project = load_project(output)
        if project:
            # Store only the existing appearance choice; apply it to assembled HTML.
            appearance_path = output / "appearance.json"
            appearance_path.write_text(json.dumps({"template_id": template_id, "opacity": opacity}), encoding="utf-8")
        else:
            html_path = Path(job.artifacts.html_path).resolve()
            if not html_path.is_relative_to(output) or not html_path.is_file():
                raise ValueError("HTML del prototipo fuera de su carpeta")
            html = html_path.read_text(encoding="utf-8")
            new_html = apply_appearance(html, {"template_id": template_id, "opacity": opacity})
            if new_html != html:
                _atomic_text(html_path, new_html)
    if not changed:
        return job
    _atomic_text(path, json.dumps(config, indent=2, ensure_ascii=False) + "\n")
    artifacts = job.artifacts.model_copy(update={"template_config": copy.deepcopy(case)})
    return job.model_copy(update={"artifacts": artifacts})


def apply_appearance(html: str, appearance: dict[str, Any]) -> str:
    """Apply the same legacy visibility override to a resolved document."""
    template_id = appearance.get("template_id")
    opacity = appearance.get("opacity")
    if template_id not in LYRIC_BACKGROUNDS or opacity is None or "--custom-bg-opacity" in html:
        return html
    opacity = float(opacity)
    if not 0 <= opacity <= 1:
        raise ValueError("Invalid background opacity")
    factor = _OUTRO_FACTORS[template_id]
    block = (f'<style id="nexa-render-visibility">#bgMedia{{opacity:{opacity}!important;filter:none!important}}'
             f'body.outroActive #bgMedia{{opacity:{opacity * factor}!important}}'
             ':is(#darkTint,#warmTint,#coldTint){opacity:.25!important}#vignette{opacity:.35!important}</style>')
    if '<style id="nexa-render-visibility">' in html:
        return re.sub(r'<style id="nexa-render-visibility">.*?</style>', lambda _: block, html, count=1, flags=re.S)
    return re.sub(r'</head\s*>', lambda match: block + match.group(0), html, count=1, flags=re.I)
