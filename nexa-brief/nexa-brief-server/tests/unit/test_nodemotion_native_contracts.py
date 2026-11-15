"""Native project filenames must reach review and every recorder unchanged."""
import asyncio
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import quote, urlsplit
from urllib.request import urlopen

import pytest

from src.core.nodemotion.shared import execution, resources


@pytest.fixture
def native_project(tmp_path, monkeypatch):
    root = tmp_path / "project"
    (root / "assets").mkdir(parents=True)
    config = {"activeId": "original", "configs": [{"id": "original", "audio": {"src": "assets/Original Mix.mp3"}}]}
    (root / "assets/setup.json").write_text(json.dumps(config))
    (root / "assets/secondary.json").write_text('{"alternate":true}')
    library = {}
    for kind, name, body in (("music", "track", b"exact audio"), ("video", "backdrop", b"exact movie")):
        path = tmp_path / name
        path.write_bytes(body)
        library[(kind, name)] = path
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: library[(kind, asset_id)])
    monkeypatch.setattr(execution, "registered", lambda design: design == "lyrics-neon")
    monkeypatch.setattr(execution, "available_revision", lambda design, revision: revision == "v1")
    monkeypatch.setattr(execution, "freeze_engine", lambda design, revision=None: "v1")
    monkeypatch.setattr(execution, "assemble", lambda design, revision=None: b"<html><head></head><body>original</body></html>")
    monkeypatch.setattr(execution, "runtime_files", lambda design, revision=None: {})
    urls = {"config": "assets/setup.json", "timing": "assets/original-cues.json",
            "audio": "assets/Original Mix.mp3", "background": "assets/original-backdrop.mov"}
    timing = {"metadata": {"audio_duration_sec": 2}, "segments": [{"start": 0, "end": 1, "text": "original"}]}
    execution.create_project(root, "lyrics-neon",
        {urls["audio"]: resources.asset_ref("music", "track"),
         urls["background"]: resources.asset_ref("video", "backdrop")},
        data_urls=urls, extra_data_urls=["assets/secondary.json"], inject_base=False,
        timeline=timing, policy="pinned")
    return SimpleNamespace(root=root, urls=urls, config=config, timing=timing, library=library)


def _job(root):
    from src.core.job import Job, JobInput
    job = Job(input=JobInput(category_name="lyrics-neon"))
    return job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": root / "assets"})})


def test_native_readiness_hashes_declared_urls_and_extra_data(native_project, monkeypatch):
    from src.core import drafts
    from src.core.nodemotion.promo import readiness
    env = native_project
    monkeypatch.setattr(drafts, "load_job", lambda _: _job(env.root))
    files, job = readiness._content_files("native")
    assert {env.urls["config"], env.urls["timing"], *env.urls.values(), "assets/secondary.json"} <= files.keys()
    assert not any(name.startswith("assets/assets/") for name in files)
    assert files[env.urls["audio"]] == hashlib.sha256(b"exact audio").hexdigest()
    assert readiness._has_required_data(files, job)
    checks = readiness.evaluate({"draft_id": "native"})["checks"]
    assert next(check for check in checks if check["id"] == "config")["passed"]
    before = readiness.snapshot_fingerprint({"draft_id": "native"})
    (env.root / "assets/secondary.json").write_text('{"alternate":"changed"}')
    assert readiness.snapshot_fingerprint({"draft_id": "native"}) != before
    (env.root / env.urls["config"]).unlink()
    missing, job = readiness._content_files("native")
    assert not readiness._has_required_data(missing, job)


def test_native_review_proof_preserves_labels_and_checks_unlisted_mov(native_project, tmp_path, monkeypatch):
    from src.core import data, drafts
    from src.core.nodemotion.promo import approval_compatibility as compatibility, readiness
    env = native_project
    root = tmp_path / "legacy"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_bytes(execution.resolve_project(env.root, "index.html"))
    for name in (*env.urls.values(), "assets/secondary.json"):
        value = execution.resolve_project(env.root, name)
        path = root / name
        path.write_bytes(value if isinstance(value, bytes) else value.read_bytes())
    job = _job(root)
    draft = {"draft_id": "native", "template_id": "lyrics-neon", "preview_url": "/unchanged",
             "thumbnails": {"options": {"A": {"text": "approved"}}}}
    monkeypatch.setattr(drafts, "load_job", lambda _: job)
    monkeypatch.setattr(data, "collection", lambda _: SimpleNamespace(get=lambda _: draft))
    monkeypatch.setattr(data, "documents", lambda _: SimpleNamespace(get=lambda _: job.model_dump(mode="json")))
    before = readiness.snapshot_fingerprint(draft)
    retired = [root / "index.html", *(root / env.urls[key] for key in ("audio", "timing", "background"))]
    proof = compatibility.prepare_review_compatibility(root, env.root, draft_id="native", retired_paths=retired)
    (root / compatibility.NAME).write_bytes(proof)
    (root / "assets/timeline.json").write_bytes((env.root / "assets/timeline.json").read_bytes())
    (root / "project.json").write_bytes((env.root / "project.json").read_bytes())
    for path in retired:
        path.unlink()
    assert compatibility.compatible_legacy_files(root) is not None
    assert readiness.snapshot_fingerprint(draft) == before
    assert readiness._has_required_data(*readiness._content_files("native"))
    env.library[("video", "backdrop")].write_bytes(b"changed movie")
    assert compatibility.compatible_legacy_files(root) is None


@pytest.mark.parametrize("target", ["local", "aws"])
@pytest.mark.parametrize("native", [False, True])
async def test_remotion_preserves_native_urls_and_legacy_props(native_project, tmp_path, monkeypatch, target, native):
    from src.adapters.recorder.infrastructure import remotion_adapter as rm
    env = native_project
    if native:
        html, audio, _ = execution.materialize(env.root, tmp_path / "export")
        public = html.parent
        expected = {"configData": env.config, "audioSrc": env.urls["audio"],
                    "bgSrc": env.urls["background"], "lyricsData": env.timing, "durationSeconds": 2}
        composition = "NeonLetrasVideo"
    else:
        public = tmp_path / "legacy-assets"
        public.mkdir()
        html, audio = public / "index.html", public / "song.mp3"
        html.write_text("<html></html>")
        audio.write_bytes(b"audio")
        (public / "config.json").write_text(json.dumps(env.config))
        (public / "lyrics.json").write_text(json.dumps(env.timing))
        expected = {"configData": env.config, "audioSrc": "song.mp3", "bgSrc": "bg.jpg",
                    "lyricsData": env.timing, "durationSeconds": 2}
        composition = "NeonLetras"
    outputs = tmp_path / "renders"
    outputs.mkdir()
    fmt = SimpleNamespace(output_filename="youtube_video.mp4")
    niche = SimpleNamespace(
        template=SimpleNamespace(template_id="lyrics-neon", media_src_filename="bg.jpg", requires_lyrics=True),
        get_16x9_format=lambda: fmt, get_9x16_format=lambda: None,
        video=SimpleNamespace(formats=[fmt], generate_tiktok_clip=False))
    monkeypatch.setattr(rm.settings, "remotion_debug_max_duration_seconds", None)
    monkeypatch.setattr(rm.settings, "remotion_aws_function_name", "test-function")
    monkeypatch.setattr(rm.settings, "remotion_aws_serve_url", "https://example.invalid")
    monkeypatch.setattr(rm, "_get_render_semaphore", lambda: asyncio.Semaphore(1))

    async def run(cmd, **kwargs):
        flag = "--asset-dir=" if target == "aws" else "--public-dir="
        assert flag + str(public) in cmd
        assert "--composition=" + composition in cmd
        props_path = Path(next(arg.split("=", 1)[1] for arg in cmd if arg.startswith("--props=")))
        assert json.loads(props_path.read_bytes()) == expected
        if native:
            assert (public / expected["audioSrc"]).read_bytes() == b"exact audio"
            assert (public / expected["bgSrc"]).read_bytes() == b"exact movie"
        Path(next(arg.split("=", 1)[1] for arg in cmd if arg.startswith("--output="))).write_bytes(b"rendered")
        return SimpleNamespace(returncode=0, stderr_tail="", stdout_tail="")

    monkeypatch.setattr(rm, "run_with_progress", run)
    result = await rm.RemotionAdapter().record(html, audio, outputs, 2, niche, target)
    assert result.youtube_path.read_bytes() == b"rendered"


async def test_playwright_serves_exact_native_paths_and_passes_actual_audio(native_project, tmp_path, monkeypatch):
    from src.adapters.recorder.infrastructure import playwright_ffmpeg_adapter as pw
    from src.core.ports.recorder_port import RecordingResult
    env = native_project
    html, audio, _ = execution.materialize(env.root, tmp_path / "export")
    monkeypatch.setattr(pw.shutil, "which", lambda _: "/bin/ffmpeg")

    async def capture(self, page_url, audio_path, workspace, *args):
        assert audio_path == html.parent / env.urls["audio"]
        base = page_url.rsplit("/", 1)[0]
        assert urlsplit(page_url).path == "/index.html"
        with urlopen(page_url) as response:
            assert response.read() == html.read_bytes()
        for name in env.urls.values():
            with urlopen(base + "/" + quote(name)) as response:
                assert response.read() == (html.parent / name).read_bytes()
        output = workspace / "youtube_video.mp4"
        output.write_bytes(b"rendered")
        return RecordingResult(youtube_path=output)

    monkeypatch.setattr(pw.PlaywrightFFmpegAdapter, "_record_all_formats", capture)
    result = await pw.PlaywrightFFmpegAdapter().record(html, audio, tmp_path / "renders", 2)
    assert result.youtube_path.read_bytes() == b"rendered"


@pytest.mark.parametrize("relative", ["../outside.mp3", "/etc/passwd", r"assets\\outside.mp3"])
def test_remotion_rejects_native_path_escape(tmp_path, relative):
    from src.adapters.recorder.infrastructure import remotion_adapter as rm
    from src.config.exceptions import RecordingError
    with pytest.raises(RecordingError):
        rm._native_asset(tmp_path, relative)
