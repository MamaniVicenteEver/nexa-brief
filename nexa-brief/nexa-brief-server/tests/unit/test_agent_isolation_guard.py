"""V2 cannot launch legacy CLIs; all inputs here are synthetic."""
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest

from src.adapters.agent.factory import agents_status, get_agent
from src.adapters.agent.infrastructure.cli_runner import ClaudeCodeRunner, CodexRunner, run_cli
from src.adapters.image_gen.codex_cli_image_adapter import CodexCLIImageAdapter, SubprocessRunner
from src.config.settings import settings
from src.core.ports.agent_port import AgentIsolationUnavailableError, AgentScope


def _python_wrapper(directory):
    """Keep the test interpreter's virtualenv when scripts resolve python3."""
    import shlex
    import sys

    command = directory / 'python3'
    command.write_text('#!/bin/sh\nexec ' + shlex.quote(sys.executable) + ' "$@"\n')
    command.chmod(0o755)


@pytest.fixture(params=[2, 3])
def v2(tmp_path: Path, monkeypatch, request):
    root = tmp_path / 'profile'
    root.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', request.param)
    monkeypatch.setattr(settings, 'data_dir', root / 'data')
    monkeypatch.setenv('SYNTHETIC_SECRET', 'not-to-be-inherited')
    return root


def test_factory_fails_closed_and_status_reports_unavailable(v2):
    for name in ('claude', 'codex'):
        with pytest.raises(AgentIsolationUnavailableError, match='perfiles v2'):
            get_agent(name)
    assert agents_status() == [{'name': 'claude', 'available': False}, {'name': 'codex', 'available': False}]


@pytest.mark.parametrize('runner_class', [ClaudeCodeRunner, CodexRunner])
@pytest.mark.parametrize('scope', [None, AgentScope(writable_dir='.', read_only=True),
                                    AgentScope(writable_dir='.', extra_env={'SYNTHETIC_SECRET': 'bad'})])
async def test_direct_legacy_runner_never_spawns_or_creates_logs(v2, monkeypatch, runner_class, scope):
    spawn = AsyncMock(side_effect=AssertionError('must not launch'))
    monkeypatch.setattr('src.adapters.agent.infrastructure.cli_runner.asyncio.create_subprocess_exec', spawn)
    log = v2 / 'logs/agent.log'
    assert not runner_class('/fake/agent').available()
    with pytest.raises(AgentIsolationUnavailableError, match='aislamiento verificado'):
        await runner_class('/fake/agent').run('test', cwd=v2, log_path=log, timeout_seconds=1, scope=scope)
    spawn.assert_not_called()
    assert not log.parent.exists()


async def test_low_level_run_cli_is_also_guarded(v2, monkeypatch):
    spawn = AsyncMock(side_effect=AssertionError('must not launch'))
    monkeypatch.setattr('src.adapters.agent.infrastructure.cli_runner.asyncio.create_subprocess_exec', spawn)
    with pytest.raises(AgentIsolationUnavailableError):
        await run_cli(['/fake/agent'], cwd=v2, log_path=v2 / 'l/agent.log', timeout_seconds=1,
                      extra_env={'SYNTHETIC_SECRET': 'not-to-be-inherited'})
    spawn.assert_not_called()
    assert not (v2 / 'l').exists()


def test_image_cli_fails_before_preparing_environment_or_invoking_runner(v2, monkeypatch):
    spy = Mock()
    popen = Mock(side_effect=AssertionError('must not launch'))
    monkeypatch.setattr('src.adapters.image_gen.codex_cli_image_adapter.subprocess.Popen', popen)
    out = v2 / 'renders/images'
    adapter = CodexCLIImageAdapter(output_root=out, codex_home=v2 / 'fake-home', runner=spy)
    with pytest.raises(AgentIsolationUnavailableError):
        adapter.generate('cover', 'synthetic', '256x256')
    spy.run.assert_not_called()
    assert not out.exists()
    with pytest.raises(AgentIsolationUnavailableError):
        SubprocessRunner().run(['/fake/agent'], 'prompt', v2, {'SYNTHETIC_SECRET': 'bad'}, 1)
    popen.assert_not_called()


def test_v1_still_constructs_legacy_runners(monkeypatch):
    monkeypatch.setattr(settings, 'storage_profile_dir', None)
    monkeypatch.setattr(settings, 'storage_layout_version', 1)
    assert isinstance(get_agent('claude'), ClaudeCodeRunner)
    assert isinstance(get_agent('codex'), CodexRunner)


@pytest.mark.parametrize('script', ['delegate.sh', 'delegate-web.sh', 'delegate-mcp.sh', 'delegate-effort.sh'])
def test_delegate_shell_scripts_fail_closed_for_v2(tmp_path, script):
    import json
    import os
    import subprocess

    profile = tmp_path / 'selected'
    profile.mkdir()
    (profile / 'profile.json').write_text(json.dumps({'schema_version': 2, 'id': 'fixture'}))
    executables = tmp_path / 'bin'
    executables.mkdir()
    _python_wrapper(executables)
    fake = executables / 'codex'
    fake.write_text(f'#!/bin/sh\ntouch "{tmp_path / "launched"}"\n')
    fake.chmod(0o755)
    source = Path(__file__).resolve().parents[2] / 'src/templates/_tools/sandbox' / script
    result = subprocess.run(['bash', str(source), 'cat/item', 'task'], capture_output=True, text=True,
                            env={**os.environ, 'NEXA_PROFILE_DIR': str(profile),
                                 'PATH': f'{executables}:{os.environ["PATH"]}'}, timeout=15)
    assert result.returncode != 0
    assert 'aislamiento del perfil' in result.stderr
    assert not (tmp_path / 'launched').exists()


@pytest.mark.parametrize('script', ['delegate.sh', 'delegate-web.sh', 'delegate-mcp.sh', 'delegate-effort.sh'])
def test_delegate_shell_scripts_allow_v1(tmp_path, script):
    import json
    import os
    import subprocess

    profile = tmp_path / 'selected'
    profile.mkdir()
    (profile / 'profile.json').write_text(json.dumps({'schema_version': 1, 'id': 'fixture'}))
    executables = tmp_path / 'bin'
    executables.mkdir()
    _python_wrapper(executables)
    source = Path(__file__).resolve().parents[2] / 'src/templates/_tools/sandbox' / script
    result = subprocess.run(['bash', str(source)], capture_output=True, text=True,
                            env={**os.environ, 'NEXA_PROFILE_DIR': str(profile),
                                 'PATH': f'{executables}:{os.environ["PATH"]}'}, timeout=15)
    assert result.returncode == 2
    assert 'Uso:' in result.stderr
    assert 'aislamiento del perfil' not in result.stderr


@pytest.mark.parametrize('runner_class', [ClaudeCodeRunner, CodexRunner])
async def test_v1_runner_still_launches_with_legacy_environment(tmp_path, monkeypatch, runner_class):
    monkeypatch.setattr(settings, 'storage_profile_dir', None)
    monkeypatch.setattr(settings, 'storage_layout_version', 1)
    monkeypatch.setenv('SYNTHETIC_LEGACY', 'present')
    process = Mock()
    process.stdin = Mock()
    process.stdin.drain = AsyncMock()
    process.wait = AsyncMock(return_value=0)
    process.returncode = 0
    spawn = AsyncMock(return_value=process)
    monkeypatch.setattr('src.adapters.agent.infrastructure.cli_runner.asyncio.create_subprocess_exec', spawn)
    runner = runner_class('/fake/agent')
    assert runner.available()
    result = await runner.run('synthetic prompt', cwd=tmp_path, log_path=tmp_path / 'agent.log', timeout_seconds=1)
    assert result.ok
    spawn.assert_awaited_once()
    assert spawn.call_args.kwargs['env']['SYNTHETIC_LEGACY'] == 'present'
