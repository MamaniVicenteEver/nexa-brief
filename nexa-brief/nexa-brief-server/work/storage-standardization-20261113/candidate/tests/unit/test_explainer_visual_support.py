"""Política visual v5 y biblioteca reutilizable entre producciones."""

from __future__ import annotations

import json
from pathlib import Path

from src.core.explainer import producer


TOOLS = Path(producer.KIT_DIR) / "tools"


def _beat(i, use, start, duration, params):
    return {"i": i, "use": use, "layer": "main", "t0": start, "t1": start + duration,
            "b": {"params": params}}


def test_v5_duration_reuse_thirds_and_dominance(monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    import visual_support

    policy = json.loads((Path(producer.KIT_DIR) / "catalog.json").read_text())["quality"]["visual_support_v5"]
    catalog = {
        "rough.introv2": {"params": {"src": {"type": "image"}, "video": {"type": "video"}}},
        "common.clip": {"params": {"src": {"type": "video"}}},
        "rough.photo": {"params": {"src": {"type": "image"}}},
    }
    beats = [
        _beat(0, "rough.introv2", 3, 5, {"src": "assets/media/uno.jpg"}),
        _beat(1, "common.clip", 36, 16, {"src": "assets/media/uno.mp4", "layout": "full", "caption": "Una historia"}),
        _beat(2, "common.clip", 72, 18, {"src": "assets/media/dos.mp4", "layout": "full", "caption": "La conclusión"}),
        _beat(3, "rough.photo", 92, 4, {"src": "assets/media/tres.jpg"}),
    ]
    errors, warnings = [], []
    metric = visual_support.check({}, beats, catalog, 99, policy, errors, warnings)
    assert errors == []
    assert any("18.0s" in warning for warning in warnings)
    assert any("4.0s" in warning for warning in warnings)
    assert metric["preferred_thirds"] == [True, True, True]

    beats += [_beat(4, "rough.photo", 97, 3, {"src": "assets/media/uno.jpg"}),
              _beat(5, "rough.photo", 100, 13, {"src": "assets/media/uno.jpg"}),
              _beat(6, "common.clip", 110, 7, {"src": "assets/media/uno.mp4", "layout": "full"}),
              _beat(7, "common.clip", 118, 8, {"src": "assets/media/uno.mp4", "layout": "full"})]
    errors, warnings = [], []
    visual_support.check({}, beats, catalog, 130, policy, errors, warnings)
    assert any("3.0s" in error for error in errors)
    assert any("13.0s" in error for error in errors)
    assert any("7.0s" in error for error in errors)
    assert any("uno.jpg: 3 usos" in error for error in errors)
    assert any("uno.mp4: 3 usos" in error for error in errors)


def test_v5_requires_preferred_support_in_each_third(monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    import visual_support

    policy = json.loads((Path(producer.KIT_DIR) / "catalog.json").read_text())["quality"]["visual_support_v5"]
    catalog = {"rough.photo": {"params": {"src": {"type": "image"}}}}
    errors, warnings = [], []
    visual_support.check({}, [_beat(0, "rough.photo", 0, 8, {"src": "assets/media/a.jpg"})],
                         catalog, 90, policy, errors, warnings)
    assert sum("tercio" in error for error in errors) == 3
    assert any("domina" in warning for warning in warnings)


def test_v5_full_clip_without_text_does_not_cover_third(monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    import visual_support

    policy = json.loads((Path(producer.KIT_DIR) / "catalog.json").read_text())["quality"]["visual_support_v5"]
    catalog = {"common.clip": {"params": {"src": {"type": "video"}}}}
    beats = [_beat(i, "common.clip", i * 30, 12, {"src": f"assets/media/{i}.mp4", "layout": "full"})
             for i in range(3)]
    errors, warnings = [], []
    metric = visual_support.check({}, beats, catalog, 90, policy, errors, warnings)
    assert metric["preferred_thirds"] == [False, False, False]
    assert sum("tercio" in error for error in errors) == 3


def test_v5_tabloid_split_checks_second_photo_duration(monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    import visual_support

    policy = json.loads((Path(producer.KIT_DIR) / "catalog.json").read_text())["quality"]["visual_support_v5"]
    catalog = {"common.tabloid": {"params": {"video": {"type": "video"}, "srcAfter": {"type": "image"}}}}
    beat = _beat(0, "common.tabloid", 0, 3, {"video": "assets/media/a.mp4", "srcAfter": "assets/media/b.jpg", "mode": "split"})
    errors, warnings = [], []
    visual_support.check({}, [beat], catalog, 9, policy, errors, warnings)
    assert any("foto visible 3.0s" in error for error in errors)
    assert any("video visible 3.0s" in error for error in errors)


def test_v5_uses_new_photo_warning_without_changing_v4(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    import check_storyboard as checker

    beat = _beat(0, "rough.photo", 0, 4.5, {"src": "assets/media/a.jpg"})
    catalog = {"rough.photo": {"params": {"src": {"type": "image"}}}}
    v4_errors = []
    checker.quality_check(tmp_path, {"quality_policy_version": 4, "design": "rough"}, {},
                          [beat], [], 12, v4_errors, catalog)
    assert any("foto visible" in error for error in v4_errors)
    v5_errors, v5_warnings = [], []
    checker.quality_check(tmp_path, {"quality_policy_version": 5, "design": "rough"}, {},
                          [beat], [], 12, v5_errors, catalog, v5_warnings)
    assert not any("foto visible" in error for error in v5_errors)
    assert any("foto visible" in warning for warning in v5_warnings)


def test_library_indexes_all_and_warns_on_near_duplicate(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    import component_library as library

    monkeypatch.setattr(library, "TEMPLATES", tmp_path)
    monkeypatch.setattr(library, "KIT", tmp_path / "_tools/explainer-kit")
    monkeypatch.setattr(library, "INDEX", tmp_path / "library.json")
    for name, code in (("video-a", "first"), ("video-b", "second")):
        video = tmp_path / "nodetech" / name
        components = video / "assets/components"
        components.mkdir(parents=True)
        (components / "phone.js").write_text(f'K.register({{name: "rough.phoneCall", summary: "{code}"}})')
        (components / "catalog.json").write_text(json.dumps({"comps": [{"name": "rough.phoneCall",
            "summary": "Teléfono que muestra una llamada entrante", "params": {"caller": {"type": "string"}}}]}))
        sheet = video / "work/components/rough-phoneCall.png"
        sheet.parent.mkdir(parents=True)
        sheet.write_bytes(b"PNG")
    entries = library.refresh()
    assert len(entries) == 2
    assert all(item["sheet_exists"] and item["source"] for item in entries)
    assert len(library.similar(tmp_path / "nodetech/video-b")) == 1
    a = tmp_path / "nodetech/video-a/assets/components/phone.js"
    b = tmp_path / "nodetech/video-b/assets/components/phone.js"
    b.write_bytes(a.read_bytes())
    assert library.similar(tmp_path / "nodetech/video-b") == []

    # La descripción también detecta duplicados entre familias de diseño.
    b.write_text('K.register({name: "binary.incomingCall", summary: "another implementation"})')
    catalog_b = tmp_path / "nodetech/video-b/assets/components/catalog.json"
    data = json.loads(catalog_b.read_text())
    data["comps"][0]["name"] = "binary.incomingCall"
    catalog_b.write_text(json.dumps(data))
    assert len(library.similar(tmp_path / "nodetech/video-b")) == 1
