"""PLAN → redactor real → fotos → JPEG/QC/hojas. No publica ni usa cuentas."""
from __future__ import annotations

import argparse
import asyncio
from dataclasses import asdict, replace
import fcntl
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFont

from src.adapters.data.local_image_media_cache import LocalImageMediaCache
from src.adapters.data.local_image_post_resources import LocalImagePostResources
from .amarillista_media import find_relevant_images
from .copy import build_copy
from .media_sources import SourcedImage
from .image_licensing import accepted_license
from .plan import build_image_plan
from .render import render_async, ImageExportError
from .service import _approved_for_publication, _complete_photo_attribution
from .strategies.amarillista import CONFIG, LEVELS, STRATEGY, pick
from .strategies.amarillista_copy import copy_origin, copies_from_draft, draft_errors, model_json, repair_draft, repair_request, requested_levels, review_errors, review_fields, write
from .strategies.amarillista_visuals import validate_diagram
from .input_check import rule_visual, visual_errors
from .strategies.base import Fact, StrategyContext
from .validate import validate_jpeg, validate_plan

SERVER = Path(__file__).resolve().parents[3]


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def copy_identity(meta, facts, usages, ctx):
    """Las consultas y la política de fotos no invalidan un copy cotejado."""
    return digest({'facts':[vars(f) for f in facts],'usages':usages,'title':meta['title'],
        'category':ctx.category_id,'brand':ctx.brand,'handle':ctx.handle,'voice':ctx.voice,
        'copy_contract':{k:CONFIG[k] for k in ('redactor','titulo','roles','seleccion','limites','cierre')}})


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def read_input(folder):
    """No omitir silenciosamente un dato aprobado sin fuente/rol."""
    meta = json.loads((folder/'post.json').read_text(encoding='utf-8'))
    if not isinstance(meta,dict): raise ValueError('post.json debe ser un objeto JSON')
    for field in ('category_id','title'):
        if not isinstance(meta.get(field),str) or not meta[field].strip():
            raise ValueError(f'post.json: falta {field}')
    if not isinstance(meta.get('sources'),list) or not meta['sources'] or any(not isinstance(u,str) or not u.startswith('https://') for u in meta['sources']):
        raise ValueError('post.json: sources debe listar las fuentes HTTPS exactas')
    if 'editorial_notes' in meta and not isinstance(meta['editorial_notes'],str):
        raise ValueError('post.json.editorial_notes debe ser texto')
    queries=meta.get('media_queries',{})
    if not isinstance(queries,dict) or set(queries)-(set(CONFIG['seleccion']['orden']) | set(CONFIG['hilo']['orden'])):
        raise ValueError('post.json.media_queries debe ser un objeto por rol conocido')
    for role,value in queries.items():
        values=[value] if isinstance(value,str) else value
        if not isinstance(values,list) or not values or any(not isinstance(v,str) or not v.strip() for v in values):
            raise ValueError('post.json.media_queries.'+role+': usa una consulta o lista de consultas no vacías')
    excluded=meta.get('media_exclude',[])
    if not isinstance(excluded,list) or any(not isinstance(v,str) or ':' not in v for v in excluded):
        raise ValueError('post.json.media_exclude debe listar IDs provider:id')
    raw = (folder/'PLAN.md').read_text(encoding='utf-8')
    facts, usages, seen, in_facts = [], {}, set(), False
    for line in raw.splitlines():
        if line.startswith('## '): in_facts = line.startswith('## 3.')
        if not in_facts or not line.lstrip().startswith('|'): continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if not cells or not cells[0].isdigit(): continue
        if len(cells)!=4:
            raise ValueError(f'PLAN hecho {cells[0]}: se requieren cuatro columnas, sin | dentro del texto')
        if not _approved_for_publication(cells[3]): continue
        claim = 'claim_'+cells[0]
        if claim in seen: raise ValueError(f'PLAN: ID duplicado {claim}')
        seen.add(claim)
        urls = re.findall(r'https://[^\s|]+',cells[2])
        roles = re.findall(r'rol=([a-z_]+[0-9]*)\b',cells[3])
        if len(urls)!=1 or urls[0] not in meta['sources']:
            raise ValueError(f'{claim}: dato sin fuente HTTPS exacta en post.json.sources')
        if len(roles)!=1: raise ValueError(f'{claim}: falta un único rol explícito rol=<id>')
        name = cells[2].split('https://')[0].strip(' :')
        if not name or not cells[1]: raise ValueError(f'{claim}: falta hecho o nombre visible de fuente')
        facts.append(Fact(claim,cells[1],urls[0],name,roles[0]))
        usages[claim] = cells[3]
    facts = pick(facts)
    from .strategies import amarillista_hilo as hilo
    if hilo.is_hilo(facts) or 'historia' in meta or meta.get('narrativa') == 'hilo':
        hilo.validate_input(meta, facts)
    return meta, facts, usages, raw


def check_input(folder):
    try:
        meta,facts,_,_ = read_input(folder)
        # Misma categoría y recursos que usará el render, sin red ni modelos.
        LocalImagePostResources(skills_dir=SERVER/'src/skills').get_style(meta['category_id'])
        path=folder/'visuals.json'
        visuals=json.loads(path.read_text()) if path.exists() else {}
        errors=visual_errors(visuals,facts)
        return {'approved':not errors,'input':str(folder),'facts':len(facts),'errors':errors,
            'model_calls':0,'images_generated':0,
            'scope':'Chequeo local de estructura, cifras, umbrales y condiciones explícitas; no certifica fidelidad semántica ni las fuentes externas.'}
    except (ValueError,OSError,KeyError,TypeError) as exc:
        return {'approved':False,'input':str(folder),'errors':[{'field':'entrada','reason':str(exc),
            'fix':'Corrige post.json, PLAN.md o visuals.json según el error.'}], 'model_calls':0,'images_generated':0}


async def recheck_draft(draft, facts, levels, usage, events):
    """Hasta cuatro parches y dos por campo, sin rehacer el borrador."""
    from .trace import emit
    emit("copy", draft=draft)
    errors = draft_errors(draft,facts,levels)
    repair_counts = {}
    for attempt in range(CONFIG['redactor']['max_reparaciones']+1):
        if attempt:
            if any(repair_counts.get(path,0) >= CONFIG['redactor']['max_reparaciones_por_campo'] for path in errors): break
            for path in errors: repair_counts[path] = repair_counts.get(path,0) + 1
            patch=await model_json('copy_repair',CONFIG['redactor']['prompt_reparacion'],
                json.dumps(repair_request(draft,errors,facts,levels),ensure_ascii=False),usage_out=usage)
            events.append({'repair':patch,'rejected_fields':errors,'repair_counts':dict(repair_counts),'usage_count':len(usage)})
            draft=repair_draft(draft,patch,errors)
            errors=draft_errors(draft,facts,levels)
        if not errors:
            fields=review_fields(draft,facts,levels)
            review=await model_json('fact_check',CONFIG['redactor']['prompt_cotejo'],json.dumps({
                'facts':[vars(f) for f in facts],'displayed_fields':fields,
                'reglas_reflexion':next(r for r in CONFIG['roles'] if r['id']=='reflexion')},ensure_ascii=False),usage_out=usage)
            events.append({'review':review})
            errors=review_errors(review,draft,fields)
        if not errors: return draft
        events.append({'rejected_fields':errors})
    raise ValueError('Borrador conservado rechazado tras agotar reparaciones: '+json.dumps(errors,ensure_ascii=False))


def contact_sheet(paths, labels, destination):
    """Máximo cuatro columnas; conserva la lectura de 5–8 láminas en dos filas."""
    columns = min(4,len(paths)); rows = (len(paths)+columns-1)//columns
    sheet = Image.new('RGB',(columns*324,rows*444),'#171717')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(SERVER/'src/skills/image_posts/styles/fonts/inter-400.ttf'),18)
    for i,(path,label) in enumerate(zip(paths,labels)):
        x,y = (i%columns)*324,(i//columns)*444
        with Image.open(path) as im:
            im = im.convert('RGB'); im.thumbnail((324,405))
            sheet.paste(im,(x,y+39))
        draw.text((x+10,y+10),label,fill='white',font=font)
    sheet.save(destination)


def load_photos(path, facts, cache, excluded):
    if not path.exists(): return {}
    by_id = {f.claim_id:f for f in facts}; photos = {}; used_ids = set(); used_hashes = set()
    for claim,entry in json.loads(path.read_text()).items():
        fact = by_id.get(claim)
        if not fact or entry['fact_hash']!=digest(vars(fact)): continue
        data = entry['image']; identity = data['provider']+':'+data['provider_id']
        if identity in excluded: continue
        if not accepted_license(data['license']): continue
        if len(data.get('author','')) > CONFIG['visuales']['max_author_characters']:
            logging.info('image_post_media_cache claim=%s discarded=attribution_too_long_for_slide',claim)
            continue
        if identity in used_ids or data['sha256'] in used_hashes:
            logging.info('image_post_media_cache claim=%s discarded=duplicate_id_or_hash',claim)
            continue
        if re.search(CONFIG['visuales']['rechazar_escena_regex'], data.get('title','')+' '+data.get('description',''), re.I) or (fact.role=='reflexion' and re.search(CONFIG['visuales']['rechazar_reflexion_publica_regex'], data.get('title','')+' '+data.get('description',''), re.I)):
            logging.info('image_post_media_cache claim=%s discarded=degrading_scene',claim)
            continue
        if min(data['width'],data['height']) < CONFIG['visuales']['min_lado_px']: continue
        content = cache.get_by_sha256(data['sha256'])
        if content is None: raise ValueError(f'{claim}: falta foto aprobada en caché; restaurar bytes o usar otra salida')
        with Image.open(io.BytesIO(content)) as image:
            width,height = image.size
        if min(width,height) < CONFIG['visuales']['min_lado_px']:
            logging.info('image_post_media_cache claim=%s discarded=actual_dimensions_too_small',claim)
            continue
        data = {**data,'width':width,'height':height}
        photos[claim] = SourcedImage(**data,content=content)
        used_ids.add(identity); used_hashes.add(data['sha256'])
    return photos


async def pipeline(folder, out, levels, strategy='amarillista', recheck_approved=False, photos_only=False, approved_from=None, solo_texto=False):
    from src.adapters.models.hub import call_log_dir
    from .trace import Trace, current_trace
    trace = Trace(out, {"post_id": out.name, "strategy": strategy, "level": levels})
    trace_token = current_trace.set(trace)
    token = call_log_dir.set(out/'model-calls')
    status, failure = 'completed', None
    try:
        from .strategies import amarillista_hilo as hilo
        meta, facts, _, _ = read_input(folder)
        trace.identity.update(category=meta['category_id'], topic=meta['title'], narrative=meta.get('narrativa', 'factual'),
            template='five_slides', slides=len(facts)+1, primary_source=meta['sources'][0], support_sources=meta['sources'][1:])
        if hilo.is_hilo(facts):
            from .hilo_pipeline import run
            return await run(folder, out, levels, solo_texto=solo_texto,
                recheck_approved=recheck_approved, photos_only=photos_only, approved_from=approved_from)
        if solo_texto: raise ValueError('--solo-texto requiere la entrada narrativa hilo; ver AMARILLISTA.md')
        return await _pipeline(folder, out, levels, strategy, recheck_approved, photos_only, approved_from)
    except BaseException as exc:
        status, failure = 'failed', str(exc)
        raise
    finally:
        try:
            trace.consolidate(status, failure)
        finally:
            current_trace.reset(trace_token)
            call_log_dir.reset(token)


async def _pipeline(folder, out, levels, strategy='amarillista', recheck_approved=False, photos_only=False, approved_from=None):
    if strategy != STRATEGY.id: raise ValueError('Este comando implementa --strategy amarillista')
    if approved_from and not photos_only: raise ValueError('--reuse-approved requiere --photos-only')
    if photos_only and recheck_approved: raise ValueError('--photos-only no permite recotejar o reparar copy')
    levels = requested_levels(levels)
    meta,facts,usages,plan_text = read_input(folder)
    style = LocalImagePostResources(skills_dir=SERVER/'src/skills').get_style(meta['category_id'])
    ctx = StrategyContext(meta['category_id'],meta['title'],meta['title'],style.brand['handle'],style.brand['name'],
        str(style.tone.get('voice',''))+'\nNotas editoriales: '+str(meta.get('editorial_notes','')),levels[0])
    identity = copy_identity(meta,facts,usages,ctx)
    out.mkdir(parents=True,exist_ok=True)
    cache = LocalImageMediaCache(out/'data')
    audit_path = out/'audit.json'
    usage = json.loads((out/'usage.json').read_text()) if (out/'usage.json').exists() else []
    from .trace import Events, now as trace_now
    events = Events("copy")
    save(out/'input.json',{'post':meta,'facts':[vars(f) for f in facts],'contract_version':CONFIG['version']})
    (out/'PLAN.md').write_text(plan_text,encoding='utf-8')
    try:
        if (out/'failure.json').exists():
            failure = json.loads((out/'failure.json').read_text())
            if failure.get('copy_failed') and failure.get('input_hash')==identity and failure.get('validated_levels')==levels and not recheck_approved:
                raise ValueError('El redactor ya agotó borrador y reparaciones permitidas para estos niveles; corregir PLAN/post.json según failure.json')
        audit = json.loads(audit_path.read_text()) if audit_path.exists() else {}
        if approved_from:
            source_audit = json.loads((approved_from/'audit.json').read_text())
            if source_audit.get('approved') is not True or source_audit.get('input_hash')!=identity:
                raise ValueError('Solo fotos: la entrada/contrato no coincide con el copy aprobado de origen')
            if source_audit.get('draft_hash')!=digest(source_audit.get('draft')):
                raise ValueError('Solo fotos: borrador de origen alterado')
            copies_from_draft(source_audit['draft'],facts,ctx,levels=levels)
            if not set(levels) <= set(source_audit.get('validated_levels', LEVELS)):
                raise ValueError('Solo fotos: los niveles pedidos no están cotejados; usa producción normal')
            audit = source_audit
            audit['photo_refresh']={'source':str(approved_from.resolve()),'draft_hash':audit['draft_hash']}
        if photos_only:
            if audit.get('approved') is not True or audit.get('input_hash')!=identity:
                raise ValueError('Solo fotos requiere un borrador aprobado para la misma entrada y contrato')
            if audit.get('draft_hash')!=digest(audit.get('draft')):
                raise ValueError('Solo fotos: borrador aceptado alterado')
            audit['render_mode']='photos_only'
            # Conservar evidencia del copy aun si fotos/QC fallan después.
            save(audit_path,audit)
        needs_level_review = (audit.get('approved') is True and audit.get('input_hash') == identity
            and not set(levels) <= set(audit.get('validated_levels', LEVELS)))
        if (recheck_approved and audit.get('approved') is True and audit.get('input_hash')!=identity) or needs_level_review:
            if photos_only: raise ValueError('Solo fotos: nivel no cotejado; usa producción normal')
            draft = audit['draft']
            if audit.get('draft_hash')!=digest(draft): raise ValueError('Borrador aceptado alterado')
            recheck_events = Events("copy")
            try:
                draft = await recheck_draft(draft, facts, levels, usage, recheck_events)
            finally:
                save(out/'recheck-attempts.json',recheck_events)
            audit.setdefault('rechecks',[]).append({'previous_input_hash':audit['input_hash'], 'validated_levels':levels})
            audit.setdefault('recheck_events',[]).extend(recheck_events)
            audit['draft']=draft; audit['draft_hash']=digest(draft)
            audit['validated_levels']=levels
            audit['copy_sources']={f.claim_id:copy_origin(usage)+' + recotejo/reparación acotada' for f in facts}
            audit['input_hash']=identity; save(audit_path,audit)
        if audit.get('input_hash')==identity and audit.get('approved') is True:
            draft = audit['draft']
            if audit.get('draft_hash')!=digest(draft):
                raise ValueError('Borrador aceptado alterado: corregir la entrada y volver a redactar, no editar audit.json')
            copies = copies_from_draft(draft,facts,ctx,copy_origin(usage),levels=levels)
        else:
            try:
                copies,_,_ = await write(STRATEGY,facts,ctx,usage_out=usage,audit_out=events,levels=levels)
            except Exception:
                save(out/'copy-attempts.json',events)
                save(audit_path,{'input_hash':identity,'approved':False,'events':events})
                save(out/'failure.json',{'input_hash':identity,'copy_failed':True,'validated_levels':levels,'message':'Redactor real rechazado; ver copy-attempts.json y execution.log'})
                raise
            draft = next(e['draft'] for e in reversed(events) if e.get('accepted'))
            audit = {'input_hash':identity,'approved':True,'draft':draft,'draft_hash':digest(draft),'events':events,
                'copy_sources':{key:value.source for key,value in copies.items()},'validated_levels':levels}
            save(audit_path,audit)
        visuals_path = folder/'visuals.json'
        original_visuals = json.loads(visuals_path.read_text()) if visuals_path.exists() else {}
        visual_hash = digest({'facts':[vars(f) for f in facts],'visuals':original_visuals}) if original_visuals else None
        if photos_only:
            if (original_visuals and (audit.get('visual_hash')!=visual_hash or audit.get('visual_review',{}).get('approved') is not True)) or (not original_visuals and audit.get('visual_hash')):
                raise ValueError('Solo fotos: visual de respaldo cambiado, eliminado o sin aprobación; usa producción normal')
            visuals = audit.get('effective_visuals',original_visuals)
        else:
            input_issues = visual_errors(original_visuals, facts)
            rejected = {e.get('claim_id') for e in input_issues}
            visuals = {k:v for k,v in original_visuals.items() if k not in rejected and k in {f.claim_id for f in facts}} if isinstance(original_visuals,dict) else {}
            warnings = list(audit.get('visual_warnings',input_issues)) if audit.get('visual_hash')==visual_hash else list(input_issues)
            if visuals and audit.get('visual_hash')!=visual_hash:
                try:
                    review = await model_json('visual_check',CONFIG['visuales']['prompt_cotejo_visual'],
                        json.dumps({'facts':[vars(f) for f in facts],'visuals':visuals},ensure_ascii=False),usage_out=usage)
                except Exception as exc:
                    review = {'approved':False,'reason':'Cotejo de visual no disponible: '+type(exc).__name__,'rejected_fields':{}}
                audit['original_visual_review']=review
                if review.get('approved') is not True or not review.get('reason') or review.get('rejected_fields'):
                    rejected_fields = review.get('rejected_fields') or {}
                    rejected_claims = {str(path).split('.')[0] for path in rejected_fields}
                    if not rejected_claims or not rejected_claims <= set(visuals): rejected_claims = set(visuals)
                    for claim in rejected_claims:
                        warnings.append({'field':'visuals.'+claim,'claim_id':claim,
                            'reason':review.get('reason','sin cotejo'), 'rejected_fields':rejected_fields,
                            'action':'rule_visual_fallback'})
                        visuals.pop(claim,None)
                audit['visual_review']={'approved':True,'reason':'Visuales efectivos: propios cotejados y fallback literal por reglas; ver avisos','rejected_fields':{}}
            elif visuals:
                visuals = audit.get('effective_visuals',visuals)
            for warning in warnings:
                logging.warning('image_post_visual_fallback %s',json.dumps(warning,ensure_ascii=False))
            audit['visual_warnings']=warnings
            audit['effective_visuals']=visuals
            audit['visual_hash']=visual_hash
            audit.setdefault('visual_review',{'approved':True,'reason':'Solo visual por reglas del hecho','rejected_fields':{}})
            save(audit_path,audit)
            save(out/'input-check.json',{'approved':not input_issues,'errors':input_issues,'scope':'local; sin cotejo semántico'})
        print('Redacción real aceptada; buscando o conservando fotos por rol.',flush=True)
        excluded = set(meta.get('media_exclude',[]))
        photos = load_photos(out/'photos.json',facts,cache,excluded)
        if approved_from and approved_from.resolve()!=out.resolve():
            original_photos = load_photos(approved_from/'photos.json',facts,LocalImageMediaCache(approved_from/'data'),excluded)
            for claim,image in original_photos.items():
                if claim in photos or any(p.sha256==image.sha256 or (p.provider,p.provider_id)==(image.provider,image.provider_id) for p in photos.values()): continue
                with Image.open(io.BytesIO(image.content)) as actual:
                    extension={"JPEG":".jpg","PNG":".png","WEBP":".webp","GIF":".gif","TIFF":".tiff","BMP":".bmp"}[actual.format]
                cache.put_by_url(image.thumburl or image.url,image.content,{**{k:v for k,v in asdict(image).items() if k!='content'},'extension':extension})
                photos[claim]=image
        briefs = {f.claim_id:{'query':meta.get('media_queries',{}).get(f.role,copies[f.claim_id].image_query),'role':f.role} for f in facts}
        photo_decisions=[]
        try:
            photos = await find_relevant_images(facts,ctx,cache,{'media_briefs':json.dumps(briefs),'media_exclude':list(excluded)},usage_out=usage,existing=photos,decisions_out=photo_decisions)
        finally:
            save(out/'photo-decisions.json',photo_decisions)
        save(out/'photos.json',{claim:{'fact_hash':digest(vars(next(f for f in facts if f.claim_id==claim))),
            'image':{k:v for k,v in asdict(image).items() if k!='content'}} for claim,image in photos.items()})
        for fact in facts:
            copies[fact.claim_id]=replace(copies[fact.claim_id],diagram=visuals.get(fact.claim_id) or rule_visual(fact))
            if fact.claim_id not in photos and copies[fact.claim_id].diagram['kind'] not in CONFIG['visuales']['fallback_permitidos']:
                raise ValueError(f'{fact.claim_id} ({fact.role}): sin foto ni visual informativo; ajustar post.json.media_queries o agregar comparación/línea de tiempo con fuente en visuals.json')
        qc = {}
        for level in levels:  # siempre secuencial; un solo Playwright
            while True:
                slides = STRATEGY.build(facts,replace(ctx,level=level),copies,photos)
                _complete_photo_attribution(slides,list(photos.values()),'recortada y convertida a B/N' if 'grayscale' in style.composition.get('photo_filter','') else 'recortada y ajustada')
                for slide in slides:
                    for claim in slide['claim_refs']: claim['locator']+='; '+usages[claim['id']]
                plan = build_image_plan(category_id=ctx.category_id,source_video_id=folder.name,source_revision=identity,
                    template_id=CONFIG['predeterminado']['template_id'],slides=slides,style=style,seed=0)
                media = {ref.asset_id:cache.get_by_sha256(ref.sha256) for sl in plan.slides for ref in sl.media}
                validate_plan(plan,style,media_bytes=media).require()
                target = out/level; target.mkdir(exist_ok=True)
                save(target/'plan.json',plan.to_dict())
                publish = {'schema_version':2,'titles':{'facebook':{'title':draft['titles'][level]}},
                    'description':{'question':draft['questions'][level]},'sources':meta['sources']}
                save(out/f'caption-{level}.json',build_copy(plan,publish).to_dict())
                os.environ['IMAGE_QC_DEBUG_DIR']=str(out/'debug'/level)
                print(f'Render {level}: {len(slides)} láminas.',flush=True)
                try:
                    result = await render_async(plan,style,media)
                    break
                except ImageExportError as exc:
                    info = getattr(exc,'qc',{}).get('shortening')
                    slide_id = getattr(exc,'slide_id','')
                    if photos_only or not info or not getattr(exc,'qc',{}).get('overflow'):
                        raise
                    index = next((i for i,sl in enumerate(plan.slides) if sl.slide_id == slide_id),None)
                    if index is None or index >= len(facts): raise
                    fact = facts[index]
                    path = 'reflections.'+level if fact.role == 'reflexion' else 'items.'+fact.claim_id+'.body'
                    previous = [e for e in audit.get('events',[]) if e.get('repair')]
                    previous += [e for e in audit.get('recheck_events',[]) if e.get('repair')]
                    previous += [e for e in audit.get('composition_repairs',[]) if e.get('repair')]
                    if len(previous) >= CONFIG['redactor']['max_reparaciones'] or sum(path in e.get('rejected_fields',{}) for e in previous) >= CONFIG['redactor']['max_reparaciones_por_campo']:
                        raise ValueError('Presupuesto de reparación agotado para '+path) from exc
                    limit = info['max_chars']
                    errors = {path:f'Desborde medido en {slide_id}: acorta a {limit} caracteres como máximo; conserva el sentido y la evidencia.'}
                    request = repair_request(draft,errors,facts,levels)
                    request['field_evidence'][path]['max_characters_measured'] = limit
                    patch = await model_json('copy_repair',CONFIG['redactor']['prompt_reparacion'],json.dumps(request,ensure_ascii=False),usage_out=usage)
                    event = {'at':trace_now(),'repair':patch,'rejected_fields':errors,'measurement':info,'slide_id':slide_id,'usage_count':len(usage)}
                    audit.setdefault('composition_repairs',[]).append(event); save(audit_path,audit)
                    candidate = repair_draft(draft,patch,errors)
                    from .strategies.amarillista_copy import draft_fields
                    value = draft_fields(candidate).get(path,'')
                    if not value or len(value)>limit: raise ValueError('Reparación de composición no respeta límite medido') from exc
                    local = draft_errors(candidate,facts,levels)
                    if local: raise ValueError('Reparación de composición inválida: '+json.dumps(local,ensure_ascii=False)) from exc
                    fields = review_fields(candidate,facts,levels)
                    review = await model_json('fact_check',CONFIG['redactor']['prompt_cotejo'],json.dumps({'facts':[vars(f) for f in facts],'displayed_fields':fields,'reglas_reflexion':next(r for r in CONFIG['roles'] if r['id']=='reflexion')},ensure_ascii=False),usage_out=usage)
                    event['review'] = review; save(audit_path,audit)
                    errors = review_errors(review,candidate,fields)
                    if errors: raise ValueError('Reparación de composición rechazada: '+json.dumps(errors,ensure_ascii=False)) from exc
                    draft = candidate
                    audit['draft']=draft; audit['draft_hash']=digest(draft); save(audit_path,audit)
                    copies = copies_from_draft(draft,facts,ctx,copy_origin(usage),levels=levels)
                    for f in facts: copies[f.claim_id]=replace(copies[f.claim_id],diagram=visuals.get(f.claim_id) or rule_visual(f))
            records = []
            for i,asset in enumerate(result.assets,1):
                validate_jpeg(asset.content,style,qc=asset.qc).require()
                (target/f'{i:02}.jpg').write_bytes(asset.content)
                records.append({**asset.to_record(),'qc':asset.qc})
            qc[level]=records; save(out/'qc.json',qc)
            contact_sheet([target/f'{i:02}.jpg' for i in range(1,len(slides)+1)],
                [f.role.upper() for f in facts]+['CIERRE'],out/f'contactos-{level}.png')
        contact_sheet([out/level/'01.jpg' for level in levels],levels,out/'contactos-niveles.png')
        audit['validated_levels']=levels
        audit['omitted_unvalidated_levels']=[level for level in LEVELS if level not in levels]
        audit['comparison_policy']='Solo niveles pedidos y validados; se omiten los otros'
        audit['levels']=levels; audit['slides']=len(facts)+1; save(audit_path,audit)
        (out/'failure.json').unlink(missing_ok=True)
        print(f'OK: {out} · JPEG, QC y hojas de contactos. Sin publicación.',flush=True)
    finally:
        save(out/'usage.json',usage)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path,help='Carpeta con PLAN.md y post.json')
    parser.add_argument('--out',type=Path,help='Obligatorio para render, no para --check-input')
    parser.add_argument('--check-input',action='store_true',help='Valida entrada y visuales localmente; sin imágenes, red ni modelos. JSON; salida 1 si hay errores')
    parser.add_argument('--solo-texto',action='store_true',help='Redactor real + cotejo de una historia; escribe texto.md sin fotos ni render')
    parser.add_argument('--strategy',choices=['amarillista'],default='amarillista')
    parser.add_argument('--level',choices=list(LEVELS)+['all'],default=CONFIG['predeterminado']['level'])
    parser.add_argument('--levels',nargs='+',choices=list(LEVELS),help='Renderizar varios niveles con el mismo borrador y fotos')
    parser.add_argument('--recheck-approved',action='store_true',help='Cotejar de nuevo el borrador real guardado si cambió la entrada o contrato; no genera otro')
    parser.add_argument('--photos-only',action='store_true',help='Solo fotos/render: exige copy y visuales ya aprobados; nunca redacta, repara ni coteja')
    parser.add_argument('--reuse-approved',type=Path,help='Salida aprobada de origen; conserva copy y fotos válidas en una salida nueva, requiere --photos-only')
    args = parser.parse_args(argv)
    if hasattr(os,'nice'): os.nice(max(0,10-os.nice(0)))
    if args.check_input:
        report = check_input(args.input.resolve())
        print(json.dumps(report,ensure_ascii=False,indent=2))
        if not report['approved']: raise SystemExit(1)
        return
    if not args.out: parser.error('--out es obligatorio para render')
    if args.level == 'all' and args.levels: parser.error('--level all no se combina con --levels')
    if args.solo_texto and (args.photos_only or args.reuse_approved): parser.error('--solo-texto no se combina con opciones de fotos')
    if args.solo_texto and (args.level == 'all' or (args.levels and len(set(args.levels)) != 1)):
        parser.error('--solo-texto escribe un nivel por salida; elige --level')
    out=args.out.resolve(); out.mkdir(parents=True,exist_ok=True)
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s',handlers=[logging.FileHandler(out/'execution.log')])
    logging.getLogger('httpx').setLevel(logging.WARNING); logging.getLogger('httpcore').setLevel(logging.WARNING)
    logging.getLogger('google_genai').setLevel(logging.WARNING)
    if hasattr(os,'nice'): os.nice(max(0,10-os.nice(0)))
    # Una segunda ejecución sale inmediatamente: no esperas ni polling.
    with Path('/tmp/nexa-amarillista-render.lock').open('a') as lock:
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            asyncio.run(pipeline(args.input.resolve(),out,list(LEVELS) if args.level=='all' else list(dict.fromkeys(args.levels or [args.level])),args.strategy,args.recheck_approved,args.photos_only,args.reuse_approved.resolve() if args.reuse_approved else None,args.solo_texto))
        except Exception as exc:
            message = str(exc) if isinstance(exc,(ValueError,OSError,ImageExportError)) else type(exc).__name__
            logging.exception('image_post_pipeline_failed')
            if isinstance(exc,BlockingIOError): message='Ya hay una ejecución de render_post activa; ejecutar Playwright de a uno'
            failure = json.loads((out/'failure.json').read_text()) if (out/'failure.json').exists() else {}
            save(out/'failure.json',{**failure,'error':message})
            print('ERROR: '+message,flush=True)
            raise SystemExit(1) from None


if __name__=='__main__': main()
