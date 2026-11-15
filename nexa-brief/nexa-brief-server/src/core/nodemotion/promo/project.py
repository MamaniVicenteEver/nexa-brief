"""Promo projects own their authored timeline independently of music."""
from pathlib import Path
from typing import Any
from src.core.job import Job
from src.core.nodemotion.shared.execution import create_project


class PromoProject:
    def create(self, root: Path, design: str, assets: dict[str, dict[str, Any]],
               job: Job, content_prefix: str) -> dict[str, Any]:
        if job.artifacts.lyrics_json is None:
            raise ValueError("Promo project has no authored timeline")
        return create_project(root, design, assets, timeline=job.artifacts.lyrics_json,
                              content_prefix=content_prefix)
