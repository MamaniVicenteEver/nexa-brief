"""Unit tests for copy strategies: loading, prompt building, piece validation and rendering."""

from __future__ import annotations

import json

import pytest

from src.core.metadata import (
    StrategyError,
    active_strategies,
    build_copy_prompt,
    list_strategies,
    load_strategy,
    parse_pieces,
    render_copy,
)
from src.core.metadata.copy_renderer import CopyPieces
from src.core.metadata.strategies import CopyStrategy


def _yt_raw(**overrides):
    youtube = {
        "theme_question": "¿Cómo se suelta a quien todavía quieres?",
        "song_summary": "Alguien que sabe que le hace mal quedarse, y se queda.",
        "comment_question": "¿Te ha pasado? Cuéntanos en los comentarios.",
        "hashtags": ["Bruses", "DuelesTanBien", "Desamor"],
        "tags": [f"tag {i}" for i in range(15)],
    }
    youtube.update(overrides)
    return {"artist": "Bruses", "song": "Dueles Tan Bien", "youtube": youtube}


# ── repo strategies ─────────────────────────────────────────────────────────

def test_every_strategy_in_repo_is_valid_and_active_ones_match_platform():
    strategies = list_strategies()
    assert {s.id for s in strategies} >= {"yt_theme_question_v1", "yt_search_exact_v1", "yt_song_truth_v1"}
    for platform, strategy in active_strategies().items():
        assert strategy.platform == platform


def test_override_switches_strategy_without_touching_active_json():
    assert active_strategies({"youtube": "yt_search_exact_v1"})["youtube"].id == "yt_search_exact_v1"
    with pytest.raises(StrategyError):
        active_strategies({"youtube": "tiktok_hook_question_v1"})   # wrong platform
    with pytest.raises(StrategyError):
        load_strategy("does_not_exist_v9")


def test_strategy_with_unknown_placeholder_is_rejected():
    data = json.loads(json.dumps(load_strategy("yt_search_exact_v1").model_dump(by_alias=True)))
    data["output"]["title"]["templates"]["es"] = ["{mystery} (Letra)"]
    with pytest.raises(ValueError, match="unknown placeholders"):
        CopyStrategy.model_validate(data)


# ── prompt ──────────────────────────────────────────────────────────────────

def test_prompt_is_generated_from_strategy_fields():
    strategies = {"youtube": load_strategy("yt_theme_question_v1")}
    system, user = build_copy_prompt(strategies, "Letra: …", "es")
    assert "Emojis" in system                 # voice guide included
    assert "theme_question" in user and "máximo 60 caracteres" in user
    assert '"youtube"' in user and "IDIOMA OBLIGATORIO: español" in user


# ── parsing ─────────────────────────────────────────────────────────────────

def test_parse_pieces_reports_broken_rules_and_strips_emojis():
    strategies = {"youtube": load_strategy("yt_theme_question_v1")}
    raw = _yt_raw(theme_question="x" * 80, hashtags=["A"], song_summary="Duele 💔")
    pieces, errors = parse_pieces(raw, strategies)
    assert any("theme_question tiene 80 caracteres" in e for e in errors)
    assert any("hashtags tiene 1 elementos" in e for e in errors)
    assert pieces.platforms["youtube"]["song_summary"] == "Duele"
    _, missing = parse_pieces({"artist": "X"}, strategies)
    assert "falta la sección 'youtube'" in missing


# ── rendering ───────────────────────────────────────────────────────────────

def test_render_youtube_t2_full():
    strategy = load_strategy("yt_theme_question_v1")
    pieces, errors = parse_pieces(_yt_raw(), {"youtube": strategy})
    assert errors == []
    copy = render_copy(strategy, pieces, "es", seed="job-1")
    assert copy.title == "¿Cómo se suelta a quien todavía quieres? | Bruses (Letra)"
    assert copy.description.startswith('Letra de "Dueles Tan Bien" de Bruses.\n')
    assert "CRÉDITOS\nCanción: Dueles Tan Bien\nArtista: Bruses" in copy.description
    assert copy.description.endswith("#Bruses #DuelesTanBien #Desamor")
    assert any(line in copy.description for line in strategy.rotating["subscribe_line"]["es"])
    assert copy.strategy_id == "yt_theme_question_v1" and len(copy.tags) == 15


def test_render_youtube_t2_v2_starts_with_summary_and_moves_lyrics_line_down():
    strategy = load_strategy("yt_theme_question_v2")
    pieces, errors = parse_pieces(_yt_raw(), {"youtube": strategy})
    assert errors == []
    description = render_copy(strategy, pieces, "es", seed="job-1").description
    assert description.startswith("Alguien que sabe que le hace mal quedarse, y se queda.\n\n")
    assert description.index("¿Te ha pasado?") < description.index('Letra de "Dueles Tan Bien" de Bruses.')
    assert description.index('Letra de "Dueles Tan Bien"') < description.index("CRÉDITOS")


def test_render_falls_back_when_artist_unknown():
    strategy = load_strategy("yt_theme_question_v1")
    pieces, _ = parse_pieces({**_yt_raw(), "artist": None}, {"youtube": strategy})
    copy = render_copy(strategy, pieces, "es", seed="job-1")
    assert copy.title == "¿Cómo se suelta a quien todavía quieres? | Dueles Tan Bien (Letra)"
    assert "Artista:" not in copy.description


def test_rotating_phrase_is_stable_per_job_and_varies_between_jobs():
    strategy = load_strategy("yt_theme_question_v1")
    pieces, _ = parse_pieces(_yt_raw(), {"youtube": strategy})
    same = {render_copy(strategy, pieces, "es", seed="job-1").description for _ in range(3)}
    assert len(same) == 1
    many = {render_copy(strategy, pieces, "es", seed=f"job-{i}").description for i in range(30)}
    assert len(many) > 1


def test_tiktok_caption_keeps_its_line_break_and_facebook_splits_hook():
    tiktok, facebook = load_strategy("tiktok_hook_question_v1"), load_strategy("facebook_hook_question_v1")
    raw = {
        "artist": "Bruses", "song": "Dueles Tan Bien",
        "tiktok": {"hook_statement": "Sabes que te rompe y te quedas.", "memory_question": "¿Quién te vino a la mente?",
                   "hashtags": ["bruses", "duelestanbien", "desamor", "letras"]},
        "facebook": {"hook_statement": "Hay amores que intoxican.", "memory_question": "¿A quién se la mandarías?",
                     "hashtags": ["Bruses", "DuelesTanBien", "Desamor"]},
    }
    pieces, errors = parse_pieces(raw, {"tiktok": tiktok, "facebook": facebook})
    assert errors == []
    tt = render_copy(tiktok, pieces, "es", seed="s")
    assert tt.title == "Sabes que te rompe y te quedas. ¿Quién te vino a la mente?\nDueles Tan Bien – Bruses"
    assert tt.description == tt.title and tt.tags == ["bruses", "duelestanbien", "desamor", "letras"]
    fb = render_copy(facebook, pieces, "es", seed="s")
    assert fb.title == "Hay amores que intoxican."
    assert fb.description.startswith("¿A quién se la mandarías?\nDueles Tan Bien – Bruses. ")


def test_render_without_song_or_artist_still_produces_copy():
    strategy = load_strategy("yt_search_exact_v1")
    pieces = CopyPieces(artist=None, song=None, platforms={"youtube": {"song_summary": "s", "comment_question": "q",
                                                                        "hashtags": ["A", "B", "C"], "tags": ["t"]}})
    with pytest.raises(ValueError):   # T1 needs at least the song name
        render_copy(strategy, pieces, "es", seed="x")


# ── pipeline stage ──────────────────────────────────────────────────────────

async def test_result_summarizer_stores_every_platform_copy(tmp_path):
    from unittest.mock import AsyncMock

    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobArtifacts, JobInput, SongInfo
    from src.modules import result_summarizer

    raw = {
        **_yt_raw(),
        "tiktok": {"hook_statement": "Sabes que te rompe y te quedas.", "memory_question": "¿Quién te vino a la mente?",
                   "hashtags": ["bruses", "duelestanbien", "desamor", "letras"]},
        "facebook": {"hook_statement": "Hay amores que intoxican.", "memory_question": "¿A quién se la mandarías?",
                     "hashtags": ["Bruses", "DuelesTanBien", "Desamor"]},
        "instagram": {"hook_statement": "Hay canciones que duelen bonito.",
                      "memory_question": "¿Quién se te vino a la mente? Etiquétala.",
                      "hashtags": ["Bruses", "DuelesTanBien", "Desamor"]},
    }
    ai = AsyncMock()
    ai.complete_json = AsyncMock(return_value=raw)
    job = Job(
        input=JobInput(category_name="lyrics_video_romantic", song_info=SongInfo(language="es")),
        artifacts=JobArtifacts(output_dir=tmp_path),
    )
    result = await result_summarizer.run(job, ai, get_niche_config("lyrics_video_romantic"))

    summary = result.artifacts.summary
    assert ai.complete_json.await_count == 1                      # no retry needed
    assert set(summary.platform_copies) == {"youtube", "tiktok", "facebook", "instagram"}
    assert summary.youtube_title == summary.platform_copies["youtube"].title
    assert summary.tiktok_caption.startswith("Sabes que te rompe")
    assert summary.platform_copies["facebook"].strategy == "facebook_hook_question_v1"
    saved = json.loads((tmp_path / "logs" / "08_resumen_final.json").read_text())
    assert saved["copy_pieces"]["artist"] == "Bruses" and saved["language"] == "es"
