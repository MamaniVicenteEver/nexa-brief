"""Server-wide FIFO queue for pipeline runs.

Before this, every request built its own Orchestrator with its own
Semaphore(max_parallel_jobs), so three submissions could run six pipelines at
once — all piling up silently on the single global recorder slot. Now every
job waits here for one of `max_parallel_jobs` slots, in arrival order, and
each waiting job is told its position (pushed as `job_progress`).

Single-process, like the event bus: fine while uvicorn runs one worker. With
several workers or machines this becomes a real broker queue (Redis/SQS) —
the orchestrator only depends on `slot()`, so that swap stays local.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from src.config.settings import settings
from src.core.progress import get_or_create_tracker


class JobQueue:
    def __init__(self, max_parallel: int) -> None:
        self._slots = asyncio.Semaphore(max_parallel)  # wakes waiters in FIFO order
        self._waiting: list[str] = []

    def position(self, job_id: str) -> int | None:
        """1-based position among jobs still waiting; None if running or unknown."""
        return self._waiting.index(job_id) + 1 if job_id in self._waiting else None

    @property
    def waiting_count(self) -> int:
        return len(self._waiting)

    async def _announce_positions(self) -> None:
        for index, job_id in enumerate(self._waiting, start=1):
            await get_or_create_tracker(job_id).queued(index)

    @asynccontextmanager
    async def slot(self, job_id: str) -> AsyncIterator[None]:
        self._waiting.append(job_id)
        await self._announce_positions()
        try:
            await self._slots.acquire()
        finally:
            self._waiting.remove(job_id)
            await self._announce_positions()
        try:
            yield
        finally:
            self._slots.release()


_queue: JobQueue | None = None


def get_job_queue() -> JobQueue:
    global _queue
    if _queue is None:
        _queue = JobQueue(settings.max_parallel_jobs)
    return _queue
