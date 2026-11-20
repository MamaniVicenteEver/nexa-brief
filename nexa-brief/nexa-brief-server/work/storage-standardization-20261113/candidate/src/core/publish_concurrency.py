"""Shared upload capacity, with one upload per account at a time.

Uploads are asynchronous network tasks; the operating system schedules CPU work.
The same capacity covers immediate, scheduled and pipeline video publication.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from weakref import WeakKeyDictionary

from src.config.settings import settings


@dataclass
class _UploadSlots:
    capacity: int
    semaphore: asyncio.Semaphore
    accounts: dict[str, asyncio.Lock] = field(default_factory=dict)


_loops: WeakKeyDictionary = WeakKeyDictionary()


@asynccontextmanager
async def publication_slot(account_selector: str):
    loop = asyncio.get_running_loop()
    capacity = settings.publish_max_concurrent_uploads
    slots = _loops.get(loop)
    if slots is None or slots.capacity != capacity:
        slots = _UploadSlots(capacity, asyncio.Semaphore(capacity))
        _loops[loop] = slots
    # Waiting for the same account must not consume a slot needed by other channels.
    async with slots.accounts.setdefault(account_selector, asyncio.Lock()):
        async with slots.semaphore:
            yield
