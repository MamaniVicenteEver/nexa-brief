"""Interruptor de IA, vista previa sin IA y datos pendientes: nada depende de la IA para previsualizar."""

import asyncio
from types import SimpleNamespace

import pytest

from src.core import ai_switch
from src.core.library import asset_library as lib


@pytest.fixture
def switch_file(tmp_path, monkeypatch):
    path = tmp_path / "ai-switch.json"
    monkeypatch.setattr(ai_switch, "_switch_path", lambda: path)
    return path


def test_ai_is_enabled_by_default(switch_file):
    assert ai_switch.ai_enabled() is True
    ai_switch.require_ai("prueba")  # no lanza


def test_switch_off_blocks_every_ai_call(switch_file):
    ai_switch.set_ai_enabled(False)
    assert ai_switch.ai_enabled() is False
    with pytest.raises(ai_switch.AIUnavailableError):
        ai_switch.require_ai("hub")


def test_preview_context_never_calls_ai_even_with_switch_on(switch_file):
    token = ai_switch.ai_preview.set(True)
    try:
        assert ai_switch.ai_enabled() is False
    finally:
        ai_switch.ai_preview.reset(token)
    assert ai_switch.ai_enabled() is True


def test_corrupt_switch_file_keeps_ai_enabled(switch_file):
    switch_file.write_text("{no es json", encoding="utf-8")
    assert ai_switch.ai_enabled() is True


def test_offline_analysis_uses_song_and_niche_without_ai():
    from src.modules.input_analyzer import offline_analysis

    job = SimpleNamespace(input=SimpleNamespace(
        song_info=SimpleNamespace(topic="Dueles", song_name="Dueles Tan Bien", description="Canción de prueba"),
        duration_seconds=90, category_name="node_motion"))
    niche = SimpleNamespace(id="lyrics_video_rasgado", audio=SimpleNamespace(genre="rap"))
    analyzed = offline_analysis(job, niche)
    assert analyzed.genre == "rap"
    assert analyzed.image_query == "Dueles"
    assert analyzed.description == "Canción de prueba"
    assert analyzed.duration_seconds == 90
    assert analyzed.mood_tags == []


def test_offline_analysis_without_song_info_falls_back_to_niche_id():
    from src.modules.input_analyzer import offline_analysis

    job = SimpleNamespace(input=SimpleNamespace(song_info=None, duration_seconds=None, category_name="node_motion"))
    niche = SimpleNamespace(id="lyrics_video_x", audio=None)
    analyzed = offline_analysis(job, niche)
    assert analyzed.genre == "pop"
    assert analyzed.image_query == "lyrics_video_x"
    assert analyzed.duration_seconds == 0


def test_metadata_gaps_lists_only_what_is_missing():
    entry = SimpleNamespace(track_name="Tema", label="", display_name="", description="",
                            tags="", category="stock", license_note="CC BY 3.0")
    assert lib.metadata_gaps("music", entry) == ["descripción", "etiquetas"]


def test_unknown_license_counts_as_missing():
    entry = SimpleNamespace(track_name="Tema", label="", display_name="", description="d",
                            tags="t", category="stock", license_note="unknown")
    assert lib.metadata_gaps("music", entry) == ["licencia"]


def test_complete_resource_has_no_gaps():
    entry = SimpleNamespace(label="Clip", display_name="", description="d", tags="t",
                            category="stock", license_note="Pixabay Content License")
    assert lib.metadata_gaps("video", entry) == []


def test_draft_model_carries_pending_items():
    from src.core.drafts import Draft

    draft = Draft(draft_id="d1", template_id="t", niche_id="n", created_at="x", updated_at="x",
                  pending=["textos de publicación y miniaturas (IA no disponible)"])
    assert draft.pending == ["textos de publicación y miniaturas (IA no disponible)"]
    assert Draft(draft_id="d2", template_id="t", niche_id="n", created_at="x", updated_at="x").pending == []
