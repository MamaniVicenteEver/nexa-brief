#!/usr/bin/env python3
"""Regenerate an existing editorial HTML preview without spending TTS credits."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from src.explainer.editorial_recut import apply_emotional_grade, build_editorial_recut_html  # noqa: E402
from src.explainer.service import ExplainerStore, project_dir  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].isalnum():
        raise SystemExit("Uso: rebuild_editorial_preview.py <project_id>")
    project_id = sys.argv[1]
    store = ExplainerStore()
    project = store.get(project_id)
    if not project or not project.editorial_plan:
        raise SystemExit(f"Plan editorial no encontrado: {project_id}")
    directory = project_dir(project_id)
    plan = project.editorial_plan
    analysis_file = directory / "editorial-emotion-analysis.json"
    if analysis_file.exists():
        project.editorial_emotion_analysis = json.loads(analysis_file.read_text(encoding="utf-8"))
    if project.editorial_emotion_analysis:
        plan = apply_emotional_grade(plan, project.editorial_emotion_analysis)
    preview_dir = directory / "preview"
    preview_dir.mkdir(exist_ok=True)
    (directory / "editorial-plan.json").write_text(plan.model_dump_json(indent=2), encoding="utf-8")
    (preview_dir / "editorial-plan.json").write_text(plan.model_dump_json(indent=2), encoding="utf-8")
    (preview_dir / "index.html").write_text(
        build_editorial_recut_html(
            plan,
            video_src="../editorial-source.mp4",
            audio_src="../editorial-narration.wav",
        ),
        encoding="utf-8",
    )
    project.editorial_plan = plan
    store.put(project)
    print(json.dumps({"project_id": project_id, "duration_seconds": plan.duration_seconds, "actions": len(plan.actions)}))


if __name__ == "__main__":
    main()
