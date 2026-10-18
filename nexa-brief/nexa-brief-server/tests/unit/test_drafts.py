"""Drafts: reanudación del pipeline, persistencia del draft y endpoints /drafts.

Las etapas del pipeline se mockean (sin IA, sin grabar): lo que se prueba es
que `resume=True` corra SOLO lo que falta, que el draft guarde el último Job
sano y que "Grabar" retome ESE Job registrándolo como un job real.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.core import drafts, job_tracker, pipeline
from src.core.data import collection
from src.core.drafts import DraftInputs, RenderOptions
from src.core.job import Job, JobInput, JobStage
from src.presentation.main import app

TEMPLATE_ID = "lyrics-caution"
NICHE_ID = "lyrics_video_caution"   # config_driven_template + requires_lyrics, recorder playwright

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    out = tmp_path / "output"
    monkeypatch.setattr(settings, "output_dir", out)
    monkeypatch.setattr(settings, "enable_auto_publishing", False)
    drafts._running.clear()
    return out


@pytest.fixture
def fake_stages(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Reemplaza cada módulo del pipeline por uno que solo avanza el stage y
    anota que corrió — el orden de `calls` es el orden real de ejecución."""
    calls: list[str] = []
    monkeypatch.setattr(pipeline, "get_analysis_ai", lambda: None)
    monkeypatch.setattr(pipeline, "get_codegen_ai", lambda: None)

    def fake(name: str, stage: JobStage):
        async def run(job: Job, *_args, **_kwargs) -> Job:
            calls.append(name)
            return job.advance(stage)
        return run

    for name, stage in [
        ("input_analyzer", JobStage.INPUT_ANALYZED),
        ("resource_fetcher", JobStage.RESOURCES_FETCHED),
        ("lyrics_transcriber", JobStage.DESIGN_COMPLETE),
        ("visual_designer", JobStage.DESIGN_COMPLETE),
        ("prompt_architect", JobStage.PROMPT_BUILT),
        ("html_generator", JobStage.HTML_GENERATED),
        ("video_recorder", JobStage.VIDEO_RECORDED),
        ("result_summarizer", JobStage.SUMMARY_GENERATED),
        ("packager", JobStage.PACKAGED),
    ]:
        monkeypatch.setattr(getattr(pipeline, name), "run", fake(name, stage))
    return calls


def _job(stage: JobStage = JobStage.PENDING) -> Job:
    return Job(input=JobInput(category_name=NICHE_ID), stage=stage)


# ── pipeline.run(resume=True) ─────────────────────────────────────────────────

def test_pipeline_without_resume_runs_every_stage(fake_stages: list[str]):
    result = asyncio.run(pipeline.run(_job()))
    assert result.stage == JobStage.PACKAGED
    assert fake_stages == [
        "input_analyzer", "resource_fetcher", "lyrics_transcriber", "prompt_architect",
        "html_generator", "video_recorder", "result_summarizer", "packager",
    ]


def test_pipeline_stop_after_then_resume_runs_only_what_is_missing(fake_stages: list[str]):
    preview = asyncio.run(pipeline.run(_job(), stop_after=JobStage.HTML_GENERATED))
    assert preview.stage == JobStage.HTML_GENERATED
    fake_stages.clear()

    seen: list[JobStage] = []

    async def on_stage(job: Job) -> None:
        seen.append(job.stage)

    final = asyncio.run(pipeline.run(preview, on_stage=on_stage, resume=True))
    assert final.stage == JobStage.PACKAGED
    assert fake_stages == ["video_recorder", "result_summarizer", "packager"]
    assert final.job_id == preview.job_id
    assert seen == [
        JobStage.HTML_GENERATED, JobStage.VIDEO_RECORDED, JobStage.SUMMARY_GENERATED, JobStage.PACKAGED,
    ]


def test_pipeline_resume_follows_the_real_stage_order(fake_stages: list[str]):
    # En config_driven_template resource_fetcher va ANTES del análisis: desde
    # RESOURCES_FETCHED lo próximo es lyrics_transcriber, no prompt_architect.
    asyncio.run(pipeline.run(_job(JobStage.RESOURCES_FETCHED), resume=True))
    assert fake_stages[0] == "lyrics_transcriber"
    assert "resource_fetcher" not in fake_stages


def test_pipeline_resume_from_pending_runs_everything(fake_stages: list[str]):
    asyncio.run(pipeline.run(_job(), resume=True))
    assert len(fake_stages) == 8


def test_pipeline_resume_includes_publisher_when_enabled(fake_stages: list[str], monkeypatch):
    from src.modules import social_publisher

    async def fake_publish(job: Job, _facade) -> Job:
        fake_stages.append("social_publisher")
        return job.advance(JobStage.PUBLISHED)

    monkeypatch.setattr(social_publisher, "run", fake_publish)
    monkeypatch.setattr("src.adapters.publishing.factory.get_publisher_facade", lambda: None)
    job = drafts.apply_render_options(
        _job(JobStage.HTML_GENERATED), RenderOptions(publish_accounts=["youtube:canal_1"])
    )
    final = asyncio.run(pipeline.run(job, resume=True))
    assert final.stage == JobStage.PUBLISHED
    assert fake_stages == ["video_recorder", "result_summarizer", "packager", "social_publisher"]


def test_pipeline_resume_failed_job_raises(fake_stages: list[str]):
    with pytest.raises(ValueError):
        asyncio.run(pipeline.run(_job().fail("boom"), resume=True))
    assert fake_stages == []


def test_remaining_stages_unknown_stage_raises():
    with pytest.raises(ValueError):
        pipeline._remaining_stages([("packager", None)], JobStage.HTML_GENERATED)


# ── core/drafts ───────────────────────────────────────────────────────────────

async def _create(job: Job | None = None, **kwargs) -> drafts.Draft:
    return await drafts.create(
        template_id=TEMPLATE_ID, niche_id=NICHE_ID, inputs=DraftInputs(), job=job or _job(), **kwargs
    )


def test_run_preview_persists_job_and_marks_ready(fake_stages: list[str]):
    async def scenario():
        draft = await _create()
        await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        return await drafts.get(draft.draft_id)

    draft = asyncio.run(scenario())
    assert draft.status == "preview_ready"
    assert draft.stage == JobStage.HTML_GENERATED.value
    assert draft.preview_url == f"/api/v1/drafts/{draft.draft_id}/preview/index.html"
    assert draft.job_id is None
    assert drafts.load_job(draft.draft_id).stage == JobStage.HTML_GENERATED
    assert not drafts.is_running(draft.draft_id)


def test_preview_url_hidden_when_output_dir_is_missing(fake_stages: list[str], tmp_path: Path):
    """Draft traído de otra máquina: su output_dir no existe acá, así que no se
    ofrece "Mi versión" (el modal mostraba un 404 en vez de la plantilla)."""
    async def scenario(output_dir: Path):
        draft = await _create()
        await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        job = drafts.load_job(draft.draft_id)
        job.artifacts.output_dir = output_dir
        drafts._save_job(draft.draft_id, job)
        return await drafts.get(draft.draft_id), (await drafts.list_drafts(TEMPLATE_ID))[0]

    existing = tmp_path / "out-ok"
    existing.mkdir()
    one, listed = asyncio.run(scenario(existing))
    assert one.preview_url is not None and listed.preview_url is not None

    one, listed = asyncio.run(scenario(tmp_path / "de-otra-maquina"))
    assert one.preview_url is None and listed.preview_url is None
    assert one.status == "preview_ready"


def test_failed_stage_keeps_last_good_snapshot(fake_stages: list[str], monkeypatch):
    async def boom(job: Job, *_a, **_k) -> Job:
        raise RuntimeError("gemini caído")

    monkeypatch.setattr(pipeline.prompt_architect, "run", boom)

    async def scenario():
        draft = await _create()
        await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        return await drafts.get(draft.draft_id)

    draft = asyncio.run(scenario())
    assert draft.status == "failed"
    assert draft.recoverable is True
    assert "gemini caído" in draft.errors[-1]
    assert drafts.load_job(draft.draft_id).stage == JobStage.DESIGN_COMPLETE


def test_orphaned_in_flight_draft_is_marked_failed_recoverable():
    async def scenario():
        draft = await _create(_job(JobStage.HTML_GENERATED))
        await collection("drafts").update(draft.draft_id, {"status": "rendering"})
        drafts._running.clear()   # simula un reinicio: nadie lo está corriendo
        return await drafts.get(draft.draft_id)

    draft = asyncio.run(scenario())
    assert draft.status == "failed"
    assert draft.recoverable is True
    assert drafts.can_render(draft, drafts.load_job(draft.draft_id))


def test_running_draft_is_not_treated_as_orphan():
    async def scenario():
        draft = await _create()
        return await drafts.get(draft.draft_id)

    assert asyncio.run(scenario()).status == "previewing"


def test_run_render_resumes_same_job_through_queue(fake_stages: list[str]):
    async def scenario():
        draft = await _create(_job(JobStage.HTML_GENERATED))
        job = drafts.load_job(draft.draft_id)
        await drafts.start_render(draft.draft_id, job)
        stages: list[JobStage] = []

        async def on_stage(j: Job) -> None:
            stages.append(j.stage)

        result = await drafts.run_render(draft.draft_id, job, on_stage=on_stage)
        return await drafts.get(draft.draft_id), result, stages

    draft, result, stages = asyncio.run(scenario())
    assert fake_stages == ["video_recorder", "result_summarizer", "packager"]
    assert draft.status == "rendered"
    assert draft.job_id == result.job_id
    assert stages[-1] == JobStage.PACKAGED


def test_draft_changed_events_are_published(fake_stages: list[str]):
    from src.core.realtime.event_bus import get_event_bus

    events = []

    async def scenario():
        async def subscriber(event):
            if event.type == "draft_changed":
                events.append(event.data)

        unsubscribe = get_event_bus().subscribe(subscriber)
        try:
            draft = await _create()
            await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        finally:
            unsubscribe()

    asyncio.run(scenario())
    assert events[0]["status"] == "previewing"
    assert events[-1]["status"] == "preview_ready"
    assert set(events[-1]) == {"draft_id", "status", "stage"}


# ── Router /drafts ────────────────────────────────────────────────────────────

def _wait_status(draft_id: str, *statuses: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/api/v1/drafts/{draft_id}").json()
        if body["status"] in statuses:
            return body
        time.sleep(0.05)
    raise AssertionError(f"draft {draft_id} nunca llegó a {statuses}: {body}")


def test_create_draft_unknown_template_404():
    r = client.post("/api/v1/drafts", json={"template_id": "does-not-exist"})
    assert r.status_code == 404


def test_create_draft_unknown_music_asset_400():
    r = client.post("/api/v1/drafts", json={"template_id": TEMPLATE_ID, "music_asset_id": "nope"})
    assert r.status_code == 400


def test_create_draft_rejects_unsupported_engine_400():
    # Una plantilla de letras fuera de HF_VALIDATED_LYRICS_TEMPLATE_IDS: la
    # whitelist crece a medida que se validan, así que se busca en vez de fijarla.
    from src.adapters.recorder.infrastructure.hyperframes_adapter import supports_niche
    from src.config.niche_config import list_all_niches

    unsupported = next(
        (
            n.template.template_id for n in list_all_niches()
            if n.template and n.template.template_id and n.template.requires_lyrics and not supports_niche(n)
        ),
        None,
    )
    if unsupported is None:
        pytest.skip("todas las plantillas de letras ya están validadas para HyperFrames")
    r = client.post("/api/v1/drafts", json={
        "template_id": unsupported, "auto_render": {"recorder_engine": "hyperframes"},
    })
    assert r.status_code == 400


def test_get_unknown_draft_404():
    assert client.get("/api/v1/drafts/nope").status_code == 404
    assert client.delete("/api/v1/drafts/nope").status_code == 404
    assert client.post("/api/v1/drafts/nope/render", json={}).status_code == 404


def test_full_flow_preview_then_render(fake_stages: list[str]):
    r = client.post("/api/v1/drafts", json={
        "template_id": TEMPLATE_ID,
        "template_inputs": {"texts": {"brand.tag": "Hola"}},
        "user_context": "algo oscuro",
    })
    assert r.status_code == 202
    created = r.json()
    assert created["status"] == "previewing"
    assert created["niche_id"] == NICHE_ID
    draft_id = created["draft_id"]

    ready = _wait_status(draft_id, "preview_ready", "failed")
    assert ready["status"] == "preview_ready"
    assert ready["preview_url"].endswith(f"/drafts/{draft_id}/preview/index.html")
    assert drafts.load_job(draft_id).input.template_inputs.texts == {"brand.tag": "Hola"}

    listed = client.get(f"/api/v1/drafts?template_id={TEMPLATE_ID}").json()
    assert [d["draft_id"] for d in listed["drafts"]] == [draft_id]
    assert client.get("/api/v1/drafts?template_id=otra").json()["total"] == 0

    fake_stages.clear()
    r = client.post(f"/api/v1/drafts/{draft_id}/render", json={})
    assert r.status_code == 202
    job_id = r.json()["job_id"]
    assert job_id == drafts.load_job(draft_id).job_id

    done = _wait_status(draft_id, "rendered", "failed")
    assert done["status"] == "rendered"
    assert done["job_id"] == job_id
    assert fake_stages == ["video_recorder", "result_summarizer", "packager"]

    # Aparece como un job real (Biblioteca): mismo job_id, terminado.
    record = job_tracker.get(job_id)
    assert record["stage"] == JobStage.PACKAGED.value
    assert record.get("generation_seconds") is not None

    # Ya grabado: no se regraba.
    assert client.post(f"/api/v1/drafts/{draft_id}/render", json={}).status_code == 409

    assert client.delete(f"/api/v1/drafts/{draft_id}").status_code == 200
    assert client.get(f"/api/v1/drafts/{draft_id}").status_code == 404


def test_auto_render_chains_preview_and_render(fake_stages: list[str]):
    r = client.post("/api/v1/drafts", json={"template_id": TEMPLATE_ID, "auto_render": {}})
    assert r.status_code == 202
    done = _wait_status(r.json()["draft_id"], "rendered", "failed")
    assert done["status"] == "rendered"
    assert done["job_id"]
    assert fake_stages[-1] == "packager"


def test_render_before_preview_ready_409():
    async def scenario():
        return await _create()

    draft = asyncio.run(scenario())   # queda "previewing" y corriendo
    r = client.post(f"/api/v1/drafts/{draft.draft_id}/render", json={})
    assert r.status_code == 409
    assert client.delete(f"/api/v1/drafts/{draft.draft_id}").status_code == 409


def test_preview_file_injects_scripts_and_protects_paths(_isolated_output: Path):
    job = _job(JobStage.HTML_GENERATED)
    out = _isolated_output / job.job_id
    (out / "logs").mkdir(parents=True)
    (out / "index.html").write_text("<html><head></head><body><button id='rec-btn'></button></body></html>")
    (out / "song.mp3").write_bytes(b"ID3")
    (out / "logs" / "01_input_completado.json").write_text("{}")
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"output_dir": out})})

    async def scenario():
        draft = await _create(job)
        await collection("drafts").update(draft.draft_id, {"status": "preview_ready"})
        drafts._running.clear()
        return draft

    draft_id = asyncio.run(scenario()).draft_id
    base = f"/api/v1/drafts/{draft_id}/preview"

    r = client.get(f"{base}/index.html?controls=1&volume=0.5")
    assert r.status_code == 200
    assert "#rec-btn" in r.text   # inject_preview_scripts oculta el botón de grabar
    assert client.get(f"{base}/song.mp3").status_code == 200
    assert client.get(f"{base}/logs/01_input_completado.json").status_code == 404
    assert client.get(f"{base}/..%2F..%2Fdata%2Fsecret.json").status_code == 404
    assert client.get(f"{base}/missing.html").status_code == 404
    assert client.get("/api/v1/drafts/nope/preview/index.html").status_code == 404
