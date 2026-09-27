from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.core import history_tracker, job_tracker
from src.core.history import HistoryEvent
from src.core.job import Job, JobInput, JobStage
from src.presentation.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_dirs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "historial_dir", tmp_path / "historial")
    monkeypatch.setattr(settings, "jobs_library_dir", tmp_path / "jobs_library")


def test_get_job_history_unknown_job_404():
    r = client.get("/api/v1/videos/does-not-exist/history")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_job_history_returns_timeline():
    from src.config.niche_config import get_niche_config

    job = Job(input=JobInput(category_name="image_bg_portrait"))
    await job_tracker.create(job, get_niche_config("image_bg_portrait"))
    await history_tracker.append_event(HistoryEvent(job_id=job.job_id, stage=JobStage.PENDING, status="completed"))
    await history_tracker.append_event(HistoryEvent(job_id=job.job_id, stage=JobStage.INPUT_ANALYZED, status="completed"))

    r = client.get(f"/api/v1/videos/{job.job_id}/history")
    assert r.status_code == 200
    body = r.json()
    assert body["job_id"] == job.job_id
    assert [e["stage"] for e in body["events"]] == ["pending", "input_analyzed"]


@pytest.mark.asyncio
async def test_list_history_paginates_and_filters_by_stage():
    await history_tracker.append_event(HistoryEvent(job_id="j1", stage=JobStage.FAILED, status="failed", message="x"))
    await history_tracker.append_event(HistoryEvent(job_id="j2", stage=JobStage.PACKAGED, status="completed"))

    r = client.get("/api/v1/history", params={"stage": "failed"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["events"][0]["job_id"] == "j1"
