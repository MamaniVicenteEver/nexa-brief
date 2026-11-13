import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.core.promos import agents, evidence, pipeline, research
from src.adapters.agent import factory
from src.core.explainer import agent_context


def session(content):
    return {'provider':'claude', 'revision':1, 'prompt_ref':{'version':'v1'}, 'messages':[{'role':'user','content':content}]}


@pytest.mark.asyncio
async def test_simple_topic_uses_model_plan_and_fetches_only_evidence(tmp_path, monkeypatch):
    messages = session('Quiero una promo sobre corales')
    seen = {}
    async def run(runner, prompt, **kwargs):
        seen.update(kwargs)
        assert 'Quiero una promo sobre corales' in prompt
        return SimpleNamespace(ok=True, last_message='```json\n{"topic":"arrecifes de coral", "source_urls":["https://noaa.gov/a"]}\n```')
    monkeypatch.setattr(agents, 'measured_run', run)
    monkeypatch.setattr(factory, 'get_agent', lambda provider: object())
    monkeypatch.setattr(agent_context, 'ensure_private_workspace', lambda path: None)
    discovery = AsyncMock(return_value=[{'url':'https://smithsonian.org/a'}])
    fetch = AsyncMock(return_value=[{'url':'https://noaa.gov/a','text':'evidencia'}, {'url':'https://smithsonian.org/a','text':'evidencia'}])
    monkeypatch.setattr(research, 'gather', discovery)
    monkeypatch.setattr(evidence, 'gather_evidence', fetch)
    progress = AsyncMock()
    docs = await pipeline.source_context(messages, tmp_path, progress)
    assert len(docs) == 2
    assert discovery.await_args.args[0] == 'arrecifes de coral'
    assert fetch.await_args.args[0] == ['https://noaa.gov/a', 'https://smithsonian.org/a']
    assert seen['stage'] == 'research-plan' and seen['scope'].read_only
    assert seen['scope'].model == agents.PROVIDERS['claude'][0]
    plans = list((tmp_path/'work/research-plan/1').glob('attempt-*/plan.json'))
    assert len(plans) == 1
    assert json.loads(plans[0].read_text())['topic'] == 'arrecifes de coral'


@pytest.mark.asyncio
async def test_user_urls_skip_model_plan(tmp_path, monkeypatch):
    plan = AsyncMock(side_effect=AssertionError('No debe llamar al modelo'))
    fetch = AsyncMock(return_value=[{'url':'https://noaa.gov/a','text':'evidencia'}, {'url':'https://smithsonian.org/a','text':'evidencia'}])
    monkeypatch.setattr(pipeline, 'discovery_plan', plan)
    monkeypatch.setattr(evidence, 'gather_evidence', fetch)
    await pipeline.source_context(session('Ver https://noaa.gov/a y https://smithsonian.org/a'), tmp_path, AsyncMock())
    plan.assert_not_awaited()
    assert fetch.await_args.args[0] == ['https://noaa.gov/a', 'https://smithsonian.org/a']


@pytest.mark.asyncio
async def test_invalid_plan_is_rejected_before_search(tmp_path, monkeypatch):
    async def run(*args, **kwargs):
        return SimpleNamespace(ok=True, last_message='{"topic":"corales","source_urls":[],"extra":"dato inventado"}')
    monkeypatch.setattr(agents, 'measured_run', run)
    monkeypatch.setattr(factory, 'get_agent', lambda provider: object())
    monkeypatch.setattr(agent_context, 'ensure_private_workspace', lambda path: None)
    with pytest.raises(Exception):
        await pipeline.discovery_plan(session('corales'), tmp_path, AsyncMock())
    assert not (tmp_path/'work/research-plan/1/plan.json').exists()
