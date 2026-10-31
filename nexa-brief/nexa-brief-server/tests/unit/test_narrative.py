"""Narrativas de los explainers: datos, servicio, prompts, video, checks, API, producción y kit.

Usan los JSON reales de src/skills/explainer/strategies/narrative/ (o una copia para romperlos).
"""

from __future__ import annotations

import importlib.util
import json
import shutil
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.adapters.narrative.factory import narrative_dir
from src.adapters.narrative.json_repository import JsonNarrativeRepository
from src.core.explainer import narrative
from src.core.explainer.briefs import ExplainerBrief, generate_brief
from src.core.explainer.narrative import DOCUMENTAL_ID, NarrativeInvalid, NarrativeNotFound, NarrativeService
from src.core.explainer.narrative.models import RetentionTechnique
from src.core.explainer.producer import build_agent_prompt
from tests.unit.test_explainer_production import BRIEF, _FakeAI, _producer

AMARILLISTA = "narrative_amarillista_v1"
KIT_TOOLS = Path(__file__).resolve().parents[2] / "src" / "templates" / "_tools" / "explainer-kit" / "tools"


@pytest.fixture
def broken_copy(tmp_path: Path):
    """Servicio sobre una copia de la carpeta, para romper archivos sin tocar los reales."""
    root = tmp_path / "narrative"
    shutil.copytree(narrative_dir(), root)
    service = NarrativeService(JsonNarrativeRepository(root))
    narrative.set_service(service)
    yield root, service
    narrative.set_service(None)


def _edit(path: Path, **changes) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data.update(changes)
    path.write_text(json.dumps(data), encoding="utf-8")


# ── datos y servicio ──────────────────────────────────────────────────────────


def test_every_narrative_json_is_valid():
    repo = JsonNarrativeRepository(narrative_dir())
    ids = repo.list_ids()
    assert {DOCUMENTAL_ID, AMARILLISTA} <= set(ids)
    for narrative_id in ids:
        assert repo.load(narrative_id).id == narrative_id


def test_amarillista_is_the_default_everywhere():
    service = narrative.get_service()
    for category in ("node_tech", "node_history", "node_politics", "_default"):
        assert service.default_id(category) == AMARILLISTA
    story = service.resolve("node_tech")
    assert story is not None and story.title is not None and story.title.default_level == "negro"


def test_retention_schema_is_strict_and_black_titles_are_short():
    story = narrative.get_service().get(AMARILLISTA)
    assert {technique.id for technique in story.retention} == {
        "revelacion_postergada", "lista_de_peligro", "micro_bucles", "pregunta_tramposa", "conexion_oculta"
    }
    with pytest.raises(ValidationError):
        RetentionTechnique(id="micro_bucles", name="Microbucles", act="todo_video", how="Abrir otra duda", example="NodeTech", typo="extra")
    black = story.title.levels["negro"]
    assert set(black.examples) == {"node_tech", "node_history", "node_politics"}
    assert all(len(title) <= 60 for titles in black.examples.values() for title in titles)
    assert all(len(black.examples[category]) == 3 for category in black.examples)


def test_thumbnail_schema_requires_c_and_a_title(broken_copy):
    root, service = broken_copy
    path = root / f"{AMARILLISTA}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert service.get(AMARILLISTA).thumbnail.preferred_option == "C"
    assert service.get(AMARILLISTA).thumbnail.max_words == 6
    for change, field in (({"preferred_option": "B"}, "thumbnail.preferred_option"),
                          ({"max_words": 7}, "thumbnail.max_words"),
                          ({"typo": True}, "thumbnail.typo")):
        bad = json.loads(json.dumps(data))
        bad["thumbnail"].update(change)
        path.write_text(json.dumps(bad), encoding="utf-8")
        with pytest.raises(NarrativeInvalid) as exc:
            service.get(AMARILLISTA)
        assert exc.value.field == field
    data.pop("title")
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(NarrativeInvalid, match="thumbnail necesita"):
        service.get(AMARILLISTA)


def test_acts_have_no_seconds_or_percentages(broken_copy):
    root, service = broken_copy
    data = json.loads((root / f"{AMARILLISTA}.json").read_text(encoding="utf-8"))
    data["acts"][1]["start"] = 10
    (root / f"{AMARILLISTA}.json").write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(NarrativeInvalid) as exc:
        service.get(AMARILLISTA)
    assert exc.value.field == "acts.1.start" and AMARILLISTA in str(exc.value)


def test_id_must_match_file_and_unknown_id_is_not_found(broken_copy):
    root, service = broken_copy
    _edit(root / f"{AMARILLISTA}.json", id="narrative_otra_v1")
    with pytest.raises(NarrativeInvalid, match="distinto del nombre"):
        service.get(AMARILLISTA)
    with pytest.raises(NarrativeNotFound):
        service.resolve("node_tech", "narrative_no_existe_v1")


def test_checks_must_name_existing_acts(broken_copy):
    root, service = broken_copy
    data = json.loads((root / f"{AMARILLISTA}.json").read_text(encoding="utf-8"))
    data["checks"]["order"].append("inventado")
    (root / f"{AMARILLISTA}.json").write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(NarrativeInvalid, match="inventado"):
        service.get(AMARILLISTA)


def test_broken_folder_falls_back_to_legacy_and_list_skips_bad_files(broken_copy):
    root, service = broken_copy
    (root / f"{AMARILLISTA}.json").write_text("{roto", encoding="utf-8")
    assert [s.id for s in service.list()] == [DOCUMENTAL_ID]
    assert service.resolve("node_tech") is None          # default roto: comportamiento de siempre
    shutil.rmtree(root)
    assert service.list() == [] and service.resolve("node_tech") is None


# ── prompts ───────────────────────────────────────────────────────────────────


def test_documentary_leaves_prompts_untouched():
    story = narrative.get_service().get(DOCUMENTAL_ID)
    assert story.thumbnail is None
    assert narrative.brief_context(story, "node_tech", None) is None
    assert narrative.production_lines(story, "node_tech", None) == []


def test_amarillista_prompts_carry_acts_titles_and_question():
    story = narrative.get_service().get(AMARILLISTA)
    ctx = narrative.brief_context(story, "node_tech", None)
    assert ctx["titulos"]["nivel"] == "negro" and ctx["titulos"]["ejemplos"]
    assert len(ctx["retention"]) == 5 and "primer tramo" in ctx["retention"][0]["how"]
    assert [a["acto"] for a in ctx["actos"]][:3] == ["titulo", "golpe", "miedo"]
    assert "segundo" not in json.dumps(ctx["actos"], ensure_ascii=False)
    assert narrative.brief_context(story, "node_tech", "basico")["titulos"]["nivel"] == "basico"
    assert ctx["miniatura"]["preferred_option"] == "C"
    assert ctx["miniatura"]["max_words"] == 6
    assert "EXCLUSIVO" in " ".join(ctx["miniatura"]["rules"])
    lines = "\n".join(narrative.production_lines(story, "node_tech", "medio"))
    assert "golpe" in lines and "common.question" in lines and "on_screen_question" in lines
    assert "nivel «Medio»" in lines and "pinned_comment" in lines
    assert "pregunta_tramposa" in lines and "guía editorial" in lines
    assert "common.tabloid" in lines and 'thumbnail.chosen: "tabloid"' in lines
    assert "thumbnail.tabloid" in lines and "publishing build <id>" in lines
    assert "Test & Compare" in lines and "focus" in lines
    prompt = build_agent_prompt({"video_id": "test", "design": "rough", "category_path": "node_tech",
                                 "topic": "IA", "narrative_id": AMARILLISTA}, Path("/tmp/test"))
    for act in story.spoken_acts:
        assert act.function in lines and act.function in prompt
        assert all(rule in lines and rule in prompt for rule in act.rules)
        assert next(a for a in ctx["actos"] if a["acto"] == act.id)["reglas"] == act.rules
        if tones := story.voice.allowed_tones.get(act.id):
            assert f"Tonos permitidos: {', '.join(tones)}" in prompt


def test_brief_receives_only_selected_title_level_examples():
    story = narrative.get_service().get(AMARILLISTA)
    for category in ("node_tech", "node_history", "node_politics"):
        for level in ("basico", "medio", "alto", "negro"):
            ctx = narrative.brief_context(story, category, level)
            assert ctx["titulos"]["ejemplos"] == story.title.levels[level].examples[category]
            assert "titles" not in ctx["ejemplo_de_tono"]


async def test_brief_uses_default_narrative_and_title_level():
    ai = _FakeAI(BRIEF)
    brief = await generate_brief(ai, category_path="node_tech", topic="La IA y los despidos")
    payload = json.loads(ai.prompts[0][1])
    assert brief.narrative_id == AMARILLISTA and brief.title_level == "negro"
    assert payload["narrativa"]["id"] == AMARILLISTA
    assert len(payload["narrativa"]["retention"]) == 5
    documental = _FakeAI(BRIEF)
    brief = await generate_brief(documental, category_path="node_tech", topic="Apolo", narrative_id=DOCUMENTAL_ID)
    assert "narrativa" not in json.loads(documental.prompts[0][1]) and brief.narrative_id == DOCUMENTAL_ID


async def test_brief_rejects_unknown_narrative():
    with pytest.raises(ValueError, match="narrative_x_v1"):
        await generate_brief(_FakeAI(BRIEF), category_path="node_tech", topic="IA", narrative_id="narrative_x_v1")


# ── video, producción y publicación ───────────────────────────────────────────


async def test_production_records_narrative_in_the_video(tmp_path: Path):
    producer, agent, _, videos = _producer(tmp_path)
    rec = await producer.submit(
        category_path="node_tech", design="rough", topic="La IA y los despidos",
        brief=ExplainerBrief.model_validate(BRIEF), title_level="medio",
    )
    await producer.wait(rec["production_id"])
    assert rec["narrative_id"] == AMARILLISTA and rec["title_level"] == "medio"
    video = videos / rec["video_id"]
    config = json.loads((video / "assets" / "config.json").read_text())
    active = config["configs"][0] if "configs" in config else config
    assert active["narrative_id"] == AMARILLISTA and active["title_level"] == "medio"
    assert json.loads((video / "manifest.json").read_text())["narrative_label"] == "Amarillista"
    assert json.loads((video / "publish.json").read_text())["strategies_used"]["narrative"] == AMARILLISTA
    assert "NARRATIVA DEL GUION" in agent.runs[0]["prompt"]
    assert "common.tabloid" in agent.runs[0]["prompt"]
    assert AMARILLISTA in (video / "BRIEF.md").read_text()


def test_legacy_record_without_narrative_keeps_the_old_prompt(tmp_path: Path):
    rec = {"video_id": "v1", "design": "binary", "category_path": "node_tech", "topic": "IA"}
    assert "NARRATIVA DEL GUION" not in build_agent_prompt(rec, tmp_path / "v1")
    assert narrative.recorded(tmp_path / "v1").narrative_id is None


def _video_with_question(tmp_path: Path, question: str) -> Path:
    video = tmp_path / "v"
    (video / "assets").mkdir(parents=True)
    (video / "assets" / "config.json").write_text(json.dumps({"narrative_id": AMARILLISTA}))
    script = {"segments": [{"id": "s09", "act": "pregunta", "text": "…", "on_screen_question": question}]}
    (video / "assets" / "script.json").write_text(json.dumps(script, ensure_ascii=False))
    return video


def test_pinned_comment_must_repeat_the_video_question(tmp_path: Path):
    video = _video_with_question(tmp_path, "¿Te quita trabajo o te lo ahorra?")
    ok = "Dato extra: x. ¿Te quita trabajo o te lo ahorra? ¿Qué tema seguimos?"
    assert narrative.pinned_question_issue(video, ok) is None
    bad = narrative.pinned_question_issue(video, "Dato extra: x. ¿Qué opinas? ¿Qué tema seguimos?")
    assert bad and "Te quita trabajo" in bad
    assert narrative.pinned_question_issue(tmp_path, "¿Qué opinas?") is None   # video sin narrativa


# ── kit: forma del guion ──────────────────────────────────────────────────────


def _kit_check():
    spec = importlib.util.spec_from_file_location("narrative_check", KIT_TOOLS / "narrative_check.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.check


def test_kit_check_validates_shape_not_durations(tmp_path: Path):
    check = _kit_check()
    seg = lambda i, act, intensity, **kw: {"id": f"s{i:02d}", "act": act, "intensity": intensity, "tone": kw.pop("tone", "x"), "text": kw.pop("text", "t"), **kw}  # noqa: E731
    good = {"segments": [
        seg(1, "golpe", 0.95, tone="alarma", text="Tu voz se clona con tres segundos."), seg(2, "miedo", 0.9, tone="alarma"), seg(3, "estudio", 0.8), seg(4, "giro", 0.5),
        seg(5, "verdad", 0.4), seg(6, "verdad", 0.45), seg(7, "que_hacer", 0.4),
        seg(8, "pregunta", 0.5, tone="cercano", on_screen_question="¿Te quita trabajo o te lo ahorra?"),
    ]}
    storyboard = {"beats": [{"use": "common.question", "at": "ahora te pregunto", "until": "gracias por ver",
                             "params": {"text": "¿Te quita trabajo o te lo ahorra?"}}]}
    errs: list[str] = []
    check(tmp_path, {"narrative_id": AMARILLISTA}, good, storyboard, errs)
    assert errs == []

    bad = {"segments": [seg(1, "giro", 0.5), seg(2, "golpe", 0.9), seg(3, "pregunta", 0.5)]}
    errs = []
    check(tmp_path, {"narrative_id": AMARILLISTA}, bad, {"beats": []}, errs)
    text = "\n".join(errs)
    assert "fuera de orden" in text and "faltan actos" in text and "intensity 0.5" in text
    assert "on_screen_question" in text and "common.question" in text

    errs = []
    check(tmp_path, {}, bad, {"beats": []}, errs)      # video anterior: sin narrativa, sin checks
    assert errs == []


# ── API ───────────────────────────────────────────────────────────────────────


async def test_route_options_list_narratives_with_default(api_client):
    r = await api_client.get("/api/v1/explainer/options?category=node_tech")
    assert r.status_code == 200
    data = r.json()
    assert data["default_narrative"] == AMARILLISTA
    amarillista = next(n for n in data["narratives"] if n["id"] == AMARILLISTA)
    assert amarillista["default_title_level"] == "negro"
    assert {lvl["id"] for lvl in amarillista["title_levels"]} == {"basico", "medio", "alto", "negro"}
    assert amarillista["acts"][1] == {"id": "golpe", "name": "Golpe", "weight": "apertura", "intensity": "maxima", "spoken": True}


async def test_route_options_survive_a_broken_narrative_folder(api_client, broken_copy):
    root, _ = broken_copy
    shutil.rmtree(root)
    r = await api_client.get("/api/v1/explainer/options")
    assert r.status_code == 200 and r.json()["narratives"] == [] and r.json()["default_narrative"] is None


def test_no_title_examples_from_another_category_and_photo_criteria():
    story = narrative.get_service().get(AMARILLISTA)
    ctx = narrative.brief_context(story, "node_economy", "negro")
    assert ctx["titulos"]["ejemplos"] == []
    assert ctx["titulos"]["criterios_imagen"]
    lines = narrative.production_lines(story, "node_economy", "negro")
    title_line = next(line for line in lines if line.startswith("Títulos y miniaturas"))
    assert "Ejemplos:" not in title_line
    assert "rostro humano" in title_line


def test_script_rules_reject_hedges_and_bad_voice_but_allow_named_attribution_and_quotes(tmp_path):
    check = _kit_check()
    cfg = {"narrative_id": AMARILLISTA}
    def run(text, tone="alarma"):
        errors = []
        script = {"segments": [{"id": "s01", "act": "golpe", "tone": tone, "intensity": 1, "text": text}]}
        check(tmp_path, cfg, script, {"beats": []}, errors)
        return "\n".join(errors)
    bad = run("Quizás podría ocurrir algo.", "suspenso")
    assert "cobertura" in bad and "segunda persona" in bad and "cifra" in bad and "tone" in bad
    good = run("Según Microsoft, tu voz podría clonarse con tres segundos. «Tal vez» es una cita.")
    assert "cobertura" not in good and "segunda persona" not in good and "cifra" not in good and "tone" not in good
    assert "cobertura" in run("Según un estudio, tu voz podría clonarse con tres segundos.")
    assert "cobertura" in run('«Según Microsoft» tu voz podría clonarse con tres segundos.')
    errors = []
    check(tmp_path, {"narrative_id": DOCUMENTAL_ID}, {"segments": []}, {}, errors)
    assert not any("cobertura" in e or "tone" in e for e in errors)


def test_quality_blocks_real_failures_and_accepts_corrected_storyboard(tmp_path, monkeypatch):
    import sys
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker
    asset = tmp_path / "assets" / "components"
    asset.mkdir(parents=True)
    (asset / "one.js").write_text('Kit.register({name: "rough.one"})')
    def beat(i, use, text=None):
        return {"i": i, "use": use, "layer": "main", "t0": i, "t1": i + 1,
                "b": {"params": {"text": text} if text else {}}, "wi": i}
    beats = [beat(0, "rough.icon"), beat(1, "rough.icon"), beat(2, "rough.icon"), beat(3, "common.lyric")]
    words = [{"s": 3, "t": "cortado", "n": "cortado"}]
    errs = []
    q = checker.quality_check(tmp_path, {}, {}, beats, words, 60, errs)
    assert q["icon_share"] == .75 and q["lyric_cuts"] == 1
    assert any("seguidos" in e for e in errs) and any("one.js" in e for e in errs)
    assert any("corta la frase" in e for e in errs)
    beats = [beat(0, "rough.one"), beat(1, "rough.photo"), beat(2, "common.punch", "DATO REAL"), beat(3, "common.lyric", "Frase completa")]
    beats[1]["b"]["params"] = {"src": "assets/media/foto.jpg"}
    errs = []
    q = checker.quality_check(tmp_path, {}, {}, beats, words, 60, errs)
    assert not errs and q["custom_components_used"] == 1 and q["lyric_cuts"] == 0


def test_long_text_needs_complete_window_and_empty_lyric_window_is_error(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker
    beats = [
        {"i": 1, "use": "common.lyric", "layer": "main", "t0": 0, "t1": 1,
         "b": {"params": {"text": "una dos tres cuatro cinco seis siete ocho"}}, "wi": 0},
        {"i": 2, "use": "common.lyric", "layer": "main", "t0": 2, "t1": 3,
         "b": {"params": {}}, "wi": 1},
    ]
    errors = []
    quality = checker.quality_check(tmp_path, {}, {}, beats, [{"s": 0, "t": "Termina."}], 60, errors)
    assert quality["lyric_cuts"] == 1
    assert not any("#1" in e for e in errors)
    assert any("#2" in e and "sin palabras" in e for e in errors)


def test_media_rate_recognizes_catalog_images_across_designs(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import check_storyboard as checker
    def beat(i, use, params):
        return {"i": i, "use": use, "layer": "main", "t0": i, "t1": i + 1,
                "b": {"params": params}, "wi": i}
    beats = [beat(0, "acuarela.photo", {"src": "foto.jpg"}),
             beat(1, "carta.retrato", {"src": "retrato.jpg"}),
             beat(2, "rough.photo", {}), beat(3, "rough.icon", {"icon": "phone"})]
    errors = []
    quality = checker.quality_check(tmp_path, {}, {}, beats, [], 120, errors)
    assert quality["media_per_min"] == 1.0
    assert not any("fotos/clips por minuto" in error for error in errors)


def test_manifest_requires_passing_quality_check(tmp_path, monkeypatch):
    import types
    monkeypatch.syspath_prepend(str(KIT_TOOLS))
    import kit
    video = tmp_path / "video"
    assets = video / "assets"
    assets.mkdir(parents=True)
    (video / "render").mkdir()
    (assets / "song.mp3").write_bytes(b"audio")
    (assets / "config.json").write_text(json.dumps({"design": "rough"}))
    (assets / "script.json").write_text(json.dumps({"segments": [{"id": "s1", "tone": "alarma", "text": "texto"}]}))
    (assets / "storyboard.json").write_text(json.dumps({"beats": [{"use": "rough.photo"}] * 15}))
    (assets / "lyrics.json").write_text(json.dumps({"segments": [{"words": [{"word": "texto"}]}]}))
    monkeypatch.setattr(kit, "vdir", lambda _: video)
    monkeypatch.setattr(kit, "audio_dur", lambda _: 60)
    monkeypatch.setattr(kit.outro_tool, "spec_for", lambda _: None)
    monkeypatch.setattr(kit, "chapter_times", lambda *_: [])
    def run_failed(*args, **kwargs):
        (video / "manifest.json").write_text(json.dumps({"quality": {"icon_share": 0.6}}))
        return types.SimpleNamespace(returncode=1, stdout="  ✗ demasiados iconos", stderr="")
    monkeypatch.setattr(kit, "run", run_failed)
    kit.cmd_manifest(types.SimpleNamespace(id="video"))
    manifest = json.loads((video / "manifest.json").read_text())
    assert manifest["status"] == "en progreso" and manifest["quality"]["icon_share"] == 0.6


def test_repeat_limits_count_custom_components_and_photos(tmp_path):
    import check_storyboard as checker
    components = tmp_path / "assets/components"
    components.mkdir(parents=True)
    (components / "custom.js").write_text('name: "rough.custom"')
    catalog = {"rough.custom": {"params": {"src": {"type": "image"}}}}
    def make(count, total):
        return [{"i": i, "use": "rough.custom", "layer": "main", "t0": i, "t1": i+1,
                 "b": {"params": {"src": "assets/media/misma.jpg"}}} for i in range(count)] + [
                     {"i": i, "use": "rough.other", "layer": "main", "t0": i, "t1": i+1,
                      "b": {"params": {}}} for i in range(count, total)]
    errors = []
    checker.quality_check(tmp_path, {}, {}, make(6, 100), [], 60, errors, catalog)
    assert not any("usos (" in e for e in errors)
    errors = []
    checker.quality_check(tmp_path, {}, {}, make(7, 100), [], 60, errors, catalog)
    assert sum("usos (" in e for e in errors) == 2
    errors = []
    checker.quality_check(tmp_path, {}, {}, make(2, 10), [], 60, errors, catalog)
    assert sum("usos (" in e for e in errors) == 2


def test_repeat_limits_do_not_flag_approved_videos():
    import check_storyboard as checker
    from pathlib import Path
    for name in ("ia-despidos-programadores-amazon", "apolo-1202"):
        video = Path("src/templates/nodetech") / name
        board = json.loads((video / "assets/storyboard.json").read_text())
        beats = [{"i": i, "use": b["use"], "layer": "main", "t0": i, "t1": i+1, "b": b}
                 for i, b in enumerate(board["beats"])]
        errors = []
        checker.quality_check(video, {}, {}, beats, [], 600, errors)
        assert not [e for e in errors if "usos (" in e], (name, errors)
