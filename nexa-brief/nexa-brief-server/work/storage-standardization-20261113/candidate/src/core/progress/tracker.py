"""Live progress of each job: which step is running, % done, time left, queue position.

One `ProgressTracker` per job, kept in an in-memory registry. The pipeline
calls `start_step`/`finish`; long steps (renders) report their own fraction
through `report_step_progress()`, which finds the current job's tracker via a
ContextVar — so adapters don't need a progress parameter threaded through
every signature. While a job runs, a small ticker republishes progress every
couple of seconds so steps without fine-grained reporting still move
(time-based, capped below 100% until the step really ends).
"""

from __future__ import annotations

import asyncio
import contextlib
import time
from collections.abc import Awaitable, Callable, Iterator
from contextvars import ContextVar
from dataclasses import dataclass

import structlog

from src.core.progress.estimator import StepDurationEstimator, get_estimator
from src.core.progress.models import JobProgress, ProgressStatus
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)

Publisher = Callable[[JobProgress], Awaitable[None]]

TICK_SECONDS = 2.0
_TIME_BASED_CAP = 0.95        # a step without its own reporting never shows 100% before it ends
_MAX_FINISHED_KEPT = 200


async def publish_to_realtime(progress: JobProgress) -> None:
    await get_event_bus().publish(RealtimeEvent(type="job_progress", data=progress.model_dump()))


@dataclass
class _Step:
    name: str
    key: str            # estimator key (recorder steps include the engine)
    estimate: float     # seconds


class ProgressTracker:
    def __init__(self, job_id: str, publisher: Publisher, estimator: StepDurationEstimator) -> None:
        self.job_id = job_id
        self._publish = publisher
        self._estimator = estimator
        self._steps: list[_Step] = []
        self._current = -1
        self._step_started = 0.0
        self._reported_fraction: float | None = None
        self._video_seconds: float | None = None
        self._status: ProgressStatus = "queued"
        self._queue_position: int | None = None
        self._started_at: float | None = None
        self._ticker: asyncio.Task | None = None

    # ── lifecycle ───────────────────────────────────────────────────────────

    async def queued(self, position: int) -> None:
        if self._status == "queued" and self._queue_position == position:
            return
        self._status, self._queue_position = "queued", position
        await self.publish()

    def set_plan(self, steps: list[tuple[str, str]], video_seconds: float | None) -> None:
        """`steps` = [(name, estimator_key)] in execution order."""
        self._video_seconds = video_seconds
        self._steps = [_Step(name, key, self._estimator.estimate(key, video_seconds)) for name, key in steps]

    def update_video_seconds(self, video_seconds: float | None) -> None:
        """Duration is often only known after resources are fetched — re-estimate what's left."""
        if not video_seconds or video_seconds == self._video_seconds:
            return
        self._video_seconds = video_seconds
        for step in self._steps[self._current + 1 :]:
            step.estimate = self._estimator.estimate(step.key, video_seconds)

    async def start_step(self, name: str) -> None:
        self._close_current_step()
        self._current = next((i for i, s in enumerate(self._steps) if s.name == name), self._current + 1)
        self._step_started = time.monotonic()
        self._reported_fraction = None
        if self._status != "running":
            self._status, self._queue_position = "running", None
            self._started_at = time.time()
            self._ticker = asyncio.create_task(self._tick())
        await self.publish()

    def report_fraction(self, fraction: float) -> None:
        """Monotonic within a step: a multi-pass step (e.g. several recordings) never goes backwards."""
        fraction = min(max(fraction, 0.0), 1.0)
        self._reported_fraction = max(fraction, self._reported_fraction or 0.0)

    async def finish(self, success: bool) -> None:
        if success:
            self._close_current_step()
        self._status = "done" if success else "failed"
        if self._ticker is not None:
            self._ticker.cancel()
        await self.publish()

    # ── computation ────────────────────────────────────────────────────────

    def _close_current_step(self) -> None:
        if 0 <= self._current < len(self._steps):
            step = self._steps[self._current]
            self._estimator.record(step.key, time.monotonic() - self._step_started, self._video_seconds)

    def _step_fraction(self) -> float:
        if self._reported_fraction is not None:
            return self._reported_fraction
        step = self._steps[self._current]
        return min((time.monotonic() - self._step_started) / max(step.estimate, 1.0), _TIME_BASED_CAP)

    def snapshot(self) -> JobProgress:
        base = JobProgress(
            job_id=self.job_id,
            status=self._status,
            step_count=len(self._steps),
            queue_position=self._queue_position,
            started_at=self._started_at,
        )
        if self._status == "done":
            return base.model_copy(update={"percent": 100.0, "eta_seconds": 0, "step_index": len(self._steps)})
        if not (0 <= self._current < len(self._steps)):
            return base

        step = self._steps[self._current]
        fraction = self._step_fraction()
        total = sum(s.estimate for s in self._steps) or 1.0
        done = sum(s.estimate for s in self._steps[: self._current])
        elapsed_step = time.monotonic() - self._step_started
        if self._reported_fraction and self._reported_fraction > 0.02:
            step_left = elapsed_step * (1 - fraction) / fraction   # extrapolate from real speed
        else:
            step_left = max(step.estimate - elapsed_step, step.estimate * 0.1)
        remaining = step_left + sum(s.estimate for s in self._steps[self._current + 1 :])

        return base.model_copy(update={
            "step": step.name,
            "step_index": self._current + 1,
            "percent": round(min(99.0, 100 * (done + step.estimate * fraction) / total), 1),
            "step_percent": round(100 * self._reported_fraction, 1) if self._reported_fraction is not None else None,
            "eta_seconds": None if self._status == "failed" else int(remaining),
        })

    async def publish(self) -> None:
        snapshot = self.snapshot()
        _latest[self.job_id] = snapshot
        try:
            await self._publish(snapshot)
        except Exception as exc:
            logger.warning("progress_publish_failed", job_id=self.job_id, error=str(exc))

    async def _tick(self) -> None:
        with contextlib.suppress(asyncio.CancelledError):
            while True:
                await asyncio.sleep(TICK_SECONDS)
                await self.publish()


# ── registry ────────────────────────────────────────────────────────────────

_trackers: dict[str, ProgressTracker] = {}
_latest: dict[str, JobProgress] = {}
_current_tracker: ContextVar[ProgressTracker | None] = ContextVar("current_progress_tracker", default=None)


def get_or_create_tracker(job_id: str, publisher: Publisher | None = None) -> ProgressTracker:
    tracker = _trackers.get(job_id)
    if tracker is None:
        tracker = _trackers[job_id] = ProgressTracker(job_id, publisher or publish_to_realtime, get_estimator())
    return tracker


def release_tracker(job_id: str) -> None:
    """Drop the live tracker; its last snapshot stays readable via get_progress()."""
    _trackers.pop(job_id, None)
    while len(_latest) > _MAX_FINISHED_KEPT:
        _latest.pop(next(iter(_latest)))


def get_progress(job_id: str) -> JobProgress | None:
    return _latest.get(job_id)


@contextlib.contextmanager
def bind_tracker(tracker: ProgressTracker) -> Iterator[None]:
    token = _current_tracker.set(tracker)
    try:
        yield
    finally:
        _current_tracker.reset(token)


def report_step_progress(fraction: float) -> None:
    """Called by long-running steps (renders) with 0.0-1.0; no-op outside a tracked job."""
    tracker = _current_tracker.get()
    if tracker is not None:
        tracker.report_fraction(fraction)
