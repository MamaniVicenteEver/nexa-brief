"""Piloto automático por categoría: resumen del dashboard, pregrabación y
producción automática desde el plan. Grabador y productor falsos."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.core import automation
from src.core.automation import autoproduce_due, category_overview, next_occurrence, prerecord_due
from src.core.data import collection
from src.core.explainer import catalog
from src.core.explainer.producer import readable_log
from src.core.schedule import planner
from src.core.schedule.models import ScheduleSlot
from src.presentation.main import app

MONDAY_9 = datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc)


def _slot(days, times) -> ScheduleSlot:
    return ScheduleSlot(slot_id="s", platform="youtube", account_alias="a", days=days, times=times,
                        created_at="", updated_at="")


def test_next_occurrence():
    assert next_occurrence(_slot([0], ["15:00"]), MONDAY_9) == datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)
    assert next_occurrence(_slot([0], ["08:00"]), MONDAY_9) == datetime(2026, 10, 19, 8, 0, tzinfo=timezone.utc)
    assert next_occurrence(_slot([2], ["10:00", "07:00"]), MONDAY_9) == datetime(2026, 10, 14, 7, 0, tzinfo=timezone.utc)


@pytest.fixture
def videos(tmp_path: Path, monkeypatch):
    root = tmp_path / "videos"
    for vid, design, status in (("t1", "rough", "listo"), ("t2", "rough", "listo"), ("h1", "binary", "en progreso")):
        d = root / vid
        (d / "render").mkdir(parents=True)
        (d / "manifest.json").write_text(json.dumps({"design": design, "status": status, "title": vid}))
        (d / "publish.json").write_text(json.dumps({"youtube_title": f"T {vid}"}))
    monkeypatch.setattr(automation, "list_videos", lambda: catalog.list_videos(root))
    return root


class _Recorder:
    def __init__(self) -> None:
        self._jobs: dict = {}
        self.submitted: list[str] = []

    def submit(self, video, duration="10", **_):
        assert duration == "full"
        self.submitted.append(video.video_id)
        self._jobs[video.video_id] = SimpleNamespace(video_id=video.video_id, state=SimpleNamespace(value="rendering"))
        return SimpleNamespace(job_id="j")


async def test_prerecord_records_oldest_ready_video_once(videos, monkeypatch):
    monkeypatch.setattr(settings, "schedule_prerecord_enabled", True)
    monkeypatch.setattr(settings, "schedule_prerecord_hours", 12)
    await planner.create_category_automation("node_tech", ["youtube:tech"], "daily", ["15:00"])
    rec = _Recorder()
    assert await prerecord_due(MONDAY_9, rec) == ["t1"]
    # ya hay una grabación en curso para la categoría: no lanza otra
    assert await prerecord_due(MONDAY_9, rec) == []
    # NodeHistory no tiene horarios: nada
    assert rec.submitted == ["t1"]


async def test_prerecord_skips_when_slot_far_or_already_recorded(videos, monkeypatch):
    monkeypatch.setattr(settings, "schedule_prerecord_hours", 2)
    await planner.create_category_automation("node_tech", ["youtube:tech"], "daily", ["15:00"])
    assert await prerecord_due(MONDAY_9, _Recorder()) == []  # 15:00 queda a 6 h
    monkeypatch.setattr(settings, "schedule_prerecord_hours", 12)
    await collection("jobs").insert({"job_id": "x", "category": "node_tech", "stage": "packaged",
                                     "source": "explainer", "video_id": "t1", "created_at": "1"})
    # ya hay un job empaquetado para ese canal → no hace falta pregrabar
    assert await prerecord_due(MONDAY_9, _Recorder()) == []


class _Producer:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def submit(self, **kw):
        self.calls.append(kw)
        return {"production_id": f"p{len(self.calls)}"}


async def test_autoproduce_takes_next_approved_item(monkeypatch):
    monkeypatch.setattr(settings, "schedule_autoproduce_enabled", True)
    monkeypatch.setattr(settings, "schedule_autoproduce_hours", 48)
    await planner.save_plan([
        planner.PlanItem(date="2026-10-20", category_path="node_tech", design="rough", topic="lejos"),
        planner.PlanItem(date="2026-10-13", category_path="node_tech", design="rough", topic="mañana", angle="A"),
        planner.PlanItem(date="2026-10-12", category_path="node_motion/letras", topic="canción"),
    ])
    links: list[tuple] = []

    async def link(item_id, prod_id):
        links.append((item_id, prod_id))
        await planner.link_production(item_id, prod_id)

    prod = _Producer()
    done = await autoproduce_due(MONDAY_9, prod, link)
    assert len(done) == 1 and prod.calls[0]["topic"] == "mañana" and prod.calls[0]["auto_record"] is True
    assert links[0][1] == "p1"
    # con una producción activa no lanza otra
    await collection("explainer_productions").insert({"production_id": "p1", "state": "producing", "category_path": "node_tech"})
    assert await autoproduce_due(MONDAY_9, prod, link) == []


async def test_overview_reports_funnel_and_gaps(videos, monkeypatch):
    monkeypatch.setattr(settings, "enable_auto_publishing", False)
    await planner.create_category_automation("node_tech", ["youtube:tech"], "daily", ["15:00"])
    data = {c["id"]: c for c in category_overview(MONDAY_9)}
    tech = data["node_tech"]
    assert tech["pipeline"]["ready_to_record"] == 2
    assert tech["schedule"]["channels"] == ["youtube:tech"]
    assert tech["schedule"]["next_at"].startswith("2026-10-12T15:00")
    assert "autopublish_off" in tech["missing"] and "no_schedule" not in tech["missing"]
    assert "no_schedule" in data["node_history"]["missing"]
    assert "empty_category" in data["node_politics"]["missing"]
    assert data["node_motion"]["content"]["templates"] == 35


def test_overview_route():
    r = TestClient(app).get("/api/v1/categories/overview")
    assert r.status_code == 200 and [c["id"] for c in r.json()][:2] == ["node_tech", "node_history"]


def test_readable_log():
    raw = "\n".join([
        "$ claude -p …",
        json.dumps({"type": "assistant", "message": {"content": [{"type": "text", "text": "Leo la guía"},
                    {"type": "tool_use", "name": "Bash", "input": {"command": "python kit.py voice v1"}}]}}),
        json.dumps({"type": "user", "message": {}}),
        json.dumps({"type": "result", "result": "Video listo"}),
    ])
    assert readable_log(raw).splitlines() == ["$ claude -p …", "· Leo la guía", "→ Bash: python kit.py voice v1", "✓ terminado: Video listo"]
