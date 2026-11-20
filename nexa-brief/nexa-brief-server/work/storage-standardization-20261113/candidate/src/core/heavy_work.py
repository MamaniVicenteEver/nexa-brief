"""One FIFO lane for local transcription and recording in the API process.

The pipeline queue alone cannot serialize music-library background work.
Keep the heavy lane separate so a preview never holds a pipeline slot while
waiting for another task's transcription of the same song.
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager, suppress
import time
from typing import Any
import weakref

import structlog

logger = structlog.get_logger(__name__)


class HeavyWorkQueue:
    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.owner: asyncio.Task | None = None
        self.waiting: list[dict[str, str]] = []

    @asynccontextmanager
    async def slot(self, kind: str, identity: str) -> AsyncIterator[None]:
        task = asyncio.current_task()
        # The library owns the visible status; the adapter also protects direct
        # callers. Nested acquisition in the same task must not deadlock.
        if self.owner is task:
            yield
            return
        ticket = {"kind": kind, "identity": identity}
        self.waiting.append(ticket)
        started = time.monotonic()
        logger.info("heavy_work_queued", **ticket, position=len(self.waiting))
        acquired = False
        try:
            await self.lock.acquire()
            acquired = True
            self.waiting.remove(ticket)
            self.owner = task
            logger.info("heavy_work_started", **ticket, waited_seconds=round(time.monotonic() - started, 3))
            yield
        finally:
            if ticket in self.waiting:
                self.waiting.remove(ticket)
            if acquired:
                self.owner = None
                self.lock.release()
                logger.info("heavy_work_finished", **ticket)


_queues: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, HeavyWorkQueue] = weakref.WeakKeyDictionary()


def heavy_work_slot(kind: str, identity: str):
    loop = asyncio.get_running_loop()
    queue = _queues.get(loop)
    if queue is None:
        queue = _queues[loop] = HeavyWorkQueue()
    return queue.slot(kind, identity)


async def finish_thread(function: Callable[..., Any], *args):
    """Cancellation must not free the lane while a CPU thread still runs."""
    work = asyncio.create_task(asyncio.to_thread(function, *args))
    try:
        return await asyncio.shield(work)
    except asyncio.CancelledError:
        while not work.done():
            try:
                await asyncio.shield(work)
            except asyncio.CancelledError:
                continue
            except Exception:
                break
        with suppress(Exception):
            work.result()
        raise
