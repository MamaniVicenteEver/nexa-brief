"""Checks de la narrativa que corre el servidor (`publishing check`).

La forma del guion y del storyboard (orden de actos, intensidad de apertura, beat de la pregunta) la
valida el kit al producir: `explainer-kit/tools/narrative_check.py`, llamado por `kit.py check`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import structlog

from src.core.explainer.narrative.errors import NarrativeError
from src.core.explainer.narrative.service import get_service
from src.core.explainer.narrative.video import recorded

logger = structlog.get_logger(__name__)


def _norm(text: str) -> list[str]:
    return re.findall(r"\w+", text.casefold())


def first_question(text: str) -> str:
    match = re.search(r"¿[^?]*\?", text)
    return match.group(0) if match else ""


def screen_question(video_dir: Path, act: str) -> str:
    try:
        script = json.loads((video_dir / "assets" / "script.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    for segment in script.get("segments", []):
        if segment.get("act") == act and segment.get("on_screen_question"):
            return str(segment["on_screen_question"]).strip()
    return ""


def pinned_question_issue(video_dir: Path, pinned: str) -> str | None:
    """Mensaje de error si el comentario fijado no repite la pregunta del video; None si está bien."""
    narrative_id = recorded(video_dir).narrative_id
    if not narrative_id:
        return None
    try:
        narrative = get_service().get(narrative_id)
    except NarrativeError as exc:
        logger.warning("narrative_check_skipped", video=video_dir.name, **exc.context())
        return f"no se pudo validar la narrativa del video: {exc}"
    if not narrative.checks.pinned_repeats_question or narrative.question is None:
        return None
    question = screen_question(video_dir, narrative.question.act)
    if not question:
        return f"falta on_screen_question en el acto '{narrative.question.act}' de script.json"
    if _norm(first_question(pinned)) != _norm(question):
        return f"la primera pregunta tiene que repetir la del video: «{question}»"
    return None
