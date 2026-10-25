"""Composición en Markdown del brief de una idea y sus referencias cercanas."""

from __future__ import annotations

import json
import subprocess
from datetime import date
from pathlib import Path
from urllib.parse import quote

from src.config.settings import settings
from src.core.prototypes.ideas import Idea, get_idea

PROTOTIPO_URL_PATH = "/api/v1/agent/prototipo"


def _read_info(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _similar_templates(idea: Idea, templates_dir: Path) -> list[tuple[str, dict]]:
    sandbox = templates_dir / "sandbox"
    candidates: list[tuple[int, str, dict]] = []
    if not sandbox.is_dir():
        return []
    for category_dir in sandbox.iterdir():
        if not category_dir.is_dir() or category_dir.name.startswith(("_", ".")) or category_dir.name == "referencias":
            continue
        same_category = category_dir.name == idea.category
        for item_dir in category_dir.iterdir():
            info_path = item_dir / "info.json"
            if not item_dir.is_dir() or not info_path.is_file():
                continue
            info = _read_info(info_path)
            if not info:
                continue
            candidates.append(
                (
                    0 if same_category else 1,
                    item_dir.name.casefold(),
                    info | {"_category": category_dir.name, "_id": item_dir.name},
                )
            )
    candidates.sort(key=lambda candidate: (candidate[0], candidate[1]))
    return [(candidate[2]["_id"], candidate[2]) for candidate in candidates[:3]]


def _video_metadata(path: Path) -> str:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=codec_type,width,height",
                "-of",
                "json",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=12,
        )
        data = json.loads(completed.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return "duración/resolución no disponibles (ffprobe no pudo leer el archivo)"
    video_stream = next(
        (stream for stream in data.get("streams", []) if stream.get("codec_type") == "video"),
        {},
    )
    width, height = video_stream.get("width"), video_stream.get("height")
    duration_raw = data.get("format", {}).get("duration")
    try:
        duration = float(duration_raw)
        duration_text = f"{duration:.1f} s"
    except (TypeError, ValueError):
        duration_text = "duración desconocida"
    resolution = f"{width}×{height}" if width and height else "resolución desconocida"
    return f"duración {duration_text}; resolución {resolution}"


def _notes_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _template_section(idea: Idea, templates_dir: Path) -> str:
    similar = _similar_templates(idea, templates_dir)
    if not similar:
        return "## Plantillas parecidas\n\nNo hay plantillas con `info.json` para sugerir todavía."
    lines = ["## Plantillas parecidas", ""]
    for template_id, info in similar:
        lines.extend(
            [
                f"### `{template_id}`",
                f"- Categoría: `{info.get('_category', '')}`",
                f"- Engine: {info.get('engine') or 'sin indicar'}",
                f"- Based on: {info.get('based_on') or 'ninguna'}",
                f"- Summary: {info.get('summary') or 'sin resumen'}",
            ]
        )
        notes = _notes_list(info.get("notes"))
        if notes:
            lines.append("- Notes:")
            lines.extend(f"  - {note}" for note in notes)
        else:
            lines.append("- Notes: sin notas")
        lines.append("")
    return "\n".join(lines).rstrip()


def compose_brief(
    category: str,
    idea_slug: str,
    *,
    templates_dir: Path | None = None,
    today: date | None = None,
) -> str:
    """Compone y guarda `BRIEF.md` con notas, archivos y plantillas similares."""
    root = (templates_dir or settings.templates_dir).resolve()
    idea = get_idea(category, idea_slug, templates_dir=root)
    public_base = settings.public_base_url.rstrip("/")
    date_label = (today or date.today()).isoformat()
    lines = [
        f"# Brief de la idea «{idea.title}»",
        "",
        f"- Categoría: `{idea.category}`",
        f"- ID: `{idea.slug}`",
        "- Modo: prototipo nuevo basado en una referencia",
        f"- Fecha: {date_label}",
        "",
        "## Notas del usuario",
        "",
        idea.notes.strip() or "Sin notas adicionales.",
        "",
        "## Archivos de referencia",
        "",
    ]
    if idea.files:
        for attached in idea.files:
            relative = attached.path.relative_to(root).as_posix()
            encoded_path = "/".join(quote(part, safe="") for part in relative.split("/"))
            url = f"{PROTOTIPO_URL_PATH.replace('/agent/prototipo', '/explainer/files')}/{encoded_path}"
            metadata = f"; {_video_metadata(attached.path)}" if attached.is_video else ""
            lines.extend(
                [
                    f"### `{attached.name}`",
                    f"- Ruta en disco: `{attached.path.resolve()}`",
                    f"- URL: {public_base}{url}{metadata}",
                    "",
                ]
            )
    else:
        lines.append("No se adjuntaron archivos.")
        lines.append("")

    lines.extend(
        [
            _template_section(idea, root),
            "",
            "## Instrucciones",
            "",
            f"Seguí [PROTOTIPO.md]({public_base}{PROTOTIPO_URL_PATH}) (URL pública + ruta).",
            f"- Ruta local: `{(root / 'sandbox' / 'PROTOTIPO.md').resolve()}`",
            "- Ruta SSH: `alfred-server:~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/sandbox/PROTOTIPO.md`",
            "",
        ]
    )
    brief = "\n".join(lines).rstrip() + "\n"
    (idea.path / "BRIEF.md").write_text(brief, encoding="utf-8")
    return brief
