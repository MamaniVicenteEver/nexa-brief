import asyncio
import contextlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.adapters.recorder.infrastructure.subprocess_progress import run_with_progress
from src.adapters.recorder.infrastructure import hyperframes_adapter as hf
from src.adapters.recorder.infrastructure import playwright_ffmpeg_adapter as pw
from src.core.ports.recorder_port import RecordingResult


@pytest.mark.parametrize('failure', [False, True])
async def test_remotion_partial_is_owned_and_preserves_previous(tmp_path, monkeypatch, failure):
    from src.adapters.recorder.infrastructure import remotion_adapter as rm
    (tmp_path/'config.json').write_text('{}')
    final = tmp_path/'youtube_video.mp4'; final.write_bytes(b'previous')
    fmt = SimpleNamespace(output_filename=final.name)
    config = SimpleNamespace(template=SimpleNamespace(media_src_filename='bg.jpg',requires_lyrics=False),
                             get_16x9_format=lambda:fmt,get_9x16_format=lambda:None,
                             video=SimpleNamespace(formats=[fmt],generate_tiktok_clip=False))
    monkeypatch.setattr(rm,'_resolve_composition_id',lambda _: 'test')
    monkeypatch.setattr(rm,'_get_render_semaphore',lambda:asyncio.Semaphore(1))
    async def run(cmd, **kwargs):
        output=Path(next(x.split('=',1)[1] for x in cmd if x.startswith('--output=')))
        assert output.parent.name.startswith('_remotion_job_')
        output.write_bytes(b'new')
        if failure: raise asyncio.TimeoutError()
        return SimpleNamespace(returncode=0,stderr_tail='',stdout_tail='')
    monkeypatch.setattr(rm,'run_with_progress',run)
    if failure:
        with pytest.raises(Exception): await rm.RemotionAdapter().record(tmp_path/'index.html',tmp_path/'song.mp3',tmp_path,1,config)
        assert final.read_bytes()==b'previous'
    else:
        result=await rm.RemotionAdapter().record(tmp_path/'index.html',tmp_path/'song.mp3',tmp_path,1,config)
        assert result.youtube_path==final and final.read_bytes()==b'new'
    assert not list(tmp_path.glob('_remotion_job_*'))


@pytest.mark.parametrize('cancel', [False, True])
async def test_timeout_or_cancel_kills_descendant_without_touching_other_job(tmp_path, cancel):
    marker = tmp_path / 'orphan-wrote'
    child = "import signal,time,pathlib,sys; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(1.5); pathlib.Path(sys.argv[1]).write_text('orphan')"
    script = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[2]]); print('ready',flush=True); time.sleep(10)"
    task = asyncio.create_task(run_with_progress([sys.executable, '-c', script, child, str(marker)], cwd=tmp_path, timeout=10 if cancel else .5, parse_progress=lambda _: None))
    other = asyncio.create_task(run_with_progress([sys.executable, '-c', "import time; time.sleep(.8); print('done')"], cwd=tmp_path, timeout=3, parse_progress=lambda _: None))
    if cancel:
        await asyncio.sleep(.5)
        task.cancel()
    with pytest.raises(asyncio.CancelledError if cancel else asyncio.TimeoutError):
        await task
    assert (await other).returncode == 0
    await asyncio.sleep(1.2)
    assert not marker.exists()


def cfg(name):
    fmt=SimpleNamespace(output_filename=name, width=1920, height=1080, aspect_ratio='16:9')
    return SimpleNamespace(template=SimpleNamespace(media_src_filename='bg.jpg', requires_image=False, requires_video=False, template_id='test'), video=SimpleNamespace(formats=[fmt], generate_tiktok_clip=False), get_16x9_format=lambda:fmt, get_9x16_format=lambda:None)


async def test_hyperframes_failed_job_cleans_own_workspace_and_preserves_other(tmp_path, monkeypatch):
    monkeypatch.setattr(hf, '_hyperframes_bin', lambda: Path(sys.executable))
    monkeypatch.setattr(hf, '_resolve_composition_dir', lambda _: None)
    monkeypatch.setattr(hf, '_resolve_template_dir', lambda _: tmp_path)
    monkeypatch.setattr(hf, '_render_passes', lambda c, **kw:[hf._RenderPass(1920, 1080, 1, (c.get_16x9_format().output_filename,))])
    monkeypatch.setattr(hf, '_get_render_semaphore', lambda: asyncio.Semaphore(2))
    def stage(site, *args): site.mkdir(); (site / '_hyperframes_variables.json').write_text('{}')
    monkeypatch.setattr(hf.HyperframesAdapter, '_stage_generic_site', staticmethod(stage))
    ready=asyncio.Event();release=asyncio.Event()
    async def render(self, binary, site, out, *args, **kwargs):
        assert site.parent == out.parent
        (out.parent/'work-test').mkdir();out.write_bytes(b'partial')
        if out.name=='failed.mp4':
            ready.set(); await release.wait(); raise RuntimeError('failed')
        await ready.wait(); out.write_bytes(b'good');release.set()
    monkeypatch.setattr(hf.HyperframesAdapter, '_render', render)
    (tmp_path/'failed.mp4').write_bytes(b'old')
    adapter=hf.HyperframesAdapter()
    fail=asyncio.create_task(adapter.record(tmp_path/'index.html',tmp_path/'audio',tmp_path,1,cfg('failed.mp4')))
    good=asyncio.create_task(adapter.record(tmp_path/'index.html',tmp_path/'audio',tmp_path,1,cfg('good.mp4')))
    await good
    with pytest.raises(RuntimeError): await fail
    assert (tmp_path/'failed.mp4').read_bytes()==b'old'
    assert (tmp_path/'good.mp4').read_bytes()==b'good'
    assert not list(tmp_path.glob('_hyperframes_job_*'))


async def test_playwright_failed_capture_preserves_old_output_and_foreign_webm(tmp_path, monkeypatch):
    monkeypatch.setattr(pw.shutil, 'which', lambda _: '/bin/ffmpeg')
    @contextlib.contextmanager
    def serve(_): yield 'http://127.0.0.1'
    monkeypatch.setattr(pw, '_serve_directory', serve)
    async def fail(self, url, audio, workspace, *args):
        (workspace/'youtube_video.mp4').write_bytes(b'partial')
        (workspace/'random.webm').write_bytes(b'capture')
        raise RuntimeError('failed')
    monkeypatch.setattr(pw.PlaywrightFFmpegAdapter, '_record_all_formats', fail)
    (tmp_path/'youtube_video.mp4').write_bytes(b'old')
    (tmp_path/'foreign.webm').write_bytes(b'foreign')
    with pytest.raises(RuntimeError): await pw.PlaywrightFFmpegAdapter().record(tmp_path/'index.html',tmp_path/'audio',tmp_path,1)
    assert (tmp_path/'youtube_video.mp4').read_bytes()==b'old'
    assert (tmp_path/'foreign.webm').read_bytes()==b'foreign'
    assert not list(tmp_path.glob('_playwright_job_*'))


async def test_playwright_success_publishes_all_declared_formats(tmp_path, monkeypatch):
    monkeypatch.setattr(pw.shutil, 'which', lambda _: '/bin/ffmpeg')
    @contextlib.contextmanager
    def serve(_): yield 'http://127.0.0.1'
    monkeypatch.setattr(pw, '_serve_directory', serve)
    async def capture(self, url, audio, workspace, *args):
        for name in ('youtube.mp4','extra.mp4'):
            (workspace/name).write_bytes(name.encode())
        return RecordingResult(youtube_path=workspace/'youtube.mp4')
    monkeypatch.setattr(pw.PlaywrightFFmpegAdapter, '_record_all_formats', capture)
    c=SimpleNamespace(video=SimpleNamespace(formats=[SimpleNamespace(output_filename='youtube.mp4'),SimpleNamespace(output_filename='extra.mp4')]))
    result=await pw.PlaywrightFFmpegAdapter().record(tmp_path/'index.html',tmp_path/'audio',tmp_path,1,c)
    assert result.youtube_path==tmp_path/'youtube.mp4'
    assert (tmp_path/'extra.mp4').read_bytes()==b'extra.mp4'
    assert not list(tmp_path.glob('_playwright_job_*'))


async def test_hyperframes_second_pass_failure_keeps_both_previous_outputs(tmp_path, monkeypatch):
    monkeypatch.setattr(hf, '_hyperframes_bin', lambda: Path(sys.executable))
    monkeypatch.setattr(hf, '_resolve_composition_dir', lambda _: None)
    monkeypatch.setattr(hf, '_resolve_template_dir', lambda _: tmp_path)
    monkeypatch.setattr(hf, '_render_passes', lambda c, **kw:[hf._RenderPass(1920,1080,1,('first.mp4',)),hf._RenderPass(1080,1920,1,('second.mp4',))])
    monkeypatch.setattr(hf, '_get_render_semaphore', lambda: asyncio.Semaphore(1))
    def stage(site, *args):site.mkdir()
    monkeypatch.setattr(hf.HyperframesAdapter, '_stage_generic_site', staticmethod(stage))
    async def render(self, binary, site, out, *args, **kwargs):
        out.write_bytes(b'new')
        if out.name=='second.mp4':raise RuntimeError('second pass failed')
    monkeypatch.setattr(hf.HyperframesAdapter,'_render',render)
    for name in ('first.mp4','second.mp4'):(tmp_path/name).write_bytes(b'old')
    with pytest.raises(RuntimeError): await hf.HyperframesAdapter().record(tmp_path/'index',tmp_path/'audio',tmp_path,1,cfg('first.mp4'))
    assert [(tmp_path/n).read_bytes() for n in ('first.mp4','second.mp4')]==[b'old',b'old']
    assert not list(tmp_path.glob('_hyperframes_job_*'))


async def test_successful_cli_cannot_leave_worker_writing(tmp_path):
    marker = tmp_path/'late-write'
    child = "import signal,time,pathlib,sys; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(1); pathlib.Path(sys.argv[1]).write_text('bad')"
    script = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[2]],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(.3)"
    result=await run_with_progress([sys.executable,'-c',script,child,str(marker)],cwd=tmp_path,timeout=3,parse_progress=lambda _:None)
    assert result.returncode==0
    await asyncio.sleep(1.0)
    assert not marker.exists()


def test_workspace_lock_lives_until_crash_and_can_then_be_reclaimed(tmp_path):
    import fcntl
    import json
    import os
    import shutil
    import signal
    import subprocess
    from src.adapters.recorder.infrastructure.render_workspace import render_workspace

    child_code = "from pathlib import Path; import time,sys; from src.adapters.recorder.infrastructure.render_workspace import render_workspace\nwith render_workspace(Path(sys.argv[1]), 'hyperframes') as work:\n print(work,flush=True); time.sleep(60)"
    proc = subprocess.Popen([sys.executable, '-c', child_code, str(tmp_path)], stdout=subprocess.PIPE, text=True)
    try:
        workspace = Path(proc.stdout.readline().strip())
        marker = json.loads((workspace/'.owner.json').read_text())
        assert marker['version'] == 1 and marker['namespace'] == 'hyperframes'
        assert marker['id'] and marker['created_at'] > 0
        fd = os.open(workspace/'.owner.lock', os.O_RDWR)
        try:
            with pytest.raises(BlockingIOError): fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            proc.send_signal(signal.SIGKILL)
            proc.wait(timeout=3)
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            shutil.rmtree(workspace)
        finally: os.close(fd)
        assert not workspace.exists()
        with render_workspace(tmp_path, 'playwright') as path:
            assert path.exists()
        assert not path.exists()
    finally:
        if proc.poll() is None: proc.kill(); proc.wait()


async def test_recorders_read_inputs_from_html_directory_and_write_elsewhere(tmp_path, monkeypatch):
    from src.adapters.recorder.infrastructure import remotion_adapter as rm
    inputs = tmp_path / 'production'
    outputs = tmp_path / 'renders'
    inputs.mkdir()
    outputs.mkdir()
    (inputs / 'config.json').write_text('{}')
    (inputs / 'index.html').write_text('<html></html>')
    (inputs / 'song.mp3').write_bytes(b'audio')
    config = cfg('final.mp4')
    config.template.requires_lyrics = False
    monkeypatch.setattr(rm, '_resolve_composition_id', lambda _: 'test')
    monkeypatch.setattr(rm, '_get_render_semaphore', lambda: asyncio.Semaphore(1))
    async def run(cmd, **kwargs):
        assert f'--public-dir={inputs}' in cmd
        Path(next(x.split('=', 1)[1] for x in cmd if x.startswith('--output='))).write_bytes(b'r')
        return SimpleNamespace(returncode=0, stderr_tail='', stdout_tail='')
    monkeypatch.setattr(rm, 'run_with_progress', run)
    result = await rm.RemotionAdapter().record(inputs/'index.html', inputs/'song.mp3', outputs, 1, config)
    assert result.youtube_path == outputs/'final.mp4'

    monkeypatch.setattr(pw.shutil, 'which', lambda _: '/bin/ffmpeg')
    @contextlib.contextmanager
    def serve(directory):
        assert directory == inputs
        yield 'http://127.0.0.1'
    monkeypatch.setattr(pw, '_serve_directory', serve)
    async def capture(self, url, audio, workspace, *args):
        (workspace/'final.mp4').write_bytes(b'p')
        return RecordingResult(youtube_path=workspace/'final.mp4')
    monkeypatch.setattr(pw.PlaywrightFFmpegAdapter, '_record_all_formats', capture)
    result = await pw.PlaywrightFFmpegAdapter().record(inputs/'index.html', inputs/'song.mp3', outputs, 1, config)
    assert result.youtube_path == outputs/'final.mp4'

    monkeypatch.setattr(hf, '_hyperframes_bin', lambda: Path(sys.executable))
    monkeypatch.setattr(hf, '_resolve_composition_dir', lambda _: None)
    monkeypatch.setattr(hf, '_resolve_template_dir', lambda _: inputs)
    monkeypatch.setattr(hf, '_render_passes', lambda c, **kw: [hf._RenderPass(1920, 1080, 1, ('final.mp4',))])
    monkeypatch.setattr(hf, '_get_render_semaphore', lambda: asyncio.Semaphore(1))
    def stage(site, template, input_dir, *args):
        assert input_dir == inputs
        site.mkdir()
    async def render(self, binary, site, out, *args, **kwargs): out.write_bytes(b'h')
    monkeypatch.setattr(hf.HyperframesAdapter, '_stage_generic_site', staticmethod(stage))
    monkeypatch.setattr(hf.HyperframesAdapter, '_render', render)
    result = await hf.HyperframesAdapter().record(inputs/'index.html', inputs/'song.mp3', outputs, 1, config)
    assert result.youtube_path == outputs/'final.mp4'
