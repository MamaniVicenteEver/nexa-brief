"""Pruebas sin red: puerto real del hub, runner simulado y respaldo directo."""
import copy
import json
from types import SimpleNamespace

import pytest

from src.adapters.models import hub
from src.core.ports.agent_port import AgentRunResult
from src.core.image_posts.strategies.amarillista import CONFIG
from src.core.image_posts.strategies.amarillista_copy import model_json


SCHEMA = {'type':'object','properties':{'approved':{'type':'boolean'}},
          'required':['approved'],'additionalProperties':False}


class Runner:
    def __init__(self, responses, available=True):
        self.responses = list(responses)
        self.calls = []
        self.is_available = available

    def available(self):
        return self.is_available

    async def run(self, prompt, **options):
        self.calls.append((prompt, options))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def reply(value, **kwargs):
    return AgentRunResult(exit_code=kwargs.pop('exit_code', 0), last_message=value,
        duration_seconds=.1, model='gpt-6.1-terra',
        usage={'input_tokens':100,'cached_input_tokens':50,'output_tokens':10}, **kwargs)


@pytest.fixture
def route(tmp_path, monkeypatch):
    token = hub.call_log_dir.set(tmp_path/'calls')
    fallback_calls = []
    async def complete(system, prompt, **kwargs):
        fallback_calls.append((system,prompt,kwargs))
        return {'approved':True}, {'provider':'deepseek','model':'deepseek-test',
            'input_tokens':30,'output_tokens':5,'total_tokens':35}
    adapter = SimpleNamespace(complete_json_with_usage=complete, _max_retries=9)
    def get_text(provider):
        assert provider == 'deepseek', 'Ningún proveedor alternativo permitido'
        return adapter
    def forbidden(*args, **kwargs):
        raise AssertionError('Gemini no se llama en amarillista')
    monkeypatch.setattr('src.adapters.ai.factory.get_analysis_ai', forbidden)
    monkeypatch.setattr('src.adapters.ai.factory.get_copy_ai', forbidden)
    monkeypatch.setattr('src.adapters.ai.factory.get_codegen_ai', forbidden)
    monkeypatch.setattr('src.adapters.ai.factory.get_text_ai', get_text)
    yield fallback_calls, adapter
    hub.call_log_dir.reset(token)


async def test_codex_uses_role_scope_schema_and_real_usage(route, monkeypatch):
    runner = Runner([reply('{"approved":true}')])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    usage = []
    value, summary = await hub.text_json_with_usage('image_fact_check','JSON','Contexto',schema=SCHEMA,usage_out=usage)
    assert value == {'approved':True} and not route[0]
    scope = runner.calls[0][1]['scope']
    assert scope.model == 'gpt-6.1-terra' and scope.reasoning_effort == 'high' and scope.read_only
    assert json.loads(scope.output_schema.read_text()) == SCHEMA
    assert usage[0]['total_tokens'] == 110 and usage[0]['cached_input_tokens'] == 50
    assert summary['provider'] == 'codex' and not summary['fallback']


@pytest.mark.parametrize('failure,why', [
    (reply('',exit_code=1),'agent_exit_1'),
    (reply('',timed_out=True),'agent_timeout'),
    (OSError('sin acceso'),'OSError'),
])
async def test_codex_operational_failure_falls_back_once(route, monkeypatch, failure, why):
    runner = Runner([failure])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    usage = []
    _, summary = await hub.text_json_with_usage('image_fact_check','JSON','Contexto',schema=SCHEMA,usage_out=usage)
    assert len(runner.calls) == 1 and len(route[0]) == 1
    assert summary['provider'] == 'deepseek' and summary['fallback_reason'] == why
    assert [u['status'] for u in usage] == ['failed','ok']
    assert route[1]._max_retries == 1 and route[0][0][2]['structured']


async def test_unavailable_does_not_launch_cli(route, monkeypatch):
    runner = Runner([],available=False)
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    _, usage = await hub.text_json_with_usage('image_fact_check','JSON','Contexto',schema=SCHEMA)
    assert not runner.calls and usage['fallback_reason'] == 'agent_unavailable'
    assert usage['attempts'][0]['input_tokens'] is None


@pytest.mark.parametrize('invalid', ['no json', '[]', '{"approved":"true"}', '{}'])
async def test_invalid_json_retries_once_then_fallback(route, monkeypatch, invalid):
    runner = Runner([reply(invalid),reply(invalid)])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    usage = []
    _, summary = await hub.text_json_with_usage('image_fact_check','JSON','Contexto',schema=SCHEMA,usage_out=usage)
    assert len(runner.calls) == 2 and len(route[0]) == 1
    assert 'intento anterior' in runner.calls[1][0]
    assert 'error concreto:' in runner.calls[1][0] and 'invalid_json:' in runner.calls[1][0]
    assert summary['fallback_reason'].startswith('invalid_json:')
    assert len(usage) == 3 and sum(u['total_tokens'] for u in usage) == 255


async def test_valid_retry_keeps_codex_and_rejection_does_not_fallback(route, monkeypatch):
    runner = Runner([reply('no json'),reply('{"approved":false}')])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    result, usage = await hub.text_json_with_usage('image_fact_check','JSON','Contexto',schema=SCHEMA)
    assert result['approved'] is False and usage['provider'] == 'codex'
    assert len(runner.calls) == 2 and not route[0]


async def test_both_providers_fail_with_archived_attempts(route, monkeypatch, tmp_path):
    runner = Runner([reply('',exit_code=1)])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    async def broken(*args,**kwargs):
        raise RuntimeError('servicio no disponible')
    route[1].complete_json_with_usage = broken
    usage = []
    with pytest.raises(RuntimeError,match='agotó proveedores'):
        await hub.text_json_with_usage('image_fact_check','JSON','Contexto',schema=SCHEMA,usage_out=usage)
    assert len(usage) == 2 and all(u['status']=='failed' for u in usage)
    assert json.loads(next((tmp_path/'calls').glob('*/usage.json')).read_text()) == usage


async def test_all_image_jobs_use_separate_codex_roles_without_gemini(route, monkeypatch):
    runner = Runner([
        reply(json.dumps({'changes':[]})),
        reply(json.dumps({'approved':False,'reason':'Exageración médica',
                          'rejected_fields':[{'path':'reflections.negro','reason':'Inventa daño irreversible'}],'reviewed_fields':['reflections.negro']})),
        reply(json.dumps({'decisions':[{'id':'wikimedia:x','yes':False,'reason':'Foto irrelevante','rank':1}]})),
    ])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    usage = []
    await model_json('copy_repair','JSON','{}',usage_out=usage)
    review = await model_json('fact_check','JSON','{}',usage_out=usage)
    photos = await model_json('media_judge','JSON','{}',usage_out=usage)
    assert review['rejected_fields'] == {'reflections.negro':'Inventa daño irreversible'}
    assert photos['decisions'][0]['yes'] is False
    assert [u['role'] for u in usage] == ['image_copy','image_fact_check','image_photo_judge']
    assert all(u['provider']=='codex' for u in usage) and not route[0]


async def test_editorial_repair_and_photo_rejection_through_hub(route, monkeypatch):
    from src.core.image_posts.strategies.base import Fact, StrategyContext
    from src.core.image_posts.strategies.amarillista import STRATEGY
    from src.core.image_posts.strategies.amarillista_copy import write
    from src.core.image_posts.amarillista_media import judge_candidates
    monkeypatch.delenv('NEXA_IMAGE_COPY_MODEL',raising=False)
    facts = [Fact('claim_1','En 2024, 30,5 % de adultos de EE. UU. declararon menos de 7 horas de sueño.','https://example.org/sueno','CDC','portada'),
        Fact('claim_2','En 2024, 30,5 % de adultos de EE. UU. declararon menos de 7 horas de sueño.','https://example.org/sueno','CDC','prueba'),
        Fact('claim_3','Sin embargo, son horas declaradas, no un diagnóstico.','https://example.org/sueno','CDC','giro'),
        Fact('claim_4','Dormir poco puede dificultar la atención y hacer más lentas las reacciones.','https://example.org/efectos','NIH','reflexion')]
    ctx = StrategyContext('node_tech','','','@nodetech_es','NodeTech')
    payload = {'topic':'Sueño', 'titles':{'basico':'Casi un tercio duerme poco','medio':'¿Cuánto estás durmiendo?','alto':'El sueño se queda corto','negro':'Dormir poco sigue COBRANDO tiempo'},
        'qualifier':'Adultos de EE. UU., 2024; encuesta NHIS',
        'questions':{'basico':'¿Cuántas horas sueles dormir?','medio':'¿Cómo cuidas tus horarios?','alto':'¿Qué ayuda a tu descanso?','negro':'¿Qué sacrificas por dormir menos?'},
        'reflections':{'basico':'Dormir poco puede dificultar la atención.',
            'medio':'¿Cómo podría afectar tu atención dormir poco?',
            'alto':'Vale pensar cómo dormir poco puede afectar la atención.',
            'negro':'Tu atención puede pagar el costo de dormir poco.'},
        'items':[{'claim_id':f.claim_id,'body':'Adultos de EE. UU.; menos de 7 horas declaradas, 2024.' if f.role=='prueba' else f.text,'image_query':'tired adult resting'} for f in facts]}
    original = copy.deepcopy(payload)
    payload['reflections']['negro']='Tus neuronas quedarán destruidas para siempre.'
    runner = Runner([reply(json.dumps(payload)),
        reply(json.dumps({'changes':[{'path':'reflections.negro','value':original['reflections']['negro']}]})),
        reply(json.dumps({'approved':True,'reason':'Fiel','rejected_fields':[],'reviewed_fields':[]})),
        reply(json.dumps({'decisions':[{'id':'wikimedia:x','yes':False,'reason':'Hotel sin relación','rank':1}]}))])
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name:runner)
    usage, events = [], []
    copies, _, _ = await write(STRATEGY,facts,ctx,usage_out=usage,audit_out=events)
    assert copies['claim_4'].body == original['reflections']['negro']
    assert copies['claim_1'].headlines == original['titles']
    item = SimpleNamespace(provider='wikimedia',provider_id='x',title='Hotel',description='A hotel',width=1200,height=900)
    assert not await judge_candidates(facts[0],ctx,[item],'portada',usage_out=usage)
    assert len(runner.calls) == 4 and not route[0]
    assert all('codex' in copy.source for copy in copies.values())
    assert any(e.get('accepted') for e in events)


def test_image_roles_are_opt_in_and_video_roles_preserved():
    for role in ('image_copy','image_fact_check','image_photo_judge'):
        spec = hub.roles_config()['roles'][role]
        assert spec['provider']=='codex' and spec['reasoning_effort']=='high'
        assert spec['fallback']['provider']=='deepseek'
    for role in ('copy_draft','fact_check','text_draft','dialogue_draft'):
        assert not hub.roles_config()['roles'][role].get('structured_agent')
    assert CONFIG['redactor']['roles_hub']['copy_draft']=='image_copy'
    assert CONFIG['redactor']['roles_hub']['media_judge']=='image_photo_judge'

