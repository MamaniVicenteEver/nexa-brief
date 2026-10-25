import json
from pathlib import Path

import pytest

from src.core.explainer.promote import (
    PromoteError,
    _rewrite_kit_paths,
    plan_promotion,
    promote,
    promotion_blocker,
)


def make_item(
    templates_dir: Path,
    *,
    status: str = "listo",
    manifest: bool = True,
    index: bool = True,
) -> Path:
    """Crea un video aislado dentro del sandbox temporal."""
    item_dir = templates_dir / "sandbox" / "nodehistory" / "demo"
    item_dir.mkdir(parents=True, exist_ok=True)
    if manifest:
        (item_dir / "manifest.json").write_text(
            json.dumps({"status": status}), encoding="utf-8"
        )
    if index:
        (item_dir / "index.html").write_text(
            '<script src="../../../_tools/explainer-kit/engine/loader.js"></script>',
            encoding="utf-8",
        )
    return item_dir


def test_plan_promotion_accepts_ready_video(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = make_item(templates_dir)

    plan = plan_promotion(item_dir, templates_dir=templates_dir)

    assert plan.source == item_dir
    assert plan.destination == templates_dir / "nodehistory" / "demo"
    assert item_dir.exists()
    assert promotion_blocker(item_dir, templates_dir=templates_dir) is None


def test_not_ready_video_has_blocker_message(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = make_item(templates_dir, status="borrador")

    with pytest.raises(PromoteError) as error:
        plan_promotion(item_dir, templates_dir=templates_dir)

    assert error.value.code == "not_ready"
    assert error.value.message == "Estado «borrador»: faltan pasos (kit.py status demo)"
    assert promotion_blocker(item_dir, templates_dir=templates_dir) == error.value.message


def test_force_allows_not_ready_video(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = make_item(templates_dir, status="borrador")

    plan = promote(item_dir, force=True, templates_dir=templates_dir)

    assert plan.destination == templates_dir / "nodehistory" / "demo"
    assert plan.destination.is_dir()
    assert not item_dir.exists()


def test_existing_destination_is_rejected(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = make_item(templates_dir)
    destination = templates_dir / "nodehistory" / "demo"
    destination.mkdir(parents=True)

    with pytest.raises(PromoteError) as error:
        plan_promotion(item_dir, templates_dir=templates_dir)

    assert error.value.code == "destination_exists"
    assert error.value.message == "Ya existe nodehistory/demo en producción"


def test_manifestless_video_is_unsupported(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = make_item(templates_dir, manifest=False)

    with pytest.raises(PromoteError) as error:
        plan_promotion(item_dir, templates_dir=templates_dir)

    assert error.value.code == "unsupported"
    assert error.value.message == "Solo se pueden pasar videos del explainer-kit"


def test_production_video_is_not_in_sandbox(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = templates_dir / "nodehistory" / "demo"
    item_dir.mkdir(parents=True)

    with pytest.raises(PromoteError) as error:
        plan_promotion(item_dir, templates_dir=templates_dir)

    assert error.value.code == "not_sandbox"
    assert error.value.message == "demo ya está en producción"


def test_missing_video_reports_relative_path(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = templates_dir / "sandbox" / "nodehistory" / "missing"

    with pytest.raises(PromoteError) as error:
        plan_promotion(item_dir, templates_dir=templates_dir)

    assert error.value.code == "not_found"
    assert error.value.message == "No existe sandbox/nodehistory/missing"


def test_rewrite_kit_paths_updates_loader_and_vendor_assets(tmp_path: Path) -> None:
    destination = tmp_path / "templates" / "nodehistory" / "demo"
    html = (
        '<script src="../../../_tools/explainer-kit/engine/loader.js"></script>'
        '<script src="../../../_tools/explainer-kit/vendor/geo/d3-geo.min.js"></script>'
    )

    rewritten = _rewrite_kit_paths(html, destination)

    assert 'src="../../_tools/explainer-kit/engine/loader.js"' in rewritten
    assert 'src="../../_tools/explainer-kit/vendor/geo/d3-geo.min.js"' in rewritten


def test_promote_moves_video_and_loader_resolves_from_destination(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    item_dir = make_item(templates_dir)
    loader = templates_dir / "_tools" / "explainer-kit" / "engine" / "loader.js"
    loader.parent.mkdir(parents=True)
    loader.write_text("// loader", encoding="utf-8")

    plan = promote(item_dir, templates_dir=templates_dir)
    html = (plan.destination / "index.html").read_text(encoding="utf-8")
    loader_url = html.split('src="', maxsplit=1)[1].split('"', maxsplit=1)[0]

    assert not item_dir.exists()
    assert plan.destination.is_dir()
    assert (plan.destination / loader_url).resolve() == loader.resolve()
