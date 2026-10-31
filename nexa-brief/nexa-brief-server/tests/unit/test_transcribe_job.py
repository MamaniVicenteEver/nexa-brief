import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit/tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('transcribe_job_test', TOOLS / 'transcribe_job.py')
job = importlib.util.module_from_spec(spec)
spec.loader.exec_module(job)


@pytest.fixture
def video(tmp_path):
    (tmp_path / 'assets').mkdir()
    (tmp_path / 'work').mkdir()
    return tmp_path


def test_background_holds_lock_and_waits_without_whisper(video, monkeypatch):
    # A real detached child inherits the lock and simulates a slow worker.
    script = video / 'fake_worker.py'
    script.write_text('import os,sys,time\ntime.sleep(.5)\nos.close(int(sys.argv[2]))\n')
    real_popen = subprocess.Popen
    processes = []

    def spawn(args, **kwargs):
        p = real_popen([sys.executable, str(script), args[2], args[3]], **kwargs)
        processes.append(p)
        return p

    monkeypatch.setattr(job.subprocess, 'Popen', spawn)
    assert job.launch(video, True) == 0
    assert job.launch(video, True) == 0
    assert len(processes) == 1
    assert job.wait(video, 0) == 2
    processes[0].wait(timeout=5)
    assert job.wait(video, 0) == 1
    assert job.read_status(video / 'work')['state'] == 'failed'
    assert job.launch(video, True) == 0
    processes[-1].wait(timeout=5)


def test_worker_success_runs_outro_and_records_actual_usage(video, monkeypatch):
    calls = []
    monkeypatch.setattr(job.subprocess, 'run', lambda args, **kw: subprocess.CompletedProcess(args, 0))
    monkeypatch.setattr(job.outro, 'apply', lambda path: calls.append(('outro', path)))
    monkeypatch.setattr(job.usage, 'record', lambda path, **kw: calls.append(('usage', kw)))
    fd = job.lock(video / 'work')
    assert job.worker(video, fd) == 0
    assert job.wait(video, 0) == 0
    assert job.read_status(video / 'work')['state'] == 'completed'
    assert calls[0] == ('outro', video)
    assert calls[1][1]['ok'] is True


def test_worker_failure_skips_outro_and_can_retry(video, monkeypatch):
    monkeypatch.setattr(job.subprocess, 'run', lambda args, **kw: subprocess.CompletedProcess(args, 143))
    monkeypatch.setattr(job.outro, 'apply', lambda path: pytest.fail('outro must not run'))
    calls = []
    monkeypatch.setattr(job.usage, 'record', lambda path, **kw: calls.append(kw))
    assert job.worker(video, job.lock(video / 'work')) == 1
    assert job.wait(video, 0) == 1
    assert '143' in job.read_status(video / 'work')['error']
    assert calls[0]['ok'] is False
    fd = job.lock(video / 'work')
    assert fd is not None
    os.close(fd)


def test_no_job_and_outro_failure(video, monkeypatch):
    assert job.wait(video, 0) == 1
    monkeypatch.setattr(job.subprocess, 'run', lambda args, **kw: subprocess.CompletedProcess(args, 0))
    def fail(path):
        raise ValueError('outro roto')
    monkeypatch.setattr(job.outro, 'apply', fail)
    monkeypatch.setattr(job.usage, 'record', lambda *a, **k: None)
    assert job.worker(video, job.lock(video / 'work')) == 1
    assert 'outro roto' in job.read_status(video / 'work')['error']


def test_detached_worker_end_to_end(video, tmp_path, monkeypatch):
    fake_tools = tmp_path / 'tools'
    fake_tools.mkdir()
    shutil.copy(TOOLS / 'transcribe_job.py', fake_tools)
    shutil.copy(TOOLS / 'job.py', fake_tools)
    (fake_tools / 'transcribe.py').write_text(
        'import pathlib,sys,time\nprint("simulated progress", flush=True)\ntime.sleep(.3)\npathlib.Path(sys.argv[3]).write_text("lyrics")\n')
    (fake_tools / 'outro.py').write_text('def apply(video):\n    (video / "outro-done").touch()\n')
    (fake_tools / 'usage.py').write_text('def record(video, **kw):\n    (video / "usage-done").touch()\n')
    monkeypatch.setattr(job, 'TOOLS', fake_tools)
    assert job.launch(video, True) == 0
    assert job.wait(video, 5) == 0
    assert (video / 'assets/lyrics.json').read_text() == 'lyrics'
    assert (video / 'outro-done').exists()
    assert (video / 'usage-done').exists()
    assert 'simulated progress' in (video / 'work/transcribe.log').read_text()
