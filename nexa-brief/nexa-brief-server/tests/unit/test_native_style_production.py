import pytest

from src.core.explainer.native_production import scaffold, prompt
from src.presentation.api.schemas.explainer_schema import ProductionRequest


def test_production_request_accepts_estilo_and_scaffold_reuses_engines(tmp_path, monkeypatch):
    import json
    from src.config.settings import settings
    templates=tmp_path/"templates"
    definition=templates/"_tools/design-definitions/mapas-satelitales/design.json"
    definition.parent.mkdir(parents=True)
    definition.write_text(json.dumps({"engine_id":"nodehistory/_mapas", "engine_root":"nodeatlas/shared-map/_mapas"}))
    monkeypatch.setattr(settings, "templates_dir", templates)
    from src.core.explainer.batches import PreparationItem

    batch_item = PreparationItem(category_path="node_history", design="mapas-satelitales",
                                 topic="Un tema", estilo="documentary")
    assert batch_item.model_dump()["estilo"] == "documentary"
    request = ProductionRequest(
        category_path="node_history",
        design="mapas-satelitales",
        estilo="documentary",
        topic="Un tema",
    )
    root = tmp_path / "episode"
    scaffold(
        {
            "design": request.design,
            "estilo": request.estilo,
            "topic": request.topic,
            "style_revision": "revision",
            "target_minutes": 10,
        },
        root,
    )
    import json

    assert (
        json.loads((root / "assets/config.json").read_text())["configs"][0]["estilo"]
        == "documentary"
    )
    assert "/api/v1/explainer/files/bundled/nodeatlas/shared-map/_mapas/mapas.js" in (root / "index.html").read_text()
    assert not (root / "engine").exists()
    assert json.loads((root / "manifest.json").read_text())["native_scene"] is True


def test_native_prompt_is_bounded_and_reads_only_selected_contracts():
    text = prompt(
        {
            "design": "mapas-satelitales",
            "estilo": "dynamic",
            "topic": "Tema",
            "target_minutes": 10,
        },
        "storyboard",
    )
    assert "entries" not in text or "contratos" in text
    assert "dynamic" in text and "No leas motores" in text
    assert len(text) < 2200


def test_native_prompt_includes_narrative_and_media_contract(monkeypatch):
    from types import SimpleNamespace
    from src.core.explainer import narrative
    from src.core.explainer.narrative.models import NarrativeStrategy

    story = NarrativeStrategy(
        id="narrative_test",
        label="Prueba",
        name="Prueba",
        description="Contrato breve",
        acts=[
            {"id": "hook", "name": "Inicio", "weight": "apertura",
             "intensity": "alta", "function": "Presentar el conflicto"},
            {"id": "question", "name": "Pregunta", "weight": "cierre",
             "intensity": "media", "function": "Invitar a pensar"},
        ],
        question={"act": "question", "screen_max_words": 8,
                  "tone": "natural", "delivery_note": "Con pausa"},
    )
    monkeypatch.setattr(narrative, "get_service", lambda: SimpleNamespace(get=lambda ident: story))
    text = prompt({"design": "mapas-satelitales", "estilo": "documentary",
                   "topic": "Tema", "narrative_id": story.id,
                   "description": "Usar fuentes del brief"}, "guion")
    assert '"act": "hook"' in text
    assert '"screen_max_words": 8' in text
    assert "Usar fuentes del brief" in text
    assert '"requests":[{"id":"foto1"' in text
    assert "No leas motores" in text


@pytest.mark.asyncio
async def test_batch_retries_preserve_old_request_ids_without_estilo(monkeypatch):
    import hashlib
    import json
    from types import SimpleNamespace
    from src.core.explainer import batches

    item = batches.PreparationItem(category_path="node_history", design="mapas-satelitales", topic="Tema de prueba")
    old_payload = item.model_dump(exclude={"estilo", "character_id"})
    old_hash = hashlib.sha256(json.dumps({"items": [old_payload], "parallel": 1,
        "at": "2026-12-01T03:00", "zone": "America/La_Paz"}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    group = {"batch_id":"old-request", "request_id":"stable", "request_hash":old_hash,
             "state":"scheduled", "parallel":1, "scheduled_at":"2026-12-01T07:00:00+00:00"}
    def memory_collection(name):
        if name == "explainer_batches":
            return SimpleNamespace(first=lambda query: group, get=lambda ident: group)
        assert name == "explainer_productions"
        return SimpleNamespace(list=lambda: [])
    monkeypatch.setattr(batches, "collection", memory_collection)
    monkeypatch.setattr(batches, "available_design_ids", lambda: [item.design])
    owner = SimpleNamespace(_agent_getter=lambda name: SimpleNamespace(available=lambda: True))
    result = await batches.submit_batch(owner, [item], at="2026-12-01T03:00", request_id="stable")
    assert result["batch_id"] == "old-request"
    with pytest.raises(ValueError, match="pedido diferente"):
        await batches.submit_batch(owner, [item.model_copy(update={"estilo":"documentary"})], at="2026-12-01T03:00", request_id="stable")


@pytest.mark.asyncio
async def test_native_batch_validation_keeps_review_without_kit_steps(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from datetime import datetime, timezone
    from src.core.explainer import batches, native_production as native, producer

    group = {
        "batch_id": "native-review", "state": "scheduled", "parallel": 1,
        "scheduled_at": datetime.now(timezone.utc).isoformat(),
    }
    row = {
        "production_id": "native-p", "video_id": "native-v", "batch_id": "native-review",
        "state": "incomplete", "native_engine": True, "design": "mapas-satelitales",
        "estilo": "dynamic", "auto_record": False,
    }
    async def update(ident, fields):
        assert ident == row["production_id"]
        row.update(fields)
    def memory_collection(name):
        if name == "explainer_batches":
            return SimpleNamespace(get=lambda ident: group if ident == group["batch_id"] else None)
        assert name == "explainer_productions"
        return SimpleNamespace(list=lambda: [row], update=update)
    monkeypatch.setattr(batches, "collection", memory_collection)
    checked = []
    monkeypatch.setattr(producer, "_validate_script", lambda *args: [])
    monkeypatch.setattr(native, "validate_prepared", lambda rec, root: checked.append((rec["estilo"], root)))

    async def update_production(ident, **fields):
        await update(ident, fields)

    result = await batches.validate_batch(SimpleNamespace(_root=lambda rec: tmp_path, _update=update_production), "native-review")
    assert checked == [("dynamic", tmp_path / "native-v")]
    assert result["state"] == "needs_review"
    assert result["productions"][0]["phase"] == "review"


@pytest.mark.asyncio
async def test_resume_reuses_voice_transcription_and_scene_without_paid_calls(
    tmp_path, monkeypatch
):
    import json
    from types import SimpleNamespace
    from src.core.explainer import native_production as native, producer, host_media
    import src.core.content_registry as registry
    from src.core.showcase.models import Catalog, Entry

    style = {
        "id": "documentary",
        "revision": "r1",
        "tokens": {"revision": 1, "layers": {"label": {"size": 30}}},
    }
    api = SimpleNamespace(
        style=lambda *args: style,
        styles=lambda *args: {"default": "documentary"},
        catalog=lambda *args: Catalog(
            design_id="mapas-satelitales",
            revision="r1",
            entries=[
                Entry(
                    id="map.layer.label",
                    name="map.layer.label",
                    label="Label",
                    kind="component",
                    preview_kind="json",
                )
            ],
        ),
    )
    monkeypatch.setattr(native, "service", lambda: api)
    monkeypatch.setattr(native, "prepare_context", lambda *args: None)
    monkeypatch.setattr(producer, "_validate_script", lambda *args: [])
    monkeypatch.setattr(
        host_media, "initialize_legacy_requests", lambda *args, **kwargs: None
    )

    async def empty_media(*args):
        return {"request_count": 0}

    monkeypatch.setattr(host_media, "prepare", empty_media)

    async def index(*args):
        return None

    monkeypatch.setattr(registry, "index_production_assets", index)
    calls = []

    async def command(argv, *args):
        calls.append(str(argv[1]))
        if "narrate.py" in str(argv[1]):
            (tmp_path / "episode/work/narration.mp3").write_bytes(b"synthetic audio")
        elif "transcribe.py" in str(argv[1]):
            (tmp_path / "episode/assets/lyrics.json").write_text('{"segments":[]}')

    monkeypatch.setattr(native, "command", command)

    class Owner:
        def _root(self, rec):
            return tmp_path

        def _prepare_video(self, *args):
            pass

        async def _update(self, *args, **kwargs):
            pass

        async def _run_agent(self, rec, root, log, scope, timeout, phase, **kwargs):
            calls.append(phase)
            if phase == "guion":
                script = json.loads((root / "assets/script.json").read_text())
                script["segments"] = [
                    {"id": "s1", "text": "Texto de ejemplo", "tone": "natural"}
                ]
                (root / "assets/script.json").write_text(json.dumps(script))
            else:
                (root / "assets/scene.json").write_text(
                    '{"layers":[{"type":"label","text":"Texto","at":[0,0]}]}'
                )
            return SimpleNamespace(ok=True)

    rec = {
        "design": "mapas-satelitales",
        "estilo": "documentary",
        "style_revision": "r1",
        "topic": "Tema",
        "target_minutes": 10,
        "video_id": "episode",
        "production_id": "p1",
        "log_path": str(tmp_path / "run.log"),
    }
    await native.run(Owner(), rec, False)
    initial = list(calls)
    assert "guion" in initial and "storyboard" in initial and len(initial) == 4
    await native.run(Owner(), rec, True)
    assert calls == initial
    assert (
        json.loads((tmp_path / "episode/assets/scene.json").read_text())["estilo"]
        == "documentary"
    )
    native.validate_prepared(rec, tmp_path / "episode")
    assert calls == initial
    script_path = tmp_path / "episode/assets/script.json"
    script = json.loads(script_path.read_text())
    script["segments"][0]["text"] = "El guion cambió después de generar la voz"
    script_path.write_text(json.dumps(script))
    with pytest.raises(ValueError, match="no corresponde al guion"):
        native.validate_prepared(rec, tmp_path / "episode")
