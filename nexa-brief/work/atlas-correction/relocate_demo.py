"""Correct a previously passed episode to a registered principal demo.

Dry-run is the default. --apply requires a clean technical review. --recover
rolls back an interrupted transaction from its profile-owned metadata journal.
This tool does not invoke AI, image capture, recording or publication.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path

from src.adapters.data.file_locks import AsyncFileLock
from src.adapters.showcase.filesystem import _write
from src.adapters.showcase.production import FilesystemDesignProduction, fingerprint, rewrite_references
from src.adapters.showcase.technical_review import review_files
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.content_registry import get_video, upsert_video
from src.core.data import collection, coordination, documents
from src.core.explainer.production_templates import ID


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def category_snapshot(config, ident):
    return {key: {field: ident in node.get(field, []) for field in ('designs', 'shared_designs')}
            for key, node in config['categories'].items()}


def set_categories(ident, category, previous=None):
    from src.core.category_creation import _config_lock, _write_config_atomically
    from src.core.categories import reload_categories
    with _config_lock(settings.niches_path):
        config = json.loads(settings.niches_path.read_text())
        if category not in config['categories']:
            raise ValueError('Categoría principal inexistente')
        for key, node in config['categories'].items():
            old = (previous or {}).get(key, {})
            was_assigned = ident in node.get('designs', []) or ident in node.get('shared_designs', [])
            for field in ('designs', 'shared_designs'):
                values = [x for x in node.get(field, []) if x != ident]
                if previous is not None:
                    if old.get(field): values.append(ident)
                elif (field == 'designs' and key == category or
                      field == 'shared_designs' and key != category and
                      was_assigned):
                    values.append(ident)
                node[field] = values
        _write_config_atomically(settings.niches_path, config)
    reload_categories()


def restore_text(path, original):
    if original is None:
        path.unlink(missing_ok=True)
    else:
        # JSON files are restored atomically, preserving their semantic contents.
        _write(path, json.loads(original))


async def rollback(journal_path, journal):
    source, target = Path(journal['source']), Path(journal['target'])
    if source.exists() and target.exists():
        raise RuntimeError('Ambos destinos existen: recuperación requiere revisión manual')
    directory = target if target.exists() else source
    if not directory.exists():
        raise RuntimeError('No se encuentra la carpeta: recuperación requiere revisión manual')
    for relative, original in journal['files'].items():
        restore_text(directory / relative, original)
    if directory == target:
        os.rename(target, source)
    restore_text(Path(journal['definition']), journal['definition_before'])
    set_categories(journal['design_id'], journal['category'], journal['category_before'])
    if journal['showcase_before']:
        await collection('showcase_designs').upsert(journal['showcase_before'], match=['id'])
    else:
        await collection('showcase_designs').delete(journal['design_id'])
    previous = journal['old_video']
    if previous:
        await upsert_video(journal['old_id'], previous['production_id'], details=previous.get('details') or {})
    await collection('content_videos').delete(journal['new_id'])
    documents('content_video_details').delete(journal['new_id'])
    journal['state'] = 'rolled_back'
    _write(journal_path, journal)


async def run(args):
    for name in ('folder', 'old_id', 'new_id', 'design_id', 'category'):
        if not ID.fullmatch(getattr(args, name)):
            raise ValueError(f'Identificador inválido: {name}')
    layout = layout_for_settings(settings)
    if layout.schema_version != 3:
        raise ValueError('Se requiere perfil v3')
    source = layout.productions_dir / args.folder / args.old_id
    target = settings.templates_dir / args.folder / args.new_id
    definition = settings.templates_dir / '_tools/design-definitions' / args.design_id / 'design.json'
    journal_path = layout.runtime_dir / 'design-production-corrections' / f'{args.design_id}.json'
    async with coordination('showcase'), AsyncFileLock(settings.templates_dir / '.pass-to-production.lock'):
        if args.recover:
            journal = json.loads(journal_path.read_text())
            if journal.get('state') != 'moving': raise ValueError('No hay traslado interrumpido')
            await rollback(journal_path, journal)
            print(json.dumps({'state':'rolled_back'})); return
        if journal_path.is_file() and json.loads(journal_path.read_text()).get('state') == 'moving':
            raise ValueError('Hay un traslado interrumpido; usa --recover')
        if source.is_symlink() or not source.is_dir() or target.exists() or target.is_symlink():
            raise ValueError('Origen inválido o destino ya existe')
        if get_video(args.new_id) is not None:
            raise ValueError('El nuevo ID ya existe en el registro')
        if documents('content_video_details').get(args.new_id) is not None:
            raise ValueError('El nuevo ID ya tiene detalles registrados')
        from src.core.explainer.catalog import list_videos
        if any(video.video_id == args.new_id for video in list_videos()):
            raise ValueError('El nuevo ID ya existe en el catálogo')
        for job in collection('editorial_preparations').list():
            if job.get('video_id') in {args.old_id, args.new_id} and job.get('state') in {'queued', 'running'}:
                raise ValueError('El video tiene una preparación editorial activa')
        prior = get_video(args.old_id)
        if not prior or prior['details'].get('folder_key') != f'productions/{args.folder}/{args.old_id}':
            raise ValueError('El registro no coincide con el origen')
        if prior.get('resources') or prior.get('logs'):
            raise ValueError('El video tiene recursos o registros asociados; requiere migración adicional')
        manifest = json.loads((source/'manifest.json').read_text())
        info = json.loads((source/'info.json').read_text())
        design = json.loads(definition.read_text())
        if manifest.get('demo') is not True or manifest.get('design') != args.design_id:
            raise ValueError('El origen no es una demo del diseño solicitado')
        if manifest.get('category') != args.category or design.get('production_template'):
            raise ValueError('Categoría incorrecta o el diseño ya tiene demo principal')
        if info.get('engine') != design.get('engine_id'):
            raise ValueError('El motor de la demo no coincide con el diseño')
        showcase = FilesystemDesignProduction().showcase
        contract = showcase._definition(args.design_id)
        catalog = contract[1] if contract else {}
        if not catalog.get('entries'):
            raise ValueError('El catálogo de componentes no está disponible')
        if any(not e.get('label') or not e.get('summary') or
               (e.get('preview_kind') == 'iframe' and not e.get('preview_url'))
               for e in catalog['entries']):
            raise ValueError('Faltan datos o vistas previas en el catálogo')
        report = review_files(source, args.folder, args.old_id, target, rewrite_references)
        if report['issues']: raise ValueError('; '.join(report['issues']))
        before_hash = fingerprint(source)
        poster_hash = digest(source/'assets/thumbnails/poster.jpg')
        if not poster_hash: raise ValueError('No se encontró la miniatura existente')
        config = json.loads(settings.niches_path.read_text())
        if args.category not in config['categories']: raise ValueError('Categoría principal inexistente')
        if config['categories'][args.category].get('folder') != args.folder:
            raise ValueError('La carpeta no corresponde a la categoría')
        if not args.apply:
            print(json.dumps({'state':'dry_run','source':str(source),'target':str(target),
                'files':report['files_checked'],'resources':report['resources_checked'],
                'components':len(catalog['entries']),'warnings':report['warnings']})); return
        files = {}
        for name in ('manifest.json','info.json','production-template.json','work/production/preparation.json'):
            p=source/name; files[name]=p.read_text() if p.exists() else None
        journal = {'state':'moving','source':str(source),'target':str(target), 'old_id':args.old_id,
            'new_id':args.new_id,'design_id':args.design_id,'category':args.category,
            'files':files,'definition':str(definition),'definition_before':definition.read_text(),
            'category_before':category_snapshot(config,args.design_id),
            'old_video':prior,'showcase_before':collection('showcase_designs').get(args.design_id)}
        _write(journal_path,journal)
        try:
            if fingerprint(source) != before_hash: raise ValueError('Los archivos cambiaron desde la revisión')
            os.rename(source,target)
            manifest.update(video_id=args.new_id, demo=True)
            info.update(is_new_design=True)
            _write(target/'manifest.json',manifest)
            _write(target/'info.json',info)
            _write(target/'production-template.json',{'design_id':args.design_id,'demo':True,
                'origin':f'sandbox/{args.folder}/{args.old_id}'})
            record_path=target/'work/production/preparation.json'
            record=json.loads(record_path.read_text()) if record_path.exists() else {}
            record.setdefault('draft',{}).update(demo=True)
            record.update(state='production', component_count=len(catalog['entries']))
            record['correction_review']={**report,'warnings':report['warnings']+['Revisión visual manual pendiente']}
            _write(record_path,record)
            marker={'folder':f'{args.folder}/{args.new_id}','demo':True,
                'origin_folder':args.folder,'project_id':args.old_id,
                'title':manifest.get('title',''),
                'preview_url':f'/api/v1/explainer/files/bundled/{args.folder}/{args.new_id}/index.html',
                'aliases':[args.old_id], 'legacy_production_folders':[f'{args.folder}/{args.old_id}']}
            design.update(category=args.folder, category_path=args.category,production_template=marker)
            _write(definition,design)
            set_categories(args.design_id,args.category)
            show = journal['showcase_before'] or {'id':args.design_id,'definition_ref':args.design_id}
            show={**show,'category_path':args.category}
            await collection('showcase_designs').upsert(show,match=['id'])
            details={**prior['details'],'folder_key':f'bundled/{args.folder}/{args.new_id}'}
            await upsert_video(args.new_id, prior['production_id'],details=details)
            await upsert_video(args.old_id, prior['production_id'],details=details)
            if digest(target/'assets/thumbnails/poster.jpg') != poster_hash:
                raise ValueError('La miniatura cambió durante el traslado')
            journal['state']='complete'
            _write(journal_path,journal)
        except BaseException:
            await rollback(journal_path,journal)
            raise
        print(json.dumps({'state':'complete','source':str(source),'target':str(target),
            'files':report['files_checked'],'resources':report['resources_checked'],
            'components':len(catalog['entries']),'poster_sha256':poster_hash,
            'design_state':design.get('state'),'engine':design.get('engine_id')}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for flag in ('folder','old-id','new-id','design-id','category'):
        parser.add_argument('--'+flag,required=True)
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--apply',action='store_true')
    mode.add_argument('--recover',action='store_true')
    asyncio.run(run(parser.parse_args()))
