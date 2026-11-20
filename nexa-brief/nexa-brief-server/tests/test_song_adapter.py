"""Pruebas del adaptador de canciones para las plantillas de letras con guion explícito."""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path

import pytest

from src.core.nodemotion.lyrics import song_adapter as sa

TEMPLATES = Path(__file__).resolve().parents[1] / "src" / "templates" / "nodemotion" / "lyrics"
ADAPTED = ["lyrics-hologram-worlds", "lyrics-grunge-montage"]


def _seg(start, words, logprob=-0.2):
    out, t = [], start
    for w in words:
        out.append({"word": f" {w}", "start": t, "end": t + 0.3})
        t += 0.35
    return {"start": start, "end": t, "text": " " + " ".join(words), "avg_logprob": logprob, "words": out}


def _song(duration=40.0):
    return {
        "metadata": {"audio_duration_sec": duration, "language": "es", "language_probability": 0.99},
        "segments": [
            _seg(3.0, ["Te", "estoy", "corriendo"]),
            _seg(6.0, ["que", "te", "quiero", "ver", "otra", "vez"]),
            _seg(20.0, ["Hoy", "creí"]),
            _seg(30.0, ["Gracias", "por", "todo"]),
        ],
    }


def _els_timeline():
    def text(t, **kw):
        return {"k": "text", "t": t, "h": 1.0, "x": 0.5, "y": 0.5, "f": "c", "fill": "holo", **kw}
    return [
        {"t0": 0.0, "t1": 1.5, "type": "intro", "bg": "void", "trans": "cut", "p": {}},
        {"t0": 1.5, "t1": 3.0, "type": "compose", "bg": "void", "trans": "cut", "p": {"els": [text("BREAK", at=0.1), text("RULES", at=0.5, out={"at": 1.2, "m": "cut", "d": 0.2}), {"k": "lab", "t": "BREAK RULES"}]}},
        {"t0": 3.0, "t1": 4.5, "type": "compose", "bg": "red", "trans": "cut", "p": {"els": [text("LIGHT IT UP"), {"k": "box", "x": 0.3, "y": 0.3, "at": 0.4}]}},
        {"t0": 4.5, "t1": 5.5, "type": "compose", "bg": "void", "trans": "cut", "p": {"els": [text("·  ·  ·"), {"k": "box", "x": 0.1}]}},
        {"t0": 5.5, "t1": 6.5, "type": "compose", "bg": "void", "trans": "cut", "p": {"els": [text("L"), text("I"), text("K"), text("E")]}},
        {"t0": 6.5, "t1": 7.5, "type": "compose", "bg": "void", "trans": "cut", "p": {"els": [{"k": "lab", "t": "THE BADDEST"}]}},
        {"t0": 8.0, "type": "outro", "bg": "void", "trans": "cut", "p": {}},
    ]


def _pieces_timeline():
    return [
        {"name": "s01", "t0": 0.0, "t1": 1.4, "type": "intro", "bg": {"clip": "a"}, "pieces": [
            {"k": "text", "s": "Roll up 20,", "intro": "artist", "at": 0.1}, {"k": "text", "s": "Deep", "at": 0.6}]},
        {"name": "s02", "t0": 1.4, "t1": 3.0, "bg": {"clip": "b"}, "pieces": [
            {"k": "text", "s": "Low homie belt is", "id": "l2", "in": "words", "wt": [0.2, 0.2, 0.2, 0.2], "at": 0.15, "until": 1.2},
            {"k": "chalk", "ref": "l2", "at": 0.3}]},
        {"name": "s03", "t0": 3.0, "t1": 4.0, "bg": {"clip": "c"}, "pieces": [{"k": "glitch", "at": 0.2}]},
        {"name": "s04", "t0": 4.0, "t1": 8.2, "type": "outro", "bg": {"paper": True}, "pieces": [{"k": "text", "s": "NodeMotion", "at": 0.2}]},
    ]


def _rules(schema):
    rules = sa._merge(sa.DEFAULT_RULES, {})
    rules["esquema"] = schema
    return rules


def _content(schema):
    timeline = _els_timeline() if schema == "els" else _pieces_timeline()
    return sa.extract_recipes(timeline, schema)


def _texts(scene, schema):
    out = []
    for item in sa._scene_items(scene, schema):
        field = sa._text_field(item, schema)
        if field and item.get(field):
            out.append(item)
    return out


# ---------------------------------------------------------------- recetas

@pytest.mark.parametrize("schema", ["els", "pieces"])
def test_recipes_carry_no_reference_words(schema):
    content = _content(schema)
    blob = json.dumps(content, ensure_ascii=False)
    for word in ("BREAK", "RULES", "LIGHT", "BADDEST", "Roll up", "homie", "Deep"):
        assert word not in blob


def test_spelled_letters_and_label_only_scenes_are_not_lyric_recipes():
    content = _content("els")
    spoken = [r for r in content["recetas"] if r["ranuras"]]
    decor = [r for r in content["recetas"] if not r["ranuras"]]
    assert content["descartadas"] == 1                      # L I K E
    assert len(spoken) == 2                                 # BREAK/RULES y LIGHT IT UP
    assert len(decor) == 2                                  # el rótulo suelto y la de puntos pasan a decoración
    assert all(not sa._text_field(i, "els") or not re.search(r"[A-Za-z]", str(i.get("t", ""))) for r in decor for i in sa._scene_items(r["escena"], "els"))


def test_static_non_letter_text_is_kept():
    content = _content("els")
    dots = [i for r in content["recetas"] for i in sa._scene_items(r["escena"], "els") if i.get("t", "").startswith("·")]
    assert dots, "el texto sin letras es decoración y se conserva"


# ---------------------------------------------------------------- canción

def test_phrases_respect_limits_and_keep_every_word():
    segs, _ = sa.filter_segments(_song()["segments"], None, -1.0)
    phrases = sa.build_phrases(segs, 4, 2.4, 2)
    assert all(len(p) <= 4 for p in phrases)
    assert [w["text"] for p in phrases for w in p] == ["Te", "estoy", "corriendo", "que", "te", "quiero", "ver", "otra", "vez", "Hoy", "creí", "Gracias", "por", "todo"]


def test_filter_drops_hallucinations_by_rule_threshold_not_config():
    segs = _song()["segments"] + [_seg(10.0, ["subtítulos", "x"]), _seg(12.0, ["ruido"], logprob=-1.5)]
    kept, dropped = sa.filter_segments(segs, {"drop": ["subt[ií]tulos"], "minLogprob": -0.1}, -1.0)
    assert len(dropped) == 2 and len(kept) == 4              # minLogprob de la config no endurece la regla


def test_short_phrases_are_merged_without_losing_words():
    words = [{"text": c, "t": 1.0 + i * 0.1, "end": 1.1 + i * 0.1} for i, c in enumerate("abcdef")]
    phrases = [words[i:i + 2] for i in range(0, 6, 2)]
    merged = sa.merge_short_phrases(phrases, 0.1, 0.4, 8)
    assert [w["text"] for p in merged for w in p] == list("abcdef")
    assert len(merged) < len(phrases)


# ---------------------------------------------------------------- línea de tiempo

@pytest.mark.parametrize("schema", ["els", "pieces"])
def test_timeline_follows_the_song(schema):
    content, rules = _content(schema), _rules(schema)
    rules["mensajes"]["activo"] = False                       # aquí solo se mide la letra cantada
    case = {"seed": 7, "intro": {"title": "T", "enabled": True}, "outro": {}}
    song = _song()
    report = sa.adapt_config(case, rules, content, song, 40.0)
    timeline = case["timeline"]
    assert report["modo"] == "recetas" and report["frasesUsadas"] > 0
    # continuidad y sin solapes
    for a, b in zip(timeline, timeline[1:]):
        assert a["t1"] == pytest.approx(b["t0"], abs=0.002)
    # cada palabra con tiempo aparece y su `wt` cae en el tiempo real de la canción
    real = {w["text"]: w["t"] for seg in song["segments"] for w in sa.segment_words(seg)}
    shown = set()
    for scene in timeline:
        for item in _texts(scene, schema):
            field = sa._text_field(item, schema)
            words = item[field].split()
            shown.update(words)
            if item.get("in") == "words" and item.get("wt") and len(words) == len(item["wt"]):
                for word, rel in zip(words, item["wt"]):
                    assert scene["t0"] + rel == pytest.approx(real[word], abs=0.01)
    assert set(real) <= shown
    assert not (shown & {"BREAK", "RULES", "LIGHT"})        # nada de la referencia


def test_lyrics_win_over_the_outro():
    content, rules = _content("els"), _rules("els")
    last_word_end = 30.0 + 2 * 0.35 + 0.3
    tight = {"seed": 7, "outro": {"sec": 4.0}}                # el audio acaba casi con la letra: sin outro
    sa.adapt_config(tight, rules, content, _song(31.5), 31.5)
    assert tight["timeline"][-1]["type"] != "outro"
    roomy = {"seed": 7, "outro": {"sec": 4.0}}                # hay 3 s libres: outro acortado, letra completa
    sa.adapt_config(roomy, rules, content, _song(34.0), 34.0)
    outro = roomy["timeline"][-1]
    assert outro["type"] == "outro" and outro["t0"] >= last_word_end - 1e-6 and 34.0 - outro["t0"] >= 1.0 - 1e-6
    shown = {w for s in roomy["timeline"] for i in _texts(s, "els") for w in i["t"].split()}
    assert {"Gracias", "por", "todo"} <= shown


def test_grunge_clock_offset_is_reset_by_rules():
    rules = _rules("pieces")
    rules["config"] = {"timeOffsetSec": 0}
    case = {"seed": 7, "timeOffsetSec": 0.22, "intro": {"title": "T"}}
    sa.adapt_config(case, rules, _content("pieces"), _song(), 40.0)
    assert case["timeOffsetSec"] == 0


def test_grunge_intro_needs_a_title():
    content, rules = _content("pieces"), _rules("pieces")
    song = _song()
    song["segments"] = [_seg(5.0, ["Hola", "mundo"])]
    with_title, without = {"seed": 7, "intro": {"title": "T"}}, {"seed": 7, "intro": {}}
    sa.adapt_config(with_title, rules, content, song, 40.0)
    sa.adapt_config(without, rules, content, song, 40.0)
    assert with_title["timeline"][0]["type"] == "intro"
    assert all(s.get("type") != "intro" for s in without["timeline"])
    intro_text = [i for i in sa._scene_items(with_title["timeline"][0], "pieces") if i.get("k") == "text"]
    assert all(i.get("intro") for i in intro_text)           # el texto de letra de la intro no se conserva


# ---------------------------------------------------------------- degradación

def test_empty_recipes_fall_back_to_transcription_only():
    rules = _rules("els")
    rules["respaldo"] = {"config": {"layouts": {"holoWord": {"weight": 1}}}}
    case = {"seed": 7, "timeline": [{"t0": 0}]}
    report = sa.adapt_config(case, rules, {}, _song(), 40.0)
    assert "timeline" not in case and case["layouts"] == {"holoWord": {"weight": 1}}
    assert report["modo"] == "solo_transcripcion"


def test_instrumental_song_still_gets_a_valid_timeline():
    content, rules = _content("els"), _rules("els")
    song = {"metadata": {"audio_duration_sec": 30.0}, "segments": []}
    case = {"seed": 7}
    report = sa.adapt_config(case, rules, content, song, 30.0)
    assert report["estado"] == "instrumental"
    assert case["timeline"][-1]["type"] == "outro"
    letters = [i["t"] for s in case["timeline"] for i in _texts(s, "els") if re.search(r"[A-Za-z]", i["t"])]
    assert letters == []                                      # decoración sí; letra de la referencia, nunca


def test_quality_report_flags_low_coverage_and_language():
    rules = _rules("els")
    song = _song(300.0)
    song["metadata"]["language_probability"] = 0.3
    report = sa.adapt_config({"seed": 7}, rules, _content("els"), song, 300.0)
    assert report["estado"] == "rehacer"
    assert any("volver a transcribir" in a or "vuelve a transcribir" in a for a in report["avisos"])


def test_declared_language_overrides_detection():
    rules = _rules("els")
    song = _song()
    song["metadata"]["language_probability"] = 0.2
    report = sa.adapt_config({"seed": 7}, rules, _content("els"), song, 40.0, declared_language="es")
    assert report["confianzaIdioma"] == 1.0


def test_timeline_is_deterministic():
    content, rules = _content("els"), _rules("els")
    a, b = {"seed": 7}, {"seed": 7}
    sa.adapt_config(a, rules, content, _song(), 40.0)
    sa.adapt_config(b, rules, content, _song(), 40.0)
    assert a["timeline"] == b["timeline"]


# ---------------------------------------------------------------- plantillas reales

@pytest.mark.parametrize("template_id", ADAPTED)
def test_real_templates_have_rules_and_clean_static_content(template_id):
    root = TEMPLATES / template_id
    if not (root / sa.RULES_FILE).is_file():
        pytest.skip("plantilla no presente en este checkout")
    rules, content = sa.load_rules(root), sa.load_content(root)
    assert rules is not None and content.get("recetas")
    for recipe in content["recetas"]:
        for slot in recipe["ranuras"]:
            item = sa._scene_items(recipe["escena"], rules["esquema"])[slot["i"]]
            assert item[sa._text_field(item, rules["esquema"])] == ""
    # el contenido estático corresponde al guion de la demo (se regenera con `extraer`)
    raw = json.loads((root / "assets" / "config.json").read_text(encoding="utf-8"))
    timeline = (raw.get("configs") or [raw])[0]["timeline"]
    assert sa.extract_recipes(timeline, rules["esquema"]) == content


def test_templates_without_rules_are_untouched(tmp_path):
    assert sa.load_rules(tmp_path) is None


def test_dense_well_transcribed_song_is_ok():
    song = {"metadata": {"audio_duration_sec": 20.0, "language": "es", "language_probability": 0.99},
            "segments": [_seg(0.5 + i * 3.0, ["una", "frase", "de", "prueba", "con", "siete", "palabras"]) for i in range(6)]}
    report = sa.adapt_config({"seed": 7}, _rules("els"), _content("els"), song, 20.0)
    assert report["estado"] == "ok" and report["cobertura"] >= 0.5


def test_low_coverage_with_trusted_language_is_instrumental_not_redo():
    song = _song(300.0)                                       # idioma es con confianza 0,99 y 4 frases en 300 s
    report = sa.adapt_config({"seed": 7}, _rules("els"), _content("els"), song, 300.0)
    assert report["estado"] == "revisar"
    assert any("instrumentales" in a for a in report["avisos"])


def _letters(scene, schema):
    return [i[sa._text_field(i, schema)] for i in _texts(scene, schema) if re.search(r"[A-Za-z]", i[sa._text_field(i, schema)])]


@pytest.mark.parametrize("schema", ["els", "pieces"])
def test_gap_messages_come_from_the_song_not_from_the_reference(schema):
    content, rules = _content(schema), _rules(schema)
    song = {"metadata": {"audio_duration_sec": 60.0, "language": "es", "language_probability": 1},
            "segments": [_seg(2.0, ["Te", "estoy", "corriendo"]), _seg(30.0, ["Te", "estoy", "corriendo"]), _seg(40.0, ["Dame", "tu", "mano"])]}
    case = {"seed": 7, "intro": {}, "outro": {}}
    sa.adapt_config(case, rules, content, song, 60.0, "es", {"titulo": "Mi Canción", "artista": "Alguien"})
    gap_scenes = [sc for sc in case["timeline"] if 8 <= sc["t0"] <= 27 and _letters(sc, schema)]
    assert gap_scenes, "debe haber un mensaje en el hueco largo"
    allowed = {"te", "estoy", "corriendo", "dame", "tu", "mano", "mi", "canción", "alguien", "nodemotion"}  # nodemotion = marca del outro
    words = {w.lower() for sc in case["timeline"] for t in _letters(sc, schema) for w in t.split()}
    assert words <= allowed, words - allowed                  # nada que no sea de la canción


def test_messages_can_be_disabled_and_custom_ones_added():
    content, rules = _content("els"), _rules("els")
    song = {"metadata": {"audio_duration_sec": 60.0, "language": "es", "language_probability": 1}, "segments": [_seg(2.0, ["Hola", "mundo", "bonito"])]}
    off = sa._merge(rules, {"mensajes": {"activo": False}})
    a = {"seed": 7}
    sa.adapt_config(a, off, content, song, 60.0, "es", {"titulo": "T", "artista": "A"})
    words = {w for sc in a["timeline"] for t in _letters(sc, "els") for w in t.split()}
    assert words <= {"Hola", "mundo", "bonito"}
    on = sa._merge(rules, {"mensajes": {"propios": ["Escucha bien"], "maxPorHueco": 3}})
    b = {"seed": 7}
    sa.adapt_config(b, on, content, song, 60.0, "es", {"titulo": "", "artista": ""})
    assert any("Escucha bien" in t for sc in b["timeline"] for t in _letters(sc, "els"))


def test_demo_intro_texts_are_replaced_by_the_real_song():
    rules = _rules("pieces")
    rules["intro"] = {"valoresDemo": ["Double Control", "Pista de demostración"]}
    song = {"metadata": {"audio_duration_sec": 40.0, "language": "es", "language_probability": 1}, "segments": [_seg(5.0, ["Hola", "mundo"])]}
    case = {"seed": 7, "intro": {"enabled": True, "title": "Double Control", "artist": "Pista de demostración"}}
    sa.adapt_config(case, rules, _content("pieces"), song, 40.0, "es", {"titulo": "Mi Canción", "artista": ""})
    assert case["intro"]["title"] == "Mi Canción" and case["intro"]["artist"] == ""
    intro = case["timeline"][0]
    kept = [p.get("intro") for p in sa._scene_items(intro, "pieces") if p.get("k") == "text"]
    assert "artist" not in kept                               # sin artista no queda un texto vacío


def test_truncated_intro_title_is_completed():
    rules = _rules("els")
    case = {"seed": 7, "intro": {"title": "LATIN MAFIA, Fred again.. Te Estoy Corre", "artist": "LATIN MAFIA, Fred again.."}}
    sa.adapt_config(case, rules, _content("els"), _song(), 40.0, "es", {"titulo": "Te Estoy Correteando", "artista": "LATIN MAFIA, Fred again.."})
    assert case["intro"]["title"] == "Te Estoy Correteando"
