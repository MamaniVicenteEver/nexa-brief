"""F4 — requisitos por plantilla (`inputs`) y su aplicación al config del job."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config import template_manifest
from src.config.template_manifest import get_template_inputs, list_template_catalog
from src.core.library import asset_library
from src.core.template_inputs import TemplateInputs
from src.modules import template_inputs_applier
from src.modules.template_inputs_applier import INPUTS_DIR, apply_template_inputs
from src.presentation.api.routers import templates as templates_router
from src.presentation.api.schemas.template_schema import TemplateRequirementsResponse
from src.presentation.main import app

client = TestClient(app)


def test_every_template_declares_inputs():
    for template_id, entry in list_template_catalog():
        assert "inputs" in entry, template_id
        inputs = get_template_inputs(template_id)
        assert set(inputs) == {"audio", "media", "texts", "brief", "defaults"}
        for slot in inputs["media"]:
            assert slot["min"] <= slot["max"]
            assert slot["target"] in {"source", "media", "config"}
            if slot["target"] == "config":
                assert slot["path"], template_id   # un fondo opcional necesita a qué ruta del config va


def test_lyrics_and_promo_requirements():
    neon = get_template_inputs("lyrics-neon")
    assert neon["audio"] == {"required": True, "lyrics": "auto"}
    # Neón trae su propio video de fondo: subir uno (video o imagen) es opcional y va a bg.src
    assert [(s["slot"], s["kind"], s["target"], s["path"], s["min"]) for s in neon["media"]] == [
        ("background", "image|video", "config", "bg.src", 0)]

    calado = get_template_inputs("lyrics-calado")
    assert calado["media"][0]["kind"] == "video"

    promo = get_template_inputs("promo-dynamic")
    assert promo["audio"]["required"] is False
    slots = {s["slot"]: s for s in promo["media"]}
    # 6 videos + 12 fotos: los mismos ids de config.media que usan las scenes.
    assert (slots["clips"]["max"], slots["photos"]["max"]) == (6, 12)
    assert {t["key"] for t in promo["texts"]} == {"brand.tag", "brand.url", "brand.vertical"}


def test_derived_defaults_without_explicit_inputs(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        template_manifest,
        "get_template_entry",
        lambda _tid: {"requires_video": True, "requires_lyrics": True},
    )
    inputs = get_template_inputs("x")
    assert inputs["audio"] == {"required": True, "lyrics": "auto"}
    assert inputs["media"][0]["kind"] == "video" and inputs["media"][0]["target"] == "source"


def test_requirements_endpoint():
    r = client.get("/api/v1/templates/promo-editorial/requirements")
    assert r.status_code == 200
    body = r.json()
    assert {s["slot"] for s in body["media"]} == {"clips", "photos"}
    assert client.get("/api/v1/templates/nope/requirements").status_code == 404
    # El listado sigue funcionando y trae los inputs como campo opcional.
    listing = client.get("/api/v1/templates").json()
    assert all("inputs" in t for t in listing)


def test_requirements_get_is_read_only_and_post_prepares_defaults(monkeypatch: pytest.MonkeyPatch):
    from src.core.nodemotion.shared import bundled

    resources = {
        "audio": {"relative": "assets/song.mp3", "kind": "music", "key": "a" * 64 + ".mp3"},
        "media": {"clips": [
            {"relative": "assets/media/one.mp4", "kind": "video", "key": "b" * 64 + ".mp4"},
            {"relative": "assets/media/two.mp4", "kind": "video", "key": "c" * 64 + ".mp4"},
        ]},
    }
    refs = {
        "assets/song.mp3": {"kind": "music", "asset_id": "song-profile-id"},
        "assets/media/one.mp4": {"kind": "video", "asset_id": "clip-one-profile-id"},
        "assets/media/two.mp4": {"kind": "video", "asset_id": "clip-two-profile-id"},
    }
    monkeypatch.setattr(templates_router, "_template_default_resource_paths", lambda *_: resources)
    existing_calls = 0

    def existing_refs(*_):
        nonlocal existing_calls
        existing_calls += 1
        return refs if existing_calls == 1 else {}

    monkeypatch.setattr(templates_router, "_existing_default_refs", existing_refs)
    registrations = []

    async def register(_template_id, paths):
        registrations.append(set(paths))
        return refs

    monkeypatch.setattr(bundled, "ensure_design_resources", register)

    get_response = client.get("/api/v1/templates/lyrics-hologram/requirements")
    assert get_response.status_code == 200
    assert get_response.json()["defaults"] == {
        "audio_asset_id": "song-profile-id",
        "media": {"clips": [
            {"asset_id": "clip-one-profile-id", "kind": "video"},
            {"asset_id": "clip-two-profile-id", "kind": "video"},
        ]},
    }
    assert registrations == []

    post_response = client.post("/api/v1/templates/lyrics-hologram/requirements")
    assert post_response.status_code == 200
    assert post_response.json()["defaults"] == get_response.json()["defaults"]
    assert registrations == [{"assets/song.mp3", "assets/media/one.mp4", "assets/media/two.mp4"}]

    listing = client.get("/api/v1/templates")
    assert listing.status_code == 200
    assert len(registrations) == 1


def test_existing_profile_song_is_resolved_by_template_origin(monkeypatch: pytest.MonkeyPatch):
    from types import SimpleNamespace
    from src.core.nodemotion.shared import bundled

    key = "a" * 64 + ".mp3"
    song = SimpleNamespace(
        asset_id="active-profile-song",
        bundled_key=None,
        template_id="lyrics-hologram",
        tags=["demo-lyrics-hologram"],
    )
    monkeypatch.setattr(asset_library, "list_music", lambda: [song])
    monkeypatch.setattr(asset_library, "list_images", lambda: [])
    monkeypatch.setattr(asset_library, "list_videos", lambda: [])
    monkeypatch.setattr(templates_router, "_default_config", lambda _template_id: {
        "audio": {"src": "assets/song.mp3"},
    })
    monkeypatch.setattr(bundled, "demo_aliases", lambda _template_id: {"assets/song.mp3": key})

    resources = {"audio": {"relative": "assets/song.mp3", "kind": "music", "key": key}, "media": {}}
    refs = templates_router._existing_default_refs(resources, "lyrics-hologram-worlds")
    assert refs == {"assets/song.mp3": {"kind": "music", "asset_id": "active-profile-song"}}


def test_multimedia_template_defaults_resolve_verified_bundled_sources():
    hologram = TemplateRequirementsResponse.model_validate(get_template_inputs("lyrics-hologram"))
    resources = templates_router._template_default_resource_paths("lyrics-hologram", hologram)
    assert resources is not None
    assert resources["audio"] is not None and resources["audio"]["kind"] == "music"
    assert len(resources["media"]["clips"]) == 6

    for variant, base in (("lyrics-hologram-worlds", "lyrics-hologram"),
                          ("lyrics-grunge-montage", "lyrics-grunge")):
        requirements = TemplateRequirementsResponse.model_validate(get_template_inputs(variant))
        variant_resources = templates_router._template_default_resource_paths(variant, requirements)
        assert variant_resources is not None
        assert len(variant_resources["media"]["clips"]) == 6
        assert any(item["source_design"] == base for item in variant_resources["media"]["clips"])

    mirada = TemplateRequirementsResponse.model_validate(get_template_inputs("lyrics-mirada"))
    mirada_resources = templates_router._template_default_resource_paths("lyrics-mirada", mirada)
    assert mirada_resources is not None
    assert sum(len(items) for items in mirada_resources["media"].values()) == 6
    assert mirada_resources["media"]["angel"][0]["kind"] == "image"


def test_mirada_declares_each_config_owned_visual_resource():
    inputs = get_template_inputs("lyrics-mirada")
    assert [(slot["slot"], slot["path"], slot["min"], slot["max"]) for slot in inputs["media"]] == [
        ("eyes", "media.eyes", 1, 1),
        ("hand", "media.hand", 1, 1),
        ("iris", "media.iris", 1, 1),
        ("doves", "media.doves", 1, 1),
        ("moon", "media.moon", 1, 1),
        ("angel", "media.angel", 1, 1),
    ]


def _make_video(path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=64x36:d=1", "-pix_fmt", "yuv420p", str(path)],
        check=True,
    )


async def test_apply_texts_and_media(tmp_path: Path):
    from PIL import Image

    video_src = tmp_path / "clip.mp4"
    _make_video(video_src)
    image_src = tmp_path / "foto.jpg"
    Image.new("RGB", (40, 30), "blue").save(image_src)
    video = await asset_library.register_video(video_src, category="test", source="upload")
    image = await asset_library.register_image(image_src, category="test", source="upload")

    config = {
        "brand": {"tag": "OLD", "url": "old"},
        "scenes": [{"type": "photo", "media": ["basket"]}, {"type": "full", "media": ["basket-1"]}],
        "media": [
            {"id": "basket", "type": "video", "src": "assets/media/a.mp4", "poster": "assets/media/a.jpg",
             "graded": {"bw": {"src": "x"}}},
            {"id": "sprint", "type": "video", "src": "assets/media/b.mp4"},
            {"id": "basket-1", "type": "image", "src": "assets/media/a-1.jpg"},
        ],
    }
    inputs = TemplateInputs(
        media={"clips": [video.asset_id], "photos": [image.asset_id], "nope": ["x"]},
        texts={"brand.tag": "MI MARCA " * 10, "brand.vertical": "VERT", "palette.neon": "#000"},
    )
    out = tmp_path / "out"
    result = await apply_template_inputs(config, inputs, "promo-dynamic", out)

    assert config["brand"]["tag"] == "OLD"  # no muta el original
    assert result["brand"]["tag"] == ("MI MARCA " * 10)[:40]
    assert result["brand"]["vertical"] == "VERT"
    assert "palette" not in result  # clave no declarada: se ignora
    assert result["scenes"] == config["scenes"]  # estructura e ids intactos
    clips = [m for m in result["media"] if m["type"] == "video"]
    assert [m["id"] for m in clips] == ["basket", "sprint"]
    # Un solo video repartido en ciclo por las dos entradas, sin variantes de demo.
    assert {m["src"] for m in clips} == {f"{INPUTS_DIR}/clips-1.mp4"}
    assert all("graded" not in m for m in clips)
    assert clips[0]["poster"] == f"{INPUTS_DIR}/clips-1-poster.jpg"
    assert (out / clips[0]["src"]).exists() and (out / clips[0]["poster"]).exists()
    photo = next(m for m in result["media"] if m["id"] == "basket-1")
    assert photo["src"] == f"{INPUTS_DIR}/photos-1.jpg" and (out / photo["src"]).exists()


async def test_apply_without_inputs_is_noop(tmp_path: Path):
    config = {"bg": {"src": "bg.jpg"}}
    assert await apply_template_inputs(config, None, "lyrics-calado", tmp_path) is config
    # El fondo de letras entra por image/video source: el applier no lo toca.
    result = await apply_template_inputs(config, TemplateInputs(media={"background": ["abc"]}), "lyrics-calado", tmp_path)
    assert result == config


async def test_optional_background_goes_to_its_config_path(tmp_path: Path):
    video_src = tmp_path / "noche.mp4"
    _make_video(video_src)
    video = await asset_library.register_video(video_src, category="test", source="upload")
    config = {"bg": {"src": "assets/remix.mp4", "filter": "x"}}
    out = tmp_path / "out"
    result = await apply_template_inputs(config, TemplateInputs(media={"background": [video.asset_id]}), "lyrics-neon", out)
    assert result["bg"] == {"src": "assets/inputs/background.mp4", "filter": "x"}
    assert (out / "assets/inputs/background.mp4").exists()
    # sin nada subido queda el video de la plantilla
    same = await apply_template_inputs(config, TemplateInputs(media={}), "lyrics-neon", out)
    assert same["bg"]["src"] == "assets/remix.mp4"


async def test_explicitly_cleared_optional_media_slots_are_applied(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    slot = {"slot": "clips", "kind": "video", "min": 0, "max": 6, "target": "media"}
    requirements = {"audio": {"required": False, "lyrics": "none"}, "media": [slot], "texts": [], "brief": False}
    monkeypatch.setattr(template_inputs_applier, "get_template_inputs", lambda _template_id: requirements)
    config = {"media": [
        {"id": "video", "type": "video", "src": "demo.mp4"},
        {"id": "photo", "type": "image", "src": "photo.jpg"},
    ]}
    unchanged = await apply_template_inputs(config, TemplateInputs(media={}), "lyrics-test", tmp_path)
    assert [entry["id"] for entry in unchanged["media"]] == ["video", "photo"]

    cleared = await apply_template_inputs(config, TemplateInputs(media={"clips": []}), "lyrics-test", tmp_path)
    assert [entry["id"] for entry in cleared["media"]] == ["photo"]


async def test_explicitly_cleared_optional_config_slot_deletes_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    slot = {"slot": "background", "kind": "video", "min": 0, "max": 1, "target": "config", "path": "bg.src"}
    requirements = {"audio": {"required": False, "lyrics": "none"}, "media": [slot], "texts": [], "brief": False}
    monkeypatch.setattr(template_inputs_applier, "get_template_inputs", lambda _template_id: requirements)
    config = {"bg": {"src": "demo.mp4", "opacity": 0.5}}
    unchanged = await apply_template_inputs(config, TemplateInputs(media={}), "lyrics-test", tmp_path)
    assert unchanged["bg"]["src"] == "demo.mp4"

    cleared = await apply_template_inputs(config, TemplateInputs(media={"background": []}), "lyrics-test", tmp_path)
    assert cleared["bg"] == {"opacity": 0.5}


def test_config_mapper_keeps_template_owned_media_when_omitted(tmp_path: Path):
    from src.modules.html_generator import _restore_template_media

    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({
        "activeId": "default",
        "configs": [{"id": "default", "media": {"eyes": "assets/media/eyes.mp4"}}],
    }), encoding="utf-8")
    generated = {"title": "new song"}
    _restore_template_media(generated, config_path)
    assert generated["media"] == {"eyes": "assets/media/eyes.mp4"}


def test_scene_and_list_media_preserve_order_and_explicit_removal(tmp_path, monkeypatch):
    source_a = tmp_path / 'a.jpg'
    source_b = tmp_path / 'b.jpg'
    source_a.write_bytes(b'a')
    source_b.write_bytes(b'b')
    monkeypatch.setattr(template_inputs_applier, '_resolve_asset', lambda kind, ident: ('image', {'a': source_a, 'b': source_b}[ident]))
    config = {'figures': {'items': ['old-a', 'old-b']}, 'scenes': [{}, {'video': {'src': 'old'}}]}
    slot = {'slot': 'figures', 'kind': 'image', 'min': 0, 'max': 8, 'path': 'figures.items'}
    assert template_inputs_applier._apply_config_slot(config, slot, ['b', 'a'], tmp_path / 'out')
    assert config['figures']['items'] == ['assets/inputs/figures-0.jpg', 'assets/inputs/figures-1.jpg']
    assert (tmp_path / 'out/assets/inputs/figures-0.jpg').read_bytes() == b'b'
    assert template_inputs_applier._apply_config_slot(config, slot, [], tmp_path / 'out')
    assert config['figures']['items'] == []
    nested = {'slot': 'scene', 'kind': 'image', 'min': 0, 'max': 1, 'path': 'scenes.1.video.src'}
    assert template_inputs_applier._apply_config_slot(config, nested, ['a'], tmp_path / 'out')
    assert config['scenes'][1]['video']['src'] == 'assets/inputs/scene.jpg'
    assert template_inputs_applier._apply_config_slot(config, nested, [], tmp_path / 'out')
    assert 'src' not in config['scenes'][1]['video']


def test_scene_media_defaults_are_exposed():
    expected = {'lyrics-collage': 8, 'lyrics-night-journey': 3, 'lyrics-cristal': 5}
    for template_id, count in expected.items():
        requirements = TemplateRequirementsResponse.model_validate(get_template_inputs(template_id))
        resources = templates_router._template_default_resource_paths(template_id, requirements)
        assert resources is not None
        assert sum(len(items) for items in resources['media'].values()) == count
