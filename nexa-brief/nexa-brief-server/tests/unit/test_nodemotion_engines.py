"""The shared engine must preserve original browser programs byte for byte."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.templates._tools.nodemotion.shared import assemble as engines


DESIGNS = engines.design_ids()


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@pytest.mark.parametrize("design_id", DESIGNS)
def test_every_document_is_byte_exact_to_the_migration_baseline(design_id):
    manifest = engines.design_manifest(design_id)
    document = engines.assemble(design_id)
    assert _sha(document) == manifest["migration_source_sha256"]
    assert _sha(document) == manifest["source_sha256"]
    assert b"nodemotion-fragment:" not in document
    # La entrada conserva datos de demo, sin otra implementación editable.
    entry = (engines.demo_folder(design_id) / "index.html").read_bytes()
    assert f'<meta name="nodemotion-design" content="{design_id}">'.encode() in entry
    assert len(entry) < 1024
    assert f'/api/v1/templates/{design_id}/source'.encode() in entry


@pytest.mark.parametrize("design_id", DESIGNS)
def test_runtime_aliases_preserve_original_bytes_and_remove_duplicate_sources(design_id):
    manifest = engines.design_manifest(design_id)
    runtime = engines.runtime_assets(design_id)
    assert runtime.keys() == manifest["migration_runtime_sha256"].keys()
    for relative, canonical in runtime.items():
        assert _sha(canonical.read_bytes()) == manifest["migration_runtime_sha256"][relative]
        assert engines.resolve_runtime_asset(design_id, "./" + relative) == canonical
        assert engines.runtime_files(design_id)[relative] == canonical
        assert not (engines.demo_folder(design_id) / relative).exists()


def test_registry_covers_all_registered_lyrics_and_promos_without_changing_categories():
    templates = json.loads((engines.TEMPLATES / "templates.json").read_text())["templates"]
    expected = {key for key, value in templates.items()
                if value.get("folder", "").startswith(("nodemotion/lyrics/", "nodemotion/commercial/"))}
    assert set(DESIGNS) == expected
    assert not engines.registered("../lyrics-neon")
    assert not engines.registered("unknown-design")
    assert not engines.registered(None)
    for design_id in DESIGNS:
        catalog = engines.catalog(design_id)
        assert catalog["inputs"] == templates[design_id].get("inputs", {})
        assert catalog["config_json"] == templates[design_id].get("config_json")
        assert (engines._design_root(design_id) / "contract.json").is_file()
        assert (engines._design_root(design_id) / "QUICK.md").is_file()


@pytest.mark.parametrize("relative", ["../templates.json", "/etc/passwd", "components/../../x", "x\\y", "\x00"])
def test_resolver_rejects_escaping_relative_paths(relative):
    assert engines.resolve_runtime_asset("lyrics-neon", relative) is None


def test_legacy_spanish_urls_resolve_to_english_files():
    assert engines.resolve_runtime_asset("lyrics-trazo", "components/escenas.js").name == "scenes.js"
    assert engines.resolve_runtime_asset("lyrics-trazo", "components/transiciones.js").name == "transitions.js"
    assert engines.resolve_runtime_asset("lyrics-trazo", "components/garabatos.js").name == "scribbles.js"
    assert engines.resolve_runtime_asset("lyrics-decadas", "components/decadas.css").name == "decades.css"
    assert engines.resolve_runtime_asset("lyrics-grunge-rojo", "components/fondo.js").name == "background.js"
    assert engines.resolve_runtime_asset("promo-breaking", "galeria.html").name == "gallery.html"


def _fixture_engine(monkeypatch, tmp_path: Path, html: bytes):
    root = tmp_path / "templates" / "_tools" / "nodemotion"
    design = root / "lyrics" / "designs" / "lyrics-test"
    demo = tmp_path / "templates" / "nodemotion" / "lyrics" / "lyrics-test"
    design.mkdir(parents=True)
    demo.mkdir(parents=True)
    (demo / "index.html").write_bytes(b"thin-entry")
    document, fragments, files = engines.split_document(html)
    for relative, body in files.items():
        path = design / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    (design / "document.html").write_bytes(document)
    (design / "runtime").mkdir()
    (design / "runtime" / "scenes.js").write_bytes(b"window.example = 1;\r\n")
    manifest = {"schema_version": 1, "design_id": "lyrics-test", "family": "lyrics",
                "document": "document.html", "demo_folder": "nodemotion/lyrics/lyrics-test",
                "fragments": fragments, "runtime_aliases": {"components/escenas.js": "runtime/scenes.js"},
                "runtime_assets": ["assets/media"], "source_sha256": _sha(html),
                "migration_source_sha256": _sha(html)}
    (design / "manifest.json").write_text(json.dumps(manifest))
    monkeypatch.setattr(engines, "ROOT", root)
    monkeypatch.setattr(engines, "TEMPLATES", tmp_path / "templates")
    return design, demo


def test_compiler_updates_shared_engine_and_preserves_scope_order_and_entry(monkeypatch, tmp_path):
    original = (b'<!doctype html>\r\n<script data-nb-hf-clock="1">clock();\r\n</script>'
                b'<style media="screen">a { color: red; }\r\n</style>'
                b'<script src="./components/escenas.js"></script>'
                b'<script type="module">const x = 1;\nawait boot(x);</script>\r\n'
                b'<script>after();</script>')
    design, demo = _fixture_engine(monkeypatch, tmp_path, original)
    assert engines.assemble("lyrics-test") == original
    first_revision = engines.engine_revision("lyrics-test")
    changed = original.replace(b"color: red", b"color: blue")
    engines.update_engine("lyrics-test", changed)
    assert engines.assemble("lyrics-test") == changed
    assert (demo / "index.html").read_bytes() == b"thin-entry"
    assert engines.engine_revision("lyrics-test") != first_revision
    assert engines.design_manifest("lyrics-test")["migration_source_sha256"] == _sha(original)
    # Cambiar una dependencia externa invalida también la revisión de grabación.
    revision = engines.engine_revision("lyrics-test")
    (design / "runtime" / "scenes.js").write_bytes(b"window.example = 2;\r\n")
    assert engines.engine_revision("lyrics-test") != revision
    engines.update_engine("lyrics-test", b"<html><body>No inline scripts</body></html>")
    assert engines.assemble("lyrics-test") == b"<html><body>No inline scripts</body></html>"
    assert not list((design / "scripts").glob("*.js"))
    assert not list((design / "styles").glob("*.css"))


def test_broken_manifest_cannot_silently_drop_a_program(monkeypatch, tmp_path):
    design, _ = _fixture_engine(monkeypatch, tmp_path, b"<script>boot();</script>")
    (design / "document.html").write_bytes(b"<html></html>")
    with pytest.raises(ValueError, match="Invalid fragment marker"):
        engines.assemble("lyrics-test")


def test_runtime_enumeration_and_symlinks_stay_inside_demo(monkeypatch, tmp_path):
    _, demo = _fixture_engine(monkeypatch, tmp_path, b"<script>boot();</script>")
    media = demo / "assets" / "media"
    media.mkdir(parents=True)
    (media / "clip.mp4").write_bytes(b"media-data")
    outside = tmp_path / "private.json"
    outside.write_text("private")
    (media / "escape.json").symlink_to(outside)
    files = engines.runtime_files("lyrics-test")
    assert files["assets/media/clip.mp4"].read_bytes() == b"media-data"
    assert "components/escenas.js" in files
    assert "assets/media/escape.json" not in files
    assert engines.resolve_runtime_asset("lyrics-test", "assets/media/escape.json") is None


def test_pinned_revision_survives_canonical_compiler_update(monkeypatch, tmp_path):
    original = b'<script src="components/escenas.js"></script><script>old();</script>'
    design, _ = _fixture_engine(monkeypatch, tmp_path, original)
    pinned = engines.engine_revision("lyrics-test")
    engines.update_engine("lyrics-test", b"<script>newVersion();</script>")
    assert engines.available_revision("lyrics-test", pinned)
    assert engines.assemble("lyrics-test", pinned) == original
    assert engines.assemble("lyrics-test") == b"<script>newVersion();</script>"
    path = engines.resolve_runtime_asset("lyrics-test", "components/escenas.js", pinned)
    assert path.read_bytes() == b"window.example = 1;\r\n"
    (design / "runtime" / "scenes.js").write_bytes(b"new-runtime")
    assert engines.resolve_runtime_asset("lyrics-test", "components/escenas.js", pinned).read_bytes() == b"window.example = 1;\r\n"


def test_prepared_snapshot_archive_is_exact_deduplicated_and_immutable(monkeypatch, tmp_path):
    canonical = b"<script>canonical();</script>"
    design, _ = _fixture_engine(monkeypatch, tmp_path, canonical)
    custom = b'<script src="components/escenas.js"></script>\r\n<script type="module">oldEpisode();</script>'
    code = {"components/escenas.js": b"const historicalRuntime = true;\r\n"}
    first = engines.archive_engine("lyrics-test", custom, code)
    assert engines.archive_engine("lyrics-test", custom, code) == first
    assert engines.available_revision("lyrics-test", first)
    assert engines.engine_revision("lyrics-test", first) == first
    assert engines.assemble("lyrics-test", first) == custom
    assert engines.assemble("lyrics-test") == canonical
    assert len(list((design / "revisions").iterdir())) == 1
    assert engines.runtime_assets("lyrics-test", first)["components/escenas.js"].name == "scenes.js"
    second = engines.archive_engine("lyrics-test", custom, {"components/escenas.js": b"different();"})
    assert first != second
    # Las revisiones se verifican al leerlas; una corrupción no cae a la actual.
    engines.runtime_assets("lyrics-test", first)["components/escenas.js"].write_bytes(b"corrupt")
    assert not engines.available_revision("lyrics-test", first)
    with pytest.raises(ValueError, match="Corrupt"):
        engines.assemble("lyrics-test", first)
    assert not engines.available_revision("lyrics-test", "../invalid")
    assert not engines.available_revision("lyrics-test", "f" * 64)


@pytest.mark.parametrize("relative", ["../private.js", "/private.js", "config.json", "assets/song.mp3", "index.html"])
def test_archive_accepts_only_safe_runtime_code(monkeypatch, tmp_path, relative):
    _fixture_engine(monkeypatch, tmp_path, b"<script>canonical();</script>")
    with pytest.raises(ValueError):
        engines.archive_engine("lyrics-test", b"<script>old();</script>", {relative: b"data"})


def test_component_catalog_prefers_rich_showcase_parameters():
    source = json.loads((engines.demo_folder("lyrics-trazo") / "showcase/components.json").read_text())
    original = next(item for item in source["components"] if item["name"] == "trazo.palabra")
    contract = engines.component_contract("lyrics-trazo", "trazo.palabra")
    assert contract["params"] == original["params"]
    assert contract["component"] == original
    assert contract["constraints_status"] == "documented"
    assert "trazo.palabra" in {item["entry_id"] for item in engines.catalog("lyrics-trazo")["entries"]}


def test_promo_contract_retains_per_variant_limits_and_known_scene_options():
    path = engines.ROOT / "promo/production/templates/promo-breaking.json"
    source = json.loads(path.read_text())
    original = [scene for scene in source["default_scenes"] if scene["type"] == "word"]
    contract = engines.component_contract("promo-breaking", "scene.word")
    assert contract["variants"] == original
    assert contract["scene_cycle"] == [scene for scene in source["scene_cycle"] if scene["type"] == "word"]
    assert contract["notes"]["max_text_lines_note"] == source["max_text_lines_note"]
    assert contract["constraints_status"] == "documented_per_variant"


def test_legacy_contract_exposes_actual_defaults_with_explicit_unknown_bounds():
    source = json.loads((engines.demo_folder("lyrics-neon") / "assets/config.json").read_text())["configs"][0]
    contract = engines.component_contract("lyrics-neon", "config.intro")
    assert contract["example"] == source["intro"]
    assert contract["params"] == {key: {"default": value} for key, value in source["intro"].items()}
    assert contract["constraints_status"] == "observed_defaults_only"
    assert "validation bounds" in contract["unknown"]
    with pytest.raises(KeyError):
        engines.component_contract("lyrics-neon", "invented-component")


@pytest.mark.parametrize("design_id", DESIGNS)
def test_derived_catalog_files_match_live_discovery_and_cited_metadata(design_id):
    catalog = engines.catalog(design_id)
    root = engines._design_root(design_id)
    assert json.loads((root / "catalog.json").read_text()) == catalog
    assert catalog["entries"]
    for entry in catalog["entries"]:
        contract = engines.component_contract(design_id, entry["entry_id"])
        assert json.loads((root / entry["contract"]).read_text()) == contract
        for source in contract["sources"]:
            value = json.loads((engines.TEMPLATES / source["path"]).read_text())
            for part in source["pointer"].split("/")[1:]:
                part = part.replace("~1", "/").replace("~0", "~")
                value = value[int(part)] if isinstance(value, list) else value[part]
            assert value is not None


def test_freezing_stable_execution_uses_immutable_paths_after_direct_edits(monkeypatch, tmp_path):
    original = b'<script src="components/escenas.js"></script><script>original();</script>'
    design, _ = _fixture_engine(monkeypatch, tmp_path, original)
    selected = engines.freeze_engine("lyrics-test")
    old_runtime = engines.runtime_assets("lyrics-test", selected)["components/escenas.js"]
    assert "revisions" in old_runtime.parts
    (design / "runtime/scenes.js").write_bytes(b"new external code")
    assert engines.available_revision("lyrics-test", selected)
    assert old_runtime.read_bytes() == b"window.example = 1;\r\n"
    assert engines.assemble("lyrics-test", selected) == original
    newest = engines.freeze_engine("lyrics-test")
    assert newest != selected
    assert engines.runtime_assets("lyrics-test", newest)["components/escenas.js"].read_bytes() == b"new external code"
    assert engines.freeze_engine("lyrics-test", selected) == selected


def test_freeze_retries_direct_edit_without_publishing_mixed_snapshot(monkeypatch, tmp_path):
    design, _ = _fixture_engine(monkeypatch, tmp_path, b"<script>original();</script>")
    original = engines.runtime_assets
    calls = 0
    def edit_during_capture(design_id, revision=None):
        nonlocal calls
        calls += 1
        if calls == 1:
            (design / "runtime/scenes.js").write_bytes(b"new runtime")
        return original(design_id, revision)
    monkeypatch.setattr(engines, "runtime_assets", edit_during_capture)
    revision = engines.freeze_engine("lyrics-test")
    assert calls == 2
    assert engines.runtime_assets("lyrics-test", revision)["components/escenas.js"].read_bytes() == b"new runtime"
    assert len(list((design / "revisions").iterdir())) == 1


def test_freeze_fails_closed_under_continuous_direct_edits(monkeypatch, tmp_path):
    design, _ = _fixture_engine(monkeypatch, tmp_path, b"<script>original();</script>")
    original = engines.runtime_assets
    calls = 0
    def edit_during_every_capture(design_id, revision=None):
        nonlocal calls
        calls += 1
        (design / "runtime/scenes.js").write_bytes(f"runtime{calls}".encode())
        return original(design_id, revision)
    monkeypatch.setattr(engines, "runtime_assets", edit_during_every_capture)
    with pytest.raises(ValueError, match="changed while freezing"):
        engines.freeze_engine("lyrics-test")
    assert calls == 3
    assert not (design / "revisions").exists()


def test_failed_archive_never_publishes_an_incomplete_revision(monkeypatch, tmp_path):
    design, _ = _fixture_engine(monkeypatch, tmp_path, b"<script>original();</script>")
    original = Path.write_bytes
    def fail_staging_write(path, data):
        if any(part.startswith(".archive-") for part in path.parts):
            raise OSError("simulated disk quota")
        return original(path, data)
    monkeypatch.setattr(Path, "write_bytes", fail_staging_write)
    with pytest.raises(OSError, match="quota"):
        engines.archive_engine("lyrics-test", b"<script>archived();</script>")
    assert not list((design / "revisions").iterdir())
    assert engines.assemble("lyrics-test") == b"<script>original();</script>"


def test_real_pinned_project_survives_direct_external_engine_edit(monkeypatch, tmp_path):
    from src.core.nodemotion.shared import execution, resources
    design, _ = _fixture_engine(monkeypatch, tmp_path, b'<script src="components/escenas.js"></script>')
    audio = tmp_path / "library.mp3"
    audio.write_bytes(b"audio")
    monkeypatch.setattr(resources, "_asset", lambda kind, asset_id: audio)
    root = tmp_path / "project"
    project = execution.create_project(root, "lyrics-test", {"song.mp3": resources.asset_ref("music", "one")},
                                       policy="pinned", content_prefix="", timeline={"segments": []})
    revision = project["engine"]["revision"]
    assert "revisions" in engines.runtime_assets("lyrics-test", revision)["components/escenas.js"].parts
    (design / "runtime/scenes.js").write_bytes(b"new code")
    assert execution.resolve_project(root, "components/escenas.js").read_bytes() == b"window.example = 1;\r\n"


@pytest.mark.parametrize("suffix", [".woff", ".woff2", ".ttf", ".otf", ".svg"])
def test_archives_preserve_runtime_font_and_vector_support_bytes(monkeypatch, tmp_path, suffix):
    _fixture_engine(monkeypatch, tmp_path, b"<script>canonical();</script>")
    content = b"exact-runtime-support-asset\x00\xff\r\n"
    relative = "assets/fonts/runtime" + suffix
    revision = engines.archive_engine("lyrics-test", b"<script>old();</script>", {relative: content})
    assert engines.available_revision("lyrics-test", revision)
    assert engines.runtime_assets("lyrics-test", revision)[relative].read_bytes() == content
