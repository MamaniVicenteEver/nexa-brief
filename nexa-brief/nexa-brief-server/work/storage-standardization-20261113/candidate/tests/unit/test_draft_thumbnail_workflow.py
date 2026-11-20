"""NodeMotion thumbnail manifests: editable A/B JSON, migration and capture-on-record."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.core import draft_thumbnails, drafts, pipeline, template_original
from src.core.data import collection
from src.core.draft_details import DraftDetails, PlatformDetails
from src.core.drafts import DraftInputs
from src.core.job import Job, JobArtifacts, JobInput, JobStage
from src.presentation.main import app

TEMPLATE_ID = "lyrics-caution"
NICHE_ID = "lyrics_video_caution"
client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_thumbnail_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "output_dir", tmp_path / "output")
    drafts._running.clear()


def _job(tmp_path: Path, *, stage: JobStage = JobStage.HTML_GENERATED) -> Job:
    content = tmp_path / "content"
    content.mkdir(parents=True, exist_ok=True)
    config_path = content / "config.json"
    config_path.write_text(json.dumps({"intro": {"title": "Plantilla", "artist": "Canal", "album": "Demo"}}))
    html_path = content / "index.html"
    html_path.write_text("<!doctype html><title>preview</title>")
    return Job(
        input=JobInput(category_name=NICHE_ID),
        stage=stage,
        artifacts=JobArtifacts(
            assets_dir=content,
            output_dir=content,
            html_path=html_path,
            config_json_path=config_path,
        ),
    )


async def _create_ready(tmp_path: Path, *, original: bool = False) -> drafts.Draft:
    job = _job(tmp_path)
    draft = await drafts.create(
        template_id=TEMPLATE_ID,
        niche_id=NICHE_ID,
        inputs=DraftInputs(),
        job=job,
        original=original,
    )
    details = DraftDetails(
        song_name="Canción original",
        artist="Artista original",
        copies={"youtube": PlatformDetails(title="Título de publicación", description="Descripción")},
    )
    return await drafts.save_details(draft.draft_id, details, edited=False)


def test_renderer_route_is_static_and_serves_the_browser_renderer():
    response = client.get("/api/v1/drafts/thumbnail-renderer.js")
    assert response.status_code == 200
    assert "NexaDraftThumbnailRenderer" in response.text
    assert response.headers["content-type"].startswith("application/javascript")


def test_legacy_thumbnail_records_are_hydrated_without_capture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    async def forbidden(*_args, **_kwargs):
        raise AssertionError("legacy hydration must not capture")

    monkeypatch.setattr(draft_thumbnails, "capture_selected", forbidden)

    async def scenario():
        job = _job(tmp_path)
        draft = await drafts.create(
            template_id=TEMPLATE_ID, niche_id=NICHE_ID, inputs=DraftInputs(), job=job,
        )
        await collection("drafts").update(draft.draft_id, {
            "status": "preview_ready",
            "thumbnails": {"fingerprint": "0123456789abcdefabcd", "selected": "B", "urls": {"A": "/old/A.jpg"}},
        })
        drafts._running.discard(draft.draft_id)
        return await drafts.get(draft.draft_id)

    hydrated = asyncio.run(scenario())
    assert hydrated.thumbnails.selected == "B"
    assert set(hydrated.thumbnails.options) == {"A", "B"}
    assert hydrated.thumbnails.options["A"].text
    assert hydrated.thumbnails.options["B"].text
    assert hydrated.thumbnails.urls == {}


def test_option_edit_selection_and_record_capture_only_selected_option(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    calls: list[tuple[str, str]] = []
    record_observations: list[tuple[str | None, str, str]] = []
    chosen_text = "B" * 200
    publish_root = tmp_path / "template"
    publish_root.mkdir()
    monkeypatch.setattr(template_original, "get_template_root", lambda _template_id: publish_root)

    async def fake_capture(draft_id, job, details, option, options=None):
        calls.append((draft_id, option))
        assert details.song_name == "Canción original"
        assert options[option]["text"] == chosen_text
        path = job.artifacts.content_dir / "thumbnails" / f"{option}.jpg"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"fake-jpeg")
        return path

    async def fake_pipeline(job, *, on_stage=None, resume=False, **_kwargs):
        config = json.loads((job.artifacts.content_dir / "config.json").read_text())
        record_observations.append((job.artifacts.thumbnail_path.name, config["intro"]["title"], config["intro"]["artist"]))
        result = job.advance(JobStage.PACKAGED)
        if on_stage is not None:
            await on_stage(result)
        return result

    @asynccontextmanager
    async def free_queue_slot(_job_id):
        yield

    monkeypatch.setattr(draft_thumbnails, "capture_selected", fake_capture)
    monkeypatch.setattr(pipeline, "run", fake_pipeline)
    monkeypatch.setattr(drafts, "get_job_queue", lambda: SimpleNamespace(slot=free_queue_slot))

    async def scenario():
        draft = await _create_ready(tmp_path, original=True)
        draft_id = draft.draft_id
        url = f"/api/v1/drafts/{draft_id}/thumbnails"
        initial_a = draft.thumbnails.options["A"].text
        edited = client.put(f"{url}/B", json={"text": chosen_text, "design": {"layout": "editorial"}})
        assert edited.status_code == 200, edited.text
        assert edited.json()["thumbnails"]["options"]["A"]["text"] == initial_a
        assert edited.json()["thumbnails"]["options"]["B"]["text"] == chosen_text
        assert edited.json()["details"]["song_name"] == "Canción original"
        assert edited.json()["details"]["copies"]["youtube"]["title"] == "Título de publicación"
        assert calls == []  # editing the original is JSON-only
        assert template_original.read_thumbnail_texts(TEMPLATE_ID)["B"] == chosen_text

        selected = client.put(url, json={"option": "B"})
        assert selected.status_code == 200, selected.text
        assert selected.json()["thumbnails"]["selected"] == "B"
        assert calls == []  # selection is JSON-only too
        assert template_original.read_thumbnail_selection(TEMPLATE_ID) == "B"

        job = drafts.load_job(draft_id)
        assert await drafts.start_render(draft_id, job)
        result = await drafts.run_render(draft_id, job)
        return draft_id, result

    draft_id, result = asyncio.run(scenario())
    assert result.stage == JobStage.PACKAGED
    assert calls == [(draft_id, "B")]
    assert record_observations == [("B.jpg", "Canción original", "Artista original")]
    persisted = asyncio.run(drafts.get(draft_id))
    assert persisted.details.song_name == "Canción original"
    assert persisted.details.copies["youtube"].title == "Título de publicación"
    assert persisted.thumbnails.selected == "B"


def test_original_publish_roundtrip_restores_200_character_text_and_selection(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "template"
    root.mkdir()
    monkeypatch.setattr(template_original, "get_template_root", lambda _template_id: root)
    long_text = "Título editable " + "X" * 180
    details = DraftDetails(song_name="Original", artist="Artista")
    template_original.write_publish(
        TEMPLATE_ID, details, None,
        thumbnail_texts={"A": "Nombre", "B": long_text},
        thumbnail_selected="B",
    )

    async def scenario():
        draft = await drafts.create(
            template_id=TEMPLATE_ID, niche_id=NICHE_ID, inputs=DraftInputs(),
            job=_job(tmp_path / "draft"), original=True,
        )
        saved = template_original.read_publish(TEMPLATE_ID)
        saved._thumbnail_texts = template_original.read_thumbnail_texts(TEMPLATE_ID)
        saved._thumbnail_selected = template_original.read_thumbnail_selection(TEMPLATE_ID)
        return await drafts.save_details(draft.draft_id, saved, edited=False)

    restored = asyncio.run(scenario())
    assert restored.thumbnails.options["B"].text == long_text
    assert restored.thumbnails.selected == "B"


def test_copy_writer_requests_thumbnail_texts_in_the_same_traced_ai_call(monkeypatch: pytest.MonkeyPatch):
    from src.core.metadata.copy_renderer import CopyPieces, RenderedCopy
    from src.modules import copy_writer

    class FakeAI:
        def __init__(self):
            self.calls = []

        async def complete_json(self, system, user):
            self.calls.append((system, user))
            return {"thumbnail_options": {"A": "Nombre de canción", "B": "Otra frase distinta"}}

    ai = FakeAI()
    monkeypatch.setattr(copy_writer, "parse_pieces", lambda raw, _strategies: (CopyPieces(None, None), []))
    monkeypatch.setattr(copy_writer, "render_copy", lambda *_args: RenderedCopy("test", "title", "desc", []))
    monkeypatch.setattr(copy_writer, "build_copy_prompt", lambda *_args: ("system", "copy facts"))

    strategy = object()  # parse/render are stubbed; a non-empty strategy keeps write_copy on one call.
    result = asyncio.run(copy_writer.write_copy(
        ai, "facts", "es", "seed", strategies={"youtube": strategy}, include_thumbnail_options=True,
    ))
    assert len(ai.calls) == 1
    assert '"thumbnail_options"' in ai.calls[0][1]
    assert result.thumbnail_options == {"A": "Nombre de canción", "B": "Otra frase distinta"}
    assert result.raw_responses == [{"thumbnail_options": {"A": "Nombre de canción", "B": "Otra frase distinta"}}]
