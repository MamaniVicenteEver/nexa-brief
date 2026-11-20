from __future__ import annotations


import pytest
from fastapi.testclient import TestClient

from src.core import notification_tracker
from src.core.notification import Notification
from src.presentation.main import app

client = TestClient(app)


def _make(**overrides) -> Notification:
    defaults = dict(type="video_ready", severity="info", title="t", message="m")
    defaults.update(overrides)
    return Notification(**defaults)


def test_list_notifications_empty():
    r = client.get("/api/v1/notifications")
    assert r.status_code == 200
    body = r.json()
    assert body == {"total": 0, "limit": 20, "offset": 0, "unread_count": 0, "notifications": []}


@pytest.mark.asyncio
async def test_list_notifications_reports_unread_count():
    n1 = await notification_tracker.create(_make(title="a"))
    await notification_tracker.create(_make(title="b"))
    await notification_tracker.mark_read(n1.notification_id)

    r = client.get("/api/v1/notifications")
    body = r.json()
    assert body["total"] == 2
    assert body["unread_count"] == 1


@pytest.mark.asyncio
async def test_mark_read_endpoint():
    n = await notification_tracker.create(_make())
    r = client.post(f"/api/v1/notifications/{n.notification_id}/read")
    assert r.status_code == 200
    assert r.json()["is_read"] is True


def test_mark_read_unknown_404():
    r = client.post("/api/v1/notifications/does-not-exist/read")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_mark_all_read_endpoint():
    await notification_tracker.create(_make(title="a"))
    await notification_tracker.create(_make(title="b"))

    r = client.post("/api/v1/notifications/read-all")
    assert r.status_code == 200
    assert r.json()["marked"] == 2


@pytest.mark.asyncio
async def test_delete_endpoint():
    n = await notification_tracker.create(_make())
    r = client.delete(f"/api/v1/notifications/{n.notification_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    r2 = client.delete(f"/api/v1/notifications/{n.notification_id}")
    assert r2.status_code == 404
