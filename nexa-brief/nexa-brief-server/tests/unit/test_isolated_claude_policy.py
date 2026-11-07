import hashlib
import json
from pathlib import Path

import pytest

from src.adapters.agent.infrastructure.isolated_claude import (
    ClaudeFileRunner, candidate_argv, candidate_settings,
)
from src.core.ports.agent_port import AgentIsolationUnavailableError, AgentScope


def test_candidate_policy_has_no_shell_web_or_legacy_bypass():
    settings = candidate_settings()
    assert settings['permissions']['blockReadsOutsideWorkingDirectories'] is True
    assert settings['sandbox']['failIfUnavailable'] is True
    assert settings['sandbox']['allowUnsandboxedCommands'] is False
    assert settings['sandbox']['network']['allowedDomains'] == []
    argv = candidate_argv(Path('/opt/test/claude'))
    assert json.loads(argv[argv.index('--settings') + 1]) == settings
    assert {'--safe-mode', '--restricted', '--strict-mcp-config', '--no-session-persistence'} <= set(argv)
    assert argv[argv.index('--tools') + 1] == 'Read,Glob,Grep,Write,Edit'
    assert '--dangerously-skip-permissions' not in argv
    readonly = candidate_argv(Path('/opt/test/claude'), read_only=True)
    assert readonly[readonly.index('--tools') + 1] == 'Read,Glob,Grep'
    with pytest.raises(ValueError):
        candidate_argv(Path('claude'))


@pytest.fixture
def runner(tmp_path):
    binary = tmp_path / 'synthetic-claude'
    binary.write_text('''#!/usr/bin/python3
import json, os, sys
prompt = sys.stdin.read()
response = {'type':'result','result':json.dumps({'prompt':prompt,'cwd':os.getcwd(),
    'tools':sys.argv[sys.argv.index('--tools')+1], 'home':os.environ['HOME'],
    'config':os.environ['CLAUDE_CONFIG_DIR'], 'inherited_secret':os.environ.get('SYNTHETIC_SECRET')}),
    'usage':{'input_tokens':3}, 'modelUsage':{'synthetic-model':{}}}
if '--json-schema' in sys.argv:
    response['structured_output'] = {'schema':json.loads(sys.argv[sys.argv.index('--json-schema')+1]),'cwd':os.getcwd()}
print(json.dumps(response))
''')
    binary.chmod(0o700)
    config = tmp_path / 'auth-config'
    config.mkdir(mode=0o700)
    tools = tmp_path / 'tools'
    tools.mkdir(mode=0o700)
    socat = tools / 'socat'
    socat.write_text('synthetic')
    socat.chmod(0o700)
    workspace = tmp_path / 'work'
    workspace.mkdir(mode=0o700)
    runner = ClaudeFileRunner(binary=binary, config_dir=config,
                              expected_sha256=hashlib.sha256(binary.read_bytes()).hexdigest(), socat_dir=tools)
    return runner, workspace, config


@pytest.mark.asyncio
async def test_scoped_runner_uses_only_files_and_constructs_environment(runner, tmp_path, monkeypatch):
    agent, workspace, config = runner
    monkeypatch.setenv('SYNTHETIC_SECRET', 'not-exported')
    result = await agent.run('synthetic prompt', cwd=workspace, log_path=tmp_path / 'run.log',
                             timeout_seconds=5, scope=AgentScope(writable_dir=str(workspace)))
    assert result.ok
    observed = json.loads(result.last_message)
    assert observed['prompt'] == 'synthetic prompt' and observed['cwd'] == str(workspace)
    assert observed['tools'] == 'Read,Glob,Grep,Write,Edit'
    assert observed['inherited_secret'] is None and observed['config'] == str(config)
    assert not Path(observed['home']).exists()
    assert result.usage == {'input_tokens': 3} and result.model == 'synthetic-model'
    assert (tmp_path / 'run.log').is_file()


@pytest.mark.asyncio
async def test_read_only_scope_and_unverified_inputs_fail_closed(runner, tmp_path):
    agent, workspace, _ = runner
    readonly = AgentScope(writable_dir=str(workspace), read_only=True)
    result = await agent.run('read', cwd=workspace, log_path=tmp_path / 'read.log', timeout_seconds=5, scope=readonly)
    assert json.loads(result.last_message)['tools'] == 'Read,Glob,Grep'
    assert json.loads(result.last_message)['cwd'] != str(workspace)
    no_scope = await agent.run('no scope', cwd=workspace, log_path=tmp_path / 'no-scope.log', timeout_seconds=1)
    assert no_scope.ok and json.loads(no_scope.last_message)['cwd'] != str(workspace)
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('env', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=1,
                        scope=AgentScope(writable_dir=str(workspace), extra_env={'SECRET': 'opaque'}))
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('outside', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=1,
                        scope=AgentScope(writable_dir=str(tmp_path)))
    (workspace / 'escape').symlink_to(tmp_path / 'opaque')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('symlink', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=1,
                        scope=AgentScope(writable_dir=str(workspace)))
    (workspace / 'escape').unlink()
    (workspace / 'accounts.json').write_text('synthetic opaque')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('private name', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=1,
                        scope=AgentScope(writable_dir=str(workspace)))
    agent.expected_sha256 = '0' * 64
    assert not agent.available()


@pytest.mark.asyncio
async def test_structured_query_validates_only_schema_and_uses_fresh_empty_workspace(runner, tmp_path):
    agent, workspace, _ = runner
    schema = {'type': 'object', 'properties': {'ok': {'type': 'boolean'}}, 'required': ['ok']}
    path = workspace / 'schema.json'
    path.write_text(json.dumps(schema))
    scope = AgentScope(writable_dir='.', read_only=True, output_schema=path)
    result = await agent.run('query', cwd=workspace, log_path=tmp_path / 'structured.log', timeout_seconds=5, scope=scope)
    assert result.ok
    parsed = json.loads(result.last_message)
    assert parsed['schema'] == schema and parsed['cwd'] != str(workspace)
    assert not Path(parsed['cwd']).exists()
    path.unlink()
    path.symlink_to(tmp_path / 'outside')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('query', cwd=workspace, log_path=tmp_path / 'rejected.log', timeout_seconds=5, scope=scope)
    assert not (tmp_path / 'rejected.log').exists()
    path.unlink()
    path.write_text('{"type":"unsupported"}')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('query', cwd=workspace, log_path=tmp_path / 'invalid.log', timeout_seconds=5, scope=scope)
    assert not (tmp_path / 'invalid.log').exists()
    path.write_text('{"description":"' + 'x' * (96 * 1024) + '"}')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('query', cwd=workspace, log_path=tmp_path / 'large.log', timeout_seconds=5, scope=scope)
    outside_scope = AgentScope(writable_dir='.', read_only=True, output_schema=tmp_path / 'elsewhere.json')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('query', cwd=workspace, log_path=tmp_path / 'outside.log', timeout_seconds=5, scope=outside_scope)


@pytest.mark.asyncio
async def test_structured_query_fails_if_cli_did_not_return_structured_output(runner, tmp_path):
    agent, workspace, _ = runner
    agent.binary.write_text('#!/usr/bin/python3\nprint(\'{"type":"result","result":"{}"}\')\n')
    agent.binary.chmod(0o700)
    agent.expected_sha256 = hashlib.sha256(agent.binary.read_bytes()).hexdigest()
    schema = workspace / 'schema.json'
    schema.write_text('{"type":"object"}')
    scope = AgentScope(writable_dir='.', read_only=True, output_schema=schema)
    result = await agent.run('query', cwd=workspace, log_path=tmp_path / 'missing.log', timeout_seconds=5, scope=scope)
    assert not result.ok


@pytest.mark.asyncio
async def test_hardlinks_and_shared_log_are_rejected(runner, tmp_path):
    import os
    agent, workspace, _ = runner
    outside = tmp_path / 'unrelated'
    outside.write_text('synthetic')
    os.link(outside, workspace / 'linked')
    scope = AgentScope(writable_dir=str(workspace))
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('no', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=1, scope=scope)
    (workspace / 'linked').unlink()
    os.link(outside, tmp_path / 'log')
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('no', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=1, scope=scope)


@pytest.mark.asyncio
async def test_timeout_kills_child_process_and_returns_timeout(runner, tmp_path):
    import hashlib
    agent, workspace, _ = runner
    agent.binary.write_text('#!/usr/bin/python3\nimport time\ntime.sleep(30)\n')
    agent.binary.chmod(0o700)
    agent.expected_sha256 = hashlib.sha256(agent.binary.read_bytes()).hexdigest()
    result = await agent.run('timeout', cwd=workspace, log_path=tmp_path / 'log', timeout_seconds=0.2,
                             scope=AgentScope(writable_dir=str(workspace)))
    assert result.timed_out and not result.ok


@pytest.mark.asyncio
async def test_private_directory_cannot_be_used_as_workspace(runner, tmp_path):
    agent, _, _ = runner
    private = tmp_path / 'data'
    private.mkdir(mode=0o700)
    scope = AgentScope(writable_dir=str(private))
    with pytest.raises(AgentIsolationUnavailableError):
        await agent.run('no', cwd=private, log_path=tmp_path / 'log', timeout_seconds=1, scope=scope)
