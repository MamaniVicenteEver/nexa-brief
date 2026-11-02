"""Una historia, varios pasos. Reutiliza el hub y las recetas visuales aprobadas."""
from __future__ import annotations

from collections import Counter
import copy
import json
import re
import zlib

from .base import Copy, slide, source_label, text
from .amarillista import CONFIG
from .amarillista_copy import copy_origin, model_json, requested_levels, title_key
from .amarillista_visuals import diagram_element
from .prueba_a_la_vista import _media_ref
from ..input_check import NUMBER, WORDS, normalize

ROLE_RE = r'(?:portada|desarrollo_[1234]|resolucion_[12])'


def is_hilo(facts):
    return any(f.role.startswith(('desarrollo_', 'resolucion_')) for f in facts)


def pick(facts):
    by_role = {}
    for f in facts:
        if not re.fullmatch(ROLE_RE, f.role):
            raise ValueError('Hilo: rol inválido ' + f.role)
        if f.role in by_role:
            raise ValueError('Hilo: rol duplicado ' + f.role)
        if not f.url.startswith('https://') or not f.source_name.strip() or not f.text.strip():
            raise ValueError(f'{f.claim_id}: hecho y fuente HTTPS obligatorios')
        by_role[f.role] = f
    required = {'portada', 'desarrollo_1', 'desarrollo_2', 'resolucion_1'}
    if required - by_role.keys():
        raise ValueError('Hilo: faltan roles ' + ', '.join(sorted(required - by_role.keys())))
    ordered = [by_role[r] for r in CONFIG['hilo']['orden'] if r in by_role]
    if len({f.claim_id for f in ordered}) != len(ordered):
        raise ValueError('Hilo: IDs de hechos duplicados')
    cfg = CONFIG['hilo']
    if by_role['portada'].url != by_role['desarrollo_1'].url:
        raise ValueError('Hilo: portada y desarrollo_1 deben continuar la misma fuente principal')
    if len({f.url for f in ordered}) > 1 + cfg['max_fuentes_apoyo']:
        raise ValueError('Hilo: demasiadas fuentes de apoyo')
    return ordered


def validate_input(meta, facts):
    """PLAN es la evidencia; historia describe su secuencia, nunca añade fuentes."""
    facts = pick(facts)
    story = meta.get('historia')
    if not isinstance(story, dict):
        raise ValueError('post.json.historia: prepara una historia con fuente principal, tesis, nudo, datos, explicación y resolución')
    for field in CONFIG['hilo']['entrada']['campos_texto']:
        if not isinstance(story.get(field), str) or not story[field].strip():
            raise ValueError('post.json.historia.' + field + ': texto obligatorio')
    if story['tipo'] not in ('estudio', 'noticia', 'caso'):
        raise ValueError('historia.tipo: estudio, noticia o caso')
    support = story.get('fuentes_apoyo', [])
    if not isinstance(support, list) or len(support) > CONFIG['hilo']['max_fuentes_apoyo'] or any(
            not isinstance(v, dict) or not str(v.get('nombre', '')).strip() or not str(v.get('url', '')).startswith('https://') for v in support):
        raise ValueError('historia.fuentes_apoyo: lista de {nombre, url HTTPS}, máximo ' + str(CONFIG['hilo']['max_fuentes_apoyo']))
    if story['fuente_principal'] != facts[0].url or meta['sources'] != [story['fuente_principal'], *[v['url'] for v in support]]:
        raise ValueError('Hilo: sources debe ser fuente_principal seguida de las URLs exactas de fuentes_apoyo')
    if {f.url for f in facts} - set(meta['sources']):
        raise ValueError('Hilo: cada hecho debe citar la fuente principal o una fuente de apoyo declarada')
    for field in ('publico', 'contexto', 'por_que'):
        if field in story and (not isinstance(story[field], str) or not story[field].strip()):
            raise ValueError('historia.' + field + ': texto no vacío')
    recs = story.get('recomendaciones', [])
    if not isinstance(recs, list) or any(not isinstance(v, str) or not v.strip() for v in recs):
        raise ValueError('historia.recomendaciones: lista de textos')
    data = story.get('datos')
    if not isinstance(data, list) or len(data) > 3 or any(not isinstance(v, str) or not v.strip() for v in data):
        raise ValueError('historia.datos: lista de cero a tres datos del mismo caso')
    photos = meta.get('fotos_sugeridas')
    if not isinstance(photos, dict) or set(photos) != {f.role for f in facts}:
        raise ValueError('fotos_sugeridas: una escena/consulta por cada rol factual del PLAN')
    if any(not isinstance(v, str) or not v.strip() for v in photos.values()):
        raise ValueError('fotos_sugeridas: las escenas deben ser textos no vacíos')
    if meta.get('narrativa', 'hilo') != 'hilo':
        raise ValueError('historia requiere narrativa=hilo')
    return story


def _object(properties):
    return {'type': 'object', 'properties': properties, 'required': list(properties), 'additionalProperties': False}


def schema(facts, levels):
    cfg = CONFIG['hilo']
    string = {'type': 'string', 'minLength': 1, 'maxLength': cfg['max_texto_caracteres']}
    closing = {'type': 'string', 'minLength': 1, 'maxLength': cfg['max_cierre_caracteres']}
    pieces = _object({f.claim_id: _object({'text': string, 'stat': {'type': 'string', 'maxLength': 24}}) for f in facts[1:]})
    version = _object({'statement': {'type': 'string', 'minLength': 1, 'maxLength': cfg['max_titular_caracteres']},
                       'hook_question': {'type': 'string', 'minLength': 1, 'maxLength': cfg['max_pregunta_portada_caracteres']},
                       'items': pieces, 'question': closing})
    return _object({'levels': _object({level: version for level in levels})})


def fields(raw, facts, levels):
    result = {}
    for level in levels:
        version = raw.get('levels', {}).get(level, {})
        prefix = 'levels.' + level + '.'
        for key in ('statement', 'hook_question', 'question'):
            result[prefix + key] = version.get(key)
        for f in facts[1:]:
            item = version.get('items', {}).get(f.claim_id, {})
            for key in ('text', 'stat'):
                result[prefix + 'items.' + f.claim_id + '.' + key] = item.get(key)
    return result


def number_literals(value):
    """Cuenta apariciones, incluso cifras repetidas y números escritos en palabras."""
    norm = normalize(value)
    units = r'(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)'
    tens = r'(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)'
    words = r'\b(?:' + tens + r'(?: y ' + units + r')?|veinti\w+|' + '|'.join(WORDS) + r'|mitad|doble|triple|tercio|cuarto|mil)\b'
    return [m.group() for m in re.finditer(NUMBER + '|' + words, norm)
            if m.group() not in ('uno', 'una') or re.match(r'\s+(?:hora|dia|semana|mes|ano|sintoma|persona|por ciento)', norm[m.end():])]


def quantities(value):
    from decimal import Decimal
    values = set()
    extras = {'veintiuno': 21, 'veintiuna': 21, 'veintidos': 22, 'veintitres': 23, 'veinticuatro': 24,
              'veinticinco': 25, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29, 'mil': 1000}
    for literal in number_literals(value):
        if literal[0].isdigit():
            raw = literal.replace(' ', '')
            raw = re.sub(r'[.,](?=\d{3}(?:[.,]|$))', '', raw).replace(',', '.')
            values.add(str(Decimal(raw).normalize()))
        elif ' y ' in literal:
            a, b = literal.split(' y ')
            values.add(str(WORDS[a] + WORDS[b]))
        else:
            number = WORDS.get(literal, extras.get(literal))
            values.add(str(Decimal(number).normalize()) if number is not None else literal)
    return values


def word_limit(role):
    cfg = CONFIG['hilo']
    return cfg['max_palabras_desarrollo'] if role.startswith('desarrollo_') else cfg['max_palabras_resolucion']


def draft_errors(raw, facts, levels):
    from jsonschema import Draft202012Validator
    issues = {}
    for e in Draft202012Validator(schema(facts, levels)).iter_errors(raw):
        issues['.'.join(map(str, e.absolute_path)) or '$'] = e.message
    if issues:
        return issues
    cfg = CONFIG['hilo']
    for level in levels:
        v = raw['levels'][level]
        prefix = 'levels.' + level + '.'
        if len(v['statement'].split()) > cfg['max_titular_palabras'] or '?' in v['statement']:
            issues[prefix + 'statement'] = 'Una afirmación completa con sujeto explícito, máximo 16 palabras'
        hq = v['hook_question'].strip()
        if hq.startswith('¿') != hq.endswith('?') or len(hq.split()) > cfg['max_pregunta_portada_palabras']:
            issues[prefix + 'hook_question'] = f'Segunda línea de portada (pregunta completa con ¿…? o afirmación sin signos), dirigida a un público, máximo {cfg["max_pregunta_portada_palabras"]} palabras'
        if '?' not in v['question'] or not re.search(r'comentari|cu[eé]ntanos|te leemos', v['question'], re.I):
            issues[prefix + 'question'] = 'Pregunta abierta y polarizante e invitación a comentar'
        seen = []
        for path, value in fields(raw, facts, [level]).items():
            if path.endswith('.stat') and not value:
                continue
            if not value.strip() or '\n' in value:
                issues[path] = 'Texto no vacío, en una sola línea'
            if len(value.split()) > (cfg['max_palabras_texto'] if '.items.' in path else 40):
                issues[path] = f'Máximo {cfg["max_palabras_texto"] if ".items." in path else 40} palabras en este campo'
            if re.search(cfg['jerga_regex'], value, re.I):
                issues[path] = 'Lenguaje claro: reemplaza la jerga académica por palabras cotidianas'
            elif (m := re.search(cfg['cautelas_regex'], value, re.I)):
                issues[path] = f'Quita la cautela «{m.group(0)}»: debilita la historia. Elimina esa frase entera (no la reformules como otra cautela) y conserva el resto.'
            refs = facts if path.endswith('.question') else [facts[0]]
            if '.items.' in path:
                refs = [f for f in facts if f.claim_id == path.split('.')[3]]
            allowed = set().union(*(quantities(f.text) for f in refs))
            if quantities(value) - allowed:
                issues[path] = 'Cifra inventada o ausente del texto de su propio hecho: ' + ', '.join(sorted(quantities(value) - allowed))
            seen.extend((path, n) for n in number_literals(value))
        if len(seen) > cfg['max_cifras']:
            for path, _ in seen[cfg['max_cifras']:]:
                issues[path] = f'Máximo {cfg["max_cifras"]} cifras en todo el post, contando apariciones y años; no repitas el dato'
        for f in facts[1:]:
            item = v['items'][f.claim_id]
            path = prefix + 'items.' + f.claim_id
            limit = word_limit(f.role)
            if len((item['stat'] + ' ' + item['text']).split()) > limit:
                issues[path + '.text'] = f'Texto y cifra juntos: máximo {limit} palabras'
            if len(item['stat']) > cfg['max_stat_caracteres']:
                issues[path + '.stat'] = f'stat demasiado largo para la cifra grande: máximo {cfg["max_stat_caracteres"]} caracteres (p. ej. «19 % más»), o déjalo vacío'
            if item['stat'] and (not f.role.startswith('desarrollo_') or not number_literals(item['stat'])):
                issues[path + '.stat'] = 'stat debe ser una cifra con su unidad tomada del hecho (p. ej. «19 % más tiempo») o quedar vacío'
            if f.role == 'desarrollo_1':
                from difflib import SequenceMatcher
                questions = re.findall(r'¿[^?]+\?', item['text'])
                if any(SequenceMatcher(None, title_key(v['hook_question']), title_key(q)).ratio() > .78 for q in questions):
                    issues[path + '.text'] = 'El nudo repite la pregunta de portada; plantea una pregunta distinta que avance la historia'
    if len(levels) > 1 and len({title_key(raw['levels'][l]['statement']) for l in levels}) != len(levels):
        for level in levels:
            issues['levels.' + level + '.statement'] = 'Los niveles pedidos deben tener titulares diferentes'
    return issues


def review_fields(raw, facts, levels):
    visible = fields(raw, facts, levels)
    return {p: {'value': v, 'facts': [vars(f) for f in facts if
        (f.claim_id == p.split('.')[3] if '.items.' in p else True)]}
        for p, v in visible.items() if v}


def review_errors(review, displayed):
    errors = {}
    if set(review.get('reviewed_fields', [])) != set(displayed):
        errors['$'] = 'Cotejo incompleto: debe revisar todos los campos visibles, incluidas ambas preguntas'
    rejected = review.get('rejected_fields', [])
    if not isinstance(rejected, list):
        return {'$': 'Cotejo inválido: rejected_fields debe ser una lista tipada'}
    for entry in rejected:
        path = entry.get('path')
        if entry.get('kind') in ('tone', 'framing', 'nuance'):
            continue  # El brief permite provocación, selección narrativa y matices de redacción.
        if path not in displayed or entry.get('kind') not in ('invented_fact', 'contradiction', 'unsupported_accusation'):
            errors['$'] = 'Rechazo sin ruta visible o categoría factual válida'
        else:
            errors[path] = entry.get('reason') or 'Rechazo factual sin motivo'
    if not review.get('reason') or (not review.get('approved') and not rejected):
        errors['$'] = 'Cotejo sin motivo o rechazado sin campos'
    return errors


def apply_patch(raw, patch, errors):
    result = copy.deepcopy(raw)
    for change in patch.get('changes', []):
        path = change.get('path', '')
        if path not in errors:
            continue
        keys = path.split('.')
        node = result
        try:
            for key in keys[:-1]: node = node[key]
            if keys[-1] in node and isinstance(change.get('value'), str):
                node[keys[-1]] = change['value']
        except (KeyError, TypeError):
            continue
    return result


async def write(facts, ctx, *, story=None, levels=None, usage_out=None, audit_out=None, ai=None, draft=None):
    facts = pick(facts)
    levels = requested_levels(levels or [ctx.level])
    cfg = CONFIG['hilo']
    events = audit_out if audit_out is not None else []
    errors, counts = {}, Counter()
    raw = ({'levels': {level: copy.deepcopy(draft.get('levels', {}).get(level)) for level in levels}}
           if draft is not None else None)
    if raw is None:
        prompt = cfg.get('prompt_' + levels[0], cfg['prompt']) if len(levels) == 1 else cfg['prompt']
        raw = await model_json('copy_draft', prompt, json.dumps({
            'brand': ctx.brand, 'voice': ctx.voice, 'tema': ctx.topic or ctx.hook,
            'historia': story, 'hechos_en_orden': [vars(f) for f in facts],
            'niveles': levels, 'contrato': cfg['reglas'],
            'limites': {'palabras_desarrollo': cfg['max_palabras_desarrollo'], 'palabras_resolucion': cfg['max_palabras_resolucion'],
                        'cifras_en_todo_el_post': cfg['max_cifras']}}, ensure_ascii=False),
            ai=ai, usage_out=usage_out, schema=schema(facts, levels))
    for attempt in range(cfg['max_reparaciones'] + 1):
        events.append({'attempt': attempt + 1, 'draft': copy.deepcopy(raw)})
        checker = 'code'
        errors = draft_errors(raw, facts, levels)
        if not errors:
            displayed = review_fields(raw, facts, levels)
            review = await model_json('fact_check', cfg['prompt_cotejo'], json.dumps({
                'historia': story, 'displayed_fields': displayed, 'hechos_en_orden': [vars(f) for f in facts]}, ensure_ascii=False),
                ai=ai, usage_out=usage_out, schema=cfg['schema_cotejo'])
            events.append({'review': review})
            checker = 'model'
            errors = review_errors(review, displayed)
        if not errors:
            events.append({'accepted': True, 'draft': copy.deepcopy(raw)})
            return raw
        events.append({'rejected_fields': dict(errors), 'checker': checker})
        if '$' in errors or attempt == cfg['max_reparaciones'] or any(counts[p] >= 2 for p in errors):
            break
        current = fields(raw, facts, levels)
        evidence = review_fields(raw, facts, levels)
        for path in errors: counts[path] += 1
        patch = await model_json('copy_repair', cfg['prompt_reparacion'], json.dumps({
            'rejected_fields': errors, 'field_evidence': {p: {**evidence.get(p, {}),
                'current_value': current.get(p), 'reason': reason} for p, reason in errors.items()},
            'hechos_en_orden': [vars(f) for f in facts], 'reglas': cfg['reglas']}, ensure_ascii=False),
            ai=ai, usage_out=usage_out)
        ignored = [c for c in patch.get('changes', []) if c.get('path') not in errors]
        events.append({'repair': patch, 'rejected_fields': dict(errors), 'ignored_changes': ignored})
        raw = apply_patch(raw, patch, errors)
    raise ValueError('Hilo rechazado tras reparaciones acotadas: ' + json.dumps(errors, ensure_ascii=False))


def copies_from_draft(raw, facts, ctx, source='modelo real + cotejo', photos=None):
    # Un carrusel usa un nivel; los otros tratamientos no forman parte de su copy.
    selected = {'levels': {ctx.level: raw.get('levels', {}).get(ctx.level)}}
    errors = draft_errors(selected, facts, [ctx.level])
    if errors: raise ValueError(json.dumps(errors, ensure_ascii=False))
    v = raw['levels'][ctx.level]
    return {f.claim_id: Copy(stat=None if f.role == 'portada' else v['items'][f.claim_id]['stat'] or None,
        headline=v['statement'] if f.role == 'portada' else '',
        body=None if f.role == 'portada' else v['items'][f.claim_id]['text'], source=source,
        headlines={l: value['statement'] for l, value in raw['levels'].items()} if f.role == 'portada' else None,
        questions={l: value['question'] for l, value in raw['levels'].items()} if f.role == 'portada' else None,
        question=v['question'] if f.role == 'portada' else '',
        hook_question=v['hook_question'] if f.role == 'portada' else '', narrative='hilo',
        image_query=(photos or {}).get(f.role, '')) for f in facts}


def with_invite(question, statement):
    # El modelo a veces cierra sin punto; la invitación empieza una frase nueva.
    question = question.strip()
    if question and question[-1] not in '.?!…':
        question += '.'
    return ' '.join(filter(None, [question, video_invite(statement)]))


def video_invite(statement):
    # Dos versiones estables por post para que la invitación no se repita igual en todos.
    options = CONFIG['cierre'].get('invitacion_video') or ['']
    return options[zlib.crc32(statement.encode('utf-8')) % len(options)]


def build(facts, ctx, copies, media=None):
    facts = pick(facts)
    pages, used, identities = [], set(), set()
    if not ctx.brand or not ctx.handle: raise ValueError('Hilo requiere marca y @')
    for index, f in enumerate(facts):
        piece = copies[f.claim_id]
        image = media.get(f.claim_id) if isinstance(media, dict) else media[index] if media and index < len(media) else None
        identity = (image.provider, image.provider_id) if image else None
        if image and (image.sha256 in used or identity in identities): image = None
        if image: used.add(image.sha256); identities.add(identity)
        refs = [f.claim_id]
        kicker = 'PORTADA' if index == 0 else 'DESARROLLO' if f.role.startswith('desarrollo_') else 'QUÉ HACER'
        texts = [text('kicker', kicker), text('headline', piece.headline, refs) if index == 0 else text('body', piece.body, refs),
                 text('label', piece.hook_question, refs) if index == 0 else text('stat', piece.stat, refs),
                 text('source', source_label([f]), refs), text('handle', ctx.handle)]
        page = slide(index + 1, 'amarillista', f'am_{ctx.level}_{"photo" if image else "visual"}', texts, [f])
        if image:
            m = _media_ref(image)
            page['media'] = [m]
            page['elements'] = [{'type': 'photo', 'asset_id': m['asset_id'], 'value': image.title or 'Foto de contexto'}]
            page['texts'].append(text('credit', f'Foto: {image.author} · {image.license}'))
        else:
            # El mismo contenido ocupa la receta de línea de tiempo cuando no hay foto.
            if piece.stat:
                match = re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*(.+)', piece.stat)
            else: match = None
            diagram = ({'kind': 'quantity', 'value': match[1].replace('.', ','), 'unit': match[2],
                        'label': 'El hallazgo', 'claim_ids': refs} if match else
                       {'kind': 'timeline', 'label': 'El punto de partida' if index == 0 else kicker,
                        'items': [{'label': 'Fuente' if index == 0 else 'La historia continúa',
                                   'detail': f.source_name if index == 0 else piece.body}], 'claim_ids': refs})
            page['elements'] = [diagram_element(diagram)]
            page['texts'] = [t for t in page['texts'] if t['role'] != 'stat' and (match or t['role'] != 'body')]
        pages.append(page)
    cover = copies[facts[0].claim_id]
    pages.append(slide(len(pages) + 1, 'amarillista', f'am_{ctx.level}_close', [
        text('kicker', ctx.brand), text('question', with_invite(cover.question, cover.headline)), text('cta', CONFIG['cierre']['cta']), text('handle', ctx.handle)], []))
    return pages


def texto(raw, facts, ctx):
    """Formato solicitado, sin fotos, HTML, marcas de test ni comentarios añadidos."""
    v = raw['levels'][ctx.level]
    lines = [f'Imagen 1 (portada): {v["statement"]}', f'  Segunda línea: {v["hook_question"]}']
    for index, f in enumerate(facts[1:], 2):
        item = v['items'][f.claim_id]
        content = (f"[CIFRA GRANDE: {item['stat']}] " if item['stat'] else '') + item['text']
        role = 'desarrollo' if f.role.startswith('desarrollo_') else 'resolución'
        lines.append(f'Imagen {index} ({role}): {content}')
    lines.append(f'Imagen {len(facts) + 1} (cierre): {with_invite(v["question"], v["statement"])} · {ctx.brand} · {CONFIG["cierre"]["cta"]}')
    lines.append('Fuente: ' + facts[0].url)
    seen = {facts[0].url}
    for f in facts[1:]:
        if f.url not in seen:
            seen.add(f.url)
            lines.append(f'Apoyo ({f.source_name}): {f.url}')
    return '\n'.join(lines) + '\n'


def plan_errors(plan):
    """QC estructural del hilo, sin heredar veto de tono/reflexión del contrato viejo."""
    from .amarillista import LEVELS
    from .amarillista_visuals import validate_diagram
    cfg = CONFIG['hilo']
    errors, roles, numbers, hashes, urls = [], [], [], [], set()
    levels = [sl.layout.split(':')[-1].split('_')[1] for sl in plan.slides]
    if len(set(levels)) != 1 or levels[0] not in LEVELS:
        errors.append('Hilo: nivel inconsistente')
    for i, sl in enumerate(plan.slides):
        if not sl.layout.startswith('amarillista:'): errors.append('Hilo: no mezclar estrategias')
        visible = {t.role: t.value for t in sl.texts}
        role = 'portada' if i == 0 else 'cierre' if sl.layout.endswith('_close') else visible.get('kicker')
        roles.append(role)
        for t in sl.texts:
            if t.role in ('headline', 'body', 'stat', 'label', 'question'):
                numbers.extend(number_literals(t.value))
        if i == len(plan.slides) - 1:
            if not all(visible.get(k) for k in ('kicker', 'question', 'cta', 'handle')) or '?' not in visible.get('question', ''):
                errors.append('Hilo: cierre requiere marca, pregunta, CTA y @')
            continue
        urls.update(c.url for c in sl.claim_refs)
        hashes.extend(m.sha256 for m in sl.media)
        if not visible.get('source'): errors.append('Hilo: falta fuente visible')
        photos = [e for e in sl.elements if e.type == 'photo' and any(m.asset_id == e.asset_id for m in sl.media)]
        diagrams = [e for e in sl.elements if e.type == 'diagram']
        if not photos and not diagrams: errors.append('Hilo: lámina sin foto ni visual informativo')
        if photos and not sl.layout.endswith('_photo'): errors.append('Hilo: receta sin foto')
        if diagrams and not sl.layout.endswith('_visual'): errors.append('Hilo: receta sin visual')
        content = visible.get('body', '')
        for element in diagrams:
            try:
                diagram = validate_diagram(json.loads(element.value), {c.id for c in sl.claim_refs})
                if diagram['kind'] == 'timeline':
                    details = ' '.join(item['detail'] for item in diagram['items'])
                    if i: content = details
                    numbers.extend(number_literals(details) if i else [])
                elif diagram['kind'] == 'quantity':
                    numbers.extend(number_literals(str(diagram['value']) + ' ' + diagram['unit']))
                else: errors.append('Hilo: fallback debe conservar el paso de la historia')
            except (ValueError, KeyError, TypeError) as exc:
                errors.append('Hilo: visual inválido: ' + str(exc))
        if i and len((visible.get('stat', '') + ' ' + content).split()) > word_limit('desarrollo_' if visible.get('kicker') == 'DESARROLLO' else 'resolucion_'):
            errors.append('Hilo: desarrollo/resolución supera el máximo de palabras')
    if roles[0] != 'portada' or roles[-1] != 'cierre' or roles[1:-1] not in [
        ['DESARROLLO'] * d + ['QUÉ HACER'] * r for d in (2, 3, 4) for r in (1, 2)]:
        errors.append('Hilo: portada, 2–4 desarrollos, 1–2 resoluciones y cierre en orden')
    if not urls or len(urls) > 1 + cfg['max_fuentes_apoyo']: errors.append('Hilo: una fuente principal y hasta ' + str(cfg['max_fuentes_apoyo']) + ' de apoyo')
    if len(hashes) != len(set(hashes)): errors.append('Hilo: fotos repetidas')
    if len(numbers) > cfg['max_cifras']: errors.append('Hilo: demasiadas cifras en todo el post')
    cover = {t.role: t.value for t in plan.slides[0].texts}
    if not cover.get('headline') or len(cover['headline']) > cfg['max_titular_caracteres'] or len(cover['headline'].split()) > cfg['max_titular_palabras']:
        errors.append('Hilo: portada requiere afirmación completa de hasta 16 palabras/110 caracteres')
    label = cover.get('label', '').strip()
    if not label or label.startswith('¿') != label.endswith('?'):
        errors.append('Hilo: falta segunda línea destacada en portada (pregunta o afirmación)')
    return errors
