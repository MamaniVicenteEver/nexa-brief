"""Preview the publishable copy for a song without running the video pipeline.

Simulates what result_summarizer does at the end of a job: builds the song
facts, asks the AI once (plus one retry if a rule was broken) and renders every
platform with the chosen strategies. Nothing is published or saved.

Examples:
  uv run python scripts/preview_copy.py \\
      --lyrics src/templates/LYRICS-carta-de-amor/assets/lyrics-bruses-dueles-tan-bien.json \\
      --track-name "Bruses Dueles Tan Bien Audio"

  # try other strategies without touching active.json
  uv run python scripts/preview_copy.py --lyrics ... --track-name ... \\
      --strategy youtube=yt_search_exact_v1 --strategy youtube=yt_song_truth_v1

  uv run python scripts/preview_copy.py --list
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config.niche_config import get_niche_config  # noqa: E402
from src.core.job import Job, JobArtifacts, JobInput, SongInfo  # noqa: E402
from src.core.metadata import active_strategies, language_from_lyrics, list_strategies, normalize_language  # noqa: E402
from src.modules.copy_writer import build_facts, write_copy  # noqa: E402


def _ai(name: str):
    from src.adapters.ai.factory import get_analysis_ai, get_codegen_ai

    return get_codegen_ai() if name == "deepseek" else get_analysis_ai()


def _print_copy(platform: str, copy) -> None:
    print(f"\n── {platform.upper()} · {copy.strategy_id} " + "─" * 30)
    print(f"TÍTULO:\n{copy.title}\n")
    if copy.description != copy.title:
        print(f"DESCRIPCIÓN:\n{copy.description}\n")
    print(f"TAGS: {', '.join(copy.tags)}")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lyrics", type=Path, help="Whisper lyrics JSON (segments + metadata.language)")
    parser.add_argument("--track-name", default="", help="Audio file / catalog name, noise allowed")
    parser.add_argument("--artist", default=None, help="Known artist (as if typed in the form)")
    parser.add_argument("--song", default=None, help="Known song name (as if typed in the form)")
    parser.add_argument("--language", default=None, help="es | en (default: from lyrics)")
    parser.add_argument("--niche", default="lyrics_video_romantic")
    parser.add_argument("--strategy", action="append", default=[], help="platform=strategy_id (repeatable)")
    parser.add_argument("--ai", choices=["gemini", "deepseek"], default="gemini")
    parser.add_argument("--seed", default="preview", help="Changes which rotating phrases are picked")
    parser.add_argument("--show-prompt", action="store_true")
    parser.add_argument("--list", action="store_true", help="List available strategies and exit")
    args = parser.parse_args()

    if args.list:
        active = {p: s.id for p, s in active_strategies().items()}
        for s in list_strategies():
            mark = " (activa)" if active.get(s.platform) == s.id else ""
            print(f"{s.platform:9} {s.id:28} {s.name}{mark}")
        return

    lyrics = json.loads(args.lyrics.read_text(encoding="utf-8")) if args.lyrics else None
    niche = get_niche_config(args.niche)
    song_info = SongInfo(song_name=args.song, artist=args.artist) if (args.song or args.artist) else None
    job = Job(
        input=JobInput(category_name=args.niche, song_info=song_info),
        artifacts=JobArtifacts(lyrics_json=lyrics, music_meta={"track_name": args.track_name} if args.track_name else {}),
    )
    language = normalize_language(args.language) or (
        (language_from_lyrics(lyrics, 0.6).code if language_from_lyrics(lyrics, 0.6) else None) or "es"
    )
    facts = build_facts(job, niche)

    # Each --strategy for the same platform is a separate run, to compare them side by side.
    runs: list[dict[str, str]] = [{}]
    for item in args.strategy:
        platform, strategy_id = item.split("=", 1)
        if platform in runs[-1]:
            runs.append({})
        runs[-1][platform] = strategy_id

    for overrides in runs:
        strategies = active_strategies(overrides)
        result = await write_copy(_ai(args.ai), facts, language, seed=args.seed, strategies=strategies)
        if args.show_prompt:
            print(f"=== SYSTEM ===\n{result.system_prompt}\n\n=== USER ===\n{result.user_prompt}")
        print(f"\nIdioma: {language} · Artista: {result.pieces.artist} · Canción: {result.pieces.song}")
        if result.unresolved_errors:
            print(f"Reglas incumplidas tras reintentar: {result.unresolved_errors}")
        for platform, copy in result.copies.items():
            _print_copy(platform, copy)


if __name__ == "__main__":
    asyncio.run(main())
