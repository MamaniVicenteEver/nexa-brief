"""Borrar un video de la Biblioteca nunca se lleva la carpeta que usa otro video."""

from __future__ import annotations

import asyncio
from pathlib import Path

from src.config.settings import settings
from src.core.data import collection
from src.modules import video_deletion


def _record(job_id: str, out: Path) -> dict:
    return {"job_id": job_id, "stage": "packaged", "output_dir": str(out), "created_at": "2026-10-14T00:00:00+00:00",
            "updated_at": "2026-10-14T00:00:00+00:00", "file_paths": {}}


def test_shared_output_dir_is_kept_until_its_last_video(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(settings, "output_dir", tmp_path / "output")
    out = tmp_path / "output" / "node_history" / "binary" / "deep-blue"
    out.mkdir(parents=True)
    (out / "deep-blue-16x9.mp4").write_bytes(b"mp4")
    first, second = _record("explainer-deep-blue-aaaa", out), _record("explainer-deep-blue-bbbb", out)

    async def scenario():
        await collection("jobs").insert(first)
        await collection("jobs").insert(second)
        video_deletion._remove_output_dir(second)          # el otro video todavía la usa
        assert (out / "deep-blue-16x9.mp4").exists()
        await collection("jobs").delete("explainer-deep-blue-aaaa")
        video_deletion._remove_output_dir(second)          # ya nadie más: se borra
        assert not out.exists()

    asyncio.run(scenario())
