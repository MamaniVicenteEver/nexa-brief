"""Regresiones del brief de cierre: alcance, presupuesto y entradas no confiables."""
import copy
import json
from dataclasses import replace
from types import SimpleNamespace

import pytest

from src.core.image_posts import render_post as rp
from src.core.image_posts import amarillista_media as media
from src.core.image_posts.input_check import visual_errors
from src.core.image_posts.strategies import amarillista_copy as ac
from src.core.image_posts.strategies.amarillista import CONFIG, STRATEGY, build
from tests.unit.image_posts.test_amarillista import F, CTX, model_payload, fixture_copy
from tests.unit.image_posts.test_amarillista_photos import approved_fixture


def test_unrequested_levels_do_not_block_local_validation_or_build():
    raw = model_payload()
    raw['titles']['alto'] = 'palabra '*20
    raw['reflections']['basico'] = 'El celular te deja ciego para siempre.'
    raw['reflections']['alto'] = raw['reflections']['negro']
    assert not ac.draft_errors(raw, F, ['negro'])
    assert {'titles.alto', 'reflections.basico'} <= ac.draft_errors(raw, F).keys()
    copies = ac.copies_from_draft(raw, F, CTX, levels=['negro'])
    assert len(build(F, CTX, copies)) == 5
    fields = ac.review_fields(raw, F, ['negro'])
    assert 'reflections.basico' not in fields and 'titles.alto' not in fields
    assert 'reflections.negro' in fields


async def test_two_directed_repairs_pass_exact_reason_and_own_evidence():
    original = model_payload()
    seen = []
    patches = []
    class AI:
        async def complete_json(self, system, prompt):
            data = json.loads(prompt)
            seen.append(data)
            if len(seen) == 1:
                return copy.deepcopy(original)
            if 'displayed_fields' in data:
                if len(patches) < 2:
                    return {'approved':False,'reason':'Sobreafirma percepción',
                        'rejected_fields':{'reflections.negro':'Sobreafirma: percepción no demuestra un efecto individual'}}
                return {'approved':True,'reason':'Acotado a evidencia','rejected_fields':{}}
            assert set(data['rejected_fields']) == {'reflections.negro'}
            field = data['field_evidence']['reflections.negro']
            assert field['reason'] == data['rejected_fields']['reflections.negro']
            assert [f['text'] for f in field['facts']] == [F[-1].text]
            assert 'quienes respondieron dicen' in field['instruction']
            patches.append(data)
            return {'changes':[{'path':'reflections.negro','value':original['reflections']['negro']},
                               {'path':'titles.negro','value':'NO CAMBIAR ESTE CAMPO'}]}
    events = []
    copies, _, _ = await ac.write(STRATEGY, F, CTX, AI(), audit_out=events)
    assert len(seen) == 6 and len(patches) == 2
    assert copies['claim_1'].headlines == original['titles']
    assert len([e for e in events if 'patch' in e]) == 2


async def test_persistent_rejection_stops_after_two_repairs():
    calls = []
    class AI:
        async def complete_json(self, system, prompt):
            data = json.loads(prompt); calls.append(data)
            if len(calls) == 1: return model_payload()
            if 'displayed_fields' in data:
                return {'approved':False,'reason':'No fiel', 'rejected_fields':{'titles.negro':'No fiel'}}
            return {'changes':[{'path':'titles.negro','value':model_payload()['titles']['negro']}]}
    with pytest.raises(ValueError, match='no aceptado'):
        await ac.write(STRATEGY, F, CTX, AI())
    assert len(calls) == 6


@pytest.mark.parametrize('title', ['La escala detectó un 18 %', 'La encuesta halló señales preocupantes'])
def test_instrument_titles_are_actionable_errors(title):
    raw = model_payload(); raw['titles']['alto'] = title
    assert 'Titular instrumental' in ac.draft_errors(raw, F, ['alto'])['titles.alto']


def test_cover_number_is_reserved_to_proof_even_when_photo_is_missing():
    raw = model_payload(); raw['titles']['negro'] = 'Un 53 % no SUELTA el celular'
    assert 'reserva a la prueba' in ac.draft_errors(raw, F, ['negro'])['titles.negro']
    slides = build(F, CTX, fixture_copy(F))
    cover = json.loads(slides[0]['elements'][0]['value'])
    proof = json.loads(slides[1]['elements'][0]['value'])
    assert cover['kind'] == 'timeline' and proof['kind'] == 'percent'
    assert '53' not in json.dumps(cover)


def test_duplicate_content_figures_stop_being_protagonists():
    facts = list(F); facts[2] = replace(facts[2], text='Sin embargo, 53 % informó ese hábito en otro grupo.')
    slides = build(facts, CTX, fixture_copy(facts))
    assert json.loads(slides[1]['elements'][0]['value'])['kind'] == 'percent'
    assert json.loads(slides[2]['elements'][0]['value'])['kind'] == 'timeline'


def test_local_checker_catches_words_thresholds_conditions_and_cross_claim_numbers():
    visuals = {'claim_4':{'kind':'timeline','label':'Clasificación','claim_ids':['claim_4'],
        'items':[{'label':'Seis o más síntomas','detail':'Sin importar la frecuencia de contacto'}]}}
    errors = visual_errors(visuals, F)
    assert any(e['datum'] == 'Seis' for e in errors)
    assert any(e['datum'] == 'Seis o más' for e in errors)
    assert any('frecuencia' in e['datum'] for e in errors)
    assert all(e['fact_text'] == F[-1].text and e['fix'] for e in errors)
    visuals['claim_4']['items'] = [{'label':'53 %','detail':'Dato de portada importado'}]
    assert any(e['datum'] == '53' for e in visual_errors(visuals,F))


def test_list_item_count_is_not_a_new_observation():
    visual = {'kind':'timeline','label':'Dos condiciones del experimento','claim_ids':['claim_4'],
        'items':[{'label':'Atención','detail':'Puede costar atender'},{'label':'Pausa','detail':'Dar una pausa'}]}
    assert not visual_errors({'claim_4':visual}, F)
    visual['label'] = 'Seis condiciones del experimento'
    assert visual_errors({'claim_4':visual}, F)


def test_cli_check_is_offline_and_requires_no_output(tmp_path,monkeypatch,capsys):
    folder, _, _ = approved_fixture(tmp_path)
    def forbidden(*a,**k): raise AssertionError('Preflight no llama modelos, fotos ni renderer')
    monkeypatch.setattr(rp,'model_json',forbidden); monkeypatch.setattr(rp,'render_async',forbidden)
    monkeypatch.setattr(rp,'write',forbidden); monkeypatch.setattr(media,'providers',forbidden)
    rp.main([str(folder),'--check-input'])
    report = json.loads(capsys.readouterr().out)
    assert report['approved'] and report['model_calls'] == report['images_generated'] == 0
    (folder/'visuals.json').write_text('{"claim_99":{}}')
    with pytest.raises(SystemExit) as result: rp.main([str(folder),'--check-input'])
    assert result.value.code == 1


async def test_schema_and_semantic_review_only_require_requested_levels(tmp_path, monkeypatch):
    from src.core.ports.agent_port import AgentRunResult
    from src.adapters.models import hub
    raw=model_payload();raw['topic']='Fixture'
    raw['reflections']['basico']='X'*300
    raw['titles']['alto']='X'*200
    calls=[]
    class Runner:
        def available(self): return True
        async def run(self,prompt,**kwargs):
            schema=json.loads(kwargs['scope'].output_schema.read_text());calls.append(schema)
            if len(calls)==1:
                assert schema['properties']['reflections']['properties']['basico'] == {'type':'string'}
                assert schema['properties']['reflections']['properties']['negro']['maxLength']==150
                payload=raw
            else:
                assert 'reflections.basico' not in prompt and 'titles.alto' not in prompt
                payload={'approved':True,'reason':'Fixture','rejected_fields':[],'reviewed_fields':[]}
            return AgentRunResult(0,json.dumps(payload),.01,model='fixture',usage={'input_tokens':10,'output_tokens':5})
    def forbidden(*a,**k):raise AssertionError('No APIs ni Gemini')
    monkeypatch.setattr('src.adapters.agent.factory.get_agent',lambda name:Runner())
    monkeypatch.setattr('src.adapters.ai.factory.get_analysis_ai',forbidden)
    monkeypatch.setattr('src.adapters.ai.factory.get_text_ai',forbidden)
    token=hub.call_log_dir.set(tmp_path/'calls')
    try:
        usage=[]
        await ac.write(STRATEGY,F,CTX,usage_out=usage)
        assert len(calls)==2 and len(usage)==2
        assert sum(u['total_tokens'] for u in usage)==30
    finally: hub.call_log_dir.reset(token)


@pytest.mark.parametrize('mode',['local','semantic','unavailable'])
async def test_bad_custom_visual_falls_back_without_aborting_post(tmp_path,monkeypatch,mode):
    folder,source,facts=approved_fixture(tmp_path)
    audit=json.loads((source/'audit.json').read_text()); audit['visual_hash']=None
    rp.save(source/'audit.json',audit)
    visuals=json.loads((folder/'visuals.json').read_text())
    claim=next(iter(visuals))
    if mode=='local': visuals[claim]['label']='Umbral de seis síntomas'
    rp.save(folder/'visuals.json',visuals)
    reviews=[]
    async def review(*a,**k):
        reviews.append(a)
        if mode=='unavailable':raise RuntimeError('Caído')
        return {'approved':False,'reason':'El visual sobreafirma', 'rejected_fields':{claim+'.label':'Dato ajeno'}}
    async def no_photos(*a,**k):return {}
    rendered=[]
    async def render(plan,style,media):
        rendered.append(plan)
        return SimpleNamespace(assets=[])
    monkeypatch.setattr(rp,'model_json',review);monkeypatch.setattr(rp,'find_relevant_images',no_photos)
    monkeypatch.setattr(rp,'render_async',render);monkeypatch.setattr(rp,'contact_sheet',lambda *a:None)
    await rp.pipeline(folder,source,['negro'])
    final=json.loads((source/'audit.json').read_text())
    assert final['approved'] and final['visual_warnings'] and len(rendered)==1
    assert final['validated_levels']==['negro']
    assert set(final['omitted_unvalidated_levels'])=={'alto','medio','basico'}


async def test_reflection_rejects_degrading_scene_even_if_model_accepts():
    candidate=SimpleNamespace(provider='wikimedia',provider_id='bad',title='Homeless man with smartphone',
        description='Sleeping on the pavement',width=1200,height=900)
    class AI:
        async def complete_json(self,system,prompt):
            assert 'escena cotidiana' in system and 'situaciones degradantes' in system
            return {'decisions':[{'id':'wikimedia:bad','yes':True,'reason':'Celular visible','rank':1}]}
    assert not await media.judge_candidates(F[-1],CTX,[candidate],'reflexion',AI())


def test_smartphone_reflection_queries_stay_on_topic():
    fact=replace(F[-1],text='Reducir el uso del smartphone puede acompañar mejor sueño.')
    queries=media.query_variants(fact,replace(CTX,topic='Adicción al celular'),{})
    assert 'smartphone bedroom' in queries and 'person phone home' in queries
    assert not any(q=='sleeping person' for q in queries)


@pytest.mark.parametrize('args,expected', [(['--level','negro'],['negro']),
    (['--level','all'],['basico','medio','alto','negro']), (['--levels','negro','alto'],['negro','alto'])])
def test_cli_scope_and_explicit_all(tmp_path,monkeypatch,args,expected):
    called=[]
    async def pipeline(folder,out,levels,*a):called.append(levels)
    monkeypatch.setattr(rp,'pipeline',pipeline)
    rp.main([str(tmp_path/'entrada'),'--out',str(tmp_path/'out'),*args])
    assert called==[expected]


async def test_changing_level_recotes_saved_copy_and_only_repairs_new_fields(tmp_path,monkeypatch):
    folder,source,_=approved_fixture(tmp_path)
    audit=json.loads((source/'audit.json').read_text())
    audit['validated_levels']=['negro'];audit['draft']['reflections']['alto']='X'*160
    audit['draft_hash']=rp.digest(audit['draft']);rp.save(source/'audit.json',audit)
    original=copy.deepcopy(audit['draft']);calls=[]
    async def model(role,system,prompt,**kwargs):
        data=json.loads(prompt);calls.append((role,data))
        if role=='copy_repair':
            assert set(data['rejected_fields'])=={'reflections.alto'}
            return {'changes':[{'path':'reflections.alto','value':'Vale pensar cómo dormir poco puede afectar tu atención.'}]}
        assert 'reflections.negro' not in data['displayed_fields']
        return {'approved':True,'reason':'Acotado','rejected_fields':{}}
    async def photos(*a,**k):return {}
    async def render(*a,**k):return SimpleNamespace(assets=[])
    monkeypatch.setattr(rp,'model_json',model);monkeypatch.setattr(rp,'find_relevant_images',photos)
    monkeypatch.setattr(rp,'render_async',render);monkeypatch.setattr(rp,'contact_sheet',lambda *a:None)
    monkeypatch.setattr(rp,'write',lambda *a,**k:pytest.fail('No se rehace el copy'))
    await rp.pipeline(folder,source,['alto'])
    final=json.loads((source/'audit.json').read_text())
    assert final['draft']['titles']==original['titles']
    assert final['draft']['reflections']['negro']==original['reflections']['negro']
    assert final['validated_levels']==['alto']
    assert [r for r,d in calls]==['copy_repair','fact_check']



def test_second_person_clitic_in_costarte_is_not_a_false_rejection():
    value='Dormir poco puede costarte atención y reacciones lentas.'
    assert ac.validate_reflection(value,'negro')==value
    with pytest.raises(ValueError,match='segunda persona'):
        ac.validate_reflection('Dormir poco puede costar atención.','negro')



def test_reviewer_cannot_block_a_requested_level_with_an_omitted_level():
    raw=model_payload();fields=ac.review_fields(raw,F,['negro'])
    review={'approved':False,'reason':'Basico no es fiel',
        'rejected_fields':{'reflections.basico':'Sobreafirma'}}
    assert not ac.review_errors(review,raw,fields)
    assert ac.review_errors(review,raw,ac.review_fields(raw,F))=={'reflections.basico':'Sobreafirma'}


def test_integral_float_values_do_not_create_false_foreign_numbers_or_distinct_heroes():
    from src.core.image_posts.strategies.amarillista_visuals import prominent_numbers
    visual={'kind':'percent','value':53.0,'claim_ids':['claim_1']}
    assert not visual_errors({'claim_1':visual},F)
    assert prominent_numbers(visual)=={'53'}



@pytest.mark.parametrize('key,value', [('media_queries',[]),('media_queries',{'reflexion':[3]}),
    ('media_exclude','wikimedia:1'),('editorial_notes',{})])
def test_preflight_catches_invalid_optional_post_fields(tmp_path,key,value):
    folder,_,_=approved_fixture(tmp_path)
    post=json.loads((folder/'post.json').read_text());post[key]=value
    rp.save(folder/'post.json',post)
    report=rp.check_input(folder)
    assert not report['approved'] and key in report['errors'][0]['reason']


def test_cierre2_editorial_contract_requires_scope_minority_population_and_purpose():
    r = CONFIG['redactor']
    assert 'TODOS los displayed_fields' in r['prompt_cotejo']
    assert 'reviewed_fields' in r['schemas']['fact_check']['required']
    c = r['contrato_campos']
    assert 'portada y prueba' in c['qualifier']
    assert 'minoría' in ' '.join(c['titulos']['niveles']['alto'])
    assert 'poblaciones distintas' in c['items']
    black = c['reflexion']['niveles']['negro']['regla']
    assert 'consecuencia' in black and 'sin repetir datos ni dar consejos' in black


async def test_new_fields_do_not_exhaust_per_field_repair_budget():
    original = model_payload()
    paths = ['qualifier', 'titles.negro', 'items.claim_3.body']
    events, patches = [], []
    class AI:
        async def complete_json(self, system, prompt):
            data = json.loads(prompt)
            if not events_seen: events_seen.append(1); return copy.deepcopy(original)
            if 'displayed_fields' in data:
                if len(patches) < len(paths):
                    path = paths[len(patches)]
                    return {'approved':False,'reason':'Fidelidad','rejected_fields':{path:'Revisar alcance'}}
                return {'approved':True,'reason':'Fiel','rejected_fields':{}}
            path = paths[len(patches)]; patches.append(path)
            assert list(data['rejected_fields']) == [path]
            return {'changes':[{'path':path,'value':ac.draft_fields(original)[path]}]}
    events_seen = []
    await ac.write(STRATEGY,F,CTX,AI(),audit_out=events)
    assert patches == paths
    assert [e['repair_counts'] for e in events if 'patch' in e][-1] == {path:1 for path in paths}
