"""Explainer: textos (brief), producción con agente local y planificador semanal.

El kit, el agente, la IA y el render son falsos: estas pruebas no llaman a
Claude/Codex/DeepSeek/Gemini ni renderizan. Cada test usa su propio data/ temporal.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.core.categories import ensure_output_dirs, strategy_for
from src.core.data import collection
from src.core.explainer.briefs import (
    ExplainerBrief,
    generate_brief,
    generate_publish_texts,
    slugify,
    unique_video_id,
    write_publish_json,
)
from src.core.explainer.catalog import load_video
from src.core.explainer.producer import ExplainerProducer, ProductionState, build_agent_prompt
from src.core.explainer.recorder import ExplainerRecorder
from src.core.ports.agent_port import AgentRunResult
from src.core.schedule import planner, slot_repository
from src.presentation.main import app

BRIEF = {
    "video_id": "Cómo nació la IA",
    "working_title": "EL VERANO DE 1956",
    "hook": "En 1956, diez científicos creyeron que en un verano harían pensar a una máquina.",
    "angle": "La conferencia de Dartmouth",
    "thesis": "La IA nació de una apuesta demasiado optimista que tardó 70 años en cumplirse.",
    "outline": ["Dartmouth", "Inviernos", "Deep Blue", "Redes neuronales", "ChatGPT"],
    "youtube": {
        "title": "Cómo la IA pasó de no resolver nada a quitarte el trabajo",
        "title_alternatives": ["Así se hizo tan potente la IA"],
        "description": "En 1956…",
        "tags": ["#ia", "historia de la ia", "dartmouth"],
    },
    "facebook": {"title": "La apuesta de 1956", "description": "¿Tú qué crees?"},
    "tiktok": {"caption": "Diez científicos, un verano", "hashtags": ["ia", "#historia"]},
    "thumbnail_text": "UN SOLO VERANO",
    "media_suggestions": ["Dartmouth 1956 conference"],
}


class _FakeAI:
    def __init__(self, *replies: dict) -> None:
        self.replies = list(replies)
        self.prompts: list[tuple[str, str]] = []

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        self.prompts.append((system_prompt, user_prompt))
        return self.replies.pop(0)

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:  # pragma: no cover
        raise NotImplementedError


# ── brief ────────────────────────────────────────────────────────────────────

async def test_brief_uses_category_strategy_and_normalizes():
    ai = _FakeAI(BRIEF)
    brief = await generate_brief(ai, category_path="node_tech", topic="Cómo nació la inteligencia artificial")
    assert brief.video_id == "como-nacio-la-ia"
    assert brief.youtube.tags[0] == "ia"  # sin '#'
    assert brief.tiktok.hashtags == ["#ia", "#historia"]
    _, user = ai.prompts[0]
    payload = json.loads(user)
    assert payload["categoria"]["nombre"] == "NodeTech"
    assert payload["estrategia"]["title_examples"] == strategy_for("node_tech").title_examples
    assert payload["pedido"]["tema"] == "Cómo nació la inteligencia artificial"


async def test_brief_retries_once_on_schema_error():
    ai = _FakeAI({"video_id": "x"}, BRIEF)
    brief = await generate_brief(ai, category_path="node_history", topic="Muro de Berlín")
    assert brief.youtube.title.startswith("Cómo la IA")
    assert len(ai.prompts) == 2 and "no cumplía el esquema" in ai.prompts[1][1]


async def test_brief_requires_topic():
    with pytest.raises(ValueError):
        await generate_brief(_FakeAI(BRIEF), category_path="node_tech", topic="  ")


async def test_publish_texts_for_existing_video(tmp_path: Path):
    video = tmp_path / "turing"
    (video / "assets").mkdir(parents=True)
    (video / "assets" / "script.json").write_text(json.dumps({"title": "ENIGMA", "segments": [{"text": "Mil novecientos cuarenta."}]}))
    ai = _FakeAI(BRIEF)
    brief = await generate_publish_texts(ai, video, category_path="node_tech", design=None)
    assert brief.video_id == "turing"
    assert "Mil novecientos cuarenta." in ai.prompts[0][1]
    assert write_publish_json(video, brief) is True
    publish = json.loads((video / "publish.json").read_text())
    assert publish["youtube_title"] == BRIEF["youtube"]["title"]
    assert publish["facebook_title"] == "La apuesta de 1956"
    # no pisa títulos existentes salvo overwrite
    assert write_publish_json(video, brief) is False


def test_slug_and_unique_ids(tmp_path: Path):
    assert slugify("¿Cómo nació la Inteligencia Artificial?") == "como-nacio-la-inteligencia-artificial"
    (tmp_path / "muro").mkdir()
    assert unique_video_id("Muro", tmp_path) == "muro-2"


# ── producción ───────────────────────────────────────────────────────────────

class _FakeKit:
    """Imita kit.py: `new` crea la carpeta; `manifest` marca listo si el agente terminó."""

    def __init__(self, videos: Path) -> None:
        self.videos = videos
        self.calls: list[list[str]] = []

    async def __call__(self, args: list[str]) -> tuple[int, str]:
        self.calls.append(args)
        cmd, vid = args[0], args[1] if args[0] != "new" else args[2]
        d = self.videos / vid
        if cmd == "new":
            (d / "assets" / "media").mkdir(parents=True)
            (d / "render").mkdir()
            (d / "manifest.json").write_text(json.dumps({"video_id": vid, "design": args[1], "status": "nuevo", "title": args[4]}))
            (d / "publish.json").write_text(json.dumps({"youtube_title": ""}))
        if cmd == "manifest":
            m = json.loads((d / "manifest.json").read_text())
            m["status"] = "listo" if (d / "AGENT_DONE").exists() else "en progreso"
            m["duration_seconds"] = 200.0
            (d / "manifest.json").write_text(json.dumps(m))
        return 0, f"ok {cmd}\n"


class _FakeAgent:
    name = "claude"

    def __init__(self, videos: Path, finish: bool = True) -> None:
        self.videos = videos
        self.finish = finish
        self.runs: list[dict] = []

    def available(self) -> bool:
        return True

    async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope=None):
        self.runs.append({"prompt": prompt, "scope": scope})
        vid = scope.writable_dir.rsplit("/", 1)[-1]
        if self.finish:
            (self.videos / vid / "AGENT_DONE").write_text("1")
        log_path.write_text("trabajando…\n")
        return AgentRunResult(exit_code=0, last_message="reporte final", duration_seconds=1.0)


class _FakeRender:
    def __init__(self, videos: Path) -> None:
        self.videos = videos

    async def __call__(self, video_id: str, seconds: int | None, formats=("9x16", "16x9")) -> None:
        for fmt in formats:
            (self.videos / video_id / "render" / f"{video_id}-{fmt}.mp4").write_bytes(b"mp4")


def _producer(tmp_path: Path, *, finish=True, recorder=None):
    videos = tmp_path / "videos"
    videos.mkdir(exist_ok=True)
    agent = _FakeAgent(videos, finish=finish)
    kit = _FakeKit(videos)
    producer = ExplainerProducer(
        agent_getter=lambda _name: agent,
        kit_runner=kit,
        recorder_getter=recorder,
        videos_dir=videos,
        uploads_dir=tmp_path / "uploads",
    )
    return producer, agent, kit, videos


async def test_production_creates_video_runs_agent_and_ends_ready(tmp_path: Path):
    producer, agent, kit, videos = _producer(tmp_path)
    photo = tmp_path / "foto.jpg"
    photo.write_bytes(b"jpg")
    rec = await producer.submit(
        category_path="node_tech",
        design="rough",
        topic="Cómo nació la inteligencia artificial",
        description="Desde Dartmouth hasta ChatGPT",
        brief=ExplainerBrief.model_validate(BRIEF),
        media_files=[photo],
    )
    assert rec["video_id"] == "como-nacio-la-ia"
    final = await producer.wait(rec["production_id"])
    assert final["state"] == ProductionState.ready.value, final["error"]
    assert final["video_status"] == "listo"

    vdir = videos / "como-nacio-la-ia"
    manifest = json.loads((vdir / "manifest.json").read_text())
    assert manifest["category"] == "node_tech" and manifest["topic"].startswith("Cómo nació")
    assert (vdir / "BRIEF.md").read_text().count("Dartmouth") >= 1
    assert json.loads((vdir / "publish.json").read_text())["youtube_title"] == BRIEF["youtube"]["title"]
    assert (vdir / "assets" / "media" / "foto.jpg").exists()
    assert "aportado por el usuario" in (vdir / "assets" / "media" / "CREDITS.md").read_text()

    scope = agent.runs[0]["scope"]
    assert scope.writable_dir == str(videos / "como-nacio-la-ia")
    assert all("kit.py" in c or "media.py" in c for c in scope.commands)
    assert "NO hagas el paso 10" in agent.runs[0]["prompt"]
    assert kit.calls[0][:3] == ["new", "rough", "como-nacio-la-ia"]
    # el catálogo respeta la categoría del manifest
    assert load_video(vdir).category_path == "node_tech"


async def test_production_incomplete_then_resume(tmp_path: Path):
    producer, agent, _, _ = _producer(tmp_path, finish=False)
    rec = await producer.submit(category_path="node_history", design="binary", topic="La caída del Muro")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == ProductionState.incomplete.value
    agent.finish = True
    await producer.resume(rec["production_id"])
    final = await producer.wait(rec["production_id"])
    assert final["state"] == ProductionState.ready.value
    assert "CONTINÚA" in agent.runs[1]["prompt"]


async def test_production_auto_record_registers_job_in_category_output(tmp_path: Path):
    videos = tmp_path / "videos"
    videos.mkdir()
    recorder = ExplainerRecorder(render_runner=_FakeRender(videos), output_root=tmp_path / "output")
    producer, _, _, _ = _producer(tmp_path, recorder=lambda: recorder)
    rec = await producer.submit(category_path="node_politics", design="enmienda", topic="La Enmienda 19", auto_record=True)
    final = await producer.wait(rec["production_id"])
    assert final["state"] == ProductionState.done.value, final["error"]
    out = tmp_path / "output" / "node_politics" / "enmienda" / final["video_id"]
    assert (out / f"{final['video_id']}-16x9.mp4").exists()
    jobs = collection("jobs").list()
    assert jobs and jobs[0]["category"] == "node_politics"
    assert jobs[0]["video_id"] == final["video_id"]  # evita grabarlo dos veces


async def test_submit_validations(tmp_path: Path):
    producer, _, _, _ = _producer(tmp_path)
    with pytest.raises(ValueError, match="pipeline"):
        await producer.submit(category_path="node_motion", design="binary", topic="x tema")
    with pytest.raises(ValueError, match="diseño desconocido"):
        await producer.submit(category_path="node_tech", design="inexistente", topic="x tema")
    with pytest.raises(ValueError, match="formato"):
        bad = tmp_path / "virus.exe"
        bad.write_bytes(b"x")
        await producer.submit(category_path="node_tech", design="rough", topic="x tema", media_files=[bad])


async def test_recover_interrupted_marks_failed(tmp_path: Path):
    producer, _, _, _ = _producer(tmp_path)
    await collection("explainer_productions").insert({"production_id": "old", "state": "producing", "category_path": "node_tech"})
    assert await producer.recover_interrupted() == 1
    assert producer.get("old")["state"] == "failed"


def test_agent_prompt_lists_only_kit_commands(tmp_path: Path):
    rec = {"video_id": "v1", "design": "binary", "category_path": "node_tech", "topic": "IA", "media": ["a.jpg"]}
    prompt = build_agent_prompt(rec, tmp_path / "v1")
    assert "kit.py voice v1" in prompt and "a.jpg" in prompt and "NO hagas el paso 10" in prompt


# ── planificador y automatización ────────────────────────────────────────────

MONDAY = date(2026, 10, 12)


async def test_category_automation_daily_and_alternate():
    slots = await planner.create_category_automation("node_tech", ["youtube:tech", "tiktok:tech"], "daily", ["15:00"])
    assert len(slots) == 2 and slots[0].days == [0, 1, 2, 3, 4, 5, 6] and slots[0].niche_filter == "node_tech"
    # guardar de nuevo no duplica
    slots = await planner.create_category_automation("node_tech", ["youtube:tech"], "alternate", ["09:00"])
    tech = [s for s in slot_repository.list_slots() if s.niche_filter == "node_tech"]
    assert len(tech) == 2  # tiktok queda, youtube se reemplazó
    assert next(s for s in tech if s.platform == "youtube").days == [0, 2, 4, 6]
    summary = {c["category_id"]: c for c in planner.automation_summary()}
    assert len(summary["node_tech"]["slots"]) == 2 and summary["node_history"]["slots"] == []


async def test_category_automation_validates():
    with pytest.raises(ValueError):
        await planner.create_category_automation("nope", ["youtube:a"], "daily", ["15:00"])
    with pytest.raises(ValueError):
        await planner.create_category_automation("node_tech", ["youtube:a"], "daily", ["25:00"])
    with pytest.raises(ValueError):
        await planner.create_category_automation("node_tech", ["youtube:a"], "custom", ["10:00"], days=[])


async def test_planner_chat_validates_items():
    ai = _FakeAI({
        "reply": "Te propongo esta semana.",
        "items": [
            {"date": "2026-10-12", "time": "15:00", "category_path": "node_tech", "design": "rough", "topic": "Cómo nació la IA"},
            {"date": "2026-10-13", "time": "99:00", "category_path": "node_history", "design": "inventado", "topic": "Muro"},
            {"date": "2026-11-01", "category_path": "node_tech", "design": "rough", "topic": "fuera de semana"},
            {"date": "2026-10-14", "category_path": "node_fake", "topic": "x"},
            {"date": "2026-10-15", "category_path": "node_motion/letras", "design": "binary", "topic": "Canción triste"},
        ],
    })
    reply = await planner.chat(ai, [planner.ChatMessage(role="user", content="planifica la semana")], MONDAY)
    assert reply.reply.startswith("Te propongo")
    assert [i.topic for i in reply.items] == ["Cómo nació la IA", "Muro", "Canción triste"]
    muro = reply.items[1]
    assert muro.time == "15:00"
    assert muro.design == "acuarela"  # diseño inválido → el primero válido de NodeHistory
    assert reply.items[2].design is None  # NodeMotion no usa diseños del kit
    assert len(reply.warnings) == 3
    ctx = json.loads(ai.prompts[0][1])["contexto"]
    assert ctx["semana"][0] == "2026-10-12" and len(ctx["categorias"]) == 5


async def test_planner_requires_user_last():
    with pytest.raises(ValueError):
        await planner.chat(_FakeAI({}), [planner.ChatMessage(role="assistant", content="hola")], MONDAY)


async def test_save_and_list_plan():
    items = [planner.PlanItem(date="2026-10-13", category_path="node_tech", design="rough", topic="B"),
             planner.PlanItem(date="2026-10-12", category_path="node_history", design="binary", topic="A")]
    await planner.save_plan(items)
    assert [r["topic"] for r in planner.list_plan()] == ["A", "B"]


# ── carpetas de salida y rutas HTTP ──────────────────────────────────────────

def test_output_dirs_per_category(tmp_path: Path):
    ensure_output_dirs(tmp_path)
    for path in ("node_tech", "node_history", "node_motion/letras", "node_politics", "node_economy"):
        assert (tmp_path / path).is_dir()


def test_pipeline_output_goes_under_category():
    from src.core.categories import output_dir_for_niche

    root = Path("/out")
    assert output_dir_for_niche(root, "lyrics_video_neon") == root / "node_motion" / "letras"
    assert output_dir_for_niche(root, "nicho_inexistente") == root


client = TestClient(app)


def test_routes_designs_options_and_files():
    r = client.get("/api/v1/explainer/designs", params={"category": "node_politics"})
    assert r.status_code == 200 and r.json()["shared"] is True and len(r.json()["designs"]) == 11
    r = client.get("/api/v1/explainer/designs", params={"category": "node_tech"})
    assert [d["design_id"] for d in r.json()["designs"]] == ["rough"]
    assert client.get("/api/v1/explainer/designs", params={"category": "nope"}).status_code == 404
    opts = client.get("/api/v1/explainer/options").json()
    assert {a["name"] for a in opts["agents"]} == {"claude", "codex"}
    # files: sirve el kit y las carpetas de categoría, nunca otras plantillas ni ocultos
    assert client.get("/api/v1/explainer/files/nodehistory/turing-enigma/index.html").status_code == 200
    assert client.get("/api/v1/explainer/files/nodemotion/lyrics/lyrics-neon/index.html").status_code == 404
    assert client.get("/api/v1/explainer/files/_tools/hyperframes/optimize.py").status_code == 404
    assert client.get("/api/v1/explainer/files/_tools/explainer-kit/engine/loader.js").status_code == 200
    assert client.get("/api/v1/explainer/files/_tools/explainer-kit/.state/gemini-quota.json").status_code == 404
    assert client.get("/api/v1/explainer/files/sandbox/roughJS/index.html").status_code == 404
    assert client.get("/api/v1/explainer/files/../../.env").status_code == 404


def test_routes_categories_include_strategy():
    cats = {c["id"]: c for c in client.get("/api/v1/categories").json()}
    assert cats["node_tech"]["strategy"]["title_examples"]
    assert cats["node_politics"]["strategy"]["default_cadence"] == "alternate"


def test_route_production_rejects_bad_payload():
    r = client.post("/api/v1/explainer/productions", data={"payload": "{no json"})
    assert r.status_code == 422
    r = client.post("/api/v1/explainer/productions", data={"payload": json.dumps({"category_path": "node_tech", "design": "binary", "topic": "IA hoy", "agent": "gpt"})})
    assert r.status_code == 400


def test_route_schedule_categories_and_planner_items():
    r = client.post("/api/v1/schedule/categories", json={"category_path": "node_history", "accounts": ["youtube:hist"], "cadence": "alternate", "times": ["18:00"]})
    assert r.status_code == 201 and r.json()[0]["niche_filter"] == "node_history"
    summary = {c["category_id"]: c for c in client.get("/api/v1/schedule/categories").json()}
    assert len(summary["node_history"]["slots"]) == 1
    r = client.post("/api/v1/schedule/planner/items", json={"items": [{"date": "2026-10-12", "category_path": "node_motion/letras", "topic": "x"}]})
    item_id = r.json()[0]["item_id"]
    # NodeMotion no se produce con agente
    assert client.post(f"/api/v1/schedule/planner/items/{item_id}/produce", json={}).status_code == 400
    assert client.delete(f"/api/v1/schedule/planner/items/{item_id}").status_code == 204


# ── estructura en src/templates/: carpetas por categoría, demos y portadas ───

def test_real_videos_live_in_category_folders():
    from src.core.explainer.catalog import TEMPLATES_DIR, list_videos

    videos = {v.video_id: v for v in list_videos()}
    assert videos["apolo-1202"].path == TEMPLATES_DIR / "nodetech" / "apolo-1202"
    assert videos["apolo-1202"].category_path == "node_tech"            # rough → NodeTech
    assert videos["turing-enigma"].category_path == "node_history"      # binary → NodeHistory
    assert videos["pop-demo"].demo and videos["pop-demo"].category_path == "node_history"
    assert all(v.ready and v.publish_ready for v in videos.values())


def test_route_video_has_poster_and_texts():
    body = {v["video_id"]: v for v in client.get("/api/v1/explainer/videos").json()}
    apolo = body["apolo-1202"]
    assert apolo["preview_url"] == "/api/v1/explainer/files/nodetech/apolo-1202/index.html"
    assert apolo["poster_url"].startswith("/api/v1/explainer/files/nodetech/apolo-1202/render/poster.jpg?v=")
    assert client.get(apolo["poster_url"]).status_code == 200
    assert apolo["facebook_title"] and apolo["tiktok_hashtags"] and apolo["design_name"] == "PROTOTIPO"
    assert body["acuarela-demo"]["demo"] is True


def test_kit_finds_videos_in_category_folders():
    import subprocess
    import sys

    out = subprocess.run([sys.executable, "src/templates/_tools/explainer-kit/tools/kit.py", "status", "apolo-1202"],
                         capture_output=True, text=True)
    assert out.returncode == 0 and "diseño rough" in out.stdout


async def test_tech_can_use_a_history_design(tmp_path: Path):
    """Una plantilla de History en un video de Tech: el video sigue siendo de Tech."""
    producer, _, _, _ = _producer(tmp_path)
    rec = await producer.submit(category_path="node_tech", design="pop", topic="La burbuja puntocom")
    assert rec["category_path"] == "node_tech" and rec["folder"] == "nodetech"


def test_route_design_groups_current_category_first():
    groups = client.get("/api/v1/explainer/design-groups", params={"first": "node_tech"}).json()
    assert [g["category_path"] for g in groups][:2] == ["node_tech", "node_history"]
    assert [d["design_id"] for d in groups[0]["designs"]] == ["rough"]
    assert len(groups[1]["designs"]) == 10 and groups[1]["designs"][0]["poster_url"]
    groups = client.get("/api/v1/explainer/design-groups", params={"first": "node_history"}).json()
    assert groups[0]["category_path"] == "node_history"
