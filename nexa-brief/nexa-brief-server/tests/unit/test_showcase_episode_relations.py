"""Built-in designs only reference manifests inside the owned production root."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.adapters.showcase.episode_relations import builtin_episode_relations
from src.core.showcase.ports import ShowcaseConflict


def put(root: Path, folder: str, episode: str, design: str, *, ident: str | None = None):
    path = root / folder / episode
    path.mkdir(parents=True, exist_ok=True)
    (path / "manifest.json").write_text(json.dumps({"video_id": ident or episode, "design": design, "title": "Ejemplo"}))
    (path / "index.html").write_text("demo")


def test_v2_production_relations_never_scan_other_profile(tmp_path, monkeypatch):
    from src.core import categories
    monkeypatch.setattr(categories, "explainer_folders", lambda: {"nodetech": "node_tech", "nodehistory": "node_history"})
    profile = tmp_path / "profile"
    root = profile / "productions"
    put(root, "nodetech", "folder-a", "rough", ident="video-real")
    put(root, "nodehistory", "folder-b", "binary")
    put(root, "nodetech", "muestras", "rough")
    other = tmp_path / "other/productions"
    put(other, "nodetech", "unowned", "rough")
    (root / "nodetech/linked").symlink_to(other / "nodetech/unowned", target_is_directory=True)
    adapter = SimpleNamespace(schema_version=2, root=profile, templates=tmp_path / "templates")
    result = builtin_episode_relations(adapter, {"rough", "binary"})
    assert result["rough"] == [{"id": "video-real", "title": "Ejemplo", "design_id": "rough",
                               "preview_url": "/api/v1/explainer/files/productions/nodetech/folder-a/index.html"}]
    assert result["binary"][0]["id"] == "folder-b"


def test_v1_legacy_relations_require_ownership(tmp_path, monkeypatch):
    from src.core import categories
    monkeypatch.setattr(categories, "explainer_folders", lambda: {"nodetech": "node_tech"})
    templates = tmp_path / "templates"
    put(templates, "nodetech", "video-a", "rough")
    adapter = SimpleNamespace(schema_version=1, root=tmp_path / "profile", templates=templates,
                              allow_legacy_repo=lambda: False)
    assert builtin_episode_relations(adapter, {"rough"}) == {}
    adapter.allow_legacy_repo = lambda: True
    assert builtin_episode_relations(adapter, {"rough"})["rough"][0]["id"] == "video-a"
    put(templates, "nodetech", "video-b", "rough", ident="video-a")
    with pytest.raises(ShowcaseConflict):
        builtin_episode_relations(adapter, {"rough"})


def test_builtin_design_exposes_episode_relationships(tmp_path, monkeypatch):
    from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
    from src.core import categories
    from src.core.showcase.service import ShowcaseService

    monkeypatch.setattr(categories, "explainer_folders", lambda: {"nodetech": "node_tech"})
    templates = Path(__file__).resolve().parents[2] / "src/templates"
    adapter = FilesystemShowcaseAdapter(tmp_path / "profile", templates, schema_version=2)
    put(adapter.root / "productions", "nodetech", "episode-folder", "rough", ident="episode-id")
    design = ShowcaseService(adapter).get_design("rough")
    assert [(entry.id, entry.design_id) for entry in design.episodes] == [("episode-id", "rough")]
    assert design.episodes[0].preview_url == "/api/v1/explainer/files/productions/nodetech/episode-folder/index.html"
