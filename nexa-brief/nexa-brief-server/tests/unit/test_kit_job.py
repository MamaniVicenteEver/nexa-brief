import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit/tools'
sys.path.insert(0, str(TOOLS))
import job
import kit_job


@pytest.fixture
def video(tmp_path):
    (tmp_path / 'work').mkdir()
    return tmp_path


def test_detached_voice_success_and_concurrent_lock(video, tmp_path, monkeypatch):
    fake_tools = tmp_path / 'fake_tools'
    fake_tools.mkdir()
    for name in ('job.py', 'kit_job.py'):
        shutil.copy(TOOLS / name, fake_tools)
    (fake_tools / 'kit.py').write_text(
        'import os,sys,time\nprint("fake voice", flush=True)\n'
        'assert sys.argv[1:] == ["voice", "test", "--voice", "Charon"]\n'
        'assert os.fstat(int(os.environ["NEXA_KIT_JOB_FD"]))\n'
        'time.sleep(.5)\n')
    monkeypatch.setattr(kit_job, 'TOOLS', fake_tools)
    assert kit_job.launch(video, 'voice', True, ['voice', 'test', '--voice', 'Charon']) == 0
    assert kit_job.launch(video, 'voice', True, ['voice', 'test']) == 0
    assert job.wait(video, 'voice', 0) == 2
    assert job.wait(video, 'voice', 5) == 0
    assert job.read_status(video / 'work', 'voice')['state'] == 'completed'
    assert 'fake voice' in (video / 'work/voice.log').read_text()


def test_voice_failure_interruption_and_independent_locks(video, monkeypatch):
    monkeypatch.setattr(kit_job.subprocess, 'run', lambda args, **kw: subprocess.CompletedProcess(args, 143))
    voice_fd = job.lock(video / 'work', 'voice')
    transcribe_fd = job.lock(video / 'work', 'transcribe')
    assert transcribe_fd is not None
    os.close(transcribe_fd)
    assert kit_job.worker(video, voice_fd, 'voice', ['voice', 'test']) == 1
    assert job.wait(video, 'voice', 0) == 1
    assert '143' in job.read_status(video / 'work', 'voice')['error']
    job.write_status(video / 'work', 'voice', state='running')
    assert job.wait(video, 'voice', 0) == 1
    assert 'interrumpido' in job.read_status(video / 'work', 'voice')['error']
    fd = job.lock(video / 'work', 'voice')
    assert fd is not None
    os.close(fd)


def test_voice_cli_passes_options_and_wait_does_not_run(video, monkeypatch):
    spec = importlib.util.spec_from_file_location('kit_cli_test', TOOLS / 'kit.py')
    kit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kit)
    monkeypatch.setattr(kit, 'vdir', lambda _: video)
    calls = []
    monkeypatch.setattr(kit.kit_job, 'launch', lambda *args: calls.append(args) or 0)
    monkeypatch.setattr(sys, 'argv', ['kit.py', 'voice', 'test', '--background', '--voice', 'Charon', '--parts', '2'])
    with pytest.raises(SystemExit) as result:
        kit.main()
    assert result.value.code == 0
    assert calls == [(video, 'voice', True, ['voice', 'test', '--voice', 'Charon', '--parts', '2'])]
    monkeypatch.setattr(sys, 'argv', ['kit.py', 'voice', 'test', '--wait', '--timeout', '0'])
    with pytest.raises(SystemExit) as result:
        kit.main()
    assert result.value.code == 1
    assert len(calls) == 1


def test_timeout_validation(monkeypatch):
    spec = importlib.util.spec_from_file_location('kit_cli_validation', TOOLS / 'kit.py')
    kit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kit)
    for args in (['voice', 'test', '--wait', '--timeout', '31'],
                 ['voice', 'test', '--background', '--timeout', '5'],
                 ['voice', 'test', '--wait', '--background']):
        monkeypatch.setattr(sys, 'argv', ['kit.py', *args])
        with pytest.raises(SystemExit) as result:
            kit.main()
        assert result.value.code == 2


def test_voice_command_copies_only_after_success(video, monkeypatch):
    spec = importlib.util.spec_from_file_location('kit_voice_test', TOOLS / 'kit.py')
    kit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kit)
    from types import SimpleNamespace
    (video / 'assets').mkdir()
    (video / 'work/narration.mp3').write_bytes(b'placeholder')
    monkeypatch.setattr(kit, 'vdir', lambda _: video)
    monkeypatch.setattr(kit, 'design_of', lambda _: 'binary')
    calls = []
    monkeypatch.setattr(kit, 'run', lambda cmd: calls.append(cmd) or subprocess.CompletedProcess(cmd, 0))
    args = SimpleNamespace(id='test', voice='Charon', model='example', parts=2, dry=False)
    kit.cmd_voice(args)
    assert (video / 'assets/song.mp3').read_bytes() == b'placeholder'
    assert calls[0][-6:] == ['--voice', 'Charon', '--model', 'example', '--parts', '2']
    (video / 'assets/song.mp3').unlink()
    monkeypatch.setattr(kit, 'run', lambda cmd: subprocess.CompletedProcess(cmd, 1))
    with pytest.raises(SystemExit):
        kit.cmd_voice(args)
    assert not (video / 'assets/song.mp3').exists()

