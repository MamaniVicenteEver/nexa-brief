"""Unit tests for job progress tracking, the global job queue and render progress parsing."""

from __future__ import annotations

import asyncio
import sys

import pytest

from src.adapters.recorder.infrastructure.subprocess_progress import (
    parse_percent,
    parse_remotion_event,
    run_with_progress,
)
from src.core.job_queue import JobQueue
from src.core.progress import tracker as tracker_module
from src.core.progress.estimator import StepDurationEstimator, recorder_key
from src.core.progress.models import JobProgress


class _MemoryDocuments:
    """DocumentStore en memoria — el estimador solo necesita get/put."""

    name = "progress"

    def __init__(self) -> None:
        self._docs: dict = {}

    def get(self, key):
        return self._docs.get(key)

    def put(self, key, document):
        self._docs[key] = dict(document)

    def delete(self, key):
        return self._docs.pop(key, None) is not None


@pytest.fixture
def published(monkeypatch) -> list[JobProgress]:
    events: list[JobProgress] = []

    async def publisher(progress: JobProgress) -> None:
        events.append(progress)

    monkeypatch.setattr(tracker_module, "publish_to_realtime", publisher)
    monkeypatch.setattr(tracker_module, "get_estimator", lambda: StepDurationEstimator(_MemoryDocuments()))
    tracker_module._trackers.clear()
    return events


def _tracker(job_id: str) -> tracker_module.ProgressTracker:
    return tracker_module.get_or_create_tracker(job_id)


# ── estimator ───────────────────────────────────────────────────────────────

def test_estimator_learns_and_scales_recording_with_video_length(tmp_path):
    store = _MemoryDocuments()
    est = StepDurationEstimator(store)
    assert est.estimate("html_generator", None) == 45            # default guess
    est.record("html_generator", 20, None)
    assert est.estimate("html_generator", None) == 20            # first sample replaces the guess
    est.record("html_generator", 30, None)
    assert est.estimate("html_generator", None) == pytest.approx(23)  # EMA
    key = recorder_key("playwright")
    assert est.estimate(key, 120) > est.estimate(key, 60)        # longer video, longer recording
    assert StepDurationEstimator(store).estimate("html_generator", None) == pytest.approx(23)  # persisted


# ── tracker ─────────────────────────────────────────────────────────────────

async def test_tracker_percent_follows_steps_and_reported_fraction(published):
    t = _tracker("job-1")
    t.set_plan([("a", "a"), ("b", "b")], video_seconds=None)   # both default to 15 s
    await t.queued(2)
    assert published[-1].status == "queued" and published[-1].queue_position == 2

    await t.start_step("a")
    snap = t.snapshot()
    assert (snap.status, snap.step, snap.step_index, snap.step_count) == ("running", "a", 1, 2)
    assert snap.queue_position is None

    await t.start_step("b")
    t.report_fraction(0.5)
    snap = t.snapshot()
    assert snap.percent == pytest.approx(75, abs=0.5)           # a done (50%) + half of b
    assert snap.step_percent == 50
    t.report_fraction(0.2)
    assert t.snapshot().step_percent == 50                      # never goes backwards

    await t.finish(success=True)
    assert published[-1].status == "done" and published[-1].percent == 100


async def test_time_based_fraction_is_capped_below_full(published, monkeypatch):
    t = _tracker("job-2")
    t.set_plan([("slow", "slow")], video_seconds=None)
    await t.start_step("slow")
    monkeypatch.setattr(tracker_module.time, "monotonic", lambda: t._step_started + 10_000)
    assert t.snapshot().percent <= 95
    await t.finish(success=False)
    assert published[-1].status == "failed" and published[-1].eta_seconds is None


async def test_latest_snapshot_survives_release(published):
    t = _tracker("job-3")
    t.set_plan([("a", "a")], None)
    await t.start_step("a")
    await t.finish(success=True)
    tracker_module.release_tracker("job-3")
    assert tracker_module.get_progress("job-3").status == "done"


# ── queue ───────────────────────────────────────────────────────────────────

async def test_queue_is_fifo_and_announces_positions(published):
    queue = JobQueue(max_parallel=1)
    order: list[str] = []
    release_first = asyncio.Event()

    async def run(job_id: str, wait: asyncio.Event | None = None) -> None:
        async with queue.slot(job_id):
            order.append(job_id)
            if wait:
                await wait.wait()

    first = asyncio.create_task(run("j1", release_first))
    await asyncio.sleep(0)
    others = [asyncio.create_task(run(j)) for j in ("j2", "j3")]
    await asyncio.sleep(0.01)
    assert queue.position("j2") == 1 and queue.position("j3") == 2
    assert tracker_module._trackers["j3"].snapshot().queue_position == 2

    release_first.set()
    await asyncio.gather(first, *others)
    assert order == ["j1", "j2", "j3"]
    assert queue.waiting_count == 0


# ── render output parsing ───────────────────────────────────────────────────

def test_parsers():
    assert parse_percent("Rendering  42% |████") == pytest.approx(0.42)
    assert parse_percent("frame 10 (12.5 %)") == pytest.approx(0.125)
    assert parse_percent("no progress here") is None
    line = '{"type":"progress","renderedFrames":50,"encodedFrames":30,"totalFrames":100}'
    assert parse_remotion_event(line) == pytest.approx(0.4)
    assert parse_remotion_event('{"type":"done"}') is None
    assert parse_remotion_event("not json") is None


async def test_run_with_progress_reports_live_and_keeps_tails(tmp_path, monkeypatch):
    reported: list[float] = []
    monkeypatch.setattr(
        "src.adapters.recorder.infrastructure.subprocess_progress.report_step_progress", reported.append
    )
    script = "import sys\nfor p in (10, 55, 100):\n    print(f'{p}%', flush=True)\nprint('oops', file=sys.stderr)\n"
    result = await run_with_progress(
        [sys.executable, "-c", script], cwd=tmp_path, timeout=10, parse_progress=parse_percent
    )
    assert result.returncode == 0
    assert reported == pytest.approx([0.10, 0.55, 1.0])
    assert "oops" in result.stderr_tail


async def test_run_with_progress_timeout_kills_process(tmp_path):
    with pytest.raises(asyncio.TimeoutError):
        await run_with_progress(
            [sys.executable, "-c", "import time; time.sleep(5)"], cwd=tmp_path, timeout=0.3, parse_progress=parse_percent
        )
