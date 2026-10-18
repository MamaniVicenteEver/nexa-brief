"""Cola de silencio para la salida (Gracias · Suscríbete) y la canción que muestra la intro."""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from src.config.niche_config import get_niche_config
from src.core import template_original
from src.core.job import Job, JobInput
from src.modules import resource_fetcher


def test_tail_only_for_templates_with_an_outro():
    assert resource_fetcher._outro_tail_seconds(get_niche_config("lyrics_video_caution")) == 4.0
    assert resource_fetcher._outro_tail_seconds(get_niche_config("promo_video_editorial")) == 0.0


def _duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
def test_tail_pads_only_the_job_copy(tmp_path: Path):
    song = tmp_path / "song.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=duration=2", str(song)], check=True)
    job = Job(input=JobInput(category_name="lyrics_video_caution"))
    asyncio.run(resource_fetcher._add_outro_tail(job, get_niche_config("lyrics_video_caution"), song, tmp_path))
    assert _duration(song) == pytest.approx(6.0, abs=0.15)
    # un archivo fuera de la carpeta del job (la librería) nunca se toca
    other = tmp_path / "lib"
    other.mkdir()
    lib_song = other / "song.mp3"
    shutil.copy(song, lib_song)
    asyncio.run(resource_fetcher._add_outro_tail(job, get_niche_config("lyrics_video_caution"), lib_song, tmp_path))
    assert _duration(lib_song) == pytest.approx(6.0, abs=0.15)


def test_intro_identity_is_clean(tmp_path: Path, monkeypatch):
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "config.json").write_text(json.dumps({"configs": [{"intro": {"artist": "Yasuha · Expediente Nº 084", "title": "Flyday\nChinatown"}}]}))
    monkeypatch.setattr(template_original, "get_template_asset_dir", lambda _id: assets)
    assert template_original.intro_identity("x") == ("Flyday Chinatown", "Yasuha")


def test_intro_shows_the_song_from_details(tmp_path: Path):
    from src.core.draft_details import DraftDetails, apply_to_intro

    (tmp_path / "config.json").write_text(json.dumps({"activeId": "default", "configs": [{"intro": {
        "artist": "Skrxlla", "title": "Caution", "album": "Cold Fashion", "feats": "NODEMOTION"}}]}))
    assert apply_to_intro(tmp_path, DraftDetails(song_name="Fuego Lento", artist="Ana Ruiz"))
    intro = json.loads((tmp_path / "config.json").read_text())["configs"][0]["intro"]
    assert intro == {"artist": "Ana Ruiz", "title": "Fuego Lento", "album": "", "feats": "NODEMOTION"}
    assert not apply_to_intro(tmp_path, DraftDetails(song_name=""))   # sin nombre no se toca
