import json
import os
import re
import sys
import time
from pathlib import Path

import yt_dlp


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "music"
JSON_FILE = BASE_DIR / "songs.json"

AUDIO_FORMAT = "mp3"
AUDIO_QUALITY = "192"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# HELPERS
# ============================================================

def sanitize_filename(name: str) -> str:
    """
    Remove characters that can cause problems in filenames.
    """

    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', ' ', name)
    name = name.strip()

    return name


def load_songs():
    if not JSON_FILE.exists():
        print(f"ERROR: No existe {JSON_FILE}")
        sys.exit(1)

    with open(JSON_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        print("ERROR: songs.json debe contener una lista.")
        sys.exit(1)

    return data


def is_direct_youtube_url(url: str) -> bool:
    """
    Accept only direct YouTube watch URLs.
    """

    return (
        "youtube.com/watch?v=" in url
        or "youtu.be/" in url
    )


# ============================================================
# DOWNLOAD
# ============================================================

def download_song(song, index, total):

    folder = sanitize_filename(song["folder"])
    artist = sanitize_filename(song["artist"])
    title = sanitize_filename(song["title"])
    url = song["url"]

    folder_path = OUTPUT_DIR / folder
    folder_path.mkdir(parents=True, exist_ok=True)

    filename = f"{artist} - {title}"

    output_template = str(
        folder_path / f"{filename}.%(ext)s"
    )

    print()
    print("=" * 70)
    print(f"[{index}/{total}]")
    print(f"Folder : {folder}")
    print(f"Artist : {artist}")
    print(f"Title  : {title}")
    print("=" * 70)

    if not is_direct_youtube_url(url):

        print()
        print("SKIPPED")
        print("La URL no es un video directo de YouTube.")
        print(f"URL: {url}")
        print()
        return False

    ydl_opts = {
        # Audio only
        "format": "bestaudio/best",

        # Output
        "outtmpl": output_template,

        # Do not download video
        "noplaylist": True,

        # Don't overwrite existing files
        "overwrites": False,

        # Audio extraction
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": AUDIO_FORMAT,
                "preferredquality": AUDIO_QUALITY,
            }
        ],

        # Metadata
        "postprocessor_args": [
            "-metadata",
            f"artist={artist}",
            "-metadata",
            f"title={title}",
        ],

        # Quiet but useful output
        "quiet": False,
        "no_warnings": False,

        # Continue when possible
        "ignoreerrors": True,
    }

    try:

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:

            result = ydl.download([url])

            if result == 0:
                print()
                print("✓ DOWNLOAD COMPLETE")
                return True

            print()
            print("⚠ DOWNLOAD FINISHED WITH WARNINGS")
            return False

    except Exception as error:

        print()
        print("✗ ERROR")
        print(error)

        return False


# ============================================================
# MAIN
# ============================================================

def main():

    songs = load_songs()

    total = len(songs)

    print()
    print("=" * 70)
    print("MUSIC DOWNLOADER")
    print("=" * 70)
    print(f"Songs: {total}")
    print(f"Output: {OUTPUT_DIR}")
    print("=" * 70)

    successful = 0
    failed = 0

    for index, song in enumerate(songs, start=1):

        success = download_song(
            song,
            index,
            total
        )

        if success:
            successful += 1
        else:
            failed += 1

        # Small pause between downloads
        time.sleep(1)

    print()
    print("=" * 70)
    print("DOWNLOAD SUMMARY")
    print("=" * 70)

    print(f"Total      : {total}")
    print(f"Successful : {successful}")
    print(f"Failed     : {failed}")

    print()
    print(f"Files saved in:")
    print(OUTPUT_DIR)

    print("=" * 70)


if __name__ == "__main__":
    main()