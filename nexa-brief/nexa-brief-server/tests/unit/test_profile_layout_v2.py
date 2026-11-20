"""Profile layout and CLI behavior with synthetic, isolated temporary directories."""
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
from types import SimpleNamespace

import pytest

from src.config.profile_layout import layout_for_settings, resolve_profile_layout
from src.config.storage_profile import apply_profile, load_profile

PROJECT = Path(__file__).resolve().parents[3]
SCRIPT = PROJECT / "scripts/storage-profile.py"
CATEGORIES = {"nodetech", "nodehistory", "nodepolitics", "nodeeconomy", "nodeaction", "nodemotion", "otros"}


def cli(tmp_path, *arguments):
    env = {**os.environ, "XDG_CONFIG_HOME": str(tmp_path / "xdg"), "NEXA_PROFILE_DIR": ""}
    version = [] if "--schema-version" in arguments else ["--schema-version", "2"]
    return subprocess.run([sys.executable, str(SCRIPT), *arguments, *version, "--home", str(tmp_path)],
                          env=env, text=True, capture_output=True)


def test_pure_layout_and_profile_versions_are_isolated(tmp_path):
    first, second = tmp_path / "first", tmp_path / "second"
    old = resolve_profile_layout(first, 1)
    new = resolve_profile_layout(second, 2)
    assert old.data_dir == first / "data"
    assert old.renders_dir == first / "output"
    assert old.connections_dir == first / "connections"
    assert new.renders_dir == second / "renders"
    assert new.resources_dir == second / "resources"
    assert new.runtime_dir == second / ".system/runtime"
    assert new.cache_dir == second / ".system/cache"
    assert new.connections_dir == second / ".system/connections"
    assert old.designs_dir == first / "designs" and new.designs_dir == second / "designs"
    assert not first.exists() and not second.exists()
    with pytest.raises(ValueError):
        resolve_profile_layout(Path("relative"), 2)
    with pytest.raises(ValueError):
        resolve_profile_layout(first, 4)
    fallback = layout_for_settings(SimpleNamespace(storage_profile_dir=None, data_dir=first / "custom",
                                                  output_dir=first / "out"))
    assert fallback.schema_version == 1 and fallback.data_dir == first / "custom"
    assert fallback.renders_dir == first / "out"


def test_init_scaffold_is_empty_and_never_overwrites(tmp_path):
    result = cli(tmp_path, "init", "alpha")
    assert result.returncode == 0, result.stderr
    root = tmp_path / "profiles/alpha"
    manifest = load_profile(root)
    assert manifest["schema_version"] == 2
    layout = resolve_profile_layout(root, 2)
    for folder in (layout.data_dir, layout.logs_dir, layout.renders_dir,
                   layout.resources_dir, layout.runtime_dir, layout.cache_dir, layout.connections_dir,
                   layout.tiktok_dir, layout.web_data_dir):
        assert folder.is_dir() and list(folder.iterdir()) == []
    assert {p.name for p in layout.sandbox_dir.iterdir() if p.is_dir()} == CATEGORIES | {"referencias", "designs"}
    for where in (layout.designs_dir, layout.sandbox_dir / "designs"):
        assert {p.name for p in where.iterdir()} == {"AGENTS.md", "CLAUDE.md"}
        assert "No dupliques ni muevas los episodios" in (where / "AGENTS.md").read_text()
    for category in CATEGORIES:
        assert {p.name for p in (layout.sandbox_dir / category).iterdir()} == {"AGENTS.md", "CLAUDE.md"}
        assert {p.name for p in (layout.productions_dir / category).iterdir()} == {"AGENTS.md", "CLAUDE.md"}
        assert list((layout.sandbox_dir / "referencias" / category).iterdir()) == []
    assert all((where / name).is_file() for where in (root, layout.sandbox_dir, layout.productions_dir) for name in ("AGENTS.md", "CLAUDE.md"))
    assert {p.name for p in (layout.productions_dir / "nodeatlas").iterdir()} == {"AGENTS.md", "CLAUDE.md"}
    for name in ("AGENTS.md", "CLAUDE.md"):
        root_guide = (root / name).read_text()
        assert "No abras `data/` ni `.system/`" in root_guide
        assert "protección efectiva requiere aislamiento" in root_guide
        assert "PLAN.md" in root_guide
        production_guide = (layout.productions_dir / "nodeatlas" / name).read_text()
        assert "ID estable" in production_guide and "work/results/test/" in production_guide
        assert "renders/<video_id>/<recording_id>/" in production_guide
        assert "No modifiques los motores" in (layout.sandbox_dir / "nodehistory" / name).read_text()
    assert (layout.config_dir / "niches.json").is_file()
    assert list((layout.config_dir / "image-styles").glob("*.json"))
    assert stat.S_IMODE(root.stat().st_mode) == 0o700
    assert stat.S_IMODE(layout.system_dir.stat().st_mode) == 0o700
    assert stat.S_IMODE(layout.web_data_dir.stat().st_mode) == 0o2770
    marker = layout.data_dir / "example.json"
    marker.write_text('{"synthetic": true}')
    assert cli(tmp_path, "init", "alpha").returncode != 0
    assert marker.read_text() == '{"synthetic": true}'
    assert cli(tmp_path, "init", "beta").returncode == 0
    assert not (tmp_path / "profiles/beta/data/example.json").exists()
    assert not list((tmp_path / "profiles").glob(".profile-init-*"))
    values = apply_profile({"NEXA_PROFILE_DIR": str(root)})
    assert values["storage_layout_version"] == 2
    assert values["output_dir"] == layout.renders_dir
    assert values["SHARED_CONNECTIONS_DIR"] == layout.connections_dir
    from src.config.settings import Settings
    configured = Settings(_env_file=None, NEXA_PROFILE_DIR=str(root))
    assert configured.storage_layout_version == 2
    assert configured.output_dir == layout.renders_dir
    assert layout_for_settings(configured) == layout
    assert cli(tmp_path, "show", "alpha").returncode == 0
    assert cli(tmp_path, "activate", "alpha").returncode == 0
    selector = json.loads((tmp_path / "xdg/nexa-brief/storage-profile.json").read_text())
    assert selector == {"profile_dir": str(root)}


def test_legacy_profile_selection_does_not_migrate(tmp_path):
    root = tmp_path / "legacy"
    root.mkdir()
    (root / "profile.json").write_text(json.dumps({"schema_version": 1, "id": "legacy"}))
    values = apply_profile({"NEXA_PROFILE_DIR": str(root)})
    assert values["storage_layout_version"] == 1
    assert values["output_dir"] == root / "output"
    assert values["SHARED_CONNECTIONS_DIR"] == root / "connections"
    assert not (root / ".system").exists()


def test_cli_can_create_legacy_profile_without_migration(tmp_path):
    result = cli(tmp_path, "init", "legacy", "--schema-version", "1")
    assert result.returncode == 0, result.stderr
    root = tmp_path / "profiles/legacy"
    assert load_profile(root)["schema_version"] == 1
    assert (root / "output").is_dir() and (root / "connections").is_dir()
    assert not (root / ".system").exists()
    assert cli(tmp_path, "show", "legacy").returncode == 0
    assert cli(tmp_path, "activate", "legacy").returncode == 0


def test_simultaneous_init_does_not_replace_profile(tmp_path):
    env = {**os.environ, "XDG_CONFIG_HOME": str(tmp_path / "xdg"), "NEXA_PROFILE_DIR": ""}
    command = [sys.executable, str(SCRIPT), "init", "race", "--schema-version", "2", "--home", str(tmp_path)]
    children = [subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                for _ in range(2)]
    for child in children:
        child.communicate(timeout=10)
    assert sorted(child.returncode for child in children) == [0, 1]
    assert load_profile(tmp_path / "profiles/race")["schema_version"] == 2
    assert not list((tmp_path / "profiles").glob(".profile-init-*"))


def test_new_profile_loads_product_categories_and_designs(tmp_path, monkeypatch):
    from src.core import categories

    assert cli(tmp_path, "init", "alpha").returncode == 0
    tree = categories.load_categories(tmp_path / "profiles/alpha/config/niches.json")
    assert tree
    monkeypatch.setattr(categories, "list_categories", lambda: tree)
    with_designs = [(key, categories.designs_for_category(key, ["fallback"])[0]) for key in tree]
    assert any(designs for _, designs in with_designs)


def test_explicit_empty_profile_disables_selector(tmp_path, monkeypatch):
    from src.config.settings import Settings
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    configured = Settings(_env_file=None, NEXA_PROFILE_DIR="")
    assert configured.storage_profile_dir is None
    assert layout_for_settings(configured).schema_version == 1


def test_uninstalled_user_provider_fails_closed(tmp_path):
    root = tmp_path / "profile"
    root.mkdir()
    (root / "profile.json").write_text(json.dumps({"schema_version": 2, "id": "test",
                                                    "providers": {"users": "supabase"}}))
    with pytest.raises(ValueError, match="not installed"):
        load_profile(root)
    with pytest.raises(ValueError, match="not installed"):
        apply_profile({"NEXA_PROFILE_DIR": str(root)})


def test_product_category_folders_are_safe(tmp_path, monkeypatch):
    import importlib.util
    spec = importlib.util.spec_from_file_location("profile_script_test", SCRIPT)
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    monkeypatch.setattr(script, "SERVER", tmp_path)
    (tmp_path / "niches.json").write_text(json.dumps({"categories": {"x": {"folder": "../escape"}}}))
    with pytest.raises(ValueError, match="folder"):
        script.production_categories()
    (tmp_path / "niches.json").write_text(json.dumps({"categories": {"x": {"children": {"y": {"folder": "newfolder"}}}}}))
    assert "newfolder" in script.production_categories()


def test_profile_symlink_with_container_aliases_resolves_to_same_layout(tmp_path):
    from src.config.settings import Settings
    root = tmp_path / "real"
    root.mkdir()
    (root / "profile.json").write_text(json.dumps({"schema_version": 2, "id": "test"}))
    alias = tmp_path / "mounted"
    alias.symlink_to(root, target_is_directory=True)
    configured = Settings(_env_file=None, NEXA_PROFILE_DIR=str(alias), DATA_DIR="/app/data",
                          OUTPUT_DIR="/app/output", SHARED_CONNECTIONS_DIR="/app/accounts",
                          ACCOUNTS_JSON_PATH="/app/accounts/accounts.json")
    assert configured.data_dir.resolve() == root / "data"
    assert configured.output_dir.resolve() == root / "renders"
    assert configured.shared_connections_dir.resolve() == root / ".system/connections"
    assert configured.accounts_json_path.resolve() == root / ".system/connections/accounts.json"
