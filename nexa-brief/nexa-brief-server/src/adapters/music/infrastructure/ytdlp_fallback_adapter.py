"""yt-dlp fallback adapter — last resort for downloading music from YouTube."""

from __future__ import annotations

import asyncio
import random
import re
import shutil
import tempfile
from pathlib import Path

import structlog

from src.config.exceptions import MusicFetchError
from src.core.ports.music_port import MusicFetchResult, MusicPort

logger = structlog.get_logger(__name__)

_GENRE_QUERY_POOL: dict[str, list[str]] = {
    "lofi": [
        "lofi hip hop beats royalty free no copyright 2024",
        "lofi chill beats study music copyright free",
        "lofi jazz beats relax royalty free",
        "lofi hip hop sleep music no copyright",
        "chill lofi beats work from home royalty free",
    ],
    "jazz": [
        "smooth jazz background music royalty free no copyright",
        "jazz cafe music instrumental no copyright",
        "relaxing jazz piano music royalty free",
        "soft jazz lounge music copyright free",
        "jazz background music for video royalty free",
    ],
    "ambient": [
        "ambient relaxing music royalty free no copyright",
        "ambient meditation music copyright free",
        "peaceful ambient soundscape royalty free",
        "ambient drone music no copyright",
        "nature ambient music royalty free 2024",
    ],
    "classical": [
        "classical piano music royalty free no copyright",
        "relaxing classical music copyright free",
        "classical background music instrumental royalty free",
        "baroque classical music no copyright",
        "classical string quartet royalty free",
    ],
    "study": [
        "study focus music instrumental no copyright",
        "concentration music for studying royalty free",
        "deep focus background music copyright free",
        "study beats instrumental royalty free 2024",
        "calm study music piano no copyright",
    ],
    "chillout": [
        "chillout music royalty free no copyright",
        "chill background music copyright free",
        "chillout lounge music royalty free",
    ],
    "instrumental": [
        "instrumental background music royalty free",
        "soft instrumental music no copyright",
        "relaxing instrumental music copyright free",
    ],
}

_DEFAULT_QUERIES = [
    "relaxing background music royalty free no copyright",
    "calm instrumental music copyright free",
]

_MAX_SEARCH_RESULTS = 3
_YTDLP_TIMEOUT_SECONDS = 300


class YtDlpFallbackAdapter(MusicPort):
    """Downloads music from YouTube using yt-dlp with randomised query selection."""

    async def get(self, genre: str, dest_path: Path) -> MusicFetchResult:
        ytdlp_bin = self._find_ytdlp()
        if not ytdlp_bin:
            raise MusicFetchError("yt-dlp is not installed. Run: pip install --user yt-dlp")

        query_pool = _GENRE_QUERY_POOL.get(genre.lower(), _DEFAULT_QUERIES)
        query = random.choice(query_pool)
        search_url = f"ytsearch{_MAX_SEARCH_RESULTS}:{query}"
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(dir=dest_path.parent, prefix="_yt_tmp_") as tmp_dir:
            output_template = str(Path(tmp_dir) / "%(autonumber)s_%(title)s.%(ext)s")
            cmd = [
                ytdlp_bin,
                "--extract-audio",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                "--output", output_template,
                "--no-playlist",
                "--quiet",
                "--no-warnings",
                "--ignore-errors",
                search_url,
            ]
            logger.info("ytdlp_download_start", query=query, max_results=_MAX_SEARCH_RESULTS, genre=genre)
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=_YTDLP_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                proc.kill()
                raise MusicFetchError(f"yt-dlp timed out after {_YTDLP_TIMEOUT_SECONDS}s")

            mp3_files = sorted(Path(tmp_dir).glob("*.mp3"))
            if not mp3_files:
                err = stderr.decode()[:400] if stderr else "no output"
                raise MusicFetchError(f"yt-dlp: no .mp3 extracted. stderr: {err}")

            chosen = random.choice(mp3_files)
            # Parse title from filename: "001_Track Title Here.mp3"
            raw_name = chosen.stem
            track_name = re.sub(r"^\d+_", "", raw_name).replace("_", " ").strip()
            chosen.rename(dest_path)

        logger.info("ytdlp_download_complete", path=str(dest_path), track_name=track_name)
        return MusicFetchResult(
            path=dest_path,
            provider="youtube",
            track_name=track_name,
            artist="",   # yt-dlp doesn't reliably extract artist without --write-info-json
            genre=genre,
            track_id="",
            duration=0,
            url=f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}",
        )

    @staticmethod
    def _find_ytdlp() -> str | None:
        user_bin = Path.home() / ".local" / "bin" / "yt-dlp"
        if user_bin.exists():
            return str(user_bin)
        return shutil.which("yt-dlp")
