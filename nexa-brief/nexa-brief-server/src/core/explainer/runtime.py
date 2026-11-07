"""Shared admission and resource budgets for the JSON/single-host deployment.

File leases coordinate CLI, development and Docker on the same DATA_DIR. A future
multi-host deployment replaces this adapter with database/broker leases.
"""
from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager, contextmanager

from src.config.settings import settings
from src.core.data import collection
from src.core.task_ownership import TaskLease

from src.config.production_limits import MAX_CONTENT_PRODUCERS

MAX_PRODUCERS = MAX_CONTENT_PRODUCERS


def validate_parallel(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= MAX_PRODUCERS:
        raise ValueError(f"parallel debe ser un entero entre 1 y {MAX_PRODUCERS}")
    return value


def parallel_limit() -> int:
    row = collection("explainer_runtime").get("capacity")
    return validate_parallel(row["parallel"] if row else settings.explainer_max_concurrent_productions)


async def configure_parallel(value: int) -> dict:
    value = validate_parallel(value)
    return await collection("explainer_runtime").upsert(
        {"id": "capacity", "parallel": value}, match=["id"]
    )


@asynccontextmanager
async def named_lock(name: str):
    lease = TaskLease("explainer-lock", name)
    try:
        while not lease.acquire():
            await asyncio.sleep(0.1)
        yield
    finally:
        lease.release()


def _try_slot(pool: str, size: int) -> TaskLease | None:
    # Count every occupied slot, including slots above a newly lowered limit.
    # The allocation mutex makes counting + granting atomic across OS processes.
    allocation = TaskLease("explainer-allocation", pool)
    if not allocation.acquire():
        return None
    free = []
    try:
        occupied = 0
        for index in range(MAX_PRODUCERS):
            lease = TaskLease("explainer-slot", f"{pool}:{index}")
            if lease.acquire():
                free.append(lease)
            else:
                occupied += 1
        return free.pop(0) if occupied < size and free else None
    finally:
        for lease in free:
            lease.release()
        allocation.release()


@asynccontextmanager
async def production_slot(batch_id: str | None = None, batch_parallel: int | None = None):
    """Acquire both budgets without holding a global slot while a batch is full."""
    held = []
    try:
        while True:
            held = []
            budgets = [("global", parallel_limit())]
            if batch_id:
                budgets.insert(0, (f"batch:{batch_id}", validate_parallel(batch_parallel or 1)))
            for pool, size in budgets:
                lease = _try_slot(pool, size)
                if lease is None:
                    break
                held.append(lease)
            if len(held) == len(budgets):
                break
            for lease in held:
                lease.release()
            held = []
            await asyncio.sleep(0.25)
        yield
    finally:
        for lease in held:
            lease.release()


def available_memory_mib() -> int | None:
    from pathlib import Path
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) // 1024
    except (OSError, ValueError):
        pass
    return None


@contextmanager
def heavy_tool_slot(command: str):
    """One heavy preparation tool across all producers; OS releases on process exit."""
    if command not in {"voice", "transcribe", "sheet", "components", "poster", "outro"}:
        yield
        return
    lease = TaskLease("explainer-resource", "heavy-preparation")
    started = time.monotonic()
    try:
        required = settings.explainer_audio_min_available_mib if command in {"voice", "transcribe"} else settings.explainer_visual_min_available_mib
        announced = False
        while True:
            available = available_memory_mib()
            if available is not None and available < required:
                if not announced:
                    print(f"@@resource {command} waiting-memory available={available}MiB required={required}MiB", flush=True)
                    announced = True
                time.sleep(0.5)
                continue
            if lease.acquire():
                break
            time.sleep(0.2)
        if time.monotonic() - started > 1:
            print(f"@@resource {command} waited={time.monotonic() - started:.1f}s", flush=True)
        yield
    finally:
        lease.release()
