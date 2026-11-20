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

def test_target_thumbnail_formats_keep_legacy_horizontal_and_migrate_destination_selection(tmp_path: Path):
    job = _job(tmp_path)
    details = DraftDetails(song_name="Canción original", artist="Artista original")
    horizontal = draft_thumbnails.preview_manifest(job, details)
    portrait = draft_thumbnails.preview_manifest(job, details, output_format="9x16")
    assert horizontal["format"] == "16x9"
    assert portrait["format"] == "9x16"
    assert horizontal["fingerprint"] != portrait["fingerprint"]
    legacy = draft_thumbnails.ThumbnailSet.model_validate({
        "fingerprint": "0123456789abcdefabcd", "selected": "B",
        "urls": {"B": "/legacy/B.jpg"},
        "options": {"A": {"text": "Original A"}, "B": {"text": "Original B"}},
    })
    assert legacy.format == "16x9"  # old records retain the shared landscape contract

    async def scenario():
        draft = await _create_ready(tmp_path / "draft")
        stale = draft.model_copy(update={"thumbnails": legacy, "thumbnails_by_output": {"tiktok": legacy}})
        return drafts.thumbnail_manifest(stale, _job(tmp_path / "draft"), output="tiktok")

    migrated = asyncio.run(scenario())
    assert migrated.format == "16x9"  # una sola miniatura horizontal para todos los destinos
    assert migrated.selected == "B"  # la elección guardada se conserva
    assert migrated.options["B"].text == "Original B"


def test_portrait_capture_contract_has_vertical_dimensions_and_safe_area(tmp_path: Path):
    import subprocess
    import xml.etree.ElementTree as ET

    manifest = draft_thumbnails.preview_manifest(
        _job(tmp_path), DraftDetails(song_name="Cinco palabras en pantalla"), output_format="9x16",
    )
    script = "const fs=require('fs'),vm=require('vm');const c={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c);const m=JSON.parse(fs.readFileSync(0,'utf8'));console.log(c.module.exports.renderSvg(m,'A',720,1280,{}));"
    result = subprocess.run(
        ["node", "-e", script, str(draft_thumbnails.RENDERER_PATH)],
        input=json.dumps(manifest), text=True, capture_output=True, check=True, timeout=10,
    )
    root = ET.fromstring(result.stdout)
    assert root.attrib["width"] == "720" and root.attrib["height"] == "1280"
    assert root.attrib["viewBox"] == "0 0 720 1280"
    safe = next(node for node in root.iter() if node.attrib.get("data-role") == "safe-content")
    safe_clip = safe.attrib["clip-path"].removeprefix("url(#").removesuffix(")")
    clip = next(node for node in root.iter() if node.tag.endswith("clipPath") and node.attrib.get("id") == safe_clip)
    safe_rect = next(node for node in clip if node.tag.endswith("rect"))
    assert {key: safe_rect.attrib[key] for key in ("x", "y", "width", "height")} == {
        "x": "48", "y": "130", "width": "520", "height": "900",
    }
    title = next(node for node in safe if node.attrib.get("data-role") == "title")
    assert len(list(title)) <= 2
    assert all(child.attrib.get("x") == "308" for child in title)


def test_capture_validator_accepts_only_dimensions_for_each_destination(tmp_path: Path):
    from PIL import Image, ImageDraw

    for output_format, size in draft_thumbnails.THUMBNAIL_SIZE.items():
        path = tmp_path / f"{output_format}.jpg"
        image = Image.new("RGB", size, "#101020")
        ImageDraw.Draw(image).rectangle((0, 0, size[0] // 2, size[1]), fill="#E0D0B0")
        image.save(path, format="JPEG", quality=90)
        draft_thumbnails._validate(path, output_format)
    with pytest.raises(ValueError, match="formato incorrecto"):
        draft_thumbnails._validate(tmp_path / "9x16.jpg", "16x9")



def test_promo_portrait_does_not_add_lyrics_label(tmp_path: Path):
    import subprocess
    import xml.etree.ElementTree as ET

    manifest = draft_thumbnails.preview_manifest(
        _job(tmp_path), DraftDetails(song_name="Una final"), output_format="9x16",
    )
    manifest['options']['A']['design']['subtitle'] = ''
    script = "const fs=require('fs'),vm=require('vm');const c={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c);const m=JSON.parse(fs.readFileSync(0,'utf8'));console.log(c.module.exports.renderSvg(m,'A',720,1280,{}));"
    result = subprocess.run(
        ['node', '-e', script, str(draft_thumbnails.RENDERER_PATH)],
        input=json.dumps(manifest), text=True, capture_output=True, check=True, timeout=10,
    )
    root = ET.fromstring(result.stdout)
    assert not any(node.attrib.get('data-role') == 'subtitle' for node in root.iter())


def test_refresh_preserves_custom_text_and_matches_captured_fingerprint(tmp_path: Path):
    async def scenario():
        draft = await _create_ready(tmp_path / 'draft')
        job = _job(tmp_path / 'draft')
        details = DraftDetails(song_name='Tema')
        raw = draft_thumbnails.preview_manifest(job, details)
        raw['selected'] = 'B'
        raw['options']['A']['text'] = 'Texto elegido por la persona'
        stored = draft_thumbnails.ThumbnailSet.model_validate(raw)
        current = draft.model_copy(update={'details': details, 'thumbnails': stored})
        return job, details, drafts.thumbnail_manifest(current, job, force_refresh=True)

    job, details, refreshed = asyncio.run(scenario())
    assert refreshed.selected == 'B'
    assert refreshed.options['A'].text == 'Texto elegido por la persona'
    rendered = draft_thumbnails.preview_manifest(job, details, refreshed.options, refreshed.format)
    assert refreshed.fingerprint == rendered['fingerprint']


def test_promo_generic_landscape_does_not_add_lyrics_label(tmp_path: Path):
    import subprocess
    import xml.etree.ElementTree as ET

    manifest = draft_thumbnails.preview_manifest(_job(tmp_path), DraftDetails(song_name='Promo'))
    manifest['options']['A']['design']['style'] = 'minimal'
    manifest['options']['A']['design']['subtitle'] = ''
    script = "const fs=require('fs'),vm=require('vm');const c={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c);const m=JSON.parse(fs.readFileSync(0,'utf8'));console.log(c.module.exports.renderSvg(m,'A',1280,720,{}));"
    result = subprocess.run(['node', '-e', script, str(draft_thumbnails.RENDERER_PATH)],
        input=json.dumps(manifest), text=True, capture_output=True, check=True, timeout=10)
    assert not any(node.attrib.get('data-role') == 'subtitle' for node in ET.fromstring(result.stdout).iter())
