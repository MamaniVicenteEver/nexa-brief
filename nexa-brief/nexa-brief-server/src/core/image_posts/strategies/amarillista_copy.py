"""Redacción conjunta y cotejo semántico de amarillista; no afecta otras estrategias."""
from __future__ import annotations
import json
import logging
import os
import re
import unicodedata
from .base import Copy, numbers_in, extract_stat

log = logging.getLogger(__name__)

_NUMBER_LITERAL = re.compile(r"\d+(?:[.,]\d+|\s\d{3}(?!\d))*")
_SOURCE_YEAR = re.compile(r"(?<!\d)(?:18|19|20|21)\d{2}(?!\d)")


def _source_years(fact):
    """Años explícitos de la fuente vinculada a este claim, nunca de otros claims."""
    metadata = (getattr(fact, 'url', ''), getattr(fact, 'source_name', ''),
        getattr(fact, 'date', ''), getattr(fact, 'source_date', ''))
    return {year for value in metadata if isinstance(value, str) for year in _SOURCE_YEAR.findall(value)}


def _allowed_numbers(facts):
    allowed = set()
    for fact in facts:
        allowed.update(numbers_in(fact.text))
        # read_input exige que cada URL del hecho esté también en post.json.sources;
        # por eso un año extraído de fact.url sigue perteneciendo a ese mismo hecho.
        allowed.update(_source_years(fact))
    return allowed


def _foreign_number_error(value, path, allowed, scope):
    seen, literals = set(), []
    for match in _NUMBER_LITERAL.finditer(value):
        number = re.sub(r'[.,\s]', '', match.group(0))
        if number not in allowed and number not in seen:
            seen.add(number)
            literals.append(match.group(0))
    if not literals:
        return None
    quoted = ', '.join(f'"{literal}"' for literal in literals)
    return f'Quita {quoted} de {path}: no está en {scope}.'


def title_key(value):
    value = unicodedata.normalize('NFKD', value.casefold())
    value = ''.join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r'^(alerta|atencion|dato)\s*:\s*', '', value)
    return ''.join(c for c in value if c.isalnum())


def requested_levels(levels=None):
    from .amarillista import LEVELS
    selected = list(LEVELS) if levels is None or levels == "all" else list(dict.fromkeys(levels))
    if not selected or set(selected) - set(LEVELS):
        raise ValueError("Niveles pedidos inválidos")
    return selected


def validate_titles(titles, levels=None):
    from .amarillista import LEVELS, CONFIG
    levels = requested_levels(levels)
    if not isinstance(titles, dict) or not set(levels) <= set(titles):
        raise ValueError('Faltan titulares de los niveles pedidos')
    for level in levels:
        value = titles[level]
        if not isinstance(value, str) or not value.strip() or len(unicodedata.normalize('NFC', value)) > CONFIG['titulo']['max_caracteres_unicode_nfc'] or len(value.split()) > CONFIG['titulo']['max_palabras']:
            raise ValueError(f'Titular {level} supera 8 palabras/60 caracteres o está vacío')
        if any(p.casefold() in value.casefold() for p in CONFIG['controles']['frases_prohibidas']):
            raise ValueError('Titular con engagement bait')
    if len({title_key(titles[level]) for level in levels}) != len(levels):
        raise ValueError('Niveles iguales: mayúsculas, signos y prefijos no crean otro titular')
    return titles


async def model_json(role, system, prompt, ai=None, usage_out=None, schema=None):
    if ai is not None:
        return await ai.complete_json(system, prompt)
    from .amarillista import CONFIG
    from src.adapters.models.hub import text_json_with_usage
    hub_role = CONFIG['redactor']['roles_hub']['fact_check' if role == 'visual_check' else role]
    from ..trace import model_step
    token = model_step.set(role)
    try:
        result, usage = await text_json_with_usage(hub_role, system, prompt, structured=True,
            schema=schema or CONFIG['redactor']['schemas'].get('fact_check' if role == 'visual_check' else role), usage_out=usage_out)
    finally:
        model_step.reset(token)
    if role == 'fact_check' and schema is None and isinstance(result.get('rejected_fields'), list):
        entries = result['rejected_fields']
        if len({e['path'] for e in entries}) != len(entries):
            raise ValueError('cotejo con rutas duplicadas')
        result = {**result, 'rejected_fields':{e['path']:e['reason'] for e in entries}}
    return result


def copy_origin(usage):
    calls = [u for u in (usage or []) if u.get('role')=='image_copy' and u.get('status')=='ok']
    providers = list(dict.fromkeys(u['provider'] for u in calls))
    return 'modelo: ' + (' + '.join(providers) if providers else 'runner inyectado') + ' JSON + cotejo por campo'


def diagram_for(fact):
    """Visual de datos determinista: valores literales, sin estimar fracciones."""
    match = re.search(r'(\d+(?:,\d+)?)\s*%', fact.text)
    if match:
        relative = re.search(r'%\s*(más|menos)|(?:aument|reduj|reduc|aceler|ralent|increment|disminu)\w*[^.;]{0,70}\d+(?:,\d+)?\s*%', fact.text,re.I)
        if relative:
            return {'kind':'quantity','value':match[1],'unit':'% de variación',
                'label':fact.text,'claim_ids':[fact.claim_id]}
        return {'kind': 'percent', 'value': float(match[1].replace(',', '.')), 'label': 'De cada 100', 'claim_ids': [fact.claim_id]}
    if 'casi dos tercios' in fact.text.casefold():
        return {'kind':'fraction','numerator':2,'denominator':3,'approximate':True,
            'label':'Aún sin escalar la IA en toda la organización', 'claim_ids':[fact.claim_id]}
    if 'filtraciones antes de romperse' in fact.text:
        return {'kind':'timeline','label':'La señal estaba antes', 'items':[
            {'label':'Antes','detail':'El tanque presentaba filtraciones'},
            {'label':'Después','detail':'El tanque se rompió'}], 'claim_ids':[fact.claim_id]}
    volume = re.search(r'(\d+(?:,\d+)?) millones de galones', fact.text)
    if volume:
        return {'kind':'quantity','value':volume[1], 'unit':'millones de galones',
            'label':'Volumen liberado', 'claim_ids':[fact.claim_id]}
    date = re.search(r'\b\d{1,2} de [a-z]+ de \d{4}\b',fact.text)
    if date:
        return {'kind':'timeline','label':'La fecha documentada','items':[
            {'label':date.group(),'detail':fact.text}], 'claim_ids':[fact.claim_id]}
    # Una tarjeta de evidencia tipográfica tiene un extracto real y lectura visual;
    # nunca una hoja vacía con un icono. El modelo puede proponer una secuencia mejor.
    return {'kind': 'evidence', 'label': 'El hecho documentado', 'items': [fact.text], 'claim_ids': [fact.claim_id]}


def validate_reflection(value, level):
    from .amarillista import role_config
    cfg = role_config('reflexion')
    if not isinstance(value, str) or not value.strip():
        raise ValueError('reflexion vacía')
    if len(value.split()) > cfg['max_palabras'] or len(value) > cfg['max_caracteres']:
        raise ValueError('reflexion supera límite de palabras/caracteres')
    sentences = re.findall(r'[^.!?]+[.!?]?', value.strip('¿¡'))
    if len([s for s in sentences if s.strip()]) > cfg['max_frases']:
        raise ValueError('reflexion debe ser una frase')
    for pattern in cfg['prohibiciones_regex']:
        if re.search(pattern, value, re.I):
            raise ValueError('reflexion: exageración médica, diagnóstico o certeza no permitidos')
    tone = cfg['niveles'][level]
    if tone.get('segunda_persona_regex') and not re.search(tone['segunda_persona_regex'], value, re.I):
        raise ValueError('reflexion negro requiere segunda persona')
    if tone.get('tono_regex') and not re.search(tone['tono_regex'], value, re.I):
        raise ValueError(f'reflexion {level}: {tone["regla"]} Debe usar un marcador de tono de esta expresión: {tone["tono_regex"]}')
    return value


def validate_reflections(values, levels=None):
    from .amarillista import LEVELS
    levels = requested_levels(levels)
    if not isinstance(values, dict) or not set(levels) <= set(values):
        raise ValueError('reflexion requiere los niveles pedidos')
    for level in levels: validate_reflection(values[level], level)
    if len({title_key(values[level]) for level in levels}) != len(levels):
        raise ValueError('reflexion: el tono debe cambiar por nivel')
    return values


def draft_errors(raw, facts, levels=None):
    """Todos los rechazos concretos juntos; un campo malo no borra los válidos."""
    from .amarillista import CONFIG, LEVELS
    levels = requested_levels(levels)
    errors = {}
    if not isinstance(raw, dict): return {'$': 'respuesta debe ser objeto JSON'}
    titles = raw.get('titles')
    if not isinstance(titles, dict): titles = {}
    for level in levels:
        value = titles.get(level)
        if not isinstance(value,str) or not value.strip() or len(unicodedata.normalize('NFC',value)) > CONFIG['titulo']['max_caracteres_unicode_nfc'] or len(value.split()) > CONFIG['titulo']['max_palabras']:
            errors['titles.'+level] = 'máximo 8 palabras y 60 caracteres, texto no vacío; apuntar a 4–6 palabras'
    for level, value in ((k, titles.get(k)) for k in levels):
        if level not in levels:
            errors['$'] = 'titles contiene nivel desconocido'
        elif isinstance(value,str) and any(other != level and isinstance(text,str) and title_key(value)==title_key(text) for other,text in titles.items() if other in levels):
            errors['titles.'+level] = 'nivel igual a otro: cambiar persona/verbo/foco, no solo signos o mayúsculas'
    cover_facts = [f for f in facts if f.role in ('portada','prueba')]
    cover_numbers = _allowed_numbers(cover_facts)
    for level, title in ((k, titles.get(k)) for k in levels):
        if isinstance(title, str):
            if level in ('alto','negro') and re.search(CONFIG['titulo']['titular_instrumental_regex'], title, re.I):
                errors['titles.'+level] = 'Titular instrumental débil: crea curiosidad o tensión con el sujeto y el conflicto del hecho; no describas la escala, encuesta o instrumento.'
            proof_stat = extract_stat(next(f.text for f in facts if f.role=='prueba'))
            if proof_stat and numbers_in(proof_stat) & numbers_in(title):
                key='titles.'+level
                message=f'La cifra {proof_stat} se reserva a la prueba: quítala del titular y expresa el conflicto sin repetirla.'
                errors[key] = errors[key]+' '+message if key in errors else message
            number_error = _foreign_number_error(title,'titles.'+level,cover_numbers,'los hechos de portada/prueba')
            if number_error:
                key='titles.'+level
                errors[key] = errors[key]+' '+number_error if key in errors else number_error
    qualifier = raw.get('qualifier')
    if not isinstance(qualifier, str) or not qualifier.strip() or len(qualifier) > CONFIG['limites']['qualifier_caracteres']:
        errors['qualifier'] = 'alcance ausente o excede límite'
    elif (number_error := _foreign_number_error(qualifier,'qualifier',cover_numbers,'los hechos de portada/prueba')):
        errors['qualifier'] = number_error
    questions = raw.get('questions') or {}
    for level in levels:
        question = questions.get(level) if isinstance(questions,dict) else None
        if not isinstance(question,str) or not question.startswith('¿') or not question.endswith('?') or len(question.split()) > CONFIG['cierre']['pregunta_max_palabras']:
            errors['questions.'+level] = 'pregunta abierta del tema: máximo 8 palabras'
    if isinstance(questions,dict) and all(k in questions for k in levels) and len({title_key(str(questions[k])) for k in levels}) != len(levels):
        errors.update({'questions.'+level:'preguntas distintas por nivel' for level in levels})
    reflections = raw.get('reflections') or {}
    reflection_fact = next(f for f in facts if f.role=='reflexion')
    reflection_numbers = _allowed_numbers([reflection_fact])
    for level in levels:
        try:
            value = reflections.get(level) if isinstance(reflections,dict) else None
            validate_reflection(value, level)
            number_error = _foreign_number_error(value,'reflections.'+level,reflection_numbers,'el hecho de reflexión')
            if number_error: errors['reflections.'+level] = number_error
        except ValueError as exc: errors['reflections.'+level] = str(exc)
    if isinstance(reflections,dict) and all(k in reflections for k in levels) and len({title_key(str(reflections[k])) for k in levels}) != len(levels):
        errors.update({'reflections.'+level:'reflexiones distintas por nivel' for level in levels})
    raw_items = raw.get('items') or []
    if not isinstance(raw_items,list): return {**errors,'items':'items debe ser lista'}
    items = {x.get('claim_id'):x for x in raw_items if isinstance(x,dict)}
    if len(raw_items) != len(items) or len(items) != len(facts) or set(items) != {f.claim_id for f in facts}:
        errors['items'] = 'un item por claim_id, sin duplicados ni ausentes'
    for fact in facts:
        item = items.get(fact.claim_id, {})
        if fact.role not in ('portada','reflexion'):
            body = item.get('body')
            key = 'items.'+fact.claim_id+'.body'
            if item.get('literal'):
                if not isinstance(body,str) or len(body) > CONFIG['limites']['body_literal_caracteres']:
                    errors[key] = 'body literal supera límite'
            elif not isinstance(body,str) or not body.strip() or len(body)>CONFIG['limites']['body_caracteres']:
                errors[key] = 'body ausente o supera límite'
            elif (number_error := _foreign_number_error(body,key,_allowed_numbers([fact]),'el hecho')):
                errors[key] = number_error
            elif fact.role == 'giro' and not body.casefold().startswith('sin embargo'):
                errors[key] = 'giro debe comenzar Sin embargo'
            elif fact.role in ('prueba','segunda_prueba') and extract_stat(fact.text) and extract_stat(fact.text).casefold() in body.casefold():
                errors[key] = f"La cifra {extract_stat(fact.text)!r} YA se dibuja por separado. Quitar esa cifra de body; escribe solo población, fecha y definición."
        query = item.get('image_query')
        if not isinstance(query,str) or not CONFIG['limites']['image_query_palabras_min'] <= len(query.split()) <= CONFIG['limites']['image_query_palabras_max']:
            errors['items.'+fact.claim_id+'.image_query'] = 'concepto visual concreto en inglés, 2–6 palabras'
    # Bait applies to every displayed field, including questions/reflections.
    for path, value in draft_fields(raw).items():
        if path.split('.')[0] in ('titles','questions','reflections') and path.split('.')[1] not in levels:
            continue
        if isinstance(value,str) and any(title_key(p) in title_key(value) for p in CONFIG['controles']['frases_prohibidas']):
            errors[path] = 'engagement bait prohibido'
    return errors


def draft_fields(raw):
    fields = {'qualifier':raw.get('qualifier')}
    for section in ('titles','questions','reflections'):
        values = raw.get(section)
        if isinstance(values,dict): fields.update({section+'.'+k:v for k,v in values.items()})
    for item in (raw.get('items') or []) if isinstance(raw.get('items'),list) else []:
        if isinstance(item,dict):
            for key in ('body','image_query'): fields['items.'+str(item.get('claim_id'))+'.'+key] = item.get(key)
    return fields


def repair_draft(raw, patch, errors):
    import copy
    result = copy.deepcopy(raw)
    changes = patch.get('changes') if isinstance(patch,dict) else None
    if not isinstance(changes,list): raise ValueError('Reparación sin changes')
    seen = set()
    for change in changes:
        if not isinstance(change,dict): raise ValueError('Reparación: cada cambio debe ser objeto')
        path, value = normalize_path(change.get('path'),raw), change.get('value')
        if path not in errors:
            log.info('image_post_copy_repair_ignored path=%s motivo=campo no rechazado; se conserva original',path)
            continue
        if path == 'items' and isinstance(value,list) and path not in seen:
            # Reparar estructura sin reemplazar texto ya aceptado: añadir items
            # ausentes, quitar duplicados y aplicar solo subcampos rechazados.
            merged = {x['claim_id']:x for x in result.get('items',[]) if isinstance(x,dict) and isinstance(x.get('claim_id'),str)}
            for item in value:
                if not isinstance(item,dict) or not isinstance(item.get('claim_id'),str):
                    raise ValueError('Reparación de items sin claim_id')
                claim = item['claim_id']
                if claim not in merged:
                    merged[claim] = item
                else:
                    for field in ('body','image_query'):
                        if f'items.{claim}.{field}' in errors and field in item:
                            merged[claim][field] = item[field]
            result['items'] = list(merged.values())
            seen.add(path)
            continue
        if path in seen or not isinstance(value,str):
            raise ValueError('Reparación intenta cambiar un campo duplicado o no textual')
        seen.add(path); parts = path.split('.')
        if len(parts)==1 and path == 'qualifier': result[path] = value
        elif len(parts)==2 and parts[0] in ('titles','questions','reflections'):
            result.setdefault(parts[0],{})[parts[1]] = value
        elif len(parts)==3 and parts[0]=='items' and parts[2] in ('body','image_query'):
            next(x for x in result['items'] if x['claim_id']==parts[1])[parts[2]] = value
        else: raise ValueError('Ruta no reparable; requiere nuevo material')
    return result


def rules_copy(facts, strategy, reason):
    # Una reflexión personal no es deducible por una plantilla genérica ni por
    # truncar un dato médico. Exigir la evidencia y la redacción revisada.
    raise ValueError('Redactor amarillista no aceptado; no se construye reflexión por reglas: '+reason)


def rules_result(facts, strategy, reason):
    return rules_copy(facts, strategy, reason), '', {}


def review_fields(raw, facts, levels=None):
    """Solo campos que se muestran, vinculados con SU evidencia; no cuerpos ocultos."""
    fields = {}
    cover_refs = [f.claim_id for f in facts if f.role in ('portada','prueba')]
    reflection_ref = next(f.claim_id for f in facts if f.role=='reflexion')
    for level in requested_levels(levels):
        fields['titles.'+level] = {'value':raw['titles'][level],'claim_ids':cover_refs}
        fields['reflections.'+level] = {'value':raw['reflections'][level],'claim_ids':[reflection_ref]}
        fields['questions.'+level] = {'value':raw['questions'][level],'claim_ids':[],'note':'Pregunta abierta del tema; no afirma una estadística'}
    fields['qualifier'] = {'value':raw['qualifier'],'claim_ids':cover_refs}
    for fact in facts:
        if fact.role not in ('portada','reflexion'):
            item = next(x for x in raw['items'] if x['claim_id']==fact.claim_id)
            if item.get('literal'): continue
            fields[f'items.{fact.claim_id}.body'] = {'value':item['body'],'claim_ids':[fact.claim_id],
                'stat_shown_separately':extract_stat(fact.text) if fact.role in ('prueba','segunda_prueba') else None}
    return fields


def literal_bodies(raw, errors, facts, repair_counts):
    """Un cuerpo que agotó sus reparaciones pasa al texto del propio hecho: fiel por construcción.
    No aplica a prueba/segunda_prueba (la cifra ya se dibuja aparte)."""
    import copy
    from .amarillista import CONFIG
    limit = CONFIG['redactor']['max_reparaciones_por_campo']
    by_id = {f.claim_id: f for f in facts}
    paths = []
    result = copy.deepcopy(raw)
    for path in list(errors):
        parts = path.split('.')
        if len(parts) != 3 or parts[0] != 'items' or parts[2] != 'body' or repair_counts.get(path, 0) < limit:
            continue
        fact = by_id.get(parts[1])
        if fact is None or fact.role in ('prueba','segunda_prueba'):
            continue
        text = fact.text.strip()
        if fact.role == 'giro' and not text.casefold().startswith('sin embargo'):
            text = 'Sin embargo, ' + text[:1].lower() + text[1:]
        if len(text) > CONFIG['limites']['body_literal_caracteres']:
            continue
        item = next(x for x in result['items'] if x['claim_id'] == fact.claim_id)
        item['body'] = text; item['literal'] = True
        paths.append(path)
    if not paths: return None
    return {'raw': result, 'errors': {k: v for k, v in errors.items() if k not in paths}, 'paths': paths}


def repair_request(raw, errors, facts, levels, history=None):
    from .amarillista import CONFIG
    evidence = {}
    history = history or {}
    for path, reason in errors.items():
        refs = ([f.claim_id for f in facts if f.role in ('portada','prueba')] if path.startswith('titles.') or path=='qualifier'
            else [f.claim_id for f in facts if f.role=='reflexion'] if path.startswith('reflections.') else [])
        if path in ('items','$'): refs = [f.claim_id for f in facts]
        if path.startswith('items.claim_'):
            refs = [path.split('.')[1]]
        evidence[path] = {'reason': reason, 'current_value': draft_fields(raw).get(path),
            'facts': [vars(f) for f in facts if f.claim_id in refs],
            'instruction': 'Acota la afirmación al texto de la evidencia; si sobreafirma o convierte percepción en efecto, escribe «quienes respondieron dicen que…». Conserva población, incertidumbre y carácter autodeclarado.',
            'previous_rejections': history.get(path, []),
            'max_characters': CONFIG['limites']['body_caracteres'] if path.startswith('items.') else
                next(r for r in CONFIG['roles'] if r['id']=='reflexion')['max_caracteres'] if path.startswith('reflections.') else None}
        if history.get(path):
            evidence[path]['instruction'] += ' El nuevo valor debe resolver A LA VEZ este motivo y todos los de previous_rejections; no reintroduzcas un problema ya señalado ni quites lo que se exigió antes.'
        if path.startswith('reflections.') and next(r for r in CONFIG['roles'] if r['id']=='reflexion')['niveles'].get(path.split('.')[1], {}).get('tono_regex'):
            evidence[path]['tone_words'] = 'Usa al menos una de estas palabras: pagas, cuesta, ignoras, exiges, sacrificas, pierdes, regalas, cedes, entregas, te roba, te quita.'
    return {'rejected_fields': errors, 'field_evidence': evidence, 'topic':raw.get('topic',''),
        'contrato': CONFIG['redactor']['contrato_campos'], 'validated_levels': levels}


def review_errors(review, raw, allowed):
    errors = {}
    rejected = review.get('rejected_fields')
    if not isinstance(rejected,dict): return {'$':'cotejo inválido: rejected_fields debe ser objeto'}
    from .amarillista import LEVELS
    ignored = 0
    for path,reason in rejected.items():
        normalized = normalize_path(path,raw)
        parts = normalized.split('.')
        if len(parts)==2 and parts[0] in ('titles','reflections','questions') and parts[1] in LEVELS and normalized not in allowed:
            log.info('image_post_review_ignored path=%s motivo=nivel no pedido',normalized)
            ignored += 1
            continue
        if normalized not in allowed:
            errors['$'] = 'cotejo pide campo no mostrado o desconocido: '+path
        else: errors[normalized] = str(reason)
    if review.get('approved') is not True and not errors and not ignored:
        errors['$'] = 'cotejo rechazado sin campos: '+str(review.get('reason',''))
    if not review.get('reason'): errors['$'] = 'cotejo sin motivo'
    return errors


def normalize_path(path, raw):
    if not isinstance(path,str): return ''
    path = re.sub(r'^\$\.?','',path).strip('/').replace('/','.')
    path = re.sub(r'^draft\.','',path)
    path = re.sub(r'\[(\d+)\]',r'.\1',path)
    match = re.fullmatch(r'items\.(\d+)\.(body|image_query)',path)
    if match and int(match[1]) < len(raw['items']):
        path = 'items.'+raw['items'][int(match[1])]['claim_id']+'.'+match[2]
    return path


def copies_from_draft(raw, facts, ctx, source='modelo: JSON auditado por roles de imagen', levels=None):
    errors = draft_errors(raw,facts,levels or [ctx.level])
    if errors: raise ValueError(json.dumps(errors,ensure_ascii=False))
    items = {x['claim_id']:x for x in raw['items']}
    return {fact.claim_id: Copy(stat=extract_stat(fact.text),
        headline=raw['titles'][ctx.level] if fact.role=='portada' else '',
        body=raw['reflections'][ctx.level] if fact.role=='reflexion' else str(items[fact.claim_id].get('body') or ''),
        source=source,headlines=raw['titles'] if fact.role=='portada' else None,
        qualifier=raw['qualifier'] if fact.role=='portada' else '',
        question=raw['questions'][ctx.level] if fact.role=='portada' else '',
        questions=raw['questions'] if fact.role=='portada' else None,
        reflections=raw['reflections'] if fact.role=='reflexion' else None,
        image_query=items[fact.claim_id]['image_query'],diagram=diagram_for(fact)) for fact in facts}


async def write(strategy, facts, ctx, ai=None, usage_out=None, audit_out=None, levels=None):
    from .amarillista import CONFIG, pick
    facts = pick(facts)
    from . import amarillista_hilo as hilo
    if hilo.is_hilo(facts):
        raw = await hilo.write(facts, ctx, ai=ai, usage_out=usage_out, audit_out=audit_out, levels=levels)
        copies = hilo.copies_from_draft(raw, facts, ctx, copy_origin(usage_out))
        return copies, ctx.topic or ctx.hook, {}
    if ai is None and (os.environ.get('NEXA_IMAGE_COPY_MODEL', '').lower() == 'off' or os.environ.get('NEXA_AMARILLISTA_RULES_ONLY') == '1'):
        return rules_result(facts, strategy, 'modelo apagado explícitamente')
    levels = requested_levels(levels or [ctx.level])
    contract = CONFIG['redactor']['contrato_campos']
    prompt = json.dumps({'brand':ctx.brand, 'voice':ctx.voice,'contrato':contract,
        'tema':ctx.topic or ctx.hook, 'validated_levels':levels,
        'nivel_no_pedido':'Mejor esfuerzo; no se valida ni se renderiza. Prioriza los niveles pedidos.',
        'facts':[dict(vars(f),stat=extract_stat(f.text) if f.role in ('prueba','segunda_prueba') else None) for f in facts]},ensure_ascii=False)
    raw = None; errors = {}; reason = ''; repair_counts = {}; history = {}
    for attempt in range(CONFIG['redactor']['max_intentos']):
        try:
            if attempt == 0:
                import copy
                schema = copy.deepcopy(CONFIG['redactor']['schemas']['copy_draft'])
                for section in ('titles','questions','reflections'):
                    for level, spec in schema['properties'][section]['properties'].items():
                        if level not in levels:
                            spec.clear(); spec.update(type='string')
                schema['properties']['items'].update(minItems=len(facts),maxItems=len(facts))
                schema['properties']['items']['items']['properties']['claim_id']['enum']=[f.claim_id for f in facts]
                raw = await model_json('copy_draft',CONFIG['redactor']['prompt'],prompt,ai,usage_out,schema=schema)
            else:
                literal = literal_bodies(raw, errors, facts, repair_counts)
                if literal:
                    raw = literal['raw']; errors = literal['errors']
                    if audit_out is not None: audit_out.append({'repair':attempt,'literal_bodies':literal['paths']})
                    log.warning('image_post_copy_literal_body paths=%s',literal['paths'])
                if not errors:
                    errors = draft_errors(raw,facts,levels)
                if errors:
                    if any(repair_counts.get(path, 0) >= CONFIG['redactor']['max_reparaciones_por_campo'] for path in errors):
                        reason = 'Agotadas dos reparaciones para un campo: '+json.dumps(errors,ensure_ascii=False); break
                    for path in errors: repair_counts[path] = repair_counts.get(path, 0) + 1
                    patch = await model_json('copy_repair',CONFIG['redactor']['prompt_reparacion'],
                        json.dumps(repair_request(raw, errors, facts, levels, history),ensure_ascii=False),ai,usage_out)
                    if audit_out is not None: audit_out.append({'repair':attempt,'patch':patch,'rejected_fields':dict(errors),'repair_counts':dict(repair_counts),'usage_count':len(usage_out or [])})
                    log.info('image_post_copy_repair patch=%s',json.dumps(patch,ensure_ascii=False))
                    for path, why in errors.items(): history.setdefault(path, []).append(why)
                    raw = repair_draft(raw,patch,errors)
            log.info('image_post_copy_draft attempt=%s draft=%s',attempt+1,json.dumps(raw,ensure_ascii=False))
            if audit_out is not None: audit_out.append({'attempt':attempt+1,'draft':raw,'validated_levels':levels})
            checker = 'code'
            errors = draft_errors(raw,facts,levels)
            if not errors:
                fields = review_fields(raw,facts,levels)
                review = await model_json('fact_check',CONFIG['redactor']['prompt_cotejo'],
                    json.dumps({'facts':[vars(f) for f in facts],'displayed_fields':fields,
                        'validacion_local':'Longitudes, cifras y estructura aprobadas. Evaluar SOLO fidelidad y tono.',
                        'reglas_reflexion':next(r for r in CONFIG['roles'] if r['id']=='reflexion')},ensure_ascii=False),ai,usage_out)
                log.info('image_post_copy_review attempt=%s result=%s',attempt+1,json.dumps(review,ensure_ascii=False))
                if audit_out is not None: audit_out.append({'attempt':attempt+1,'review':review})
                checker = 'model'
                errors = review_errors(review,raw,fields)
            if errors:
                reason = json.dumps(errors,ensure_ascii=False)
                if audit_out is not None: audit_out.append({'attempt':attempt+1,'rejected_fields':errors,'checker':checker})
                log.warning('image_post_copy_rejected attempt=%s fields=%s',attempt+1,reason)
                continue
            copies = copies_from_draft(raw,facts,ctx,copy_origin(usage_out)+(' + reparación acotada' if attempt else ''),levels=levels)
            if audit_out is not None: audit_out.append({'accepted':True,'draft':raw,'validated_levels':levels})
            return copies,str(raw.get('topic') or '')[:40],{'media_briefs':json.dumps({f.claim_id:{'query':copies[f.claim_id].image_query,'body':copies[f.claim_id].body,'role':f.role} for f in facts},ensure_ascii=False)}
        except Exception as exc:
            reason = str(exc) if isinstance(exc,(ValueError,RuntimeError)) else type(exc).__name__
            log.warning('image_post_copy_failed attempt=%s reason=%s',attempt+1,reason)
            # Transport/JSON errors cannot be repaired field by field without a draft.
            if raw is None or not errors: break
    return rules_result(facts,strategy,reason)
