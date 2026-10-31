"""Tests de lógica pura de las herramientas de la fábrica."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image

TOOL_DIR = Path(__file__).resolve().parent


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, TOOL_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


analyze_ref = _load("analyze_ref")
compare = _load("compare")
new_prototype = _load("new_prototype")


def test_parse_ffmpeg_scene_times_and_ignore_other_values():
    log = """
[Parsed_showinfo_1] n: 0 pts_time:0.000 fmt:yuv420p
[Parsed_showinfo_1] n: 1 pts_time:3.250 fmt:yuv420p
frame=10 time=00:00:09.00
[Parsed_showinfo_1] n: 2 pts_time:8.5 fmt:yuv420p
"""
    assert analyze_ref.parse_ffmpeg_scene_times(log) == [0.0, 3.25, 8.5]


def test_build_scenes_merges_nearby_changes_and_covers_duration():
    scenes = analyze_ref.build_scenes([0.05, 1.0, 1.1, 4.0, 9.95], 10.0, min_scene_seconds=0.4)
    assert scenes == [
        {"start": 0.0, "end": 1.0, "duration": 1.0},
        {"start": 1.0, "end": 4.0, "duration": 3.0},
        {"start": 4.0, "end": 10.0, "duration": 6.0},
    ]


def test_contact_sheet_is_a_grid_capped_at_2000_pixels():
    tiles = [(Image.new("RGB", (720, 1280), color), f"scene {index} · t={index}s") for index, color in enumerate(("red", "green", "blue", "white", "black", "yellow", "purple"))]
    sheet = analyze_ref.make_contact_sheet(tiles)
    assert sheet.width <= 2000
    assert sheet.height > 390


def test_auto_times_are_even_and_stay_inside_duration():
    times = compare.auto_times(81.9)
    assert len(times) == 6
    assert times == sorted(times)
    assert 0 < times[0] < times[-1] < 81.9
    short = compare.auto_times(2.0)
    assert len(short) == 3
    assert short[0] == 0.1 and short[-1] == 1.9


def test_new_prototype_validation_rejects_traversal_and_accepts_reference(tmp_path):
    root = tmp_path / "sandbox"
    ref = root / "referencias" / "nodehistory" / "mapas"
    ref.mkdir(parents=True)
    item, resolved_ref, engine = new_prototype.validate_new_prototype(
        "nodehistory", "prueba-nueva", "nodehistory/mapas", "nodehistory/_mapas", False, root
    )
    assert item == root / "nodehistory" / "prueba-nueva"
    assert resolved_ref == ref
    assert engine == "nodehistory/_mapas"

    try:
        new_prototype.validate_new_prototype(
            "nodehistory", "../escape", "nodehistory/mapas", "nodehistory/_mapas", False, root
        )
    except ValueError as error:
        assert "id" in str(error)
    else:
        raise AssertionError("se aceptó un id con traversal")

    try:
        new_prototype.validate_new_prototype(
            "nodehistory", "prueba-nueva", "../secreto", "nodehistory/_mapas", False, root
        )
    except ValueError:
        pass
    else:
        raise AssertionError("se aceptó una referencia fuera del sandbox")


def test_new_design_can_start_without_engine(tmp_path):
    root = tmp_path / "sandbox"
    (root / "referencias" / "nodehistory" / "mapas").mkdir(parents=True)
    _item, _ref, engine = new_prototype.validate_new_prototype(
        "nodehistory", "motor-nuevo", "nodehistory/mapas", None, True, root
    )
    assert engine == "nodehistory/motor-nuevo/_engine"
