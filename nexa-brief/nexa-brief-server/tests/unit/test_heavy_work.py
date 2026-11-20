import asyncio
import threading

import pytest

from src.core.heavy_work import HeavyWorkQueue, finish_thread, heavy_work_slot


@pytest.mark.asyncio
async def test_transcription_and_recording_use_one_fifo_lane_and_release_on_error():
    queue = HeavyWorkQueue()
    entered = []
    release = asyncio.Event()
    async def work(kind, identity):
        async with queue.slot(kind, identity):
            entered.append(identity)
            if identity == 'song1':
                await release.wait()
            if identity == 'video1':
                raise RuntimeError('render failed')
    first = asyncio.create_task(work('transcription', 'song1'))
    await asyncio.sleep(0)
    second = asyncio.create_task(work('recording', 'video1'))
    third = asyncio.create_task(work('transcription', 'song2'))
    await asyncio.sleep(0)
    assert entered == ['song1']
    release.set()
    results = await asyncio.gather(first, second, third, return_exceptions=True)
    assert entered == ['song1', 'video1', 'song2']
    assert isinstance(results[1], RuntimeError)
    assert queue.waiting == [] and queue.owner is None and not queue.lock.locked()


@pytest.mark.asyncio
async def test_cancelled_waiter_does_not_steal_or_release_another_tasks_slot():
    queue = HeavyWorkQueue()
    async def wait():
        async with queue.slot('recording', 'cancelled'):
            raise AssertionError('cancelled task must not run')
    async with queue.slot('transcription', 'song'):
        task = asyncio.create_task(wait())
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert queue.lock.locked() and queue.waiting == []
        async with queue.slot('transcription', 'nested-adapter'):
            assert queue.lock.locked()
    assert not queue.lock.locked()


@pytest.mark.asyncio
async def test_cancelled_transcription_keeps_lane_until_cpu_thread_has_finished():
    started, finish = threading.Event(), threading.Event()
    next_started = asyncio.Event()
    def cpu():
        started.set()
        assert finish.wait(3)
    async def transcription():
        async with heavy_work_slot('transcription', 'song'):
            await finish_thread(cpu)
    async def render():
        async with heavy_work_slot('recording', 'video'):
            next_started.set()
    first = asyncio.create_task(transcription())
    assert await asyncio.to_thread(started.wait, 1)
    first.cancel()
    second = asyncio.create_task(render())
    await asyncio.sleep(.01)
    assert not next_started.is_set()
    finish.set()
    with pytest.raises(asyncio.CancelledError):
        await first
    await asyncio.wait_for(second, 1)
    assert next_started.is_set()


@pytest.mark.asyncio
async def test_recorder_module_waits_for_transcription_adapter(tmp_path, monkeypatch):
    from src.adapters.lyrics.infrastructure import faster_whisper_adapter as whisper
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput, AnalyzedInput
    from src.core.ports.recorder_port import RecordingResult
    from src.modules import video_recorder
    started, finish = threading.Event(), threading.Event()
    recorded = []
    def cpu(*_):
        started.set()
        assert finish.wait(3)
        return {'metadata': {'language': 'en'}, 'segments': []}
    # The adapter now dispatches an ephemeral subprocess; mock that boundary so
    # this scheduling test cannot load Whisper or start a real worker.
    monkeypatch.setattr(whisper, '_run_worker', cpu)
    niche = get_niche_config('lyrics_video_caution')
    job = Job(input=JobInput(category_name=niche.id))
    analysis = AnalyzedInput(genre='', mood_tags=[], image_query='', description='', duration_seconds=1, category_name=niche.id)
    job.artifacts.output_dir = tmp_path
    job.artifacts.html_path = tmp_path/'index.html'
    job.artifacts.music_path = tmp_path/'song.mp3'
    job.artifacts.analyzed_input = analysis
    class Recorder:
        async def record(self, **kwargs):
            recorded.append(True)
            assert finish.is_set()
            return RecordingResult(youtube_path=tmp_path/'video.mp4', stats={})
    monkeypatch.setattr(video_recorder, 'get_recorder', lambda *a, **k: Recorder())
    first = asyncio.create_task(whisper.FasterWhisperAdapter().transcribe(tmp_path/'song.mp3'))
    assert await asyncio.to_thread(started.wait, 1)
    second = asyncio.create_task(video_recorder.run(job, niche))
    await asyncio.sleep(.01)
    assert recorded == []
    finish.set()
    await asyncio.wait_for(asyncio.gather(first, second), 2)
    assert recorded == [True]


def test_render_budget_reserves_cpu_and_reduces_workers_when_memory_is_low(monkeypatch):
    from src.adapters.recorder.infrastructure import hyperframes_adapter as hf
    from src.config.settings import settings
    monkeypatch.setattr(settings, 'hyperframes_workers', 8)
    monkeypatch.setattr(hf.os, 'cpu_count', lambda: 4)
    monkeypatch.setattr(hf.Path, 'read_text', lambda *a, **k: 'MemAvailable: 4194304 kB\n')
    assert hf._local_workers() == 3
    monkeypatch.setattr(hf.Path, 'read_text', lambda *a, **k: 'MemAvailable: 1048576 kB\n')
    assert hf._local_workers() == 1


def test_node_motion_api_defaults_to_desktop_without_enabling_vertical():
    from src.core.drafts import apply_render_options, RenderOptions
    from src.core.job import Job, JobInput
    job = Job(input=JobInput(category_name='lyrics_video_caution'))
    assert apply_render_options(job, RenderOptions()).input.formats == ['16x9']
    assert apply_render_options(job, RenderOptions(formats=['16x9', '9x16'])).input.formats == ['16x9', '9x16']
