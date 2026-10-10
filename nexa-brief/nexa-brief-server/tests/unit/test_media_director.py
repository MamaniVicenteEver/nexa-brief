"""F4 — director de medios: consultas por slot, búsqueda, selección y aceptación."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from src.core import media_director
from src.core.ports.ai_port import AIPort
from src.core.ports.stock_media_port import StockItem
from src.core.stock import StockSearchResult
from src.presentation.api.routers import media_plans as media_plans_router
from src.presentation.main import app

REQUIREMENTS = {
    "media": [
        {"slot": "clips", "kind": "video", "count": None, "min": 1, "max": 2, "orientation": "landscape",
         "target": "media", "label": "Videos", "hint": "acción deportiva"},
        {"slot": "photos", "kind": "image", "count": 1, "min": 1, "max": 1, "orientation": None,
         "target": "media", "label": "Fotos", "hint": "atletas"},
    ],
}


def _item(provider: str, pid: str, kind: str, w: int, h: int) -> StockItem:
    return StockItem(provider=provider, provider_id=pid, kind=kind, preview_url="https://p/x.jpg",
                     download_url=f"https://d/{pid}", width=w, height=h,
                     duration_seconds=10.0 if kind == "video" else None)


class FakeSearch:
    def __init__(self):
        self.calls: list[tuple] = []

    async def __call__(self, query, kind, *, orientation=None, per_page=15):
        self.calls.append((query, kind, orientation))
        if kind == "video":
            items = [_item("pexels", "v1", "video", 1080, 1920),   # vertical: peor rank
                     _item("pixabay", "v2", "video", 1920, 1080),
                     _item("pexels", "v3", "video", 1280, 720)]
        else:
            items = [_item("unsplash", "i1", "image", 2560, 1707)]
        return StockSearchResult(results=items)


class FakeAI(AIPort):
    def __init__(self, response=None, fail=False):
        self.response, self.fail = response, fail

    async def complete_json(self, system_prompt, user_prompt):
        if self.fail:
            raise RuntimeError("sin cuota")
        return self.response

    async def complete_text(self, system_prompt, user_prompt):
        return ""


async def test_plan_with_ai_queries_and_default_selection():
    plan = await media_director.create_plan("promo-x", REQUIREMENTS, brief="Gimnasio de boxeo")
    assert plan["status"] == "planning" and plan["progress"] == {"done": 0, "total": 2}
    search = FakeSearch()
    ai = FakeAI({"queries": {"clips": "boxing gym training", "photos": "\"boxer portrait\""}})
    plan = await media_director.run_plan(plan["plan_id"], search=search, ai=ai)

    assert plan["status"] == "ready"
    assert len(search.calls) == 2  # una consulta por slot
    assert search.calls[0] == ("boxing gym training", "video", "landscape")
    clips = plan["slots"][0]
    assert clips["query"] == "boxing gym training"
    # Orientación correcta y ≥1080 primero; el vertical queda afuera.
    assert clips["selected"] == ["pixabay:v2", "pexels:v3"]
    assert plan["slots"][1]["query"] == "boxer portrait"
    assert plan["progress"] == {"done": 2, "total": 2}


async def test_fallback_queries_and_locks():
    plan = await media_director.create_plan(
        "promo-x", REQUIREMENTS, brief=None, description="Promo deportiva urbana", locks={"photos": ["img1"]},
    )
    search = FakeSearch()
    plan = await media_director.run_plan(plan["plan_id"], search=search, ai=FakeAI(fail=True))
    assert plan["status"] == "ready"
    assert len(search.calls) == 1  # el slot bloqueado no se busca
    assert search.calls[0][0] == "Promo deportiva urbana acción deportiva"

    plan = await media_director.update_selection(plan["plan_id"], {"clips": ["0"]})
    assert plan["slots"][0]["selected"] == ["pexels:v1"]

    imported: list[str] = []

    async def importer(item: StockItem) -> str:
        imported.append(item.provider_id)
        return f"asset-{item.provider_id}"

    media = await media_director.accept_plan(plan["plan_id"], importer=importer)
    assert media == {"clips": ["asset-v1"], "photos": ["img1"]}
    assert imported == ["v1"]


async def test_ai_numbered_keys_are_tolerated():
    # Visto con Gemini real: con "6 elementos" devolvía una consulta por elemento.
    plan = await media_director.create_plan("promo-x", REQUIREMENTS, brief="boxeo")
    ai = FakeAI({"queries": {"clips_10": "z", "clips_1": "boxing heavy bag", "clips_2": "speed bag"}})
    plan = await media_director.run_plan(plan["plan_id"], search=FakeSearch(), ai=ai)
    assert plan["slots"][0]["query"] == "boxing heavy bag"
    assert plan["slots"][1]["query"] == "boxeo atletas"  # sin clave para photos → fallback


async def test_failed_search_marks_plan_failed():
    plan = await media_director.create_plan("promo-x", REQUIREMENTS)

    async def broken(*_a, **_k):
        raise RuntimeError("boom")

    plan = await media_director.run_plan(plan["plan_id"], search=broken, ai=None)
    assert plan["status"] == "failed" and "boom" in plan["error"]


async def test_stale_planning_plan_is_failed():
    plan = await media_director.create_plan("promo-x", REQUIREMENTS)
    fresh = await media_director.fail_if_stale(plan["plan_id"])
    assert fresh["status"] == "planning"
    later = datetime.now(timezone.utc) + media_director.STALE_PLANNING_AFTER + timedelta(seconds=1)
    stale = await media_director.fail_if_stale(plan["plan_id"], now=later)
    assert stale["status"] == "failed" and stale["error"]


def test_router_flow(monkeypatch):
    search = FakeSearch()
    monkeypatch.setattr(media_plans_router, "search_stock", search)
    monkeypatch.setattr(media_plans_router, "_analysis_ai", lambda: None)

    async def fake_import(item: StockItem) -> str:
        return f"asset-{item.provider_id}"

    monkeypatch.setattr(media_plans_router, "_import_item", fake_import)
    with TestClient(app) as client:
        r = client.post("/api/v1/media-plans", json={"template_id": "promo-dynamic", "brief": "running"})
        assert r.status_code == 202
        plan_id = r.json()["plan_id"]
        for _ in range(50):
            body = client.get(f"/api/v1/media-plans/{plan_id}").json()
            if body["status"] != "planning":
                break
            time.sleep(0.02)
        assert body["status"] == "ready"
        assert {s["slot"] for s in body["slots"]} == {"clips", "photos"}

        bad = client.patch(f"/api/v1/media-plans/{plan_id}", json={"selected": {"clips": ["nope:1"]}})
        assert bad.status_code == 409
        ok = client.patch(f"/api/v1/media-plans/{plan_id}", json={"selected": {"clips": ["pixabay:v2"]}})
        assert ok.json()["slots"][0]["selected"] == ["pixabay:v2"]

        acc = client.post(f"/api/v1/media-plans/{plan_id}/accept")
        assert acc.status_code == 200
        assert acc.json()["template_inputs"]["media"]["clips"] == ["asset-v2"]

        assert client.get("/api/v1/media-plans/missing").status_code == 404
        assert client.post("/api/v1/media-plans", json={"template_id": "nope"}).status_code == 404
        assert client.post("/api/v1/media-plans", json={"template_id": "promo-dynamic",
                                                        "locks": {"zzz": ["a"]}}).status_code == 400
