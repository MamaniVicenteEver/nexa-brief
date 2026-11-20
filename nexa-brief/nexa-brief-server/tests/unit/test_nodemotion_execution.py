"""Data-only projects share resources without sharing editorial timelines."""
import json
from pathlib import Path

import pytest

from src.core.nodemotion.shared import execution as service
from src.core.nodemotion.shared import resources


@pytest.fixture
def environment(tmp_path, monkeypatch):
    audio = tmp_path / "music.mp3"
    audio.write_bytes(b"shared audio")
    runtime = tmp_path / "component.js"
    runtime.write_bytes(b"component")
    state = {"revision": "v1", "archives": set(), "lyrics": {"words": [{"text": "song"}]}}
    monkeypatch.setattr(service, "registered", lambda design: design in {"promo-test", "lyrics-test"})
    monkeypatch.setattr(service, "engine_revision", lambda design: state["revision"])
    monkeypatch.setattr(service, "available_revision",
                        lambda design, revision: revision == state["revision"] or revision in state["archives"])
    monkeypatch.setattr(service, "assemble", lambda design, revision=None: b"<html><head></head><body></body></html>")
    monkeypatch.setattr(service, "runtime_files", lambda design, revision=None: {"components/test.js": runtime})
    def freeze(design, revision=None):
        selected = revision or state["revision"]
        state["archives"].add(selected)
        return selected
    monkeypatch.setattr(service, "freeze_engine", freeze)
    monkeypatch.setattr(service, "design_manifest", lambda design, revision=None: {
        "runtime_assets": ["components"], "runtime_aliases": {"components/test.js": "test.js"}})
    monkeypatch.setattr(service, "resolve_runtime_asset",
                        lambda design, relative, revision=None: runtime if relative == "components/test.js" else None)
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio if (kind, asset_id) == ("music", "one") else (_ for _ in ()).throw(FileNotFoundError(asset_id)))
    monkeypatch.setattr(service.asset_library, "get_lyrics_cache", lambda asset_id: state["lyrics"] if asset_id == "one" else None)
    return audio, state


def project(root: Path, timeline=None, design="promo-test"):
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text('{"project":true}')
    return service.create_project(root, design, {"song.mp3": resources.asset_ref("music", "one")},
                                  timeline=timeline, lyrics_asset_id="one" if design == "lyrics-test" else None)


def test_shared_audio_and_isolated_timelines(environment, tmp_path):
    audio, _ = environment
    a, b = tmp_path / "a", tmp_path / "b"
    project(a, {"words": [{"text": "first campaign"}]})
    project(b, {"words": [{"text": "second campaign"}]})
    assert service.resolve_project(a, "assets/song.mp3") == audio
    assert service.resolve_project(b, "assets/song.mp3") == audio
    assert json.loads(service.resolve_project(a, "assets/lyrics.json").read_text()) != json.loads(
        service.resolve_project(b, "assets/lyrics.json").read_text())
    assert not (a / "assets/song.mp3").exists()
    assert not (b / "assets/lyrics.json").exists()
    assert not (a / "index.html").exists()


def test_preview_and_materialization_use_the_same_data(environment, tmp_path):
    root = tmp_path / "project"
    project(root, {"words": [{"text": "campaign"}]})
    html, audio, revision = service.materialize(root, tmp_path / "render")
    assert html.read_bytes() == service.resolve_project(root, "index.html", expected_revision=revision)
    assert audio.read_bytes() == service.resolve_project(root, "assets/song.mp3").read_bytes()
    assert (html.parent / "assets/lyrics.json").read_bytes() == service.resolve_project(root, "assets/lyrics.json").read_bytes()
    assert (html.parent / "assets/config.json").read_bytes() == service.resolve_project(root, "assets/config.json").read_bytes()
    assert (html.parent / "assets/components/test.js").read_bytes() == service.resolve_project(root, "assets/components/test.js").read_bytes()


def test_shared_transcription_snapshots_survive_retranscription(environment, tmp_path):
    _, state = environment
    a, b, c = tmp_path / "a", tmp_path / "b", tmp_path / "c"
    first = project(a, design="lyrics-test")
    second = project(b, design="lyrics-test")
    revision = first["transcription"]["sha256"]
    assert second["transcription"]["sha256"] == revision
    snapshot = resources._transcription_path(revision)
    assert snapshot.is_file() and len(list(snapshot.parent.glob("*.json"))) == 1
    previous = service.resolve_project(a, "assets/lyrics.json")
    state["lyrics"] = {"words": [{"text": "changed"}]}
    latest = project(c, design="lyrics-test")
    assert latest["transcription"]["sha256"] != revision
    assert service.resolve_project(a, "assets/lyrics.json") == previous
    assert service.resolve_project(b, "assets/lyrics.json") == previous
    assert json.loads(service.resolve_project(c, "assets/lyrics.json")) == state["lyrics"]
    assert len(list(snapshot.parent.glob("*.json"))) == 2


def test_containment_and_missing_resources(environment, tmp_path):
    audio, _ = environment
    root = tmp_path / "project"
    project(root, {"words": []})
    for name in ("../secret", "/etc/passwd", "assets/../../secret", r"assets\secret"):
        with pytest.raises(ValueError):
            service.resolve_project(root, name)
    assert service.resolve_project(root, "assets/unknown.mp3") is None
    audio.unlink()
    with pytest.raises(FileNotFoundError):
        service.resolve_project(root, "assets/song.mp3")


def test_stable_and_pinned_revisions(environment, tmp_path):
    _, state = environment
    stable, pinned = tmp_path / "stable", tmp_path / "pinned"
    project(stable, {"words": []})
    pinned.mkdir()
    service.create_project(pinned, "promo-test", {"song.mp3": resources.asset_ref("music", "one")},
                           policy="pinned", timeline={"words": []})
    state["revision"] = "v2"
    assert service.resolve_project(stable, "index.html")
    assert service.resolve_project(pinned, "index.html")
    assert service.resolve_project(stable, "index.html", expected_revision="v1")
    with pytest.raises(ValueError, match="changed during execution"):
        service.resolve_project(stable, "index.html", expected_revision="unavailable")


@pytest.mark.asyncio
@pytest.mark.parametrize("design", ["lyrics-caution", "promo-editorial"])
async def test_real_pipeline_persists_only_project_data(design, tmp_path, monkeypatch):
    from src.config.niche_config import find_niche_by_template_id
    from src.core.job import Job, JobInput
    from src.core.nodemotion.service import lyrics_for_job
    from src.modules import html_generator, lyrics_transcriber, resource_fetcher

    niche = find_niche_by_template_id(design)
    audio = tmp_path / "library.mp3"
    audio.write_bytes(b"audio")
    timeline = {"segments": [{"text": "campaign" if design.startswith("promo") else "song"}]}
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio)
    monkeypatch.setattr(resource_fetcher, "_outro_tail_seconds", lambda niche: 0)
    monkeypatch.setattr(lyrics_transcriber.asset_library, "resolve_music_path", lambda asset_id: audio)
    monkeypatch.setattr(service.asset_library, "get_lyrics_cache", lambda asset_id: timeline)
    async def transcribe(*args, **kwargs):
        if design.startswith("promo"):
            pytest.fail("Promo timeline must never use the transcription cache")
        return timeline, True
    async def register(*args, **kwargs):
        return None
    monkeypatch.setattr(lyrics_transcriber.transcription, "ensure_lyrics", transcribe)
    monkeypatch.setattr(html_generator.asset_library, "register_template_config", register)

    root = tmp_path / "project"
    assets = root / "assets"
    assets.mkdir(parents=True)
    job = Job(input=JobInput(category_name=niche.id,
                             promo_timeline=timeline if design.startswith("promo") else None))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": assets, "music_path": audio, "music_asset_id": "same",
        "log_dir": tmp_path / "logs",
    })})
    job = await lyrics_transcriber.run(job, niche)
    job = await html_generator.run(job, None, niche)
    assert job.artifacts.lyrics_json is None
    assert job.input.promo_timeline is None
    assert lyrics_for_job(job) == timeline
    assert not (root / "index.html").exists()
    assert not (assets / "song.mp3").exists()
    assert not (assets / "lyrics.json").exists()
    assert (assets / "config.json").is_file()
    assert (root / "project.json").is_file()
    assert (assets / "timeline.json").exists() == design.startswith("promo")
    assert service.resolve_project(root, "assets/song.mp3") == audio
    assert service.resolve_project(root, "index.html").startswith(b"<!DOCTYPE")


@pytest.mark.asyncio
async def test_preview_pins_relative_requests_to_selected_engine(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from starlette.requests import Request
    from src.core.job import Job, JobInput
    from src.presentation.api.routers import drafts as router
    from src.templates._tools.nodemotion.shared.assemble import engine_revision

    audio = tmp_path / "shared.mp3"
    audio.write_bytes(b"audio")
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio)
    root = tmp_path / "project"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text('{"project":true}')
    service.create_project(root, "lyrics-caution", {"song.mp3": resources.asset_ref("music", "one")},
                           timeline={"segments": [{"text": "local"}]})
    job = Job(input=JobInput(category_name="lyrics_video_caution"))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"output_dir": root})})
    draft = SimpleNamespace(template_id="lyrics-caution", original=False)
    async def get(_): return draft
    monkeypatch.setattr(router.drafts, "get", get)
    monkeypatch.setattr(router.drafts, "load_job", lambda _: job)
    request = Request({"type": "http", "method": "GET", "path": "/api/v1/drafts/d1/preview/index.html", "headers": [], "query_string": b""})
    html = await router.get_draft_preview_file("d1", "index.html", request)
    rev = engine_revision("lyrics-caution")
    assert f'<base href="/api/v1/drafts/d1/preview/revision/{rev}/assets/">' in html.body.decode()
    config = await router.get_draft_preview_file("d1", f"revision/{rev}/assets/config.json", request)
    assert json.loads(config.body)["project"] is True
    lyrics = await router.get_draft_preview_file("d1", f"revision/{rev}/assets/lyrics.json", request)
    assert json.loads(lyrics.body)["segments"][0]["text"] == "local"


def test_playwright_and_hyperframes_stage_same_project(environment, tmp_path):
    from urllib.request import urlopen
    from src.adapters.recorder.infrastructure.playwright_ffmpeg_adapter import _serve_directory
    from src.adapters.recorder.infrastructure.hyperframes_adapter import HyperframesAdapter, _RenderPass
    root = tmp_path / "project"
    project(root, {"words": [{"text": "same timeline"}]})
    html, audio, revision = service.materialize(root, tmp_path / "playwright-site")
    with _serve_directory(html.parent) as base:
        for name in ("assets/song.mp3", "assets/config.json", "assets/lyrics.json", "assets/components/test.js"):
            expected = service.resolve_project(root, name, expected_revision=revision)
            expected_bytes = expected if isinstance(expected, bytes) else expected.read_bytes()
            with urlopen(f"{base}/{name}") as response:
                assert response.read() == expected_bytes
    site = tmp_path / "hyperframes-site"
    HyperframesAdapter._stage_generic_site(site, html.parent, audio.parent, audio,
                                           audio.parent / "missing.jpg",
                                           _RenderPass(1920, 1080, 1, ("out.mp4",)), 10)
    assert (site / "assets/song.mp3").read_bytes() == audio.read_bytes()
    assert (site / "assets/lyrics.json").read_bytes() == (html.parent / "assets/lyrics.json").read_bytes()
    assert (site / "assets/config.json").read_bytes() == (html.parent / "assets/config.json").read_bytes()
    assert (site / "assets/components/test.js").read_bytes() == (html.parent / "assets/components/test.js").read_bytes()
    assert '<base href="assets/">' in (site / "index.html").read_text()


@pytest.mark.asyncio
async def test_packager_accepts_virtual_required_assets(environment, tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput, AnalyzedInput, VideoSummary
    from src.modules import packager, thumbnail_maker, video_compressor

    root = tmp_path / "project"
    project(root, {"segments": []})
    niche = get_niche_config("lyrics_video_caution")
    for fmt in niche.video.formats:
        (root / fmt.output_filename).write_bytes(b"video")
    job = Job(input=JobInput(category_name=niche.id))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": root / "assets", "config_json_path": root / "assets/config.json",
        "analyzed_input": AnalyzedInput(genre="test", mood_tags=[], image_query="", description="",
                                         duration_seconds=10, category_name=niche.id),
        "summary": VideoSummary(youtube_title="test", youtube_description="", youtube_tags=[],
                                tiktok_caption="", tiktok_hashtags=[]),
        "recording_stats": {"nodemotion_engine_revision": "v1"},
    })})
    monkeypatch.setattr(packager, "layout_for_settings", lambda _: SimpleNamespace(schema_version=1))
    async def no_op(*args, **kwargs): return None
    monkeypatch.setattr(video_compressor, "compress_for_publishing", no_op)
    monkeypatch.setattr(thumbnail_maker, "make_thumbnail", no_op)
    result = await packager.run(job, niche)
    manifest = json.loads((root / "manifest.json").read_text())
    assert result.stage.value == "packaged"
    assert manifest["files"]["song.mp3"] == str(len(b"shared audio"))
    assert manifest["files"]["lyrics.json"] == str(len((root / "assets/timeline.json").read_bytes()))
    assert manifest["composition"]["engine_revision"] == "v1"
    assert not (root / "index.html").exists()


@pytest.mark.asyncio
async def test_acquisition_discards_job_copy_and_keeps_original(tmp_path, monkeypatch):
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput
    from src.modules import resource_fetcher

    source = tmp_path / "library.mp3"
    source.write_bytes(b"original immutable audio")
    observed = []
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: source)
    monkeypatch.setattr(resource_fetcher, "_outro_tail_seconds", lambda niche: 0)
    async def acquire(job, niche, ai):
        temporary = job.artifacts.content_dir
        observed.append(temporary)
        (temporary / "song.mp3").write_bytes(source.read_bytes())
        return job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
            "music_path": temporary / "song.mp3", "music_asset_id": "same",
        })})
    monkeypatch.setattr(resource_fetcher, "_run_legacy", acquire)
    niche = get_niche_config("lyrics_video_caution")
    for ident in ("first", "second"):
        root = tmp_path / ident
        root.mkdir()
        job = Job(input=JobInput(category_name=niche.id))
        job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"output_dir": root})})
        result = await resource_fetcher.run(job, niche, None)
        assert result.artifacts.music_path == source
        assert not (root / "song.mp3").exists()
    assert len(set(observed)) == 2 and all(not path.exists() for path in observed)
    assert source.read_bytes() == b"original immutable audio"


def test_outro_tail_is_shared_derived_audio_without_mutating_original(tmp_path, monkeypatch):
    import shutil
    import subprocess
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        pytest.skip("ffmpeg and ffprobe are required")
    from src.config.settings import settings

    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    source = tmp_path / "original.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.3",
                    "-q:a", "2", str(source)], check=True)
    original = source.read_bytes()
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: source)
    ref = resources.asset_ref("music", "same", tail_seconds=0.5)
    first = resources._resolve_ref(ref)
    second = resources._resolve_ref(ref)
    assert first == second and first != source and first.is_file()
    assert source.read_bytes() == original
    def duration(path):
        return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                              "-of", "default=noprint_wrappers=1:nokey=1", str(path)]))
    assert duration(first) > duration(source) + 0.35


@pytest.mark.asyncio
@pytest.mark.parametrize("niche_id,design", [("lyrics_video_caution", "lyrics-caution"),
                                              ("promo_video_editorial", "promo-editorial")])
async def test_original_demo_uses_its_own_timing_without_overwriting_song_cache(tmp_path, monkeypatch, niche_id, design):
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput
    from src.core.nodemotion.service import lyrics_for_job
    from src.modules import html_generator, lyrics_transcriber, resource_fetcher
    from src.presentation.api.routers import drafts as router

    niche = get_niche_config(niche_id)
    demo = tmp_path / "demo" / "assets"
    demo.mkdir(parents=True)
    (demo / "config.json").write_text("{}")
    original = {"segments": [{"text": "original demo timing", "start": 2}]}
    (demo / "lyrics.json").write_text(json.dumps(original))
    monkeypatch.setattr(router.template_original, "get_template_asset_dir", lambda _: demo)
    timed_content = router._original_timed_content(design, niche)
    assert timed_content == original

    audio = tmp_path / "song.mp3"
    audio.write_bytes(b"shared source")
    cached = {"segments": [{"text": "different cached timing", "start": 5}]}
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio)
    monkeypatch.setattr(service.asset_library, "get_lyrics_cache", lambda asset_id: cached)
    monkeypatch.setattr(resource_fetcher, "_outro_tail_seconds", lambda niche: 0)
    async def unexpected(*args, **kwargs):
        pytest.fail("Explicit original timing must never transcribe or replace the cache")
    async def register(*args, **kwargs): return None
    monkeypatch.setattr(lyrics_transcriber.transcription, "ensure_lyrics", unexpected)
    monkeypatch.setattr(html_generator.asset_library, "register_template_config", register)

    root = tmp_path / "project"
    (root / "assets").mkdir(parents=True)
    job = Job(input=JobInput(category_name=niche.id, timed_content=timed_content))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": root / "assets", "music_path": audio,
        "music_asset_id": "same", "log_dir": tmp_path / "logs",
    })})
    job = await lyrics_transcriber.run(job, niche)
    job = await html_generator.run(job, None, niche)
    assert lyrics_for_job(job) == original
    assert service.asset_library.get_lyrics_cache("same") == cached
    assert job.input.timed_content is None and job.artifacts.lyrics_json is None
    manifest = json.loads((root / "project.json").read_text())
    if design.startswith("promo-"):
        assert json.loads((root / "assets/timeline.json").read_text()) == original
        assert "transcription" not in manifest
    else:
        assert not (root / "assets/timeline.json").exists()
        reference = manifest["transcription"]
        assert reference["storage"] == "shared"
        assert json.loads(resources.resolve_transcription(reference["sha256"])) == original


def test_alternate_transcription_shared_across_jobs_and_checked(environment, tmp_path, monkeypatch):
    _, state = environment
    alternate = {"words": [{"text": "same alternate timing", "start": 1.25}]}
    roots = [tmp_path / "first-alternate", tmp_path / "second-alternate"]
    manifests = []
    for root in roots:
        root.mkdir()
        manifests.append(service.create_project(
            root, "lyrics-test", {"song.mp3": resources.asset_ref("music", "one")},
            lyrics_asset_id="one", transcription_data=alternate,
        ))
    revision = manifests[0]["transcription"]["sha256"]
    assert manifests[1]["transcription"]["sha256"] == revision
    path = resources._transcription_path(revision)
    assert len(list(path.parent.glob("*.json"))) == 1
    assert json.loads(service.resolve_project(roots[0], "assets/lyrics.json")) == alternate
    assert state["lyrics"] != alternate
    actual_read = Path.read_bytes
    monkeypatch.setattr(Path, "read_bytes", lambda p: b"corrupt" if p == path else actual_read(p))
    with pytest.raises(ValueError, match="Corrupt transcription revision"):
        service.resolve_project(roots[1], "assets/lyrics.json")


def test_transcription_revision_rejects_unsafe_or_missing_ids(tmp_path):
    for revision in ("../outside", "0" * 63, "g" * 64):
        with pytest.raises(ValueError, match="Invalid transcription revision"):
            resources.resolve_transcription(revision)
    with pytest.raises(FileNotFoundError):
        resources.resolve_transcription("0" * 64)


def test_earlier_transcription_reference_can_use_matching_shared_snapshot(environment, tmp_path):
    _, state = environment
    root = tmp_path / "older-project"
    manifest = project(root, design="lyrics-test")
    expected = service.resolve_project(root, "assets/lyrics.json")
    manifest["transcription"].pop("storage")
    (root / "project.json").write_text(json.dumps(manifest))
    state["lyrics"] = {"words": [{"text": "new transcription"}]}
    assert service.resolve_project(root, "assets/lyrics.json") == expected


def test_snapshot_preserves_exact_historical_json_bytes(environment, tmp_path):
    historical = b'{\n  "segments": [ {"text": "uno"} ]\n}\n'
    first = resources.snapshot_transcription(historical)
    assert resources.snapshot_transcription(historical) == first
    assert resources.resolve_transcription(first) == historical
    canonical = resources.snapshot_transcription(json.loads(historical))
    assert canonical != first
    root = tmp_path / "migrated"
    root.mkdir()
    manifest = service.create_project(root, "lyrics-test", {"song.mp3": resources.asset_ref("music", "one")},
                                      lyrics_asset_id="one", transcription_data=historical)
    assert manifest["transcription"]["sha256"] == first
    assert service.resolve_project(root, "assets/lyrics.json") == historical
    for bad in (b"[1,2]", b"{bad}", b"\\xff"):
        with pytest.raises(ValueError):
            resources.snapshot_transcription(bad)


@pytest.mark.parametrize("family", ["promo-test", "lyrics-test"])
def test_native_demo_urls_preserve_html_and_materialized_bytes(environment, tmp_path, family):
    from src.core.job import Job, JobInput
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    config = b'{\n "audio": {"src": "assets/Original Mix.mp3"}\n}\n'
    (root / "assets/config.json").write_bytes(config)
    timing = {"segments": [{"start": 1.25, "text": "original"}]}
    raw_timing = b'{ "segments": [ {"start": 1.25, "text": "original"} ] }\n'
    urls = {"config": "assets/config.json", "timing": "assets/exact-timing.json",
            "audio": "assets/Original Mix.mp3"}
    kwargs = ({"timeline": timing} if family == "promo-test"
              else {"lyrics_asset_id": "one", "transcription_data": raw_timing})
    manifest = service.create_project(root, family, {urls["audio"]: resources.asset_ref("music", "one")},
                                      data_urls=urls, inject_base=False, **kwargs)
    if family == "promo-test":
        # Migration preserves historical formatting in the owned timeline file.
        (root / "assets/timeline.json").write_bytes(raw_timing)
    assert manifest["data_urls"] == urls and manifest["inject_base"] is False
    original_html = b"<html><head></head><body></body></html>"
    assert service.resolve_project(root, "index.html") == original_html
    assert service.resolve_project(root, urls["config"]).read_bytes() == config
    timing_value = service.resolve_project(root, urls["timing"])
    assert (timing_value if isinstance(timing_value, bytes) else timing_value.read_bytes()) == raw_timing
    out = tmp_path / "record"
    html, audio, revision = service.materialize(root, out)
    assert html.read_bytes() == original_html
    assert audio == out / urls["audio"] and audio.read_bytes() == b"shared audio"
    assert (out / urls["config"]).read_bytes() == config
    assert (out / urls["timing"]).read_bytes() == raw_timing
    assert (out / "components/test.js").read_bytes() == b"component"
    assert service.resolve_project(root, "index.html", expected_revision=revision) == html.read_bytes()
    job = Job(input=JobInput(category_name="test"))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"output_dir": root})})
    assert service.lyrics_for_job(job) == timing


@pytest.mark.parametrize("change", [
    {"config": "../config.json"}, {"timing": "logs/private.json"},
    {"audio": "../song.mp3"}, {"audio": "assets/missing.mp3"},
    {"config": "assets/index.html"}, {"timing": ".system/secret.json"},
    {"timing": "assets/config.json"}, {"timing": "assets/project.json"},
])
def test_native_demo_data_urls_reject_unsafe_or_conflicting_paths(environment, tmp_path, change):
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text("{}")
    urls = {"config": "assets/config.json", "timing": "assets/lyrics.json", "audio": "assets/song.mp3"}
    urls.update(change)
    with pytest.raises(ValueError):
        service.create_project(root, "promo-test", {"assets/song.mp3": resources.asset_ref("music", "one")},
                               data_urls=urls, inject_base=False, timeline={"segments": []})


@pytest.mark.asyncio
async def test_native_demo_packager_uses_actual_data_urls(environment, tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput, AnalyzedInput, VideoSummary
    from src.modules import packager, thumbnail_maker, video_compressor

    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text('{"native":true}')
    urls = {"config": "assets/config.json", "timing": "assets/custom-lyrics.json",
            "audio": "assets/custom-song.mp3"}
    service.create_project(root, "lyrics-test", {urls["audio"]: resources.asset_ref("music", "one")},
                           data_urls=urls, inject_base=False,
                           lyrics_asset_id="one", transcription_data={"words": []})
    niche = get_niche_config("lyrics_video_caution")
    for fmt in niche.video.formats:
        (root / fmt.output_filename).write_bytes(b"video")
    job = Job(input=JobInput(category_name=niche.id))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": root / "assets", "config_json_path": root / urls["config"],
        "analyzed_input": AnalyzedInput(genre="test", mood_tags=[], image_query="", description="",
                                        duration_seconds=10, category_name=niche.id),
        "summary": VideoSummary(youtube_title="test", youtube_description="", youtube_tags=[],
                                tiktok_caption="", tiktok_hashtags=[]),
        "recording_stats": {"nodemotion_engine_revision": "v1"},
    })})
    monkeypatch.setattr(packager, "layout_for_settings", lambda _: SimpleNamespace(schema_version=1))
    async def no_op(*args, **kwargs): return None
    monkeypatch.setattr(video_compressor, "compress_for_publishing", no_op)
    monkeypatch.setattr(thumbnail_maker, "make_thumbnail", no_op)
    result = await packager.run(job, niche)
    manifest = json.loads((root / "manifest.json").read_text())
    assert result.stage.value == "packaged"
    assert manifest["files"]["song.mp3"] == str(len(b"shared audio"))
    assert manifest["files"]["lyrics.json"] == str(len(service.resolve_project(root, urls["timing"])))


def test_native_extra_json_is_explicit_and_byte_preserved(environment, tmp_path):
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text("{}")
    original = b'{\n "variant": 1,\n "title": "Exact"\n}\n'
    (root / "assets/config1.json").write_bytes(original)
    (root / "assets/unlisted.json").write_text('{"private":true}')
    urls = {"config": "assets/config.json", "timing": "assets/lyrics.json", "audio": "assets/song.mp3"}
    service.create_project(root, "lyrics-test", {urls["audio"]: resources.asset_ref("music", "one")},
                           data_urls=urls, inject_base=False, extra_data_urls=["assets/config1.json"],
                           transcription_data={"segments": []}, lyrics_asset_id="one")
    assert service.resolve_project(root, "assets/config1.json").read_bytes() == original
    assert service.resolve_project(root, "assets/unlisted.json") is None
    out = tmp_path / "render"
    service.materialize(root, out)
    assert (out / "assets/config1.json").read_bytes() == original
    assert not (out / "assets/unlisted.json").exists()


@pytest.mark.parametrize("name", [
    "../private.json", "work/draft.json", "private/draft.json", ".system/draft.json",
    "assets/project.json", "assets/appearance.json", "assets/manifest.json", "assets/config.js",
    "assets/config.json", "assets/lyrics.json",
])
def test_native_extra_json_rejects_private_or_conflicting_urls(environment, tmp_path, name):
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text("{}")
    urls = {"config": "assets/config.json", "timing": "assets/lyrics.json", "audio": "assets/song.mp3"}
    with pytest.raises(ValueError):
        service.create_project(root, "lyrics-test", {urls["audio"]: resources.asset_ref("music", "one")},
                               data_urls=urls, extra_data_urls=[name], transcription_data={"segments": []})


def test_native_background_keeps_original_resource_url(environment, tmp_path, monkeypatch):
    audio, _ = environment
    background = tmp_path / "bruses.jpg"
    background.write_bytes(b"background")
    monkeypatch.setattr(resources, "_asset", lambda kind, ident: background if kind == "image" else audio)
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text("{}")
    urls = {"config": "assets/config.json", "timing": "assets/lyrics.json",
            "audio": "assets/original.mp3", "background": "assets/bruses_desktop.jpg"}
    refs = {urls["audio"]: resources.asset_ref("music", "one"),
            urls["background"]: resources.asset_ref("image", "background")}
    service.create_project(root, "lyrics-test", refs, data_urls=urls, inject_base=False,
                           transcription_data={"segments": []})
    assert service.resolve_project(root, urls["background"]) == background
    out = tmp_path / "render"
    service.materialize(root, out)
    assert (out / urls["background"]).read_bytes() == b"background"
    assert not (out / "assets/bg.jpg").exists()


@pytest.mark.asyncio
async def test_native_packager_uses_explicit_background_url(environment, tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput, AnalyzedInput, VideoSummary
    from src.modules import packager, thumbnail_maker, video_compressor

    audio, _ = environment
    image = tmp_path / "source.jpg"
    image.write_bytes(b"original image")
    monkeypatch.setattr(resources, "_asset", lambda kind, ident: image if kind == "image" else audio)
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text("{}")
    urls = {"config": "assets/config.json", "timing": "assets/lyrics.json",
            "audio": "assets/song-name.mp3", "background": "assets/bruses_desktop.jpg"}
    refs = {urls["audio"]: resources.asset_ref("music", "one"),
            urls["background"]: resources.asset_ref("image", "background")}
    service.create_project(root, "lyrics-test", refs, data_urls=urls, inject_base=False,
                           transcription_data={"segments": []})
    niche = get_niche_config("lyrics_video_suave")
    for fmt in niche.video.formats:
        (root / fmt.output_filename).write_bytes(b"video")
    job = Job(input=JobInput(category_name=niche.id))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": root / "assets", "config_json_path": root / urls["config"],
        "analyzed_input": AnalyzedInput(genre="test", mood_tags=[], image_query="", description="",
                                        duration_seconds=10, category_name=niche.id),
        "summary": VideoSummary(youtube_title="test", youtube_description="", youtube_tags=[],
                                tiktok_caption="", tiktok_hashtags=[]),
        "recording_stats": {"nodemotion_engine_revision": "v1"},
    })})
    monkeypatch.setattr(packager, "layout_for_settings", lambda _: SimpleNamespace(schema_version=1))
    async def no_op(*args, **kwargs): return None
    monkeypatch.setattr(video_compressor, "compress_for_publishing", no_op)
    monkeypatch.setattr(thumbnail_maker, "make_thumbnail", no_op)
    await packager.run(job, niche)
    manifest = json.loads((root / "manifest.json").read_text())
    assert manifest["files"][niche.template.media_src_filename] == str(len(b"original image"))
    assert not (root / "assets/bg.jpg").exists()


def test_native_json_rejects_symlink_escape(environment, tmp_path):
    root = tmp_path / "native"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text("{}")
    outside = tmp_path / "outside.json"
    outside.write_text('{"secret":true}')
    (root / "assets/config1.json").symlink_to(outside)
    urls = {"config": "assets/config.json", "timing": "assets/lyrics.json", "audio": "assets/song.mp3"}
    with pytest.raises(ValueError, match="Symlink"):
        service.create_project(root, "lyrics-test", {urls["audio"]: resources.asset_ref("music", "one")},
                               data_urls=urls, extra_data_urls=["assets/config1.json"],
                               transcription_data={"segments": []})
