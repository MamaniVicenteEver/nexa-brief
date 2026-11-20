import json
from pathlib import Path

import pytest

from src.adapters.showcase.bootstrap import _definition
from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
from src.adapters.showcase.legacy_bundle_validation import assert_legacy_bundle_equivalent
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid

TEMPLATES = Path(__file__).resolve().parents[2] / "src/templates"
SHARED = TEMPLATES / "_tools/design-definitions"


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


@pytest.mark.parametrize("ident", ["vida-en-escena", "cara-a-cara", "atlas-cinematico", "atlas-en-movimiento"])
def test_original_known_bundle_matches_shared_metadata(tmp_path, monkeypatch, ident):
    monkeypatch.setattr("src.adapters.showcase.legacy_catalogs.atlas_cache_ready", lambda _: True)
    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=1)
    adapter.allow_legacy_repo = lambda: True
    manifest, catalog = _definition(adapter, ident)
    row = {"id": ident, "category": manifest["category"], "state": "produccion"}
    manifest["state"] = row["state"]
    bundle = tmp_path / "designs" / row["category"] / ident
    write(bundle / "design.json", manifest)
    write(bundle / "catalog.json", catalog)
    assert_legacy_bundle_equivalent(tmp_path, row, SHARED)
    first = next(entry for entry in catalog["entries"] if entry["preview_url"])
    first["preview_url"] = first["preview_url"].replace("/files/sandbox/", "/files/bundled/sandbox/", 1)
    write(bundle / "catalog.json", catalog)
    assert_legacy_bundle_equivalent(tmp_path, row, SHARED)


def test_semantic_override_and_unregistered_design_are_rejected_without_content(tmp_path):
    ident = "vida-en-escena"
    row = {"id": ident, "category": "nodeaction", "state": "prueba"}
    shared = SHARED / ident
    manifest = json.loads((shared / "design.json").read_text())
    manifest.pop("legacy_revisions", None)
    catalog = json.loads((shared / "catalog.json").read_text())
    bundle = tmp_path / "sandbox/designs" / row["category"] / ident
    write(bundle / "design.json", manifest)
    altered = dict(manifest, description="PRIVATE-CUSTOM-DESCRIPTION")
    write(bundle / "design.json", altered)
    write(bundle / "catalog.json", catalog)
    with pytest.raises(ShowcaseConflict, match=r"vida-en-escena.*description") as error:
        assert_legacy_bundle_equivalent(tmp_path, row, SHARED)
    assert "PRIVATE-CUSTOM-DESCRIPTION" not in str(error.value)
    write(bundle / "design.json", manifest)
    original_revision = manifest["revision"]
    manifest["revision"] = catalog["revision"] = "unknown-revision"
    write(bundle / "design.json", manifest)
    write(bundle / "catalog.json", catalog)
    with pytest.raises(ShowcaseConflict, match=r"vida-en-escena.*revision"):
        assert_legacy_bundle_equivalent(tmp_path, row, SHARED)
    manifest["revision"] = catalog["revision"] = original_revision
    write(bundle / "design.json", manifest)
    catalog["entries"][0]["params"]["sensitive_field"] = {"default": "PRIVATE-TEST-VALUE"}
    write(bundle / "catalog.json", catalog)
    with pytest.raises(ShowcaseConflict, match=r"vida-en-escena.*params") as error:
        assert_legacy_bundle_equivalent(tmp_path, row, SHARED)
    assert "PRIVATE-TEST-VALUE" not in str(error.value)
    with pytest.raises(ShowcaseConflict, match="falta bundle o definición"):
        assert_legacy_bundle_equivalent(
            tmp_path, {"id": "new-custom", "category": "nodeaction", "state": "prueba"}, SHARED
        )


def test_symlink_and_empty_catalog_are_rejected(tmp_path):
    ident = "vida-en-escena"
    row = {"id": ident, "category": "nodeaction", "state": "prueba"}
    bundle = tmp_path / "sandbox/designs/nodeaction" / ident
    bundle.mkdir(parents=True)
    (bundle / "design.json").symlink_to(SHARED / ident / "design.json")
    write(bundle / "catalog.json", {"design_id": ident, "schema_version": 1, "entries": []})
    with pytest.raises(ShowcaseInvalid):
        assert_legacy_bundle_equivalent(tmp_path, row, SHARED)
    (bundle / "design.json").unlink()
    manifest = json.loads((SHARED / ident / "design.json").read_text())
    manifest.pop("legacy_revisions", None)
    write(bundle / "design.json", manifest)
    write(
        bundle / "catalog.json",
        {"design_id": ident, "schema_version": 1, "revision": manifest["revision"], "entries": []},
    )
    with pytest.raises(ShowcaseConflict, match="catálogo vacío"):
        assert_legacy_bundle_equivalent(tmp_path, row, SHARED)
