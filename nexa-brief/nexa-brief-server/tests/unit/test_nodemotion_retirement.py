"""Retirement changes operational references before removing exact duplicates."""
from __future__ import annotations

import hashlib
import json

import pytest

from src.adapters.data.section_store import Section
from src.config.settings import settings
from src.core.nodemotion.shared import resources, retirement
from src.templates._tools.nodemotion.shared import assemble as engines

_REAL_ASSET = resources._asset


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))


@pytest.fixture
def legacy(tmp_path, monkeypatch):
    profile = tmp_path / "profile"
    profile.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", profile)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", profile / "data")
    engine_root = tmp_path / "templates/_tools/nodemotion"
    design = engine_root / "promo/designs/promo-retirement"
    design.mkdir(parents=True)
    html = b'<!doctype html><html><head></head><body><script src="components/scenes.js"></script><script>start();</script></body></html>'
    document, fragments, bodies = engines.split_document(html)
    for relative, data in bodies.items():
        path = design / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    (design / "document.html").write_bytes(document)
    write_json(design / "manifest.json", {"schema_version": 1, "design_id": "promo-retirement", "family": "promo",
               "document": "document.html", "demo_folder": "nodemotion/commercial/promo-retirement", "fragments": fragments,
               "runtime_aliases": {}, "runtime_assets": []})
    monkeypatch.setattr(engines, "ROOT", engine_root)
    monkeypatch.setattr(engines, "TEMPLATES", tmp_path / "templates")
    root = profile / "productions/nodemotion/old"
    content = root / "assets"
    (content / "components").mkdir(parents=True)
    (content / "fonts").mkdir()
    (content / "media").mkdir()
    (root / "index.html").write_bytes(html.replace(b"<head>", b'<head><base href="assets/">'))
    (content / "components/scenes.js").write_bytes(b"old-runtime\x00\r\n")
    (content / "fonts/runtime.woff2").write_bytes(b"exact-font\x00\xff")
    (content / "song.mp3").write_bytes(b"exact-padded-audio")
    (content / "media/cover.jpg").write_bytes(b"image")
    (content / "config.json").write_bytes(b'{"keep":"project-data"}')
    lyrics = {"segments": [{"text": "authored campaign", "start": 0, "end": 1}]}
    write_json(content / "lyrics.json", lyrics)
    write_json(content / "timeline.json", lyrics)
    canonical = {"audio": profile / "resources/music/shared/file.mp3", "image": profile / "resources/images/shared/file.jpg"}
    for key, path in canonical.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((content / ("song.mp3" if key == "audio" else "media/cover.jpg")).read_bytes())
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: canonical[asset_id])
    code = {"components/scenes.js": content / "components/scenes.js", "fonts/runtime.woff2": content / "fonts/runtime.woff2"}
    media = {"song.mp3": content / "song.mp3", "media/cover.jpg": content / "media/cover.jpg"}
    revision = engines.archive_engine("promo-retirement", html, code)
    write_json(root / "project.json", {"kind": "nodemotion", "schema_version": 1, "design_id": "promo-retirement",
        "engine": {"policy": "pinned", "revision": revision}, "content_prefix": "assets", "timeline": "timeline.json",
        "assets": {"song.mp3": {"kind": "music", "asset_id": "audio", "sha256": sha(canonical["audio"].read_bytes())},
                   "media/cover.jpg": {"kind": "image", "asset_id": "image", "sha256": sha(canonical["image"].read_bytes())}}})
    rendered = profile / "renders/videos/nodemotion/old/recording/video.mp4"
    rendered.parent.mkdir(parents=True)
    rendered.write_bytes(b"never-delete-rendered-mp4")
    local_output = root / "youtube_video.mp4"
    local_output.write_bytes(b"never-delete-legacy-output")
    old_key = (content / "song.mp3").relative_to(profile).as_posix()
    for name, collections, documents in (
        ("resources", {"content_resources": [{"asset_id": "linked-input", "video_id": "old", "kind": "music", "storage_key": old_key}]},
         {"legacy_path_aliases": {sha(b"old-historical-key"): {"legacy_key": "old-historical-key", "storage_key": old_key}}}),
        ("videos", {"drafts": [{"draft_id": "d1", "status": "prepared"}, {"draft_id": "other", "status": "rendering"}]},
         {"draft_jobs": {"d1": {"job_id": "old", "input": {"promo_timeline": lyrics}, "artifacts": {
             "output_dir": str(root), "html_path": str(root / "index.html"), "music_path": str(content / "song.mp3"),
             "music_asset_id": "original-song-id", "lyrics_json": lyrics, "youtube_video_path": str(rendered)}}},
          "other_document": {"description": str(content / "song.mp3")}}),
        ("jobs", {"jobs": [{"job_id": "old", "file_paths": {"youtube": str(rendered)},
                           "music_path": str(content / "song.mp3"), "title": str(content / "song.mp3")}]}, {}),
        ("schedule", {"queue_entries": [{"id": "queued", "asset_path": old_key}]}, {}),
        ("publicaciones", {}, {"publication": {"path": str(content / "media/cover.jpg")}}),
    ):
        write_json(profile / "data/json" / f"{name}.json", {"schema_version": 1, "revision": 0,
                   "collections": collections, "documents": documents})
    return dict(profile=profile, root=root, content=content, code=code, media=media,
                canonical=canonical, rendered=rendered, local_output=local_output)


def retire(env, *, apply=False):
    return retirement.retire_project(env["profile"], env["root"], draft_id="d1", code=env["code"], media=env["media"], apply=apply)


def test_dry_run_has_no_writes_and_lists_exact_sources(legacy):
    before = {path: path.read_bytes() for path in legacy["profile"].rglob("*") if path.is_file()}
    result = retire(legacy)
    assert result["mode"] == "dry-run" and result["planned_files"] == 6
    assert not retirement.journal_path(legacy["profile"], legacy["root"]).exists()
    assert before == {path: path.read_bytes() for path in legacy["profile"].rglob("*") if path.is_file()}


def test_apply_updates_exact_references_and_preserves_outputs_and_track_identity(legacy):
    result = retire(legacy, apply=True)
    assert result["state"] == "complete" and result["retired_files"] == 6
    for name in ("index.html", "assets/components/scenes.js", "assets/fonts/runtime.woff2", "assets/song.mp3", "assets/media/cover.jpg", "assets/lyrics.json"):
        assert not (legacy["root"] / name).exists()
    assert legacy["rendered"].read_bytes() == b"never-delete-rendered-mp4"
    assert legacy["local_output"].read_bytes() == b"never-delete-legacy-output"
    assert (legacy["content"] / "config.json").is_file()
    assert (legacy["content"] / "timeline.json").is_file()
    jobs = Section("videos").read()["documents"]
    artifacts = jobs["draft_jobs"]["d1"]["artifacts"]
    assert artifacts["music_path"] == str(legacy["canonical"]["audio"])
    assert artifacts["music_asset_id"] == "original-song-id"
    assert artifacts["html_path"] is None and artifacts["lyrics_json"] is None
    assert jobs["draft_jobs"]["d1"]["input"]["promo_timeline"] is None
    assert jobs["other_document"]["description"] == str(legacy["content"] / "song.mp3")
    resource = Section("resources").read()
    assert resource["collections"]["content_resources"][0]["asset_id"] == "linked-input"
    assert resource["collections"]["content_resources"][0]["storage_key"] == "resources/music/shared/file.mp3"
    aliases = resource["documents"]["legacy_path_aliases"]
    assert aliases[sha(b"old-historical-key")]["legacy_key"] == "old-historical-key"
    assert aliases[sha(b"old-historical-key")]["storage_key"] == "resources/music/shared/file.mp3"
    old_absolute = str(legacy["content"] / "song.mp3")
    assert aliases[sha(old_absolute.encode())]["legacy_key"] == old_absolute
    tracked = Section("jobs").read()["collections"]["jobs"][0]
    assert tracked["music_path"] == str(legacy["canonical"]["audio"])
    assert tracked["title"] == old_absolute
    assert tracked["file_paths"]["youtube"] == str(legacy["rendered"])
    assert Section("videos").read()["collections"]["drafts"][1]["status"] == "rendering"
    before = {name: Section(name).read()["revision"] for name in retirement._SECTIONS}
    resumed = retirement.resume_retirement(legacy["profile"], legacy["root"], apply=True)
    assert resumed["state"] == "complete"
    assert before == {name: Section(name).read()["revision"] for name in retirement._SECTIONS}


def test_interrupted_deletion_resumes_from_journal(legacy, monkeypatch):
    original = retirement._atomic_json
    def interrupt(path, plan):
        if plan["state"] == "retiring" and any(item["status"] == "retired" for item in plan["entries"]):
            raise RuntimeError("simulated interruption")
        return original(path, plan)
    monkeypatch.setattr(retirement, "_atomic_json", interrupt)
    with pytest.raises(RuntimeError, match="interruption"):
        retire(legacy, apply=True)
    assert not (legacy["root"] / "index.html").exists()
    assert legacy["media"]["song.mp3"].is_file()
    monkeypatch.setattr(retirement, "_atomic_json", original)
    result = retirement.resume_retirement(legacy["profile"], legacy["root"], apply=True)
    assert result["state"] == "complete"
    assert not legacy["media"]["song.mp3"].exists()
    assert legacy["rendered"].is_file()


def test_changed_source_or_replacement_blocks_before_deletion(legacy):
    legacy["media"]["song.mp3"].write_bytes(b"changed after migration")
    with pytest.raises(ValueError, match="Replacement differs"):
        retire(legacy, apply=True)
    assert (legacy["root"] / "index.html").is_file()
    assert not retirement.journal_path(legacy["profile"], legacy["root"]).exists()


def test_registered_output_cannot_be_retired_even_with_matching_resource_bytes(legacy):
    Section("jobs").mutate(lambda data: data["collections"]["jobs"][0]["file_paths"].update(custom=str(legacy["media"]["song.mp3"])))
    with pytest.raises(ValueError, match="rendered output"):
        retire(legacy, apply=True)
    assert legacy["media"]["song.mp3"].is_file()


def test_changed_config_after_interruption_preserves_all_remaining_sources(legacy, monkeypatch):
    original = retirement._atomic_json
    def interrupt(path, plan):
        if plan["updated_sections"]:
            raise RuntimeError("stop after references")
        return original(path, plan)
    monkeypatch.setattr(retirement, "_atomic_json", interrupt)
    with pytest.raises(RuntimeError):
        retire(legacy, apply=True)
    (legacy["content"] / "config.json").write_text('{"changed":true}')
    monkeypatch.setattr(retirement, "_atomic_json", original)
    with pytest.raises(ValueError, match="Retained project data changed"):
        retirement.resume_retirement(legacy["profile"], legacy["root"], apply=True)
    assert (legacy["root"] / "index.html").is_file()
    assert legacy["media"]["song.mp3"].is_file()


def test_wrong_profile_busy_project_and_symlink_are_rejected(legacy, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "other")
    with pytest.raises(ValueError, match="selected v3 profile"):
        retire(legacy)
    monkeypatch.setattr(settings, "storage_profile_dir", legacy["profile"])
    Section("videos").mutate(lambda data: data["collections"]["drafts"][0].update(status="rendering"))
    with pytest.raises(ValueError, match="active draft"):
        retire(legacy)
    Section("videos").mutate(lambda data: data["collections"]["drafts"][0].update(status="prepared"))
    path = legacy["code"]["components/scenes.js"]
    path.unlink()
    path.symlink_to(legacy["canonical"]["audio"])
    with pytest.raises(ValueError, match="symlink"):
        retire(legacy)


def test_corrupt_journal_cannot_retire_retained_config(legacy):
    plan = retirement._plan(legacy["profile"], legacy["root"], "d1", legacy["code"], legacy["media"])
    plan["entries"][0]["relative"] = "assets/config.json"
    plan["entries"][0]["virtual"] = "assets/config.json"
    path = retirement.journal_path(legacy["profile"], legacy["root"])
    retirement._atomic_json(path, plan)
    with pytest.raises(ValueError, match="retained or virtual"):
        retirement.resume_retirement(legacy["profile"], legacy["root"], apply=True)
    assert (legacy["content"] / "config.json").is_file()
    assert (legacy["root"] / "index.html").is_file()


def test_nested_input_named_video_is_not_mistaken_for_a_rendered_output(legacy):
    source = legacy["content"] / "media/video.mp4"
    source.write_bytes(b"verified input video")
    target = legacy["profile"] / "resources/videos/shared/video.mp4"
    target.parent.mkdir(parents=True)
    target.write_bytes(source.read_bytes())
    original_asset = resources._asset
    resources._asset = lambda kind, asset_id: target if asset_id == "nested-video" else original_asset(kind, asset_id)
    try:
        path = legacy["root"] / "project.json"
        project = json.loads(path.read_text())
        project["assets"]["media/video.mp4"] = {"kind": "video", "asset_id": "nested-video", "sha256": sha(target.read_bytes())}
        write_json(path, project)
        legacy["media"]["media/video.mp4"] = source
        result = retire(legacy, apply=True)
        assert result["state"] == "complete"
        assert not source.exists() and target.is_file()
        assert legacy["local_output"].is_file()
    finally:
        resources._asset = original_asset


@pytest.mark.asyncio
async def test_full_profile_migration_then_retirement_reuses_real_engine_and_resumes(legacy, monkeypatch):
    from src.core.nodemotion.shared import migration
    # Restore the pre-migration state; use the real engine archive, project
    # resolver, section store, retirement journal, and exact resource bytes.
    (legacy["root"] / "project.json").unlink()
    (legacy["content"] / "timeline.json").unlink()
    Section("videos").mutate(lambda data: data["collections"]["drafts"][0].update(template_id="promo-retirement"))
    index = {("music", resources.digest(legacy["canonical"]["audio"])): "audio",
             ("image", resources.digest(legacy["canonical"]["image"])): "image"}
    monkeypatch.setattr(migration, "_library_index", lambda: index)
    async def never_register(*args, **kwargs):
        pytest.fail("Exact existing durable resources must be reused")
    monkeypatch.setattr(migration, "_register", never_register)
    original_html = (legacy["root"] / "index.html").read_bytes()
    report = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in report["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "migrated", result
    assert result["retirement"]["state"] == "complete"
    assert not (legacy["root"] / "index.html").exists()
    assert not legacy["media"]["song.mp3"].exists()
    assert retirement.resolve_project(legacy["root"], "index.html") == original_html
    assert retirement.resolve_project(legacy["root"], "assets/fonts/runtime.woff2").read_bytes() == b"exact-font\x00\xff"
    saved = (legacy["root"] / "project.json").read_bytes()
    versions = {name: Section(name).read()["revision"] for name in retirement._SECTIONS}
    repeated = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in repeated["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "already-migrated", result
    assert result["retirement"]["state"] == "complete"
    assert (legacy["root"] / "project.json").read_bytes() == saved
    assert versions == {name: Section(name).read()["revision"] for name in retirement._SECTIONS}
    assert legacy["rendered"].read_bytes() == b"never-delete-rendered-mp4"


def _approved_legacy(env, monkeypatch):
    from src.core import drafts
    from src.core.draft_details import DraftDetails
    from src.core.draft_thumbnails import ThumbnailSet
    from src.core.job import Job, JobInput, JobStage
    from src.core.nodemotion.promo import readiness
    from src.core.nodemotion.shared import migration
    (env["root"] / "project.json").unlink()
    (env["content"] / "timeline.json").unlink()
    lyrics = json.loads((env["content"] / "lyrics.json").read_text())
    job = Job(job_id="old", input=JobInput(category_name="promo-retirement", promo_timeline=lyrics), stage=JobStage.HTML_GENERATED)
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": env["root"], "assets_dir": env["content"], "html_path": env["root"] / "index.html",
        "config_json_path": env["content"] / "config.json", "music_path": env["content"] / "song.mp3",
        "music_asset_id": "original-song-id", "lyrics_json": lyrics,
    })})
    draft = drafts.Draft(draft_id="d1", template_id="promo-retirement", niche_id="promo-retirement",
        name="Reviewed draft", status="prepared", stage="html_generated", preview_url="/api/v1/drafts/d1/preview/index.html",
        details=DraftDetails(song_name="Reviewed", artist="Artist"),
        thumbnails=ThumbnailSet(fingerprint="a" * 20, options={"A": {"text": "Approved A"}, "B": {"text": "Approved B"}}),
        created_at="2026-11-14T00:00:00Z", updated_at="2026-11-14T00:00:00Z")
    raw = draft.model_dump(mode="json")
    def set_video(section):
        section["collections"]["drafts"][0] = raw
        section["documents"]["draft_jobs"]["d1"] = job.model_dump(mode="json")
    Section("videos").mutate(set_video)
    monkeypatch.setattr(readiness, "TEMPLATES", ("promo-retirement",))
    before = readiness.snapshot_fingerprint(raw)
    approved = {"session_id": "s1", "template_id": "promo-retirement", "draft_id": "d1", "state": "ready",
                "revision": 4, "approved_revision": 4, "reviewed_fingerprint": before, "review_fingerprint": before,
                "quality": {"passed": True}}
    Section("jobs").mutate(lambda section: section["collections"].update(promo_chat_sessions=[approved]))
    index = {("music", resources.digest(env["canonical"]["audio"])): "audio",
             ("image", resources.digest(env["canonical"]["image"])): "image"}
    monkeypatch.setattr(migration, "_library_index", lambda: index)
    return raw, before, approved


@pytest.mark.asyncio
async def test_existing_human_approval_and_thumbnail_manifest_survive_exact_migration(legacy, monkeypatch):
    from src.core import drafts
    from src.core.nodemotion.promo import approval_compatibility, readiness
    from src.core.nodemotion.shared import migration
    raw, before, approved = _approved_legacy(legacy, monkeypatch)
    assert readiness.approved_for_recording(drafts.Draft.model_validate(raw))
    report = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in report["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "migrated", result
    current = Section("videos").read()["collections"]["drafts"][0]
    assert readiness.snapshot_fingerprint(current) == before
    assert Section("jobs").read()["collections"]["promo_chat_sessions"][0] == approved
    assert approval_compatibility.compatible_thumbnail_manifest(legacy["root"], current) == raw["thumbnails"]
    assert readiness.approved_for_recording(drafts.Draft.model_validate(current))
    hydrated = await drafts.get("d1")
    assert hydrated.thumbnails.fingerprint == raw["thumbnails"]["fingerprint"]
    assert readiness.approved_for_recording(hydrated)
    # A content edit must invalidate the compatibility identity and the approval.
    (legacy["content"] / "config.json").write_text('{"changed":"actual config"}')
    assert approval_compatibility.compatible_legacy_files(legacy["root"]) is None
    assert readiness.snapshot_fingerprint(current) != before
    assert not readiness.approved_for_recording(drafts.Draft.model_validate(current))
    assert Section("jobs").read()["collections"]["promo_chat_sessions"][0] == approved


@pytest.mark.asyncio
async def test_pending_proof_and_timeline_do_not_revoke_approval_after_interruption(legacy, monkeypatch):
    from src.core.nodemotion.promo import readiness
    from src.core.nodemotion.shared import migration
    raw, before, approved = _approved_legacy(legacy, monkeypatch)
    original = migration._publish_new
    def stop_before_project(path, content):
        if path.name == "project.json":
            raise RuntimeError("interrupted before project publication")
        return original(path, content)
    monkeypatch.setattr(migration, "_publish_new", stop_before_project)
    report = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in report["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "needs-review"
    assert (legacy["content"] / "timeline.json").is_file()
    assert not (legacy["root"] / "project.json").exists()
    assert readiness.snapshot_fingerprint(raw) == before
    monkeypatch.setattr(migration, "_publish_new", original)
    resumed = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in resumed["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "migrated", result
    assert readiness.snapshot_fingerprint(raw) == before
    assert Section("jobs").read()["collections"]["promo_chat_sessions"][0] == approved


@pytest.mark.asyncio
async def test_real_missing_media_registration_deduplicates_and_retries_after_interruption(legacy, monkeypatch):
    from src.core.nodemotion.shared import migration
    from src.core.library import asset_library
    monkeypatch.setattr(resources, "_asset", _REAL_ASSET)
    (legacy["root"] / "project.json").unlink()
    (legacy["content"] / "timeline.json").unlink()
    # The profile has no registered library media. Two differently named local
    # image copies must import as one exact shared resource.
    for path in legacy["canonical"].values():
        path.unlink()
    duplicate = legacy["content"] / "media/another-cover.jpg"
    duplicate.write_bytes((legacy["content"] / "media/cover.jpg").read_bytes())
    Section("videos").mutate(lambda data: data["collections"]["drafts"][0].update(template_id="promo-retirement"))
    original = migration._publish_new
    def interrupt_after_import(path, data):
        if path.name == "project.json":
            raise RuntimeError("stop after real resource imports")
        return original(path, data)
    monkeypatch.setattr(migration, "_publish_new", interrupt_after_import)
    first = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in first["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "needs-review", result
    assert not (legacy["root"] / "project.json").exists()
    assert len(asset_library.list_music()) == 1
    assert len(asset_library.list_images()) == 1
    old_ids = ([item.asset_id for item in asset_library.list_music()], [item.asset_id for item in asset_library.list_images()])
    assert (legacy["content"] / "song.mp3").is_file()
    monkeypatch.setattr(migration, "_publish_new", original)
    second = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    result = next(item for item in second["projects"] if item.get("draft_id") == "d1")
    assert result["status"] == "migrated", result
    assert result["retirement"]["state"] == "complete"
    assert old_ids == ([item.asset_id for item in asset_library.list_music()], [item.asset_id for item in asset_library.list_images()])
    manifest = json.loads((legacy["root"] / "project.json").read_text())
    assert manifest["assets"]["media/cover.jpg"]["asset_id"] == manifest["assets"]["media/another-cover.jpg"]["asset_id"]
    music = asset_library.resolve_music_path(old_ids[0][0])
    image = asset_library.resolve_image_path(old_ids[1][0])
    assert music.is_relative_to(legacy["profile"] / "resources") and music.read_bytes() == b"exact-padded-audio"
    assert image.is_relative_to(legacy["profile"] / "resources") and image.read_bytes() == b"image"
    assert not duplicate.exists()
    assert legacy["rendered"].read_bytes() == b"never-delete-rendered-mp4"


@pytest.mark.asyncio
async def test_retired_job_with_no_html_path_materializes_for_recorder(legacy, monkeypatch):
    from types import SimpleNamespace
    from src.core import drafts
    from src.core.job import AnalyzedInput
    from src.core.nodemotion.shared import migration
    from src.core.ports.recorder_port import RecordingResult
    from src.modules import video_recorder
    _approved_legacy(legacy, monkeypatch)
    expected = (legacy["root"] / "index.html").read_bytes()
    report = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    assert next(item for item in report["projects"] if item.get("draft_id") == "d1")["status"] == "migrated"
    job = drafts.load_job("d1")
    assert job.artifacts.html_path is None
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "analyzed_input": AnalyzedInput(genre="test", mood_tags=[], image_query="", description="test", duration_seconds=1, category_name="nodemotion"),
    })})
    fmt = SimpleNamespace(id="youtube", aspect_ratio="16:9", output_filename="youtube_video.mp4")
    niche = SimpleNamespace(video=SimpleNamespace(formats=[fmt]), has_reels_format=lambda: False, get_16x9_format=lambda: fmt)
    class Recorder:
        async def record(self, *, html_path, audio_path, output_dir, **kwargs):
            assert html_path.read_bytes() == expected
            assert audio_path.read_bytes() == b"exact-padded-audio"
            assert html_path.parent != legacy["root"]
            assert (html_path.parent / "assets/fonts/runtime.woff2").read_bytes() == b"exact-font\x00\xff"
            target = output_dir / "youtube_video.mp4"
            target.write_bytes(b"test render output")
            return RecordingResult(youtube_path=target, stats={"test": True})
    monkeypatch.setattr(video_recorder, "get_recorder", lambda *args, **kwargs: Recorder())
    result = await video_recorder.run(job, niche)
    assert result.artifacts.html_path is None
    assert result.artifacts.youtube_video_path.read_bytes() == b"test render output"
    assert result.artifacts.recording_stats["nodemotion_engine_revision"] == json.loads((legacy["root"] / "project.json").read_text())["engine"]["revision"]
    assert not (legacy["root"] / "index.html").exists()


@pytest.mark.asyncio
async def test_review_proof_validates_media_extensions_omitted_by_legacy_fingerprint(legacy, monkeypatch):
    from src.core.nodemotion.promo import approval_compatibility
    from src.core.nodemotion.shared import migration
    _approved_legacy(legacy, monkeypatch)
    local = legacy["content"] / "media/clip.mov"
    local.write_bytes(b"original MOV bytes")
    durable = legacy["profile"] / "resources/videos/movie/clip.mov"
    durable.parent.mkdir(parents=True)
    durable.write_bytes(local.read_bytes())
    legacy["canonical"]["movie"] = durable
    index = {("music", resources.digest(legacy["canonical"]["audio"])): "audio",
             ("image", resources.digest(legacy["canonical"]["image"])): "image",
             ("video", resources.digest(durable)): "movie"}
    monkeypatch.setattr(migration, "_library_index", lambda: index)
    result = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    assert next(item for item in result["projects"] if item.get("draft_id") == "d1")["status"] == "migrated"
    assert approval_compatibility.compatible_legacy_files(legacy["root"]) is not None
    durable.write_bytes(b"changed MOV bytes")
    assert approval_compatibility.compatible_legacy_files(legacy["root"]) is None


@pytest.mark.asyncio
async def test_real_orphan_migration_retires_known_engine_without_creating_visible_drafts(legacy, monkeypatch):
    from src.core.nodemotion.shared import migration
    from src.core.library import asset_library
    monkeypatch.setattr(resources, "_asset", _REAL_ASSET)
    (legacy["root"] / "project.json").unlink()
    (legacy["content"] / "timeline.json").unlink()
    for path in legacy["canonical"].values():
        path.unlink()
    source = legacy["root"] / "index.html"
    source.write_bytes(source.read_bytes().replace(b"start();", b'const NAME = "promo-retirement"; start();'))
    expected = source.read_bytes()
    def remove_drafts(section):
        section["collections"]["drafts"] = []
        section["documents"]["draft_jobs"] = {}
    Section("videos").mutate(remove_drafts)
    Section("jobs").mutate(lambda section: section["collections"].update(jobs=[]))
    before = Section("videos").read()
    report = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    item = next(item for item in report["projects"] if item.get("root") == str(legacy["root"]))
    assert item["status"] == "migrated", item
    assert item["retirement"]["state"] == "complete"
    assert retirement.resolve_project(legacy["root"], "index.html") == expected
    assert not source.exists() and not (legacy["content"] / "song.mp3").exists()
    assert len(asset_library.list_music()) == 1 and len(asset_library.list_images()) == 1
    after = Section("videos").read()
    assert after["collections"]["drafts"] == []
    assert after["documents"]["draft_jobs"] == {}
    assert set(after["collections"]) == set(before["collections"])
    assert legacy["rendered"].read_bytes() == b"never-delete-rendered-mp4"
    repeated = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    item = next(item for item in repeated["projects"] if item.get("root") == str(legacy["root"]))
    assert item["status"] == "already-migrated", item
    assert item["retirement"]["state"] == "complete"


def test_descriptor_unlink_detects_a_file_replaced_by_a_symlink(legacy, monkeypatch, tmp_path):
    source = legacy["media"]["song.mp3"]
    outside = tmp_path / "unrelated.mp3"
    outside.write_bytes(source.read_bytes())
    original = retirement.os.open
    replaced = False
    def replace_after_open(path, flags, *args, **kwargs):
        nonlocal replaced
        descriptor = original(path, flags, *args, **kwargs)
        if path == "song.mp3" and kwargs.get("dir_fd") is not None and not replaced:
            replaced = True
            source.unlink()
            source.symlink_to(outside)
        return descriptor
    monkeypatch.setattr(retirement.os, "open", replace_after_open)
    with pytest.raises(ValueError, match="changed immediately"):
        retirement._unlink_verified(legacy["root"], "assets/song.mp3", sha(outside.read_bytes()))
    assert source.is_symlink()
    assert outside.read_bytes() == b"exact-padded-audio"


def test_descriptor_unlink_rejects_symlinked_parent(legacy, tmp_path):
    directory = legacy["content"] / "media"
    original = directory / "cover.jpg"
    expected = sha(original.read_bytes())
    outside = tmp_path / "unrelated-directory"
    outside.mkdir()
    (outside / "cover.jpg").write_bytes(original.read_bytes())
    original.unlink()
    directory.rmdir()
    directory.symlink_to(outside, target_is_directory=True)
    with pytest.raises(OSError):
        retirement._unlink_verified(legacy["root"], "assets/media/cover.jpg", expected)
    assert (outside / "cover.jpg").read_bytes() == b"image"


@pytest.mark.asyncio
async def test_native_demo_custom_audio_timing_fonts_and_extra_json_survive_real_retirement(legacy, monkeypatch, tmp_path):
    from src.core.nodemotion.shared import migration, execution
    monkeypatch.setattr(resources, "_asset", _REAL_ASSET)
    original_root = legacy["root"]
    root = legacy["profile"] / "productions/nodemotion/commercial/promo-retirement"
    root.parent.mkdir(parents=True)
    original_root.rename(root)
    assets = root / "assets"
    legacy["root"], legacy["content"] = root, assets
    (root / "project.json").unlink()
    (assets / "timeline.json").unlink()
    for path in legacy["canonical"].values():
        path.unlink()
    (assets / "song.mp3").rename(assets / "custom-song.mp3")
    (assets / "lyrics.json").rename(assets / "original-words.json")
    (assets / "components").rename(root / "components")
    config = {"activeId": "original", "configs": [{"id": "original", "audio": {"src": "assets/custom-song.mp3"},
              "lyricsUrl": "assets/original-words.json", "bg": {"src": "assets/media/cover.jpg", "type": "image"}}]}
    write_json(assets / "config.json", config)
    (assets / "config1.json").write_bytes(b'{"secondary":"keep exact data"}\n')
    source = root / "index.html"
    source.write_bytes(source.read_bytes().replace(b'<base href="assets/">', b'').replace(
        b"start();", b'const NAME = "promo-retirement"; fetch("assets/config1.json"); start();'))
    expected_html = source.read_bytes()
    expected_words = (assets / "original-words.json").read_bytes()
    write_json(root / "publish.json", {"template_id": "promo-retirement"})
    Section("videos").mutate(lambda data: (data["collections"].update(drafts=[]), data["documents"].update(draft_jobs={})))
    Section("jobs").mutate(lambda data: data["collections"].update(jobs=[]))
    report = await migration.migrate(legacy["profile"], apply=True, retire_verified=True)
    item = next(item for item in report["projects"] if item.get("root") == str(root))
    assert item["status"] == "migrated", json.dumps(item)
    assert item["retirement"]["state"] == "complete"
    project = execution.load_project(root)
    assert project["inject_base"] is False
    assert project["data_urls"]["audio"] == "assets/custom-song.mp3"
    assert project["data_urls"]["timing"] == "assets/original-words.json"
    assert "assets/config1.json" in project["extra_data_urls"]
    assert execution.resolve_project(root, "index.html") == expected_html
    assert execution.resolve_project(root, "assets/original-words.json").read_bytes() == expected_words
    assert execution.resolve_project(root, "assets/custom-song.mp3").read_bytes() == b"exact-padded-audio"
    assert execution.resolve_project(root, "components/scenes.js").read_bytes() == b"old-runtime\x00\r\n"
    assert execution.resolve_project(root, "assets/fonts/runtime.woff2").read_bytes() == b"exact-font\x00\xff"
    assert (assets / "config1.json").read_bytes() == b'{"secondary":"keep exact data"}\n'
    assert json.loads((assets / "config.json").read_bytes()) == config
    for path in (source, assets / "custom-song.mp3", assets / "original-words.json", root / "components/scenes.js", assets / "fonts/runtime.woff2"):
        assert not path.exists()
    index, audio, revision = execution.materialize(root, tmp_path / "native-export")
    assert index.read_bytes() == expected_html
    assert audio.name == "custom-song.mp3" and audio.read_bytes() == b"exact-padded-audio"
    assert (index.parent / "assets/config1.json").read_bytes() == b'{"secondary":"keep exact data"}\n'
    assert legacy["rendered"].read_bytes() == b"never-delete-rendered-mp4"
    journal = json.loads(retirement.journal_path(legacy["profile"], root).read_text())
    assert "assets/config1.json" in journal["retained"]
    (assets / "config1.json").write_text('{"changed":true}')
    with pytest.raises(ValueError, match="Retained project data changed"):
        retirement.resume_retirement(legacy["profile"], root, apply=True)
