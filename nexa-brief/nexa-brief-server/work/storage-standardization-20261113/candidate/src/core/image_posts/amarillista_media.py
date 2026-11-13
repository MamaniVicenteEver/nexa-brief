"""Fotos de contexto por rol, búsqueda acotada y motivo auditable del fallback."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from collections import Counter
from dataclasses import replace

from src.core.stock.service import get_stock_providers
from src.core.image_posts.image_licensing import accepted_license
from src.core.image_posts.media_sources import _download_and_cache, _as_sourced_image, normalize_license_url
from src.core.image_posts.strategies.amarillista_copy import model_json
from .strategies.amarillista import CONFIG

log = logging.getLogger(__name__)


def providers():
    from src.adapters.stock.public_archives import NASAImagesAdapter, LibraryCongressPhotosAdapter
    registry = get_stock_providers()
    # Pixabay usa una licencia propietaria, no admitida por la lista libre.
    return {**{k: v for k, v in registry.items() if k == 'wikimedia'},
            'nasa': NASAImagesAdapter(), 'loc': LibraryCongressPhotosAdapter()}


def query_variants(fact, ctx, brief):
    """El perfil amplía la búsqueda; solo el modelo decide relevancia de fotos."""
    raw = brief.get('query', [])
    queries = [raw] if isinstance(raw, str) else list(raw)
    topic = ' '.join((ctx.topic, ctx.hook, fact.text))
    if ctx.category_id == 'node_history' and 'melaza' in topic.casefold():
        queries += ['Boston molasses flood ' + ('tank' if fact.role == 'giro' else 'wreckage'),
                    'Boston molasses flood']
    else:
        profile = None
        for subject in (' '.join((ctx.topic, ctx.hook)), fact.text):
            profile = next((p for p in CONFIG['visuales']['perfiles_consulta'] if re.search(p['tema_regex'], subject, re.I)), None)
            if profile:
                break
        if profile:
            scenes = profile['escenas_por_rol'].get(fact.role, []) + profile['conceptos']
            queries = scenes + queries if profile is CONFIG['visuales']['perfiles_consulta'][0] and fact.role in ('portada','reflexion') else queries + scenes
        # También sirve para temas sin perfil: reducir una escena demasiado literal.
        if queries:
            words = re.findall(r'[a-z]+', str(queries[0]).lower())
            words = [w for w in words if w not in {'a', 'an', 'the', 'at', 'in', 'on', 'with', 'beside', 'front', 'of', 'using'}]
            if len(words) > 2:
                queries.append(' '.join(words[:2]))
    return list(dict.fromkeys(q.strip() for q in queries if isinstance(q, str) and q.strip()))[:CONFIG['visuales']['max_consultas_por_rol']]


async def judge_candidates(fact, ctx, items, role, ai=None, usage_out=None, decisions_out=None):
    if not items:
        return []
    result = await model_json('media_judge', CONFIG['visuales']['prompt_juicio'], json.dumps({
        'fact': fact.text, 'topic': ctx.topic or ctx.hook, 'role': role,
        'category_id': ctx.category_id, 'image_use': 'contexto; no evidencia del dato ni identidad de participantes',
        'candidates': [{'id': x.provider + ':' + x.provider_id, 'title': x.title,
                        'description': x.description[:2200], 'width': getattr(x, 'width', 0),
                        'height': getattr(x, 'height', 0)} for x in items]}, ensure_ascii=False), ai, usage_out)
    by_id = {x.provider + ':' + x.provider_id: x for x in items}
    decisions, seen = [], set()
    for d in result.get('decisions', []):
        key = d.get('id')
        if key not in by_id or key in seen or not isinstance(d.get('reason'), str) or not d['reason'].strip():
            continue
        seen.add(key)
        decision = {**d, "title": by_id[key].title, "description": by_id[key].description[:2200],
                    "dimensions": [getattr(by_id[key], "width", None), getattr(by_id[key], "height", None)]}
        metadata = by_id[key].title+' '+by_id[key].description
        if re.search(CONFIG['visuales']['rechazar_escena_regex'], metadata, re.I) or (role=='reflexion' and re.search(CONFIG['visuales']['rechazar_reflexion_publica_regex'], metadata, re.I)):
            decision.update(yes=False, reason='Escena degradante; requiere contexto cotidiano coherente con el tema')
        if ctx.category_id == 'node_history' and re.search(CONFIG['visuales']['rechazar_titulos_regex'], by_id[key].title, re.I):
            decision.update(yes=False, reason='Variante anotada; requiere fotografía original')
        log.info('image_post_media_judge claim=%s id=%r yes=%s reason=%s', fact.claim_id, key, decision.get('yes'), decision['reason'])
        if decisions_out is not None:
            decisions_out.append(decision)
        if decision.get('yes') is True:
            rank = d.get('rank'); rank = rank if isinstance(rank, (int, float)) else 999
            decisions.append((rank, by_id[key], decision['reason']))
    if decisions_out is not None:
        for key, candidate in by_id.items():
            if key not in seen:
                decisions_out.append({'id': key, 'yes': False, 'title': candidate.title,
                    'reason': 'El juicio no devolvió una decisión válida para este candidato'})
    return sorted(decisions, key=lambda x: x[0])


async def find_relevant_images(facts, ctx, cache, extras=None, ai=None, usage_out=None, existing=None, decisions_out=None):
    if ai is None and os.environ.get('NEXA_IMAGE_COPY_MODEL', '').lower() == 'off':
        return dict(existing or {})
    from .trace import emit, now
    extras = extras or {}
    briefs = json.loads(extras.get('media_briefs', '{}'))
    excluded = set(extras.get('media_exclude', []))
    selected = dict(existing or {})
    used_hashes = {im.sha256 for im in selected.values()}
    used_ids = {(im.provider, im.provider_id) for im in selected.values()}
    registry, policy = providers(), CONFIG['visuales']
    searches, pool, failed_ids, provider_errors = {}, {}, set(), Counter()
    for fact in facts:
        record = {'claim_id': fact.claim_id, 'role': fact.role, 'searches': [], 'filters': [],
                  'judgments': [], 'downloads': [], 'status': 'fallback', 'reason': '', 'at': now()}
        if decisions_out is not None:
            decisions_out.append(record)
        if fact.claim_id in selected:
            record.update(status='preserved', reason='Foto aprobada del mismo hecho; bytes y licencia verificados',
                          selected=selected[fact.claim_id].provider + ':' + selected[fact.claim_id].provider_id)
            emit('photos', label='Foto conservada', **record)
            continue
        queries = query_variants(fact, ctx, briefs.get(fact.claim_id, {}))
        record['queries'] = queries
        downloads, judgments, attempts = 0, 0, 0
        judged = set()

        def eligible(items):
            candidates = []
            for item in items:
                identity = (item.provider, item.provider_id)
                if identity in used_ids | failed_ids | judged:
                    continue
                candidates.append(item)
            return candidates[:policy['candidatos_por_juicio']]

        async def choose(items):
            nonlocal downloads, judgments
            candidates = eligible(items)
            if not candidates or judgments >= policy['max_juicios_por_rol']:
                return
            judged.update((item.provider, item.provider_id) for item in candidates)
            judgments += 1
            try:
                ranked = await judge_candidates(fact, ctx, candidates, fact.role, ai, usage_out, record['judgments'])
            except Exception as exc:
                record['judgments'].append({'error': type(exc).__name__})
                record['reason'] = 'photo_judge_unavailable'
                return
            for _, item, why in ranked:
                if downloads >= policy['descargas_por_rol']:
                    break
                downloads += 1
                identity = (item.provider, item.provider_id)
                event = {'id': item.provider + ':' + item.provider_id}
                record['downloads'].append(event)
                try:
                    cached = await _download_and_cache(item, registry[item.provider], cache)
                    image = _as_sourced_image(item, 'modelo: ' + why, cached, 'search')
                    event['dimensions'] = [image.width, image.height]
                    event.update(sha256=image.sha256, license=getattr(image, "license", ""), title=image.title)
                    if min(image.width, image.height) < policy['min_lado_px']:
                        failed_ids.add(identity); event['reason'] = 'actual_dimensions_too_small'
                        continue
                    if image.sha256 in used_hashes:
                        failed_ids.add(identity); event['reason'] = 'duplicate_hash'
                        continue
                    image = replace(image, license_url=normalize_license_url(image.license_url))
                    selected[fact.claim_id] = image
                    used_hashes.add(image.sha256); used_ids.add(identity)
                    event['reason'] = 'selected'
                    record.update(status='selected', reason=why, selected=event['id'])
                    log.info('image_post_media_decision claim=%s origin=modelo selected=%r reason=%s', fact.claim_id, item.title, why)
                    break
                except Exception as exc:
                    failed_ids.add(identity); event['reason'] = type(exc).__name__

        def finished():
            return (fact.claim_id in selected or downloads >= policy['descargas_por_rol']
                    or judgments >= policy['max_juicios_por_rol'] or record['reason'] == 'photo_judge_unavailable')

        # Todas las variantes de Commons antes de pasar a archivos más especializados.
        # Los candidatos nuevos tienen prioridad; el pool compartido no consume el
        # presupuesto de juicio antes de consultar la escena de este rol.
        for name in policy['proveedores']:
            port = registry.get(name)
            if not port or not port.configured:
                continue
            for query in queries:
                if finished() or attempts >= policy['max_busquedas_por_rol'] or provider_errors[name] >= policy['max_errores_por_proveedor']:
                    break
                key = (name, query)
                attempts += 1
                if key not in searches:
                    await asyncio.sleep(policy['pausa_busqueda_segundos'])
                    try:
                        items = await asyncio.wait_for(port.search(query, 'image', per_page=policy['resultados_por_busqueda']), timeout=policy['timeout_busqueda_segundos'])
                        searches[key] = (items, None)
                    except Exception as exc:
                        searches[key] = ([], type(exc).__name__)
                        provider_errors[name] += 1
                items, error = searches[key]
                event = {'provider': name, 'query': query, 'count': len(items), 'error': error}
                record['searches'].append(event)
                log.info('image_post_media_search claim=%s provider=%s query=%r count=%s error=%s', fact.claim_id, name, query, len(items), error)
                fresh = []
                for item in items:
                    identity = (item.provider, item.provider_id)
                    keystr = item.provider + ':' + item.provider_id
                    original = (item.original_width, item.original_height)
                    reason = ('degrading_scene' if (re.search(policy['rechazar_escena_regex'], item.title+' '+item.description, re.I) or (fact.role=='reflexion' and re.search(policy['rechazar_reflexion_publica_regex'], item.title+' '+item.description, re.I))) else
                              'license_not_free' if not accepted_license(item.license) else
                              'metadata_dimensions_too_small' if min(item.width, item.height) < policy['min_lado_px'] else
                              'original_dimensions_too_small' if min(original) > 0 and min(original) < policy['min_lado_px'] else
                              'attribution_too_long_for_slide' if len(item.author) > policy['max_author_characters'] else
                              'excluded' if keystr in excluded else 'duplicate_id' if identity in used_ids else None)
                    if reason:
                        record['filters'].append({'id': keystr, 'title': item.title, 'reason': reason, 'license': item.license,
                                                  'dimensions': [item.width, item.height]})
                        continue
                    pool[identity] = item; fresh.append(item)
                await choose(fresh)
            if finished() or attempts >= policy['max_busquedas_por_rol']:
                break
        if not finished():
            await choose(list(pool.values()))
        if fact.claim_id not in selected:
            if not record['reason']:
                record['reason'] = ('download_budget_exhausted' if downloads >= policy['descargas_por_rol'] else
                                    'judgment_budget_exhausted' if judgments >= policy['max_juicios_por_rol'] else
                                    'no_approved_context_photo' if judged else
                                    'no_eligible_free_candidates' if queries else 'no_visual_query')
            log.info('image_post_media_decision claim=%s fallback=%s searches=%s judgments=%s downloads=%s',
                     fact.claim_id, record['reason'], attempts, judgments, downloads)
        emit('photos', label='Búsqueda y selección de foto', **record)
    return selected
