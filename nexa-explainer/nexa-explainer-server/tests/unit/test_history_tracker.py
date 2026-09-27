"""Unit tests for history_tracker — append-only persistence of pipeline events."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.config.settings import settings
from src.core import history_tracker
from src.core.history import HistoryEvent
from src.core.job import JobStage


@pytest.fixture(autouse=True)
def _isolated_historial_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "historial_dir", tmp_path / "historial")


@pytest.mark.asyncio
async def test_append_event_persists_and_lists():
    event = HistoryEvent(job_id="job1", stage=JobStage.INPUT_ANALYZED, status="completed")
    await history_tracker.append_event(event)

    events = history_tracker.list_job_events("job1")
    assert len(events) == 1
    assert events[0].event_id == event.event_id
    assert events[0].stage == JobStage.INPUT_ANALYZED


@pytest.mark.asyncio
async def test_append_event_never_overwrites_previous():
    await history_tracker.append_event(HistoryEvent(job_id="job1", stage=JobStage.PENDING, status="completed"))
    await history_tracker.append_event(HistoryEvent(job_id="job1", stage=JobStage.INPUT_ANALYZED, status="completed"))
    await history_tracker.append_event(HistoryEvent(job_id="job1", stage=JobStage.FAILED, status="failed", message="boom"))

    events = history_tracker.list_job_events("job1")
    assert [e.stage for e in events] == [JobStage.PENDING, JobStage.INPUT_ANALYZED, JobStage.FAILED]
    assert events[-1].message == "boom"


@pytest.mark.asyncio
async def test_list_events_across_jobs_paginated_and_filtered():
    await history_tracker.append_event(HistoryEvent(job_id="job1", stage=JobStage.PACKAGED, status="completed"))
    await history_tracker.append_event(HistoryEvent(job_id="job2", stage=JobStage.FAILED, status="failed"))
    await history_tracker.append_event(HistoryEvent(job_id="job2", stage=JobStage.PENDING, status="completed"))

    all_events, total = history_tracker.list_events(limit=2, offset=0)
    assert total == 3
    assert len(all_events) == 2

    failed_only, failed_total = history_tracker.list_events(stage=JobStage.FAILED, limit=20, offset=0)
    assert failed_total == 1
    assert failed_only[0].job_id == "job2"


@pytest.mark.asyncio
async def test_delete_job_history_removes_file_and_index_entry():
    await history_tracker.append_event(HistoryEvent(job_id="job1", stage=JobStage.PENDING, status="completed"))

    deleted = await history_tracker.delete_job_history("job1")
    assert deleted is True
    assert history_tracker.list_job_events("job1") == []

    events, total = history_tracker.list_events(limit=20, offset=0)
    assert total == 0

    assert await history_tracker.delete_job_history("job1") is False


def test_from_job_maps_failed_stage_to_failed_status():
    from src.core.job import Job, JobInput

    job = Job(input=JobInput(category_name="lofi")).fail("input_analyzer blew up")
    event = HistoryEvent.from_job(job)
    assert event.status == "failed"
    assert event.message == "input_analyzer blew up"


def test_from_job_maps_non_failed_stage_to_completed_status():
    from src.core.job import Job, JobInput

    job = Job(input=JobInput(category_name="lofi")).advance(JobStage.PACKAGED)
    event = HistoryEvent.from_job(job)
    assert event.status == "completed"
    assert event.message is None
