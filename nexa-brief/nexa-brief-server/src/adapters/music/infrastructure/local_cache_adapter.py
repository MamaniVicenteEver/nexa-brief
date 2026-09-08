"""Local music cache adapter — searches data/music_library/{genre}/ for .mp3 files."""

from __future__ import annotations

import random
import shutil
from pathlib import Path

import structlog

from src.config.exceptions import MusicFetchError
from src.config.settings import settings
from src.core.ports.music_port import MusicPort

logger = structlog.get_logger(__name__)


class LocalCacheAdapter(MusicPort):
    async def get(self, genre: str, dest_path: Path) -> Path:
        genre_dir = settings.music_library_dir / genre.lower()
        if not genre_dir.exists():
            raise MusicFetchError(f"Local cache: no directory for genre '{genre}'")

        tracks = list(genre_dir.glob("*.mp3"))
        if not tracks:
            raise MusicFetchError(f"Local cache: no .mp3 files in '{genre_dir}'")

        chosen = random.choice(tracks)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(chosen, dest_path)
        logger.info("local_music_selected", track=chosen.name, genre=genre)
        return dest_path
