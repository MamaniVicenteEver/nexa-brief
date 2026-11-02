from __future__ import annotations

import copy
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from src.adapters.data.publication_factory import build_publication_components, set_publication_components
from src.config.settings import settings
from src.core.image_posts.models import PostStatus
from src.core.image_posts.service import ImagePostError
from src.core.image_posts.trace import Trace, Events, current_trace, read, save, call_cost, PRICING
from src.core.image_posts.web_hilo import prepare_facts
from src.core.ports.image_post_resources import VerifiedImageMaterial
from src.presentation.api.routers import image_posts, publications

CASE = json.loads((Path(__file__).parents[2]/'fixtures/image_posts/hilo.json').read_text())


def test_trace_consolidates_calls_without_double_counting_and_keeps_actual_repairs(tmp_path):
    trace = Trace(tmp_path, {'post_id': 'img_test'})
    token = current_trace.set(trace)
    events = Events('copy')
    try:
        events.append({'draft': {'levels': {'alto': {'statement': 'Antes'}}}})
        events.append({'rejected_fields': {'levels.alto.statement': 'Motivo exacto'}, 'checker': 'code'})
        events.append({'repair': {'changes': [{'path': 'levels.alto.statement', 'value': 'Después'}]},
                       'rejected_fields': {'levels.alto.statement': 'Motivo exacto'}})
        events.append({'review': {'reason': 'Fidelidad comprobada', 'approved': True}})
    finally:
        current_trace.reset(token)
    call = {'call_id': 'first', 'used_at': '2026-11-01T10:00:00Z', 'step': 'copy_draft', 'role': 'image_copy',
            'provider': 'codex', 'model': 'gpt-6.1-terra', 'status': 'ok', 'input_tokens': 100,
            'cached_input_tokens': 20, 'output_tokens': 30, 'total_tokens': 130}
    trace.calls.append(call)
    save(tmp_path/'usage.json', [call])
    save(tmp_path/'model-calls/test/usage.json', [call])
    result = trace.consolidate('completed')
    assert result['totals']['calls'] == 1
    assert result['totals']['corrections'] == 1
    assert result['totals']['tokens']['total_tokens'] == 130
    assert result['totals']['cost']['usd'] == 0
    assert result['totals']['cost']['label'] == 'incluido en la suscripción'
    correction = result['corrections']['events'][1]['applied_changes'][0]
    assert correction == {'path': 'levels.alto.statement', 'before': 'Antes', 'after': 'Después', 'reason': 'Motivo exacto'}
    assert result['events'][0]['draft']['levels']['alto']['statement'] == 'Antes'
    again = Trace(tmp_path).consolidate('ready_for_review')
    assert again['totals']['calls'] == 1 and again['totals']['corrections'] == 1


def test_configured_prices_use_cache_and_schedule_and_leave_unknown_cost_explicit():
    config = read(PRICING)
    call = {'provider': 'deepseek', 'model': 'deepseek-v4-flash', 'used_at': '2026-11-02T01:00:00Z',
            'input_tokens': 1_000_000, 'cached_input_tokens': 100_000, 'output_tokens': 100_000}
    peak = call_cost(call, config)
    assert peak['usd'] == pytest.approx(.3906)
    assert call_cost({**call, 'used_at': '2026-11-01T01:00:00Z'}, config)['usd'] == pytest.approx(.1953)
    assert call_cost({**call, 'model': 'unknown'}, config)['usd'] is None
    assert call_cost({**call, 'input_tokens': None}, config)['usd'] is None


def test_web_selection_preserves_evidence_and_rejects_unrelated_single_facts():
    rows = [(f'claim_{i}', f'Hecho {i}', 'https://example.org/main' if i < 3 else 'https://example.org/support', 'Fuente', 'Sí') for i in range(1, 5)]
    facts = prepare_facts(rows)
    assert [f.role for f in facts] == ['portada', 'desarrollo_1', 'desarrollo_2', 'resolucion_1']
    assert [f.text for f in facts] == [r[1] for r in rows]
    with pytest.raises(ValueError, match='misma fuente'):
        prepare_facts([(a,b,f'https://example.org/{i}',d,e) for i,(a,b,c,d,e) in enumerate(rows)])


@pytest.mark.asyncio
@pytest.mark.parametrize('level', ['basico', 'medio', 'alto', 'negro'])
async def test_web_hilo_reaches_real_pipeline_and_archives_selection_without_models(tmp_path, monkeypatch, level):
    from src.core.image_posts import web_hilo
    from src.core.image_posts.strategies import amarillista_hilo as hilo
    from src.core.image_posts.strategies.amarillista_copy import model_json
    async def forbidden(*args, **kwargs): raise AssertionError('No modelos reales')
    monkeypatch.setattr('src.adapters.models.hub.text_json_with_usage', forbidden)
    seen = []
    async def write(facts, ctx, **kwargs):
        seen.append((ctx.level, kwargs['levels']))
        raw = {'levels': {level: copy.deepcopy(CASE['copy']['levels']['negro'])}}
        kwargs['audit_out'].append({'attempt': 1, 'draft': raw})
        kwargs['audit_out'].append({'accepted': True, 'draft': raw})
        return raw
    async def photos(*args, **kwargs): return {}
    monkeypatch.setattr(hilo, 'write', write)
    monkeypatch.setattr('src.core.image_posts.amarillista_media.find_relevant_images', photos)
    service = build_publication_components(data_dir=tmp_path).service
    material = VerifiedImageMaterial('v', 'node_tech', 'revision', CASE['PLAN.md'],
        {'schema_version': 2, 'titles': {'facebook': {'title': 'Pantallas'}}, 'description': {'question': '¿Qué opinas?'}, 'sources': CASE['post.json']['sources']}, 'Pantallas', 'Pantallas')
    monkeypatch.setattr(service.material_source, 'load_verified_material', lambda *_: material)
    plan, record = await service.create_plan({'category_id': 'node_tech', 'source_video_id': 'v', 'style_id': 'node_tech_rough', 'level': level})
    assert seen == [(level, [level])]
    assert record.editorial.level == level and record.editorial.narrative == 'hilo'
    assert record.editorial.strategy_id == 'amarillista'
    assert len(plan.slides) == 5
    trace = service.get_trace(record)
    assert trace['identity']['level'] == level and trace['identity']['slides'] == 5
    assert trace['identity']['primary_source'] == CASE['post.json']['sources'][0]
    assert trace['totals']['writer_rounds'] == 1


@pytest.mark.asyncio
async def test_failure_is_archived_with_post_and_trace_and_does_not_repeat_on_retry(tmp_path):
    calls = []
    async def builder(**kwargs):
        calls.append(kwargs)
        events = Events('copy')
        events.append({'rejected_fields': {'levels.alto.statement': 'Hecho no respaldado'}, 'checker': 'model'})
        raise ValueError('Fallo exacto de redacción')
    service = build_publication_components(data_dir=tmp_path, plan_builder=builder).service
    request = {'category_id': 'node_tech', 'source_video_id': 'v', 'style_id': 'node_tech_rough'}
    with pytest.raises(ImagePostError): await service.create_plan(request, 'unique-key')
    summaries = service.list({'category_id': 'node_tech'}).items
    assert len(summaries) == 1
    record = service.get(summaries[0]['publication_id'])
    assert record.status == PostStatus.FAILED
    trace = service.get_trace(record)
    assert trace['status'] == 'failed' and 'redacción' in trace['error']
    assert trace['corrections']['events'][0]['checker'] == 'model'
    assert trace['corrections']['events'][0]['rejected_fields']['levels.alto.statement'] == 'Hecho no respaldado'
    with pytest.raises(ImagePostError): await service.create_plan(request, 'unique-key')
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_render_failure_keeps_qc_reason_and_existing_trace(tmp_path):
    from test_plan_render import make_plan
    from src.core.image_posts.trace import emit
    async def renderer(*_):
        emit('render_qc', label='Render rechazado', status='failed', qc={'overflow': True}, slide_id='slide_01')
        raise ValueError('Desborde en slide_01')
    service = build_publication_components(data_dir=tmp_path, plan_builder=lambda **_: make_plan(), renderer=renderer).service
    plan, record = await service.create_plan({'category_id': 'node_tech', 'source_video_id': 'v',
        'template_id': 'daily_fact', 'style_id': 'node_tech_rough'})
    before = service.get_trace(record)
    with pytest.raises(ValueError, match='Desborde'): await service.render_plan(plan.plan_id)
    trace = service.get_trace(record)
    assert trace['started_at'] == before['started_at']
    assert trace['status'] == 'failed' and trace['error'] == 'Desborde en slide_01'
    assert service.get(record.publication_id).status == PostStatus.FAILED
    assert trace['render_qc']['attempts'][0]['qc'] == {'overflow': True}
    assert current_trace.get() is None


@pytest.mark.asyncio
async def test_invalid_deepseek_json_preserves_billed_usage():
    from types import SimpleNamespace
    from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
    from src.config.exceptions import AIValidationError
    async def create(**_):
        return SimpleNamespace(model='deepseek-flash', usage=SimpleNamespace(prompt_tokens=50, completion_tokens=12, total_tokens=62),
            choices=[SimpleNamespace(message=SimpleNamespace(content='JSON inválido'))])
    adapter = DeepSeekAdapter.__new__(DeepSeekAdapter)
    adapter._client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    adapter._model, adapter._max_retries = 'deepseek-flash', 1
    with pytest.raises(AIValidationError) as captured: await adapter.complete_json_with_usage('JSON', '{}', structured=True)
    assert captured.value.usage['total_tokens'] == 62


@pytest.mark.asyncio
async def test_measured_composition_repair_updates_fallback_diagram_and_preserves_plan_id(tmp_path, monkeypatch):
    from dataclasses import asdict
    from src.core.image_posts import web_hilo
    from src.core.image_posts.strategies import amarillista_hilo as hilo
    from src.core.image_posts.strategies.base import Fact, StrategyContext
    from src.core.image_posts.render_post import read_input
    from src.core.image_posts.plan import build_image_plan
    from src.adapters.data.local_image_post_resources import LocalImagePostResources
    entrada = tmp_path/'input'
    entrada.mkdir()
    save(entrada/'post.json', CASE['post.json'])
    (entrada/'PLAN.md').write_text(CASE['PLAN.md'])
    facts = read_input(entrada)[1]
    ctx = StrategyContext('node_tech', 'Pantallas', 'Pantallas', '@nodetech_es', 'NodeTech', level='alto')
    raw = {'levels': {'alto': copy.deepcopy(CASE['copy']['levels']['negro'])}}
    copies = hilo.copies_from_draft(raw, facts, ctx)
    style = LocalImagePostResources().get_style('node_tech')
    plan = build_image_plan(category_id='node_tech', source_video_id='v', source_revision='r', template_id='five_slides',
        style=style, slides=hilo.build(facts, ctx, copies, {}), seed=0)
    trace = Trace(tmp_path/'post')
    save(trace.folder/'input.json', {'facts': [vars(f) for f in facts], 'context': asdict(ctx), 'story': {}})
    save(trace.folder/'audit.json', {'draft': raw, 'approved': True})
    short = raw['levels']['alto']['items']['claim_2']['text'].split('. ')[0] + '.'
    path = 'levels.alto.items.claim_2.text'
    seen = []
    async def model(role, *args, **kwargs):
        seen.append(role)
        if role == 'copy_repair': return {'changes': [{'path': path, 'value': short}]}
        displayed = json.loads(args[1])['displayed_fields']
        return {'approved': True, 'reason': 'Conserva la evidencia', 'reviewed_fields': list(displayed), 'rejected_fields': []}
    monkeypatch.setattr(web_hilo, 'model_json', model)
    error = ValueError('Desborde medido')
    error.qc = {'overflow': True, 'shortening': {'max_chars': len(short)}}
    error.slide_id = plan.slides[1].slide_id
    token = current_trace.set(trace)
    try: repaired = await web_hilo.repair_composition(plan, error)
    finally: current_trace.reset(token)
    assert seen == ['copy_repair', 'fact_check']
    assert repaired.plan_id == plan.plan_id
    assert short in json.dumps(repaired.slides[1].to_dict(), ensure_ascii=False)
    result = trace.consolidate('ready_for_review')
    assert result['totals']['repairs'] == 1 and result['totals']['corrections'] == 1


def test_authorized_details_expose_trace_and_preserve_acl(tmp_path, monkeypatch):
    from test_plan_render import make_plan
    monkeypatch.setattr(settings, 'app_env', 'test')
    monkeypatch.setattr(settings, 'nexa_internal_token', '')
    monkeypatch.setattr(settings, 'data_dir', tmp_path)
    components = build_publication_components(data_dir=tmp_path, plan_builder=lambda **_: make_plan())
    set_publication_components(components)
    app = FastAPI()
    app.include_router(image_posts.router, prefix='/api/v1')
    app.include_router(publications.router, prefix='/api/v1')
    try:
        with TestClient(app, headers={'X-Nexa-Session-User': 'admin@test.example', 'X-Nexa-Session-Role': 'admin'}) as client:
            response = client.post('/api/v1/image-posts/plans', json={'category_id': 'node_tech', 'source_video_id': 'v',
                'template_id': 'daily_fact', 'style_id': 'node_tech_rough'}, headers={'Idempotency-Key': '00000000-0000-4000-8000-000000000111'})
            assert response.status_code == 201
            post = response.json()['post']
            for url in [f"/api/v1/image-posts/{post['post_id']}", f"/api/v1/publications/{post['publication_id']}"]:
                detail = client.get(url)
                assert detail.status_code == 200 and detail.json()['trace']['identity']['post_id'] == post['post_id']
            denied = TestClient(app).get(f"/api/v1/publications/{post['publication_id']}")
            assert denied.status_code in {401, 403}
    finally:
        set_publication_components(None)
