import asyncio

import pytest

from src.config.settings import settings
from src.core.publish_concurrency import publication_slot


@pytest.mark.asyncio
async def test_three_uploads_and_first_free_slot_starts_fourth(monkeypatch):
    monkeypatch.setattr(settings, "publish_max_concurrent_uploads", 3)
    entered = [asyncio.Event() for _ in range(4)]
    releases = [asyncio.Event() for _ in range(4)]
    running = 0
    peak = 0

    async def upload(index):
        nonlocal running, peak
        async with publication_slot(f"youtube:channel-{index}"):
            running += 1
            peak = max(peak, running)
            entered[index].set()
            try:
                await releases[index].wait()
            finally:
                running -= 1

    tasks = [asyncio.create_task(upload(i)) for i in range(4)]
    try:
        await asyncio.wait_for(asyncio.gather(*(e.wait() for e in entered[:3])), 1)
        assert not entered[3].is_set()
        releases[1].set()
        await asyncio.wait_for(entered[3].wait(), 1)
        assert not tasks[0].done() and not tasks[2].done()
        assert peak == 3
    finally:
        for event in releases:
            event.set()
        await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_same_account_serializes_without_blocking_other_channels(monkeypatch):
    monkeypatch.setattr(settings, "publish_max_concurrent_uploads", 2)
    entered = asyncio.Event()
    release = asyncio.Event()
    order = []

    async def first():
        async with publication_slot("tiktok:one"):
            entered.set()
            await release.wait()

    async def following(selector):
        async with publication_slot(selector):
            order.append(selector)

    a = asyncio.create_task(first())
    await entered.wait()
    b = asyncio.create_task(following("tiktok:one"))
    c = asyncio.create_task(following("youtube:two"))
    try:
        await asyncio.wait_for(c, 1)
        assert order == ["youtube:two"] and not b.done()
    finally:
        release.set()
        await asyncio.gather(a, b)
    assert order == ["youtube:two", "tiktok:one"]


@pytest.mark.asyncio
async def test_upload_error_releases_capacity(monkeypatch):
    monkeypatch.setattr(settings, "publish_max_concurrent_uploads", 1)
    with pytest.raises(RuntimeError):
        async with publication_slot("facebook:one"):
            raise RuntimeError("network down")
    async def next_upload():
        async with publication_slot("instagram:two"):
            return True

    assert await asyncio.wait_for(next_upload(), 1)
