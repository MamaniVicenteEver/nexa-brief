"""Perfiles de copy (canciones / comerciales), comentario fijado y publish.json de cada plantilla."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.config.niche_config import get_niche_config
from src.core import template_original
from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
from src.core.metadata import active_strategies
from src.core.metadata.copy_renderer import CopyPieces, render_copy
from src.core.metadata.strategies import StrategyError, load_voice
from src.modules.copy_writer import build_facts, copy_profile


def test_profiles_pick_their_own_strategies_and_voice():
    songs = active_strategies()
    promos = active_strategies(profile="commercial")
    assert songs["youtube"].id == "yt_theme_question_v3"
    assert songs["tiktok"].id == "tiktok_hook_question_v2"
    assert {s.id for s in promos.values()} == {
        "yt_commercial_v1", "tiktok_commercial_v1", "facebook_commercial_v1", "instagram_commercial_v1"}
    assert "promos" in load_voice("commercial") and load_voice() != load_voice("commercial")
    with pytest.raises(StrategyError):
        active_strategies(profile="nope")


def test_niche_profile():
    assert copy_profile(get_niche_config("promo_video_editorial")) == "commercial"
    assert copy_profile(get_niche_config("lyrics_video_romantic")) is None


def _render(strategy, fields, song="Dueles Tan Bien", artist="Bruses"):
    pieces = CopyPieces(artist=artist, song=song, platforms={strategy.platform: fields})
    return render_copy(strategy, pieces, "es", seed="job-1")


def test_song_youtube_asks_which_song_for_this_design_and_pins_it():
    yt = active_strategies()["youtube"]
    copy = _render(yt, {
        "theme_question": "¿Por qué volvemos a quien nos hace daño?",
        "song_summary": "Saber que alguien te quita la calma y aun así no poder alejarte.",
        "comment_question": "¿Te pasó alguna vez? Cuéntanos en los comentarios.",
        "hashtags": ["Bruses", "DuelesTanBien", "Desamor"],
        "tags": [f"tag {i}" for i in range(14)],
    })
    assert "este diseño" in copy.description and "plantilla" not in copy.description.lower()
    assert "canción" in copy.pinned_comment and "este diseño" in copy.pinned_comment


def test_commercial_youtube_asks_for_an_event_never_a_song():
    yt = active_strategies(profile="commercial")["youtube"]
    copy = _render(yt, {
        "promo_title": "Promo de una final deportiva: Leones vs Halcones",
        "style_label": "Edición estilo revista",
        "video_summary": "Una final contada como portada de revista.",
        "hashtags": ["PromoDeportiva", "EdicionDeVideo", "MotionGraphics"],
        "tags": [f"tag {i}" for i in range(8)],
    }, song=None, artist=None)
    assert copy.title == "Promo de una final deportiva: Leones vs Halcones | Edición estilo revista"
    assert "evento" in copy.pinned_comment and "canción" not in copy.pinned_comment
    assert "canción" not in copy.description


def test_commercial_facts_describe_a_promo_with_its_on_screen_texts():
    from src.core.job import Job, JobInput

    job = Job(input=JobInput(category_name="promo_video_editorial"))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(
        update={"lyrics_json": {"segments": [{"text": "LEONES VS HALCONES"}]}})})
    facts = build_facts(job, get_niche_config("promo_video_editorial"))
    assert "promo" in facts and "Textos que aparecen en pantalla" in facts and "LEONES" in facts


def test_pinned_comment_reaches_the_summary():
    details = DraftDetails(copies={"youtube": PlatformDetails(title="T", description="D", pinned_comment="¿Con qué canción?")})
    assert to_summary(details).pinned_comment == "¿Con qué canción?"


def test_song_and_lyrics_follow_the_config(tmp_path: Path):
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "Bruses Dueles Tan Bien Audio.mp3").write_bytes(b"x")
    (assets / "lyrics-bruses.json").write_text("{}")
    config = {"audio": {"src": "assets/Bruses Dueles Tan Bien Audio.mp3"}, "lyricsUrl": "assets/lyrics-bruses.json"}
    song, lyrics = template_original.song_and_lyrics(assets, config)
    assert song.name == "Bruses Dueles Tan Bien Audio.mp3" and lyrics.name == "lyrics-bruses.json"
    assert template_original.track_name_of(song) == "Bruses Dueles Tan Bien Audio"
    assert template_original.track_name_of(assets / "song.mp3") == ""


def test_publish_json_roundtrip(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(template_original, "get_template_root", lambda _id: tmp_path)
    details = DraftDetails(song_name="Caution", copies={"youtube": PlatformDetails(title="T", pinned_comment="P")})
    path = template_original.write_publish("lyrics-caution", details, None)
    raw = json.loads(path.read_text())
    assert raw["schema"] == "nodemotion-publish/1" and raw["profile"] == "lyrics"
    assert template_original.read_publish("lyrics-caution").copies["youtube"].pinned_comment == "P"


def test_videos_without_lyrics_use_the_visual_profile():
    from src.modules.copy_writer import copy_profile

    assert copy_profile(get_niche_config("landscape_scene_ambient")) == "visual"
    visual = active_strategies(profile="visual")
    yt = visual["youtube"]
    assert yt.id == "yt_visual_v1"
    assert not any("(Letra)" in t for t in yt.output.title.templates["es"])
    assert not any("Letra de" in t for t in yt.output.description.templates["es"])
    follow = visual["facebook"].rotating["follow_line"]["es"]
    assert not any("con letra" in f for f in follow)


def test_promos_are_written_in_the_channel_language():
    from src.modules.copy_writer import copy_language

    assert copy_language("commercial", "en") == "es"
    assert copy_language(None, "en") == "es"   # canción en inglés: textos en español (el nombre queda igual)
