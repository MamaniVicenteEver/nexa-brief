"""Explainer de punta a punta: catálogo → grabación (preview 10/20 s o completa)
→ output/<categoría>/ → job empaquetado → horario por categoría → publicación.

El render y el publicador son falsos: estas pruebas nunca renderizan video
ni publican nada real. Cada test corre con su propio data/ temporal
(ver tests/conftest.py), así que la cola y los jobs empiezan vacíos.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.config.settings import settings
from src.core import job_tracker
from src.core.data import collection
from src.core.explainer import recorder as recorder_mod
from src.core.explainer.catalog import list_videos, load_video
from src.core.explainer.recorder import ExplainerRecorder, RecordState
from src.core.metadata import copy_for_platform
from src.core.schedule import engine, queue_repository, slot_repository
from src.core.schedule.models import QueueStatus

MONDAY_9AM = datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc)  # weekday() == 0


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_video(root: Path, video_id: str, *, status: str, design: str, youtube_title: str = "") -> Path:
    d = root / video_id
    (d / "render").mkdir(parents=True)
    (d / "manifest.json").write_text(
        json.dumps({"video_id": video_id, "design": design, "status": status, "title": f"T {video_id}", "duration_seconds": 100.0}),
        encoding="utf-8",
    )
    (d / "publish.json").write_text(
        json.dumps({"youtube_title": youtube_title, "youtube_description": "desc", "youtube_tags": ["ia", "historia"]}),
        encoding="utf-8",
    )
    return d


class _FakeRender:
    """Imita kit.py render: escribe los mp4 donde los escribe el CLI real."""

    def __init__(self, videos_root: Path) -> None:
        self.videos_root = videos_root
        self.calls: list[tuple[str, int | None]] = []
        self.formats: list[tuple[str, ...]] = []

    async def __call__(self, video_id: str, seconds: int | None, formats=("9x16", "16x9")) -> None:
        self.calls.append((video_id, seconds))
        self.formats.append(tuple(formats))
        render = self.videos_root / video_id / "render"
        target = render / "preview" if seconds else render
        target.mkdir(parents=True, exist_ok=True)
        for fmt in formats:
            (target / recorder_mod.render_filename(video_id, fmt, seconds)).write_bytes(b"mp4")


class _FakePublisher:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def publish_video(self, **kwargs):
        self.calls.append(kwargs)
        platform = kwargs["account_selector"].split(":", 1)[0]
        alias = kwargs["account_selector"].split(":", 1)[1]
        n = len(self.calls)
        return SimpleNamespace(post_id=f"p{n}", url=f"https://x/p{n}", platform=platform, account_alias=alias)


async def _noop_async(**kwargs):
    return None


@pytest.fixture
def videos_root(tmp_path: Path) -> Path:
    root = tmp_path / "explainer-videos"
    _make_video(root, "tech-1", status="listo", design="rough", youtube_title="Cómo la IA pasó de no resolver nada a quitarte el trabajo")
    _make_video(root, "hist-1", status="renderizado", design="binary", youtube_title="La conferencia que derribó un muro")
    _make_video(root, "sin-titulo", status="listo", design="binary", youtube_title="")
    _make_video(root, "en-curso", status="en progreso", design="binary")
    (root / "demo-sin-manifest").mkdir()
    return root


@pytest.fixture
def make_recorder(videos_root: Path, tmp_path: Path):
    def factory(publisher=None):
        render = _FakeRender(videos_root)
        rec = ExplainerRecorder(
            render_runner=render,
            publisher_getter=(lambda: publisher) if publisher else None,
            output_root=tmp_path / "output",
        )
        return rec, render

    return factory


def _record(rec: ExplainerRecorder, video, **kwargs):
    async def scenario():
        job = rec.submit(video, **kwargs)
        return await rec.wait(job.job_id)

    return asyncio.run(scenario())


# ── catálogo ─────────────────────────────────────────────────────────────────

def test_catalog_lists_only_videos_with_manifest(videos_root: Path):
    ids = {v.video_id for v in list_videos(videos_root)}
    assert ids == {"tech-1", "hist-1", "sin-titulo", "en-curso"}


def test_catalog_maps_design_to_category(videos_root: Path):
    assert load_video(videos_root / "tech-1").category_path == "node_tech"
    assert load_video(videos_root / "hist-1").category_path == "node_history"


def test_ready_follows_manifest_status(videos_root: Path):
    assert load_video(videos_root / "tech-1").ready
    assert load_video(videos_root / "hist-1").ready
    assert not load_video(videos_root / "en-curso").ready
    assert load_video(videos_root / "sin-titulo").publish_ready is False


# ── validación al pedir una grabación ───────────────────────────────────────

def test_record_rejects_video_not_ready(videos_root: Path, make_recorder):
    rec, _ = make_recorder()
    with pytest.raises(ValueError, match="no está listo"):
        rec.submit(load_video(videos_root / "en-curso"))


def test_record_rejects_unknown_duration(videos_root: Path, make_recorder):
    rec, _ = make_recorder()
    with pytest.raises(ValueError, match="duración inválida"):
        rec.submit(load_video(videos_root / "tech-1"), duration="30")


def test_publish_rules(videos_root: Path, make_recorder):
    rec, _ = make_recorder()
    tech = load_video(videos_root / "tech-1")
    with pytest.raises(ValueError, match="grabación completa"):
        rec.submit(tech, duration="10", publish=True, account_selector="youtube:canal_1")
    with pytest.raises(ValueError, match="youtube_title"):
        rec.submit(load_video(videos_root / "sin-titulo"), duration="full", publish=True, account_selector="youtube:canal_1")
    with pytest.raises(ValueError, match="al menos un canal"):
        rec.submit(tech, duration="full", publish=True)
    with pytest.raises(ValueError, match="no soportada"):
        rec.submit(tech, duration="full", publish=True, account_selector="myspace:x")


# ── preview corto (10 / 20 s) ───────────────────────────────────────────────

@pytest.mark.parametrize("seconds", ["10", "20"])
def test_preview_renders_short_clip_and_is_not_scheduled(videos_root: Path, make_recorder, tmp_path: Path, seconds: str):
    rec, render = make_recorder()
    job = _record(rec, load_video(videos_root / "tech-1"), duration=seconds, formats=["9x16", "16x9"])

    assert job.state == RecordState.done, job.error
    assert render.calls == [("tech-1", int(seconds))]
    out = tmp_path / "output" / "node_tech" / "rough" / "tech-1" / f"preview-{seconds}s"
    assert (out / f"tech-1-9x16-{seconds}s.mp4").exists()
    assert (out / f"tech-1-16x9-{seconds}s.mp4").exists()
    # Un preview nunca entra a la cola de publicación.
    assert job.scheduled_job_id is None
    assert job_tracker.list_jobs(stage="packaged")[1] == 0


def test_default_duration_is_ten_seconds(videos_root: Path, make_recorder):
    rec, render = make_recorder()
    job = _record(rec, load_video(videos_root / "tech-1"))
    assert job.duration == "10"
    assert render.calls == [("tech-1", 10)]


def test_existing_preview_is_reused(videos_root: Path, make_recorder):
    rec, render = make_recorder()
    preview = videos_root / "tech-1" / "render" / "preview"
    preview.mkdir(parents=True)
    for fmt in ("9x16", "16x9"):
        (preview / f"tech-1-{fmt}-10s.mp4").write_bytes(b"old")
    job = _record(rec, load_video(videos_root / "tech-1"), duration="10")
    assert job.state == RecordState.done
    assert render.calls == []


def test_preview_does_not_reuse_full_render(videos_root: Path, make_recorder):
    """Tener el video completo no sirve de preview: son archivos distintos."""
    rec, render = make_recorder()
    for fmt in ("9x16", "16x9"):
        (videos_root / "tech-1" / "render" / f"tech-1-{fmt}.mp4").write_bytes(b"full")
    _record(rec, load_video(videos_root / "tech-1"), duration="10")
    assert render.calls == [("tech-1", 10)]


def test_render_failure_marks_job_failed(videos_root: Path, tmp_path: Path):
    async def render(video_id: str, seconds: int | None, formats=()) -> None:
        raise recorder_mod.RenderError("kit.py render terminó con código 1")

    rec = ExplainerRecorder(render_runner=render, output_root=tmp_path / "out")
    job = _record(rec, load_video(videos_root / "tech-1"))
    assert job.state == RecordState.failed
    assert "código 1" in job.error


def test_one_render_at_a_time(videos_root: Path, tmp_path: Path):
    running = 0
    peak = 0

    async def render(video_id: str, seconds: int | None, formats=("16x9",)) -> None:
        nonlocal running, peak
        running += 1
        peak = max(peak, running)
        await asyncio.sleep(0.02)
        await _FakeRender(videos_root)(video_id, seconds, formats)
        running -= 1

    async def scenario():
        rec = ExplainerRecorder(render_runner=render, output_root=tmp_path / "out")
        a = rec.submit(load_video(videos_root / "tech-1"))
        b = rec.submit(load_video(videos_root / "hist-1"))
        return await rec.wait(a.job_id), await rec.wait(b.job_id)

    a, b = asyncio.run(scenario())
    assert a.state == b.state == RecordState.done
    assert peak == 1


# ── grabación completa → job empaquetado ───────────────────────────────────

def test_full_recording_registers_packaged_job(videos_root: Path, make_recorder, tmp_path: Path):
    rec, render = make_recorder()
    job = _record(rec, load_video(videos_root / "hist-1"), duration="full", formats=["16x9", "9x16"])

    assert job.state == RecordState.done, job.error
    assert render.calls == [("hist-1", None)]
    # una carpeta por grabación (output/<categoría>/<diseño>/<video>/<id de la grabación>)
    out = Path(job.output_dir)
    assert out.parent == tmp_path / "output" / "node_history" / "binary" / "hist-1"
    assert job.scheduled_job_id.endswith(out.name)
    assert (out / "hist-1-16x9.mp4").exists()

    record = job_tracker.get(job.scheduled_job_id)
    assert record["stage"] == "packaged"
    assert record["category"] == "node_history"
    assert Path(record["file_paths"]["youtube"]).name == "hist-1-16x9.mp4"
    assert Path(record["file_paths"]["tiktok"]).name == "hist-1-9x16.mp4"

    summary = job_tracker.get_summary(job.scheduled_job_id)
    yt = copy_for_platform(summary, "youtube")
    assert yt.title == "La conferencia que derribó un muro"
    assert yt.tags == ["ia", "historia"]


def test_full_recording_with_publish_now(videos_root: Path, make_recorder, monkeypatch):
    recorded: list[dict] = []

    async def fake_record(**kwargs):
        recorded.append(kwargs)

    monkeypatch.setattr(recorder_mod, "record_published_video", fake_record)
    publisher = _FakePublisher()
    rec, _ = make_recorder(publisher)
    job = _record(rec, load_video(videos_root / "tech-1"), duration="full", publish=True, account_selector="youtube:canal_1")

    assert job.state == RecordState.done, job.error
    call = publisher.calls[0]
    assert call["video_path"].name == "tech-1-16x9.mp4"
    assert call["privacy"] == "private"
    assert job.publish_result["post_id"] == "p1"
    assert recorded and recorded[0]["alias"] == "canal_1"


def test_tiktok_publish_uses_vertical(videos_root: Path, make_recorder, monkeypatch):
    monkeypatch.setattr(recorder_mod, "record_published_video", _noop_async)
    publisher = _FakePublisher()
    rec, _ = make_recorder(publisher)
    _record(rec, load_video(videos_root / "tech-1"), duration="full", publish=True, account_selector="tiktok:alias")
    assert publisher.calls[0]["video_path"].name == "tech-1-9x16.mp4"


# ── programación por categoría ──────────────────────────────────────────────

async def test_category_slot_publishes_recorded_video(videos_root: Path, make_recorder, monkeypatch, api_client):
    """Flujo completo: grabar → horario de NodeHistory → tick → publicado."""
    monkeypatch.setattr(settings, "schedule_auto_fill_enabled", True)

    async def no_thumbnail(_file_paths):
        return None

    monkeypatch.setattr("src.modules.thumbnail_maker.ensure_for_job", no_thumbnail)
    rec, _ = make_recorder()
    submitted = rec.submit(load_video(videos_root / "hist-1"), duration="full")
    job = await rec.wait(submitted.job_id)

    # El horario se crea por la API, como lo hace la web.
    response = await api_client.post(
        "/api/v1/schedule/slots",
        json={"platform": "youtube", "account_alias": "canal_1", "days": [0], "times": ["09:00"], "niche_filter": "node_history"},
    )
    assert response.status_code == 201, response.text

    publisher = _FakePublisher()
    summary = await engine.process_tick(publisher, now=MONDAY_9AM)

    assert summary["gaps_filled"] == 1
    assert list(summary["results"].values()) == ["published"]
    call = publisher.calls[0]
    assert call["video_path"].name == "hist-1-16x9.mp4"
    assert call["title"] == "La conferencia que derribó un muro"
    assert call["account_selector"] == "youtube:canal_1"

    entries, total = queue_repository.list_entries(job_id=job.scheduled_job_id)
    assert total == 1
    assert entries[0].status == QueueStatus.PUBLISHED
    assert entries[0].url == "https://x/p1"


def test_category_slot_does_not_take_other_categories(videos_root: Path, make_recorder, monkeypatch):
    monkeypatch.setattr(settings, "schedule_auto_fill_enabled", True)
    rec, _ = make_recorder()
    _record(rec, load_video(videos_root / "hist-1"), duration="full")
    asyncio.run(slot_repository.create(platform="youtube", account_alias="c", days=[0], times=["09:00"], niche_filter="node_tech"))

    publisher = _FakePublisher()
    summary = asyncio.run(engine.process_tick(publisher, now=MONDAY_9AM))
    assert summary["gaps_filled"] == 0
    assert publisher.calls == []


async def test_same_video_is_not_published_twice_to_same_account(videos_root: Path, make_recorder, monkeypatch):
    monkeypatch.setattr(settings, "schedule_auto_fill_enabled", True)

    async def no_thumbnail(_file_paths):
        return None

    monkeypatch.setattr("src.modules.thumbnail_maker.ensure_for_job", no_thumbnail)
    rec, _ = make_recorder()
    submitted = rec.submit(load_video(videos_root / "tech-1"), duration="full")
    await rec.wait(submitted.job_id)
    await slot_repository.create(platform="youtube", account_alias="c", days=[0, 1], times=["09:00"], niche_filter="node_tech")

    publisher = _FakePublisher()
    await engine.process_tick(publisher, now=MONDAY_9AM)
    await engine.process_tick(publisher, now=datetime(2026, 10, 13, 9, 0, tzinfo=timezone.utc))
    assert len(publisher.calls) == 1


async def _insert_pipeline_job(job_id: str, category: str, tmp_path: Path) -> None:
    out = tmp_path / job_id
    (out / "logs").mkdir(parents=True)
    (out / "logs" / "08_resumen_final.json").write_text(json.dumps({"youtube_title": job_id}), encoding="utf-8")
    (out / "youtube.mp4").write_bytes(b"mp4")
    await collection("jobs").insert({
        "job_id": job_id, "category": category, "title": job_id, "stage": "packaged",
        "output_dir": str(out), "errors": [], "created_at": "2026-10-01T00:00:00+00:00",
        "updated_at": "2026-10-01T00:00:00+00:00", "file_paths": {"youtube": str(out / "youtube.mp4")},
    })


@pytest.mark.parametrize(
    ("niche_filter", "picked"),
    [
        ("node_motion", "job-neon"),           # categoría padre toma sus subcategorías
        ("node_motion/letras", "job-neon"),    # subcategoría exacta
        ("lyrics_video_neon", "job-neon"),     # filtro por nicho, como antes
        ("node_motion/promos", None),          # otra subcategoría no
        ("node_tech", None),                   # otra categoría no
        (None, "job-neon"),                    # sin filtro toma cualquiera
    ],
)
def test_slot_filter_follows_category_tree(tmp_path: Path, niche_filter, picked):
    asyncio.run(_insert_pipeline_job("job-neon", "lyrics_video_neon", tmp_path))
    slot = asyncio.run(slot_repository.create(platform="youtube", account_alias="c", days=[0], times=["09:00"], niche_filter=niche_filter))
    assert engine._pick_oldest_ready_job(slot) == picked


# ── comando real que se ejecuta ─────────────────────────────────────────────

@pytest.mark.parametrize(("seconds", "expected_tail"), [(10, ["--seconds", "10"]), (None, ["--formats", "9x16,16x9"])])
def test_kit_render_command(monkeypatch, seconds, expected_tail):
    captured: list[tuple] = []

    class _Stdout:
        async def readline(self):
            return b""

    class _Proc:
        returncode = 0
        stdout = _Stdout()

        async def wait(self):
            return 0

    async def fake_exec(*cmd, **kwargs):
        captured.append(cmd)
        return _Proc()

    monkeypatch.setattr(recorder_mod.asyncio, "create_subprocess_exec", fake_exec)
    asyncio.run(recorder_mod.run_kit_render("codex-titanic", seconds))
    cmd = list(captured[0])
    assert cmd[1].endswith("explainer-kit/tools/kit.py")
    assert cmd[2:4] == ["render", "codex-titanic"]
    assert cmd[-2:] == expected_tail
    assert Path(cmd[1]).exists()


def test_kit_render_failure_raises(monkeypatch):
    class _Stdout:
        def __init__(self):
            self.lines = [b"Traceback: boom\n", b""]

        async def readline(self):
            return self.lines.pop(0)

    class _Proc:
        returncode = 2
        stdout = _Stdout()

        async def wait(self):
            return 2

    async def fake_exec(*cmd, **kwargs):
        return _Proc()

    monkeypatch.setattr(recorder_mod.asyncio, "create_subprocess_exec", fake_exec)
    with pytest.raises(recorder_mod.RenderError, match="código 2"):
        asyncio.run(recorder_mod.run_kit_render("x", 10))


def test_kit_render_forwards_output_as_it_arrives(monkeypatch):
    class _Stdout:
        def __init__(self):
            self.lines = [b"@@format 16x9 1 1\n", b"@@progress 3 5\n", b""]

        async def readline(self):
            return self.lines.pop(0)

    class _Proc:
        returncode = 0
        stdout = _Stdout()

        async def wait(self):
            return 0

    captured = {}

    async def fake_exec(*cmd, **kwargs):
        captured["cmd"] = cmd
        captured.update(kwargs)
        return _Proc()

    monkeypatch.setattr(recorder_mod.asyncio, "create_subprocess_exec", fake_exec)
    received: list[str] = []
    asyncio.run(recorder_mod.run_kit_render("x", None, ("16x9",), on_output=received.append))
    assert received == ["@@format 16x9 1 1", "@@progress 3 5"]
    assert captured["env"]["PYTHONUNBUFFERED"] == "1"


def test_render_progress_protocol_aggregates_formats_and_estimates_eta():
    job = recorder_mod.RecordJob(
        job_id="j1",
        video_id="tech-1",
        category_path="node_tech",
        duration="full",
        publish=False,
        privacy="private",
        account_selector=None,
        formats=("16x9", "9x16"),
    )
    started = time.monotonic() - 12

    recorder_mod._consume_render_line(job, "@@format 16x9 1 2", started)
    recorder_mod._consume_render_line(job, "@@progress 50 100", started)
    assert job.progress == pytest.approx(0.2375)
    assert job.progress_format == "16x9"
    assert job.progress_phase == "capturing"
    assert job.eta_seconds is not None and job.eta_seconds > 0

    recorder_mod._consume_render_line(job, "@@phase encode", started)
    assert job.progress_phase == "encoding"
    assert job.progress == pytest.approx(0.2375)

    recorder_mod._consume_render_line(job, "@@format 9x16 2 2", started)
    recorder_mod._consume_render_line(job, "@@progress 50 100", started)
    assert job.progress_format == "9x16"
    assert job.progress_phase == "capturing"
    assert job.progress == pytest.approx(0.7375)


# ── API HTTP ────────────────────────────────────────────────────────────────

async def test_api_lists_real_videos_with_category(api_client):
    response = await api_client.get("/api/v1/explainer/videos")
    assert response.status_code == 200
    by_id = {item["video_id"]: item for item in response.json()}
    if "codex-titanic" in by_id:
        assert by_id["codex-titanic"]["category_id"] == "node_history"
        assert by_id["apolo-1202"]["category_id"] == "node_tech"
        assert by_id["codex-titanic"]["category_name"] == "NodeHistory"
        assert by_id["codex-titanic"]["ready"] is True


async def test_api_categories_tree(api_client):
    response = await api_client.get("/api/v1/categories")
    assert response.status_code == 200
    tree = {c["id"]: c for c in response.json()}
    assert set(tree) == {"node_tech", "node_history", "node_motion", "node_politics", "node_economy"}
    assert tree["node_tech"]["designs"] == ["rough"]
    assert [c["path"] for c in tree["node_motion"]["children"]] == [
        "node_motion/letras", "node_motion/promos", "node_motion/fondos", "node_motion/instrumental",
        "node_motion/fase_de_pruebas",
    ]


async def test_api_record_404_for_unknown_video(api_client):
    assert (await api_client.post("/api/v1/explainer/videos/no-existe/record", json={})).status_code == 404


@pytest.mark.parametrize(
    ("body", "status"),
    [
        ({"publish": True, "duration": "full"}, 400),                                   # falta cuenta
        ({"publish": True, "duration": "10", "account_selector": "youtube:c"}, 400),    # preview no se publica
        ({"duration": "30"}, 422),                                                      # duración inválida
        ({"privacy": "secreto"}, 422),                                                  # privacidad inválida
    ],
)
async def test_api_record_validation(body, status, api_client):
    response = await api_client.post("/api/v1/explainer/videos/codex-titanic/record", json=body)
    assert response.status_code == status, response.text


async def test_api_record_accepts_and_reports_job(monkeypatch, make_recorder, videos_root, api_client):
    """POST devuelve 202 con el job; GET /jobs/{id} lo encuentra."""
    rec, _ = make_recorder()
    monkeypatch.setattr("src.presentation.api.routers.explainer.get_recorder", lambda: rec)
    monkeypatch.setattr("src.presentation.api.routers.explainer.get_video", lambda vid: load_video(videos_root / "tech-1"))

    response = await api_client.post("/api/v1/explainer/videos/tech-1/record", json={"duration": "20"})
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["duration"] == "20"
    assert body["category_path"] == "node_tech"

    job = await api_client.get(f"/api/v1/explainer/jobs/{body['job_id']}")
    assert job.status_code == 200
    assert job.json()["video_id"] == "tech-1"
    assert 0 <= job.json()["progress"] <= 1
    assert {"progress_format", "progress_phase", "started_at", "eta_seconds"} <= job.json().keys()
    listed = await api_client.get("/api/v1/explainer/jobs?active=true")
    assert listed.status_code == 200
    assert any(item["job_id"] == body["job_id"] for item in listed.json())
    await rec.wait(body["job_id"])
    recent = await api_client.get("/api/v1/explainer/jobs?active=true")
    assert any(item["job_id"] == body["job_id"] and item["state"] == "done" for item in recent.json())


async def test_api_unknown_job_404(api_client):
    assert (await api_client.get("/api/v1/explainer/jobs/nope")).status_code == 404


# ── contrato con el CLI real ────────────────────────────────────────────────

def _load_kit_module():
    import importlib.util

    spec = importlib.util.spec_from_file_location("explainer_kit_cli", recorder_mod.KIT_CLI)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("seconds", [10, 20, None])
def test_kit_cli_writes_the_files_the_recorder_reads(tmp_path: Path, monkeypatch, seconds, capsys):
    """Ejecuta el cmd_render REAL de kit.py (sin render_promo) y compara las rutas.

    La prueba en vivo del 2026-10-10 falló justo aquí: kit.py escribía
    '<id>-9x16-10s.mp4' y el grabador buscaba '<id>-10s-9x16.mp4'.
    """
    kit = _load_kit_module()
    video_dir = tmp_path / "vid"
    (video_dir / "render").mkdir(parents=True)
    written: list[Path] = []

    def fake_run(cmd, **kwargs):
        written.append(Path(str(cmd[3])))
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(kit, "vdir", lambda _id: video_dir)
    monkeypatch.setattr(kit, "run", fake_run)
    monkeypatch.setattr(kit, "cmd_manifest", lambda a: None)
    kit.cmd_render(SimpleNamespace(id="vid", formats="9x16,16x9", seconds=seconds or 0))

    expected_dir = video_dir / "render" / "preview" if seconds else video_dir / "render"
    assert written == [expected_dir / recorder_mod.render_filename("vid", f, seconds) for f in ("9x16", "16x9")]
    assert capsys.readouterr().out.splitlines() == ["@@format 9x16 1 2", "@@format 16x9 2 2"]


def test_kit_cli_stops_when_render_fails(tmp_path: Path, monkeypatch):
    kit = _load_kit_module()
    (tmp_path / "vid" / "render").mkdir(parents=True)
    monkeypatch.setattr(kit, "vdir", lambda _id: tmp_path / "vid")
    monkeypatch.setattr(kit, "run", lambda cmd, **kw: SimpleNamespace(returncode=3))
    with pytest.raises(SystemExit) as exc:
        kit.cmd_render(SimpleNamespace(id="vid", formats="9x16", seconds=10))
    assert exc.value.code == 3


def test_publish_to_several_channels_with_own_texts(videos_root: Path, make_recorder, monkeypatch):
    """Un video completo se publica en varios canales: cada red recibe sus textos y su
    formato, y si un canal falla los demás igual se publican."""
    monkeypatch.setattr(recorder_mod, "record_published_video", _noop_async)
    pub = json.loads((videos_root / "tech-1" / "publish.json").read_text())
    pub.update({"facebook_title": "Título FB", "tiktok_caption": "Caption TT", "tiktok_hashtags": ["#ia"]})
    (videos_root / "tech-1" / "publish.json").write_text(json.dumps(pub))
    calls: list[dict] = []

    class _Facade:
        async def publish_video(self, **kw):
            calls.append(kw)
            if kw["account_selector"].startswith("facebook"):
                raise RuntimeError("token vencido")
            platform = kw["account_selector"].split(":")[0]
            return SimpleNamespace(post_id=f"p-{platform}", url=f"https://x/{platform}", platform=platform, account_alias="a")

    rec, _ = make_recorder(_Facade())
    job = _record(rec, load_video(videos_root / "tech-1"), duration="full", publish=True, privacy="public",
                  account_selectors=["youtube:a", "tiktok:b", "facebook:c"])

    assert job.state == RecordState.done
    by = {c["account_selector"]: c for c in calls}
    assert by["youtube:a"]["video_path"].name == "tech-1-16x9.mp4" and by["youtube:a"]["privacy"] == "public"
    assert by["tiktok:b"]["video_path"].name == "tech-1-9x16.mp4" and by["tiktok:b"]["title"] == "Caption TT"
    assert by["facebook:c"]["title"] == "Título FB"
    assert [r.get("post_id") for r in job.publish_results] == ["p-youtube", "p-tiktok", None]
    assert "facebook:c" in job.error


def test_publish_fails_only_if_every_channel_fails(videos_root: Path, make_recorder, monkeypatch):
    monkeypatch.setattr(recorder_mod, "record_published_video", _noop_async)

    class _Down:
        async def publish_video(self, **kw):
            raise RuntimeError("sin red")

    rec, _ = make_recorder(_Down())
    job = _record(rec, load_video(videos_root / "tech-1"), duration="full", publish=True,
                  account_selectors=["youtube:a", "tiktok:b"])
    assert job.state == RecordState.failed and "ningún canal" in job.error


# ── formatos: 16:9 por defecto, 9:16 solo si se pide o lo exige la red ─────────

def test_default_records_only_desktop_16x9(videos_root: Path, make_recorder, tmp_path: Path):
    rec, render = make_recorder()
    job = _record(rec, load_video(videos_root / "hist-1"), duration="full")

    assert job.state == RecordState.done, job.error
    assert render.formats == [("16x9",)]
    assert [Path(p).name for p in job.outputs] == ["hist-1-16x9.mp4"]
    record = job_tracker.get(job.scheduled_job_id)
    assert set(record["file_paths"]) == {"youtube"}
    assert record["ready_formats"] == ["youtube"]


class _FakeThumbnails:
    """Imita thumbnails.render: escribe render/thumbnail-<opción>.jpg sin abrir el navegador."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[str, ...]]] = []

    async def __call__(self, video, options):
        self.calls.append((video.video_id, tuple(options)))
        out = {}
        for option in options:
            path = video.path / "render" / f"thumbnail-{option}.jpg"
            path.write_bytes(b"jpg")
            out[option] = path
        return out


def test_full_recording_attaches_the_chosen_thumbnail(videos_root: Path, tmp_path: Path):
    thumbs, publisher = _FakeThumbnails(), _FakePublisher()
    rec = ExplainerRecorder(render_runner=_FakeRender(videos_root), publisher_getter=lambda: publisher,
                            output_root=tmp_path / "output", thumbnail_renderer=thumbs)
    job = _record(rec, load_video(videos_root / "hist-1"), duration="full", publish=True,
                  account_selectors=["youtube:c", "tiktok:t"], thumbnail="A")
    assert job.state == RecordState.done, job.error
    assert thumbs.calls == [("hist-1", ("A",))]   # se captura de nuevo antes de publicar
    youtube = next(c for c in publisher.calls if c["account_selector"] == "youtube:c")
    tiktok = next(c for c in publisher.calls if c["account_selector"] == "tiktok:t")
    assert youtube["thumbnail_path"].name == "thumbnail.jpg" and "thumbnail_path" not in tiktok
    record = job_tracker.get(job.scheduled_job_id)
    assert Path(record["file_paths"]["thumbnail"]).exists()
    assert "thumbnail" not in record["ready_formats"]


def test_v1_publish_can_offer_the_image_thumbnail(videos_root: Path, monkeypatch):
    from src.core.explainer import thumbnails
    from src.core.explainer.publishing import opening
    monkeypatch.setattr(opening, "TEMPLATES_DIR", videos_root)
    video_dir = videos_root / "hist-1"
    (video_dir / "assets" / "media").mkdir(parents=True)
    (video_dir / "assets" / "media" / "retrato.jpg").write_bytes(b"jpg")
    data = json.loads((video_dir / "publish.json").read_text())
    data.update(thumbnail_text="UN SOLO ERROR", thumbnail_image="retrato.jpg", thumbnail_image_side="left")
    (video_dir / "publish.json").write_text(json.dumps(data))
    specs = thumbnails.intro_specs(load_video(video_dir))
    assert specs["B"]["component"] == "binary.introv2"
    assert specs["B"]["params"]["src"] == "/hist-1/assets/media/retrato.jpg" and specs["B"]["params"]["imageSide"] == "left"
    thumbnails.choose(load_video(video_dir), "B")
    assert json.loads((video_dir / "publish.json").read_text())["thumbnail_option"] == "B"


def test_unavailable_thumbnail_option_is_rejected(videos_root: Path, make_recorder):
    rec, _ = make_recorder()
    with pytest.raises(ValueError, match="no está disponible"):   # v1 sin foto elegida: solo A
        rec.submit(load_video(videos_root / "hist-1"), duration="full", thumbnail="B")


def test_previews_never_capture_thumbnails(videos_root: Path, tmp_path: Path):
    thumbs = _FakeThumbnails()
    rec = ExplainerRecorder(render_runner=_FakeRender(videos_root), output_root=tmp_path / "output", thumbnail_renderer=thumbs)
    job = _record(rec, load_video(videos_root / "hist-1"), duration="10")
    assert job.state == RecordState.done and thumbs.calls == []


def test_scheduled_youtube_publish_uploads_the_explainer_thumbnail(videos_root: Path, tmp_path: Path, monkeypatch):
    monkeypatch.setattr(settings, "schedule_auto_fill_enabled", True)
    rec = ExplainerRecorder(render_runner=_FakeRender(videos_root), output_root=tmp_path / "output",
                            thumbnail_renderer=_FakeThumbnails())
    _record(rec, load_video(videos_root / "hist-1"), duration="full")
    asyncio.run(slot_repository.create(platform="youtube", account_alias="c", days=[0], times=["09:00"], niche_filter="node_history"))
    publisher = _FakePublisher()
    asyncio.run(engine.process_tick(publisher, now=MONDAY_9AM))
    assert publisher.calls[0]["thumbnail_path"].name == "thumbnail.jpg"


def test_explainer_publish_texts_drop_emojis(videos_root: Path):
    publish = videos_root / "hist-1" / "publish.json"
    data = json.loads(publish.read_text())
    data.update(youtube_title="El muro cayó 🔥 Nadie lo esperaba", youtube_description="Línea 1 😱\nLínea 2", youtube_tags=["muro", "🔥"])
    publish.write_text(json.dumps(data, ensure_ascii=False))
    title, description, tags = recorder_mod._copy_for(load_video(videos_root / "hist-1"), "youtube")
    assert (title, description, tags) == ("El muro cayó. Nadie lo esperaba", "Línea 1\nLínea 2", ["muro"])


def test_mobile_9x16_only_when_requested(videos_root: Path, make_recorder):
    rec, render = make_recorder()
    _record(rec, load_video(videos_root / "hist-1"), duration="full", formats=["16x9", "9x16"])
    assert render.formats == [("9x16", "16x9")]


def test_tiktok_publish_adds_vertical_even_if_not_requested(videos_root: Path, make_recorder):
    publisher = _FakePublisher()
    rec, render = make_recorder(publisher)
    job = _record(rec, load_video(videos_root / "tech-1"), duration="full", publish=True,
                  account_selectors=["tiktok:alias", "youtube:c"], formats=["16x9"])
    assert job.state == RecordState.done, job.error
    assert render.formats == [("9x16", "16x9")]


def test_invalid_format_is_rejected(videos_root: Path, make_recorder):
    rec, _ = make_recorder()
    with pytest.raises(ValueError, match="formato inválido"):
        rec.submit(load_video(videos_root / "tech-1"), formats=["4x3"])


def test_full_recording_stores_generation_seconds_for_library(videos_root: Path, make_recorder):
    rec, _ = make_recorder()
    job = _record(rec, load_video(videos_root / "hist-1"), duration="full")
    record = job_tracker.get(job.scheduled_job_id)
    assert record["generation_seconds"] == job.render_seconds
    assert job_tracker.generation_seconds(record) is not None
