import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.core.explainer import thumbnails


@pytest.fixture
def video(tmp_path, monkeypatch):
    kit = tmp_path / "_tools/explainer-kit"
    (kit / "designs/rough").mkdir(parents=True)
    (kit / "designs/common").mkdir()
    (kit / "designs/rough/design.json").write_text('{"scripts": []}')
    (kit / "designs/common/tabloid.js").write_text("component code")
    root = tmp_path / "nodetech/demo"
    (root / "assets/media").mkdir(parents=True)
    (root / "assets/media/cover.png").write_bytes(b"cover")
    monkeypatch.setattr(thumbnails, "KIT_DIR", kit)
    monkeypatch.setattr(thumbnails, "TEMPLATES_DIR", tmp_path)
    monkeypatch.setattr(thumbnails, "_validate_c", lambda _: None)
    spec = {"component": "common.tabloid", "params": {"text": "Headline", "src": "/nodetech/demo/assets/media/cover.png"}}
    monkeypatch.setattr(thumbnails, "intro_specs", lambda _: {"A": spec, "B": spec, "C": spec})
    return SimpleNamespace(path=root, design="rough", video_id="demo"), spec


@pytest.mark.parametrize("option", ["A", "B", "C"])
def test_all_variants_require_matching_content_stamp(video, option):
    v, spec = video
    output = thumbnails.thumbnail_file(v, option)
    output.parent.mkdir()
    output.write_bytes(b"jpeg")
    assert not thumbnails.capture_current(v, option, spec)
    output.with_suffix(".sha256").write_text(thumbnails._capture_digest(v, spec))
    assert thumbnails.capture_current(v, option, spec)
    changed = {**spec, "params": {**spec["params"], "text": "New headline"}}
    assert not thumbnails.capture_current(v, option, changed)
    (v.path / "assets/media/cover.png").write_bytes(b"replacement image")
    assert not thumbnails.capture_current(v, option, spec)


@pytest.mark.asyncio
async def test_simultaneous_preparation_reuses_complete_capture(video, monkeypatch):
    v, spec = video
    calls = []

    async def fake_exec(*args, **kwargs):
        output = Path(args[2])
        calls.append(output)

        async def communicate():
            await asyncio.sleep(0.02)
            output.write_bytes(b"complete jpeg")
            output.with_suffix(".webp").write_bytes(b"complete webp")
            return b"", None

        return SimpleNamespace(returncode=0, communicate=communicate)

    monkeypatch.setattr(thumbnails.asyncio, "create_subprocess_exec", fake_exec)
    await asyncio.gather(
        thumbnails.render(v, ("A",), only_missing=True),
        thumbnails.render(v, ("A",), only_missing=True),
    )
    assert len(calls) == 1
    output = thumbnails.thumbnail_file(v, "A")
    assert output.read_bytes() == b"complete jpeg"
    assert output.with_suffix(".webp").read_bytes() == b"complete webp"
    assert thumbnails.capture_current(v, "A", spec)


@pytest.mark.asyncio
async def test_failed_capture_preserves_previous_complete_file_and_stamp(video, monkeypatch):
    v, _ = video
    output = thumbnails.thumbnail_file(v, "B")
    output.parent.mkdir()
    output.write_bytes(b"previous complete image")
    output.with_suffix(".sha256").write_text("previous stamp")

    async def fake_exec(*args, **kwargs):
        Path(args[2]).write_bytes(b"partial")
        return SimpleNamespace(returncode=1, communicate=AsyncMock(return_value=(b"decode failed", None)))

    monkeypatch.setattr(thumbnails.asyncio, "create_subprocess_exec", fake_exec)
    with pytest.raises(thumbnails.ThumbnailError, match="decode failed"):
        await thumbnails.render(v, ("B",))
    assert output.read_bytes() == b"previous complete image"
    assert output.with_suffix(".sha256").read_text() == "previous stamp"
    assert not list(output.parent.glob(".thumbnail-*"))
