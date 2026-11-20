"""Contratos de uso de agente sin llamadas de inferencia."""
import json
from types import SimpleNamespace
import pytest
from src.core.nodemotion.promo import agents
from src.core.nodemotion.promo.copy_ai import PromoCopyAI


def session(provider='codex', template='promo-kinetic'):
    return {'provider': provider, 'revision': 3, 'template_id': template,
            'prompt_ref': {'version': 'v1'}, 'messages': []}


@pytest.mark.asyncio
async def test_codex_scope_avoids_unsupported_json_schema(tmp_path):
    class Runner:
        async def run(self, prompt, **kwargs):
            assert kwargs['scope'].output_schema is None
            return SimpleNamespace(last_message='{}')
    await agents.run(lambda _: Runner(), session(), tmp_path, tmp_path/'run.log', 10)
    assert not (tmp_path/'schema.json').exists()
    with pytest.raises(ValueError):
        agents.decode('{}')


@pytest.mark.parametrize('template,key', [('promo-kinetic','brand.tag'), ('promo-editorial','brand.name'), ('promo-urban','brand.year')])
def test_prompt_contains_template_specific_build_schema(template, key):
    text = agents.prompt_for(session(template=template))
    schemas = json.loads(text.split('\nESQUEMAS:\n')[1].split('\nEJEMPLO PARCIAL:\n')[0])
    assert key in schemas['build']['properties']['texts']['required']
    example = json.loads(text.split('\nEJEMPLO PARCIAL:\n')[1].split('\nDOCUMENTOS PÚBLICOS')[0])
    assert key in example['brief']['texts']


@pytest.mark.asyncio
async def test_measured_run_records_failed_exception_without_message(tmp_path):
    class Failure(Exception):
        usage = {'input_tokens': 23, 'output_tokens': 5, 'cost_basis': 'private value'}
        duration_seconds = 2.5
    class Runner:
        async def run(self, *args, **kwargs):
            raise Failure('SECRET SHOULD NOT APPEAR')
    events = []
    async def progress(stage, data): events.append((stage, data))
    with pytest.raises(Failure):
        await agents.measured_run(Runner(), 'x', session=session(), stage='research-script', attempt=2,
            progress=progress, cwd=tmp_path, log_path=tmp_path/'run.log', timeout_seconds=2, scope=None)
    row = events[0][1]['usage']
    assert row['ok'] is False and row['input_tokens'] == 23 and row['seconds'] == 2.5
    assert row['stage'] == 'research-script' and row['attempt'] == 2
    assert 'SECRET' not in json.dumps(events) and row['cost_basis'] is None


@pytest.mark.asyncio
async def test_copy_ai_records_failed_runner_attempt(tmp_path, monkeypatch):
    from src.core.nodemotion.promo import copy_ai
    monkeypatch.setattr(copy_ai, 'ensure_private_workspace', lambda _: None)
    class Runner:
        async def run(self, *args, **kwargs): raise RuntimeError('secret')
    events = []
    async def progress(stage, data=None): events.append((stage, data))
    ai = PromoCopyAI(session('claude'), tmp_path, progress, Runner())
    with pytest.raises(RuntimeError): await ai.complete_json('system', 'user')
    measured = [data['usage'] for _, data in events if data and 'usage' in data]
    assert len(measured) == 1 and measured[0]['ok'] is False and measured[0]['input_tokens'] is None
    assert measured[0]['seconds'] >= 0 and 'secret' not in json.dumps(events)
