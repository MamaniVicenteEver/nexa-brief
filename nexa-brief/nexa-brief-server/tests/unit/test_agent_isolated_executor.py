import asyncio
import hashlib
import json
from pathlib import Path
import platform

import pytest

from src.adapters.agent.infrastructure import isolated_executor as isolated
from src.config.profile_layout import resolve_profile_layout
from src.core.ports.agent_port import AgentIsolationUnavailableError, AgentScope


def test_unapproved_binary_fails_closed(tmp_path, monkeypatch):
    executable = tmp_path / 'codex'
    executable.write_text('fake')
    monkeypatch.setattr(isolated, 'APPROVED_BUILDS', ())
    with pytest.raises(AgentIsolationUnavailableError):
        isolated._verified_build(str(executable))


def test_workspace_rejects_private_paths_symlinks_and_extra_grants(tmp_path):
    layout = resolve_profile_layout(tmp_path, 3)
    production = layout.productions_dir / 'example' / 'video'
    production.mkdir(parents=True)
    private = layout.data_dir
    private.mkdir()
    assert isolated._workspace(production, AgentScope('.'), layout) == production
    link = production / 'escape'
    link.symlink_to(private, target_is_directory=True)
    for cwd, scope in [(private, AgentScope('.')), (production, AgentScope('escape')),
                       (production, None)]:
        with pytest.raises(AgentIsolationUnavailableError):
            isolated._workspace(cwd, scope, layout)
    with pytest.raises(AgentIsolationUnavailableError):
        isolated._workspace(production, AgentScope('.'), layout)
    link.unlink()
    source = private / 'secret'
    source.write_text('fixture')
    (production / 'hardlink').hardlink_to(source)
    with pytest.raises(AgentIsolationUnavailableError):
        isolated._workspace(production, AgentScope('.'), layout)
    with pytest.raises(AgentIsolationUnavailableError):
        isolated._workspace(production.parent, AgentScope('.'), layout)


def test_runner_uses_approved_binary_and_filters_harness_environment(tmp_path, monkeypatch):
    layout = resolve_profile_layout(tmp_path / 'profile', 3)
    work = layout.productions_dir / 'example' / 'video'
    work.mkdir(parents=True)
    home = tmp_path / 'fake-home'
    home.mkdir()
    binary = tmp_path / 'fake-codex'
    binary.write_text('''#!/usr/bin/python3
import json, os, sys
args = sys.argv[1:]
with open(args[args.index('-o') + 1], 'w') as f: f.write('synthetic result')
print(json.dumps({'args': args, 'secret_present': 'TEST_SECRET' in os.environ}))
''')
    binary.chmod(0o755)
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    build = isolated.CodexBuild(binary, digest, binary, digest, platform.release(), isolated._policy_digest())
    monkeypatch.setattr(isolated, 'APPROVED_BUILDS', (build,))
    monkeypatch.setattr(isolated, 'layout_for_settings', lambda _: layout)
    monkeypatch.setenv('HOME', str(home))
    monkeypatch.setenv('CODEX_HOME', str(home))
    monkeypatch.setenv('TEST_SECRET', 'synthetic')
    log = layout.logs_dir / 'test.log'
    runner = isolated.IsolatedCodexRunner(str(binary))
    assert runner.available()
    result = asyncio.run(runner.run('prompt', cwd=work, log_path=log, timeout_seconds=5, scope=AgentScope('.', extra_writable=(str(layout.logs_dir / 'videos' / work.name),),
                                                  extra_env={'NEXA_EXPLAINER_PIPELINE_AGENT': '1'})))
    assert result.ok and result.last_message == 'synthetic result'
    assert (home / 'tmp' / 'arg0').is_dir()
    record = json.loads(log.read_text())
    assert record['secret_present'] is False
    args = record['args']
    assert '--ignore-user-config' in args and '--ignore-rules' in args and '--ephemeral' in args
    configs = [args[i + 1] for i, value in enumerate(args[:-1]) if value == '-c']
    assert 'permissions.isolated.network.enabled=false' in configs
    assert 'shell_environment_policy.inherit="none"' in configs
    assert 'shell_environment_policy.set.NEXA_EXPLAINER_PIPELINE_AGENT="1"' in configs
    assert all('features.' + feature + '=false' in configs for feature in
               ('hooks', 'apps', 'goals', 'shell_snapshot', 'plugins'))
    assert any(':root' in config and ':workspace_roots' in config for config in configs)
    assert list((layout.runtime_dir / 'agents').iterdir()) == []
    pure = asyncio.run(runner.run('prompt', cwd=layout.data_dir, log_path=log, timeout_seconds=5))
    assert pure.ok
    readonly = asyncio.run(runner.run('prompt', cwd=layout.data_dir, log_path=log, timeout_seconds=5,
                                      scope=AgentScope('.', read_only=True)))
    assert readonly.ok
    readonly_record = json.loads(log.read_text().splitlines()[-1])
    readonly_configs = [readonly_record['args'][i + 1] for i, value in enumerate(readonly_record['args'][:-1]) if value == '-c']
    assert any('\":workspace_roots\"={\".\"=\"read\"}' in item for item in readonly_configs)
    query = tmp_path / 'query'
    query.mkdir()
    schema = query / 'schema.json'
    schema.write_text('{"type":"object"}')
    structured = asyncio.run(runner.run('prompt', cwd=query, log_path=log, timeout_seconds=5,
                                         scope=AgentScope('.', read_only=True, output_schema=schema)))
    assert structured.ok
    schema.unlink()
    schema.symlink_to(work / 'private-schema.json')
    with pytest.raises(AgentIsolationUnavailableError):
        asyncio.run(runner.run('prompt', cwd=query, log_path=log, timeout_seconds=5,
                               scope=AgentScope('.', read_only=True, output_schema=schema)))
    for bad_scope in (AgentScope('.', extra_writable=(str(layout.data_dir),)),
                      AgentScope('.', extra_env={'SECRET': 'synthetic'})):
        with pytest.raises(AgentIsolationUnavailableError):
            asyncio.run(runner.run('prompt', cwd=work, log_path=log, timeout_seconds=5, scope=bad_scope))
    binary.write_text('changed')
    assert not runner.available()


def test_skill_discovery_disables_exact_paths_without_following_links(tmp_path, monkeypatch):
    home = tmp_path / 'home'
    work = tmp_path / 'project' / 'category' / 'video'
    work.mkdir(parents=True)
    home.mkdir()
    monkeypatch.setenv('HOME', str(home))
    for root in (home / '.agents/skills', home / 'skills', work.parent / '.agents/skills'):
        manifest = root / 'sample' / 'SKILL.md'
        manifest.parent.mkdir(parents=True)
        manifest.write_text('synthetic')
    config = isolated._skills_config(work, home)
    for root in (home / '.agents/skills', home / 'skills', work.parent / '.agents/skills'):
        assert str(root / 'sample' / 'SKILL.md') in config
    assert 'skill-creator/SKILL.md' in config
    (home / 'skills' / 'link').symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(AgentIsolationUnavailableError):
        isolated._skills_config(work, home)


def test_factory_selects_each_verified_provider_independently(tmp_path, monkeypatch):
    from src.adapters.agent import factory
    from src.adapters.agent.infrastructure import isolated_claude

    layout = resolve_profile_layout(tmp_path / 'profile', 3)
    monkeypatch.setattr(factory, 'layout_for_settings', lambda _: layout)
    monkeypatch.setenv('HOME', str(tmp_path))
    monkeypatch.delenv('CLAUDE_CONFIG_DIR', raising=False)
    monkeypatch.setattr('src.adapters.agent.infrastructure.binaries.find_binary', lambda name, configured='': '/test/claude')
    captured = {}
    class FakeClaude:
        def __init__(self, **kwargs):
            captured.update(kwargs)
        def available(self):
            return True
    monkeypatch.setattr(isolated_claude, 'ClaudeFileRunner', FakeClaude)
    monkeypatch.setattr(isolated.IsolatedCodexRunner, 'available', lambda self: False)
    runner = factory.get_agent('claude')
    assert isinstance(runner, FakeClaude)
    assert captured == {'binary': Path('/test/claude'), 'config_dir': tmp_path / '.claude',
                        'expected_sha256': factory._CLAUDE_FILE_SHA256,
                        'socat_dir': tmp_path / '.local/lib/nexa-brief/tools/socat-20261105/usr/bin'}
    assert factory.agents_status() == [{'name': 'claude', 'available': True},
                                       {'name': 'codex', 'available': False}]
    monkeypatch.setattr(FakeClaude, 'available', lambda self: False)
    monkeypatch.setattr(isolated.IsolatedCodexRunner, 'available', lambda self: True)
    assert factory.agents_status() == [{'name': 'claude', 'available': False},
                                       {'name': 'codex', 'available': True}]


def test_claude_factory_rejects_relative_config(tmp_path, monkeypatch):
    from src.adapters.agent import factory
    monkeypatch.setattr('src.adapters.agent.infrastructure.binaries.find_binary', lambda name, configured='': '/test/claude')
    monkeypatch.setenv('CLAUDE_CONFIG_DIR', 'relative')
    with pytest.raises(AgentIsolationUnavailableError):
        factory._isolated_claude()
