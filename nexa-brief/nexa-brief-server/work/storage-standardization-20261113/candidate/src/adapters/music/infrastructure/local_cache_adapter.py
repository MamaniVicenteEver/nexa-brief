"""Local music cache adapter — elige un .mp3 al azar de la categoría {genre} de la librería."""

from __future__ import annotations

import random
import shutil
from pathlib import Path

import structlog

from src.config.exceptions import MusicFetchError
from src.core.data import files
from src.core.ports.music_port import MusicPort

logger = structlog.get_logger(__name__)


class LocalCacheAdapter(MusicPort):
    async def get(self, genre: str, dest_path: Path) -> Path:
        storage = files("music")
        keys = storage.list_keys(genre.lower(), suffix=".mp3")
        if not keys:
            raise MusicFetchError(f"Local cache: no .mp3 files for genre '{genre}'")

        chosen = storage.local_path(random.choice(keys))
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(chosen, dest_path)
        logger.info("local_music_selected", track=chosen.name, genre=genre)
        return dest_path
