"""Extraction/application regressions and timing failures, without model execution."""
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.core.explainer.editions.resolver import build_edition, _source_revision
from src.core.explainer.editions.extraction import extract, Extracted
from src.core.explainer.editions.application import localized_script, storyboard
from src.core.explainer.editions.io import read, write
from src.core.explainer.editions.media import validate_clips
from src.core.localization.output import EditionOutput
from src.core.localization.texts import TextTable

SOURCE = Path(__file__).resolve().parents[2] / "src/templates/nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats"


@pytest.fixture
def edition():
    return build_edition(SOURCE, "en-US")


def test_extraction_keys_metadata_and_lossless_application(edition):
    source = extract(SOURCE, edition)
    again = extract(SOURCE, edition)
    assert source.table.content_hash == again.table.content_hash
    assert set(source.table.entries) == set(source.pointers)
    assert len(set(source.pointers.values())) == len(source.pointers)
    assert source.table.entries["seg.s01"].metadata["act"] == source.script["segments"][0]["act"]
    assert source.table.entries["seg.s01"].metadata["intensity"] == source.script["segments"][0]["intensity"]
    assert source.cues["scene.1"]["source_phrase"] == source.storyboard["beats"][1]["at"]
    values = {k: v.text for k, v in source.table.entries.items()}
    values["script.title"] = "YOUR CHATS BEFORE A JUDGE"
    output = SimpleNamespace(strings={k: v for k, v in values.items() if not k.startswith("seg.")},
        segments=[SimpleNamespace(id=s["id"], text=s["text"], delivery_note="Measured delivery.")
                  for s in source.script["segments"]])
    result = localized_script(source, output, edition)
    assert result["language"] == "en-US"
    assert result["title"] == "YOUR CHATS BEFORE A JUDGE"
    for original, localized in zip(source.script["segments"], result["segments"]):
        assert localized == {**original, "delivery_note": "Measured delivery."}
    assert read(SOURCE / "assets/script.json") == source.script


@pytest.mark.parametrize("relative", ["assets/lyrics.json", "PLAN.md", "BRIEF.md"])
def test_revision_includes_all_editorial_inputs(tmp_path, relative):
    before = _source_revision(tmp_path)
    path = tmp_path / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("changed", encoding="utf-8")
    assert _source_revision(tmp_path) != before


def test_revision_rejects_source_symlinks(tmp_path):
    outside = tmp_path / "outside"
    outside.write_text("private")
    production = tmp_path / "production"
    production.mkdir()
    (production / "PLAN.md").symlink_to(outside)
    with pytest.raises(ValueError, match="symlink"):
        _source_revision(production)


@pytest.fixture
def scene_case():
    script = {"segments": [{"id": "a", "text": "first second"}]}
    board = {"beats": [
        {"t": 0, "use": "rough.photo", "params": {"src": "assets/a.jpg"}},
        {"at": "second", "use": "common.clip", "params": {"src": "assets/c.mp4", "loop": True}},
    ]}
    source = Extracted(TextTable(source_locale="es-419", source_revision="test", entries={}), {},
                       script, board, {}, {"scene.1": {"segment_id": "a", "fraction": .5, "anchored": True}})
    output = SimpleNamespace(strings={}, cues={"scene.1": SimpleNamespace(segment_id="a", target_phrase="second")})
    alignment = {"segments": {"a": {"word_start": 0, "word_end": 2, "start": 0, "end": 10}}}
    lyrics = {"segments": [{"words": [{"word": "first", "start": 0, "end": 4},
                                     {"word": "second", "start": 5, "end": 10}]}]}
    return source, output, alignment, lyrics


def test_scene_timing_keeps_zero_and_shared_media(edition, scene_case):
    source, output, timing, lyrics = scene_case
    before = deepcopy(source.storyboard)
    result, warnings = storyboard(source, output, edition, timing, lyrics, 20, {"common.clip": 8})
    assert result["beats"][0] == {**source.storyboard["beats"][0], "offset": 0}
    assert result["beats"][1]["t"] == 5
    assert result["beats"][1]["params"] == source.storyboard["beats"][1]["params"]
    assert warnings == [] and source.storyboard == before


@pytest.mark.parametrize("duration,reason", [(6, "minDur"), (4, "fuera del audio")])
def test_invalid_scene_timing_is_rejected(edition, scene_case, duration, reason):
    source, output, timing, lyrics = scene_case
    with pytest.raises(ValueError, match=reason):
        storyboard(source, output, edition, timing, lyrics, duration, {"common.clip": 8})


def test_absolute_time_uses_proportion_of_its_segment(edition, scene_case):
    source, output, timing, lyrics = scene_case
    source.cues["scene.1"].update(fraction=.25, anchored=False)
    source.storyboard["beats"][1].pop("at")
    source.storyboard["beats"][1]["t"] = 3
    timing["segments"]["a"]["end"] = 20
    result, _ = storyboard(source, output, edition, timing, lyrics, 30, {})
    assert result["beats"][1]["t"] == 5


def test_overlay_duration_stays_fixed_and_main_duration_follows_next_cue(edition, scene_case):
    source, output, timing, lyrics = scene_case
    source.storyboard["beats"].insert(1, {"t": 0, "use": "common.tag", "dur": 2, "params": {"text": "tag"}})
    source.cues = {"scene.2": source.cues["scene.1"]}
    output.cues = {"scene.2": output.cues["scene.1"]}
    layers = {"common.tag": "overlay"}
    result, _ = storyboard(source, output, edition, timing, lyrics, 20, {"rough.photo": 4}, layers)
    assert result["beats"][2]["t"] == 5
    source.storyboard["beats"][0]["dur"] = 2
    result, _ = storyboard(source, output, edition, timing, lyrics, 20, {}, layers)
    assert result["beats"][0]["dur"] == 5
    assert result["beats"][1]["dur"] == 2


def test_scene_uses_the_accepted_target_segment(edition, scene_case):
    source, output, timing, lyrics = scene_case
    timing["segments"]["b"] = {"word_start": 2, "word_end": 3, "start": 12, "end": 14}
    lyrics["segments"][0]["words"].append({"word": "moved", "start": 12, "end": 14})
    output.cues["scene.1"] = SimpleNamespace(segment_id="b", target_phrase="moved")
    result, warnings = storyboard(source, output, edition, timing, lyrics, 20, {})
    assert result["beats"][1]["t"] == 12
    assert warnings == []


def test_minimum_clip_duration_moves_only_nearby_cues_and_reports_displacement():
    from src.core.explainer.editions.retiming import fit_main_scenes
    beats = [{"t": 0, "use": "photo"}, {"t": 10, "use": "clip"}, {"t": 15, "use": "photo"}]
    warnings = fit_main_scenes(beats, 30, {"clip": 8}, {})
    assert beats[2]["t"] - beats[1]["t"] == 8
    assert beats[0]["t"] == 0
    assert len(warnings) == 2
    assert all(abs(w["shift_seconds"]) <= 1.5 for w in warnings)
    with pytest.raises(ValueError, match="requiere edición"):
        fit_main_scenes([{ "t": 0, "use": "photo"}, {"t": 10, "use": "clip"}], 14, {"clip": 8}, {})


def test_first_scene_discards_source_end_anchor_and_offset(edition, scene_case):
    source, output, timing, lyrics = scene_case
    source.storyboard["beats"][0].update(until="viejo", offset=4)
    result, warnings = storyboard(source, output, edition, timing, lyrics, 20, {})
    assert "until" not in result["beats"][0]
    assert result["beats"][0]["offset"] == 0
    assert warnings[0]["kind"] == "end_anchor_replaced"


async def test_clip_validation_rejects_missing_or_external_media(tmp_path):
    for src in ("assets/missing.mp4", "/etc/private.mp4", "https://example.com/video.mp4", "assets/../../private.mp4"):
        with pytest.raises(ValueError):
            await validate_clips(tmp_path, {"beats": [{"t": 0, "use": "common.clip", "params": {"src": src}}]}, 20)


def test_schema_file_matches_runtime_contract():
    path = Path(__file__).resolve().parents[2] / "src/skills/editions/prompts/output.schema.json"
    assert read(path) == EditionOutput.model_json_schema()


def test_kit_staging_redirects_only_localized_revision_paths(tmp_path, monkeypatch, edition):
    tools = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit/tools"
    monkeypatch.syspath_prepend(str(tools))
    import edition_context
    production = tmp_path / "productions/nodetech/test"
    stage = tmp_path / ".system/runtime/localization/job"
    path = stage / "edition.json"
    write(path, edition.model_dump(by_alias=True))
    monkeypatch.setenv("NEXA_PRODUCTION_DIR", str(production))
    monkeypatch.setenv("NEXA_EDITION_STAGING_DIR", str(stage))
    ctx = edition_context.EditionContext(path)
    assert ctx.path_of("audio") == stage / "song.mp3"
    assert ctx.path_of("script") == stage / "script.json"
    ctx.data["paths"]["audio"] = "assets/song.mp3"
    with pytest.raises(SystemExit, match="staging"):
        ctx.path_of("audio")

