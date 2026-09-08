"""Unit tests for notification_tracker — CRUD persistence of dashboard alerts."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.config.settings import settings
from src.core import notification_tracker
from src.core.notification import Notification


@pytest.fixture(autouse=True)
def _isolated_notificaciones_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "notificaciones_dir", tmp_path / "notificaciones")


def _make(**overrides) -> Notification:
    defaults = dict(type="video_ready", severity="info", title="t", message="m")
    defaults.update(overrides)
    return Notification(**defaults)


@pytest.mark.asyncio
async def test_create_and_list():
    created = await notification_tracker.create(_make())
    notifications, total, unread = notification_tracker.list_notifications(limit=20, offset=0)
    assert total == 1
    assert unread == 1
    assert notifications[0].notification_id == created.notification_id


@pytest.mark.asyncio
async def test_mark_read_updates_unread_count():
    n = await notification_tracker.create(_make())
    updated = await notification_tracker.mark_read(n.notification_id)
    assert updated.read_at is not None

    _, _, unread = notification_tracker.list_notifications(limit=20, offset=0)
    assert unread == 0


@pytest.mark.asyncio
async def test_mark_read_unknown_id_returns_none():
    assert await notification_tracker.mark_read("does-not-exist") is None


@pytest.mark.asyncio
async def test_unread_only_filter():
    n1 = await notification_tracker.create(_make(title="a"))
    await notification_tracker.create(_make(title="b"))
    await notification_tracker.mark_read(n1.notification_id)

    unread_page, total, unread = notification_tracker.list_notifications(unread_only=True, limit=20, offset=0)
    assert total == 1
    assert unread == 1
    assert unread_page[0].title == "b"


@pytest.mark.asyncio
async def test_mark_all_read():
    await notification_tracker.create(_make(title="a"))
    await notification_tracker.create(_make(title="b"))

    marked = await notification_tracker.mark_all_read()
    assert marked == 2

    _, _, unread = notification_tracker.list_notifications(limit=20, offset=0)
    assert unread == 0
    assert await notification_tracker.mark_all_read() == 0


@pytest.mark.asyncio
async def test_delete():
    n = await notification_tracker.create(_make())
    assert await notification_tracker.delete(n.notification_id) is True
    assert await notification_tracker.delete(n.notification_id) is False

    _, total, _ = notification_tracker.list_notifications(limit=20, offset=0)
    assert total == 0


@pytest.mark.asyncio
async def test_exists_unresolved_dedup_for_token_expired():
    assert notification_tracker.exists_unresolved("token_expired", "youtube:canal_1") is False

    n = await notification_tracker.create(_make(
        type="token_expired", severity="warning", account_alias="youtube:canal_1",
    ))
    assert notification_tracker.exists_unresolved("token_expired", "youtube:canal_1") is True

    await notification_tracker.mark_read(n.notification_id)
    assert notification_tracker.exists_unresolved("token_expired", "youtube:canal_1") is False
