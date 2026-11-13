"""F4 — requisitos por plantilla (`inputs`) y su aplicación al config del job."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config import template_manifest
from src.config.template_manifest import get_template_inputs, list_template_catalog
from src.core.library import asset_library
from src.core.template_inputs import TemplateInputs
from src.modules.template_inputs_applier import INPUTS_DIR, apply_template_inputs
from src.presentation.main import app

client = TestClient(app)


def test_every_template_declares_inputs():
    for template_id, entry in list_template_catalog():
        assert "inputs" in entry, template_id
        inputs = get_template_inputs(template_id)
        assert set(inputs) == {"audio", "media", "texts", "brief"}
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
