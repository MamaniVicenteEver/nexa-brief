from types import SimpleNamespace

import pytest

from src.config.settings import settings
from src.core import task_ownership
from src.core.explainer import sandbox_thumbs
from src.core.prototypes import runs


@pytest.mark.parametrize("version", [1, 2])
def test_runtime_cache_and_prototype_log_layout(monkeypatch, tmp_path, version):
    data = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data)
    layout = SimpleNamespace(schema_version=version, logs_dir=tmp_path / "logs",
                             runtime_dir=tmp_path / ".system/runtime", cache_dir=tmp_path / ".system/cache")
    for module in (task_ownership, sandbox_thumbs, runs):
        monkeypatch.setattr(module, "layout_for_settings", lambda _: layout)
    monkeypatch.setattr(sandbox_thumbs, "THUMB_CACHE_DIR", None)

    first = task_ownership.TaskLease("test", "id")
    second = task_ownership.TaskLease("test", "id")
    runtime = layout.runtime_dir if version == 2 else data / "runtime"
    assert first.path.parent == runtime / "task-leases"
    assert first.acquire()
    try:
        assert not second.acquire()
    finally:
        first.release()
    assert second.acquire()
    second.release()

    item = tmp_path / "item"
    item.mkdir()
    (item / "index.html").write_text("test")
    result = sandbox_thumbs.ensure_thumbnail(item, "folder", "item", "http://localhost",
                                              capture=lambda _, output: output.write_bytes(b"image"))
    cache = layout.cache_dir if version == 2 else data
    assert result == cache / "sandbox-thumbs/folder/item.jpg"
    service = runs.PrototypeRunService(agent_getter=lambda _: None)
    assert service.log_dir == (layout.logs_dir / "prototypes" if version == 2 else data / "prototypes/logs")


def test_prototype_old_record_log_path_remains_readable(monkeypatch, tmp_path):
    old_log = tmp_path / "old.log"
    old_log.write_text("legacy output", encoding="utf-8")
    service = runs.PrototypeRunService(agent_getter=lambda _: None)
    monkeypatch.setattr(service, "get", lambda _: {"log_path": str(old_log)})
    assert "legacy output" in service.log_tail("old")


@pytest.mark.asyncio
async def test_log_index_relates_production_without_reading_content(monkeypatch, tmp_path):
    from src.core import execution_logs as execution

    records = []
    class Collection:
        async def insert(self, record):
            records.append(record)
    monkeypatch.setattr(execution, "layout_for_settings", lambda _: SimpleNamespace(root=tmp_path))
    monkeypatch.setattr(execution, "collection", lambda name: Collection() if name == "execution_logs" else None)
    registered = await execution.register_execution_log("logs/explainer/run.log", kind="production",
                                                        production_id="p1", video_id="v1")
    assert registered.path == tmp_path / "logs/explainer/run.log"
    assert not registered.path.exists()
    assert records[0]["log_id"] == registered.log_id
    assert records[0]["production_id"] == "p1"
    assert records[0]["video_id"] == "v1"
    assert records[0]["key"] == "logs/explainer/run.log"
    assert set(records[0]) == {"log_id", "key", "kind", "production_id", "video_id", "created_at"}
    with pytest.raises(ValueError):
        await execution.register_execution_log("../escape.log", kind="production")
