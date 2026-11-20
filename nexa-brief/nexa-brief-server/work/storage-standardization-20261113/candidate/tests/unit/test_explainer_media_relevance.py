"""El motor exige un plan visual verificable sin romper producciones previas."""

from __future__ import annotations

import importlib.util
import asyncio
import io
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from PIL import Image

from src.core.ports.stock_media_port import StockItem

TOOLS = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit/tools"


def _module(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _beat(i, source, **fields):
    return {"i": i, "use": "common.clip", "layer": "main", "t0": i * 10, "t1": i * 10 + 10,
            "b": {"at": f"frase {i}", "params": {"src": source}, **fields}}


def test_new_policy_requires_auditable_visual_review_and_blocks_generic_fill(tmp_path):
    relevance = _module("media_relevance")
    catalog = {"common.clip": {"params": {"src": {"type": "video"}}}}
    beats = [_beat(i, f"assets/media/server-room-{i}.mp4") for i in range(3)]
    errors, warnings = [], []
    entries, metric = relevance.check(tmp_path, {"quality_policy_version": 4}, beats, catalog, errors, warnings)
    assert len(entries) == 3 and metric["generic_beats"] == 3
    assert any("falta shows" in error for error in errors)
    assert any("falta query" in error for error in errors)
    assert any("falta media_review" in error for error in errors)
    assert any("sujeto concreto" in error for error in errors)


def test_reuse_is_warned_and_review_is_recorded(tmp_path, monkeypatch):
    relevance = _module("media_relevance")
    templates = tmp_path / "templates"
    policy = (relevance.KIT / "media-relevance.json").read_bytes()
    monkeypatch.setattr(relevance, "KIT", templates / "_tools" / "explainer-kit")
    relevance.KIT.mkdir(parents=True)
    (relevance.KIT / "media-relevance.json").write_bytes(policy)
    proto = templates / "nodetech" / "new"
    previous = templates / "nodetech" / "previous"
    for video in (proto, previous):
        medium = video / "assets/media/juez.mp4"
        medium.parent.mkdir(parents=True)
        medium.write_bytes(b"same video")
    beat = _beat(0, "assets/media/juez.mp4", shows="Juez preside audiencia; sirve para esta frase",
                 query="judge in court hearing", media_review="Se ve un juez frente a la sala")
    errors, warnings = [], []
    entries, metric = relevance.check(proto, {"quality_policy_version": 4}, [beat],
                                      {"common.clip": {"params": {"src": {"type": "video"}}}}, errors, warnings)
    assert not errors
    assert metric["reviewed"] == 1 and metric["reused_sources"] == 1
    assert entries[0]["anchor"] == "frase 0" and entries[0]["reused_from"] == ["nodetech/previous"]
    assert "justificá en shows" in warnings[0]


def test_reuse_matches_credit_page_after_reencoding(tmp_path, monkeypatch):
    relevance = _module("media_relevance")
    templates = tmp_path / "templates"
    policy = (relevance.KIT / "media-relevance.json").read_bytes()
    monkeypatch.setattr(relevance, "KIT", templates / "_tools" / "explainer-kit")
    relevance.KIT.mkdir(parents=True)
    (relevance.KIT / "media-relevance.json").write_bytes(policy)
    proto = templates / "nodetech" / "new"
    previous = templates / "nodetech" / "previous"
    for video, contents in ((proto, b"new encoding"), (previous, b"old encoding")):
        media_dir = video / "assets/media"
        media_dir.mkdir(parents=True)
        (media_dir / "juez.mp4").write_bytes(contents)
        (media_dir / "CREDITS.md").write_text(
            "juez.mp4 — Video: juez — autor — Pexels License — https://www.pexels.com/video/judge-123/\n",
            encoding="utf-8",
        )
    assert relevance.reused_elsewhere(proto, {"assets/media/juez.mp4"}) == {
        "assets/media/juez.mp4": ["nodetech/previous"]}


def test_combined_photo_and_video_need_separate_visual_reviews(tmp_path):
    relevance = _module("media_relevance")
    catalog = {"rough.introv2": {"params": {"src": {"type": "image"}, "video": {"type": "video"}}}}
    beat = {"i": 0, "use": "rough.introv2", "layer": "main", "b": {
        "at": "ante el tribunal", "shows": "fachada del tribunal",
        "query": "courthouse exterior facade", "media_review": "Se ve la fachada del tribunal",
        "params": {"src": "assets/media/fachada.jpg", "video": "assets/media/fachada.mp4"}}}
    errors, warnings = [], []
    _, metric = relevance.check(tmp_path, {"quality_policy_version": 4}, [beat], catalog, errors, warnings)
    assert metric["reviewed"] == 0 and len([e for e in errors if "falta media_review" in e]) == 2
    beat["b"]["media_review"] = {
        "assets/media/fachada.jpg": "Se ve la fachada del tribunal en foto",
        "assets/media/fachada.mp4": "Se ve la fachada del tribunal en video",
    }
    errors, warnings = [], []
    entries, metric = relevance.check(tmp_path, {"quality_policy_version": 4}, [beat], catalog, errors, warnings)
    assert not errors and metric["reviewed"] == 2 and entries[0]["review"] != entries[1]["review"]


def test_legacy_media_remains_non_blocking(tmp_path):
    relevance = _module("media_relevance")
    errors, warnings = [], []
    _, metric = relevance.check(tmp_path, {"quality_policy_version": 3},
                                [_beat(0, "assets/media/phone.mp4")],
                                {"common.clip": {"params": {"src": {"type": "video"}}}}, errors, warnings)
    assert not errors and not warnings and metric["status"] == "legacy"


def test_generic_credit_is_detected_even_when_file_was_renamed(tmp_path):
    relevance = _module("media_relevance")
    media_dir = tmp_path / "assets/media"
    media_dir.mkdir(parents=True)
    (media_dir / "CREDITS.md").write_text(
        "legal-01.mp4 — Video: server room — autor (Pexels) — Pexels License — https://example.com/\n",
        encoding="utf-8",
    )
    beats = [_beat(i, "assets/media/legal-01.mp4", shows="Servidores", query="server room",
                   media_review="Se ven servidores en un centro de datos") for i in range(3)]
    errors, warnings = [], []
    _, metric = relevance.check(tmp_path, {"quality_policy_version": 4}, beats,
                                {"common.clip": {"params": {"src": {"type": "video"}}}}, errors, warnings)
    assert metric["generic_beats"] == 3
    assert any("sujeto concreto" in error for error in errors)


def test_concept_ranking_prefers_concrete_subject_over_generic_clip():
    sys.path.insert(0, str(TOOLS))
    media = _module("media")
    concrete = StockItem(provider="pexels", provider_id="1", kind="video", title="judge presiding courtroom hearing",
                         preview_url="https://example.com/1.jpg", download_url="https://example.com/1.mp4")
    generic = StockItem(provider="pexels", provider_id="2", kind="video", title="hands typing on laptop",
                        preview_url="https://example.com/2.jpg", download_url="https://example.com/2.mp4")
    assert media._rank(concrete, ["judge in courtroom hearing", "judge presiding trial"]) > media._rank(
        generic, ["judge in courtroom hearing", "judge presiding trial"])
    ambiguous = StockItem(provider="pexels", provider_id="3", kind="video", title="legal documents in office",
                          preview_url="https://example.com/3.jpg", download_url="https://example.com/3.mp4")
    assert media._rank(ambiguous, ["lawyer reviewing legal documents", "attorney with paperwork in office"]) == 0


@pytest.mark.parametrize("provider", ["pixabay", "unsplash"])
def test_photo_fallback_reference_can_be_downloaded_and_credited(tmp_path, monkeypatch, provider):
    sys.path.insert(0, str(TOOLS))
    media = _module("media")
    video = tmp_path / "video"
    (video / "assets/media").mkdir(parents=True)
    monkeypatch.setattr(media, "find_video", lambda _: video)
    monkeypatch.setattr(media, "env_key", lambda _: "test-key")
    image = io.BytesIO()
    Image.new("RGB", (20, 20), "white").save(image, format="JPEG")
    monkeypatch.setattr(media, "fetch", lambda *args, **kwargs: image.getvalue())
    calls = []

    def response(url, headers=None):
        calls.append(url)
        if provider == "pixabay":
            return {"hits": [{"largeImageURL": "https://pixabay.com/get/photo.jpg", "tags": "courtroom judge",
                              "user": "Author", "pageURL": "https://pixabay.com/photos/id-12/"}]}
        return {"urls": {"raw": "https://images.unsplash.com/photo-12"}, "user": {"name": "Author"},
                "links": {"html": "https://unsplash.com/photos/12"}, "alt_description": "courtroom judge"}

    monkeypatch.setattr(media, "http_json", response)
    media.cmd_get(SimpleNamespace(id="video", ref=f"{provider}:12", name="juez.jpg", force=False))
    assert (video / "assets/media/juez.jpg").is_file()
    credits = (video / "assets/media/CREDITS.md").read_text()
    assert "courtroom judge" in credits and "Author" in credits and provider.capitalize() in credits
    if provider == "unsplash":
        assert any(url.endswith("/download") for url in calls)


def test_concept_search_falls_back_to_relevant_photo(monkeypatch):
    sys.path.insert(0, str(TOOLS))
    media = _module("media")
    from src.adapters.stock import factory

    class Provider:
        name = "pexels"
        kinds = frozenset({"video", "image"})
        configured = True

        def __init__(self):
            self.calls = []

        async def search(self, query, kind, *, per_page):
            self.calls.append((query, kind))
            title = "hands typing on laptop" if kind == "video" else "judge presiding courtroom hearing"
            return [StockItem(provider="pexels", provider_id=kind, kind=kind, title=title,
                              preview_url="https://example.com/a.jpg", download_url="https://example.com/a")]

    provider = Provider()
    monkeypatch.setattr(factory, "build_stock_providers", lambda: {"pexels": provider})
    monkeypatch.setattr(media, "http_json", lambda _: {"query": {"search": []}})
    queries = ["judge in courtroom hearing", "judge presiding trial"]
    kind, results, failures = asyncio.run(media.concept_candidates("juez en audiencia", queries, 1))
    assert kind == "image" and results[0][1].title == "judge presiding courtroom hearing"
    assert not failures
    assert provider.calls == [(query, kind) for kind in ("video", "image") for query in queries]
