import json
from types import SimpleNamespace

import pytest

from src.core.explainer import cara_a_cara_production as cara
from src.core.explainer import native_production as native
from src.core.explainer.batches import PreparationItem
from src.presentation.api.schemas.explainer_schema import ProductionResponse


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def publish_copy():
    return {field: "Texto corto para esta plataforma" for field in cara.PUBLICATION_LIMITS}


def record(character="nara", voice="Sulafat"):
    editorial = {"id": character, "voz": {"nombre": voice, "modelo": "gemini-3.8-flash-tts",
                                         "direccion": "Cálida, directa, español latinoamericano"}}
    return {"design": "cara-a-cara", "character_id": character, "character_identity": editorial,
            "topic": "Datos del espacio", "target_minutes": 2, "short_test": True,
            "estilo": "mobile", "style_revision": "1"}


@pytest.mark.parametrize("character,voice", [("nara", "Sulafat"), ("alma", "Sulafat"), ("leo", "Puck")])
def test_scaffold_snapshots_selected_identity_and_reuses_engine(tmp_path, character, voice):
    root = tmp_path / "episode"
    cara.scaffold(record(character, voice), root)
    script = json.loads((root / "assets/script.json").read_text())
    assert script["voice"] == voice
    assert script["voice_direction"] == record()["character_identity"]["voz"]["direccion"]
    assert json.loads((root / "assets/character-identity.json").read_text())["id"] == character
    assert script["format"] == "short_preparation"
    assert "bundled/sandbox/nodeaction/_pizarra/comparacion.js" in (root / "index.html").read_text()
    assert not (root / "engine").exists()
    assert not (root / "assets/avatar").exists()


def test_registration_and_contracts_are_explicit():
    assert "cara-a-cara" in native.NATIVE_DESIGNS
    item = PreparationItem(category_path="node_actualidad", design="cara-a-cara", topic="Tema real",
                           character_id="alma", agent="claude", minutes=2, short_test=True)
    assert item.character_id == "alma"
    assert "character_id" in ProductionResponse.model_fields
    assert "usage_totals" in ProductionResponse.model_fields
    assert native.selected_style("cara-a-cara")[0]["id"] == "mobile"
    with pytest.raises(ValueError):
        native.selected_style("cara-a-cara", "invented")
    with pytest.raises(ValueError):
        cara.identity("../../other")


def test_prompt_keeps_character_voice_isolation_and_direct_opening():
    text = native.prompt(record(), "storyboard")
    assert "character:'nara'" in text
    assert "leo-comparaciones-v1" in text  # shared layout id, separate from character
    assert "Sin saludo, nombre, presentación" in text
    assert "No ejecutes CLI" in text
    assert "single para noticias y datos" in text
    assert "work/media-selection.json" in native.prompt(record(), "media_seleccion")


@pytest.fixture
def prepared(tmp_path, monkeypatch):
    root, rec = tmp_path / "episode", record()
    cara.scaffold(rec, root)
    dump(root / "publish.json", publish_copy())
    for i in range(4):
        (root / f"assets/media/photo{i}.jpg").write_bytes(b"photo")
    dump(root / "assets/scene.json", {
        "profile_id": cara.PROFILE, "end": 120,
        "subjects": [{"id": "one", "src": "assets/media/photo0.jpg"}],
        "shots": [{"t": i * 10, "mode": "single", "character": "nara",
                   "subjects": [{"id": "one", "src": f"assets/media/photo{i % 4}.jpg"}]} for i in range(12)],
    })
    dump(root / "assets/lyrics.json", {"segments": [{"words": [
        {"word": "El", "start": 0.2, "end": 0.4}, {"word": "universo", "start": 0.4, "end": 0.8}]}]})
    monkeypatch.setattr(cara, "_audio_duration", lambda _: 120)
    return root, rec


def test_native_validation_accepts_real_whisper_shape(prepared):
    root, rec = prepared
    result = cara.validate_prepared(rec, root, require_marker=False)
    assert result == {"duration_seconds": 120, "shots": 12, "media": 4,
                      "character_id": "nara", "voice": "Sulafat", "format": "9x16"}


@pytest.mark.parametrize("failure", ["wrong_character", "wrong_voice", "escape", "duration", "sparse", "identity", "pose", "overlay_duration", "singular_subject", "null_subject_src", "unknown_subject_id"])
def test_native_validation_rejects_cross_character_and_incomplete_data(prepared, failure, monkeypatch):
    root, rec = prepared
    scene = json.loads((root / "assets/scene.json").read_text())
    if failure == "wrong_character":
        scene["shots"][0]["character"] = "leo"
    elif failure == "escape":
        scene["subjects"][0]["src"] = "../../other.jpg"
    elif failure == "duration":
        monkeypatch.setattr(cara, "_audio_duration", lambda _: 310)
    elif failure == "sparse":
        scene["shots"] = scene["shots"][:1]
    elif failure == "pose":
        scene["shots"][0]["pose"] = "invented"
    elif failure == "overlay_duration":
        dump(root / "assets/overlays.json", {"items": [{"subject": "one", "kind": "photo", "src": "assets/media/photo0.jpg", "at": 0}]})
    elif failure == "singular_subject":
        scene["shots"][0]["subject"] = "one"
    elif failure == "null_subject_src":
        scene["shots"][0]["subjects"][0]["src"] = None
    elif failure == "unknown_subject_id":
        scene["shots"][0]["subjects"][0]["id"] = "not-registered"
    elif failure == "identity":
        dump(root / "assets/character-identity.json", {"id": "nara", "voz": {"nombre": "Puck"}})
    else:
        script = json.loads((root / "assets/script.json").read_text())
        script["voice"] = "Puck"
        dump(root / "assets/script.json", script)
    dump(root / "assets/scene.json", scene)
    with pytest.raises(ValueError):
        cara.validate_prepared(rec, root, require_marker=False)


def test_anchors_require_unique_exact_word_sequence():
    words = [{"word": "El", "start": 0.1}, {"word": "universo", "start": 0.5}]
    assert cara._resolve_time("@El universo", words) == 0.1
    with pytest.raises(ValueError):
        cara._resolve_time("@El", words + [{"word": "El", "start": 1}])


def test_technical_validation_never_grants_editorial_approval(prepared, monkeypatch):
    root, rec = prepared
    from src.core.explainer import render_paths
    monkeypatch.setattr(cara, "validate_prepared", lambda *a, **kw: {"duration_seconds": 120})
    monkeypatch.setattr(render_paths, "full_render_files", lambda _: [root / "render.mp4"])
    assert cara.refresh_manifest(root, "video")["status"] == "en progreso"
    manifest = json.loads((root / "manifest.json").read_text())
    manifest["status"] = "listo"
    dump(root / "manifest.json", manifest)
    assert cara.refresh_manifest(root, "video")["status"] == "renderizado"


@pytest.mark.asyncio
async def test_host_uses_selected_voice_direction_and_resume_spends_no_more_calls(tmp_path, monkeypatch):
    from src.core.explainer import producer, host_media
    from src.core.ports.agent_port import AgentRunResult
    from src.core import content_registry

    rec = {**record(), "production_id": "prod", "video_id": "video", "agent": "claude",
           "log_path": str(tmp_path / "run.log")}
    episodes = tmp_path / "episodes"
    root = episodes / "video"
    calls, phases = [], []

    async def update(ident, **fields):
        phases.append(fields)

    async def agent(rec, root, log, scope, timeout, phase, **kwargs):
        calls.append(phase)
        assert scope.commands == () and scope.writable_dir == str(root.resolve())
        if phase == "guion":
            script = json.loads((root / "assets/script.json").read_text())
            script["segments"] = [{"id": "s1", "text": "El universo tiene datos interesantes", "tone": "cercano", "intensity": 0.6}]
            dump(root / "assets/script.json", script)
            dump(root / "publish.json", publish_copy())
            dump(root / "work/media-requests.json", {"version": 1, "requests": []})
        elif phase == "storyboard":
            for i in range(4):
                (root / f"assets/media/photo{i}.jpg").write_bytes(b"photo")
            dump(root / "assets/scene.json", {
                "profile_id": cara.PROFILE, "end": 120,
                "subjects": [{"id": "one", "src": "assets/media/photo0.jpg"}],
                "shots": [{"t": i * 10, "mode": "single", "character": "nara",
                           "subjects": [{"id": "one", "src": f"assets/media/photo{i % 4}.jpg"}]} for i in range(12)],
            })
        return AgentRunResult(0, "done", 0)

    async def command(argv, log, timeout):
        calls.append(Path(argv[1]).name)
        if Path(argv[1]).name == "narrate.py":
            assert argv[argv.index("--voice") + 1] == "Sulafat"
            design = json.loads(Path(argv[argv.index("--design") + 1]).read_text())
            assert design["voice"]["base"] == rec["character_identity"]["voz"]["direccion"]
            assert "atempo" not in str(argv)
            (root / "work/narration.mp3").write_bytes(b"audio")
            dump(root / "work/narration.qc.json", {"voice": "Sulafat", "wer_aprox": 0.02})
        else:
            dump(root / "assets/lyrics.json", {"segments": [{"words": [
                {"word": "El", "start": 0.2, "end": 0.4}, {"word": "universo", "start": 0.4, "end": 0.8}]}]})

    async def prepare(*args):
        return {"request_count": 0, "candidates": []}

    async def index(*args):
        pass

    from pathlib import Path
    monkeypatch.setattr(native, "command", command)
    monkeypatch.setattr(cara, "prepare_context", lambda *a: None)
    monkeypatch.setattr(cara, "_audio_duration", lambda _: 120)
    monkeypatch.setattr(producer, "_validate_script", lambda *a: [])
    monkeypatch.setattr(host_media, "prepare", prepare)
    monkeypatch.setattr(host_media, "initialize_legacy_requests", lambda *a, **kw: None)
    monkeypatch.setattr(content_registry, "index_production_assets", index)
    owner = SimpleNamespace(_root=lambda _: episodes, _prepare_video=lambda *a: None,
                            _run_agent=agent, _update=update)
    await cara.run(owner, rec, False)
    assert calls == ["guion", "narrate.py", "transcribe.py", "storyboard"]
    assert phases[-1]["phase"] == "review" and phases[-1]["state"] == "incomplete"
    await cara.run(owner, rec, True)
    assert calls == ["guion", "narrate.py", "transcribe.py", "storyboard"]


@pytest.mark.asyncio
async def test_v3_admission_scaffold_and_real_narrative_validator(tmp_path, monkeypatch):
    from src.config.settings import settings
    from src.core.explainer.producer import ExplainerProducer, _validate_script

    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    monkeypatch.setattr(cara, "identity", lambda cid: record(cid)["character_identity"])
    owner = ExplainerProducer(agent_getter=lambda _: SimpleNamespace(available=lambda: True))
    row = await owner.submit(category_path="node_actualidad", design="cara-a-cara", character_id="nara",
                             agent="claude", topic="Datos del universo", minutes=2, short_test=True,
                             narrative_id="narrative_documental_v1", batch_id="test-no-dispatch")
    assert row["native_engine"] and row["character_identity"]["voz"]["nombre"] == "Sulafat"
    root = owner._root(row) / row["video_id"]
    assert root.is_relative_to(tmp_path / "productions")
    cara.scaffold(row, root)
    # Before _prepare_video, scaffold itself already carries a coherent narrative.
    config = json.loads((root / "assets/config.json").read_text())["configs"][0]
    script = json.loads((root / "assets/script.json").read_text())
    assert config["narrative_id"] == script["narrative_id"] == row["narrative_id"]
    text = ("La evidencia permite conocer mejor el universo y comparar datos concretos con observaciones "
            "de diferentes fuentes para explicar lo que sabemos y las preguntas pendientes con precisión y claridad hoy.")
    script["segments"] = [{"id": f"s{i}", "text": text, "tone": "explicativo", "intensity": 0.5,
                           "act": "gancho" if i == 0 else "cierre" if i == 7 else "contexto"} for i in range(8)]
    dump(root / "assets/script.json", script)
    assert _validate_script(root, row["narrative_id"], row["target_minutes"]) == []
    owner._prepare_video(row, root)
    assert _validate_script(root, row["narrative_id"], row["target_minutes"]) == []


def test_leo_marker_is_resolved_to_approved_voice_base(tmp_path, monkeypatch):
    from src.config.settings import settings
    monkeypatch.setattr(settings, "templates_dir", tmp_path)
    dump(tmp_path / "nodeactualidad/cara-a-cara/assets/avatar/identities/leo.json", {
        "id": "leo", "voz": {"nombre": "Puck", "direccion": "Usar la dirección vocal aprobada"}})
    dump(tmp_path / "sandbox/nodeaction/_pizarra/profiles/leo.json", {
        "voice": {"base": "Leo: conversación cercana y luminosa"}, "postprocess": {"tempo": 0.9}})
    voice = cara.identity("leo")["voz"]
    assert voice["nombre"] == "Puck"
    assert voice["direccion"] == "Leo: conversación cercana y luminosa"
    assert voice["ritmo"] == 0.9


def test_voice_preflight_rejects_enum_and_nonfinite_values_before_tts():
    for value in ("alta", "0.6", True, None, float("nan"), float("inf"), -0.1, 1.1):
        assert cara._voice_errors({"segments": [{"intensity": value}]})
    for value in (0, 0.6, 1):
        assert cara._voice_errors({"segments": [{"intensity": value}]}) == []


def test_prompts_explain_observed_media_voice_and_scene_contracts():
    text = cara.prompt(record(), "guion")
    assert "número finito entre 0 y 1" in text and "nunca texto, enum ni booleano" in text
    media = cara.prompt(record(), "media_seleccion")
    assert "pertenecer a su request_id" in media and "8 y 300 caracteres" in media
    scene = cara.prompt(record(), "storyboard")
    assert "shots[].subject NO existe" in scene and "shots[].subjects:[{id,...}]" in scene
    assert "nunca null" in scene and "ARCHIVO o ILUSTRACIÓN" in scene


def test_publication_requires_platform_copy_and_rejects_sources_as_description(tmp_path):
    dump(tmp_path / "publish.json", {"title": "Título genérico que el modal no lee"})
    assert len(cara._publication_errors(tmp_path)) == 7
    copy = publish_copy()
    copy["youtube_description"] = "https://example.org/source"
    dump(tmp_path / "publish.json", copy)
    assert any("solo fuentes" in error for error in cara._publication_errors(tmp_path))
    dump(tmp_path / "publish.json", publish_copy())
    assert cara._publication_errors(tmp_path) == []


@pytest.mark.asyncio
async def test_pending_script_review_stops_before_agent_media_or_voice(tmp_path, monkeypatch):
    from src.core.explainer import host_media
    rec = {**record(), "production_id": "prod", "video_id": "video", "agent": "claude",
           "log_path": str(tmp_path / "run.log")}
    root = tmp_path / "video"
    dump(root / "work/script-review.json", {"status": "pending"})
    updates = []
    async def update(ident, **fields):
        updates.append(fields)
    def forbidden(*args, **kwargs):
        pytest.fail("Pending review must not start a producer, media, transcription or TTS")
    monkeypatch.setattr(native, "command", forbidden)
    monkeypatch.setattr(host_media, "prepare", forbidden)
    owner = SimpleNamespace(_root=lambda _: tmp_path, _run_agent=forbidden, _update=update)
    await cara.run(owner, rec, True)
    assert updates == [{"state": "incomplete", "phase": "script_review", "video_status": "guion para revisar",
                        "error": "Guion pendiente de aprobación; voz y grabación detenidas."}]


def test_pending_draft_is_not_recordable_even_with_historical_render(tmp_path):
    from src.core.explainer.catalog import load_video
    dump(tmp_path / "manifest.json", {"design": "cara-a-cara", "status": "listo", "category": "node_actualidad"})
    dump(tmp_path / "publish.json", publish_copy())
    dump(tmp_path / "work/script-review.json", {"status": "pending"})
    dump(tmp_path / "assets/script.json", {"segments": [{"text": "Nuevo texto para revisar."}]})
    video = load_video(tmp_path)
    assert video.script_review_required and video.script_text == "Nuevo texto para revisar."
    assert not video.ready
    assert video.publish_ready and video.instagram_title
    with pytest.raises(ValueError, match="pendiente de revisión"):
        cara.validate_prepared(record(), tmp_path)


def test_pending_voice_cannot_reuse_old_audio_even_with_same_script_marker(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets/song.mp3").write_bytes(b"old audio")
    assert cara._needs_voice(tmp_path, {"phase":"script_ready", "script_sha256":"new"}, "new")
    assert not cara._needs_voice(tmp_path, {"phase":"voice_ready", "script_sha256":"new"}, "new")
    assert cara._needs_voice(tmp_path, {"phase":"scene_ready", "script_sha256":"old"}, "new")


def test_approved_preview_materializes_only_approved_data_without_agent_or_render(tmp_path, monkeypatch):
    import hashlib
    from src.core.explainer.producer import _script_hash
    root = tmp_path / "episode"
    cara.scaffold(record(), root)
    for i in range(4):
        (root / f"assets/media/photo{i}.jpg").write_bytes(b"image")
    dump(root / "assets/lyrics.json", {"words":[{"word":"Uno", "start":0},{"word":"Dos", "start":30},{"word":"Tres", "start":60}]})
    plan = {"version":1,"script_sha256":_script_hash(root),
            "subjects":[{"id":str(i),"src":f"assets/media/photo{i}.jpg","fit":"cover"} for i in range(4)],
            "blocks":[{"anchor":anchor,"variants":[{"mode":"single","subjects":[{"id":str(i)}],"pose":"talk"} for i in range(4)]}
                      for anchor in ["Uno","Dos","Tres"]]}
    path = root / "work/approved-preview-plan.json"
    dump(path, plan)
    review = {"status":"approved","script_sha256":_script_hash(root),"preview_plan_sha256":hashlib.sha256(path.read_bytes()).hexdigest()}
    dump(root / "work/script-review.json", review)
    monkeypatch.setattr(cara, "_audio_duration", lambda _: 90)
    loaded = cara._approved_preview_plan(root)
    result = cara._materialize_approved_preview(root, record(), loaded)
    scene = json.loads((root / "assets/scene.json").read_text())
    assert result["agent_calls"] == 0 and result["render_requested"] is False
    assert len(scene["shots"]) == 12 and scene["end"] == 90
    assert all(s["character"] == "nara" for s in scene["shots"])
    plan["blocks"][0]["variants"][0]["pose"] = "question"
    dump(path, plan)
    with pytest.raises(ValueError, match="aprobación"):
        cara._approved_preview_plan(root)


def test_historical_render_is_not_listed_as_current_after_editorial_revision(tmp_path, monkeypatch):
    from src.core.explainer import catalog, render_paths
    dump(tmp_path / "manifest.json", {"design":"cara-a-cara","status":"listo","render_revision_stale":True})
    monkeypatch.setattr(catalog, "full_render_files", lambda _: [tmp_path / "old.mp4"])
    assert catalog.load_video(tmp_path).rendered == []
