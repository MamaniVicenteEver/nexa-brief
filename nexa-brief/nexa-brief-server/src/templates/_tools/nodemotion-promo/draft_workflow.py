"""Integración de previews de promo con la biblioteca y la API de drafts.

Nunca solicita render ni publicación. Rechaza datos cambiados cuando la API no
ofrece una actualización de inputs, para evitar reusar un draft equivocado.
"""
from __future__ import annotations

import asyncio
import copy
from src.core.template_config import active_config
import hashlib
import json
import os
import sys
import time
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SERVER = Path(__file__).resolve().parents[4]
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))

from src.core.data import collection
from src.core.library import asset_library

BASE = 'http://localhost:8000/api/v1'

def call(target, method, path, payload=None):
    started=time.monotonic(); ok=False; note=f'{method} {path}'
    try:
        data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode()
        req=Request(BASE+path,data=data,method=method,headers={'Content-Type':'application/json'})
        with urlopen(req,timeout=30) as response:
            raw=response.read(); ok=True
            return json.loads(raw) if raw and 'json' in response.headers.get('Content-Type','') else raw
    except HTTPError as exc:
        note+=f' HTTP {exc.code}: {exc.read().decode(errors="replace")[:500]}'
        raise RuntimeError(note) from exc
    finally:
        from media import log
        log(target,'nexa-local','draft-api',note,started,ok)

def wait_for(target, ident, states, timeout=900):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        d=call(target,'GET',f'/drafts/{ident}')
        if d.get('status') in states:
            if d.get('errors'): raise RuntimeError(f"draft con errores: {d['errors']}")
            return d
        if d.get('status')=='failed': raise RuntimeError(f"draft fallido: {d.get('errors')}")
        time.sleep(2)
    raise TimeoutError('tiempo de espera agotado para draft '+ident)

async def derived_music(root, target, project_id, read_json, write_json):
    original=read_json(target/'music.json'); old=original['asset_id']
    # Para reanudar también se acepta que music.json ya señale al derivado.
    meta=read_json(root/'resources/music'/old/'resource.json')
    file=(root/'resources/music'/old/original['ready_file']).resolve(strict=True)
    digest=asset_library.hash_file(file)
    records=collection('music_assets')
    lyrics=read_json(target/'assets/lyrics.json')
    existing=next((x for x in records.list() if x.get('derived_from')==old and x.get('content_hash')==digest
                   and asset_library.get_lyrics_cache(x['asset_id']) in (None,lyrics)),None)
    if existing:
        ident=existing['asset_id']
    else:
        parent=records.get(old)
        if not parent: raise ValueError('música original ausente de la biblioteca')
        ident=uuid.uuid4().hex[:8]
        relative=str(Path(parent['relative_path']).with_name(file.name))
        record=copy.deepcopy(parent)
        record.update(asset_id=ident,relative_path=relative,original_filename=file.name,
                      content_hash=digest,duration_seconds=original['duration_seconds'],
                      derived_from=old,used_by=[project_id],has_lyrics_cache=False,
                      track_name=parent.get('track_name','')+f" ({original['duration_seconds']:g} s)",
                      added_at=datetime.now(timezone.utc).isoformat(),added_by_job_id=project_id)
        await records.insert(record)
    if asset_library.resolve_music_path(ident).resolve()!=file:
        raise ValueError('la biblioteca no resolvió la pista recortada esperada')
    lyrics=read_json(target/'assets/lyrics.json')
    cached = asset_library.get_lyrics_cache(ident)
    if cached is not None and cached != lyrics:
        raise ValueError('el recurso musical derivado ya tiene otra letra; no se sobrescribe')
    if cached is None:
        await asset_library.save_lyrics_cache(ident,lyrics)
    if asset_library.get_lyrics_cache(ident)!=lyrics:
        raise ValueError('la caché de letra no coincide con el guion')
    # Ficha propia sin reemplazar la ficha del original, pues ambas pistas
    # comparten carpeta y cada una tiene un único archivo físico.
    detail=copy.deepcopy(meta)
    detail.update(id=ident,derived_from=old,file=file.name,ready_file=None,hash=digest,
                  duration_seconds=original['duration_seconds'],used_by=[project_id])
    write_json(file.parent/f'resource-{ident}.json',detail)
    return ident

def create(root,target,project_id,read_json,write_json, state_name='draft.json'):
    brief=read_json(target/'brief.json'); plan=read_json(target/'media-plan.json')
    spec=read_json(Path(__file__).resolve().parents[3]/'skills/nodemotion/promo/templates'/f"{brief['template']}.json")
    byslot={x['slot']:x['asset_id'] for x in plan['items']}
    # Las entradas del config se rellenan por tipo y en su propio orden.
    def ordered_inputs(kind):
        entries=[e for e in spec['default_media'] if e['type']==kind]
        used=[byslot[e['id']] for e in entries if e['id'] in byslot]
        # La API asigna por posición a todos los slots del config, incluso los
        # que no usa el ciclo. Rellenarlos evita desplazar los slots posteriores.
        return [byslot.get(e['id'], used[0]) for e in entries] if used else []
    clips=ordered_inputs('video')
    photos=ordered_inputs('image')
    music=asyncio.run(derived_music(root,target,project_id,read_json,write_json))
    # Verifica que el proceso del servidor ve el mismo perfil y la misma letra.
    call(target,'GET',f'/library/music/{music}')
    actual=call(target,'GET',f'/library/music/{music}/lyrics')
    if actual!=read_json(target/'assets/lyrics.json'): raise ValueError('la API no ve la misma caché de letra del perfil')
    allowed={x['key'] for x in spec['inputs']['texts']}
    payload={'template_id':brief['template'],'name':brief['name'],'music_asset_id':music,
             'template_inputs':{'media':{'clips':clips,'photos':photos},
                                'texts':{k:v for k,v in brief['texts'].items() if k in allowed},
                                'brief':brief['topic']+'. '+brief['tone']+'. '+brief['language']}}
    identity={'request':payload,'lyrics':read_json(target/'assets/lyrics.json')}
    # Todo build validado determina la identidad, incluso sin overrides explícitos.
    if (target/'assets/config.json').is_file():
        identity['scene_config']=read_json(target/'assets/config.json')
    fingerprint=hashlib.sha256(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    state_path=target/state_name
    if state_path.exists():
        state=read_json(state_path)
        if state.get('fingerprint')!=fingerprint: raise ValueError('inputs cambiaron; la API no permite actualizarlos en un draft existente')
        ident=state['draft_id']; call(target,'GET',f'/drafts/{ident}')
    else:
        d=call(target,'POST','/drafts',payload); ident=d['draft_id']
        write_json(state_path,{'draft_id':ident,'music_asset_id':music,'fingerprint':fingerprint,'request':payload})
    result=wait_for(target,ident,{'preview_ready','prepared'})
    bind_prompt_reference(target, ident)
    if (target/'assets/config.json').is_file():
        sync_scene_config(target, ident, read_json)
    return result

def sync_scene_config(target, ident, read_json):
    """Conserva las escenas y la identidad editorial del build en su preview.

    La API resuelve medios, audio y rutas; la promo conserva su introducción,
    cierre y paleta, incluso después de preparar los detalles de la música.
    """
    from src.core import drafts
    job=drafts.load_job(ident)
    if job is None:
        raise ValueError('draft sin job para sincronizar escenas')
    output=job.artifacts.output_dir.resolve(strict=True)
    content=job.artifacts.content_dir.resolve(strict=True)
    if not content.is_relative_to(output):
        raise ValueError('contenido del draft fuera de su output')
    path=content/'config.json'
    if path.is_symlink() or not path.is_file():
        raise ValueError('config del draft ausente o enlazado')
    built=read_json(target/'assets/config.json')
    desired=active_config(built)
    current=read_json(path)
    effective=active_config(current)
    scenes=desired.get('scenes')
    if not isinstance(scenes,list) or not scenes:
        raise ValueError('build sin escenas válidas')
    media_ids={item['id'] for item in effective.get('media',[])}
    if any(slot not in media_ids for scene in scenes for slot in scene.get('media',[])):
        raise ValueError('el preview no contiene los medios de las escenas')
    effective['scenes']=copy.deepcopy(scenes)
    editorial={key:copy.deepcopy(desired[key]) for key in ('intro','outro','palette') if key in desired}
    effective.update(editorial)
    tagline=desired.get('brand',{}).get('tagline')
    if tagline is not None:
        effective.setdefault('brand',{})['tagline']=tagline
    handle=tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=content,prefix='.scene-config-',delete=False)
    temporary=Path(handle.name)
    try:
        with handle:
            json.dump(current,handle,ensure_ascii=False,indent=2)
            handle.flush(); os.fsync(handle.fileno())
        os.replace(temporary,path)
    finally:
        temporary.unlink(missing_ok=True)
    saved=active_config(read_json(path))
    if saved['scenes']!=scenes or any(saved.get(key)!=value for key,value in editorial.items()):
        raise ValueError('la configuración editorial del preview no coincide con el build')


def bind_prompt_reference(target, ident):
    path = target/'work/instrucciones/prompts-version.json'
    if not path.is_file():
        return  # Proyectos históricos sin adopción conservan el comportamiento previo.
    from src.core import drafts
    from src.core.promo_prompts import bind_reference, reference_file
    job = drafts.load_job(ident)
    if job is None or job.artifacts.output_dir is None:
        raise ValueError('draft sin output para fijar la versión de prompts')
    output = job.artifacts.output_dir.resolve(strict=True)
    bind_reference(output/'promo-prompts-version.json', reference_file(path))


def prepare(target,read_json, ident=None):
    ident=ident or read_json(target/'draft.json')['draft_id']
    bind_prompt_reference(target, ident)
    d=call(target,'GET',f'/drafts/{ident}')
    if d['status']!='prepared':
        if d['status']=='preview_ready': call(target,'POST',f'/drafts/{ident}/prepare',{})
        d=wait_for(target,ident,{'prepared'})
    credits=[]
    resource_fichas=[]
    root=target.parents[2]
    for item in read_json(target/'media-plan.json')['items']:
        folder='videos' if item['kind']=='video' else 'images'
        meta=read_json(root/'resources'/folder/item['asset_id']/'resource.json')
        resource_fichas.append(meta)
        if meta['attribution'] not in credits: credits.append(meta['attribution'])
    music=read_json(target/'music.json'); meta=read_json(root/'resources/music'/music['asset_id']/'resource.json')
    credits.append(meta['attribution'])
    resource_fichas.append(meta)
    details=d.get('details') or {}; credit_text='Créditos:\n'+'\n'.join(credits)
    base_research=details.get('research','').split('\n\nCréditos:\n',1)[0].strip()
    desired_research=(base_research+'\n\n'+credit_text).strip()
    from src.core.promos.credits import apply_credits
    original_details=copy.deepcopy(details)
    details['research']=desired_research
    details=apply_credits(details, resource_fichas, music_edited=bool(music.get('ready_file')))
    if details != original_details:
        d=call(target,'PUT',f'/drafts/{ident}/details',details)
    # Guardar detalles puede sustituir la intro por el título de la canción.
    # Restaurar el build antes de comprobar o capturar las miniaturas.
    if (target/'assets/config.json').is_file():
        sync_scene_config(target, ident, read_json)
    missing=[]
    for option in ('A','B'):
        try: call(target,'GET',f'/drafts/{ident}/thumbnails/{option}')
        except RuntimeError as exc:
            if 'HTTP 404:' not in str(exc): raise
            missing.append(option)
    if missing:
        # El endpoint de miniaturas solo crea el manifiesto. Se utiliza el
        # capturador compartido, sin entrar en la cola de grabación de video.
        from src.core import drafts, draft_thumbnails
        async def capture():
            local=await drafts.get(ident); job=drafts.load_job(ident)
            if local is None or job is None or local.details is None or local.thumbnails is None:
                raise ValueError('faltan job, detalles o manifiesto para miniaturas')
            options=local.thumbnails.model_dump(mode='json').get('options')
            for option in missing:
                path=await draft_thumbnails.capture_selected(ident,job,local.details,option,options=options)
                if path != draft_thumbnails.image_path(job,local.thumbnails,option):
                    raise ValueError('la huella de la miniatura no coincide con el manifiesto')
        asyncio.run(capture())
        for option in missing: call(target,'GET',f'/drafts/{ident}/thumbnails/{option}')
    return d


def recreate(root, target, project_id, read_json, write_json, thumbnail_a, thumbnail_b, frame_time, *, keep_previous=False, defer_preparation=False):
    original = read_json(target/'draft.json')
    old_id = original['draft_id']
    pending_path = target/'draft-recreation.json'
    if pending_path.exists():
        pending = read_json(pending_path)
        if pending.get('ready_to_replace') == old_id:
            new_id = pending['draft_id']
            result = wait_for(target, new_id, {'prepared'})
            for option in ('A', 'B'):
                call(target, 'GET', f'/drafts/{new_id}/thumbnails/{option}')
            try:
                if not keep_previous:call(target, 'DELETE', f'/drafts/{old_id}')
            except RuntimeError as exc:
                if 'HTTP 404:' not in str(exc):
                    raise
            pending.pop('ready_to_replace')
            write_json(target/'draft.json', pending)
            pending_path.unlink()
            return result
    old = call(target, 'GET', f'/drafts/{old_id}')
    new = create(root, target, project_id, read_json, write_json, 'draft-recreation.json')
    new_id = new['draft_id']
    if new_id == old_id:
        raise ValueError('el draft nuevo coincide con el anterior')
    # Reutilizar Detalles revisados antes de preparar evita otra llamada de copy.
    details = copy.deepcopy(old.get('details') or {})
    if details:
        research_path = target/'work/research/research.md'
        if research_path.is_file():
            details['research'] = research_path.read_text(encoding='utf-8')
        call(target, 'PUT', f'/drafts/{new_id}/details', details)
    if defer_preparation:
        if not keep_previous:
            raise ValueError('la preparación diferida requiere conservar el draft anterior')
        if details:
            draft = call(target,'GET',f'/drafts/{new_id}')
            for option,text in [('A',thumbnail_a),('B',thumbnail_b)]:
                design = copy.deepcopy(draft['thumbnails']['options'][option]['design'])
                if design.get('background',{}).get('sourceKind')=='video':design['background']['time']=frame_time
                call(target,'PUT',f'/drafts/{new_id}/thumbnails/{option}',{'text':text,'design':design})
        pending=read_json(pending_path)
        write_json(target/'draft.json',pending);pending_path.unlink()
        return call(target,'GET',f'/drafts/{new_id}')
    prepare(target, read_json, new_id)
    draft = call(target, 'GET', f'/drafts/{new_id}')
    texts = read_json(target/'brief.json')['texts']
    for option, text in [('A', thumbnail_a), ('B', thumbnail_b)]:
        design = copy.deepcopy(draft['thumbnails']['options'][option]['design'])
        if design.get('background', {}).get('sourceKind') == 'video':
            design['background']['time'] = frame_time
        if texts.get('brand.left') and texts.get('brand.right'):
            design['tagline'] = f"{texts['brand.left']} VS {texts['brand.right']}"
        call(target, 'PUT', f'/drafts/{new_id}/thumbnails/{option}', {'text': text, 'design': design})
    # El cambio de diseño invalida las capturas; prepare vuelve a generarlas.
    prepare(target, read_json, new_id)
    result = wait_for(target, new_id, {'prepared'})
    for option in ('A', 'B'):
        call(target, 'GET', f'/drafts/{new_id}/thumbnails/{option}')
    pending = read_json(pending_path)
    pending['ready_to_replace'] = old_id
    write_json(pending_path, pending)
    if not keep_previous:call(target, 'DELETE', f'/drafts/{old_id}')
    pending.pop('ready_to_replace')
    write_json(target/'draft.json', pending)
    pending_path.unlink()
    return result


def thumbnail_side(target, read_json, option, side):
    ident = read_json(target/'draft.json')['draft_id']
    draft = call(target, 'GET', f'/drafts/{ident}')
    item = draft['thumbnails']['options'][option]
    design = copy.deepcopy(item['design'])
    design['side'] = side
    call(target, 'PUT', f'/drafts/{ident}/thumbnails/{option}', {'text':item['text'], 'design':design})
    prepare(target, read_json, ident)
