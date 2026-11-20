#!/usr/bin/env python3
"""Herramientas iniciales para promos NodeMotion; no graba ni publica."""
from __future__ import annotations


import argparse
import asyncio
import json
import os
import re
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

SERVER = Path(__file__).resolve().parents[6]
SKILL = SERVER / 'src/templates/_tools/nodemotion/promo/production'
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))

from src.core.nodemotion.promo.prompts import project_reference_path

from src.core.nodemotion.promo.paths import work_script_path


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def validate_schema(name: str, data):
    schema = read_json(SKILL / 'schemas' / f"{'script' if name == 'guion' else name}.json")
    errors = sorted(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(data), key=lambda e: str(list(e.path)))
    if errors:
        raise ValueError('; '.join(f"{'.'.join(map(str, e.path)) or '$'}: {e.message}" for e in errors))


def profile() -> Path:
    value = os.environ.get('NEXA_PROFILE_DIR')
    if not value:
        raise ValueError('NEXA_PROFILE_DIR no está definida; cargá scripts/profile-env.sh con bash')
    root = Path(value).resolve(strict=True)
    manifest = read_json(root / 'profile.json')
    if manifest.get('schema_version') not in (2, 3):
        raise ValueError('el perfil debe tener esquema v2 o v3')
    return root


def project(ident: str) -> Path:
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', ident):
        raise ValueError('id inválido: usá letras minúsculas, números y guiones')
    selected = profile()
    root = selected / 'sandbox' / 'nodemotion'
    if not root.resolve().is_relative_to(selected):
        raise ValueError('el sandbox sale del perfil seleccionado')
    target = root / ident
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError('el proyecto sale del sandbox')
    return target


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


def new(args):
    data = read_json(Path(args.brief))
    validate_schema('brief', data)
    target = project(args.id)
    brief = target / 'brief.json'
    existed = target.exists()
    if existed:
        if not brief.is_file() or read_json(brief) != data:
            raise ValueError('el destino ya existe con otro contenido; no se modifica')
    else:
        target.mkdir(parents=True)
        write_json(brief, data)
    from src.core.nodemotion.promo.prompts import pin_project
    if not existed or (project_reference_path(target)).exists():
        pin_project(target)
    print(target)


def prompt(args):
    from src.core.nodemotion.promo.prompts import resolve_project
    print(resolve_project(project(args.id), args.stage), end='')


def prompts_audit(args):
    from src.core.nodemotion.promo.prompts import pin_project, reference
    target = project(args.id)
    path = project_reference_path(target)
    if args.adopt:
        result = pin_project(target, adopt=True)
    elif path.exists():
        result = pin_project(target)
    else:
        result = {'status': 'legacy_sin_referencia', 'active': reference()['version']}
    print(json.dumps(result, ensure_ascii=False, indent=2))


def prompts_migrate(args):
    from prompt_migration import migrate
    print(json.dumps(migrate(project(args.id), apply=args.apply), ensure_ascii=False, indent=2))


def research(args):
    target = project(args.id)
    if not (target / 'brief.json').is_file():
        raise ValueError('creá primero el proyecto')
    data = read_json(Path(args.input))
    validate_schema('research', data)
    for finding in data['findings']:
        if len({source['url'] for source in finding['sources']}) < 2:
            raise ValueError('cada hallazgo requiere dos URL distintas')
    if data['topic'] != read_json(target / 'brief.json')['topic']:
        raise ValueError('el tema no coincide con el brief')
    lines = [f"# {data['topic']}", '']
    for finding in data['findings']:
        lines += [f"- {finding['claim']}"]
        lines += [f"  - {s['title']}: {s['url']} (dato: {s['data_date'] or 'sin fecha publicada'}; consulta: {s['accessed_at']})" for s in finding['sources']]
    folder = target / 'work/research'
    write_json(folder / 'research.json', data)
    (folder / 'research.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(folder)


def fact_errors(script, research_data):
    findings = research_data.get('findings', [])
    identifiers = [item.get('id') for item in findings if item.get('id')]
    errors = []
    if len(identifiers) != len(set(identifiers)):
        errors.append('hay IDs de investigación duplicados')
    known = set(identifiers)
    for index, segment in enumerate(script.get('segments', []), 1):
        refs = segment.get('facts', [])
        unknown = set(refs) - known
        if unknown:
            errors.append(f'segmento {index}: facts desconocidos: {", ".join(sorted(unknown))}')
        text = ' '.join(segment.get('lines', [])) or segment.get('text', '')
        if re.search(r'\d', text) and not (set(refs) & known):
            errors.append(f'segmento {index}: cifra sin fact existente')
    return errors


def check(args):
    target = project(args.id)
    script_path = work_script_path(target)
    research_path = target / 'work/research/research.json'
    errors = []
    prompt_ref = project_reference_path(target)
    if prompt_ref.exists():
        from src.core.nodemotion.promo.prompts import pin_project
        try:
            pin_project(target)
        except (ValueError, OSError, KeyError, TypeError) as exc:
            errors.append(f'referencia de prompts inválida: {exc}')
    if script_path.is_file() and research_path.is_file():
        errors.extend(fact_errors(read_json(script_path), read_json(research_path)))
    else:
        errors.append('faltan guion o investigación')
    if not (target / 'draft.json').is_file():
        errors.append('falta draft.json')
    if errors:
        print(json.dumps({'ready': False, 'errors': errors}, ensure_ascii=False))
        return 1
    from draft_workflow import call
    from preview_check import evaluate
    result = evaluate(project(args.id), profile(), read_json, write_json, call, full=getattr(args,'full',False))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ready'] else 1


def usage(args):
    ledger = project(args.id) / 'logs/usage.jsonl'
    entries = [json.loads(line) for line in ledger.read_text(encoding='utf-8').splitlines() if line.strip()] if ledger.is_file() else []
    for path in args.codex_log or []:
        file = Path(path)
        content = file.read_text(encoding='utf-8')
        if not re.search(r'(?m)^EXIT \d+\s*\Z', content):
            raise ValueError(f'el log no está cerrado: {file.name}')
        matches = re.findall(r'(?m)^tokens used\s*\n([\d,]+)\s*$', content)
        if not matches:
            raise ValueError(f'el log cerrado no informa tokens: {file.name}')
        if not any(file.name in e.get('note', '') and e.get('reported_total_tokens') is not None for e in entries):
            entry = {'ts': datetime.now(timezone.utc).isoformat(), 'provider':'codex', 'model':'', 'role':'producer',
                     'step':'codex-log', 'input_tokens':None, 'cached_input_tokens':None, 'output_tokens':None,
                     'seconds':None, 'ok':True, 'billing':'unknown', 'note':f'Total del cierre de {file.name}; desglose no informado.',
                     'reported_total_tokens':int(matches[-1].replace(',', ''))}
            validate_schema('usage-entry', entry)
            ledger.parent.mkdir(parents=True, exist_ok=True)
            with ledger.open('a', encoding='utf-8') as stream:
                stream.write(json.dumps(entry, ensure_ascii=False)+'\n')
            entries.append(entry)
    for entry in entries:
        validate_schema('usage-entry', entry)
    fields = ('input_tokens','cached_input_tokens','output_tokens','reasoning_tokens')
    totals = {f: sum(e[f] for e in entries if e.get(f) is not None) if any(e.get(f) is not None for e in entries) else None for f in fields}
    # Algunos logs de Codex solo informan un total, sin desglose de entrada/salida.
    # No lo repartimos entre campos ni lo sumamos a entradas que ya tienen desglose.
    reported_totals = [e['reported_total_tokens'] for e in entries if e.get('reported_total_tokens') is not None]
    summary = {'entries':len(entries),'usage_available':bool(entries),'tokens':totals,
               'reported_total_tokens':sum(reported_totals) if reported_totals else None,
               'unknown_token_entries':sum(any(e.get(f) is None for f in fields[:3]) for e in entries),'steps':{}}
    for e in entries:
        key = e['step']
        group = summary['steps'].setdefault(key, {'entries':0, 'reported_total_tokens':None, **{f:None for f in fields}})
        group['entries'] += 1
        if e.get('reported_total_tokens') is not None:
            group['reported_total_tokens'] = (group['reported_total_tokens'] or 0) + e['reported_total_tokens']
        for f in fields:
            if e.get(f) is not None:
                group[f] = (group[f] or 0) + e[f]
    validate_schema('usage', summary)
    write_json(project(args.id) / 'usage.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def build(args):
    from build import build as run
    result = run(profile(), project(args.id), read_json, write_json, validate_schema)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def timing(args):
    from timing import run
    result = run(project(args.id), read_json, write_json, validate_schema)
    print(json.dumps({'segments': len(result['segments']), 'duration_seconds': result['metadata']['audio_duration_sec']}, ensure_ascii=False))


def still_clip(args):
    from media import still_clip as run
    result = asyncio.run(run(profile(), project(args.id), args.id, args.asset, args.duration, args.focus, write_json, validate_schema))
    print(json.dumps(result, ensure_ascii=False, indent=2))


def fetch(args):
    from media import fetch as run
    return asyncio.run(run(profile(), project(args.id), args.id, read_json, write_json, validate_schema))

def candidates(args):
    from media import candidates as run
    result = asyncio.run(run(profile(), project(args.id), args.id, args.provider, args.query,
                             args.kind, args.orientation, read_json, write_json))
    print(json.dumps(result, ensure_ascii=False, indent=2))


def music(args):
    from media import music as run, link_music
    root=profile(); target=project(args.id)
    result=asyncio.run(run(root, target, args.id, write_json, validate_schema))
    if result == 0:
        link_music(root, target)
    return result


def inspect_video(args):
    root = profile()
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', args.asset):
        raise ValueError('id de recurso inválido')
    folder = root / 'resources/videos' / args.asset
    meta = read_json(folder / 'resource.json')
    source = (folder / meta['file']).resolve(strict=True)
    if not source.is_relative_to(folder.resolve()):
        raise ValueError('archivo fuera del recurso')
    duration = float(meta['duration_seconds'])
    out = project(args.id) / 'work/results/test' / ('recurso-' + args.asset)
    out.mkdir(parents=True, exist_ok=True)
    for index in range(6):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(duration * (index + .5) / 6),
                        '-i', str(source), '-frames:v', '1', str(out / f'{index + 1}.png')], check=True)
    print(out)


def select_media(args):
    target = project(args.id)
    plan = read_json(target / 'media-plan.json')
    matches = [item for item in plan['items'] if item['slot'] == args.slot]
    if not matches:
        raise ValueError('slot desconocido')
    for item in matches:
        item.update(query=args.query)
        for key in ('asset_id','provider','provider_id','sha256','required_terms'):
            item.pop(key,None)
        if getattr(args, 'require_term', None):item['required_terms']=args.require_term
        if getattr(args, 'provider', None):item['provider']=args.provider
        if getattr(args, 'provider_id', None):item['provider_id']=args.provider_id
    validate_schema('media-plan',plan)
    write_json(target / 'media-plan.json', plan)


def reject_video(args):
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', args.asset) or not args.reason.strip():
        raise ValueError('id o motivo inválido')
    path = profile() / 'resources/videos' / args.asset / 'resource.json'
    data = read_json(path)
    data['approved'] = False
    data['rejection_reason'] = args.reason.strip()
    write_json(path, data)


def set_brand(args):
    path = project(args.id) / 'brief.json'
    brief = read_json(path)
    brief['texts']['brand.left'] = args.left
    brief['texts']['brand.right'] = args.right
    validate_schema('brief', brief)
    write_json(path, brief)


def draft(args):
    from draft_workflow import create, recreate
    if args.recreate:
        if not args.thumbnail_a or not args.thumbnail_b or args.frame_time is None or args.frame_time < 0:
            raise ValueError('--recreate requiere --thumbnail-a, --thumbnail-b y --frame-time')
        result = recreate(profile(), project(args.id), args.id, read_json, write_json, args.thumbnail_a, args.thumbnail_b, args.frame_time, keep_previous=args.keep_previous, defer_preparation=args.defer_preparation)
    else:
        result = create(profile(), project(args.id), args.id, read_json, write_json)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def prepare(args):
    from draft_workflow import prepare as run
    result = run(project(args.id), read_json)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def thumbnail_side(args):
    from draft_workflow import thumbnail_side as run
    run(project(args.id), read_json, args.option, args.side)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('prompts-migrate'); p.add_argument('--id', required=True); p.add_argument('--apply', action='store_true'); p.set_defaults(func=prompts_migrate)
    p = sub.add_parser('new'); p.add_argument('--id', required=True); p.add_argument('--brief', required=True); p.set_defaults(func=new)
    p = sub.add_parser('prompt'); p.add_argument('--id', required=True); p.add_argument('--stage', required=True, choices=('base','investigar','escribir','revisar','medios','ritmo','contexto','publicar','miniaturas')); p.set_defaults(func=prompt)
    p = sub.add_parser('prompts-audit'); p.add_argument('--id', required=True); p.add_argument('--adopt', action='store_true'); p.set_defaults(func=prompts_audit)
    p = sub.add_parser('research'); p.add_argument('--id', required=True); p.add_argument('--input', required=True); p.set_defaults(func=research)
    p = sub.add_parser('build'); p.add_argument('--id', required=True); p.set_defaults(func=build)
    p = sub.add_parser('timing'); p.add_argument('--id', required=True); p.set_defaults(func=timing)
    p = sub.add_parser('still-clip'); p.add_argument('--id', required=True); p.add_argument('--asset', required=True); p.add_argument('--duration', type=float, default=8); p.add_argument('--focus', type=float, nargs=2, default=[.5, .5]); p.set_defaults(func=still_clip)
    p = sub.add_parser('fetch'); p.add_argument('--id', required=True); p.set_defaults(func=fetch)
    p = sub.add_parser('candidates'); p.add_argument('--id', required=True); p.add_argument('--provider', required=True); p.add_argument('--query', required=True); p.add_argument('--kind', required=True, choices=('image','video')); p.add_argument('--orientation', default='landscape', choices=('landscape','portrait','square')); p.set_defaults(func=candidates)
    p = sub.add_parser('music'); p.add_argument('--id', required=True); p.set_defaults(func=music)
    p = sub.add_parser('inspect-video'); p.add_argument('--id', required=True); p.add_argument('--asset', required=True); p.set_defaults(func=inspect_video)
    p = sub.add_parser('select-media'); p.add_argument('--id', required=True); p.add_argument('--slot', required=True); p.add_argument('--query', required=True); p.add_argument('--require-term',action='append'); p.add_argument('--provider'); p.add_argument('--provider-id'); p.set_defaults(func=select_media)
    p = sub.add_parser('reject-video'); p.add_argument('--asset', required=True); p.add_argument('--reason', required=True); p.set_defaults(func=reject_video)
    p = sub.add_parser('set-brand'); p.add_argument('--id', required=True); p.add_argument('--left', required=True); p.add_argument('--right', required=True); p.set_defaults(func=set_brand)
    p = sub.add_parser('draft'); p.add_argument('--id', required=True); p.add_argument('--recreate', action='store_true'); p.add_argument('--keep-previous', action='store_true'); p.add_argument('--defer-preparation', action='store_true'); p.add_argument('--thumbnail-a'); p.add_argument('--thumbnail-b'); p.add_argument('--frame-time', type=float); p.set_defaults(func=draft)
    p = sub.add_parser('prepare'); p.add_argument('--id', required=True); p.set_defaults(func=prepare)
    p = sub.add_parser('thumbnail-side'); p.add_argument('--id', required=True); p.add_argument('--option', choices=('A','B'), required=True); p.add_argument('--side', choices=('left','right'), required=True); p.set_defaults(func=thumbnail_side)
    p = sub.add_parser('check'); p.add_argument('--id', required=True); p.add_argument('--full',action='store_true'); p.set_defaults(func=check)
    p = sub.add_parser('usage'); p.add_argument('--id', required=True); p.add_argument('--codex-log', action='append'); p.set_defaults(func=usage)
    args = parser.parse_args()
    try:
        return args.func(args) or 0
    except Exception as exc:  # La CLI informa también errores de proveedores y ffmpeg.
        print(f'Error: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
