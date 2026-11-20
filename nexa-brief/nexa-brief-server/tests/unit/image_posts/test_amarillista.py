import copy
from dataclasses import replace
from pathlib import Path
import json

import pytest

from src.core.image_posts.plan import build_image_plan
from src.core.image_posts.style import parse_style
from src.core.image_posts.strategies.amarillista import STRATEGY, build, title_for
from src.core.image_posts.strategies.base import Fact, StrategyContext, fallback_copy
from src.core.image_posts.validate import validate_plan

F = [Fact('claim_1', '53 % de adultos admiten usar demasiado el celular', 'https://example.com/1', 'Pew', 'portada'),
     Fact('claim_2', 'En 2026, 53 % de adultos de EE. UU. dijeron usar demasiado el celular', 'https://example.com/2', 'Pew', 'prueba'),
     Fact('claim_3', 'Sin embargo, entre mayores de 65 años fue 25 %', 'https://example.com/3', 'Pew', 'giro'),
     Fact('claim_4', 'El uso prolongado de pantallas puede producir fatiga visual temporal', 'https://example.com/4', 'AOA', 'reflexion')]
REFLECTIONS = dict(negro='Si ignoras el cansancio, les exiges más a tus ojos.',
                   alto='Quizás cuidar tus ojos también empiece por darles una pausa.',
                   medio='¿Qué lugar tiene una pausa para tus ojos?',
                   basico='El uso prolongado de pantallas puede producir fatiga visual.')


def fixture_copy(facts):
    from src.core.image_posts.strategies.amarillista_copy import diagram_for
    result={}
    for f in facts:
        diagram=diagram_for(f)
        if diagram['kind']=='evidence':
            diagram={'kind':'timeline','label':'Evidencia del caso de prueba','items':[{'label':'Hallazgo','detail':f.text}],'claim_ids':[f.claim_id]}
        result[f.claim_id]=replace(fallback_copy(f,60,150),reflections=REFLECTIONS if f.role=='reflexion' else None,diagram=diagram)
    return result


def model_payload(facts=F):
    from src.core.image_posts.strategies.amarillista import rule_titles
    return {'titles':rule_titles(facts[0]),'qualifier':'Adultos de EE. UU. · Pew, 2026',
        'questions':dict(negro='¿Qué te cuesta soltar el celular?',alto='¿Cómo cuidas tus pausas del celular?',medio='¿Cuándo descansas del celular?',basico='¿Cuánto usas tu celular al día?'),
        'reflections':REFLECTIONS.copy(),
        'items':[{'claim_id':f.claim_id,'body':'Adultos de EE. UU. que admitieron uso excesivo. Pew, 2026' if f.role=='prueba' else f.text,'image_query':'person using smartphone'} for f in facts]}

CTX = StrategyContext('node_tech', '', '', '@nodetech_es', 'NodeTech')
STYLE = parse_style(json.loads((Path(__file__).resolve().parents[3] / 'src/skills/image_posts/styles/node_tech.json').read_text()))


def plan(level):
    copies = fixture_copy(F)
    pages = build(F, replace(CTX, level=level), copies)
    return build_image_plan(category_id='node_tech', source_video_id='v', source_revision='revision',
                            template_id='five_slides', slides=pages, style=STYLE, seed=0)


@pytest.mark.parametrize('level', ['negro', 'alto', 'medio', 'basico'])
def test_levels_and_closure(level):
    raw = plan(level).to_dict()
    assert validate_plan(raw, STYLE).passed
    assert raw['slides'][0]['layout'].startswith('amarillista:am_' + level)
    title = next(t['value'] for t in raw['slides'][0]['texts'] if t['role'] == 'headline')
    assert len(title) <= 60 and len(title.split()) <= 8
    assert all(s['claim_refs'] for s in raw['slides'][:-1])
    close = {t['role']: t['value'] for t in raw['slides'][-1]['texts']}
    assert len(close['question'].split()) <= 8 and close['handle'] == '@nodetech_es'
    assert close['cta'] == 'Síguenos para más curiosidades'


def test_invalid_level_and_incomplete_fragment():
    with pytest.raises(ValueError):
        title_for(F[0], 'otro')
    with pytest.raises(ValueError):
        title_for(Fact('x', 'Una frase demasiado larga para entrar en un título sin perder su sentido completo', 'https://example.com', 'x'), 'negro')


def test_rejects_bait_and_missing_cover_source():
    raw = plan('negro').to_dict()
    raw['slides'][-1]['texts'][1]['value'] = 'Comenta SÍ si estás de acuerdo'
    raw['slides'][0]['texts'] = [t for t in raw['slides'][0]['texts'] if t['role'] != 'source']
    report = validate_plan(raw, STYLE)
    assert any('bait' in e for e in report.errors)
    assert any('fuente visible' in e for e in report.errors)


def test_licensed_media_is_attached_to_each_factual_slide():
    from types import SimpleNamespace
    image = SimpleNamespace(width=1200, height=1000, sha256='a' * 64, license='CC BY 4.0',
                            author='Autor', source_url='https://example.com/image',
                            attribution='Autor · CC BY 4.0', title='Sede')
    copies = fixture_copy(F)
    slides = build(F, CTX, copies, [image])
    assert slides[0]['media'][0]['license_id'] == 'CC BY 4.0'
    assert all(not page['media'] for page in slides[1:])
    assert any(t['role'] == 'credit' for t in slides[0]['texts'])



def test_generated_category_palettes():
    from src.core.image_posts.validate import validate_palette
    root = Path(__file__).resolve().parents[3] / 'src/skills/image_posts/styles'
    for category in ('node_tech', 'node_history', 'node_motion', 'node_politics', 'node_economy'):
        style = parse_style(json.loads((root / (category + '.json')).read_text()))
        assert style.category_id == category and style.alarm['levels']['negro']['max_area'] == .2
        assert validate_palette(style).passed


def test_four_facts_produce_five_slides_and_twist():
    copies = fixture_copy(F)
    slides = build(F, CTX, copies)
    assert len(slides) == 5
    assert next(t['value'] for t in slides[2]['texts'] if t['role'] == 'kicker') == 'GIRO'
    assert slides[2]['claim_refs'][0]['id'] == 'claim_3'
    with pytest.raises(ValueError,match='reflexion'):
        build(F[:3], CTX, copies)


def test_distinct_levels_and_topic_questions():
    from src.core.image_posts.strategies.amarillista import question_for
    short = Fact('x', 'En Boston la melaza mató a 21 personas', 'https://example.com', 'Example')
    assert len({title_for(short, level) for level in ('negro','alto','medio','basico')}) == 4
    cell = replace(CTX, topic='Uso del celular')
    ia = replace(CTX, topic='IA en organizaciones')
    assert question_for(cell) != question_for(ia)
    assert len(question_for(cell).split()) <= 8


def test_compact_credit_and_https_normalization():
    from types import SimpleNamespace
    from src.core.image_posts.service import _complete_photo_attribution
    from src.core.image_posts.media_sources import normalize_license_url
    image = SimpleNamespace(sha256='a'*64, author='Alice', license='CC BY 4.0', license_url='http://creativecommons.org/licenses/by/4.0/', source_url='https://commons.wikimedia.org/a')
    pages = [{'layout':'amarillista:am_negro_photo', 'media':[{'sha256':image.sha256}], 'texts':[{'role':'credit','value':'old'}]}]
    _complete_photo_attribution(pages, [image])
    assert pages[0]['texts'][0]['value'] == 'Foto: Alice · CC BY 4.0'
    assert pages[0]['media'][0]['license_url'] == 'https://creativecommons.org/licenses/by/4.0/'
    assert normalize_license_url('http://example.com/license') == 'http://example.com/license'


def test_model_relevance_rejects_unrelated_and_explains_candidates():
    import asyncio
    from types import SimpleNamespace
    from src.core.image_posts.amarillista_media import judge_candidates
    class AI:
        async def complete_json(self, system, prompt):
            assert 'description' in prompt and 'hotel' in prompt
            return {'decisions': [
                {'id':'wikimedia:bad', 'yes':False, 'reason':'El hotel no muestra trabajo con IA'},
                {'id':'wikimedia:good', 'yes':True, 'reason':'Personas trabajando con IA; foto de contexto', 'rank':1}]}
    items=[SimpleNamespace(provider='wikimedia',provider_id='bad',title='Montreux hotel',description='Hotel building'),
           SimpleNamespace(provider='wikimedia',provider_id='good',title='AI at work',description='People working with AI on computers')]
    decisions=asyncio.run(judge_candidates(F[0],CTX,items,'portada',AI()))
    assert len(decisions)==1 and decisions[0][1].provider_id=='good' and decisions[0][2]


def test_model_writes_all_levels_together_and_build_uses_them():
    import asyncio
    from src.core.image_posts.strategies.amarillista_copy import write
    from src.core.image_posts.strategies.amarillista import rule_titles
    facts=F
    class AI:
        calls=0
        async def complete_json(self,system,prompt):
            self.calls+=1
            if self.calls==2:return {'approved':True,'reason':'Cifras y alcance fieles','rejected_fields':{}}
            return model_payload(facts)
    ai=AI();copies,_,_=asyncio.run(write(STRATEGY,facts,CTX,ai))
    assert ai.calls==2 and all(c.source.startswith('modelo') for c in copies.values())
    seen=[]
    for level in ('basico','medio','alto','negro'):
        pages=build(facts,replace(CTX,level=level),copies)
        seen.append(next(t['value'] for t in pages[0]['texts'] if t['role']=='headline'))
    assert len(set(seen))==4 and seen[-1]==copies['claim_1'].headlines['negro']


@pytest.mark.parametrize('duplicates', [
    {'basico':'La melaza inundó Boston','medio':'La melaza inundó Boston','alto':'Boston bajo melaza','negro':'Boston sufrió una ola de MELAZA'},
    {'basico':'La melaza inundó Boston','medio':'Dato: La melaza inundó Boston','alto':'Atención: La melaza inundó Boston','negro':'Alerta: La MELAZA inundó Boston'}])
def test_duplicate_levels_rejected_despite_decoration(duplicates):
    from src.core.image_posts.strategies.amarillista_copy import validate_titles
    with pytest.raises(ValueError,match='iguales'):validate_titles(duplicates)


def test_each_factual_slide_requires_renderable_informative_visual():
    raw=plan('negro').to_dict()
    assert all(s['elements'] for s in raw['slides'][:-1])
    raw['slides'][2]['elements']=[]
    assert any('sin visual informativo' in e for e in validate_plan(raw,STYLE).errors)
    raw=plan('negro').to_dict();raw['slides'][1]['elements']=[{'type':'diagram','value':'{}'}]
    assert any('visual inválido' in e for e in validate_plan(raw,STYLE).errors)
    raw=plan('negro').to_dict();raw['slides'][1]['layout']='amarillista:am_negro_text'
    assert any('no dibuja' in e for e in validate_plan(raw,STYLE).errors)


def test_cover_never_repeats_giant_stat():
    raw=plan('negro').to_dict()
    assert not any(t['role']=='stat' for t in raw['slides'][0]['texts'])


@pytest.mark.parametrize('actual_size,expected', [((1200,1000),['claim_1']),((640,485),[])])
def test_media_selection_deduplicates_and_checks_download_dimensions(monkeypatch,actual_size,expected):
    import asyncio
    from types import SimpleNamespace
    from src.core.image_posts import amarillista_media as m
    from src.core.ports.stock_media_port import StockItem
    item=StockItem(provider='wikimedia',provider_id='1',kind='image',title='Boston flood wreckage',
                   preview_url='https://x.test/a.jpg',download_url='https://x.test/a.jpg',width=1200,height=1000,license='Public domain')
    class Port:
        configured=True
        async def search(self,*a,**kw):return [item]
    async def judge(fact,ctx,items,role,*args):return [(1,i,'Fotografía real') for i in items]
    async def download(*args):return SimpleNamespace()
    async def pause(*args):pass
    monkeypatch.setattr(m,'providers',lambda:{'wikimedia':Port()})
    monkeypatch.setattr(m,'judge_candidates',judge);monkeypatch.setattr(m,'_download_and_cache',download)
    monkeypatch.setattr(m,'_as_sourced_image',lambda *a:SimpleNamespace(sha256='a'*64,license_url='',title='Boston flood wreckage',width=actual_size[0],height=actual_size[1]))
    monkeypatch.setattr(m,'replace',lambda image,**kw:image);monkeypatch.setattr(m.asyncio,'sleep',pause)
    extras={'media_briefs':json.dumps({f.claim_id:{'query':'Boston molasses flood'} for f in F[:2]})}
    result=asyncio.run(m.find_relevant_images(F[:2],CTX,None,extras,ai=object()))
    assert list(result)==expected


def test_semantic_rejection_does_not_publish_model_copy():
    import asyncio
    from src.core.image_posts.strategies.amarillista_copy import write
    class AI:
        calls=0
        async def complete_json(self,system,prompt):
            self.calls+=1
            if self.calls in (2,4,6):return {'approved':False,'reason':'La encuesta no mide adicción','rejected_fields':{'titles.negro':'No diagnosticar'}}
            if self.calls in (3,5):return {'changes':[{'path':'titles.negro','value':'El celular domina a los ADICTOS'}]}
            return model_payload()
    ai=AI()
    with pytest.raises(ValueError,match='no aceptado'):
        asyncio.run(write(STRATEGY,F,CTX,ai))
    assert ai.calls==6  # borrador, tres cotejos y hasta dos reparaciones


def test_pew_offline_rules_also_meet_all_limits():
    from src.core.image_posts.strategies.amarillista import rule_titles
    from src.core.image_posts.strategies.amarillista_copy import validate_titles
    fact=Fact('p','53 % de estadounidenses adultos reportan uso excesivo','https://example.com','Pew')
    assert validate_titles(rule_titles(fact))


def test_structured_transport_is_opt_in_and_preserves_usage():
    import asyncio
    from types import SimpleNamespace
    from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
    calls=[]
    class Client:
        async def create(self,**kwargs):
            calls.append(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"approved":true}'))],
                usage=SimpleNamespace(prompt_tokens=10,completion_tokens=5,total_tokens=15),model='test')
    adapter=DeepSeekAdapter.__new__(DeepSeekAdapter)
    adapter._client=SimpleNamespace(chat=SimpleNamespace(completions=Client()));adapter._model='test';adapter._max_retries=1
    raw,usage=asyncio.run(adapter.complete_json_with_usage('JSON','{}',structured=True))
    assert raw['approved'] is True and usage['total_tokens']==15
    assert calls[0]['response_format']=={'type':'json_object'} and calls[0]['extra_body']['thinking']['type']=='disabled'
    asyncio.run(adapter.complete_json_with_usage('JSON','{}'))
    assert 'response_format' not in calls[1] and 'extra_body' not in calls[1]


def test_archive_sources_require_explicit_public_rights(monkeypatch):
    import asyncio
    import httpx
    from src.adapters.stock.public_archives import NASAImagesAdapter,LibraryCongressPhotosAdapter
    client_class=httpx.AsyncClient
    def respond(request):
        if request.url.host=='images-api.nasa.gov':
            data=lambda i,desc:{'data':[{'nasa_id':i,'title':'Computers at NASA','description':desc}],
                                'links':[{'rel':'preview','href':'https://images-assets.nasa.gov/'+i+'.jpg'}]}
            return httpx.Response(200,json={'collection':{'items':[data('own','NASA staff using computers'),data('third','Courtesy of an external photographer')]}})
        row=lambda i,rights,date:{'id':'https://www.loc.gov/item/'+i+'/','title':'Boston wreckage','rights':rights,'date':date,'image_url':['https://tile.loc.gov/'+i+'.jpg']}
        return httpx.Response(200,json={'results':[row('public',['No known restrictions on publication.'],'1919'),row('unknown',[],'1919'),row('modern',['No known restrictions'],'2020')]})
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:client_class(transport=httpx.MockTransport(respond),**kw))
    nasa=asyncio.run(NASAImagesAdapter().search('computer','image'))
    loc=asyncio.run(LibraryCongressPhotosAdapter().search('Boston molasses flood','image'))
    assert [x.provider_id for x in nasa]==['own']
    assert len(loc)==1 and loc[0].license=='Public domain'


def test_approximate_fraction_is_never_invented_as_exact_percentage():
    from src.core.image_posts.strategies.amarillista_copy import diagram_for
    from src.core.image_posts.strategies.amarillista_visuals import validate_diagram
    fact=Fact('x','Sin embargo, casi dos tercios no habían comenzado a escalar la IA en toda su organización','https://x.test','McKinsey')
    diagram=diagram_for(fact)
    assert diagram['kind']=='fraction' and diagram['approximate'] is True
    assert diagram['numerator']==2 and diagram['denominator']==3 and 'value' not in diagram
    assert validate_diagram(diagram,{'x'})


def test_brand_close_has_accessible_alt_text():
    from src.core.image_posts.copy import _alt_text
    p=plan('negro')
    alt=_alt_text(p.slides[-1])
    assert 'Síguenos para más curiosidades' in alt and '?' in alt


@pytest.mark.parametrize('fact', [
    '530 % de estadounidenses adultos reportan uso excesivo',
    'La melaza se transportaba en Boston en 1921',
    'Amazon contrató 250 puestos en Devices & Services'])
def test_offline_rules_never_infer_a_different_claim_from_substrings(fact):
    from src.core.image_posts.strategies.amarillista import rule_titles
    with pytest.raises(ValueError):rule_titles(Fact('x',fact,'https://x.test','x'))


def test_history_rejects_annotated_variant_even_if_model_accepts_it():
    import asyncio
    from types import SimpleNamespace
    from src.core.image_posts.amarillista_media import judge_candidates
    class AI:
        async def complete_json(self,*args):return {'decisions':[{'id':'wikimedia:1','yes':True,'reason':'Fotografía real','rank':1}]}
    item=SimpleNamespace(provider='wikimedia',provider_id='1',title='Boston Molasses Flood (original tank scale superimposed)',description='Historical photograph with an overlay')
    assert not asyncio.run(judge_candidates(F[0],replace(CTX,category_id='node_history'),[item],'verdad',AI()))


@pytest.mark.parametrize('extras', [[], ['verdad'], ['segunda_prueba','verdad'], ['segunda_prueba','verdad','que_hacer']])
def test_range_five_to_eight_and_reflection_always_present(extras):
    facts=F+[Fact('claim_'+str(5+i),'Dato adicional con fuente','https://example.com/x','Fuente',role) for i,role in enumerate(extras)]
    slides=build(facts,CTX,fixture_copy(facts))
    assert len(slides)==5+len(extras)
    plan=build_image_plan(category_id='node_tech',source_video_id='v',source_revision='r',template_id='five_slides',slides=slides,style=STYLE,seed=0)
    assert validate_plan(plan,STYLE).passed
    assert sum('_reflexion_' in s['layout'] for s in slides)==1


@pytest.mark.parametrize('count',[4,9])
def test_outside_range_rejected(count):
    raw=plan('negro').to_dict()
    raw['slides']=raw['slides'][:count] if count==4 else raw['slides'][:4]+[copy.deepcopy(raw['slides'][1]) for _ in range(4)]+raw['slides'][-1:]
    assert any('5 a 8' in e for e in validate_plan(raw,STYLE).errors)


def test_missing_misordered_or_unsourced_reflection_rejected():
    raw=plan('negro').to_dict();raw['slides'][3]['texts']=[t for t in raw['slides'][3]['texts'] if t['role']!='source']
    assert any('fuente visible' in e for e in validate_plan(raw,STYLE).errors)
    raw=plan('negro').to_dict();raw['slides'][3]['claim_refs']=[]
    assert any('reflexion requiere evidencia' in e for e in validate_plan(raw,STYLE).errors)
    raw=plan('negro').to_dict();raw['slides'][2],raw['slides'][3]=raw['slides'][3],raw['slides'][2]
    assert any('Roles y orden' in e for e in validate_plan(raw,STYLE).errors)
    with pytest.raises(ValueError,match='reflexion'):
        build([f for f in F if f.role!='reflexion'],CTX,fixture_copy(F))


@pytest.mark.parametrize('value', ['palabra '*21,'x'*151,'El celular te deja ciego.','Cada hora extra destruye tus ojos.','Tú siempre pagarás con daño permanente.'])
def test_reflection_limits_and_medical_exaggeration(value):
    from src.core.image_posts.strategies.amarillista_copy import validate_reflection
    with pytest.raises(ValueError):validate_reflection(value,'negro')
    raw=plan('negro').to_dict()
    next(t for t in raw['slides'][3]['texts'] if t['role']=='body')['value']=value
    assert any('reflexion inválida' in e for e in validate_plan(raw,STYLE).errors)


def test_reflection_tone_changes_and_negro_needs_second_person():
    from src.core.image_posts.strategies.amarillista_copy import validate_reflections,validate_reflection
    assert validate_reflections(REFLECTIONS)
    with pytest.raises(ValueError,match='segunda persona'):validate_reflection('La fatiga visual merece una pausa.','negro')
    with pytest.raises(ValueError):validate_reflections({k:REFLECTIONS['alto'] for k in REFLECTIONS})
    negro=plan('negro');alto=plan('alto')
    assert next(t.value for t in negro.slides[3].texts if t.role=='body') != next(t.value for t in alto.slides[3].texts if t.role=='body')


def test_one_bad_field_is_repaired_without_rewriting_accepted_fields():
    import asyncio
    from src.core.image_posts.strategies.amarillista_copy import write
    original=model_payload();original['items'][1]['body']='texto '*31
    class AI:
        calls=0
        async def complete_json(self,system,prompt):
            self.calls+=1
            if self.calls==1:return original
            if self.calls==2:
                assert set(json.loads(prompt)['rejected_fields'])=={'items.claim_2.body'}
                return {'changes':[{'path':'items.claim_2.body','value':'Adultos de EE. UU. que admitieron uso excesivo. Pew, 2026'}]}
            return {'approved':True,'reason':'Fiel','rejected_fields':{}}
    ai=AI();copies,_,_=asyncio.run(write(STRATEGY,F,CTX,ai))
    assert ai.calls==3
    assert copies['claim_1'].headlines==original['titles']
    assert copies['claim_4'].reflections==original['reflections']
    assert all(c.source.startswith('modelo') and 'reparación' in c.source for c in copies.values())


def test_repair_cannot_modify_unrejected_fields():
    from src.core.image_posts.strategies.amarillista_copy import repair_draft
    original=model_payload()
    result=repair_draft(original,{'changes':[{'path':'titles.negro','value':'Otro'}, {'path':'qualifier','value':'Alcance corregido'}]},{'qualifier':'largo'})
    assert result['titles']==original['titles'] and result['qualifier']=='Alcance corregido'


def test_amarillista_is_default_carousel_and_legacy_strategies_remain_explicit():
    from src.core.image_posts import strategies
    assert strategies.resolve(None,'five_slides').id=='amarillista'
    assert strategies.StrategyContext('node_tech','','','@x','X').level=='negro'
    assert strategies.resolve('hilo_guardable','five_slides').id=='hilo_guardable'
    assert strategies.resolve('cifra_que_frena','daily_fact').id=='cifra_que_frena'


def test_roles_require_approved_metadata_not_position():
    from src.core.image_posts.strategies.amarillista import pick
    assert pick(list(reversed(F)))==F
    with pytest.raises(ValueError,match='rol explícito'):pick([replace(f,role='') for f in F])
    with pytest.raises(ValueError,match='duplicado'):pick(F+[replace(F[0],claim_id='claim_9')])


def test_only_invalid_title_is_repaired_and_unknown_numbers_are_rejected():
    from src.core.image_posts.strategies.amarillista_copy import draft_errors
    raw=model_payload();raw['titles']['alto']='palabra '*10
    assert set(draft_errors(raw,F))=={'titles.alto'}
    raw=model_payload();raw['reflections']['negro']='Tus ojos pagan 99 euros por descansar.'
    assert 'reflections.negro' in draft_errors(raw,F)
    raw=model_payload();raw['items'].append(copy.deepcopy(raw['items'][0]))
    assert 'items' in draft_errors(raw,F)


@pytest.mark.parametrize('field,value', [
    ('url','https://pewresearch.org/2026/report.pdf'),
    ('source_name','Pew Research Center, 2026'),
])
def test_source_year_is_allowed_only_for_its_own_fact(field,value):
    from src.core.image_posts.strategies.amarillista_copy import draft_errors
    facts=list(F)
    facts[1]=replace(facts[1],text='En la encuesta, 45 % de adultos intentó reducir el uso.',**{field:value})
    raw=model_payload(facts)
    raw['qualifier']='Adultos de EE. UU.; Pew, 2026.'
    raw['items'][1]['body']='Adultos encuestados que intentaron reducir el uso en 2026.'
    errors=draft_errors(raw,facts)
    assert 'qualifier' not in errors
    assert 'items.claim_2.body' not in errors


def test_number_from_another_fact_is_rejected_with_exact_repair_instruction():
    from src.core.image_posts.strategies.amarillista_copy import draft_errors
    raw=model_payload()
    raw['items'][1]['body']='Adultos de EE. UU. reportaron 25 % en la encuesta de 2026.'
    error=draft_errors(raw,F)['items.claim_2.body']
    assert error=='Quita "25" de items.claim_2.body: no está en el hecho.'


def test_plain_text_card_is_not_an_informative_fallback():
    raw=plan('negro').to_dict()
    raw['slides'][3]['elements']=[{'type':'diagram','value':json.dumps({'kind':'evidence','items':[F[3].text],'claim_ids':['claim_4']})}]
    assert any('tarjeta de texto' in e for e in validate_plan(raw,STYLE).errors)


def test_api_default_includes_strategy_level_and_accepts_alto():
    from src.presentation.api.schemas.image_posts_schema import PlanCreateRequest
    from src.core.image_posts.strategies import resolve
    req=PlanCreateRequest(category_id='node_tech',source_video_id='v',style_id=STYLE.style_id)
    assert req.template_id=='five_slides' and req.level=='alto'
    assert resolve(req.strategy_id,req.template_id).id=='amarillista'
    assert PlanCreateRequest(**{**req.model_dump(),'level':'alto'}).level=='alto'
    with pytest.raises(ValueError): PlanCreateRequest(**{**req.model_dump(),'level':'rojo'})


def input_fixture(folder, facts=F):
    folder.mkdir(exist_ok=True)
    (folder/'post.json').write_text(json.dumps({'category_id':'node_tech','title':'Prueba propia','sources':[f.url for f in facts]}))
    (folder/'PLAN.md').write_text('## 3. Hechos verificados\n| # | hecho | fuente | cotejo / uso |\n|---|---|---|---|\n'+''.join(f'| {f.claim_id[6:]} | {f.text} | {f.source_name}: {f.url} | Sí; rol={f.role}; localizador de prueba |\n' for f in facts))
    return folder


@pytest.mark.parametrize('mutation,error', [('source','sin fuente'),('role','rol explícito'),('missing','reflexion'),('duplicate','ID duplicado')])
def test_plan_input_fails_before_calling_provider(tmp_path,mutation,error):
    from src.core.image_posts.render_post import read_input
    folder=input_fixture(tmp_path/'entrada')
    plan_file=folder/'PLAN.md';raw=plan_file.read_text()
    if mutation=='source':raw=raw.replace(F[3].url,'https://not-listed.test/paper')
    if mutation=='role':raw=raw.replace('rol=reflexion','evidencia=reflexion')
    if mutation=='missing':raw='\n'.join(line for line in raw.splitlines() if 'rol=reflexion' not in line)
    if mutation=='duplicate':raw+='\n'+raw.splitlines()[-1]
    plan_file.write_text(raw)
    with pytest.raises(ValueError,match=error):read_input(folder)


def test_five_and_eight_input_roles_are_selected_from_source(tmp_path):
    from src.core.image_posts.render_post import read_input
    assert len(read_input(input_fixture(tmp_path/'cinco'))[1])+1==5
    extended=F+[Fact('claim_'+str(5+i),'Hecho con fuente','https://example.com/'+str(5+i),'Fuente',role) for i,role in enumerate(('segunda_prueba','verdad','que_hacer'))]
    _,facts,usages,_=read_input(input_fixture(tmp_path/'ocho',list(reversed(extended))))
    assert [f.role for f in facts]==['portada','prueba','segunda_prueba','giro','verdad','reflexion','que_hacer']
    assert len(facts)+1==8 and 'rol=reflexion' in usages['claim_4']


def test_resume_blocks_unbounded_retry_and_tampered_copy(tmp_path,monkeypatch):
    import asyncio
    from src.core.image_posts import render_post as rp
    folder=input_fixture(tmp_path/'entrada');out=tmp_path/'salida'
    calls=[]
    async def failed_writer(*args,**kwargs):
        calls.append(True)
        raise ValueError('proveedor rechazado después de reparación')
    monkeypatch.setattr(rp,'write',failed_writer)
    with pytest.raises(ValueError,match='proveedor rechazado'):asyncio.run(rp.pipeline(folder,out,['negro']))
    assert len(calls)==1 and (out/'failure.json').exists() and (out/'usage.json').exists()
    with pytest.raises(ValueError,match='ya agotó'):asyncio.run(rp.pipeline(folder,out,['negro']))
    assert len(calls)==1  # no repetir automáticamente un fallo idéntico
    failure=json.loads((out/'failure.json').read_text())
    rp.save(out/'audit.json',{'input_hash':failure['input_hash'],'approved':True,'draft':model_payload(),'draft_hash':'edited'})
    (out/'failure.json').unlink()
    with pytest.raises(ValueError,match='alterado'):asyncio.run(rp.pipeline(folder,out,['negro']))
    assert len(calls)==1


def test_contact_sheet_supports_eight_slides_and_accents(tmp_path):
    from PIL import Image
    from src.core.image_posts.render_post import contact_sheet
    paths=[]
    for i in range(8):
        path=tmp_path/f'{i}.jpg';Image.new('RGB',(1080,1350),'#557744').save(path);paths.append(path)
    target=tmp_path/'contactos.png'
    contact_sheet(paths,['REFLEXIÓN']*8,target)
    with Image.open(target) as sheet:assert sheet.size==(1296,888)


def test_structural_repair_preserves_valid_item_fields():
    from src.core.image_posts.strategies.amarillista_copy import repair_draft,draft_errors
    original=model_payload();missing=copy.deepcopy(original);missing['items']=missing['items'][1:]
    proposed=copy.deepcopy(original['items']);proposed[1]['body']='Cambio no autorizado'
    repaired=repair_draft(missing,{'changes':[{'path':'items','value':proposed}]},draft_errors(missing,F))
    assert not draft_errors(repaired,F)
    assert repaired['items'][0]['body']==original['items'][1]['body']
    assert len(repaired['items'])==len(F)


def test_reviewer_only_sees_displayed_fields_and_normalizes_known_pointer():
    from src.core.image_posts.strategies.amarillista_copy import review_fields,review_errors
    raw=model_payload();fields=review_fields(raw,F)
    assert 'items.claim_1.body' not in fields and 'items.claim_4.body' not in fields
    assert fields['reflections.negro']['claim_ids']==['claim_4']
    assert fields['items.claim_2.body']['stat_shown_separately']=='53 %'
    errors=review_errors({'approved':False,'reason':'fidelidad','rejected_fields':{'items/1/body':'alcance'}},raw,fields)
    assert errors=={'items.claim_2.body':'alcance'}
    bad=review_errors({'approved':False,'reason':'oculto','rejected_fields':{'items/0/body':'body obligatorio'}},raw,fields)
    assert '$' in bad


def test_repair_normalizes_provider_paths_without_touching_valid_fields():
    from src.core.image_posts.strategies.amarillista_copy import repair_draft
    raw=model_payload();raw['items'][1]['body']='largo '*31
    result=repair_draft(raw,{'changes':[{'path':'draft.items[1].body','value':'Población adulta; año 2026.'}]},{'items.claim_2.body':'largo'})
    assert result['items'][1]['body']=='Población adulta; año 2026.' and result['titles']==raw['titles']


def test_percentage_points_keep_their_unit():
    from src.core.image_posts.strategies.base import extract_stat
    assert extract_stat('La inactividad creció 5 puntos porcentuales entre 2010 y 2022')=='5 puntos porcentuales'


def test_native_gemini_schema_is_opt_in_and_keeps_usage():
    import asyncio
    from types import SimpleNamespace
    from src.adapters.ai.infrastructure.gemini_flash_adapter import GeminiFlashAdapter
    configs=[]
    async def generate_content(**kwargs):
        configs.append(kwargs['config'])
        return SimpleNamespace(text='{"approved":true}',usage_metadata=SimpleNamespace(prompt_token_count=9,candidates_token_count=3,total_token_count=12),model_version='gemini-test')
    adapter=GeminiFlashAdapter.__new__(GeminiFlashAdapter)
    adapter._client=SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
    adapter._model='gemini-test'
    schema={'type':'object','properties':{'approved':{'type':'boolean'}},'required':['approved']}
    result,usage=asyncio.run(adapter.complete_json_with_usage('JSON','{}',response_json_schema=schema))
    assert result['approved'] and usage['total_tokens']==12 and configs[0].response_json_schema==schema
    asyncio.run(adapter.complete_json_with_usage('JSON','{}'))
    assert configs[1].response_json_schema is None


def test_relative_percent_is_not_a_part_of_one_hundred():
    from src.core.image_posts.strategies.amarillista_copy import diagram_for
    f=Fact('r','Los desarrolladores tardaron 19 % más con IA en ese ensayo','https://x.test','METR')
    diagram=diagram_for(f)
    assert diagram['kind']=='quantity' and diagram['value']=='19' and '% de variación'==diagram['unit']
    assert diagram['label']==f.text


def test_recheck_reuses_real_draft_and_repairs_only_rejected_field(tmp_path,monkeypatch):
    import asyncio
    from src.core.image_posts import render_post as rp
    folder=input_fixture(tmp_path/'entrada');out=tmp_path/'salida';out.mkdir()
    raw=model_payload();changed='La MITAD admite demasiado uso del celular'
    rp.save(out/'audit.json',{'input_hash':'old-contract','approved':True,'draft':raw,'draft_hash':rp.digest(raw),
        'copy_sources':{f.claim_id:'modelo: original real' for f in F}})
    roles=[]
    async def response(role,*args,**kwargs):
        roles.append(role)
        if len(roles)==1:return {'approved':False,'reason':'Titular','rejected_fields':{'titles.negro':'Revisar alcance'}}
        if len(roles)==2:return {'changes':[{'path':'titles.negro','value':changed}]}
        return {'approved':True,'reason':'Fiel','rejected_fields':{}}
    async def no_redraft(*args,**kwargs):raise AssertionError('No debe generar otro borrador')
    async def stop_before_render(*args,**kwargs):raise ValueError('fin de fase comprobada')
    monkeypatch.setattr(rp,'model_json',response);monkeypatch.setattr(rp,'write',no_redraft)
    monkeypatch.setattr(rp,'find_relevant_images',stop_before_render)
    with pytest.raises(ValueError,match='fase comprobada'):asyncio.run(rp.pipeline(folder,out,['negro'],recheck_approved=True))
    accepted=json.loads((out/'audit.json').read_text())
    assert roles==['fact_check','copy_repair','fact_check']
    assert accepted['draft']['titles']['negro']==changed
    assert accepted['draft']['reflections']==raw['reflections']
    assert 'reparación acotada' in accepted['copy_sources']['claim_1']
