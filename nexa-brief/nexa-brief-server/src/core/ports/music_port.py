"""Music Port — abstract contract for audio track providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MusicFetchResult:
    """Rich result returned by every music adapter."""
    path: Path
    provider: str
    track_name: str = ""
    artist: str = ""
    genre: str = ""
    track_id: str = ""
    duration: int = 0
    url: str = ""


class MusicPort(ABC):
    """Fetch an audio track for the given genre."""

    @abstractmethod
    async def get(self, genre: str, dest_path: Path) -> MusicFetchResult:
        """Download an audio track and save it to *dest_path*.

        Returns a MusicFetchResult with the path and rich metadata.
        Raises MusicFetchError if the source is unavailable or returns no results.
        """
