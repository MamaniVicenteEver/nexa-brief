"""Contract for project families sharing execution and resource resolution."""
from pathlib import Path
from typing import Any, Protocol
from src.core.job import Job


class ProjectStrategy(Protocol):
    def create(self, root: Path, design: str, assets: dict[str, dict[str, Any]],
               job: Job, content_prefix: str) -> dict[str, Any]: ...
