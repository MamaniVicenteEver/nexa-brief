"""La duración mínima de otro plano no oculta errores de common.capas."""
import json
from pathlib import Path

import pytest

KIT = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit"


@pytest.mark.parametrize("valid", [True, False])
def test_full_check_validates_capas_even_when_previous_minimum_omits_beat(
    tmp_path, monkeypatch, capsys, valid
):
    monkeypatch.syspath_prepend(str(KIT / "tools"))
    import check_storyboard as checker

    # Aislar las políticas editoriales del episodio: este test verifica el check
    # completo y su resolución temporal, usando el validador real de capas.
    monkeypatch.setattr(checker, "of_script", lambda *_: {"legacy": True, "lyrics": [0, 10]})
    monkeypatch.setattr(checker, "quality_check", lambda *_: {})
    monkeypatch.setattr(checker, "check_audio_end", lambda *_: None)
    monkeypatch.setattr(checker, "check_brand_logos", lambda *_: None)
    monkeypatch.setattr(checker.narrative_check, "check", lambda *_: None)
    monkeypatch.setattr(checker.style_media_policy, "check", lambda *_, **__: None)
    monkeypatch.setattr(checker.media_relevance, "check", lambda *_: ([], {}))
    monkeypatch.setattr(checker.component_library, "similar", lambda *_: [])
    monkeypatch.setattr(checker.outro_tool, "spec_for", lambda *_: None)
    monkeypatch.setattr(checker, "load_catalog", lambda *_: {
        "test.introv1": {"layer": "main", "params": {}},
        "common.capas": {"layer": "main", "params": {"elenco": {"type": "array"}}},
    })
    assets = tmp_path / "assets"
    assets.mkdir()
    config = {
        "design": "capas-test",
        "quality_policy_version": 3,
        "minDur": {"test.introv1": 5},
        "lyricsUrl": "assets/lyrics.json",
        "storyboardUrl": "assets/storyboard.json",
    }
    scene = {"elenco": [] if valid else [{"id": "jefe", "asset": "no-existe"}]}
    storyboard = {"beats": [
        {"use": "test.introv1", "t": 0, "offset": 0, "dur": 1, "params": {}},
        {"use": "common.capas", "t": 1, "offset": 0, "dur": 2, "params": scene},
    ]}
    for filename, data in {
        "config.json": config,
        "lyrics.json": {"metadata": {"duration": 6}, "segments": []},
        "storyboard.json": storyboard,
    }.items():
        (assets / filename).write_text(json.dumps(data), encoding="utf-8")

    result = checker.main(tmp_path)
    output = capsys.readouterr().out
    assert result == (0 if valid else 1), output
    if not valid:
        assert "common.capas" in output and "asset inexistente" in output, output
