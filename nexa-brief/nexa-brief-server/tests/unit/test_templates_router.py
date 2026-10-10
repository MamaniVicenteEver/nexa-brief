from __future__ import annotations

from fastapi.testclient import TestClient

from src.presentation.main import app

client = TestClient(app)


def test_list_templates():
    r = client.get("/api/v1/templates")
    assert r.status_code == 200
    templates = r.json()
    assert len(templates) > 0
    ids = {t["template_id"] for t in templates}
    assert "01-image-bg" in ids
    # Cada plantilla trae la metadata real derivada de niches.json + manifest.json
    image_bg = next(t for t in templates if t["template_id"] == "01-image-bg")
    assert image_bg["niche_id"] == "image_bg_portrait"
    assert image_bg["requires_image"] is True
    assert image_bg["requires_video"] is False

    expected = {
        "lyrics-collage",
        "lyrics-mixtas",
        "lyrics-grunge",
        "lyrics-stylish-kinetic",
        "lyrics-caution",
        "promo-editorial",
        "promo-kinetic",
        "promo-trendy",
        "promo-dynamic",
        "promo-urban",
        "promo-sports",
    }
    assert expected <= ids
    assert {template["category_id"] for template in templates} == {
        "lyrics", "commercial", "image", "video", "in_progress",
    }
    assert all(template["can_generate"] for template in templates)


def test_list_template_categories():
    r = client.get("/api/v1/templates/categories")
    assert r.status_code == 200
    categories = r.json()
    assert [category["id"] for category in categories] == [
        "lyrics", "commercial", "image", "video", "in_progress",
    ]


def test_get_template_ok():
    r = client.get("/api/v1/templates/01-image-bg")
    assert r.status_code == 200
    assert r.json()["template_id"] == "01-image-bg"


def test_get_template_unknown_404():
    r = client.get("/api/v1/templates/does-not-exist")
    assert r.status_code == 404


def test_preview_status_unknown_preview_id_404():
    r = client.get("/api/v1/templates/preview/does-not-exist/status")
    assert r.status_code == 404


def test_preview_file_unknown_preview_id_404():
    r = client.get("/api/v1/templates/preview/does-not-exist/index.html")
    assert r.status_code == 404


def test_preview_file_filename_not_whitelisted_404():
    # Ni siquiera llega a resolver un preview_id real: el filename se rechaza primero.
    r = client.get("/api/v1/templates/preview/anything/secrets.txt")
    assert r.status_code == 404
    assert "Unknown preview file" in r.json()["detail"]


def test_create_preview_unknown_template_404():
    r = client.post("/api/v1/templates/does-not-exist/preview")
    assert r.status_code == 404


def test_library_image_file_unknown_asset_404():
    r = client.get("/api/v1/library/images/does-not-exist/file")
    assert r.status_code == 404


def test_library_music_file_unknown_asset_404():
    r = client.get("/api/v1/library/music/does-not-exist/file")
    assert r.status_code == 404


def test_library_video_file_unknown_asset_404():
    r = client.get("/api/v1/library/videos/does-not-exist/file")
    assert r.status_code == 404
