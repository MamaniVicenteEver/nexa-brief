"""Drafts: reanudación del pipeline, persistencia del draft y endpoints /drafts.

Las etapas del pipeline se mockean (sin IA, sin grabar): lo que se prueba es
que `resume=True` corra SOLO lo que falta, que el draft guarde el último Job
sano y que "Grabar" retome ESE Job registrándolo como un job real.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import anyio
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


@pytest.fixture(scope="module", autouse=True)
def _bucle_persistente():
    # Starlette crea un bucle por petición y lo cierra al terminarla: las tareas de
    # fondo de los borradores (vista previa, grabación) se cancelarían a mitad.
    # El servidor real mantiene un solo bucle; aquí se reproduce ese comportamiento.
    with anyio.from_thread.start_blocking_portal(**client.async_backend) as portal:
        client.portal = portal
        yield
    client.portal = None


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
    monkeypatch.setattr(pipeline, "get_copy_ai", lambda: None)

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


async def _mark_nodemotion_ready(draft_id: str, tmp_path: Path) -> None:
    """Materializa el paquete mínimo para probar el recorrido de grabación."""
    from src.core.draft_details import DraftDetails, PlatformDetails
    from src.core.draft_thumbnails import ThumbnailOption, ThumbnailSet, image_path

    job = drafts.load_job(draft_id)
    content = tmp_path / "ready-content"
    content.mkdir(parents=True, exist_ok=True)
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"content_dir": content})})
    from src.core.draft_thumbnails import preview_manifest
    raw = preview_manifest(job, DraftDetails(song_name="Tema"))
    raw["selected"] = "A"
    manifest = ThumbnailSet.model_validate({**raw, "urls": {"A": "/drafts/test/shared"}})
    path = image_path(job, manifest, "A")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"captura de prueba")
    # Una sola miniatura A/B: la misma captura para todos los destinos.
    paths = {output: path for output in drafts.DEFAULT_RECORD_OUTPUTS}
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"thumbnail_paths_by_output": paths})})
    await drafts._save_job_async(draft_id, job)
    details = DraftDetails(copies={output: PlatformDetails(title="Título", description="Descripción") for output in drafts.DEFAULT_RECORD_OUTPUTS})
    await collection("drafts").update(draft_id, {"status": "prepared", "details": details.model_dump(mode="json"), "thumbnails": manifest.model_dump(mode="json")})


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


def test_render_options_turn_off_pipeline_publishing(fake_stages: list[str]):
    # Las cuentas se publican por la cola al terminar (draft_publishing), no en el pipeline.
    job = drafts.apply_render_options(
        _job(JobStage.HTML_GENERATED), RenderOptions(publish_accounts=["youtube:canal_1"], formats=["16x9"])
    )
    assert job.input.publishing.enabled is False
    assert job.input.formats == ["16x9"]
    final = asyncio.run(pipeline.run(job, resume=True))
    assert final.stage == JobStage.PACKAGED
    assert fake_stages == ["video_recorder", "result_summarizer", "packager"]


def test_prepared_details_become_the_job_summary():
    from src.core.draft_details import DraftDetails, PlatformDetails

    details = DraftDetails(song_name="Cielo", language="es", copies={
        "youtube": PlatformDetails(title="Cielo · Letra", description="d", tags=["a"]),
        "instagram": PlatformDetails(title="Cielo", description="ig"),
    })
    job = drafts.apply_render_options(_job(JobStage.HTML_GENERATED), RenderOptions(), details)
    assert job.artifacts.summary.youtube_title == "Cielo · Letra"
    assert job.artifacts.summary.platform_copies["instagram"].description == "ig"


def test_result_summarizer_uses_prepared_summary_without_ai(tmp_path: Path):
    from src.config.niche_config import get_niche_config
    from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
    from src.modules import result_summarizer

    details = DraftDetails(copies={"youtube": PlatformDetails(title="T", description="D")})
    job = _job(JobStage.VIDEO_RECORDED)
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(
        update={"summary": to_summary(details), "output_dir": tmp_path})})
    result = asyncio.run(result_summarizer.run(job, ai=None, niche_cfg=get_niche_config(NICHE_ID)))
    assert result.stage == JobStage.SUMMARY_GENERATED
    assert (tmp_path / "logs" / "08_resumen_final.json").exists()


def test_restrict_formats_keeps_only_the_chosen_ones():
    from src.config.niche_config import get_niche_config

    niche = get_niche_config(NICHE_ID)
    assert len(niche.video.formats) == 2
    only_169 = pipeline.restrict_formats(niche, ["16x9"])
    assert [f.aspect_ratio for f in only_169.video.formats] == ["16:9"]
    assert pipeline.restrict_formats(niche, None) is niche
    assert pipeline.restrict_formats(niche, ["16x9", "9x16"]) is niche


def test_format_for_each_account():
    from src.core.draft_publishing import format_for

    both = RenderOptions(formats=["16x9", "9x16"], account_formats={"facebook:p": "9x16", "youtube:c": "9x16"})
    assert format_for("youtube:c", both) == "16x9"          # YouTube publica en 16:9
    assert format_for("facebook:p", both) == "9x16"         # lo que eligió la persona
    assert format_for("instagram:i", both) == "9x16"        # el de su red
    only = RenderOptions(formats=["16x9"])
    assert format_for("instagram:i", only) == "16x9"        # solo hay lo grabado


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


@pytest.mark.parametrize("status", ["prepared", "rendered", "failed"])
def test_read_migrates_unnamed_recordable_drafts(status: str):
    async def scenario():
        draft = await _create(job=_job(JobStage.HTML_GENERATED))
        await collection("drafts").update(draft.draft_id, {
            "status": status, "name": "", "recoverable": status == "failed",
            "details": {"song_name": "  Canción  "},
        })
        loaded = await drafts.get(draft.draft_id)
        assert loaded.name == "Canción"
        assert collection("drafts").get(draft.draft_id)["name"] == "Canción"
        assert (await drafts.list_drafts(TEMPLATE_ID))[0].name == "Canción"
    asyncio.run(scenario())


def test_working_draft_can_remain_unnamed():
    async def scenario():
        draft = await _create()
        assert (await drafts.get(draft.draft_id)).name == ""
    asyncio.run(scenario())


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
    assert draft.recoverable is False
    assert not drafts.can_render(draft, drafts.load_job(draft.draft_id))
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
    # Una recuperación conserva el preview, pero debe completar preparación antes de grabar.
    assert not drafts.can_render(draft, drafts.load_job(draft.draft_id))


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


def test_full_flow_preview_then_render(fake_stages: list[str], tmp_path: Path, monkeypatch):
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
    assert client.post(f"/api/v1/drafts/{draft_id}/render", json={}).status_code == 409
    asyncio.run(_mark_nodemotion_ready(draft_id, tmp_path))
    # El renderer se prueba aparte; esta prueba solo valida la reanudación del pipeline.
    from src.core import draft_thumbnails
    async def fake_capture(*args, **kwargs):
        path = tmp_path / "ready-content" / "thumbnail.jpg"
        path.write_bytes(b"captura de prueba")
        return path
    monkeypatch.setattr(draft_thumbnails, "capture_selected", fake_capture)
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


def test_auto_render_prepares_ai_details_before_recording_and_publishes_selected_format(fake_stages, monkeypatch):
    from contextlib import asynccontextmanager
    from types import SimpleNamespace
    from src.core import draft_details, draft_publishing
    from src.core.draft_details import DraftDetails, PlatformDetails
    from src.presentation.api.routers import drafts as draft_router

    observed = []

    async def generate(*_args, **_kwargs):
        observed.append("prepare")
        details = DraftDetails(song_name="Cielo", copies={"youtube": PlatformDetails(title="Cielo")})
        details._thumbnail_texts = {"A": "Cielo", "B": "Una frase real"}
        details._thumbnail_selected = "B"
        return details

    async def capture(draft_id, job):
        draft = await drafts.get(draft_id)
        assert draft.details.song_name == "Cielo"
        assert draft.thumbnails.options["B"].text == "Una frase real"
        assert draft.thumbnails.selected == "B"
        assert job.input.formats == ["16x9", "9x16"]
        observed.append("capture")
        return job

    async def publish(job_id, options):
        observed.append(("publish", draft_publishing.format_for("instagram:cuenta", options)))

    @asynccontextmanager
    async def queue_slot(_job_id):
        yield

    async def start_render(draft, job, options):
        job = drafts.apply_render_options(job, options, draft.details)
        await drafts.start_render(draft.draft_id, job)
        await draft_router._render_then_publish(draft.draft_id, job, options)
        return job.job_id

    monkeypatch.setattr(draft_details, "generate", generate)
    monkeypatch.setattr(drafts, "_capture_selected_thumbnail", capture)
    monkeypatch.setattr(drafts, "get_job_queue", lambda: SimpleNamespace(slot=queue_slot))
    monkeypatch.setattr(draft_publishing, "publish_rendered", publish)
    monkeypatch.setattr(draft_router, "_start_render", start_render)
    monkeypatch.setattr(draft_router, "_job_on_stage", None)

    async def scenario():
        options = RenderOptions(publish_accounts=["instagram:cuenta"])
        draft = await _create(auto_render=options)
        await draft_router._preview_then_maybe_render(draft, drafts.load_job(draft.draft_id))
        return await drafts.get(draft.draft_id)

    done = asyncio.run(scenario())
    assert done.status == "rendered"
    assert done.job_id
    assert fake_stages[-1] == "packager"
    assert observed == ["prepare", "capture", ("publish", "9x16")]


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


# ── Sandbox: nombre, preparar, detalles ──────────────────────────────────────

def test_prepare_generates_details_then_save_marks_edited(fake_stages: list[str], monkeypatch):
    from src.core import draft_details
    from src.core.draft_details import DraftDetails, PlatformDetails

    seen_notes: list[str] = []

    async def fake_generate(job, niche_id, seed, notes=""):
        seen_notes.append(notes)
        return DraftDetails(song_name="Cielo", copies={"youtube": PlatformDetails(title="Cielo")})

    monkeypatch.setattr(draft_details, "generate", fake_generate)

    async def scenario():
        draft = await _create(name="Prototipo 1")
        await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        ready = await drafts.get(draft.draft_id)
        assert drafts.can_prepare(ready, drafts.load_job(draft.draft_id))
        started = await drafts.start_prepare(draft.draft_id, "  Cielo de Ana Ruiz, habla de una despedida  ")
        assert started.status == "preparing" and started.song_notes == "Cielo de Ana Ruiz, habla de una despedida"
        await drafts.run_prepare(started, drafts.load_job(draft.draft_id))
        prepared = await drafts.get(draft.draft_id)
        assert prepared.status == "prepared" and prepared.details.song_name == "Cielo"
        assert seen_notes == ["Cielo de Ana Ruiz, habla de una despedida"]   # la información llega a la IA
        # La respuesta simulada solo tiene un título y no incluye las cinco capturas.
        assert not drafts.can_render(prepared, drafts.load_job(draft.draft_id))
        saved = await drafts.save_details(draft.draft_id, prepared.details.model_copy(update={"song_name": "Cielo 2"}))
        assert saved.details.edited and saved.details.song_name == "Cielo 2"
        renamed = await drafts.rename(draft.draft_id, "  Mi versión ")
        assert renamed.name == "Mi versión"

    asyncio.run(scenario())


def test_prepare_failure_keeps_preview_ready(fake_stages: list[str], monkeypatch):
    from src.core import draft_details

    async def boom(*_a, **_k):
        raise RuntimeError("sin cuota")

    monkeypatch.setattr(draft_details, "generate", boom)

    async def scenario():
        draft = await _create()
        await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        started = await drafts.start_prepare(draft.draft_id)
        await drafts.run_prepare(started, drafts.load_job(draft.draft_id))
        after = await drafts.get(draft.draft_id)
        assert after.status == "preview_ready"
        assert "sin cuota" in after.errors[0]

    asyncio.run(scenario())


def test_render_accepts_vertical_only_on_supported_engine(fake_stages: list[str], tmp_path: Path):
    created = client.post("/api/v1/drafts", json={"template_id": TEMPLATE_ID}).json()
    for _ in range(50):
        if client.get(f"/api/v1/drafts/{created['draft_id']}").json()["status"] == "preview_ready":
            break
        time.sleep(0.05)
    asyncio.run(_mark_nodemotion_ready(created["draft_id"], tmp_path))
    response = client.post(f"/api/v1/drafts/{created['draft_id']}/render", json={"formats": ["9x16"]})
    assert response.status_code == 202
