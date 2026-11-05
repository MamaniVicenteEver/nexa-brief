"""Capacity, scheduling and restart invariants; no model, voice or render calls."""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from src.core.data import collection
from src.core.explainer import batches, runtime
from src.core.explainer.producer import ExplainerProducer
from src.core.task_ownership import TaskLease


@pytest.mark.parametrize("value", [0, 6, -1, True, 1.5])
def test_parallel_bounds(value):
    with pytest.raises(ValueError):
        runtime.validate_parallel(value)


async def test_capacity_default_one_and_shared_between_producers():
    assert runtime.parallel_limit() == 1
    await runtime.configure_parallel(3)
    active, peak = 0, 0

    async def work():
        nonlocal active, peak
        async with runtime.production_slot():
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.02)
            active -= 1

    await asyncio.gather(*(work() for _ in range(9)))
    assert peak == 3
    await runtime.configure_parallel(1)
    peak = 0
    await asyncio.gather(*(work() for _ in range(3)))
    assert peak == 1


async def test_batch_budget_does_not_block_other_batches():
    await runtime.configure_parallel(5)
    entered = asyncio.Event()
    release = asyncio.Event()

    async def first():
        async with runtime.production_slot("batch-a", 1):
            entered.set()
            await release.wait()

    a = asyncio.create_task(first())
    await entered.wait()
    async with runtime.production_slot("batch-b", 2):
        pass
    release.set()
    await a


async def test_cancelled_waiter_releases_leases():
    async with runtime.production_slot():
        waiting = asyncio.create_task(runtime.production_slot().__aenter__())
        await asyncio.sleep(0.02)
        waiting.cancel()
        with pytest.raises(asyncio.CancelledError):
            await waiting
    async def enter():
        async with runtime.production_slot():
            pass
    await asyncio.wait_for(enter(), 1)


def test_existing_task_lease_is_idempotent():
    first, second = TaskLease("test", "same"), TaskLease("test", "same")
    assert first.acquire() and first.acquire()
    assert not second.acquire()
    first.release()
    assert second.acquire()
    second.release()


def test_local_schedule_is_converted_to_utc():
    assert batches.scheduled_time("2026-11-03T03:00", "America/La_Paz").isoformat() == "2026-11-03T07:00:00+00:00"
    with pytest.raises(ValueError):
        batches.scheduled_time("2026-11-01T01:30", "America/New_York")


async def test_scheduled_jobs_wait_and_survive_recovery():
    producer = ExplainerProducer(agent_getter=lambda _: None)
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    await collection("explainer_productions").insert({"production_id": "later", "video_id": "later",
        "state": "queued", "managed_queue": True, "not_before": future.isoformat()})
    assert await producer.recover_interrupted() == 0
    assert await producer.dispatch_due() == []
    launched = []
    producer._start = lambda ident, resume=False: launched.append(ident)
    assert await producer.dispatch_due(future + timedelta(seconds=1)) == ["later"]
    assert launched == ["later"]


async def test_creating_and_deleting_batches_never_dispatch():
    producer = ExplainerProducer(agent_getter=lambda _: None)
    for state in ("creating", "deleting"):
        await collection("explainer_batches").upsert({"batch_id": "b", "state": state}, match=["batch_id"])
        await collection("explainer_productions").upsert({"production_id": "p", "state": "queued",
            "managed_queue": True, "batch_id": "b"}, match=["production_id"])
        assert await producer.dispatch_due() == []


async def test_batch_links_plan_and_is_idempotent(monkeypatch):
    class FakeProducer:
        def _agent_getter(self, _):
            return type("Agent", (), {"available": lambda self: True})()

        async def submit(self, **kwargs):
            ident = str(len(collection("explainer_productions").list()))
            row = {**kwargs, "production_id": ident, "video_id": "video-" + ident, "state": "queued"}
            await collection("explainer_productions").insert(row)
            return row

    monkeypatch.setattr(batches, "available_design_ids", lambda: ["rough"])
    item = batches.PreparationItem(category_path="node_tech", design="rough", topic="Tema de prueba")
    p = FakeProducer()
    first = await batches.submit_batch(p, [item, item], parallel=2, at="2026-12-01T03:00", request_id="same")
    second = await batches.submit_batch(p, [item, item], parallel=2, at="2026-12-01T03:00", request_id="same")
    assert first["batch_id"] == second["batch_id"]
    assert len(collection("explainer_productions").list()) == 2
    plans = collection("content_plan").list()
    assert len(plans) == 2 and all(p["production_id"] is not None and not p["auto_record"] for p in plans)


async def test_batch_failure_rolls_back_without_starting(monkeypatch):
    class Broken:
        def _agent_getter(self, _):
            return type("Agent", (), {"available": lambda self: True})()

        async def submit(self, **kwargs):
            raise ValueError("failure")

    monkeypatch.setattr(batches, "available_design_ids", lambda: ["rough"])
    item = batches.PreparationItem(category_path="node_tech", design="rough", topic="Tema de prueba")
    with pytest.raises(ValueError, match="failure"):
        await batches.submit_batch(Broken(), [item])
    assert collection("explainer_batches").list() == []
    assert collection("content_plan").list() == []


async def test_two_producer_instances_share_one_budget():
    await runtime.configure_parallel(2)
    producers = [ExplainerProducer(agent_getter=lambda _: None) for _ in range(2)]
    active, peak = 0, 0

    async def run(production_id, resume):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.02)
        active -= 1

    for producer in producers:
        producer._run_locked = run
    for index in range(6):
        await collection("explainer_productions").insert({"production_id": str(index), "state": "queued"})
    await asyncio.gather(*(producers[i % 2]._run(str(i), False) for i in range(6)))
    assert peak == 2


async def test_pending_jobs_reserve_distinct_video_ids(tmp_path):
    class Agent:
        def available(self):
            return True
    producer = ExplainerProducer(agent_getter=lambda _: Agent(), videos_dir=tmp_path / "videos")
    at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    first, second = await asyncio.gather(*[
        producer.submit(category_path="node_tech", design="rough", topic="El mismo tema", not_before=at)
        for _ in range(2)])
    assert first["video_id"] != second["video_id"]
    assert producer._tasks == {}


async def test_admission_rejects_overflow(tmp_path, monkeypatch):
    from src.config.settings import settings
    monkeypatch.setattr(settings, "explainer_max_pending_productions", 1)
    await collection("explainer_productions").insert({"production_id": "full", "state": "queued"})
    with pytest.raises(ValueError, match="cola"):
        await ExplainerProducer().submit(category_path="node_tech", design="rough", topic="Otro tema")


async def test_unaccepted_batch_is_rolled_back_after_process_exit():
    await collection("explainer_batches").insert({"batch_id": "interrupted", "state": "creating"})
    await collection("explainer_productions").insert({"production_id": "unstarted", "batch_id": "interrupted", "state": "queued"})
    await collection("content_plan").insert({"item_id": "orphan", "batch_id": "interrupted"})
    await batches.recover_incomplete_batches()
    assert collection("explainer_batches").list() == []
    assert collection("explainer_productions").list() == []
    assert collection("content_plan").list() == []


def test_slot_is_exclusive_across_os_processes():
    import subprocess
    import sys
    from src.config.settings import settings
    lease = TaskLease("test-process", "shared")
    script = "from pathlib import Path; import sys; from src.config.settings import settings; settings.data_dir=Path(sys.argv[1]); from src.core.task_ownership import TaskLease; lock=TaskLease('test-process','shared'); print(lock.acquire())"
    assert lease.acquire()
    try:
        held = subprocess.check_output([sys.executable, "-c", script, str(settings.data_dir)], text=True, timeout=10)
        assert held.strip() == "False"
    finally:
        lease.release()
    free = subprocess.check_output([sys.executable, "-c", script, str(settings.data_dir)], text=True, timeout=10)
    assert free.strip() == "True"


def test_documentary_prompt_includes_segment_act_contract(tmp_path):
    from src.core.explainer.producer import build_agent_prompt
    record = {"video_id":"test", "design":"rough", "category_path":"node_tech", "topic":"Historia",
              "narrative_id":"narrative_documental_v1"}
    prompt = build_agent_prompt(record, tmp_path)
    assert "Cada segmento de script.json necesita act" in prompt
    assert "gancho, contexto" in prompt


def test_invalid_draft_thumbnail_does_not_break_catalogue(tmp_path, monkeypatch):
    from src.presentation.api.routers import explainer
    from src.core.explainer.catalog import ExplainerVideo
    video = ExplainerVideo(video_id="draft", path=tmp_path, design="rough", category_path="node_tech", title="Draft", status="en progreso", duration_seconds=None)
    def invalid(_):
        raise ValueError("draft schema")
    monkeypatch.setattr(explainer.thumbnails, "intro_specs", invalid)
    assert explainer._thumbnails(video).options == []


def test_partial_json_draft_does_not_break_catalogue(tmp_path):
    from src.core.explainer.catalog import _read_json
    p = tmp_path / "publish.json"
    p.write_text('{"schema_version":')
    assert _read_json(p) == {}


async def test_api_dispatcher_yields_to_independent_worker(monkeypatch):
    class Producer:
        async def recover_interrupted(self):
            pass
        async def dispatch_due(self):
            pytest.fail("independent worker owns dispatch")
    monkeypatch.setattr(batches, "task_is_owned", lambda *_: True)
    task = asyncio.create_task(batches.worker_loop(Producer(), interval=.01))
    await asyncio.sleep(.03)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


def test_audio_waits_for_memory_headroom(monkeypatch):
    from src.config.settings import settings
    monkeypatch.setattr(settings, 'explainer_audio_min_available_mib', 5120)
    values = iter([2048, 6144])
    waited = []
    monkeypatch.setattr(runtime, 'available_memory_mib', lambda: next(values))
    monkeypatch.setattr(runtime.time, 'sleep', lambda seconds: waited.append(seconds))
    with runtime.heavy_tool_slot('voice'):
        assert waited == [.5]


def test_audio_fingerprint_ignores_visual_metadata_but_detects_speech(tmp_path):
    import json
    from src.core.explainer.producer import _script_hash
    (tmp_path/'assets').mkdir()
    p = tmp_path/'assets/script.json'
    script = {'title':'Test','segments':[{'id':'s1','text':'Uno','tone':'intriga','intensity':.7}]}
    p.write_text(json.dumps(script))
    original = _script_hash(tmp_path)
    script['subtitle'] = 'Visual'
    script['segments'][0].update(chapter='Inicio', act='gancho')
    p.write_text(json.dumps(script, indent=4))
    assert _script_hash(tmp_path) == original
    script['segments'][0]['text'] = 'Dos'
    p.write_text(json.dumps(script))
    assert _script_hash(tmp_path) != original


async def test_visual_metadata_edit_does_not_regenerate_voice(tmp_path):
    import json
    from tests.unit.test_explainer_production import _producer
    from src.core.explainer.producer import _write_phase
    producer, agent, kit, videos = _producer(tmp_path)
    original = agent.run
    async def update_metadata(prompt, **kwargs):
        result = await original(prompt, **kwargs)
        if 'FASE STORYBOARD' in prompt:
            video = videos / kwargs['scope'].writable_dir.rsplit('/', 1)[-1]
            p = video/'assets/script.json'
            data = json.loads(p.read_text())
            data['subtitle'] = 'Un subtítulo visual'
            p.write_text(json.dumps(data))
            _write_phase(video, 'script_ready')
        return result
    agent.run = update_metadata
    record = await producer.submit(category_path='node_tech', design='rough', topic='Solo metadatos')
    final = await producer.wait(record['production_id'])
    assert final['state'] == 'ready', final['error']
    assert [c[0] for c in kit.calls].count('voice') == 1
    assert [c[0] for c in kit.calls].count('transcribe') == 1


async def test_legacy_phase_hash_keeps_valid_audio(tmp_path):
    import hashlib
    from tests.unit.test_explainer_production import _producer
    from src.core.explainer.producer import _write_phase
    producer, agent, kit, videos = _producer(tmp_path)
    real = producer._kit
    fail = True
    async def fail_transcribe_once(args):
        nonlocal fail
        if args[0] == 'transcribe' and fail:
            fail = False
            return 1, 'interrupted'
        return await real(args)
    producer._kit = fail_transcribe_once
    record = await producer.submit(category_path='node_tech', design='rough', topic='Migración de voz')
    assert (await producer.wait(record['production_id']))['state'] == 'failed'
    video = videos / record['video_id']
    legacy = hashlib.sha256((video/'assets/script.json').read_bytes()).hexdigest()
    _write_phase(video, 'voice_ready', legacy)
    calls_before = [c[0] for c in kit.calls].count('voice')
    await producer.resume(record['production_id'])
    final = await producer.wait(record['production_id'])
    assert final['state'] == 'ready', final['error']
    assert [c[0] for c in kit.calls].count('voice') == calls_before


async def test_lowering_capacity_drains_active_jobs_before_admitting_more():
    await runtime.configure_parallel(5)
    held = [runtime.production_slot() for _ in range(5)]
    for slot in held:
        await slot.__aenter__()
    await runtime.configure_parallel(1)
    await held[0].__aexit__(None, None, None)
    entered = asyncio.Event()
    async def next_job():
        async with runtime.production_slot():
            entered.set()
    task = asyncio.create_task(next_job())
    await asyncio.sleep(.03)
    assert not entered.is_set()
    for slot in held[1:]:
        await slot.__aexit__(None, None, None)
    await asyncio.wait_for(task, 1)
    assert entered.is_set()


def test_native_design_intro_counts_as_visual_support():
    import importlib.util
    from src.core.explainer.catalog import KIT_DIR
    spec = importlib.util.spec_from_file_location('visual_support_parallel_test', KIT_DIR/'tools/visual_support.py')
    visual = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(visual)
    policy = {'photo_error_min':4,'photo_error_max':12,'photo_target_min':5,'photo_target_max':10,
              'max_uses_per_asset':2,'dominance_warn_share':1}
    catalog = {'dinero.introv2':{'params':{'src':{'type':'image'}}}}
    beats = [{'i':i,'layer':'main','t0':i*10,'t1':(i+1)*10,'use':'dinero.introv2',
              'b':{'params':{'src':f'image-{i}.jpg'}}} for i in range(3)]
    errors = []
    result = visual.check({'design':'dinero'},beats,catalog,30,policy,errors,[])
    assert errors == []
    assert result['preferred_thirds'] == [True, True, True]
    assert result['kinds']['miniatura'] == 3


async def test_revalidation_never_starts_an_agent_or_voice(tmp_path):
    from tests.unit.test_explainer_production import _producer
    producer, agent, kit, videos = _producer(tmp_path)
    rec = await producer.submit(category_path='node_tech', design='rough', topic='Validación sin modelo')
    assert (await producer.wait(rec['production_id']))['state'] == 'ready'
    await collection('explainer_productions').update(rec['production_id'], {'batch_id':'review', 'state':'incomplete'})
    await collection('explainer_batches').insert({'batch_id':'review','state':'scheduled','parallel':1,
        'scheduled_at':datetime.now(timezone.utc).isoformat()})
    calls = len(kit.calls)
    runs = len(agent.runs)
    result = await batches.validate_batch(producer, 'review')
    assert result['state'] == 'ready'
    assert len(agent.runs) == runs
    assert not any(c[0] in ('voice','transcribe') for c in kit.calls[calls:])


async def test_revalidation_refuses_stale_audio(tmp_path):
    from tests.unit.test_explainer_production import _producer
    from src.core.explainer.producer import _write_phase
    producer, agent, kit, videos = _producer(tmp_path)
    rec = await producer.submit(category_path='node_tech', design='rough', topic='Voz no vigente')
    await producer.wait(rec['production_id'])
    _write_phase(videos/rec['video_id'], 'storyboard', 'wrong-audio-hash')
    await collection('explainer_productions').update(rec['production_id'], {'batch_id':'review', 'state':'incomplete'})
    await collection('explainer_batches').insert({'batch_id':'review','state':'scheduled','parallel':1,
        'scheduled_at':datetime.now(timezone.utc).isoformat()})
    with pytest.raises(ValueError, match='voz/transcripción'):
        await batches.validate_batch(producer, 'review')
