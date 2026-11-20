"""CLI/static profile resolution regressions; no browser, renderer or model calls."""
import importlib.util
from pathlib import Path

import pytest


def load(relative):
    source = Path(__file__).resolve().parents[2] / relative
    spec = importlib.util.spec_from_file_location("profile_render_test_" + source.stem, source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def profile(tmp_path, monkeypatch):
    from src.config.settings import settings
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "profile")
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    return tmp_path / "profile"


def test_v3_registry_resolves_three_runtime_category_episodes_outside_repository(profile, monkeypatch):
    from src.core import content_registry
    places = load("src/templates/_tools/explainer-kit/tools/places.py")
    monkeypatch.setattr(places, "folders", lambda: ["legacy-category"])
    for ident in ("alma-pilot", "leo-pilot", "nara-pilot"):
        episode = profile / "productions/nodeactualidad" / ident
        episode.mkdir(parents=True)
        monkeypatch.setattr(content_registry, "get_video", lambda value: {
            "details": {"folder_key": "productions/nodeactualidad/" + value}})
        assert places.find_video(ident) == episode
        assert not episode.resolve().is_relative_to(places.TEMPLATES.resolve())


def test_v3_registry_rejects_unknown_id_mismatch_and_profile_escape(profile, tmp_path, monkeypatch):
    from src.core import content_registry
    places = load("src/templates/_tools/explainer-kit/tools/places.py")
    for key in (None, "/other-profile/productions/category/registered", "productions/category/other-id"):
        monkeypatch.setattr(content_registry, "get_video", lambda _: {"details": {"folder_key": key}})
        assert places.find_video("registered") is None
    outside = tmp_path / "foreign"
    outside.mkdir()
    episode = profile / "productions/nodeactualidad/registered"
    episode.parent.mkdir(parents=True)
    episode.symlink_to(outside, target_is_directory=True)
    monkeypatch.setattr(content_registry, "get_video", lambda _: {"details": {"folder_key": "productions/nodeactualidad/registered"}})
    assert places.find_video("registered") is None


def test_recorder_http_api_alias_keeps_same_profile_and_private_guards(profile):
    from src.config.content_paths import resolve_content_key
    from src.config.settings import settings
    media = load("src/templates/_tools/http_media.py")
    handler = object.__new__(media.ProfileContentMixin)
    public = "bundled/_tools/explainer-kit/runtime.js"
    assert handler.translate_path("/api/v1/explainer/files/" + public) == str(resolve_content_key(public))
    for key in ("productions/cat/id/.env", "productions/cat/id/work/private.json", "productions/cat/../escape"):
        assert handler.translate_path("/api/v1/explainer/files/" + key) == str(settings.templates_dir / ".not-found")
