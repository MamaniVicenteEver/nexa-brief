"""El editor usa el mismo redactor, fotos y reparaciones del pipeline hilo."""
from __future__ import annotations

from collections import Counter
from dataclasses import asdict, replace
import copy
import json
import re

from .strategies import amarillista_hilo as hilo
from .strategies.amarillista import CONFIG
from .strategies.amarillista_copy import copy_origin, model_json
from .strategies.base import Fact
from .trace import Events, current_trace, emit, read, save


def prepare_facts(rows):
    """Conserva el orden del PLAN, una fuente principal y apoyos explícitos."""
    facts = [Fact(claim, text, url, source, match.group(1) if (match := re.search(r"rol=([a-z_]+[0-9]*)\b", usage)) else "")
             for claim, text, url, source, usage in rows]
    if hilo.is_hilo(facts): return hilo.pick(facts)
    if any(f.role for f in facts):
        raise ValueError("La narrativa hilo requiere roles de hilo en los hechos seleccionados")
    counts = Counter(f.url for f in facts)
    primary = counts.most_common(1)[0][0] if counts else ""
    principal = [f for f in facts if f.url == primary]
    if len(principal) < 2:
        raise ValueError("Hilo necesita dos hechos verificados de la misma fuente principal")
    supports = list(dict.fromkeys(f.url for f in facts if f.url != primary))[:CONFIG['hilo']['max_fuentes_apoyo']]
    ordered = [*principal[:2], *[f for f in facts if f not in principal[:2] and f.url in [primary, *supports]]][:7]
    if len(ordered) < 4: raise ValueError("Hilo necesita cuatro hechos verificados como mínimo")
    roles = ['portada', *[f'desarrollo_{i}' for i in range(1, min(4, len(ordered)-2)+1)]]
    roles += [f'resolucion_{i}' for i in range(1, len(ordered)-len(roles)+1)]
    assigned = [replace(f, role=role) for f, role in zip(ordered, roles)]
    emit('selection', label='Selección de hechos para hilo',
         reason='Hechos del PLAN agrupados por fuente principal y apoyos; roles de composición asignados sin añadir hechos',
         facts=[vars(f) for f in assigned])
    return hilo.pick(assigned)


async def build(facts, ctx, cache):
    from .amarillista_media import find_relevant_images
    trace = current_trace.get()
    events, usage, decisions = Events('copy'), [], []
    source = facts[0].url
    story = {'fuente_principal': source, 'tesis': facts[0].text, 'nudo': facts[1].text,
             'explicacion': facts[2].text, 'resolucion': facts[-1].text,
             'fuentes_apoyo': [{'nombre': f.source_name, 'url': f.url} for f in facts if f.url != source]}
    if trace:
        trace.identity.update(brand=ctx.brand, primary_source=source,
                             support_sources=list(dict.fromkeys(f.url for f in facts if f.url != source)), slides=len(facts)+1)
        save(trace.folder/'input.json', {'facts': [vars(f) for f in facts], 'context': asdict(ctx), 'story': story})
    try:
        raw = await hilo.write(facts, ctx, story=story, usage_out=usage, audit_out=events, levels=[ctx.level])
        copies = hilo.copies_from_draft(raw, facts, ctx, copy_origin(usage))
        briefs = {f.claim_id: {'query': f'{ctx.topic or ctx.hook} {f.text[:100]}', 'role': f.role} for f in facts}
        if trace: save(trace.folder/'audit.json', {'approved': True, 'draft': raw, 'events': events, 'validated_levels': [ctx.level]})
        try:
            photos = await find_relevant_images(facts, ctx, cache, {'media_briefs': json.dumps(briefs)},
                                                usage_out=usage, decisions_out=decisions)
        finally:
            if trace: save(trace.folder/'photo-decisions.json', decisions)
        return hilo.build(facts, ctx, copies, photos), copies, usage, photos
    except Exception as exc:
        if trace: save(trace.folder/'failure.json', {'error': str(exc)})
        raise
    finally:
        if trace:
            save(trace.folder/'copy-attempts.json', events)
            save(trace.folder/'usage.json', usage)


async def repair_composition(plan, error):
    """Reparación acotada, medida y cotejada, como la salida CLI."""
    from .plan import parse_image_plan
    from .strategies.base import StrategyContext
    trace = current_trace.get()
    qc = getattr(error, 'qc', {})
    info = qc.get('shortening')
    if not trace or not qc.get('overflow') or not info: raise error
    audit = read(trace.folder/'audit.json', {})
    data = read(trace.folder/'input.json', {})
    raw = audit.get('draft')
    if not raw or not data.get('facts'): raise error
    counts = Counter(p for e in trace.events if e.get('repair') is not None for p in e.get('rejected_fields', {}))
    if sum(1 for e in trace.events if e.get('repair') is not None) >= CONFIG['hilo']['max_reparaciones']: raise error
    index = next((i for i, sl in enumerate(plan.slides) if sl.slide_id == getattr(error, 'slide_id', None)), None)
    facts = [Fact(**f) for f in data['facts']]
    if index is None or index == 0 or index >= len(facts): raise error
    ctx = StrategyContext(**data['context'])
    path = f'levels.{ctx.level}.items.{facts[index].claim_id}.text'
    if counts[path] >= 2: raise error
    errors = {path: f'Desborde medido: máximo {info["max_chars"]} caracteres conservando el hilo y la evidencia'}
    usage = read(trace.folder/'usage.json', [])
    events = Events('composition_repair')
    events.append({'draft': copy.deepcopy(raw)})
    try:
        patch = await model_json('copy_repair', CONFIG['hilo']['prompt_reparacion'], json.dumps({
            'rejected_fields': errors, 'field_evidence': {path: hilo.review_fields(raw, facts, [ctx.level])[path]},
            'measurement': info}, ensure_ascii=False), usage_out=usage)
        events.append({'repair': patch, 'rejected_fields': errors, 'checker': 'render', 'measurement': info})
        candidate = hilo.apply_patch(raw, patch, errors)
        if len(hilo.fields(candidate, facts, [ctx.level])[path]) > info['max_chars'] or hilo.draft_errors(candidate, facts, [ctx.level]):
            raise ValueError('Reparación medida inválida') from error
        displayed = hilo.review_fields(candidate, facts, [ctx.level])
        review = await model_json('fact_check', CONFIG['hilo']['prompt_cotejo'], json.dumps({
            'historia': data['story'], 'displayed_fields': displayed}, ensure_ascii=False),
            usage_out=usage, schema=CONFIG['hilo']['schema_cotejo'])
        events.append({'review': review})
        rejected = hilo.review_errors(review, displayed)
        if rejected:
            events.append({'rejected_fields': rejected, 'checker': 'model'})
            raise ValueError('Reparación de composición rechazada') from error
        copies = hilo.copies_from_draft(candidate, facts, ctx)
        changed = plan.to_dict()
        if changed['slides'][index]['media']:
            for text in changed['slides'][index]['texts']:
                if text['role'] == 'body': text['value'] = copies[facts[index].claim_id].body
        else:
            rebuilt = hilo.build(facts, ctx, copies, {})[index]
            changed['slides'][index]['texts'] = rebuilt['texts']
            changed['slides'][index]['elements'] = rebuilt['elements']
        audit['draft'] = candidate
        audit.setdefault('composition_repairs', []).extend(events)
        save(trace.folder/'audit.json', audit)
        emit('composition_repair', label='Desborde corregido', status='ok', reason=errors[path], field=path)
        return parse_image_plan(changed)
    finally:
        save(trace.folder/'usage.json', usage)
