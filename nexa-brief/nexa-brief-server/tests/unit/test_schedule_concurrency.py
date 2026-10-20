from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.core.data import collection
from src.core.schedule import engine, queue_repository
from src.core.schedule.models import QueueEntry, QueueSource, QueueStatus


@pytest.mark.asyncio
async def test_recover_stale_publishing_leaves_in_flight_entries_untouched(monkeypatch):
    queue_repository._in_flight.clear()
    monkeypatch.setattr(queue_repository, "_publish_event", AsyncMock())
    stale = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    for entry_id in ("upload-in-progress", "crashed-upload"):
        entry = QueueEntry(
            entry_id=entry_id,
            job_id="job-1",
            platform="youtube",
            account_alias="canal_1",
            source=QueueSource.IMMEDIATE,
            status=QueueStatus.PUBLISHING,
            created_at=stale,
            updated_at=stale,
        )
        await collection("queue_entries").insert(entry.model_dump(mode="json"))
    queue_repository._in_flight.add("upload-in-progress")

    recovered = await queue_repository.recover_stale_publishing()

    assert recovered == 1
    assert collection("queue_entries").get("upload-in-progress")["status"] == "publishing"
    assert collection("queue_entries").get("crashed-upload")["status"] == "failed"
    queue_repository._in_flight.clear()


@pytest.mark.asyncio
async def test_concurrent_process_tick_skips_while_first_tick_runs(monkeypatch):
    entered = asyncio.Event()
    release = asyncio.Event()

    async def slow_tick(_facade, _now):
        entered.set()
        await release.wait()
        return {"due_processed": 0}

    monkeypatch.setattr(engine, "_process_tick", slow_tick)
    first = asyncio.create_task(engine.process_tick(object()))
    try:
        await asyncio.wait_for(entered.wait(), timeout=1)
        second = await engine.process_tick(object())
    finally:
        release.set()

    first_result = await first
    assert second == {"skipped": "previous_tick_running"}
    assert first_result == {"due_processed": 0}
