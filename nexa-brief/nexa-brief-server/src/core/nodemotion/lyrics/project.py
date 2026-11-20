"""Lyrics projects reference their shared transcription revision."""
from pathlib import Path
from typing import Any
from src.core.job import Job
from src.core.nodemotion.shared.execution import create_project


class LyricsProject:
    def create(self, root: Path, design: str, assets: dict[str, dict[str, Any]],
               job: Job, content_prefix: str) -> dict[str, Any]:
        return create_project(root, design, assets, lyrics_asset_id=job.artifacts.music_asset_id,
                              transcription_data=job.artifacts.lyrics_json,
                              content_prefix=content_prefix)
