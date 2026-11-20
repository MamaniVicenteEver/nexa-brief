"""Regresiones r6: contexto por rol, presupuestos, caché y copy inmutable."""
import hashlib
import io
import json
from dataclasses import asdict, replace
from types import SimpleNamespace

from PIL import Image
import pytest

from src.core.image_posts import amarillista_media as media
from src.core.image_posts import render_post as rp
from src.core.image_posts.media_sources import SourcedImage
from src.core.image_posts.strategies.base import Fact, StrategyContext
from src.core.ports.stock_media_port import StockItem
from src.adapters.data.local_image_media_cache import LocalImageMediaCache

CTX=StrategyContext('node_tech','Dormir poco','Sueño y atención','@test','TEST')
FACTS=[Fact('claim_'+str(i),'Dormir poco puede dificultar la atención','https://example.org/sleep','NIH',role)
       for i,role in enumerate(('portada','prueba','giro','verdad','reflexion'),1)]


def item(number='1',**kwargs):
    return StockItem(provider='wikimedia',provider_id=number,kind='image',title='Person sleeping in bed',
                     preview_url='https://example.org/'+number+'.jpg',download_url='https://example.org/'+number+'.jpg',
                     width=1600,height=1200,license='CC BY 4.0',**kwargs)


def photo(number='1',size=(1200,900),**kwargs):
    out=io.BytesIO(); Image.new('RGB',size,((int(number)*37)%255,(int(number)*83)%255,30)).save(out,format='JPEG')
    content=out.getvalue()
    return SourcedImage(provider='wikimedia',provider_id=number,title='Person sleeping',description='Sleep context',
        width=size[0],height=size[1],original_width=size[0],original_height=size[1],
        url='https://example.org/'+number+'.jpg',thumburl='',author='Test',author_url='',credit='',
        source_url='https://example.org/'+number,article_url='',license='CC BY 4.0',
        license_url='https://creativecommons.org/licenses/by/4.0/',attribution='Test · CC BY 4.0',
        sha256=hashlib.sha256(content).hexdigest(),content=content,why='Contexto aprobado',**kwargs)


@pytest.fixture
def fast_policy(monkeypatch):
    monkeypatch.setitem(media.CONFIG['visuales'],'pausa_busqueda_segundos',0)


def test_queries_expand_real_scene_and_support_explicit_alternatives():
    queries=media.query_variants(FACTS[0],CTX,{'query':'adult awake in bed'})
    assert queries[0]=='adult awake in bed'
    assert 'person sleeping' in queries and 'sleeping person' in queries
    ai_ctx=replace(CTX,topic='IA y tiempo',hook='Ensayo IA')
    q=media.query_variants(replace(FACTS[0],text='Ensayo de IA'),ai_ctx,{'query':['developer checking wristwatch','computer programming']})
    assert q[:2]==['developer checking wristwatch','computer programming']
    assert 'software developer' in q
    historical=media.query_variants(replace(FACTS[0],text='Inundación de melaza'),replace(CTX,category_id='node_history'),{})
    assert 'Boston molasses flood' in historical
    physical=media.query_variants(replace(FACTS[-1],text='La actividad física se asocia con mejor salud mental y sueño'),
                                  replace(CTX,topic='Actividad física',hook='Movimiento diario'),{})
    assert 'adults walking park' in physical and 'sleeping person' not in physical


async def test_context_judgment_has_no_requirement_to_prove_statistic():
    class AI:
        async def complete_json(self,system,prompt):
            data=json.loads(prompt)
            assert 'NO debe demostrar cifras' in system
            assert 'No exijas' in system and 'ensayo METR' in system
            assert data['image_use'].startswith('contexto')
            assert data['category_id']=='node_tech'
            return {'decisions':[{'id':'wikimedia:1','yes':True,'reason':'Persona en cama: contexto de sueño; no prueba la cifra','rank':1}]}
    result=await media.judge_candidates(FACTS[1],CTX,[item()],'prueba',AI())
    assert result[0][1].provider_id=='1'


async def test_new_candidates_and_concepts_supply_every_content_role(monkeypatch,fast_policy):
    calls=[]
    class Port:
        configured=True
        async def search(self,query,*args,**kwargs):
            calls.append((query,kwargs['per_page']))
            return [] if query=='adult awake in bed' else [item(str(i)) for i in range(1,19)]
    async def judge(fact,ctx,items,role,*args): return [(i,x,'Escena contextual, no prueba del dato') for i,x in enumerate(items)]
    async def download(it,*args): return it
    monkeypatch.setattr(media,'providers',lambda:{'wikimedia':Port()})
    monkeypatch.setattr(media,'judge_candidates',judge)
    monkeypatch.setattr(media,'_download_and_cache',download)
    monkeypatch.setattr(media,'_as_sourced_image',lambda it,*args:photo(it.provider_id))
    decisions=[]
    result=await media.find_relevant_images(FACTS,CTX,None,{'media_briefs':json.dumps({f.claim_id:{'query':'adult awake in bed'} for f in FACTS})},ai=object(),decisions_out=decisions)
    assert set(result)=={f.claim_id for f in FACTS}
    assert len({im.sha256 for im in result.values()})==5
    assert len({im.provider_id for im in result.values()})==5
    assert all(d['status']=='selected' for d in decisions)
    assert all(n==18 for _,n in calls)
    assert sum(q=='adult awake in bed' for q,_ in calls)==1  # caché de búsqueda por post


async def test_new_role_candidates_are_judged_before_old_rejections(monkeypatch,fast_policy):
    facts=FACTS[:2]
    class Port:
        configured=True
        async def search(self,q,*a,**k):return [item('1')] if q=='cover scene' else [item('2')]
    seen=[]
    async def judge(fact,ctx,items,role,*args):
        seen.append((role,[i.provider_id for i in items]))
        return [(1,i,'Contexto') for i in items if i.provider_id==('1' if role=='portada' else '2')]
    monkeypatch.setattr(media,'providers',lambda:{'wikimedia':Port()})
    monkeypatch.setattr(media,'judge_candidates',judge)
    async def download(it,*a):return it
    monkeypatch.setattr(media,'_download_and_cache',download)
    monkeypatch.setattr(media,'_as_sourced_image',lambda it,*a:photo(it.provider_id))
    result=await media.find_relevant_images(facts,CTX,None,{'media_briefs':json.dumps({'claim_1':{'query':'cover scene'},'claim_2':{'query':'proof scene'}})},ai=object())
    assert len(result)==2 and seen[:2]==[('portada',['1']),('prueba',['2'])]


async def test_filters_and_fallback_are_auditable_without_relaxing_license(monkeypatch,fast_policy):
    class Port:
        configured=True
        async def search(self,*a,**k):
            return [item('1').model_copy(update={'license':'Pixabay Content License'}),
                    item('2').model_copy(update={'width':640}),
                    item('3'),item('4'),
                    item('5').model_copy(update={'original_width':640,'original_height':480}),
                    item('6').model_copy(update={'author':'Biography '*50})]
    class AI:
        async def complete_json(self,system,prompt):
            return {'decisions':[{'id':c['id'],'yes':False,'reason':'Es una captura, no una foto contextual','rank':1}
                                 for c in json.loads(prompt)['candidates']]}
    monkeypatch.setattr(media,'providers',lambda:{'wikimedia':Port()})
    records=[]
    result=await media.find_relevant_images(FACTS[:1],CTX,None,{'media_exclude':['wikimedia:3']},ai=AI(),decisions_out=records)
    assert not result
    assert {d['reason'] for d in records[0]['filters']} >= {'license_not_free','metadata_dimensions_too_small','excluded',
                                                        'original_dimensions_too_small','attribution_too_long_for_slide'}
    assert records[0]['judgments'][0]['yes'] is False
    assert records[0]['reason']=='no_approved_context_photo'


async def test_search_failures_and_judge_failure_are_bounded(monkeypatch,fast_policy):
    calls=[]
    class Port:
        configured=True
        async def search(self,*a,**kw):calls.append(a[0]);raise TimeoutError()
    monkeypatch.setattr(media,'providers',lambda:{'wikimedia':Port()})
    records=[]
    assert not await media.find_relevant_images(FACTS,CTX,None,ai=object(),decisions_out=records)
    assert len(calls)==2  # proveedor caído: sin ocho timeouts por lámina
    assert records[0]['searches'][0]['error']=='TimeoutError'
    assert all(d['reason']=='no_eligible_free_candidates' for d in records)


async def test_judge_failure_does_not_start_more_queries(monkeypatch,fast_policy):
    calls=[]
    class Port:
        configured=True
        async def search(self,*a,**kw):calls.append(1);return [item()]
    class AI:
        async def complete_json(self,*a):raise RuntimeError('judge unavailable')
    monkeypatch.setattr(media,'providers',lambda:{'wikimedia':Port()})
    records=[]
    assert not await media.find_relevant_images(FACTS[:1],CTX,None,ai=AI(),decisions_out=records)
    assert len(calls)==1 and records[0]['reason']=='photo_judge_unavailable'


async def test_download_budget_dimensions_and_same_bytes(monkeypatch,fast_policy):
    class Port:
        configured=True
        async def search(self,*a,**kw):return [item(str(i)) for i in range(1,19)]
    async def judge(fact,ctx,items,role,*a):return [(i,it,'Contexto') for i,it in enumerate(items)]
    calls=[]
    async def download(it,*a):calls.append(it.provider_id);return it
    monkeypatch.setattr(media,'providers',lambda:{'wikimedia':Port()})
    monkeypatch.setattr(media,'judge_candidates',judge)
    monkeypatch.setattr(media,'_download_and_cache',download)
    def sourced(it,*args):
        return photo(it.provider_id,(640,480)) if it.provider_id=='1' else replace(photo('2'),provider_id=it.provider_id)
    monkeypatch.setattr(media,'_as_sourced_image',sourced)
    records=[]
    result=await media.find_relevant_images(FACTS[:2],CTX,None,ai=object(),decisions_out=records)
    assert list(result)==['claim_1'] and len(calls)==4  # dos por rol como máximo
    assert records[0]['downloads'][0]['reason']=='actual_dimensions_too_small'
    assert records[1]['downloads'][0]['reason']=='duplicate_hash'
    assert records[1]['reason']=='download_budget_exhausted'


@pytest.mark.parametrize('duplicate', ['id','hash','small','license','author'])
def test_loading_approved_photos_checks_bytes_dimensions_license_and_duplicates(tmp_path,duplicate):
    cache=LocalImageMediaCache(tmp_path/'data')
    first=photo('1'); second=photo('2')
    if duplicate=='id':second=replace(second,provider_id=first.provider_id)
    if duplicate=='hash':second=replace(first,provider_id='2')
    if duplicate=='small':second=replace(photo('2',(640,480)),width=1600,height=1200)
    if duplicate=='license':second=replace(second,license='Pixabay Content License')
    if duplicate=='author':second=replace(second,author='Biography '*50)
    entries={}
    for fact,im in zip(FACTS,(first,second)):
        data={k:v for k,v in asdict(im).items() if k!='content'}
        cache.put_by_url(im.url,im.content,{**data,'extension':'.jpg'})
        entries[fact.claim_id]={'fact_hash':rp.digest(vars(fact)),'image':data}
    rp.save(tmp_path/'photos.json',entries)
    loaded=rp.load_photos(tmp_path/'photos.json',FACTS,cache,set())
    assert list(loaded)==['claim_1']


def test_numeric_stat_and_comparison_keep_photo_in_plan():
    from tests.unit.image_posts.test_amarillista import F,CTX as context,fixture_copy,STYLE
    from src.core.image_posts.strategies.amarillista import build
    from src.core.image_posts.plan import build_image_plan
    from src.core.image_posts.validate import validate_plan
    copies=fixture_copy(F)
    photos={f.claim_id:photo(str(i)) for i,f in enumerate(F,1)}
    slides=build(F,context,copies,photos)
    assert all(s['media'] for s in slides[:-1])
    assert any(t['role']=='stat' for t in slides[1]['texts'])
    comparison={'kind':'comparison','label':'Datos','items':[{'label':'Parte','value':53}], 'claim_ids':['claim_2']}
    copies['claim_2']=replace(copies['claim_2'],diagram=comparison)
    slides=build(F,context,copies,photos)
    assert {e['type'] for e in slides[1]['elements']}=={'photo','diagram'}
    plan=build_image_plan(category_id='node_tech',source_video_id='r6',source_revision='r6',template_id='node_tech_main',slides=slides,style=STYLE,seed=0)
    assert not any('no dibuja' in e for e in validate_plan(plan,STYLE).errors)
    # La receta de reflexión muestra la foto y la frase, no un gráfico oculto.
    raw=plan.to_dict()
    raw['slides'][-2]['elements'].append({'type':'diagram','value':json.dumps(comparison)})
    assert any('no dibuja el gráfico' in e for e in validate_plan(raw,STYLE).errors)


def approved_fixture(tmp_path, topic='sueno'):
    from pathlib import Path
    cases=json.loads((Path(__file__).parents[2]/'fixtures/image_posts/codex_pipeline.json').read_text())
    case=cases[topic]
    folder=tmp_path/'entrada';folder.mkdir()
    (folder/'PLAN.md').write_text(case['PLAN.md'])
    for filename in ('post.json','visuals.json'):
        rp.save(folder/filename,case[filename])
    meta,facts,usages,_=rp.read_input(folder)
    style=rp.LocalImagePostResources(skills_dir=rp.SERVER/'src/skills').get_style(meta['category_id'])
    ctx=StrategyContext(meta['category_id'],meta['title'],meta['title'],style.brand['handle'],style.brand['name'],
                        str(style.tone.get('voice',''))+'\nNotas editoriales: '+str(meta.get('editorial_notes','')),'negro')
    source=tmp_path/'aprobado';source.mkdir()
    audit={'approved':True,'input_hash':rp.copy_identity(meta,facts,usages,ctx),'draft':case['copy'],
           'draft_hash':rp.digest(case['copy']),'copy_sources':{f.claim_id:'modelo: codex JSON + cotejo por campo' for f in facts},
           'visual_hash':rp.digest({'facts':[vars(f) for f in facts],'visuals':case['visuals.json']}),
           'visual_review':{'approved':True,'reason':'fixture editorial para probar transporte'}}
    rp.save(source/'audit.json',audit)
    return folder,source,facts


@pytest.mark.parametrize('mutation',['unapproved','draft','input','visual','empty_visual','missing_visual','visual_approval','no_source'])
async def test_photos_only_refuses_unapproved_or_changed_copy_without_model_calls(tmp_path,monkeypatch,mutation):
    folder,source,facts=approved_fixture(tmp_path)
    audit=json.loads((source/'audit.json').read_text())
    if mutation=='unapproved':audit['approved']=False
    if mutation=='draft':audit['draft']['titles']['negro']='Texto alterado'
    if mutation=='input':audit['input_hash']='different'
    if mutation=='visual':audit['visual_hash']='different'
    if mutation=='empty_visual':rp.save(folder/'visuals.json',{})
    if mutation=='missing_visual':(folder/'visuals.json').unlink()
    if mutation=='visual_approval':audit['visual_review']['approved']=False
    rp.save(source/'audit.json',audit)
    def forbidden(*a,**k):raise AssertionError('El modo solo fotos no debe escribir ni cotejar copy/visual')
    async def no_photos(*a,**k):return {}
    monkeypatch.setattr(rp,'write',forbidden);monkeypatch.setattr(rp,'model_json',forbidden)
    monkeypatch.setattr(rp,'find_relevant_images',no_photos)
    with pytest.raises(ValueError,match='Solo fotos'):
        await rp.pipeline(folder,tmp_path/'out',['negro'],photos_only=True,approved_from=None if mutation=='no_source' else source)


async def test_photos_only_preserves_copy_and_existing_cover(tmp_path,monkeypatch):
    folder,source,facts=approved_fixture(tmp_path,'ia-tiempo')
    original=json.loads((source/'audit.json').read_text())
    image=photo('10')
    cache=LocalImageMediaCache(source/'data')
    data={k:v for k,v in asdict(image).items() if k!='content'}
    cache.put_by_url(image.url,image.content,{**data,'extension':'.jpg'})
    rp.save(source/'photos.json',{facts[0].claim_id:{'fact_hash':rp.digest(vars(facts[0])),'image':data}})
    def forbidden(*a,**k):raise AssertionError('No debe redactar ni cotejar')
    async def find(facts,ctx,cache,*a,existing=None,**kw):
        assert existing[facts[0].claim_id].sha256==image.sha256
        assert cache.get_by_sha256(image.sha256)==image.content
        result={f.claim_id:photo(str(i+10)) for i,f in enumerate(facts)}
        for im in result.values():
            cache.put_by_url(im.url,im.content,{'sha256':im.sha256,'extension':'.jpg'})
        return result
    class ReachedRender(Exception):pass
    async def render(*a,**k):raise ReachedRender()
    monkeypatch.setattr(rp,'write',forbidden);monkeypatch.setattr(rp,'model_json',forbidden)
    monkeypatch.setattr(rp,'find_relevant_images',find);monkeypatch.setattr(rp,'render_async',render)
    out=tmp_path/'out'
    with pytest.raises(ReachedRender):
        await rp.pipeline(folder,out,['negro'],photos_only=True,approved_from=source)
    assert json.loads((source/'audit.json').read_text())==original
    assert json.loads((out/'photos.json').read_text())[facts[0].claim_id]['image']['sha256']==image.sha256
    assert json.loads((out/'usage.json').read_text())==[]
