"""Contratos de automatización NodeMotion con IA, grabación y publicación simuladas."""
from __future__ import annotations

import asyncio
from pathlib import Path
import pytest

from src.config.settings import settings
from src.core import drafts, pipeline
from src.core.drafts import DraftInputs, RenderOptions
from src.core.job import Job, JobInput, JobStage

TEMPLATE_ID = "lyrics-caution"
NICHE_ID = "lyrics_video_caution"

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


# ── pipeline.run(resume=True) ─────────────────────────────────────────────────

async def _create(job: Job | None = None, **kwargs) -> drafts.Draft:
    return await drafts.create(template_id=TEMPLATE_ID, niche_id=NICHE_ID,
                               inputs=DraftInputs(), job=job or _job(), **kwargs)


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


def test_auto_render_prepare_failure_is_recoverable_and_never_records(fake_stages, monkeypatch):
    from src.core import draft_details
    from src.presentation.api.routers import drafts as draft_router

    async def fail(*_args, **_kwargs):
        raise RuntimeError("IA no disponible")

    async def forbidden(*_args, **_kwargs):
        raise AssertionError("No debe grabar si falla la preparación")

    monkeypatch.setattr(draft_details, "generate", fail)
    monkeypatch.setattr(draft_router, "_start_render", forbidden)

    async def scenario():
        draft = await _create(auto_render=RenderOptions())
        await draft_router._preview_then_maybe_render(draft, drafts.load_job(draft.draft_id))
        return await drafts.get(draft.draft_id)

    done = asyncio.run(scenario())
    assert done.status == "preview_ready"
    assert "IA no disponible" in done.errors[0]
    assert done.job_id is None
    assert "video_recorder" not in fake_stages


def test_default_formats_are_consistent_for_recording_and_publication():
    from src.core.draft_publishing import format_for

    options = RenderOptions(publish_accounts=["youtube:c", "instagram:i"])
    assert drafts.apply_render_options(_job(), options).input.formats == ["16x9", "9x16"]
    assert format_for("youtube:c", options) == "16x9"
    assert format_for("instagram:i", options) == "9x16"
    horizontal = RenderOptions(publish_accounts=["instagram:i"], account_formats={"instagram:i": "16x9"})
    assert drafts.apply_render_options(_job(), horizontal).input.formats == ["16x9"]
    assert format_for("instagram:i", horizontal) == "16x9"
    assert drafts.apply_render_options(_job(), RenderOptions()).input.formats == ["16x9"]


@pytest.mark.parametrize("automatic,previous,expected", [(True, "A", "A"), (False, None, "A"), (False, "B", "B")])
def test_prepare_preserves_user_selection_and_does_not_autoselect_in_manual_mode(fake_stages, monkeypatch, automatic, previous, expected):
    from src.core import draft_details
    from src.core.draft_details import DraftDetails

    async def generate(*_args, **_kwargs):
        details = DraftDetails(song_name="Cielo")
        details._thumbnail_selected = "B"
        return details

    monkeypatch.setattr(draft_details, "generate", generate)

    async def scenario():
        draft = await _create(auto_render=RenderOptions() if automatic else None)
        await drafts.run_preview(draft.draft_id, drafts.load_job(draft.draft_id))
        if previous is not None:
            current = await drafts.get(draft.draft_id)
            await drafts.select_thumbnail(current, previous)
        started = await drafts.start_prepare(draft.draft_id)
        await drafts.run_prepare(started, drafts.load_job(draft.draft_id))
        return await drafts.get(draft.draft_id)

    assert asyncio.run(scenario()).thumbnails.selected == expected


@pytest.mark.asyncio
async def test_no_accounts_never_opens_publisher(monkeypatch):
    from src.adapters.publishing import factory
    from src.core.draft_publishing import publish_rendered
    def forbidden():
        raise AssertionError("No debe publicar sin cuentas explícitas")
    monkeypatch.setattr(factory, "get_publisher_facade", forbidden)
    await publish_rendered("fake-job", RenderOptions())


@pytest.mark.asyncio
async def test_inferred_vertical_rejected_when_template_cannot_record_it(monkeypatch):
    from copy import deepcopy
    from unittest.mock import AsyncMock
    from fastapi import HTTPException
    from src.config.niche_config import get_niche_config
    from src.presentation.api.routers import drafts as router
    monkeypatch.setattr(router, "_validate_publishing", AsyncMock())
    niche = deepcopy(get_niche_config(NICHE_ID))
    niche.video.formats = [f for f in niche.video.formats if f.aspect_ratio == "16:9"]
    with pytest.raises(HTTPException):
        await router._validate_render_options(niche, RenderOptions(publish_accounts=["tiktok:cuenta"]))
    with pytest.raises(HTTPException):
        await router._validate_render_options(niche, RenderOptions(formats=["16x9"],
            publish_accounts=["instagram:cuenta"], account_formats={"instagram:cuenta": "9x16"}))


def test_selecting_b_keeps_real_song_in_video_intro(tmp_path, monkeypatch):
    import json
    from src.core import draft_thumbnails
    from src.core.draft_details import DraftDetails
    from src.core.job import JobArtifacts

    content = tmp_path / "content"
    content.mkdir()
    (content / "config.json").write_text(json.dumps({"intro": {"title": "Demo"}}))
    html = content / "index.html"
    html.write_text("<html></html>")
    job = Job(input=JobInput(category_name=NICHE_ID), stage=JobStage.HTML_GENERATED,
              artifacts=JobArtifacts(assets_dir=content, output_dir=content, html_path=html,
                                     config_json_path=content / "config.json"))
    async def capture(draft_id, job, details, option, options=None):
        assert option == "B"
        path = content / "thumbnail.jpg"
        path.write_bytes(b"fake image")
        return path
    monkeypatch.setattr(draft_thumbnails, "capture_selected", capture)

    async def scenario():
        draft = await _create(job)
        draft = await drafts.save_details(draft.draft_id, DraftDetails(song_name="Canción real"))
        await drafts.update_thumbnail_option(draft, "B", text="Frase de la canción", design={})
        draft = await drafts.get(draft.draft_id)
        await drafts.select_thumbnail(draft, "B")
        return await drafts._capture_selected_thumbnail(draft.draft_id, job)
    result = asyncio.run(scenario())
    assert result.artifacts.thumbnail_path.name == "thumbnail.jpg"
    assert json.loads((content / "config.json").read_text())["intro"]["title"] == "Canción real"
