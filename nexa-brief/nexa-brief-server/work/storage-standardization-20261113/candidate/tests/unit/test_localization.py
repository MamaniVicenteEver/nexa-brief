from decimal import Decimal

import pytest

from src.core.localization.texts import TextEntry, TextMemory, TextTable, numbers, same_figures, validate_table
from src.core.localization.prompts import compose_prompt
from src.core.explainer.editions.alignment import align, source_cues, target_time
from src.core.explainer.editions.extraction import editorial_excerpt
from src.core.explainer.editions.application import normalize_media
from src.core.explainer.editions.publishing import platform_publish, publication


def test_text_table_checks_and_hash():
    table = TextTable(source_locale="es-419", source_revision="sha256:test", entries={
        "caption": TextEntry(text="OpenAI conserva veinte millones", max_chars=80, preserve_names=["OpenAI"]),
        "mark": TextEntry(text="conserva", max_chars=20, substring_of="caption"),
    })
    good = {"caption": "OpenAI retains 20 million", "mark": "retains"}
    assert validate_table(table, good, "en-US") == {}
    assert table.content_hash == table.model_copy(deep=True).content_hash
    errors = validate_table(table, {"caption": "Other keeps 30 million", "mark": "missing", "extra": "no"}, "en-US")
    assert "figures changed" in errors["caption"]
    assert "preserve name: OpenAI" in errors["caption"]
    assert "substring of caption" in errors["mark"]
    assert errors["extra"] == ["unknown key"]
    assert validate_table(table, {}, "en-US")["caption"] == ["missing text"]
    assert "max_chars=20" in validate_table(table, {**good, "mark": "x" * 21}, "en-US")["mark"]


@pytest.mark.parametrize("text,locale,value", [
    ("veinte millones", "es-419", 20000000), ("twenty million", "en-US", 20000000),
    ("vinte milhões", "pt-BR", 20000000), ("1,250.5", "en-US", 1250.5),
    ("1.250,5", "pt-BR", 1250.5), ("dos mil veintiséis", "es-419", 2026),
    ("two thousand twenty-six", "en-US", 2026), ("dois mil e vinte e seis", "pt-BR", 2026),
])
def test_cardinal_figures(text, locale, value):
    assert numbers(text, locale) == {Decimal(str(value))}


@pytest.mark.parametrize("source,target", [
    ("20 %", "-20 %"), ("20 %", "20"), ("3,5 %", "8.7 %"),
    ("20 millones de usuarios", "20 million dollars"),
])
def test_figures_keep_sign_decimals_and_units(source, target):
    assert not same_figures(source, "es-419", target, "en-US")


def test_decimal_narration_and_protected_narration_names():
    assert same_figures("3,5 millones", "es-419", "three point five million", "en-US")
    table = TextTable(source_locale="es-419", source_revision="test", entries={
        "seg.a": TextEntry(text="OpenAI lo conserva", type="narration", preserve_names=["OpenAI"])})
    assert "preserve name: OpenAI" in validate_table(table, {"seg.a": "The company retains it"}, "en-US")["seg.a"]


def test_memory_is_scoped_to_source_channel_and_market():
    memory = TextMemory()
    memory.remember("channel", "en-US", "GRACIAS", "THANK YOU")
    assert memory.lookup("channel", "en-US", "GRACIAS") == "THANK YOU"
    assert memory.lookup("channel", "pt-BR", "GRACIAS") is None
    assert memory.lookup("channel", "en-US", "GRACIAS!") is None


def transcript(text):
    words = [{"word": " " + word, "start": i, "end": i + .9} for i, word in enumerate(text.split())]
    return {"metadata": {"duration": len(words)}, "segments": [{"words": words}]}


def test_segment_alignment_and_cues_are_bounded():
    script = {"segments": [{"id": "a", "text": "first exact phrase"}, {"id": "b", "text": "second exact phrase"}]}
    lyrics = transcript("first exact phrase second exact phrase")
    alignment, discrepancies = align(script, lyrics)
    assert discrepancies == []
    assert alignment["segments"]["b"]["word_start"] == 3
    cues, _ = source_cues(script, {"beats": [{"t": 0}, {"at": "second exact"}, {"t": 4}]}, lyrics)
    assert cues["scene.1"]["segment_id"] == "b"
    assert cues["scene.2"]["fraction"] > 0
    words = lyrics["segments"][0]["words"]
    assert target_time(cues["scene.1"], "exact phrase", alignment, words) == (4, None)
    time, warning = target_time(cues["scene.1"], "first exact", alignment, words)
    assert 3 <= time <= 5.9 and warning["matches"] == 0


def test_ambiguous_cue_uses_proportion_and_reports_it():
    lyrics = transcript("again here again here")
    alignment, _ = align({"segments": [{"id": "a", "text": "again here again here"}]}, lyrics)
    cue = {"segment_id": "a", "fraction": .5}
    time, warning = target_time(cue, "again", alignment, lyrics["segments"][0]["words"])
    assert time == pytest.approx(1.95) and warning["matches"] == 2


def test_stt_contraction_spacing_does_not_create_false_missing_words():
    timing, warnings = align({"segments": [{"id": "a", "text": "You wouldn't share it"}]},
                             transcript("You wouldn t share it"))
    assert warnings == []
    assert timing["segments"]["a"]["word_end"] == 5


def test_six_prompt_sections_and_excerpt_limit(tmp_path):
    lead, design, task = [tmp_path / name for name in ("lead.md", "design.md", "task.md")]
    for path, text in ((lead, "ROLE"), (design, "DESIGN"), (task, "TASK")):
        path.write_text(text)
    prompt = compose_prompt(lead=lead, design=design, task=task, identity={"market": "en-US"},
                            strategies={"rule": "STRATEGY"}, story={"thesis": "STORY"})
    assert prompt.index("ROLE") < prompt.index("DESIGN") < prompt.index("en-US") < prompt.index("STRATEGY") < prompt.index("STORY") < prompt.index("TASK")
    assert str(tmp_path) not in prompt
    source = ("# Tesis\nHecho y matiz.\nGuía `../../kit/guides/story.md`\nArchivo /srv/perfiles/privado\n```\nsecreto técnico\n```\n"
              "# Componentes\nassets/private.json\n# Hechos\n" + "dato " * 7000)
    excerpt = editorial_excerpt(source)
    assert len(excerpt.split()) <= 3500
    assert "assets/" not in excerpt and "Hecho y matiz" in excerpt
    assert "../../" not in excerpt and "/srv/" not in excerpt and "secreto técnico" not in excerpt


def test_media_normalization_and_traversal(tmp_path):
    production = tmp_path / "productions/nodetech/example"
    value = {"src": "/nodetech/example/assets/a.jpg", "video": "assets/media/a.mp4", "enum": "image"}
    assert normalize_media(value, production) == {**value, "src": "/productions/nodetech/example/assets/a.jpg"}
    with pytest.raises(ValueError):
        normalize_media("assets/../../../../outside", production)


def test_publish_contract_and_recalculated_chapters():
    source = platform_publish({"youtube_title": "Title", "youtube_description": "Source", "pinned_comment": "Pin"})
    assert source["youtube"]["title"] == "Title" and source["youtube"]["pinned"] == "Pin"
    source["youtube"]["chapters"] = [{"segment_id": "a", "title": "First"}, {"segment_id": "b", "title": "Next"}]
    timing = {"segments": {"a": {"start": 1}, "b": {"start": 80}}}
    assert publication(source, timing, chapters=True)["youtube"]["chapters"] == [{"t": 0, "title": "First"}, {"t": 80, "title": "Next"}]
    assert publication(source, timing, chapters=False)["youtube"]["chapters"] == []

