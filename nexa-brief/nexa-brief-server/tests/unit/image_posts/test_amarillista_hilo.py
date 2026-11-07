"""Regresiones del brief hilo; modelos y fuentes externas nunca se llaman aquí."""
import copy
import json
from dataclasses import replace
from pathlib import Path

import pytest

from src.core.image_posts import render_post as rp
from src.core.image_posts.strategies import amarillista_hilo as h
from src.core.image_posts.strategies.amarillista import STRATEGY
from src.core.image_posts.strategies.base import Fact, StrategyContext
from src.core.image_posts.plan import build_image_plan
from src.core.image_posts.validate import validate_plan
from src.adapters.data.local_image_post_resources import LocalImagePostResources
from src.core.ports.agent_port import AgentRunResult

CASE = json.loads((Path(__file__).parents[2] / 'fixtures/image_posts/hilo.json').read_text())


@pytest.fixture
def entrada(tmp_path):
    folder = tmp_path / 'entrada'
    folder.mkdir()
    for name in ('post.json', 'PLAN.md'):
        (folder / name).write_text(json.dumps(CASE[name], ensure_ascii=False) if name.endswith('json') else CASE[name])
    return folder


@pytest.fixture
def facts(entrada):
    return rp.read_input(entrada)[1]


@pytest.fixture
def ctx():
    return StrategyContext('node_tech', 'Pantallas', 'Pantallas', '@nodetech_es', 'NodeTech')


def review(raw, facts, levels=('negro',), **kw):
    return {'approved': True, 'reason': 'Fixture, no juicio editorial real', 'rejected_fields': [],
            'reviewed_fields': list(h.review_fields(raw, facts, levels)), **kw}


def test_preflight_offline_and_no_output(entrada, monkeypatch):
    def forbidden(*a, **k): raise AssertionError('Preflight no llama modelos, fotos ni render')
    monkeypatch.setattr(h, 'model_json', forbidden)
    monkeypatch.setattr(rp, 'find_relevant_images', forbidden)
    monkeypatch.setattr(rp, 'render_async', forbidden)
    before = sorted(str(p.relative_to(entrada)) for p in entrada.rglob('*'))
    result = rp.check_input(entrada)
    assert result['approved'] and result['model_calls'] == result['images_generated'] == 0
    rp.main([str(entrada), '--check-input'])
    assert sorted(str(p.relative_to(entrada)) for p in entrada.rglob('*')) == before


@pytest.mark.parametrize('field,value', [('historia', None), ('fotos_sugeridas', {}),
    ('sources', ['https://otro.example/estudio']), ('narrativa', 'vieja')])
def test_invalid_story_metadata_fails_locally(entrada, field, value):
    meta = copy.deepcopy(CASE['post.json'])
    meta[field] = value
    rp.save(entrada / 'post.json', meta)
    assert not rp.check_input(entrada)['approved']


def test_multiple_studies_and_mixed_old_roles_fail(facts):
    with pytest.raises(ValueError, match='misma fuente'):
        h.pick([facts[0], replace(facts[1], url='https://otro.example/estudio'), *facts[2:]])
    with pytest.raises(ValueError, match='rol inválido'):
        h.pick([*facts[:-1], replace(facts[-1], role='reflexion')])


@pytest.mark.parametrize('development,resolution', [(2, 1), (3, 1), (2, 2), (3, 2)])
def test_five_to_seven_slides_existing_layouts_and_single_source(facts, ctx, development, resolution):
    facts = list(facts)
    raw = copy.deepcopy(CASE['copy'])
    if development == 3:
        f = replace(facts[2], claim_id='claim_5', role='desarrollo_3')
        facts.append(f)
        raw['levels']['negro']['items'][f.claim_id] = {'text': 'La autora advierte que esa comparación puede alejar a los adolescentes de lo que disfrutan fuera de las pantallas.', 'stat': ''}
    if resolution == 2:
        f = replace(facts[3], claim_id='claim_6', role='resolucion_2')
        facts.append(f)
        raw['levels']['negro']['items'][f.claim_id] = {'text': 'Su propuesta también pide a los adultos abrir espacios de conversación y acompañar actividades reales.', 'stat': ''}
    facts = h.pick(facts)
    copies = h.copies_from_draft(raw, facts, ctx)
    slides = STRATEGY.build(facts, ctx, copies)
    style = LocalImagePostResources(skills_dir=rp.SERVER / 'src/skills').get_style(ctx.category_id)
    plan = build_image_plan(category_id=ctx.category_id, source_video_id='fixture', source_revision='test',
                            template_id='five_slides', slides=slides, style=style, seed=0)
    report = validate_plan(plan, style)
    assert report.passed, report.errors
    assert len(slides) == 2 + development + resolution
    assert all(sl['layout'] in ('amarillista:am_negro_visual', 'amarillista:am_negro_close') for sl in slides)
    assert slides[0]['texts'][2]['value'] == raw['levels']['negro']['hook_question']


@pytest.mark.parametrize('value,expected', [('25 y 2026', 2), ('25,5 % y 30 %', 2),
    ('veinticinco personas y treinta y dos días', 2), ('una hora, dos días y tres meses', 3),
    ('una vida y una pregunta', 0), ('la mitad y un tercio', 2)])
def test_number_budget_includes_words_and_occurrences(value, expected):
    assert len(h.number_literals(value)) == expected


def test_number_budget_even_if_repeated_and_in_questions(facts):
    raw = copy.deepcopy(CASE['copy'])
    raw['levels']['negro']['items']['claim_2']['text'] = 'En 2026 la autora presentó su libro. ¿Qué cambió en 2026 y qué aprendió en 2026?'
    raw['levels']['negro']['items']['claim_2']['text'] += ' Y en 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018 y 2017 también.'
    assert any('cifras en todo el post' in v for v in h.draft_errors(raw, facts, ['negro']).values())


def test_cover_question_and_first_knot_must_advance_instead_of_repeating(facts):
    raw = copy.deepcopy(CASE['copy'])
    raw['levels']['negro']['hook_question'] = '¿Qué los mantenía mirando sin disfrutar?'
    raw['levels']['negro']['items']['claim_2']['text'] = 'La autora observaba el problema. ¿Qué los mantenía mirando aunque dejaran de disfrutar?'
    assert any('repite la pregunta' in v for v in h.draft_errors(raw, facts, ['negro']).values())


def test_two_numbers_can_use_one_prominent_stat_without_repeating(facts, ctx):
    raw = copy.deepcopy(CASE['copy'])
    facts = list(facts)
    facts[2] = replace(facts[2], text=facts[2].text + ' En este caso se consultó a 25 personas.')
    raw['levels']['negro']['items']['claim_3']['stat'] = '25 personas'
    assert not h.draft_errors(raw, facts, ['negro'])
    from src.core.image_posts.copy import build_copy
    style = LocalImagePostResources(skills_dir=rp.SERVER / 'src/skills').get_style(ctx.category_id)
    slides = h.build(facts, ctx, h.copies_from_draft(raw, facts, ctx))
    plan = build_image_plan(category_id=ctx.category_id, source_video_id='fixture', source_revision='test',
                           template_id='five_slides', slides=slides, style=style, seed=0)
    assert validate_plan(plan, style).passed
    package = build_copy(plan, {'schema_version': 2, 'titles': {'facebook': {'title': 'Pantallas'}},
                               'description': {'question': '¿Qué piensas?'}, 'sources': [facts[0].url]})
    assert all(package.facebook.alt_texts)


@pytest.mark.parametrize('levels', [('negro', 'alto'), ('basico', 'medio', 'alto', 'negro')])
def test_multiple_requested_levels_keep_their_own_copy(facts, ctx, levels):
    raw = {'levels': {level: copy.deepcopy(CASE['copy']['levels']['negro']) for level in levels}}
    titles = {'negro': 'Las pantallas pueden quitarles vida real a los adolescentes',
              'alto': 'El exceso de pantallas preocupa a esta autora',
              'medio': 'Una autora cuestiona el lugar de las pantallas',
              'basico': 'Una entrevista explora el exceso de pantallas entre adolescentes'}
    for level in levels: raw['levels'][level]['statement'] = titles[level]
    assert not h.draft_errors(raw, facts, list(levels))
    for level in levels:
        copies = h.copies_from_draft(raw, facts, replace(ctx, level=level))
        assert copies[facts[0].claim_id].headline == titles[level]
        slides = h.build(facts, replace(ctx, level=level), copies)
        assert slides[0]['layout'].startswith('amarillista:am_' + level + '_')


@pytest.mark.parametrize('path,value,reason', [
    ('statement', '¿Las pantallas nos dominan?', 'afirmación'),
    ('hook_question', '¿Uso problemático', 'Segunda línea de portada'),
    ('items.claim_3.text', 'Una escala autodeclarada apoya la metarrevisión.', 'jerga'),
    ('items.claim_3.text', 'El 99 % de los adolescentes queda sin atención.', 'Cifra inventada'),
    ('items.claim_4.text', 'Palabra ' * 56, 'máximo 55 palabras'),
    ('items.claim_2.text', 'Pal ' * 61, 'palabras'),
    ('question', '¿De qué lado estás?', 'invitación')])
def test_copy_structure_and_fidelity_are_separate(facts, path, value, reason):
    raw = copy.deepcopy(CASE['copy'])
    node = raw['levels']['negro']
    parts = path.split('.')
    for key in parts[:-1]: node = node[key]
    node[parts[-1]] = value
    errors = h.draft_errors(raw, facts, ['negro'])
    assert any(reason in v for v in errors.values()), errors


def test_provocative_questions_framing_and_wording_cannot_veto(facts):
    raw = CASE['copy']
    displayed = h.review_fields(raw, facts, ['negro'])
    for kind in ('tone', 'framing', 'nuance'):
        result = review(raw, facts, approved=False, rejected_fields=[{'path': 'levels.negro.statement',
                      'kind': kind, 'reason': 'Demasiado fuerte para mi gusto'}])
        assert not h.review_errors(result, displayed)
    assert '$' in h.review_errors({**review(raw, facts), 'reviewed_fields': []}, displayed)


@pytest.mark.parametrize('kind', ['invented_fact', 'contradiction', 'unsupported_accusation'])
def test_inventions_contradictions_and_serious_accusations_are_rejected(facts, kind):
    raw = CASE['copy']
    path = 'levels.negro.hook_question'
    result = review(raw, facts, approved=False, rejected_fields=[{'path': path, 'kind': kind, 'reason': 'Sin respaldo en la fuente'}])
    assert h.review_errors(result, h.review_fields(raw, facts, ['negro'])) == {path: 'Sin respaldo en la fuente'}


async def test_only_rejected_fields_change_then_full_recheck(facts, ctx, monkeypatch):
    raw = copy.deepcopy(CASE['copy'])
    raw['levels']['negro']['items']['claim_3']['text'] = 'La autora midió daño cerebral irreversible.'
    path = 'levels.negro.items.claim_3.text'
    sequence = [raw, review(raw, facts, approved=False, rejected_fields=[{'path': path,
        'kind': 'invented_fact', 'reason': 'La entrevista no midió daño cerebral'}]),
        {'changes': [{'path': path, 'value': CASE['copy']['levels']['negro']['items']['claim_3']['text']},
                     {'path': 'levels.negro.statement', 'value': 'NO AUTORIZADO'}]}, review(CASE['copy'], facts)]
    calls = []
    async def model(role, system, prompt, **kw):
        calls.append((role, json.loads(prompt)))
        return sequence.pop(0)
    monkeypatch.setattr(h, 'model_json', model)
    events = []
    accepted = await h.write(facts, ctx, audit_out=events)
    assert accepted == CASE['copy']
    assert [c[0] for c in calls] == ['copy_draft', 'fact_check', 'copy_repair', 'fact_check']
    assert calls[2][1]['field_evidence'][path]['reason'] == 'La entrevista no midió daño cerebral'
    assert any(e.get('ignored_changes') for e in events)


async def test_two_repairs_maximum(facts, ctx, monkeypatch):
    raw = copy.deepcopy(CASE['copy'])
    raw['levels']['negro']['items']['claim_3']['text'] = 'Texto ' * 65
    calls = []
    async def model(role, *a, **kw):
        calls.append(role)
        return raw if role == 'copy_draft' else {'changes': []}
    monkeypatch.setattr(h, 'model_json', model)
    with pytest.raises(ValueError, match='reparaciones acotadas'):
        await h.write(facts, ctx)
    assert calls == ['copy_draft', 'copy_repair', 'copy_repair']


async def test_text_mode_real_hub_fallback_no_photos_or_render(entrada, facts, tmp_path, monkeypatch):
    calls = []
    class Unavailable:
        def available(self): return False
        async def run(self, *a, **kw): raise AssertionError('No se lanza Codex')
    async def deepseek(system, prompt, **kw):
        calls.append(system)
        payload = CASE['copy'] if 'redactor editorial' in system else review(CASE['copy'], facts)
        return payload, {'provider': 'deepseek', 'model': 'fixture-only', 'input_tokens': 20, 'output_tokens': 10, 'total_tokens': 30}
    from types import SimpleNamespace
    monkeypatch.setattr('src.adapters.agent.factory.get_agent', lambda name: Unavailable())
    monkeypatch.setattr('src.adapters.ai.factory.get_text_ai', lambda provider: SimpleNamespace(complete_json_with_usage=deepseek))
    def forbidden(*a, **kw): raise AssertionError('Sin fotos, render ni Gemini')
    monkeypatch.setattr('src.adapters.ai.factory.get_analysis_ai', forbidden)
    monkeypatch.setattr('src.core.image_posts.amarillista_media.providers', forbidden)
    monkeypatch.setattr('src.core.image_posts.amarillista_media.find_relevant_images', forbidden)
    monkeypatch.setattr('src.core.image_posts.render.render_async', forbidden)
    monkeypatch.setattr('src.adapters.data.local_image_media_cache.LocalImageMediaCache', forbidden)
    out = tmp_path / 'salida'
    await rp.pipeline(entrada, out, ['negro'], solo_texto=True)
    assert len(calls) == 2
    content = (out / 'texto.md').read_text()
    assert content == h.texto(CASE['copy'], facts, StrategyContext('node_tech', '', '', '@nodetech_es', 'NodeTech'))
    assert content.startswith('Imagen 1 (portada): Las pantallas')
    assert '\n  Segunda línea: ¿Quién' in content
    assert '\nImagen 5 (cierre):' in content
    assert ' · NodeTech · Síguenos para más curiosidades\nFuente: https://' in content
    assert not (out / 'data').exists() and not (out / 'photos.json').exists()
    usage = json.loads((out / 'usage.json').read_text())
    assert [u['provider'] for u in usage] == ['codex', 'deepseek', 'codex', 'deepseek']
    assert sum(u.get('fallback') is True for u in usage) == 2
    # Repetir con la misma salida reutiliza el copy cotejado sin otra llamada.
    await rp.pipeline(entrada, out, ['negro'], solo_texto=True)
    assert len(calls) == 2


async def test_failed_draft_preserves_cost_and_cannot_silently_retry(entrada, tmp_path, monkeypatch):
    calls = []
    async def broken(*a, usage_out=None, **kw):
        calls.append(1)
        usage_out.append({'provider': 'deepseek', 'status': 'failed', 'total_tokens': None})
        raise RuntimeError('Fallo de transporte')
    monkeypatch.setattr(h, 'model_json', broken)
    out = tmp_path / 'salida'
    with pytest.raises(RuntimeError): await rp.pipeline(entrada, out, ['negro'], solo_texto=True)
    assert json.loads((out / 'usage.json').read_text())[0]['total_tokens'] is None
    with pytest.raises(ValueError, match='ya falló'): await rp.pipeline(entrada, out, ['negro'], solo_texto=True)
    assert len(calls) == 1 and not (out / 'texto.md').exists()


def test_long_development_and_resolution_fit_new_limits_without_closing_question(facts):
    raw = copy.deepcopy(CASE['copy'])
    items = raw['levels']['negro']['items']
    items['claim_2']['text'] = ' '.join(['palabra'] * 58) + ' adelante.'
    items['claim_4']['text'] = ' '.join(['palabra'] * 55)
    assert not h.draft_errors(raw, facts, ['negro'])
    items['claim_4']['text'] = ' '.join(['palabra'] * 56)
    assert h.draft_errors(raw, facts, ['negro'])


def test_support_source_for_mechanism_and_recommendations(entrada):
    meta = copy.deepcopy(CASE['post.json'])
    support = 'https://apoyo.example/guia'
    meta['sources'] = [meta['sources'][0], support]
    meta['historia']['fuentes_apoyo'] = [{'nombre': 'Guia seria', 'url': support}]
    plan = CASE['PLAN.md']
    last = [line for line in plan.splitlines() if line.startswith('| 4 |')][0]
    cells = [c.strip() for c in last.strip('|').split('|')]
    cells[2] = 'Guia seria: ' + support
    rp.save(entrada / 'post.json', meta)
    (entrada / 'PLAN.md').write_text(plan.replace(last, '| ' + ' | '.join(cells) + ' |'))
    result = rp.check_input(entrada)
    assert result['approved'], result
    meta['sources'] = meta['sources'][:1]
    rp.save(entrada / 'post.json', meta)
    assert not rp.check_input(entrada)['approved']
