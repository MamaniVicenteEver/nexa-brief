from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from src.core.data import collection
from src.core.schedule import workflows as w


AT = "2026-11-14T06:10:00-04:00"
MIDNIGHT = "2026-11-15T00:00:00-04:00"
NOW = datetime(2026, 11, 14, 10, 10, tzinfo=timezone.utc)


class Recorder:
    def __init__(self):
        self.jobs = {}
        self.calls = []

    def list_jobs(self, active=True):
        return list(self.jobs.values())

    def get_job(self, key):
        return self.jobs.get(key)

    def submit(self, video, **kwargs):
        self.calls.append(kwargs)
        job = SimpleNamespace(job_id="render1", video_id=video.video_id,
            state=SimpleNamespace(value="rendering"), error=None, scheduled_job_id="packaged1")
        self.jobs[job.job_id] = job
        return job


@pytest.fixture
def video(monkeypatch):
    value = SimpleNamespace(video_id="v1", ready=True, publish_ready=True,
        title="Prueba", category_path="node_actualidad", design="cara-a-cara")
    monkeypatch.setattr(w, "get_video", lambda key: value if key == "v1" else None)
    return value


def request(**extra):
    return w.WorkflowRequest(request_id="test-one", video_id="v1", record_at=AT, **extra)


@pytest.mark.asyncio
async def test_exact_due_time_not_early_and_no_duplicate(video):
    recorder = Recorder()
    row = await w.create_workflow(request(), None)
    await w.process_workflows(None, recorder, NOW.replace(minute=9, second=59))
    assert recorder.calls == []
    await w.process_workflows(None, recorder, NOW)
    await w.process_workflows(None, recorder, NOW)
    assert len(recorder.calls) == 1
    assert recorder.calls[0]["publish"] is False
    assert recorder.calls[0]["publication_hold"] is True
    assert w._rows().get(row["workflow_id"])["record_started_at"] == NOW.isoformat()


@pytest.mark.asyncio
async def test_request_id_is_idempotent_and_payload_conflicts(video):
    a = await w.create_workflow(request(), None)
    b = await w.create_workflow(request(), None)
    assert a["workflow_id"] == b["workflow_id"]
    assert len(w.list_workflows()) == 1
    with pytest.raises(ValueError, match="otro pedido"):
        await w.create_workflow(request(formats=["16x9"]), None)


@pytest.mark.asyncio
async def test_finished_render_waits_for_channel_without_enqueuing(video):
    recorder = Recorder()
    row = await w.create_workflow(request(publish_at=MIDNIGHT), None)
    await w.process_workflows(None, recorder, NOW)
    recorder.jobs["render1"].state.value = "done"
    await w.process_workflows(None, recorder, NOW)
    result = w._rows().get(row["workflow_id"])
    assert result["state"] == "pending_channels"
    assert result["record_state"] == "done"
    assert result["publish_at"] == "2026-11-15T04:00:00+00:00"
    assert collection("queue_entries").list() == []


@pytest.mark.asyncio
async def test_restart_never_resubmits_ambiguous_render(video):
    recorder = Recorder()
    row = await w.create_workflow(request(), None)
    await w.process_workflows(None, recorder, NOW)
    restarted = Recorder()
    await w.process_workflows(None, restarted, NOW)
    result = w._rows().get(row["workflow_id"])
    assert result["state"] == "attention"
    assert result["record_state"] == "interrupted"
    assert restarted.calls == []


@pytest.mark.asyncio
async def test_targets_create_one_durable_queue_entry_and_keep_privacy(video):
    recorder = Recorder()
    row = await w.create_workflow(request(publish_at=MIDNIGHT,
        targets=[w.WorkflowTarget(platform="youtube", account_alias="test", format="9x16")],
        privacy="unlisted"), None)
    await w.process_workflows(None, recorder, NOW)
    recorder.jobs["render1"].state.value = "done"
    await w.process_workflows(None, recorder, NOW)
    await w.process_workflows(None, recorder, NOW)
    entries = collection("queue_entries").list()
    assert len(entries) == 1
    assert entries[0]["privacy"] == "unlisted"
    assert entries[0]["scheduled_at"] == "2026-11-15T04:00:00+00:00"
    assert entries[0]["status"] == "queued"
    assert w._rows().get(row["workflow_id"])["publish_state"] == "scheduled"


@pytest.mark.asyncio
async def test_cancel_future_render_prevents_dispatch(video):
    row = await w.create_workflow(request(), None)
    await w.update_workflow(row["workflow_id"], w.WorkflowPatch(cancel=True))
    recorder = Recorder()
    await w.process_workflows(None, recorder, NOW)
    assert recorder.calls == []


@pytest.mark.asyncio
async def test_new_video_uses_existing_batch_once(monkeypatch):
    calls = []

    async def submit(producer, items, **kwargs):
        calls.append((items, kwargs))
        return {"batch_id": "b1", "scheduled_at": "2026-11-14T11:00:00+00:00",
                "productions": [{"production_id": "p1", "video_id": "vnew"}]}

    monkeypatch.setattr(w, "submit_batch", submit)
    body = w.WorkflowRequest(request_id="new-test", preparation=w.PreparationItem(
        category_path="node_actualidad", design="cara-a-cara", topic="El código QR",
        minutes=1, short_test=True), prepare_at="2026-11-14T07:00:00-04:00")
    row = await w.create_workflow(body, None)
    await w.create_workflow(body, None)
    assert len(calls) == 1
    assert calls[0][1]["request_id"].startswith("workflow:")
    assert row["production_id"] == "p1"
    assert row["record_state"] == "none"


def test_date_order_format_and_timezone_validation():
    with pytest.raises(ValueError, match="posterior"):
        request(publish_at=AT)
    with pytest.raises(ValueError, match="Zona"):
        request(timezone="Invalid/Zone")
    with pytest.raises(ValueError, match="formato"):
        request(targets=[w.WorkflowTarget(platform="youtube", account_alias="test", format="16x9")])


@pytest.mark.asyncio
async def test_patch_channel_after_render_can_be_armed(video):
    row = await w.create_workflow(request(publish_at=MIDNIGHT), None)
    await w._update(row["workflow_id"], state="pending_channels", record_state="done", scheduled_job_id="packaged1")
    patched = await w.update_workflow(row["workflow_id"], w.WorkflowPatch(targets=[
        w.WorkflowTarget(platform="youtube", account_alias="later", format="9x16")]))
    assert patched["targets"][0]["account_alias"] == "later"
    assert patched["publish_at"] == "2026-11-15T04:00:00+00:00"
    await w.process_workflows(None, Recorder(), NOW)
    assert len(collection("queue_entries").list()) == 1
