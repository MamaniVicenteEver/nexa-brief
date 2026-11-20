from pathlib import Path
from types import SimpleNamespace
import json

import pytest

from src.config.settings import settings
from src.core.data import collection
from src.core.job import Job, JobInput, JobStage
from src.core.content_registry import upsert_video, get_video
from src.core.ports.agent_port import AgentRunResult, AgentIsolationUnavailableError
from src.adapters.ai.infrastructure.local_agent_ai_adapter import LocalAgentAIAdapter
from src.core.video_usage import for_video


def test_whisper_cpu_memory_policy_preserves_model_and_cuda_settings(monkeypatch):
    from src.adapters.lyrics.infrastructure.faster_whisper_adapter import _effective_compute_type
    monkeypatch.setattr(settings, 'whisper_device', 'cpu')
    monkeypatch.setattr(settings, 'whisper_compute_type', 'float32')
    assert _effective_compute_type(12 * 1024 * 1024) == 'int8'
    assert _effective_compute_type(64 * 1024 * 1024) == 'float32'
    monkeypatch.setattr(settings, 'whisper_device', 'cuda')
    assert _effective_compute_type(12 * 1024 * 1024) == 'float32'


@pytest.mark.asyncio
async def test_render_output_is_bounded_even_without_line_delimiters(tmp_path):
    import sys
    from src.adapters.recorder.infrastructure.subprocess_progress import run_with_progress
    lines = []
    result = await run_with_progress(
        [sys.executable, '-c', 'import sys; sys.stdout.write("x" * (2 * 1024 * 1024))'],
        cwd=tmp_path, timeout=10, parse_progress=lambda line: lines.append(line),
    )
    assert result.returncode == 0 and len(result.stdout_tail) <= 4096


@pytest.mark.asyncio
async def test_terminal_hyperframes_error_does_not_wait_for_a_stuck_cli(tmp_path, monkeypatch):
    from src.adapters.recorder.infrastructure import hyperframes_adapter as module
    from src.config.exceptions import RecordingError
    async def failed(*args, parse_progress, **kwargs):
        assert json.loads((kwargs['cwd']/'.puppeteerrc.json').read_text()) == {}
        parse_progress('\x1b[31m✗  Render failed: browser probe\x1b[0m')
        raise AssertionError('the terminal error must stop the process runner')
    monkeypatch.setattr(module, 'run_with_progress', failed)
    site = tmp_path/'site'; site.mkdir()
    with pytest.raises(RecordingError, match='browser probe'):
        await module.HyperframesAdapter()._render(Path('/bin/false'), site, tmp_path/'out.mp4', 'local', 'test')
    assert not site.exists()


@pytest.fixture
def profile(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    return tmp_path


def video(root, ident="motion1"):
    job = Job(job_id=ident, input=JobInput(category_name="lyrics_video_caution"))
    output = root / "productions/nodemotion" / ident
    output.mkdir(parents=True, exist_ok=True)
    return job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": output, "assets_dir": output / "assets", "log_dir": root / "logs/jobs" / ident,
    })})


@pytest.mark.asyncio
@pytest.mark.parametrize('duration', [18.39, 412.2])
async def test_lyric_duration_follows_song_without_generic_clamp(profile, monkeypatch, duration):
    import math
    from src.modules import resource_fetcher
    from src.core.job import DurationConfig, DurationMode
    job = video(profile)
    job.input.duration_config = DurationConfig(mode=DurationMode.AUTO, repeat_count=1)
    job.artifacts.log_dir.mkdir(parents=True)
    async def probe(_): return duration
    monkeypatch.setattr(resource_fetcher, '_get_audio_duration_seconds', probe)
    resolved = await resource_fetcher._resolve_duration_seconds(
        job, profile/'song.mp3', job.artifacts.log_dir, locked_to_music=True,
    )
    assert resolved == math.ceil(duration)
    logged = json.loads((job.artifacts.log_dir/'05c_duracion_resuelta.json').read_text())
    assert logged['locked_to_music'] and not logged['was_clamped']


class Agent:
    name = "claude"
    def __init__(self, messages): self.messages = iter(messages)
    def available(self): return True
    async def run(self, prompt, *, log_path, **kwargs):
        assert log_path.parent.is_dir()
        log_path.write_text('result\n')
        return AgentRunResult(exit_code=0, last_message=next(self.messages), duration_seconds=.1,
                              model="actual-model", usage={"input_tokens": 12, "cached_input_tokens": 30,
                                                           "output_tokens": 8, "turns": 1})


@pytest.mark.asyncio
async def test_visual_usage_and_unmeasured_calls_remain_visible(profile):
    class Visual:
        async def analyze_image_full_with_usage(self, path, prompt, *, max_output_tokens):
            assert max_output_tokens == 128
            return {'scene':'test'}, {'provider':'gemini','model':'vision-model', 'input_tokens':8,
                                      'output_tokens':4, 'total_tokens':12}
        async def complete_text(self, system, user): return 'html'
    job = video(profile)
    await upsert_video(job.job_id, job.job_id)
    ai = for_video(Visual(), job, 'visual_design')
    assert await ai.analyze_image_full(profile/'image.png', 'prompt', max_output_tokens=128) == {'scene':'test'}
    assert await ai.complete_text('s','u') == 'html'
    usage = get_video(job.job_id)['details']['usage']
    assert usage['total_tokens'] == 12 and usage['calls'] == 2
    assert usage['unmeasured_calls'] == 1


@pytest.mark.asyncio
async def test_agent_prepares_fresh_log_directory(profile):
    ai = LocalAgentAIAdapter(Agent(['{"ok":true}']))
    assert await ai.complete_json("system", "user") == {"ok": True}
    assert len(list((profile / "logs/agents/claude").glob('*.log'))) == 1


@pytest.mark.asyncio
async def test_agent_keeps_symlink_guard(profile, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (profile / "logs/agents").mkdir(parents=True)
    (profile / "logs/agents/claude").symlink_to(outside, target_is_directory=True)
    with pytest.raises(AgentIsolationUnavailableError):
        await LocalAgentAIAdapter(Agent(['{}'])).complete_json("s", "u")
    assert list(outside.iterdir()) == []


@pytest.mark.asyncio
async def test_video_tokens_include_internal_retry_and_cached_claude_input(profile):
    job = video(profile)
    await upsert_video(job.job_id, job.job_id)
    ai = for_video(LocalAgentAIAdapter(Agent(['not json', '{"ok":true}'])), job, "publication_copy")
    assert await ai.complete_json("s", "u") == {"ok": True}
    indexed = get_video(job.job_id)
    usage = indexed['details']['usage']
    assert usage['calls'] == 2 and usage['total_tokens'] == 100
    assert usage['by_step']['publication_copy']['input_tokens'] == 24
    assert usage['by_step']['publication_copy']['cached_input_tokens'] == 60
    assert usage['unmeasured_calls'] == 0
    refs = [r for r in indexed['logs'] if r['kind'] == 'usage_trace']
    assert len(refs) == 1 and refs[0]['content_key'] == 'productions/nodemotion/motion1'
    rows = [json.loads(s) for s in (profile / refs[0]['key']).read_text().splitlines()]
    assert [r['ok'] for r in rows] == [False, True]
    assert {r['model'] for r in rows} == {'actual-model'}
    assert len(list((profile / 'logs/jobs/motion1/agents/claude').glob('*.log'))) == 2
    from src.presentation.api.routers.content import video_usage
    response = await video_usage(job.job_id)
    assert response['total_tokens'] == 100


@pytest.mark.asyncio
async def test_failed_video_call_records_usage_without_losing_other_video(profile):
    class Failing:
        name = 'codex'
        async def complete_json_with_usage(self, *_):
            exc = RuntimeError('quota')
            exc.usage_attempts = [{"provider":"codex", "model":"reported", "input_tokens":9,
                                   "output_tokens":2, "total_tokens":11, "status":"failed"}]
            raise exc
    first, second = video(profile), video(profile, 'motion2')
    for job in (first, second): await upsert_video(job.job_id, job.job_id)
    with pytest.raises(RuntimeError, match='quota'):
        await for_video(Failing(), first, 'song_research').complete_json('s','u')
    assert get_video(first.job_id)['details']['usage']['total_tokens'] == 11
    assert 'usage' not in (get_video(second.job_id)['details'] or {})


@pytest.mark.asyncio
async def test_prepare_recovery_requires_completed_preview(profile):
    from src.core import drafts
    from src.core.drafts import Draft, DraftInputs
    job = video(profile)
    draft = Draft(draft_id='d1', template_id='lyrics-caution', niche_id='lyrics_video_caution',
                  status='failed', recoverable=True, created_at='', updated_at='')
    assert not drafts.can_prepare(draft, job)
    assert not drafts.can_render(draft, job)
    preview = job.advance(JobStage.HTML_GENERATED)
    assert drafts.can_prepare(draft, preview)
    assert drafts.can_render(draft, preview)
    drafts._save_job(draft.draft_id, job)
    assert not drafts._hide_missing_preview(draft).recoverable


def test_recording_prepared_copy_does_not_require_an_available_text_agent(profile, monkeypatch):
    from src.core import pipeline
    from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
    job = video(profile)
    job.artifacts.summary = to_summary(DraftDetails(copies={'youtube':PlatformDetails(title='T')}))
    def unavailable(): raise AssertionError('prepared copy must not start another model')
    monkeypatch.setattr(pipeline, 'get_copy_ai', unavailable)
    assert pipeline._publication_ai(job) is None


@pytest.mark.asyncio
async def test_prepared_details_use_data_and_logs(profile, monkeypatch):
    from src.core import drafts, draft_details
    from src.core.draft_details import DraftDetails, PlatformDetails
    job = video(profile).advance(JobStage.HTML_GENERATED)
    job.artifacts.content_dir.mkdir(parents=True)
    await upsert_video(job.job_id, job.job_id)
    draft = await drafts.create(template_id='lyrics-caution', niche_id=job.input.category_name,
                                inputs=drafts.DraftInputs(), job=job)
    details = DraftDetails(song_name='Canción', copies={'youtube':PlatformDetails(title='Título', description='Texto')})
    async def generate(*args, **kwargs): return details
    monkeypatch.setattr(draft_details, 'generate', generate)
    await drafts.run_prepare(draft, job)
    saved = await drafts.get(draft.draft_id)
    assert saved.status == 'prepared' and saved.details.copies['youtube'].title == 'Título'
    assert (profile / 'logs/jobs/motion1/08_prepared_details.json').is_file()
    assert get_video(job.job_id)['details']['summary']['youtube_title'] == 'Título'
    assert not list((profile / 'data').rglob('*.log'))


@pytest.mark.asyncio
async def test_render_api_rejects_unknown_engine_before_starting_work(profile):
    from httpx import AsyncClient, ASGITransport
    from src.presentation.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/v1/drafts/missing/render', json={'recorder_engine':'invalid'})
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_uploaded_song_is_transcribed_deduplicated_and_streamable(profile, monkeypatch):
    import asyncio
    import io
    import wave
    from httpx import AsyncClient, ASGITransport
    from src.presentation.main import app
    from src.presentation.api.routers import library
    from src.core.library import asset_library, transcription
    audio = io.BytesIO()
    with wave.open(audio, 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(8000)
        wav.writeframes(b'\0\0' * 8000)
    calls = []
    lyrics = {'segments':[{'start':0,'end':1,'text':'prueba','words':[{'start':0,'end':1,'word':'prueba'}]}],
              'metadata':{'language':'es'}}
    class Transcriber:
        async def transcribe(self, path, **kwargs):
            calls.append(path)
            return lyrics
    monkeypatch.setattr(library, 'get_lyrics_transcriber', lambda: Transcriber())
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        result = await client.post('/api/v1/library/music', files={'file':('prueba.wav',audio.getvalue(),'audio/wav')},
                                   data={'track_name':'Canción de prueba','category':'songs_with_lyrics'})
        assert result.status_code == 201, result.text
        asset_id = result.json()['asset_id']
        tasks = list(transcription._state().tasks.values())
        if tasks: await asyncio.gather(*tasks)
        entry = (await client.get(f'/api/v1/library/music/{asset_id}')).json()
        assert entry['transcription_status'] == 'done' and entry['has_lyrics_cache']
        assert (await client.get(f'/api/v1/library/music/{asset_id}/lyrics')).json() == lyrics
        duplicate = await client.post('/api/v1/library/music', files={'file':('otro.wav',audio.getvalue(),'audio/wav')})
        assert duplicate.status_code == 200 and duplicate.json()['asset_id'] == asset_id
        assert len(calls) == 1
        streamed = await client.get(f'/api/v1/library/music/{asset_id}/file', headers={'Range':'bytes=0-3'})
        assert streamed.status_code == 206 and streamed.content == b'RIFF'
        assert asset_library.resolve_music_path(asset_id).is_relative_to(profile / 'resources/music')
        assert not list((profile / 'data').rglob('*.wav'))
