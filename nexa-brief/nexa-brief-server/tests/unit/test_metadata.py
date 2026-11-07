"""Unit tests for core/metadata (language, sanitize, platform copy) and content_language."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from src.core.job import Job, JobArtifacts, JobInput, SongInfo, VideoSummary
from src.core.metadata import (
    copy_for_platform,
    language_from_lyrics,
    normalize_language,
    pick_from_probabilities,
)
from src.core.metadata.sanitize import clean_hashtags, clean_tags, clean_title, strip_emojis, youtube_tags_length
from src.modules import content_language


# ── language ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    ("value", "expected"),
    [("es", "es"), ("es-MX", "es"), ("Español", "es"), ("spanish", "es"), ("EN", "en"),
     ("en_US", "en"), ("inglés", "en"), ("ja", None), ("", None), (None, None)],
)
def test_normalize_language(value, expected):
    assert normalize_language(value) == expected


def test_language_from_lyrics_requires_supported_and_confident():
    assert language_from_lyrics({"metadata": {"language": "es", "language_probability": 0.97}}, 0.6).code == "es"
    assert language_from_lyrics({"metadata": {"language": "es", "language_probability": 0.3}}, 0.6) is None
    assert language_from_lyrics({"metadata": {"language": "ja", "language_probability": 1}}, 0.6) is None
    assert language_from_lyrics(None, 0.6) is None


def test_pick_from_probabilities():
    assert pick_from_probabilities({"es": 0.7, "en": 0.2}, 0.6).code == "es"
    assert pick_from_probabilities({"es": 0.35, "en": 0.4}, 0.6).code == "en"   # bilingual still resolves
    assert pick_from_probabilities({"es": 0.1, "en": 0.15}, 0.6) is None        # instrumental / other language


# ── sanitize ────────────────────────────────────────────────────────────────

def test_clean_title_strips_forbidden_chars_and_truncates_on_word():
    title = clean_title('"Bruses - Dueles <Tan> Bien (Letra)"')
    assert title == "Bruses - Dueles Tan Bien (Letra)"
    long = clean_title("palabra " * 30, limit=40)
    assert len(long) <= 40 and long.endswith("…")


def test_clean_tags_dedupes_and_respects_youtube_char_budget():
    tags = clean_tags(["#Bruses", "bruses", "dueles tan bien", "letra"] + [f"tag{i}" for i in range(20)])
    assert tags[:3] == ["Bruses", "dueles tan bien", "letra"]
    assert len(tags) <= 15
    budget = clean_tags(["x" * 60] * 1 + [f"{'y' * 60}{i}" for i in range(10)], max_chars=200)
    assert sum(len(t) for t in budget) + len(budget) - 1 <= 200


def test_youtube_tags_length_counts_quotes_of_multi_word_tags_and_commas():
    assert youtube_tags_length([]) == 0
    assert youtube_tags_length(["NASA"]) == 4
    assert youtube_tags_length(["Apolo 11", "NASA"]) == (8 + 2) + 1 + 4
    budget = clean_tags([f"palabra {i:02d}" for i in range(15)], max_chars=40)
    assert youtube_tags_length(budget) <= 40 < youtube_tags_length(budget + ["palabra 99"])


def test_clean_hashtags_removes_hash_spaces_and_limits():
    assert clean_hashtags(["#Música Romántica", "letra", "#letra", "a", "b", "c", "d"]) == [
        "MúsicaRomántica", "letra", "a", "b", "c", "d"
    ]


def test_strip_emojis_keeps_spanish_punctuation():
    assert strip_emojis("¿Te pasó? 💔🔥 Cuéntanos 👇") == "¿Te pasó? Cuéntanos"
    assert strip_emojis("Canción – Artista") == "Canción – Artista"


def test_strip_emojis_turns_a_sentence_break_into_a_period():
    assert strip_emojis("Casi aborta el Apolo 11 🚀 Y la mujer lo previó.") == "Casi aborta el Apolo 11. Y la mujer lo previó."
    assert strip_emojis("Ariane 5 🚀 ¿Sabías esto?") == "Ariane 5. ¿Sabías esto?"
    assert strip_emojis("una idea 🔥 brillante") == "una idea brillante"


# ── platform copy ───────────────────────────────────────────────────────────

def test_copy_for_platform_from_model_and_dict():
    summary = VideoSummary(
        youtube_title="YT", youtube_description="desc", youtube_tags=["t"],
        tiktok_caption="cap", tiktok_hashtags=["h"], language="en",
    )
    yt = copy_for_platform(summary, "youtube")
    assert (yt.title, yt.description, yt.tags, yt.language) == ("YT", "desc", ["t"], "en")
    tt = copy_for_platform(summary.model_dump(), "tiktok")
    assert (tt.title, tt.description, tt.tags) == ("cap", "cap", ["h"])
    assert copy_for_platform(summary, "facebook").title == "YT"
    assert copy_for_platform({"youtube_title": "old"}, "youtube").language is None  # summaries before this field


def test_copy_for_platform_prefers_platform_copies():
    summary = {
        "youtube_title": "YT", "youtube_description": "d", "youtube_tags": [], "language": "es",
        "platform_copies": {"facebook": {"title": "Hook.", "description": "¿Quién?", "tags": ["Tag"], "strategy": "fb_v1"}},
    }
    fb = copy_for_platform(summary, "facebook")
    assert (fb.title, fb.description, fb.tags) == ("Hook.", "¿Quién?", ["Tag"])
    assert copy_for_platform(summary, "youtube").title == "YT"   # no copy for youtube → legacy fields


# ── content_language (job-level resolution) ─────────────────────────────────

def _job(tmp_path: Path, *, song_language=None, lyrics=None, music=True) -> Job:
    music_path = tmp_path / "song.mp3"
    if music:
        music_path.write_bytes(b"fake")
    return Job(
        input=JobInput(category_name="x", song_info=SongInfo(language=song_language) if song_language else None),
        artifacts=JobArtifacts(lyrics_json=lyrics, music_path=music_path if music else None),
    )


@pytest.fixture
def detector(monkeypatch):
    fake = AsyncMock()
    fake.detect_language = AsyncMock(return_value={"es": 0.1, "en": 0.8})
    monkeypatch.setattr(content_language, "get_lyrics_transcriber", lambda: fake)
    monkeypatch.setattr(content_language.settings, "metadata_default_language", "en")
    monkeypatch.setattr(content_language.settings, "metadata_detect_audio_language", True)
    return fake


async def test_user_language_wins(tmp_path, detector):
    resolved = await content_language.resolve_content_language(_job(tmp_path, song_language="Español"))
    assert (resolved.code, resolved.source) == ("es", "user")
    detector.detect_language.assert_not_called()


async def test_lyrics_language_used_without_listening_again(tmp_path, detector):
    lyrics = {"metadata": {"language": "es", "language_probability": 0.99}, "segments": []}
    resolved = await content_language.resolve_content_language(_job(tmp_path, lyrics=lyrics))
    assert (resolved.code, resolved.source) == ("es", "lyrics")
    detector.detect_language.assert_not_called()


async def test_unsupported_lyrics_language_falls_back_to_default(tmp_path, detector):
    lyrics = {"metadata": {"language": "ja", "language_probability": 1}, "segments": []}
    resolved = await content_language.resolve_content_language(_job(tmp_path, lyrics=lyrics))
    assert (resolved.code, resolved.source) == ("en", "default")


async def test_audio_detection_for_non_lyrics_niches(tmp_path, detector):
    resolved = await content_language.resolve_content_language(_job(tmp_path))
    assert (resolved.code, resolved.source) == ("en", "audio")


async def test_detection_failure_never_breaks_the_job(tmp_path, detector):
    detector.detect_language.side_effect = RuntimeError("model missing")
    resolved = await content_language.resolve_content_language(_job(tmp_path))
    assert (resolved.code, resolved.source) == ("en", "default")
