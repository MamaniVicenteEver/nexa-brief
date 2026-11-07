from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.core.explainer import sandbox as sandbox_catalog
from src.core.prototypes import briefs, ideas
from src.presentation.api.security import sign_link
from src.presentation.main import app


def test_create_list_and_get_idea_uses_unique_kebab_slug(tmp_path: Path) -> None:
    first = ideas.create_idea(
        "otros",
        "Un día en Marte",
        "Tono documental.",
        [("frame.png", b"small image")],
        templates_dir=tmp_path,
    )
    second = ideas.create_idea("otros", "Un día en Marte", "Otra versión", [], templates_dir=tmp_path)

    assert first.slug == "un-dia-en-marte"
    assert second.slug == "un-dia-en-marte-2"
    assert (first.path / "NOTAS.md").read_text(encoding="utf-8") == "# Un día en Marte\n\nTono documental.\n"
    assert first.files[0].path.read_bytes() == b"small image"
    assert ideas.get_idea("otros", first.slug, templates_dir=tmp_path).title == "Un día en Marte"
    assert {idea.slug for idea in ideas.list_ideas(templates_dir=tmp_path)} == {first.slug, second.slug}
    references = next(
        folder for folder in sandbox_catalog.list_sandbox(root=tmp_path / "sandbox") if folder.folder == "referencias"
    )
    assert {item.id for item in references.items} == {first.slug, second.slug}


def test_create_idea_rejects_invalid_category_and_file_type(tmp_path: Path) -> None:
    with pytest.raises(ideas.IdeaInputError, match="categoría"):
        ideas.create_idea("no-existe", "Idea", "", [], templates_dir=tmp_path)
    with pytest.raises(ideas.IdeaInputError, match="Tipo de archivo"):
        ideas.create_idea("otros", "Idea", "", [("notas.txt", b"x")], templates_dir=tmp_path)
    assert not (tmp_path / "sandbox" / "referencias" / "otros" / "idea").exists()


def test_create_idea_applies_per_file_limit_and_cleans_partial_folder(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(ideas, "MAX_UPLOAD_BYTES", 4)
    with pytest.raises(ideas.UploadTooLargeError):
        ideas.create_idea("otros", "Idea grande", "", [("ref.png", b"12345")], templates_dir=tmp_path)
    assert not (tmp_path / "sandbox" / "referencias" / "otros" / "idea-grande").exists()


def test_compose_brief_lists_files_metadata_and_same_category_templates(tmp_path: Path, monkeypatch) -> None:
    idea = ideas.create_idea(
        "nodehistory",
        "Reloj del calendario",
        "Mostrar cómo cambia la fecha en pantalla.",
        [("ref image.png", b"image"), ("clip.mp4", b"not a real mp4")],
        templates_dir=tmp_path,
    )
    same_category = tmp_path / "sandbox" / "nodehistory" / "historia-cercana"
    same_category.mkdir(parents=True)
    (same_category / "info.json").write_text(
        json.dumps(
            {
                "engine": "explainer-kit:atlas",
                "based_on": "muro-de-berlin",
                "summary": "Mapas históricos en movimiento.",
                "notes": ["Reutiliza mapas."],
            }
        ),
        encoding="utf-8",
    )
    other_category = tmp_path / "sandbox" / "nodeaction" / "accion-base"
    other_category.mkdir(parents=True)
    (other_category / "info.json").write_text(
        json.dumps({"engine": "nodeaction", "summary": "Otra referencia."}),
        encoding="utf-8",
    )
    (tmp_path / "sandbox" / "PROTOTIPO.md").write_text("# Entrada única", encoding="utf-8")
    monkeypatch.setattr(settings, "public_base_url", "https://nexa.example")
    monkeypatch.setattr(briefs, "_video_metadata", lambda _: "duración 4.0 s; resolución 640×360")

    result = briefs.compose_brief("nodehistory", idea.slug, templates_dir=tmp_path, today=date(2026, 10, 25))

    assert "# Brief de la idea «Reloj del calendario»" in result
    assert "Mostrar cómo cambia la fecha en pantalla." in result
    assert f"{idea.path.resolve() / 'ref image.png'}" in result
    assert (
        "https://nexa.example/api/v1/explainer/files/sandbox/referencias/nodehistory/reloj-del-calendario/ref%20image.png"
        in result
    )
    assert (
        "https://nexa.example/api/v1/explainer/files/sandbox/referencias/nodehistory/reloj-del-calendario/clip.mp4; "
        "duración 4.0 s; resolución 640×360" in result
    )
    assert "`historia-cercana`" in result
    assert "- Engine: explainer-kit:atlas" in result
    assert "- Based on: muro-de-berlin" in result
    assert "  - Reutiliza mapas." in result
    assert result.index("`historia-cercana`") < result.index("`accion-base`")
    assert "https://nexa.example/api/v1/agent/prototipo" in result
    assert (idea.path / "BRIEF.md").read_text(encoding="utf-8") == result


def _prepare_api(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    templates = tmp_path / "templates"
    (templates / "sandbox").mkdir(parents=True)
    (templates / "sandbox" / "PROTOTIPO.md").write_text("# PROTOTIPO", encoding="utf-8")
    monkeypatch.setattr(settings, "templates_dir", templates)
    monkeypatch.setattr(settings, "public_base_url", "https://nexa.example")
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "internal-test")
    monkeypatch.setattr(settings, "nexa_link_secret", "link-test")
    return templates


def test_prototype_routes_protect_writes_and_serve_signed_brief(tmp_path: Path, monkeypatch) -> None:
    templates = _prepare_api(monkeypatch, tmp_path)
    idea = ideas.create_idea("otros", "Idea de prueba", "Notas de API.", [], templates_dir=templates)
    client = TestClient(app)
    assert client.get("/api/v1/agent/prototipo").status_code == 200
    assert (
        client.get("/api/v1/agent/prototipo", follow_redirects=True).headers["content-type"].startswith("text/markdown")
    )

    path = f"/api/v1/agent/prototipo/otros/{idea.slug}"
    signature = sign_link(path, ttl=60)
    assert client.get(f"{path}/link").status_code == 403
    assert client.get(path, params={"k": signature + "x"}).status_code == 401
    response = client.get(path, params={"k": signature})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert "Notas de API." in response.text
    assert (idea.path / "BRIEF.md").is_file()

    link_response = client.get(f"{path}/link", headers={"X-Nexa-Internal": "internal-test"})
    assert link_response.status_code == 200
    assert link_response.json()["url"].startswith("https://nexa.example/api/v1/agent/prototipo/otros/")
    assert link_response.json()["local_path"] == str(idea.path.resolve())


def test_create_idea_route_requires_internal_header_and_accepts_multipart(tmp_path: Path, monkeypatch) -> None:
    templates = _prepare_api(monkeypatch, tmp_path)
    client = TestClient(app)
    endpoint = "/api/v1/agent/prototipo/ideas"
    form = {"category": "otros", "title": "Idea API", "notes": "Un apunte."}
    assert client.post(endpoint, data=form, files={"files": ("image.png", b"PNG", "image/png")}).status_code == 403

    response = client.post(
        endpoint,
        data=form,
        files={"files": ("image.png", b"PNG", "image/png")},
        headers={"X-Nexa-Internal": "internal-test"},
    )
    assert response.status_code == 201
    payload = response.json()
    saved = Path(payload["path"])
    assert saved == templates / "sandbox" / "referencias" / "otros" / "idea-api"
    assert (saved / "NOTAS.md").read_text(encoding="utf-8") == "# Idea API\n\nUn apunte.\n"
    assert (saved / "image.png").read_bytes() == b"PNG"
