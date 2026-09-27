#!/usr/bin/env python3
"""Transcribe an existing Explainer upload and persist timed source text."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from src.explainer.models import Transcript, TranscriptSegment  # noqa: E402
from src.explainer.service import ExplainerStore, project_dir  # noqa: E402


CORRECTIONS = {
    "Gene Manfred": "Gene Manford",
    "at the Stonewall the night": "at Stonewall the night",
    "of the race": "of the riots",
    "ran up to her kisser": "ran up to her, kissed her",
    "day by day, low by law": "day by day, law by law",
}


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].isalnum():
        raise SystemExit("Uso: transcribe_editorial_source.py <project_id>")
    project_id = sys.argv[1]
    store = ExplainerStore()
    project = store.get(project_id)
    if not project:
        raise SystemExit(f"Proyecto no encontrado: {project_id}")
    audio_path = project_dir(project_id) / "audio.wav"
    if not audio_path.exists():
        raise SystemExit(f"Audio fuente no encontrado: {audio_path}")

    model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
    speech, _ = model.transcribe(audio_path, language="en", vad_filter=True, beam_size=5)
    segments = []
    for index, item in enumerate(speech):
        text = item.text.strip()
        for before, after in CORRECTIONS.items():
            text = text.replace(before, after)
        segments.append(TranscriptSegment(
            id=index,
            start=round(item.start, 3),
            end=round(item.end, 3),
            text=text,
        ))
    transcript = Transcript(
        language="en",
        provider="faster-whisper",
        model="tiny.en",
        quality="machine-draft",
        text=" ".join(segment.text for segment in segments),
        segments=segments,
        warnings=[
            "Transcripción automática del audio original en inglés; se corrigieron nombres y errores ASR evidentes.",
            "Verificar citas y cifras contra la fuente antes de publicar.",
        ],
    )
    (project_dir(project_id) / "transcript.json").write_text(
        json.dumps(transcript.model_dump(mode="json"), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    project.transcript = transcript
    project.language = "en"
    project.paths["transcript"] = "transcript.json"
    project.warnings = [warning for warning in project.warnings if "transcripción real" not in warning]
    store.put(project)
    print(f"{len(segments)} segmentos; {segments[-1].end:.2f} s; {audio_path}")


if __name__ == "__main__":
    main()
