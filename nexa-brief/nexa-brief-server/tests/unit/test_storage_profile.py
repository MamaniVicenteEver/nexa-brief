"""Dataset isolation and cross-process safety, using temporary data only."""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from src.config.storage_profile import apply_profile, load_profile
from src.config.settings import Settings, settings
from src.adapters.data.provider_registry import build_provider, register_provider
from src.core.task_ownership import TaskLease, task_can_recover, start_owned_task
from src.adapters.realtime.shared_events import SharedEventRelay
from src.core.realtime.event_bus import EventBus
from src.core.realtime.events import RealtimeEvent


def manifest(root, name="testing"):
    root.mkdir()
    (root / "profile.json").write_text(json.dumps({"schema_version": 1, "id": name, "providers": {}}))
    return root


def test_profile_overrides_all_storage_paths(tmp_path):
    root = manifest(tmp_path / "one")
    s = Settings(_env_file=None, NEXA_PROFILE_DIR=str(root), DATA_DIR="/wrong", OUTPUT_DIR="/wrong")
    assert s.data_dir == root / "data"
    assert s.output_dir == root / "output"
    assert s.accounts_json_path == root / "connections/accounts.json"
    assert s.shared_connections_dir == root / "connections"
    assert s.storage_profile_id == "testing"
    assert s.tiktok_idempotency_namespace == "testing"
    assert s.niches_path == root / "config/niches.json"
    other = manifest(tmp_path / "two", "empty")
    assert apply_profile({"NEXA_PROFILE_DIR": str(other)})["DATA_DIR"] != s.data_dir
    assert not (other / "data").exists()  # selection never imports the first profile


def test_invalid_and_uninstalled_provider_fail_closed(tmp_path):
    with pytest.raises(ValueError):
        load_profile(Path("relative"))
    with pytest.raises(ValueError, match="not installed"):
        build_provider("credentials", "missing")
    sentinel = object()
    register_provider("credentials", "test_memory", lambda: sentinel)
    assert build_provider("credentials", "test_memory") is sentinel
    root = manifest(tmp_path / "bad")
    (root / "profile.json").write_text('{"schema_version":1,"id":"../escape"}')
    with pytest.raises(ValueError):
        load_profile(root)


@pytest.mark.asyncio
async def test_collection_writes_and_increments_across_processes(tmp_path, monkeypatch):
    from src.adapters.data.json_store import JsonDataStore

    root = tmp_path / "shared"
    monkeypatch.setattr(settings, "data_dir", root)
    store = JsonDataStore().collection("jobs")
    await store.insert({"job_id": "counter", "count": 0})
    script = """
import asyncio,sys
from pathlib import Path
from src.config.settings import settings
from src.adapters.data.json_store import JsonDataStore
settings.data_dir=Path(sys.argv[1])
async def run():
    c=JsonDataStore().collection('jobs')
    for i in range(20):
        await c.increment('counter','count')
        await c.insert({'job_id':sys.argv[2]+str(i)})
asyncio.run(run())
"""
    env = {**os.environ, "NEXA_PROFILE_DIR": ""}
    children = [
        subprocess.Popen(
            [sys.executable, "-c", script, str(root), str(n)],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        for n in range(2)
    ]
    for child in children:
        _, error = await asyncio.to_thread(child.communicate, timeout=30)
        assert child.returncode == 0, error.decode()
    assert len(store.list()) == 41
    assert store.get("counter")["count"] == 40


@pytest.mark.asyncio
async def test_ownership_prevents_foreign_recovery_and_duplicate_start():
    gate = asyncio.Event()
    task = start_owned_task("test", "id", gate.wait)
    assert task is not None
    assert not task_can_recover("test", "id")
    assert start_owned_task("test", "id", gate.wait) is None
    gate.set()
    await task
    assert task_can_recover("test", "id")
    lease = TaskLease("test", "id")
    assert lease.acquire()
    lease.release()


@pytest.mark.asyncio
async def test_shared_events_delivered_once_without_relay_loop(tmp_path):
    first, second = EventBus(), EventBus()
    received = []

    async def accept(event):
        received.append(event)

    second.subscribe(accept)
    left, right = SharedEventRelay(tmp_path, first), SharedEventRelay(tmp_path, second)
    left.start()
    right.start()
    try:
        await first.publish(RealtimeEvent(type="channels_changed", data={}))
        await right.poll_once()
        await right.poll_once()
        await left.poll_once()
        assert len(received) == 1
        assert right._read()["sequence"] == 1
    finally:
        await left.stop()
        await right.stop()


@pytest.mark.asyncio
async def test_cancelled_before_start_releases_ownership():
    task = start_owned_task("cancel", "early", asyncio.Event().wait)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.sleep(0)
    assert task_can_recover("cancel", "early")


def test_internal_lock_files_are_not_media(tmp_path):
    from src.adapters.data.local_file_storage import LocalFileStorage

    source = tmp_path / "source.jpg"
    source.write_bytes(b"synthetic image")
    storage = LocalFileStorage("images", "images")
    key = storage.save(source, folder="test", filename="image.jpg")
    assert storage.list_keys("test") == [key]
