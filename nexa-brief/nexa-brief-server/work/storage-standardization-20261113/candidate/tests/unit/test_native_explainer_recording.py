"""Native recording contracts with encoder/publisher doubles; no video or upload."""
from __future__ import annotations

import importlib.util
import json
import sys
import threading
from pathlib import Path
from types import SimpleNamespace
from urllib.request import urlopen

import pytest

from src.config.settings import settings
from src.core.content_registry import get_video
from src.core.data import collection
from src.core.explainer.catalog import ExplainerVideo
from src.core.explainer import recorder as recorder_mod
from src.core.explainer.recorder import ExplainerRecorder, RecordState, render_filename
from src.core.explainer.render_cache import render_signature


@pytest.fixture
def renderer():
    script = Path(__file__).parents[2] / "src/templates/_tools/commercial/render_promo.py"
    spec = importlib.util.spec_from_file_location("native_render_promo_test", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def profile(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    # The API's edition resolver owns editorial approval/package validation.
    monkeypatch.setattr(ExplainerVideo, "publish_ready", property(lambda video: bool(video.youtube_title)))
    monkeypatch.setitem(sys.modules, "src.core.explainer.editions.packaging", SimpleNamespace(
        resolve_video=lambda video, *args: video, load_native=lambda _: object(),
    ))
    return tmp_path


def native_video(profile, locale="en-US", video_id="episode-one"):
    folder = profile / "productions/nodetech" / video_id
    assets = folder / "assets"
    assets.mkdir(parents=True)
    (folder / "index.html").write_text("<html>shared engine</html>")
    (folder / "manifest.json").write_text(json.dumps({"status": "listo", "video_formats": []}))
    (folder / "publish.json").write_text(json.dumps({"youtube_title": "ES SOURCE", "pinned_comment": "ES COMMENT"}))
    (assets / "config.json").write_text(json.dumps({"configs": [{"audio": {"src": "assets/song.mp3"}}]}))
    (assets / "song.mp3").write_bytes(b"ES AUDIO")
    revision = folder / f"languages/{locale}/revisions/rev-001"
    revision.mkdir(parents=True)
    prefix = f"languages/{locale}/revisions/rev-001"
    (revision / "edition.json").write_text(json.dumps({
        "schema": "nexa.edition/1", "locale": locale, "revision": "rev-001",
        "paths": {"config": f"{prefix}/config.json", "audio_with_outro": f"{prefix}/song-with-outro.mp3"},
    }))
    config = {"locale": locale, "title": f"{locale} TITLE", "audio": {"src": f"{prefix}/song-with-outro.mp3"}}
    (revision / "config.json").write_text(json.dumps(config))
    (revision / "config.publication.json").write_text(json.dumps({**config, "title": f"{locale} SELECTED OPENING"}))
    (revision / "song-with-outro.mp3").write_bytes(f"{locale} AUDIO".encode())
    (revision / "publish.json").write_text(json.dumps({"youtube": {"title": f"{locale} TITLE"}}))
    return ExplainerVideo(video_id, folder, "rough", "node_tech", f"{locale} TITLE", "listo", 80,
                          youtube_title=f"{locale} TITLE", youtube_description=f"{locale} DESCRIPTION",
                          youtube_tags=["technology"], instagram_title=f"{locale} INSTAGRAM",
                          instagram_description=f"{locale} INSTAGRAM DESCRIPTION",
                          facebook_title=f"{locale} FACEBOOK", facebook_description=f"{locale} FACEBOOK DESCRIPTION",
                          locale=locale, revision="rev-001", edition_path=revision,
                          pinned_comment=f"{locale} COMMENT")


@pytest.mark.parametrize("locale,video_id", [("en-US", "episode-one"), ("pt-BR", "episode-two")])
async def test_native_recording_routes_copy_audio_thumbnail_and_provenance(profile, monkeypatch, renderer, locale, video_id):
    video = native_video(profile, locale, video_id)
    original = {path: path.read_bytes() for path in (video.path / "assets").iterdir()}
    original.update({video.path / name: (video.path / name).read_bytes() for name in ("manifest.json", "publish.json")})
    encoded, published = [], []

    async def encode(identifier, seconds, formats, *, output_dir, edition_path, on_output):
        folder, config, audio, native = renderer.render_inputs(
            f"productions/nodetech/{identifier}/index.html", str(edition_path / "edition.json"))
        assert folder == video.path and native["locale"] == locale
        assert audio.read_bytes() == f"{locale} AUDIO".encode()
        assert config["title"] == f"{locale} SELECTED OPENING"
        encoded.append(edition_path)
        for fmt in formats:
            (output_dir / render_filename(identifier, fmt, seconds)).write_bytes(b"FAKE ENCODER")

    async def publish(**kwargs):
        published.append(kwargs)
        platform, alias = kwargs["account_selector"].split(":")
        return SimpleNamespace(post_id="fake-id", url="https://example.invalid/fake", platform=platform,
                               account_alias=alias, raw_response={"comment_posted": True})

    async def thumbnail(episode, options):
        assert episode.edition_path == video.edition_path
        for option in options:
            (episode.edition_path / f"thumbnail-{option}.jpg").write_bytes(f"{locale} THUMBNAIL".encode())

    monkeypatch.setattr(recorder_mod.thumbnails, "chosen_option", lambda _: "C")
    monkeypatch.setattr(recorder_mod.thumbnails, "intro_specs", lambda _: {"C": object()})
    monkeypatch.setattr(recorder_mod.thumbnails, "thumbnail_file", lambda episode, option: episode.edition_path / f"thumbnail-{option}.jpg")
    recorder = ExplainerRecorder(render_runner=encode, publisher_getter=lambda: SimpleNamespace(publish_video=publish),
                                 thumbnail_renderer=thumbnail)
    job = recorder.submit(video, duration="full", publish=True,
                          account_selectors=["youtube:fake", "instagram:fake"],
                          account_formats={"youtube:fake": ["16x9"], "instagram:fake": ["16x9"]})
    await recorder.wait(job.job_id)
    assert job.state == RecordState.done, job.error
    assert encoded == [video.edition_path]
    assert job.locale == locale and job.revision == "rev-001" and job.title == f"{locale} TITLE"
    assert recorder.latest_for_video(video_id) is None
    assert recorder.latest_for_video(video_id, locale, "rev-001") is job
    assert recorder.latest_for_video(video_id, locale, "rev-002") is None
    calls = {call["account_selector"]: call for call in published}
    assert calls["youtube:fake"]["title"] == f"{locale} TITLE"
    assert calls["youtube:fake"]["comment_text"] == f"{locale} COMMENT"
    assert calls["youtube:fake"]["language"] == locale
    assert calls["youtube:fake"]["thumbnail_path"].read_bytes() == f"{locale} THUMBNAIL".encode()
    assert calls["youtube:fake"]["thumbnail_path"].is_relative_to(profile / "renders")
    assert calls["instagram:fake"]["title"] == f"{locale} INSTAGRAM"
    packaged = collection("jobs").get(job.scheduled_job_id)
    assert packaged["locale"] == locale and packaged["revision"] == "rev-001"
    assert packaged["publication_hold"] is True
    from src.core.schedule.engine import _pick_oldest_ready_job
    assert _pick_oldest_ready_job(SimpleNamespace(niche_filter="node_tech", platform="youtube", account_alias="other-es-channel")) is None
    summary = json.loads((profile / f"logs/videos/{video_id}/recordings/{job.recording_id}/08_resumen_final.json").read_text())
    assert summary["pinned_comment"] == f"{locale} COMMENT"
    assert summary["locale"] == locale and summary["revision"] == "rev-001"
    from src.core import job_tracker
    from src.core.metadata import copy_for_platform
    assert job_tracker.get_summary(job.scheduled_job_id) == summary
    assert copy_for_platform(job_tracker.get_summary(job.scheduled_job_id), "instagram").title == f"{locale} INSTAGRAM"
    assert copy_for_platform(job_tracker.get_summary(job.scheduled_job_id), "youtube").language == locale
    # Exercise the actual Library/scheduler reader with a manually selected
    # native account, rather than merely checking the summary writer.
    from src.core.schedule import engine, queue_repository
    from src.core.schedule.models import QueueSource, QueueStatus
    async def existing_thumbnail(paths):
        return Path(paths["thumbnail"])
    monkeypatch.setattr("src.modules.thumbnail_maker.ensure_for_job", existing_thumbnail)
    queued = await queue_repository.create(job_id=job.scheduled_job_id, platform="youtube",
                                           account_alias="native-library", source=QueueSource.IMMEDIATE)
    result = await engine.publish_entry(SimpleNamespace(publish_video=publish), queued)
    assert result.status == QueueStatus.PUBLISHED
    library_call = published[-1]
    assert library_call["account_selector"] == "youtube:native-library"
    assert library_call["title"] == f"{locale} TITLE" and library_call["language"] == locale
    assert library_call["comment_text"] == f"{locale} COMMENT"
    assert library_call["thumbnail_path"].read_bytes() == f"{locale} THUMBNAIL".encode()
    recording = get_video(video_id)["details"]["recordings"][job.recording_id]
    assert recording["locale"] == locale and recording["revision"] == "rev-001"
    assert all(path.read_bytes() == content for path, content in original.items())


def test_native_inputs_reject_cross_production_revision_mismatch_and_symlink(profile, renderer):
    video = native_video(profile)
    page = f"productions/nodetech/{video.video_id}/index.html"
    with pytest.raises(ValueError, match="otra producción"):
        renderer.render_inputs(page, str(profile / "other/edition.json"))
    edition_file = video.edition_path / "edition.json"
    data = json.loads(edition_file.read_text())
    edition_file.write_text(json.dumps({**data, "locale": "pt-BR"}))
    with pytest.raises(ValueError, match="no coincide"):
        renderer.render_inputs(page, str(edition_file))
    edition_file.write_text(json.dumps(data))
    config = video.edition_path / "config.publication.json"
    approved = json.loads(config.read_text())
    config.write_text(json.dumps({**approved, "audio": {"src": "assets/song.mp3"}}))
    with pytest.raises(ValueError, match="audio no corresponde"):
        renderer.render_inputs(page, str(edition_file))
    config.write_text(json.dumps(approved))
    config.unlink()
    config.symlink_to(video.path / "assets/config.json")
    with pytest.raises(ValueError, match="archivos locales"):
        renderer.render_inputs(page, str(edition_file))


def test_native_server_maps_only_selected_config_and_closes_thread(profile, renderer):
    video = native_video(profile)
    page = f"productions/nodetech/{video.video_id}/index.html"
    _, _, _, native = renderer.render_inputs(page, str(video.edition_path / "edition.json"))
    httpd = renderer.serve(renderer.HERE, config_override=native["config_override"])
    thread = httpd.worker_thread
    try:
        base = f"http://127.0.0.1:{httpd.server_address[1]}/productions/nodetech/{video.video_id}"
        with urlopen(base + "/assets/config.json?edition=en-US") as response:
            assert json.load(response)["title"] == "en-US SELECTED OPENING"
        with urlopen(base + "/assets/song.mp3") as response:
            assert response.read() == b"ES AUDIO"
        with urlopen(base + "/languages/en-US/revisions/rev-001/song-with-outro.mp3") as response:
            assert response.read() == b"en-US AUDIO"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)
    assert not thread.is_alive()
    assert thread not in threading.enumerate()


def test_render_signature_tracks_native_artifacts_separately(profile):
    from dataclasses import replace
    native = native_video(profile)
    source = replace(native, locale="es-419", revision=None, edition_path=None)
    before, original = render_signature(native), render_signature(source)
    assert before != original
    (native.edition_path / "config.publication.json").write_text('{"updated":true}')
    assert render_signature(native) != before
    assert render_signature(source) == original


async def test_native_runner_builds_shared_encoder_commands_without_original_kit(profile, monkeypatch):
    from src.adapters.recorder.infrastructure import subprocess_progress
    video = native_video(profile)
    commands, progress = [], []
    async def fake_run(command, **kwargs):
        commands.append(command)
        assert kwargs["env"]["NEXA_RENDER_MANAGED"] == "1"
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(subprocess_progress, "run_with_progress", fake_run)
    await recorder_mod.run_kit_render(video.video_id, 10, ("9x16", "16x9"),
                                     on_output=progress.append, output_dir=profile / ".system/runtime/recordings/test",
                                     edition_path=video.edition_path)
    assert len(commands) == 2 and len(progress) == 2
    for command in commands:
        assert command[1].endswith("commercial/render_promo.py")
        assert command[command.index("--edition") + 1] == str(video.edition_path / "edition.json")
        assert command[command.index("--to") + 1] == "10"
        assert "kit.py" not in command


async def test_second_native_submission_cannot_change_opening_during_recording(profile, monkeypatch):
    video = native_video(profile)
    choices = []
    monkeypatch.setattr(recorder_mod.thumbnails, "choose", lambda *args: choices.append(args))
    async def encode(identifier, seconds, formats, *, output_dir, edition_path, **kwargs):
        for fmt in formats:
            (output_dir / render_filename(identifier, fmt, seconds)).write_bytes(b"FAKE")
    recorder = ExplainerRecorder(render_runner=encode)
    job = recorder.submit(video)
    with pytest.raises(ValueError, match="termine la grabación"):
        recorder.submit(video, thumbnail="B")
    assert not choices
    await recorder.wait(job.job_id)
    assert job.state == RecordState.done, job.error


async def test_native_revision_is_revalidated_after_waiting_for_render_slot(profile, monkeypatch):
    video = native_video(profile)
    encoded = []
    async def encode(*args, **kwargs):
        encoded.append(True)
    recorder = ExplainerRecorder(render_runner=encode)
    await recorder._slots.acquire()
    try:
        job = recorder.submit(video)
        def changed(*args):
            raise ValueError("El original cambió mientras esperaba")
        monkeypatch.setitem(sys.modules, "src.core.explainer.editions.packaging", SimpleNamespace(
            resolve_video=changed, load_native=lambda _: object(),
        ))
    finally:
        recorder._slots.release()
    await recorder.wait(job.job_id)
    assert job.state == RecordState.failed and "original cambió" in job.error
    assert not encoded and not job.outputs
