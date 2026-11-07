from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.config.settings import settings
from src.core.ports.agent_port import AgentRunResult
from src.core.prototypes import ideas, runs
from src.core.prototypes.smoke import validate_smoke

TEMPLATES = Path(__file__).resolve().parents[2] / 'src/templates'


def info(idea_id='reference'):
    return {'version': 1, 'title': 'Synthetic', 'summary': 'Synthetic example', 'engine': 'nodehistory/_proto',
            'based_on': None, 'is_new_design': False, 'status': 'en progreso', 'created_at': '2026-01-01',
            'libraries': [], 'inputs': [], 'notes': [], 'reference': 'referencias/nodehistory/' + idea_id}


@pytest.fixture
def v3(tmp_path, monkeypatch):
    root = tmp_path / 'profile'
    root.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', root / 'data')
    monkeypatch.setattr(settings, 'templates_dir', TEMPLATES)
    return root


@pytest.mark.asyncio
async def test_smoke_host_validates_one_artifact_without_executing_it(v3):
    sandbox = v3 / 'sandbox'
    target = sandbox / 'nodehistory/zz-smoke-reference'
    target.mkdir(parents=True)
    (target / 'info.json').write_text(json.dumps(info()))
    # This content is parsed as markup only; it must never run.
    (target / 'index.html').write_text('<html><body><script>throw Error("not executed")</script></body></html>')
    other = sandbox / 'nodehistory/other'
    other.mkdir()
    (other / 'info.json').write_text('{broken')
    result = await validate_smoke(sandbox, 'nodehistory', 'zz-smoke-reference', 'reference', TEMPLATES)
    assert result is None
    report = (target / 'work/results/smoke.md').read_text()
    assert 'Sin ejecución JavaScript' in report and 'render' in report
    assert (other / 'info.json').read_text() == '{broken'
    malformed = info()
    malformed['is_new_design'] = 'yes'
    (target / 'info.json').write_text(json.dumps(malformed))
    assert 'ficha info.json inválida' in await validate_smoke(sandbox, 'nodehistory', 'zz-smoke-reference', 'reference', TEMPLATES)
    (target / 'info.json').unlink()
    (target / 'info.json').symlink_to(other / 'info.json')
    assert 'no seguros' in await validate_smoke(sandbox, 'nodehistory', 'zz-smoke-reference', 'reference', TEMPLATES)
    service = runs.PrototypeRunService(agent_getter=lambda _: None)
    service._cleanup_smoke({'category': 'nodehistory', 'idea_id': 'reference'}, target)
    assert target.is_dir() and (other / 'info.json').read_text() == '{broken'


@pytest.mark.asyncio
async def test_smoke_validator_timeout_is_explicit_and_stops_worker(v3, monkeypatch):
    from src.core.prototypes import smoke

    target = v3 / 'sandbox/nodehistory/zz-smoke-reference'
    target.mkdir(parents=True)
    (target / 'info.json').write_text(json.dumps(info()))
    (target / 'index.html').write_text('<html></html>')

    class Worker:
        returncode = None
        killed = False

        async def communicate(self, data):
            await asyncio.sleep(60)

        def kill(self):
            self.killed = True
            self.returncode = -9

        async def wait(self):
            return self.returncode

    worker = Worker()

    async def spawn(*args, **kwargs):
        return worker

    monkeypatch.setattr(smoke.asyncio, 'create_subprocess_exec', spawn)
    error = await validate_smoke(v3 / 'sandbox', 'nodehistory', 'zz-smoke-reference', 'reference', TEMPLATES, timeout=.01)
    assert 'tiempo' in error and worker.killed


@pytest.mark.asyncio
async def test_smoke_run_uses_file_only_agent_and_host_validation_then_cleans_only_smoke(v3, monkeypatch):
    idea = ideas.create_idea('nodehistory', 'Referencia', 'Notas sintéticas', [])
    other = ideas.create_idea('nodehistory', 'Otra', 'Conservar', [])
    calls = []

    class Agent:
        def available(self):
            return True

        async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope):
            calls.append((cwd, scope, prompt))
            assert cwd == v3 / 'sandbox/nodehistory' / ('zz-smoke-' + idea.slug)
            assert scope.commands == scope.extra_writable == () and scope.extra_env == {}
            (cwd / 'info.json').write_text(json.dumps(info(idea.slug)))
            (cwd / 'index.html').write_text('<html><body>synthetic</body></html>')
            log_path.write_text('fake agent\n')
            return AgentRunResult(exit_code=0, last_message='synthetic', duration_seconds=0)

    async def register(relative, **kwargs):
        path = v3 / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        return SimpleNamespace(path=path, log_id='synthetic-log')

    monkeypatch.setattr(runs, 'register_execution_log', register)
    monkeypatch.setattr(runs, '_leader_model', lambda _: ('fake', 'high'))
    service = runs.PrototypeRunService(agent_getter=lambda _: Agent())

    async def record_usage(*args):
        return True

    monkeypatch.setattr(service, '_record_template_usage', record_usage)
    record = await service.submit(category='nodehistory', slug=idea.slug, agent='claude', template_id='test', mode='smoke')
    for _ in range(500):
        result = service.get(record['run_id'])
        if result['state'] in {'done', 'failed'}:
            break
        await asyncio.sleep(.01)
    assert result['state'] == 'done', result.get('error')
    assert len(calls) == 1
    assert not calls[0][0].exists()
    assert ideas.get_idea('nodehistory', other.slug).notes.strip() == 'Conservar'
    log = Path(record['log_path']).read_text()
    assert 'host smoke estático' in log and 'sin navegador, render ni ejecución' in log
