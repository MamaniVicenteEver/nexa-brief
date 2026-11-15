"""Contrato de capas: mismos casos JSON que el validador del navegador."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil

from PIL import Image
import pytest

KIT = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit"
FIXTURES = KIT / "capas/tests/fixtures"
spec = importlib.util.spec_from_file_location("capas_tool", KIT / "tools/capas.py")
capas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capas)
CASES = json.loads((FIXTURES / "cases.json").read_text(encoding="utf-8"))


@pytest.fixture
def catalog():
    return capas.load_catalog(FIXTURES / "catalog.json")


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
def test_same_scene_fixtures_as_node(case, catalog):
    errors = capas.validate_scene(case["params"], catalog, case["duration"])
    assert (not errors) == case["valid"], errors


def test_catalog_fixture_checks_real_images_masks_alpha_anchors_hashes(catalog):
    assert capas.validate_catalog(catalog, FIXTURES) == []


def test_main_catalog_has_no_experimental_assets():
    catalog = capas.load_catalog()
    # La biblioteca de producción ya tiene assets; el fixture sigue aislado.
    assert all("fixture" not in asset["tags"] for asset in catalog["assets"])
    assert capas.validate_catalog(catalog) == []


@pytest.mark.parametrize("number", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_numbers_cannot_bypass_ranges(catalog, number):
    assert capas.validate_scene({"elenco": [], "fondo": {"grano": number}}, catalog, 6)
    catalog["assets"][0]["height_ref"] = number
    assert capas.validate_catalog(catalog, check_files=False)


@pytest.mark.parametrize("mutation", [
    lambda c: c.update(unknown=True),
    lambda c: c["assets"].append(copy.deepcopy(c["assets"][0])),
    lambda c: c["assets"][0].update(default_pose="no-existe"),
    lambda c: c["assets"][0]["poses"]["original"].update(file="../escape.png"),
    lambda c: c["assets"][0]["poses"]["original"].update(file="https://example.com/a.png"),
    lambda c: c["assets"][0]["poses"]["original"].update(file="/tmp/a.png"),
    lambda c: c["assets"][0]["poses"]["original"]["anchors"].update(cabeza=[0, 0]),
    lambda c: c["assets"][0]["poses"]["original"]["anchors"].update(cabeza=[1024, 0]),
    lambda c: c["assets"][0]["poses"]["original"]["anchors"].pop("cabeza"),
    lambda c: c["assets"][0]["poses"]["original"]["masks"].pop("corbata"),
    lambda c: c["assets"][0]["poses"]["original"].update(sha256="0"*64),
    lambda c: c["assets"][0].update(height_ref=2000),
    lambda c: c["assets"][0]["limits"].update(scale=[2, 1]),
    lambda c: c["assets"][0].update(pivot=[1024, 0]),
    lambda c: c.update(animations=[]),
])
def test_invalid_catalogs_are_errors(catalog, mutation):
    mutation(catalog)
    assert capas.validate_catalog(catalog, FIXTURES)


@pytest.mark.parametrize("kind", ["wrong-size", "no-alpha", "opaque-alpha", "empty-alpha", "color-mask", "empty-mask", "missing-mask"])
def test_catalog_rejects_broken_export_files(catalog, tmp_path, kind):
    shutil.copytree(FIXTURES / "assets", tmp_path / "assets")
    pose = catalog["assets"][0]["poses"]["original"]
    path = tmp_path / pose["file"]
    mask = tmp_path / pose["masks"]["corbata"]
    if kind == "wrong-size":
        Image.new("RGBA", (10, 10)).save(path)
    elif kind == "no-alpha":
        Image.new("RGB", (1024, 1536)).save(path)
    elif kind == "opaque-alpha":
        Image.new("RGBA", (1024, 1536), (0, 0, 0, 255)).save(path)
    elif kind == "empty-alpha":
        Image.new("RGBA", (1024, 1536)).save(path)
    elif kind == "color-mask":
        Image.new("RGB", (1024, 1536), "red").save(mask)
    elif kind == "empty-mask":
        Image.new("L", (1024, 1536)).save(mask)
    elif kind == "missing-mask":
        mask.unlink()
    assert capas.validate_catalog(catalog, tmp_path)


def test_catalog_rejects_symlink_escape(catalog, tmp_path):
    root = tmp_path / "library"
    root.mkdir()
    (root / "assets").symlink_to(FIXTURES / "assets", target_is_directory=True)
    errors = capas.validate_catalog(catalog, root)
    assert any("fuera de capas" in error for error in errors)


def test_ancla_has_six_pixel_tolerance():
    alpha = Image.new("L", (30, 30))
    alpha.putpixel((20, 15), 255)
    assert capas._opaque_near(alpha, 14, 15)
    assert not capas._opaque_near(alpha, 13, 15)
    assert not capas._opaque_near(alpha, 14, 14)


def test_scene_check_validates_each_capas_beat_without_touching_other_components(catalog):
    good = json.loads((FIXTURES / "beat.json").read_text(encoding="utf-8"))
    bad = copy.deepcopy(good)
    bad["params"]["elenco"][0]["asset"] = "no-existe"
    document = {"beats": [{"use": "other.component"}, good, bad]}
    errors = capas.scene_check(document, catalog)
    assert errors and all("beat #2 common.capas" in error for error in errors)
    assert not capas.scene_check(good, catalog)
    assert not capas.scene_check({"beats": [good]}, catalog)


def test_compact_list_filters_approved_assets_and_all_requested_tags(catalog):
    rows = capas.compact_list(catalog, ["fixture", "control"])
    assert [row["id"] for row in rows] == ["ejecutivo", "mano"]
    assert not capas.compact_list(catalog, ["fixture", "no-existe"])
    assert set(rows[0]) == {"id", "tipo", "poses", "anclas", "zonas", "animaciones", "uso"}


def test_sheet_has_all_poses_and_backgrounds_and_zones(catalog, tmp_path):
    target = capas.sheet(catalog["assets"][0], FIXTURES, tmp_path / "review.jpg")
    with Image.open(target) as image:
        assert image.size == (1500, 1024)
        assert image.mode == "RGB"


def test_export_reports_missing_gimp_console_clearly(catalog, monkeypatch):
    monkeypatch.setattr(capas.shutil, "which", lambda _: None)
    with pytest.raises(RuntimeError, match="No se encontró gimp-console"):
        capas.export_asset(catalog["assets"][0], catalog, FIXTURES / "catalog.json", FIXTURES)


def test_cli_validate_scene_list_and_export(capsys, monkeypatch):
    prefix = ["--catalog", str(FIXTURES / "catalog.json")]
    assert capas.main(prefix + ["validate"]) == 0
    assert capas.main(prefix + ["scene-check", str(FIXTURES / "beat.json")]) == 0
    capsys.readouterr()
    assert capas.main(prefix + ["list", "--tags", "fixture,control", "--json"]) == 0
    assert len(json.loads(capsys.readouterr().out)) == 2
    monkeypatch.setattr(capas.shutil, "which", lambda _: None)
    assert capas.main(prefix + ["export", "ejecutivo"]) == 1
    assert "gimp-console" in capsys.readouterr().err
