"""Regresiones de duración final y cobertura visual de la política nueva."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.core.explainer import producer


KIT_TOOLS = Path(producer.KIT_DIR) / "tools"


@pytest.mark.parametrize("video_id", ["apolo-1202", "ia-despidos-programadores-amazon"])
def test_approved_legacy_storyboard_has_no_new_blockers(tmp_path, monkeypatch, capsys, video_id):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker

    source = Path(producer.KIT_DIR).parents[1] / "nodetech" / video_id
    video = tmp_path / "nodetech" / video_id
    video.mkdir(parents=True)
    (video / "assets").symlink_to(source / "assets", target_is_directory=True)
    (video / "manifest.json").write_bytes((source / "manifest.json").read_bytes())
    assert checker.main(video) == 0
    assert "legado aprobado:" in capsys.readouterr().out


def test_audio_end_requires_full_outro_and_question(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker

    audio = tmp_path / "assets" / "song-with-outro.mp3"
    audio.parent.mkdir()
    audio.write_bytes(b"audio")
    monkeypatch.setattr(checker, "clip_seconds", lambda _: 100.0)
    config = {"audio": {"src": "assets/song-with-outro.mp3"}, "quality_policy_version": 2,
              "outro": {"enabled": True, "use": "rough.outrov1", "start": 90.0, "dur": 10.0}}
    lyrics = {"metadata": {"duration": 100.0, "outro": {"start": 90.0}}}
    question = {"use": "common.question", "layer": "overlay", "t0": 80.0, "t1": 90.0,
                "b": {"params": {"text": "¿Y ahora qué?"}}}
    main = {"use": "rough.photo", "layer": "main", "t0": 0.0, "t1": 90.0}
    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [main, question], 100.0, errors)
    assert not errors

    question["b"]["params"]["text"] = " "
    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [main, question], 100.0, errors)
    assert any("texto vacío" in error for error in errors)
    question["b"]["params"]["text"] = "¿Y ahora qué?"

    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [question], 100.0, errors)
    assert any("beat principal" in error for error in errors)

    lyrics["metadata"]["outro"]["start"] = 88.0
    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [main, question], 100.0, errors)
    assert any("lyrics.metadata.outro.start" in error for error in errors)
    lyrics["metadata"]["outro"]["start"] = 90.0

    config["outro"]["use"] = "rough.inexistente"
    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [main, question], 100.0, errors)
    assert any("config.outro.use" in error for error in errors)
    config["outro"]["use"] = "rough.outrov1"

    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [main], 90.0, errors)
    assert any("duración preview/config" in error for error in errors)
    assert any("common.question" in error for error in errors)
    config["outro"]["dur"] = 8.0
    errors = []
    checker.check_audio_end(tmp_path, config, lyrics, [main, question], 100.0, errors)
    assert any("final completo" in error for error in errors)


def test_poster_alone_does_not_satisfy_media_coverage(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker

    catalog = {"common.tabloid": {"params": {"poster": {"type": "image"}, "video": {"type": "video"}}}}
    beat = {"i": 0, "use": "common.tabloid", "layer": "main", "t0": 0, "t1": 180,
            "b": {"params": {"poster": "assets/media/still.jpg"}}}
    errors = []
    checker.quality_check(tmp_path, {"quality_policy_version": 2, "outro": {"start": 180}}, {},
                          [beat], [], 190, errors, catalog)
    assert any("sin foto/clip" in error for error in errors)


def test_new_quality_policy_blocks_late_media_gap_and_short_photo(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker

    def photo(i, start, end):
        return {"i": i, "use": "rough.photo", "layer": "main", "t0": start, "t1": end,
                "b": {"params": {"src": f"assets/media/{i}.jpg"}}}

    catalog = {"rough.photo": {"params": {"src": {"type": "image"}}}}
    config = {"quality_policy_version": 2, "outro": {"start": 180}}
    beats = [photo(0, 0, 8), photo(1, 100, 108), photo(2, 145, 155)]
    errors = []
    checker.quality_check(tmp_path, config, {}, beats, [], 190, errors, catalog)
    assert any("sin foto/clip" in error for error in errors)

    beats = [photo(0, 0, 8), photo(1, 70, 74), photo(2, 140, 150)]
    errors = []
    checker.quality_check(tmp_path, config, {}, beats, [], 190, errors, catalog)
    assert any("foto visible" in error for error in errors)
    beats[1]["t1"] = 76
    errors = []
    checker.quality_check(tmp_path, config, {}, beats, [], 190, errors, catalog)
    assert not errors


def test_logo_requires_media_transparency_and_at_most_two_uses(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker
    from PIL import Image

    logos = tmp_path / "assets/media/logos"
    logos.mkdir(parents=True)
    Image.new("RGB", (20, 10), "white").save(logos / "brand.png")
    spec = {"rough.photo": {"params": {"src": {"type": "image"}, "logo": {"type": "image"}}}}
    beat = lambda i, src: {"i": i, "use": "rough.photo", "b": {"params": {
        "src": src, "logo": "assets/media/logos/brand.png", "logoName": "Brand"}}}
    errors, warnings = [], []
    checker.check_brand_logos({}, [beat(0, "assets/media/photo.jpg")], spec, tmp_path, errors, warnings)
    assert any("PNG opaco" in e for e in errors)
    assert not any("sin foto/video" in e for e in errors)

    padded = Image.new("RGBA", (20, 10), (0, 0, 0, 0))
    padded.paste((255, 255, 255, 255), (2, 2, 18, 8))
    padded.save(logos / "brand.png")
    assert checker.opaque_logo_png(logos / "brand.png")

    Image.new("RGBA", (20, 10), (0, 0, 0, 0)).save(logos / "brand.png")
    errors, warnings = [], []
    checker.check_brand_logos({}, [beat(i, "") for i in range(3)], spec, tmp_path, errors, warnings)
    assert sum("sin foto/video" in e for e in errors) == 3
    assert any("máximo 2" in e for e in errors)
    assert not any("PNG opaco" in e for e in errors)

    spec["rough.photo"]["params"]["poster"] = {"type": "image"}
    poster_only = beat(0, "")
    poster_only["b"]["params"]["poster"] = "assets/media/poster.jpg"
    errors, warnings = [], []
    checker.check_brand_logos({}, [poster_only], spec, tmp_path, errors, warnings)
    assert any("sin foto/video" in e for e in errors)

    tabloid = {"i": 0, "use": "common.tabloid", "b": {"params": {
        "logoName": "Brand", "poster": "assets/media/poster.jpg"}}}
    spec["common.tabloid"] = {"params": {"poster": {"type": "image"}, "srcAfter": {"type": "image"}}}
    errors, warnings = [], []
    checker.check_brand_logos({}, [tabloid], spec, tmp_path, errors, warnings)
    assert not errors
    tabloid["b"]["params"] = {"logoName": "Brand", "srcAfter": "assets/media/after.jpg"}
    checker.check_brand_logos({}, [tabloid], spec, tmp_path, errors, warnings)
    assert any("sin foto/video" in e for e in errors)

    alias_beats = [beat(i, "assets/media/photo.jpg") for i in range(3)]
    for item, name in zip(alias_beats, ("Amazon", "AWS", "Amazon")):
        item["b"]["params"]["logoName"] = name
    errors, warnings = [], []
    checker.check_brand_logos({}, alias_beats, spec, tmp_path, errors, warnings)
    assert any("máximo 2" in e for e in errors)

    errors, warnings = [], []
    checker.check_brand_logos({}, [{"i": 0, "use": "common.logo", "b": {"params": {"name": "Brand"}}}],
                              spec, tmp_path, errors, warnings)
    assert any("common.logo obsoleto" in e for e in errors)


def test_video_floor_and_long_video_spans_are_configured(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker

    catalog = {"common.clip": {"params": {"src": {"type": "video"}}},
               "rough.introv2": {"params": {"video": {"type": "video"}}}}
    beat = lambda i, use, start, end: {"i": i, "use": use, "layer": "main", "t0": start, "t1": end,
                                      "b": {"params": {"src" if use == "common.clip" else "video": "assets/media/example.mp4"}}}
    config = {"quality_policy_version": 3, "outro": {"start": 470}}
    beats = [beat(0, "common.clip", 0, 7), beat(1, "rough.introv2", 120, 132), beat(2, "common.clip", 240, 251)]
    errors = []
    checker.quality_check(tmp_path, config, {}, beats, [], 480, errors, catalog)
    assert any("video visible 7.0s" in e for e in errors)
    assert any("tramos de video" in e for e in errors)

    assert checker.visible_video_seconds({**config, "design": "rough"}, beats[0], 480) == 8
    assert checker.visible_video_seconds({**config, "design": "rough", "minDur": {"rough.photo": 6}},
                                         beats[0], 480) == 8

    beats[0]["t1"] = 12
    errors = []
    checker.quality_check(tmp_path, config, {}, beats, [], 480, errors, catalog)
    assert not any("video visible" in e or "tramos de video" in e for e in errors)

    # El motor omite el segundo clip si el primero lo cubre al aplicar minDur.
    skipped = [beat(0, "common.clip", 0, 4), beat(1, "common.clip", 4, 7),
               beat(2, "rough.introv2", 120, 132)]
    configured = {**config, "design": "rough"}
    assert [item["i"] for item in checker.resolved_video_beats(configured, skipped, 480)] == [0, 2]
    errors = []
    checker.quality_check(tmp_path, configured, {}, skipped, [], 480, errors, catalog)
    assert any("tramos de video" in e for e in errors)


def test_kit_manifest_uses_configured_audio_with_outro(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import kit

    video = tmp_path / "video"
    assets = video / "assets"
    assets.mkdir(parents=True)
    (video / "render").mkdir()
    (assets / "song.mp3").write_bytes(b"short")
    (assets / "song-with-outro.mp3").write_bytes(b"complete")
    (assets / "config.json").write_text(json.dumps({"design": "rough", "audio": {"src": "assets/song-with-outro.mp3"}}))
    (assets / "script.json").write_text(json.dumps({"segments": [{"id": "s1", "tone": "cierre", "text": "Fin."}]}))
    (assets / "storyboard.json").write_text(json.dumps({"beats": [{"use": "rough.photo"}] * 15}))
    (assets / "lyrics.json").write_text(json.dumps({"segments": [{"words": [{"word": "Fin."}]}]}))
    monkeypatch.setattr(kit, "vdir", lambda _: video)
    monkeypatch.setattr(kit, "audio_dur", lambda path: 101 if path.name == "song-with-outro.mp3" else 90)
    monkeypatch.setattr(kit.outro_tool, "spec_for", lambda _: None)
    monkeypatch.setattr(kit, "chapter_times", lambda *_: [])
    monkeypatch.setattr(kit, "run", lambda *_, **__: type("Run", (), {"returncode": 0, "stdout": ""})())
    kit.cmd_manifest(type("Args", (), {"id": "video"})())
    assert json.loads((video / "manifest.json").read_text())["duration_seconds"] == 101


def test_voice_direction_uses_130_ppm_and_pause_for_every_tone(monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import narrate

    script = {"segments": [{"id": "s1", "tone": "alarma", "text": "Una frase. Otra frase.", "delivery_note": "Con calma."}]}
    result = narrate.chunks(script, "Narrador. Alrededor de 125 palabras por minuto.")[0]
    assert "130 palabras por minuto" in result["style"]
    assert "125 palabras por minuto" not in result["style"]
    assert "Con calma." in result["style"]
    assert "<short pause>" in result["text"]
