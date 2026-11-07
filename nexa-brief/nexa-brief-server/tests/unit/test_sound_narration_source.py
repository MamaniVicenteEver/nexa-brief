import pytest

from src.core.ports.sound_effects_port import SoundDesignError
from src.presentation.api.routers.sound_design import _narration_from_config


def test_repeated_mix_uses_clean_voice_of_active_case(tmp_path):
    (tmp_path / "clean.mp3").write_bytes(b"clean")
    (tmp_path / "mixed.mp3").write_bytes(b"mixed")
    config = {"activeId": "active", "configs": [
        {"id": "other", "audio": {"src": "missing.mp3"}},
        {"id": "active", "audio": {"src": "mixed.mp3", "narrationSrc": "clean.mp3"}},
    ]}
    assert _narration_from_config(tmp_path, config) == tmp_path / "clean.mp3"


def test_legacy_template_still_uses_existing_audio_source(tmp_path):
    (tmp_path / "voice.mp3").write_bytes(b"clean")
    assert _narration_from_config(tmp_path, {"configs": [{"audio": {"src": "voice.mp3"}}]}) == tmp_path / "voice.mp3"


def test_clean_voice_cannot_escape_template_folder(tmp_path):
    with pytest.raises(SoundDesignError, match="dentro"):
        _narration_from_config(tmp_path, {"configs": [{"audio": {"narrationSrc": "../private.mp3"}}]})


def test_missing_clean_voice_does_not_fall_back_to_mixed_audio(tmp_path):
    (tmp_path / "mixed.mp3").write_bytes(b"mixed")
    with pytest.raises(SoundDesignError, match="original"):
        _narration_from_config(tmp_path, {"configs": [{"audio": {"src": "mixed.mp3", "narrationSrc": "missing.mp3"}}]})
