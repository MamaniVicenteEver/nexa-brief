"""Salida narrativa: texto auditado o el mismo copy con fotos y renderer existentes."""
from __future__ import annotations

from dataclasses import asdict, replace
import json
import os

from src.adapters.data.local_image_media_cache import LocalImageMediaCache
from src.adapters.data.local_image_post_resources import LocalImagePostResources
from .strategies import amarillista_hilo as hilo
from .strategies.amarillista import CONFIG
from .strategies.amarillista_copy import copy_origin, requested_levels, model_json
from .strategies.base import StrategyContext


async def run(folder, out, levels, *, solo_texto=False, recheck_approved=False, photos_only=False, approved_from=None):
    # Imports diferidos: solo-texto no inicializa caché, proveedores ni Playwright.
    from . import render_post as rp
    levels = requested_levels(levels)
    if solo_texto and len(levels) != 1: raise ValueError('--solo-texto requiere un nivel por salida')
    if approved_from and not photos_only: raise ValueError('--reuse-approved requiere --photos-only')
    if photos_only and recheck_approved: raise ValueError('--photos-only no permite recotejar')
    meta, facts, usages, plan_text = rp.read_input(folder)
    style = LocalImagePostResources(skills_dir=rp.SERVER / 'src/skills').get_style(meta['category_id'])
    ctx = StrategyContext(meta['category_id'], meta['title'], meta['title'], style.brand['handle'], style.brand['name'],
                          str(style.tone.get('voice', '')) + '\n' + meta.get('editorial_notes', ''), levels[0])
    identity = rp.digest({'meta': meta, 'facts': [vars(f) for f in facts], 'contract': CONFIG['hilo'],
                          'brand': ctx.brand, 'handle': ctx.handle})
    out.mkdir(parents=True, exist_ok=True)
    audit_path = out / 'audit.json'
    usage = json.loads((out / 'usage.json').read_text()) if (out / 'usage.json').exists() else []
    from .trace import Events, now as trace_now
    events = Events("copy")
    rp.save(out / 'input.json', {'post': meta, 'facts': [vars(f) for f in facts], 'contract_version': CONFIG['version']})
    (out / 'PLAN.md').write_text(plan_text)
    try:
        audit = json.loads(audit_path.read_text()) if audit_path.exists() else {}
        if approved_from:
            audit = json.loads((approved_from / 'audit.json').read_text())
        if audit.get('input_hash') == identity and audit.get('approved') is False and not recheck_approved:
            raise ValueError('Este hilo ya falló; revisa failure.json/copy-attempts.json y corrige la entrada antes de gastar otra vez')
        reusable = audit.get('approved') is True and audit.get('input_hash') == identity
        if reusable:
            raw = audit['draft']
            if audit.get('draft_hash') != rp.digest(raw): raise ValueError('Borrador auditado alterado')
            if not set(levels) <= set(audit.get('validated_levels', [])):
                raise ValueError('Nivel sin cotejo; genera ese nivel en otra salida')
            errors = hilo.draft_errors(raw, facts, list(raw['levels']))
            if errors: raise ValueError('Copy conservado inválido: ' + json.dumps(errors, ensure_ascii=False))
        elif photos_only:
            raise ValueError('Solo fotos requiere un hilo aprobado para la misma entrada y contrato')
        if not reusable or recheck_approved:
            raw = await hilo.write(facts, ctx, story=meta['historia'], levels=levels, usage_out=usage, audit_out=events,
                                   draft=audit.get('draft') if recheck_approved else None)
            audit = {'approved': True, 'narrativa': 'hilo', 'input_hash': identity, 'draft': raw,
                     'draft_hash': rp.digest(raw), 'validated_levels': levels, 'events': events,
                     'copy_sources': {f.claim_id: copy_origin(usage) for f in facts}}
        audit['mode'] = 'solo_texto' if solo_texto else 'photos_only' if photos_only else 'render'
        audit['slides'] = len(facts) + 1
        rp.save(audit_path, audit)
        if solo_texto:
            (out / 'texto.md').write_text(hilo.texto(raw, facts, ctx), encoding='utf-8')
            (out / 'failure.json').unlink(missing_ok=True)
            print(f'OK: {out / "texto.md"} · redacción real y cotejo; sin fotos ni render.', flush=True)
            return

        from .amarillista_media import find_relevant_images
        from .plan import build_image_plan
        from .render import render_async, ImageExportError
        from .validate import validate_jpeg, validate_plan
        from .service import _complete_photo_attribution
        from .copy import build_copy
        cache = LocalImageMediaCache(out / 'data')
        excluded = set(meta.get('media_exclude', []))
        photos = rp.load_photos(out / 'photos.json', facts, cache, excluded)
        decisions = []
        briefs = {f.claim_id: {'query': meta['fotos_sugeridas'][f.role], 'role': f.role} for f in facts}
        try:
            photos = await find_relevant_images(facts, ctx, cache, {'media_briefs': json.dumps(briefs),
                'media_exclude': list(excluded)}, usage_out=usage, existing=photos, decisions_out=decisions)
        finally:
            rp.save(out / 'photo-decisions.json', decisions)
        rp.save(out / 'photos.json', {key: {'fact_hash': rp.digest(vars(next(f for f in facts if f.claim_id == key))),
            'image': {k: v for k, v in asdict(image).items() if k != 'content'}} for key, image in photos.items()})
        qc = {}
        for level in levels:
            level_ctx = replace(ctx, level=level)
            for attempt in range(CONFIG['hilo']['max_reparaciones'] + 1):
                copies = hilo.copies_from_draft(raw, facts, level_ctx, copy_origin(usage), meta['fotos_sugeridas'])
                slides = hilo.build(facts, level_ctx, copies, photos)
                _complete_photo_attribution(slides, list(photos.values()), 'recortada y ajustada')
                for sl in slides:
                    for claim in sl['claim_refs']: claim['locator'] += '; ' + usages[claim['id']]
                plan = build_image_plan(category_id=ctx.category_id, source_video_id=folder.name, source_revision=identity,
                    template_id=CONFIG['predeterminado']['template_id'], slides=slides, style=style, seed=0)
                media = {m.asset_id: cache.get_by_sha256(m.sha256) for sl in plan.slides for m in sl.media}
                validate_plan(plan, style, media_bytes=media).require()
                target = out / level
                target.mkdir(exist_ok=True)
                rp.save(target / 'plan.json', plan.to_dict())
                os.environ['IMAGE_QC_DEBUG_DIR'] = str(out / 'debug' / level)
                try:
                    result = await render_async(plan, style, media)
                    break
                except ImageExportError as exc:
                    info = getattr(exc, 'qc', {}).get('shortening')
                    if photos_only or not info or not getattr(exc, 'qc', {}).get('overflow'): raise
                    repairs = [e for e in audit.get('events', []) if e.get('repair')]
                    repairs += audit.get('composition_repairs', [])
                    if len(repairs) >= CONFIG['hilo']['max_reparaciones']: raise
                    index = next((i for i, sl in enumerate(plan.slides) if sl.slide_id == getattr(exc, 'slide_id', '')), None)
                    if index is None or index == 0 or index >= len(facts): raise
                    fact = facts[index]
                    path = f'levels.{level}.items.{fact.claim_id}.text'
                    errors = {path: f'Desborde medido: máximo {info["max_chars"]} caracteres conservando el hilo y la evidencia'}
                    patch = await model_json('copy_repair', CONFIG['hilo']['prompt_reparacion'], json.dumps({
                        'rejected_fields': errors, 'field_evidence': {path: hilo.review_fields(raw, facts, [level])[path]},
                        'measurement': info}, ensure_ascii=False), usage_out=usage)
                    candidate = hilo.apply_patch(raw, patch, errors)
                    event = {'at': trace_now(), 'repair': patch, 'measurement': info, 'rejected_fields': errors}
                    audit.setdefault('composition_repairs', []).append(event)
                    rp.save(audit_path, audit)
                    value = hilo.fields(candidate, facts, [level])[path]
                    if len(value) > info['max_chars'] or hilo.draft_errors(candidate, facts, list(candidate['levels'])):
                        raise ValueError('Reparación medida inválida') from exc
                    displayed = hilo.review_fields(candidate, facts, list(candidate['levels']))
                    review = await model_json('fact_check', CONFIG['hilo']['prompt_cotejo'], json.dumps({
                        'historia': meta['historia'], 'displayed_fields': displayed}, ensure_ascii=False),
                        usage_out=usage, schema=CONFIG['hilo']['schema_cotejo'])
                    event['review'] = review
                    rp.save(audit_path, audit)
                    if hilo.review_errors(review, displayed): raise ValueError('Reparación de composición rechazada') from exc
                    raw = candidate
                    audit['draft'] = raw
                    audit['draft_hash'] = rp.digest(raw)
                    rp.save(audit_path, audit)
            records = []
            for i, asset in enumerate(result.assets, 1):
                validate_jpeg(asset.content, style, qc=asset.qc).require()
                (target / f'{i:02}.jpg').write_bytes(asset.content)
                records.append({**asset.to_record(), 'qc': asset.qc})
            qc[level] = records
            rp.save(out / 'qc.json', qc)
            rp.contact_sheet([target / f'{i:02}.jpg' for i in range(1, len(slides) + 1)],
                [f.role.upper() for f in facts] + ['CIERRE'], out / f'contactos-{level}.png')
            v = raw['levels'][level]
            publish = {'schema_version': 2, 'titles': {'facebook': {'title': v['statement']}},
                       'description': {'question': v['question']}, 'sources': meta['sources']}
            rp.save(out / f'caption-{level}.json', build_copy(plan, publish).to_dict())
        rp.contact_sheet([out / level / '01.jpg' for level in levels], levels, out / 'contactos-niveles.png')
        audit['render_complete'] = True
        rp.save(audit_path, audit)
        (out / 'failure.json').unlink(missing_ok=True)
        print(f'OK: {out} · hilo, JPEG, QC y hojas. Sin publicación.', flush=True)
    except Exception as exc:
        if not events or not any(e.get('accepted') for e in events):
            if not locals().get('reusable', False):
                rp.save(audit_path, {'approved': False, 'narrativa': 'hilo', 'input_hash': identity, 'events': events})
        rp.save(out / 'failure.json', {'error': str(exc), 'input_hash': identity})
        raise
    finally:
        if events: rp.save(out / 'copy-attempts.json', events)
        rp.save(out / 'usage.json', usage)
