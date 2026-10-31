"""Catálogo y previews de solo lectura para sandbox."""

from __future__ import annotations

import json
import os
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.requests import Request

from src.core.categories import explainer_folders
from src.core.explainer import sandbox as sandbox_catalog
from src.core.explainer import sandbox_thumbs
from src.presentation.api.routers import explainer as explainer_router
from src.presentation.api.routers import sandbox as sandbox_router


def _write(path: Path, content: str = "") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def _touch(path: Path, timestamp: float) -> None:
    os.utime(path, (timestamp, timestamp))


def test_list_sandbox_detects_kinds_metadata_videos_and_order(tmp_path: Path):
    root = tmp_path / "sandbox"

    kit = root / "nodehistory" / "kit-demo"
    _write(kit / "index.html", '<script src="../../../_tools/explainer-kit/engine/loader.js"></script>')
    _write(kit / "manifest.json", json.dumps({"title": "Kit de prueba", "status": "listo", "design": "atlas"}))
    _write(kit / "render" / "kit-final.mp4")
    _write(kit / "render" / "poster.jpg")
    for path in kit.rglob("*"):
        if path.is_file():
            _touch(path, 200)

    action = root / "nodeaction" / "action-demo"
    _write(action / "index.html", '<script src="../_engine/core.js"></script>')
    _write(action / "render" / "final.mp4")
    _write(action / "loose.mp4")
    _write(action / "PLAN.md", "plan")

    maps = root / "nodehistory" / "maps-demo"
    _write(maps / "index.html", '<script src="../_mapas/map.js"></script>')
    _write(maps / "preview.mp4")
    _touch(maps / "index.html", 500)

    board = root / "nodehistory" / "board-demo"
    _write(board / "index.html", '<script src="../_pizarra/pizarra.js"></script>')
    _write(board / "render" / "board.mp4")
    _touch(board / "index.html", 400)
    _touch(board / "render" / "board.mp4", 400)

    hyperframes = root / "nodemotion" / "lyrics-demo"
    _write(hyperframes / "index.html", "<main>lyrics</main>")
    _write(hyperframes / "assets" / "lyrics.json", "{}")
    _write(hyperframes / "render" / "lyrics.mp4")

    reference = root / "nuevos" / "reference-demo"
    _write(reference / "video.mp4")

    _write(root / "nodeaction" / "_engine" / "shared.mp4")
    _write(root / "nodeaction" / "prompts" / "prompt.md", "sin preview")
    _write(root / "_proto" / "proto.js", "shared")

    folders = sandbox_catalog.list_sandbox(root)
    by_folder = {folder.folder: folder for folder in folders}

    configured = explainer_folders()
    expected_folder_order = sorted(
        [name for name in by_folder if name in configured],
        key=lambda name: list(configured.values()).index(configured[name]),
    ) + sorted(name for name in by_folder if name not in configured)
    assert [folder.folder for folder in folders] == expected_folder_order

    history = by_folder["nodehistory"]
    assert history.category_id == configured["nodehistory"]
    assert history.label
    assert [item.id for item in history.items] == ["maps-demo", "board-demo", "kit-demo"]

    kit_item = history.items[-1]
    assert (kit_item.kind, kit_item.title, kit_item.status, kit_item.design) == (
        "explainer_kit",
        "Kit de prueba",
        "listo",
        "atlas",
    )
    assert kit_item.path == "sandbox/nodehistory/kit-demo"
    assert kit_item.has_index and kit_item.has_poster
    assert kit_item.thumbnail_url == "/api/v1/explainer/files/sandbox/nodehistory/kit-demo/render/poster.jpg"
    assert kit_item.player == "protocol"
    assert kit_item.videos == ["render/kit-final.mp4"]
    assert kit_item.updated_at and kit_item.updated_at.endswith("Z")
    assert kit_item.promotable
    assert kit_item.promote_blocker is None

    assert history.items[0].kind == "mapas"
    assert history.items[1].kind == "pizarra"
    action_item = by_folder["nodeaction"].items[0]
    assert action_item.kind == "nodeaction"
    assert action_item.videos == ["render/final.mp4"]
    assert action_item.notes_file == "PLAN.md"
    assert by_folder["nodemotion"].items[0].kind == "hyperframes"
    assert by_folder["nuevos"].items[0].kind == "reference"
    assert by_folder["nuevos"].items[0].videos == ["video.mp4"]
    assert [item.id for item in by_folder["nodeaction"].items] == ["action-demo"]


def test_detect_kind_prioritizes_engines_and_proto(tmp_path: Path):
    item = tmp_path / "item"
    _write(item / "index.html", '<script src="../../_proto/proto.js"></script>')
    assert sandbox_catalog.detect_kind(item) == "proto"

    _write(item / "index.html", '<script src="../_engine/core.js"></script><script src="../_mapas/map.js"></script>')
    assert sandbox_catalog.detect_kind(item) == "mapas"

    _write(item / "manifest.json", "{}")
    assert sandbox_catalog.detect_kind(item) == "explainer_kit"


def test_is_servable_allows_sandbox_files_and_shared_engines():
    assert explainer_router.is_servable(("sandbox", "x", "y", "index.html"))
    assert explainer_router.is_servable(("sandbox", "referencias", "nodehistory", "idea", "clip.mp4"))
    assert explainer_router.is_servable(("sandbox", "referencias", "nodeaction", "idea", "cover.jpg"))
    assert explainer_router.is_servable(("sandbox", "_proto", "proto.js"))
    assert explainer_router.is_servable(("sandbox", "nodeaction", "_engine", "core.js"))
    assert explainer_router.is_servable(("sandbox", "nodemotion", "_player", "adapter.js"))
    assert explainer_router.is_servable(("_tools", "player", "bridge.js"))
    assert explainer_router.is_servable(("_tools", "explainer-kit", "engine", "loader.js"))
    assert explainer_router.is_servable(("nodetech", "demo", "index.html"))


def test_is_servable_rejects_hidden_escape_logs_and_unknown_roots():
    assert not explainer_router.is_servable(("sandbox", "x", "y", ".secret"))
    assert not explainer_router.is_servable(("sandbox", "nodemotion", "_codex", "x.log"))
    assert not explainer_router.is_servable(("sandbox", "..", "nodetech", "index.html"))
    assert not explainer_router.is_servable(("outside", "folder", "index.html"))
    assert not explainer_router.is_servable(("sandbox", "_unknown", "file.js"))
    assert not explainer_router.is_servable(("sandbox", "referencias", "nodehistory", "idea", ".private.jpg"))
    assert not explainer_router.is_servable(("_tools", "otra-cosa", "x.js"))


async def test_sandbox_endpoint_returns_contract_shape(tmp_path: Path, monkeypatch, api_client):
    root = tmp_path / "sandbox"
    _write(root / "nuevos" / "demo" / "clip.mp4")
    monkeypatch.setattr(sandbox_catalog, "SANDBOX_DIR", root)

    response = await api_client.get("/api/v1/explainer/sandbox")

    assert response.status_code == 200
    assert response.json() == [
        {
            "folder": "nuevos",
            "label": "Nuevos",
            "role": "references",
            "category_id": None,
            "items": [
                {
                    "id": "demo",
                    "folder": "nuevos",
                    "subcategory": None,
                    "path": "sandbox/nuevos/demo",
                    "kind": "reference",
                    "title": "Demo",
                    "status": None,
                    "design": None,
                    "has_index": False,
                    "has_poster": False,
                    "has_info": False,
                    "total_tokens": None,
                    "thumbnail_url": None,
                    "player": "video",
                    "videos": ["clip.mp4"],
                    "notes_file": None,
                    "updated_at": None,
                    "promotable": False,
                    "promote_blocker": "Material de referencia",
                }
            ],
        }
    ]


async def test_references_are_listed_in_three_levels_with_category_and_thumbnail(tmp_path: Path, monkeypatch):
    sandbox_root = tmp_path / "templates" / "sandbox"
    item_dir = sandbox_root / "referencias" / "nodehistory" / "mapas-con-banderas"
    _write(item_dir / "From maps.mp4")
    _write(item_dir / "info.json", json.dumps({"title": "Mapas con banderas"}))

    folders = sandbox_catalog.list_sandbox(sandbox_root)
    references = next(folder for folder in folders if folder.folder == "referencias")

    assert references.role == "references"
    assert references.items[0].kind == "reference"
    assert references.items[0].folder == "referencias"
    assert references.items[0].subcategory == "nodehistory"
    assert references.items[0].path == "sandbox/referencias/nodehistory/mapas-con-banderas"
    assert references.items[0].videos == ["From maps.mp4"]
    assert references.items[0].has_info is True
    assert references.items[0].total_tokens is None
    assert references.items[0].thumbnail_url == (
        "/api/v1/explainer/sandbox/referencias/nodehistory/mapas-con-banderas/thumbnail.jpg"
    )


async def test_reference_info_endpoint_reads_three_level_item(tmp_path: Path, monkeypatch, api_client):
    sandbox_root = tmp_path / "templates" / "sandbox"
    item_dir = sandbox_root / "referencias" / "nodeaction" / "welcome-to-the-eng-pizarra"
    _write(item_dir / "info.json", json.dumps({"title": "Welcome to the English Narratives"}))
    monkeypatch.setattr(sandbox_catalog, "SANDBOX_DIR", sandbox_root)

    response = await api_client.get(
        "/api/v1/explainer/sandbox/referencias/nodeaction/welcome-to-the-eng-pizarra/info"
    )

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Welcome to the English Narratives"
    assert response.json()["total_tokens"] == 0
    assert response.json()["totals_by_model"] == []


async def test_reference_thumbnail_endpoint_uses_three_level_cache(tmp_path: Path, monkeypatch, api_client):
    sandbox_root = tmp_path / "templates" / "sandbox"
    item_dir = sandbox_root / "referencias" / "nodehistory" / "mapas-con-banderas"
    _write(item_dir / "clip.mp4")
    cache_file = tmp_path / "thumbs" / "nodehistory" / "mapas-con-banderas.jpg"
    cache_file.parent.mkdir(parents=True)
    cache_file.write_bytes(b"jpeg-data")
    monkeypatch.setattr(sandbox_catalog, "SANDBOX_DIR", sandbox_root)

    def cached_thumbnail(item: Path, category: str, item_id: str) -> Path:
        assert item == item_dir
        assert category == "nodehistory"
        assert item_id == "mapas-con-banderas"
        return cache_file

    monkeypatch.setattr(sandbox_thumbs, "ensure_reference_thumbnail", cached_thumbnail)
    response = await api_client.get(
        "/api/v1/explainer/sandbox/referencias/nodehistory/mapas-con-banderas/thumbnail.jpg"
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content == b"jpeg-data"


def test_sandbox_thumbnail_cache_regenerates_when_sources_are_newer(tmp_path: Path):
    item = tmp_path / "sandbox" / "nodehistory" / "demo"
    index = _write(item / "index.html", "<main>frame one</main>")
    manifest = _write(item / "manifest.json", '{"title":"demo"}')
    cache = tmp_path / "cache"
    captures: list[str] = []

    def capture(page_url: str, output_path: Path) -> None:
        captures.append(page_url)
        output_path.write_bytes(b"jpeg")

    first = sandbox_thumbs.ensure_thumbnail(item, "nodehistory", "demo", "http://capture", cache_dir=cache, capture=capture)
    assert first.read_bytes() == b"jpeg"
    sandbox_thumbs.ensure_thumbnail(item, "nodehistory", "demo", "http://capture", cache_dir=cache, capture=capture)
    assert captures == ["http://capture"]

    cached_mtime = first.stat().st_mtime_ns
    os.utime(index, ns=(cached_mtime + 2_000_000, cached_mtime + 2_000_000))
    sandbox_thumbs.ensure_thumbnail(item, "nodehistory", "demo", "http://capture", cache_dir=cache, capture=capture)
    assert len(captures) == 2

    cached_mtime = first.stat().st_mtime_ns
    os.utime(manifest, ns=(cached_mtime + 2_000_000, cached_mtime + 2_000_000))
    sandbox_thumbs.ensure_thumbnail(item, "nodehistory", "demo", "http://capture", cache_dir=cache, capture=capture)
    assert len(captures) == 3


async def test_sandbox_thumbnail_endpoint_generates_cache_and_validates_segments(
    tmp_path: Path, monkeypatch, api_client
):
    root = tmp_path / "templates" / "sandbox"
    item = root / "nodehistory" / "kit-demo"
    _write(item / "index.html", "<main>frame</main>")
    _write(item / "manifest.json", '{"design":"atlas"}')
    cache = tmp_path / "data" / "sandbox-thumbs"
    monkeypatch.setattr(sandbox_catalog, "SANDBOX_DIR", root)
    monkeypatch.setattr(sandbox_thumbs, "THUMB_CACHE_DIR", cache)
    captures: list[str] = []

    def capture(page_url: str, output_path: Path) -> None:
        captures.append(page_url)
        output_path.write_bytes(b"jpeg-data")

    monkeypatch.setattr(sandbox_thumbs, "_capture_thumbnail", capture)
    response = await api_client.get("/api/v1/explainer/sandbox/nodehistory/kit-demo/thumbnail.jpg")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content == b"jpeg-data"
    assert captures == [
        "http://127.0.0.1:8000/api/v1/explainer/files/sandbox/nodehistory/kit-demo/index.html?t=1"
    ]

    cached = await api_client.get("/api/v1/explainer/sandbox/nodehistory/kit-demo/thumbnail.jpg")
    invalid = await api_client.get("/api/v1/explainer/sandbox/._hidden/kit-demo/thumbnail.jpg")
    assert cached.status_code == 200
    assert invalid.status_code == 404
    assert len(captures) == 1


def _promotion_roots(tmp_path: Path, monkeypatch) -> Path:
    templates = tmp_path / "templates"
    monkeypatch.setattr(sandbox_catalog, "SANDBOX_DIR", templates / "sandbox")
    monkeypatch.setattr(sandbox_router, "get_producer", lambda: SimpleNamespace(list=lambda: []))
    monkeypatch.setattr(
        sandbox_router,
        "get_recorder",
        lambda: SimpleNamespace(list_jobs=lambda active=True: []),
    )
    return templates


def _promotion_item(templates: Path, folder: str, video_id: str, status: str = "listo") -> Path:
    source = templates / "sandbox" / folder / video_id
    _write(source / "index.html", '<script src="../../../_tools/explainer-kit/engine/loader.js"></script>')
    _write(source / "manifest.json", json.dumps({"title": video_id, "status": status, "design": "atlas"}))
    return source


async def test_sandbox_endpoint_reports_promotable_blockers_and_busy_message(tmp_path: Path, monkeypatch, api_client):
    templates = _promotion_roots(tmp_path, monkeypatch)
    _promotion_item(templates, "nodeeconomy", "ready-demo")
    _promotion_item(templates, "nodeeconomy", "work-in-progress", "en progreso")
    _promotion_item(templates, "nodeeconomy", "busy-demo")
    monkeypatch.setattr(
        sandbox_router,
        "get_producer",
        lambda: SimpleNamespace(list=lambda: [{"video_id": "busy-demo", "state": "producing"}]),
    )

    response = await api_client.get("/api/v1/explainer/sandbox")

    assert response.status_code == 200
    items = {item["id"]: item for item in response.json()[0]["items"]}
    assert items["ready-demo"]["promotable"] is True
    assert items["ready-demo"]["promote_blocker"] is None
    assert items["work-in-progress"]["promotable"] is False
    assert items["work-in-progress"]["promote_blocker"] == (
        "Estado «en progreso»: faltan pasos (kit.py status work-in-progress)"
    )
    assert items["busy-demo"]["promotable"] is False
    assert items["busy-demo"]["promote_blocker"] == sandbox_router.BUSY_MESSAGE


async def test_promote_sandbox_video_moves_item_and_returns_category(tmp_path: Path, monkeypatch, api_client):
    templates = _promotion_roots(tmp_path, monkeypatch)
    _promotion_item(templates, "nodeeconomy", "money-demo")

    response = await api_client.post("/api/v1/explainer/sandbox/nodeeconomy/money-demo/promote")

    assert response.status_code == 200
    assert response.json() == {
        "video_id": "money-demo",
        "from_path": "sandbox/nodeeconomy/money-demo",
        "to_path": "nodeeconomy/money-demo",
        "category_path": "node_economy",
    }
    assert not (templates / "sandbox" / "nodeeconomy" / "money-demo").exists()
    assert (templates / "nodeeconomy" / "money-demo" / "manifest.json").is_file()


async def test_promote_sandbox_video_returns_404_when_missing_or_id_invalid(tmp_path: Path, monkeypatch, api_client):
    _promotion_roots(tmp_path, monkeypatch)

    missing = await api_client.post("/api/v1/explainer/sandbox/nodeeconomy/missing/promote")
    invalid = await api_client.post("/api/v1/explainer/sandbox/nodeeconomy/._hidden/promote")

    assert missing.status_code == 404
    assert missing.json()["detail"] == "No existe sandbox/nodeeconomy/missing"
    assert invalid.status_code == 404
    assert invalid.json()["detail"] == "No existe sandbox/nodeeconomy/._hidden"


async def test_promote_sandbox_video_returns_409_when_not_ready(tmp_path: Path, monkeypatch, api_client):
    templates = _promotion_roots(tmp_path, monkeypatch)
    _promotion_item(templates, "nodeeconomy", "not-ready", "en progreso")

    response = await api_client.post("/api/v1/explainer/sandbox/nodeeconomy/not-ready/promote")

    assert response.status_code == 409
    assert response.json()["detail"] == "Estado «en progreso»: faltan pasos (kit.py status not-ready)"


async def test_promote_sandbox_video_returns_409_when_busy(tmp_path: Path, monkeypatch, api_client):
    templates = _promotion_roots(tmp_path, monkeypatch)
    _promotion_item(templates, "nodeeconomy", "busy-demo")
    monkeypatch.setattr(
        sandbox_router,
        "get_recorder",
        lambda: SimpleNamespace(
            list_jobs=lambda active=True: [SimpleNamespace(video_id="busy-demo", state="rendering")]
        ),
    )

    response = await api_client.post("/api/v1/explainer/sandbox/nodeeconomy/busy-demo/promote")

    assert response.status_code == 409
    assert response.json()["detail"] == sandbox_router.BUSY_MESSAGE
    assert (templates / "sandbox" / "nodeeconomy" / "busy-demo").is_dir()


async def test_promote_sandbox_video_returns_409_when_destination_exists(tmp_path: Path, monkeypatch, api_client):
    templates = _promotion_roots(tmp_path, monkeypatch)
    _promotion_item(templates, "nodeeconomy", "existing-demo")
    _write(templates / "nodeeconomy" / "existing-demo" / "sentinel", "already in production")

    response = await api_client.post("/api/v1/explainer/sandbox/nodeeconomy/existing-demo/promote")

    assert response.status_code == 409
    assert response.json()["detail"] == "Ya existe nodeeconomy/existing-demo en producción"


async def test_file_endpoint_serves_sandbox_and_blocks_codex(tmp_path: Path, monkeypatch):
    _write(tmp_path / "sandbox" / "nodeaction" / "demo" / "index.html", "<main>demo</main>")
    _write(tmp_path / "sandbox" / "nodeaction" / "_engine" / "core.js", "window.core = true")
    _write(tmp_path / "sandbox" / "nodeaction" / "_codex" / "logs.log", "private")
    _write(tmp_path / "sandbox" / "referencias" / "nodehistory" / "demo" / "cover.jpg", "image")
    monkeypatch.setattr(explainer_router, "TEMPLATES_DIR", tmp_path)

    async def file_status(file_path: str) -> int:
        request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})
        try:
            response = await explainer_router.get_explainer_file(file_path, request)
        except HTTPException as exc:
            return exc.status_code
        return response.status_code

    assert await file_status("sandbox/nodeaction/demo/index.html") == 200
    assert await file_status("sandbox/nodeaction/_engine/core.js") == 200
    assert await file_status("sandbox/nodeaction/_codex/logs.log") == 404
    assert await file_status("sandbox/referencias/nodehistory/demo/cover.jpg") == 200
    assert await file_status("sandbox/../outside.txt") == 404
