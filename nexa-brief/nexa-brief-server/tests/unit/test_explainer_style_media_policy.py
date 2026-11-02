"""Imperio: validate the visible windows, including nested campaign archives."""
from pathlib import Path

from src.core.explainer import producer


TOOLS = Path(producer.KIT_DIR) / "tools"
CATALOG = {
    "imperio.archive": {"params": {"src": {"type": "image"}}},
    "imperio.map": {"params": {"flag": {"type": "image"}}},
    "imperio.footage": {"params": {"video": {"type": "video"}}},
    "imperio.campaign": {"params": {"v1": {"type": "video"}, "p1": {"type": "image"}}},
}


def beat(i, start, duration, use="imperio.archive", params=None, **extra):
    return {"i": i, "t0": start, "t1": start + duration, "layer": "main", "use": use,
            "b": {"params": {"src": "photo.jpg"} if params is None else params}, **extra}


def run(monkeypatch, beats, **config):
    monkeypatch.syspath_prepend(str(TOOLS))
    import style_media_policy
    errors = []
    words = [{"t": "Manchuria", "s": 22}, {"t": "China", "s": 40}]
    report = style_media_policy.check({"design": "imperio", **config}, beats, CATALOG, words, 120, errors)
    return report, errors


def test_style_is_scoped_and_boundaries_are_inclusive(monkeypatch):
    entries = [beat(0, 0, 6), beat(1, 6, 12),
               beat(2, 18, 8, "imperio.footage", {"video": "one.mp4"}),
               beat(3, 26, 16, "imperio.footage", {"video": "two.mp4"})]
    report, errors = run(monkeypatch, entries)
    assert not errors
    assert [w["duration"] for w in report["media"]] == [6, 12, 8, 16]
    report, errors = run(monkeypatch, [beat(0, 0, 2)], design="rough")
    assert report is None and not errors


def test_declared_duration_is_cut_by_next_main_not_overlay(monkeypatch):
    first = beat(0, 0, 12)
    overlay = beat(1, 2, 1, "imperio.word", {}, layer="overlay")
    following = beat(2, 3, 5, "imperio.map", {"flag": "flag.png"})
    report, errors = run(monkeypatch, [first, overlay, following])
    assert len(report["media"]) == 1  # maps and flag images are graphics
    assert report["media"][0]["duration"] == 3
    assert any("3.00s" in error for error in errors)
    report, errors = run(monkeypatch, [first, overlay])
    assert not errors and report["media"][0]["duration"] == 12


def test_photo_delay_and_outro_limit_real_window(monkeypatch):
    report, errors = run(monkeypatch, [beat(0, 5, 12, params={"src": "photo.jpg", "photoAt": 2})],
                         outro={"start": 11})
    assert report["media"][0]["start"] == 7
    assert report["media"][0]["duration"] == 4
    assert errors


def test_nested_plate_aliases_and_anchors_are_not_whole_parent(monkeypatch):
    plates = [{"video": "v1", "at": "@Manchuria-0.6", "dur": 8},
              {"image": "p1", "at": "@China+1", "dur": 7}]
    campaign = beat(0, 10, 70, "imperio.campaign", {"v1": "clip.mp4", "p1": "photo.jpg", "plates": plates})
    report, errors = run(monkeypatch, [campaign])
    assert not errors
    assert [w["start"] for w in report["media"]] == [21.4, 41]
    assert [w["duration"] for w in report["media"]] == [8, 7]
    assert [w["kind"] for w in report["media"]] == ["video", "photo"]


def test_nested_plate_is_clipped_by_parent_and_reports_bad_anchors(monkeypatch):
    campaign = beat(0, 10, 16, "imperio.campaign", {"v1": "clip.mp4", "plates": [
        {"video": "v1", "at": "@Manchuria", "dur": 8},
        {"video": "v1", "at": "@inexistente", "dur": 8}]})
    report, errors = run(monkeypatch, [campaign])
    assert report["media"][0]["duration"] == 4
    assert any("4.00s" in error for error in errors)
    assert any("resoluble" in error for error in errors)


def test_numeric_nested_time_is_local_and_overlaps_are_explicit(monkeypatch):
    campaign = beat(0, 10, 70, "imperio.campaign", {"v1": "clip.mp4", "plates": [
        {"video": "v1", "at": 2, "dur": 10}, {"video": "v1", "at": 8, "dur": 8}]})
    report, errors = run(monkeypatch, [campaign])
    assert report["media"][0]["start"] == 12
    assert any("solapan" in error for error in errors)
