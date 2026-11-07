import json
import hashlib
from storage_discovery import discover

NOW = "2026-11-03T01:00:00+00:00"
OLD = "2026-11-01T01:00:00+00:00"
ACT = "2026-11-02T01:00:00+00:00"


def put(p, data="x"):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(data)
    return p


def setup(tmp_path):
    out = tmp_path / "profile" / "output"
    templates = tmp_path / "templates"
    jobs = tmp_path / "jobs.json"
    events = tmp_path / "events"
    video = templates / "nodetech" / "sample"
    put(video / "manifest.json", json.dumps({"video_id": "sample", "design": "rough"}))
    put(video / "index.html")
    put(video / "assets" / "song.mp3")
    put(video / "assets" / "media" / "x.jpg")
    put(video / "work" / "sheet.png")
    put(video / "assets" / "frame_0001.jpg")
    put(templates / "_tools" / "explainer-kit" / "engine" / "x.js")
    put(templates / "_tools" / "explainer-kit" / "designs" / "rough" / "component.js")
    return out, templates, jobs, events, video


def test_packaged_job_and_confinement(tmp_path):
    out, t, jobs, e, v = setup(tmp_path)
    media = put(out / "category" / "id" / "a.mp4")
    put(out / "category" / "id" / "index.html")
    put(out / "category" / "id" / "work" / "frame_0001.jpg")
    rows = [
        {
            "job_id": "good",
            "stage": "packaged",
            "source": "explainer",
            "video_id": "sample",
            "updated_at": NOW,
            "created_at": NOW,
            "output_dir": "/app/output/category/id",
            "format_paths": {"16x9": "/app/output/category/id/a.mp4"},
        },
        {"job_id": "old", "stage": "packaged", "updated_at": OLD},
        {"job_id": "preview", "stage": "rendering", "updated_at": NOW},
        {
            "job_id": "bad",
            "stage": "published",
            "updated_at": NOW,
            "output_dir": "/app/output/category/id",
            "format_paths": {"16x9": "/app/output/../../etc/passwd"},
        },
    ]
    put(jobs, json.dumps(rows))
    specs, errors = discover(jobs, out, t, ACT, e)
    assert [s["job_id"] for s in specs] == ["good"]
    assert errors and errors[0]["id"] == "bad"
    paths = {f["target"] for f in specs[0]["files"]}
    assert (
        "output/a.mp4" in paths
        and "project/templates/nodetech/sample/assets/song.mp3" in paths
    )
    assert "project/templates/_tools/explainer-kit/engine/x.js" in paths and not any(
        "frame_" in x or "/work/" in x for x in paths
    )
    assert discover(jobs, out, t, ACT, e)[0] == specs
    media.write_text("larger new content")
    assert (
        discover(jobs, out, t, ACT, e)[0][0]["metadata"]["fingerprint"]
        != specs[0]["metadata"]["fingerprint"]
    )


def test_cli_event_only_and_no_previews_or_sandbox(tmp_path):
    out, t, jobs, events, video = setup(tmp_path)
    put(jobs, "[]")
    put(video / "render" / "sample-16x9.mp4")
    put(video / "render" / "preview" / "sample-16x9-20s.mp4")
    assert discover(jobs, out, t, ACT, events)[0] == []
    st = (video / "render" / "sample-16x9.mp4").stat()
    eid = hashlib.sha256(b"nodetech/sample").hexdigest()[:32]
    event = {
        "event_id": eid,
        "video_id": "sample",
        "template_relative": "nodetech/sample",
        "formats": ["16x9"],
        "finished_at": NOW,
        "outputs": {"16x9": {"size": st.st_size, "mtime_ns": st.st_mtime_ns}},
    }
    put(events / (eid + ".json"), json.dumps(event))
    specs, errors = discover(jobs, out, t, ACT, events)
    assert not errors and specs[0]["job_id"] == "cli-" + eid
    assert "output/sample-16x9.mp4" in {f["target"] for f in specs[0]["files"]}
    assert not any("preview" in f["target"] for f in specs[0]["files"])
    event["template_relative"] = "sandbox/sample"
    put(events / (eid + ".json"), json.dumps(event))
    specs, errors = discover(jobs, out, t, ACT, events)
    assert specs == [] and errors


def test_symlink_escape_rejected(tmp_path):
    out, t, jobs, e, v = setup(tmp_path)
    outside = put(tmp_path / "secret.mp4")
    p = out / "c" / "id" / "bad.mp4"
    p.parent.mkdir(parents=True)
    p.symlink_to(outside)
    put(
        jobs,
        json.dumps(
            [
                {
                    "job_id": "bad",
                    "stage": "packaged",
                    "updated_at": NOW,
                    "output_dir": str(p.parent),
                    "file_paths": {"youtube": str(p)},
                }
            ]
        ),
    )
    specs, errors = discover(jobs, out, t, ACT, e)
    assert specs == [] and errors


def test_cli_rejects_stale_signature_and_stable_id(tmp_path):
    out, t, jobs, events, video = setup(tmp_path)
    put(jobs, "[]")
    path = put(video / "render" / "sample-16x9.mp4")
    st = path.stat()
    eid = hashlib.sha256(b"nodetech/sample").hexdigest()[:32]
    event = {
        "event_id": eid,
        "video_id": "sample",
        "template_relative": "nodetech/sample",
        "formats": ["16x9"],
        "finished_at": NOW,
        "outputs": {"16x9": {"size": st.st_size, "mtime_ns": st.st_mtime_ns}},
    }
    put(events / (eid + ".json"), json.dumps(event))
    first, errors = discover(jobs, out, t, ACT, events)
    assert first and not errors
    path.write_text("new revision")
    specs, errors = discover(jobs, out, t, ACT, events)
    assert not specs and errors
    st = path.stat()
    event["outputs"]["16x9"] = {"size": st.st_size, "mtime_ns": st.st_mtime_ns}
    event["finished_at"] = "2026-11-03T02:00:00+00:00"
    put(events / (eid + ".json"), json.dumps(event))
    specs, errors = discover(jobs, out, t, ACT, events)
    assert (
        not errors
        and specs[0]["job_id"] == first[0]["job_id"]
        and specs[0]["metadata"]["fingerprint"] != first[0]["metadata"]["fingerprint"]
    )
    assert all(
        "expected_size" in f and "expected_mtime_ns" in f for f in specs[0]["files"]
    )


def test_manifest_dependency_preserved_and_missing_fails(tmp_path):
    out, t, jobs, e, v = setup(tmp_path)
    d = out / "cat" / "id"
    put(d / "a.mp4")
    put(d / "index.html")
    asset = put(out.parent / "data" / "library" / "images" / "bg.jpg")
    manifest = {
        "files": {"a.mp4": "1", "index.html": "1"},
        "image": {"path": "data/library/images/bg.jpg"},
    }
    put(d / "manifest.json", json.dumps(manifest))
    put(
        jobs,
        json.dumps(
            [
                {
                    "job_id": "p",
                    "stage": "packaged",
                    "updated_at": NOW,
                    "output_dir": str(d),
                    "file_paths": {"youtube": str(d / "a.mp4")},
                }
            ]
        ),
    )
    specs, errors = discover(jobs, out, t, ACT, e)
    assert not errors and "project/profile/data/library/images/bg.jpg" in {
        f["target"] for f in specs[0]["files"]
    }
    asset.unlink()
    specs, errors = discover(jobs, out, t, ACT, e)
    assert not specs and errors


def test_spec_accepted_by_worker_and_idempotent_enqueue(tmp_path):
    import storage_worker

    out, t, jobs, e, v = setup(tmp_path)
    d = out / "cat" / "id"
    put(d / "a.mp4")
    put(
        jobs,
        json.dumps(
            [
                {
                    "job_id": "p",
                    "stage": "packaged",
                    "updated_at": NOW,
                    "output_dir": str(d),
                    "file_paths": {"youtube": str(d / "a.mp4")},
                }
            ]
        ),
    )
    specs, errors = discover(jobs, out, t, ACT, e)
    assert not errors
    db = tmp_path / "db" / "queue.db"
    assert storage_worker.enqueue(db, specs[0])
    assert not storage_worker.enqueue(db, specs[0])


def test_v3_pipeline_separate_production_renders_and_resources(tmp_path):
    profile = tmp_path / "profile"
    renders, production = profile / "renders", profile / "productions/nodemotion/job1"
    templates, jobs = tmp_path / "templates", profile / "data/json/jobs.json"
    video = put(renders / "videos/nodemotion/job1/job1-youtube-16x9/video.mp4", "video")
    audio = put(production / "assets/song.mp3", "audio")
    thumbnail = put(production / "assets/thumbnails/thumbnail.jpg", "thumb")
    put(production / "index.html", "<html></html>")
    resource = put(profile / "resources/music/asset1/original.mp3", "music")
    put(production / "manifest.json", json.dumps({
        "files": {"index.html": "1", "song.mp3": "1", "youtube_video.mp4": "1"},
        "video_formats": [{"id": "youtube", "aspect_ratio": "16:9", "output_filename": "youtube_video.mp4"}],
        "music": {"path": "resources/music/asset1/original.mp3"},
    }))
    row = {"job_id": "job1", "stage": "packaged", "updated_at": NOW,
           "output_dir": str(production), "file_paths": {"youtube": str(video), "thumbnail": str(thumbnail)},
           "format_paths": {"16x9": str(video)}}
    put(jobs, json.dumps({"schema_version": 1, "collections": {"jobs": [row]}}))
    specs, errors = discover(jobs, renders, templates, ACT, profile_root=profile)
    assert not errors and len(specs) == 1
    targets = {f["target"] for f in specs[0]["files"]}
    assert "output/videos/nodemotion/job1/job1-youtube-16x9/video.mp4" in targets
    assert "output/assets/song.mp3" in targets
    assert "output/assets/thumbnails/thumbnail.jpg" in targets
    assert "project/profile/resources/music/asset1/original.mp3" in targets
    assert specs[0]["metadata"]["file_paths"]["thumbnail"] in targets
    assert audio.is_file() and resource.is_file()
    import storage_worker
    assert storage_worker.enqueue(tmp_path / "queue/db.sqlite", specs[0])
    row["format_paths"]["16x9"] = str(put(renders / "videos/nodemotion/other/other-16x9/video.mp4", "other"))
    put(jobs, json.dumps({"schema_version": 1, "collections": {"jobs": [row]}}))
    specs, errors = discover(jobs, renders, templates, ACT, profile_root=profile)
    assert not specs and errors


def test_cli_v3_two_formats_and_rejects_tampering(tmp_path):
    profile = tmp_path / "profile"
    production = profile / "productions/nodetech/sample"
    templates, jobs, events = tmp_path / "templates", tmp_path / "jobs.json", tmp_path / "events"
    put(production / "manifest.json", json.dumps({"video_id": "sample", "design": "rough"}))
    put(production / "index.html", "<html></html>")
    put(jobs, "[]")
    source_key = "productions/nodetech/sample"
    event_id = hashlib.sha256(source_key.encode()).hexdigest()[:32]
    outputs = {}
    for fmt in ("9x16", "16x9"):
        key = f"renders/videos/nodetech/sample/recording-{fmt}/video.mp4"
        path = put(profile / key, "video-" + fmt)
        stat = path.stat()
        outputs[fmt] = {"storage_key": key, "size": stat.st_size, "mtime_ns": stat.st_mtime_ns}
    event = {"schema_version": 3, "event_id": event_id, "video_id": "sample", "source_key": source_key,
             "formats": ["9x16", "16x9"], "outputs": outputs, "finished_at": NOW}
    put(events / (event_id + ".json"), json.dumps(event))
    specs, errors = discover(jobs, profile / "renders", templates, ACT, events, profile)
    assert not errors and len(specs) == 1
    targets = {f["target"] for f in specs[0]["files"]}
    assert {"output/sample-9x16.mp4", "output/sample-16x9.mp4"} <= targets
    outputs["9x16"]["size"] += 1
    put(events / (event_id + ".json"), json.dumps(event))
    assert discover(jobs, profile / "renders", templates, ACT, events, profile)[1]
    outputs["9x16"]["size"] -= 1
    outputs["9x16"]["storage_key"] = outputs["16x9"]["storage_key"]
    put(events / (event_id + ".json"), json.dumps(event))
    assert discover(jobs, profile / "renders", templates, ACT, events, profile)[1]


def test_v3_explainer_job_preserves_thumbnail_reference(tmp_path):
    profile = tmp_path / "profile"
    production = profile / "productions/nodetech/sample"
    templates, jobs = tmp_path / "templates", tmp_path / "jobs.json"
    put(production / "manifest.json", json.dumps({"video_id": "sample", "design": "rough"}))
    put(production / "index.html")
    thumbnail = put(production / "assets/thumbnails/thumbnail.jpg", "thumb")
    video = put(profile / "renders/videos/nodetech/sample/recording-16x9/video.mp4", "video")
    put(jobs, json.dumps([{"job_id": "explainer-sample-recording", "source": "explainer", "video_id": "sample",
                           "stage": "packaged", "updated_at": NOW, "output_dir": str(production),
                           "file_paths": {"youtube": str(video), "thumbnail": str(thumbnail)}}]))
    specs, errors = discover(jobs, profile / "renders", templates, ACT, profile_root=profile)
    assert not errors and len(specs) == 1
    targets = {item["target"] for item in specs[0]["files"]}
    assert specs[0]["metadata"]["file_paths"]["thumbnail"] in targets
