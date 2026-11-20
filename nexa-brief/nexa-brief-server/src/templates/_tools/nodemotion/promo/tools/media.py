"""Adquisición de recursos con registro en la biblioteca del perfil."""
from __future__ import annotations
import asyncio
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

HERE = Path(__file__).resolve().parent
SERVER = HERE.parents[5]
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))
from src.core.nodemotion.promo.paths import work_script_path
from src.core.nodemotion.promo.workspace import prepared_reference, timeline
from src.core.data import collection
from src.core.library import asset_library as lib
from src.adapters.stock.factory import build_stock_providers
from src.adapters.stock.public_archives import NASAImagesAdapter, LibraryCongressPhotosAdapter
from src.adapters.stock.wikimedia_adapter import WikimediaCommonsAdapter, plain_text
from src.core.image_posts.image_licensing import accepted_license

LICENSES = {'pexels': ('Pexels License','https://www.pexels.com/license/'), 'pixabay': ('Pixabay Content License','https://pixabay.com/service/license-summary/'), 'unsplash': ('Unsplash License','https://unsplash.com/license')}
MUSIC_URL = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Undaunted.mp3'
MUSIC_SOURCE = 'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1400025'
MUSIC_LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
# Un servidor que envía bytes lentamente no debe retener la cola completa.
DOWNLOAD_TIMEOUT_SECONDS = 120


def now(): return datetime.now(timezone.utc).isoformat()

def log(target, provider, step, note, start, ok):
    entry = dict(ts=now(), provider=provider, model='', role='media', step=step, input_tokens=None, cached_input_tokens=None, output_tokens=None, seconds=round(time.monotonic()-start, 3), ok=ok, billing='unknown', note=note)
    (target/'logs').mkdir(parents=True, exist_ok=True)
    with (target/'logs/usage.jsonl').open('a',encoding='utf-8') as f: f.write(json.dumps(entry,ensure_ascii=False)+'\n')

def probe(path):
    d=json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type,width,height,avg_frame_rate:format=duration','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)
    v=next((x for x in d.get('streams',[]) if x.get('codec_type')=='video'),{})
    width=v.get('width'); height=v.get('height'); fps=None
    if v.get('avg_frame_rate') and v['avg_frame_rate'] != '0/0':
        a,b=map(int,v['avg_frame_rate'].split('/')); fps=a/b if b and a else None
    duration=d.get('format',{}).get('duration')
    orientation=('landscape' if width/height>1.1 else 'portrait' if width/height<.9 else 'square') if width and height else None
    return dict(width=width,height=height,duration_seconds=float(duration) if duration and duration!='N/A' else None,fps=fps,orientation=orientation)

def metadata_paths(root, kind):
    folder=root/'resources'/{'image':'images','video':'videos','music':'music'}[kind]
    return folder.glob('*/resource.json') if folder.exists() else []

def _normalized_words(value):
    if not isinstance(value, str):
        return ''
    value = unicodedata.normalize('NFKD', unquote(value).casefold())
    value = ''.join(ch for ch in value if not unicodedata.combining(ch))
    return ' '.join(re.findall(r'[^\W_]+', value, flags=re.UNICODE))


def matches_required_terms(item, required_terms):
    """OR sobre metadatos de origen; jamás usa query, autor ni tags sintéticos."""
    if not required_terms:
        return True
    def get(name):
        return item.get(name) if isinstance(item, dict) else getattr(item, name, None)
    values = []
    query = _normalized_words(get('query'))
    for field in ('title', 'name', 'description', 'keywords', 'source_url'):
        value = get(field)
        for part in (value if isinstance(value, (list, tuple)) else [value]):
            normalized = _normalized_words(part)
            # Fichas antiguas pueden haber usado la consulta como nombre/descripción.
            if normalized and not (field in ('name', 'description') and query and normalized == query):
                values.append(' ' + normalized + ' ')
    return any(phrase and any(' ' + phrase + ' ' in text for text in values)
               for phrase in (_normalized_words(term) for term in required_terms))


def find(root, kind, *, query=None, url=None, digest=None, ident=None, required_terms=None):
    for path in metadata_paths(root,kind):
        try: d=json.loads(path.read_text(encoding='utf-8'))
        except (OSError,ValueError): continue
        if d.get('approved') is False or not matches_required_terms(d, required_terms): continue
        if ((ident and d.get('id')==ident) or (url and url in (d.get('download_url'),d.get('source_url'))) or (digest and d.get('hash')==digest) or (query and d.get('query','').casefold()==query.casefold())):
            try: existing=lib.resolve_asset_path(kind,d['id'])
            except Exception: continue
            if existing.is_file() and (path.parent/d['file']).is_file() and (not d.get('ready_file') or (path.parent/d['ready_file']).is_file()): return path,d
    return None

def use(found, project_id, write_json):
    path,d=found
    if project_id not in d['used_by']:
        d['used_by'].append(project_id); write_json(path,d)
    return d

async def download(target,provider,url,path):
    start=time.monotonic(); ok=False; note=url
    try:
        await asyncio.wait_for(lib.download_url_to(url,path), timeout=DOWNLOAD_TIMEOUT_SECONDS); ok=True
    except Exception as e:
        note=f'{url}: {type(e).__name__}: {e}'; raise
    finally: log(target,provider,'download',note,start,ok)

async def register(root,target,project_id,kind,item,query,write_json,validate):
    license_name,license_url=LICENSES.get(item.provider,(item.license,item.license_url))
    if not all((item.source_url,item.download_url,item.author,license_name,license_url)):
        raise ValueError('procedencia o licencia incompleta')
    if item.provider not in LICENSES and not accepted_license(license_name):
        raise ValueError('licencia no habilitada para uso comercial')
    commons_metadata = getattr(build_providers().get(item.provider), 'source_metadata', {}).get(item.provider_id, {})
    existing=find(root,kind,url=item.source_url) or find(root,kind,url=item.download_url)
    if existing: return use(existing,project_id,write_json),False
    if not build_providers()[item.provider].accepts_download_url(item.download_url): raise ValueError('URL de descarga ajena al proveedor')
    # Consultar también registros previos a esta herramienta, sin duplicar su archivo.
    records=collection({'image':'image_assets','video':'video_assets'}[kind]).list()
    ref=f'{item.provider}:{kind}:{item.provider_id}'
    old=next((x for x in records if x.get('stock_ref')==ref or x.get('original_url')==item.download_url or x.get('stock_source_url')==item.source_url),None)
    if old:
        stored=lib.resolve_asset_path(kind,old['asset_id'])
        sidecar=stored.parent/'resource.json'
        if sidecar.exists():
            raise ValueError('el registro existente tiene ficha incompatible o archivos incompletos')
        info=probe(stored); ready=None
        if kind=='video':
            spec=importlib.util.spec_from_file_location('hf_reencode',SERVER/'src/templates/_tools/hyperframes/reencode_media.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
            ready='hyperframes.mp4'
            if (stored.parent/ready).exists(): raise ValueError('ya existe una versión HyperFrames sin ficha; no se sobrescribe')
            subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-i',str(stored),*mod.FFMPEG_ARGS,'-threads','2',str(stored.parent/ready)],check=True)
        attribution=f'{item.attribution or (item.author + " · " + license_name)} · {item.source_url} · {license_url}'
        d=dict(id=old['asset_id'],type=kind,category=old.get('category') or 'stock',name=item.title or query,tags=[query],description=item.description or item.title or query,source=item.provider,source_url=item.source_url,download_url=item.download_url,author=item.author,license=license_name,license_url=license_url,attribution=attribution,hash=lib.hash_file(stored),query=query,fetched_at=old.get('added_at') or None,used_by=[project_id],file=stored.name,ready_file=ready,**info)
        d.update(commons_metadata)
        validate('resource',d); write_json(sidecar,d)
        return d,False
    with tempfile.TemporaryDirectory(prefix='nm-promo-') as t:
        path=Path(t)/('source.mp4' if kind=='video' else 'source.jpg')
        await download(target,item.provider,item.download_url,path)
        digest=lib.hash_file(path)
        existing=find(root,kind,digest=digest)
        if existing: return use(existing,project_id,write_json),True
        info=probe(path)
        encoded=None
        if kind=='video':
            spec=importlib.util.spec_from_file_location('hf_reencode',SERVER/'src/templates/_tools/hyperframes/reencode_media.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
            encoded=Path(t)/'hyperframes.mp4'
            subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-i',str(path),*mod.FFMPEG_ARGS,'-threads','2',str(encoded)],check=True)
        attribution=f'{item.attribution or (item.author + " · " + license_name)} · {item.source_url} · {license_url}'
        common=dict(category='stock',source='stock',provider=item.provider,original_url=item.download_url,job_id=project_id,filename=path.name,license_note=attribution,description=item.description or item.title or query,tags=query)
        if kind=='video': entry=await lib.register_video(path,**common,label=item.title or query,width=info['width'] or 0,height=info['height'] or 0,duration_seconds=info['duration_seconds'] or 0)
        else: entry=await lib.register_image(path,**common,label=item.title or query,photographer=item.author,width=info['width'] or 0,height=info['height'] or 0,orientation=info['orientation'])
        stored=lib.resolve_asset_path(kind,entry.asset_id); ready=None
        if kind=='video':
            ready='hyperframes.mp4'; shutil.move(str(encoded),str(stored.parent/ready))
        d=dict(id=entry.asset_id,type=kind,category='stock',name=item.title or query,tags=[query],description=item.description or item.title or query,source=item.provider,source_url=item.source_url,download_url=item.download_url,author=item.author,license=license_name,license_url=license_url,attribution=attribution,hash=digest,query=query,fetched_at=now(),used_by=[project_id],file=stored.name,ready_file=ready,**info)
        d.update(commons_metadata)
        validate('resource',d); write_json(stored.parent/'resource.json',d)
        await collection({'image':'image_assets','video':'video_assets'}[kind]).update(entry.asset_id,{'stock_ref':f'{item.provider}:{kind}:{item.provider_id}','stock_author':item.author,'stock_source_url':item.source_url})
        if item.provider=='unsplash':
            start=time.monotonic(); ok=False
            try: await build_providers()['unsplash'].notify_download(item.provider_id); ok=True
            finally: log(target,'unsplash','notify-download',item.provider_id,start,ok)
        return d,True

_PROVIDERS=None


class PromoCommonsAdapter(WikimediaCommonsAdapter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.source_metadata = {}

    def _imageinfo_params(self):
        params = super()._imageinfo_params()
        params['iiextmetadatafilter'] += '|UsageTerms'
        return params

    def _item_from_page(self, page):
        info = next(iter(page.get('imageinfo') or []), {})
        meta = info.get('extmetadata') or {}
        name = plain_text(meta.get('LicenseShortName'))
        if not re.fullmatch(r'(?:CC\s+BY(?:-SA)?\s+[0-9.]+|CC0(?:\s+[0-9.]+)?|Public domain|PD(?:[- ].*)?)', name, re.I):
            return None
        terms = ' '.join(plain_text(meta.get(key)) for key in ('UsageTerms', 'Credit', 'ImageDescription'))
        if re.search(r'(?:no\s+(?:se\s+)?(?:puede|pueden|permitid[oa])[^.]{0,150}(?:comercial|manipulad)|(?:non.?commercial|editorial\s+use\s+only|no\s+commercial\s+use|may\s+not\s+be\s+(?:manipulated|used)))', terms, re.I):
            return None
        item = super()._item_from_page(page)
        if not item or max(item.width, item.height) < 1600:
            return None
        parts = urlsplit(item.download_url)
        query = urlencode([(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
                           if not key.casefold().startswith('utm_')])
        item.download_url = urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))
        item.credit = plain_text(meta.get('Credit'))
        if not item.author and (name.casefold().startswith(('pd', 'cc0')) or name.casefold() == 'public domain'):
            item.author = 'autor no identificado'
        self.source_metadata[item.provider_id] = {'credit': item.credit, 'usage_terms': plain_text(meta.get('UsageTerms'))}
        return item

    async def search(self, query, kind, *, orientation=None, page=1, per_page=15):
        if not query.casefold().startswith(('category:', 'categoría:')):
            return await super().search(query, kind, orientation=orientation, page=page, per_page=per_page)
        if kind != 'image':
            return []
        category = query.split(':', 1)[1].strip()
        body = await self._get_json('https://commons.wikimedia.org/w/api.php', {
            'action': 'query', 'format': 'json', 'formatversion': 2,
            'generator': 'categorymembers', 'gcmtitle': 'Category:' + category,
            'gcmtype': 'file', 'gcmlimit': min(50, max(1, per_page)), **self._imageinfo_params()})
        pages = (body.get('query') or {}).get('pages') or []
        if isinstance(pages, dict):
            pages = list(pages.values())
        items = [item for entry in pages if (item := self._item_from_page(entry))]
        if orientation == 'landscape':
            items = [item for item in items if item.width > item.height]
        elif orientation == 'portrait':
            items = [item for item in items if item.height > item.width]
        elif orientation == 'square':
            items = [item for item in items if .9 <= item.width / item.height <= 1.1]
        return items


def build_providers():
    global _PROVIDERS
    if _PROVIDERS is None:
        _PROVIDERS=build_stock_providers(); _PROVIDERS.update({p.name:p for p in (PromoCommonsAdapter(),NASAImagesAdapter(),LibraryCongressPhotosAdapter())})
    return _PROVIDERS

async def candidates(root, target, project_id, provider, query, kind, orientation, read_json, write_json):
    """Consulta metadatos sin importar ni descargar los medios encontrados."""
    start = time.monotonic()
    ok = False
    note = f'{kind}: {query}'
    try:
        source = build_providers().get(provider)
        if not source or not source.configured or kind not in source.kinds:
            raise ValueError(f'proveedor no disponible para {kind}: {provider}')
        found = await source.search(query, kind, orientation=orientation, per_page=50)
        fields = ('provider_id', 'title', 'description', 'source_url', 'download_url',
                  'author', 'license', 'license_url', 'width', 'height', 'duration_seconds')
        items = [{field: getattr(item, field, None) for field in fields} for item in found]
        result = {'provider': provider, 'query': query, 'kind': kind,
                  'orientation': orientation, 'candidates': items}
        key = json.dumps([provider, query, kind, orientation], ensure_ascii=False, separators=(',', ':'))
        digest = hashlib.sha256(key.encode('utf-8')).hexdigest()
        write_json(target / 'work/media/candidates' / f'{digest}.json', result)
        ok = True
        return result
    except Exception as exc:
        note += f': {type(exc).__name__}: {exc}'
        raise
    finally:
        log(target, provider, 'candidate-search', note, start, ok)

async def fetch(root,target,project_id,read_json,write_json,validate):
    path=target/'media-plan.json'; plan=read_json(path); validate('media-plan',plan); downloads=0; failures=[]
    if re.fullmatch(r'[a-f0-9]{32}-r[1-9][0-9]*',project_id) and any(
        not item.get('required_terms') and item.get('manual_selection') is not True for item in plan['items']
    ):
        print(json.dumps({'downloads':0,'resolved':0,'errors':['El plan del chat requiere required_terms por slot antes de adquirir medios']}));return 1
    for slot in plan['items']:
        kind=slot['kind']; query=slot['query']; orientation=slot.get('orientation','landscape')
        required_terms=None if slot.get('manual_selection') is True else slot.get('required_terms')
        segment=next((x for x in timeline(target, read_json)['segments'] if x.get('id')==slot['scene']),None)
        if not segment:
            slot.pop('asset_id',None); failures.append(f"{slot['slot']}: escena inexistente"); write_json(path,plan); continue
        minimum=max(slot.get('minimum_duration_seconds',0),float(segment['end'])-float(segment['start']))
        manual_selection=slot.get('manual_selection') is True
        existing=find(root,kind,ident=slot.get('asset_id'),required_terms=required_terms) if slot.get('asset_id') else None
        if not manual_selection:
            existing=existing or (find(root,kind,digest=slot['sha256'],required_terms=required_terms) if slot.get('sha256') else None) or (find(root,kind,query=query,required_terms=required_terms) if not slot.get('provider_id') else None)
        if existing and (existing[1].get('orientation') != orientation or (kind=='video' and (existing[1].get('duration_seconds') or 0)<minimum)): existing=None
        if manual_selection and existing is None:
            slot.pop('asset_id',None); write_json(path,plan)
            failures.append(f"{slot['slot']}: el recurso seleccionado ya no está disponible o no coincide con orientación/duración")
            continue
        if existing:
            d=use(existing,project_id,write_json); slot['asset_id']=d['id']; write_json(path,plan); continue
        slot.pop('asset_id',None); write_json(path,plan)
        providers = build_providers()
        brief_path = target/'brief.json'
        priority = read_json(brief_path).get('media_priority', ['commons', 'stock']) if brief_path.exists() else ['commons', 'stock']
        ordered = sorted(providers.values(), key=lambda provider: priority.index('commons' if provider.name == 'wikimedia' else 'stock') if ('commons' if provider.name == 'wikimedia' else 'stock') in priority else len(priority))
        for provider in ordered:
            if kind not in provider.kinds or not provider.configured or (slot.get('provider') and slot['provider']!=provider.name): continue
            start=time.monotonic(); ok=False; note=f'{kind}: {query}'
            try:
                found=await provider.search(query,kind,orientation=orientation,per_page=50 if slot.get('provider_id') else 8); ok=True
                candidates = [i for i in found if (not slot.get('provider_id') or i.provider_id==slot['provider_id']) and min(i.width,i.height)>=360 and max(i.width,i.height)>=640 and ((orientation=='landscape' and i.width>i.height) or (orientation=='portrait' and i.height>i.width) or (orientation=='square' and .9<=i.width/i.height<=1.1)) and (kind!='video' or (i.duration_seconds or 0)>=minimum) and i.author and i.source_url and matches_required_terms(i,required_terms)]
            except Exception as e: note+=f': {type(e).__name__}: {e}'
            finally: log(target,provider.name,'fetch-search',note,start,ok)
            if not ok: continue
            candidates.sort(key=lambda i:(min(i.width*i.height,1920*1080), -(i.duration_seconds or 0)),reverse=True)
            for item in candidates:
                try:
                    d,created=await register(root,target,project_id,kind,item,query,write_json,validate)
                    downloads+=int(created)
                    if not matches_required_terms(d,required_terms):
                        raise ValueError('la ficha reutilizada no identifica el lugar requerido')
                    slot['asset_id']=d['id']; write_json(path,plan); break
                except Exception as e: failures.append(f"{slot['slot']}: {type(e).__name__}: {e}")
            if 'asset_id' in slot: break
        if 'asset_id' not in slot: failures.append(f"{slot['slot']}: sin resultados descargables para {query}")
    print(json.dumps({'downloads':downloads,'resolved':sum('asset_id' in x for x in plan['items']),'total':len(plan['items']),'errors':failures},ensure_ascii=False,indent=2)); return int(any('asset_id' not in x for x in plan['items']))


async def still_clip(root, target, project_id, asset_id, duration, focus, write_json, validate):
    if duration <= 0 or not all(0 <= value <= 1 for value in focus):
        raise ValueError('duración o foco inválidos')
    found = find(root, 'image', ident=asset_id)
    if not found:
        raise ValueError('foto registrada no encontrada')
    _, source = found
    for metadata in metadata_paths(root, 'video'):
        try:
            existing = json.loads(metadata.read_text(encoding='utf-8'))
            if (existing.get('derived_from') == asset_id and existing.get('focus') == list(focus)
                    and abs((existing.get('duration_seconds') or 0) - duration) < .04
                    and (metadata.parent / existing['file']).is_file()):
                return use((metadata, existing), project_id, write_json)
        except (OSError, ValueError, KeyError, TypeError):
            continue
    path = lib.resolve_asset_path('image', asset_id).resolve(strict=True)
    if not path.is_relative_to((root / 'resources/images' / asset_id).resolve()):
        raise ValueError('la foto sale de su carpeta')
    frames = round(duration * 30)
    zoom = f"min(1.08,1+0.08*on/{max(frames - 1, 1)})"
    filt = (f"scale=1920:1080:force_original_aspect_ratio=increase,"
            f"zoompan=z='{zoom}':x='min(max(iw*{focus[0]}-iw/zoom/2,0),iw-iw/zoom)':"
            f"y='min(max(ih*{focus[1]}-ih/zoom/2,0),ih-ih/zoom)':d=1:s=1920x1080:fps=30,format=yuv420p")
    with tempfile.TemporaryDirectory(prefix='nm-still-clip-') as directory:
        output = Path(directory) / f'{asset_id}-animada.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-loop', '1', '-framerate', '30', '-i', str(path),
                        '-vf', filt, '-frames:v', str(frames), '-an', '-c:v', 'libx264', '-threads', '2',
                        '-preset', 'veryfast', '-g', '5', '-keyint_min', '5', '-sc_threshold', '0', str(output)], check=True)
        attribution = source['attribution'] + ' · animada a partir de la foto original'
        info = probe(output)
        entry = await lib.register_video(output, category='stock', source='stock', provider=source['source'],
                                         original_url=source['source_url'], job_id=project_id, filename=output.name,
                                         label=source['name'], width=info['width'], height=info['height'],
                                         duration_seconds=info['duration_seconds'], license_note=attribution,
                                         description=source['description'], tags=source['query'])
        stored = lib.resolve_asset_path('video', entry.asset_id)
        data = dict(source, id=entry.asset_id, type='video', derived_from=asset_id, focus=list(focus),
                    attribution=attribution, hash=lib.hash_file(stored), file=stored.name,
                    ready_file=None, used_by=[project_id], **info)
        validate('resource', data)
        write_json(stored.parent / 'resource.json', data)
        return data

async def music(root,target,project_id,write_json,validate):
    async def reuse(existing, downloads):
        d=use(existing,project_id,write_json); duration=float(read_duration(target)); ready=f'undaunted-{duration:g}s.mp3'
        folder=existing[0].parent
        if not d.get('duration_seconds') or d['duration_seconds'] < duration: raise ValueError('la pista es más corta que el guion')
        if not (folder/ready).is_file():
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(folder/d['file']),'-t',str(duration),'-af',f'afade=t=out:st={max(0,duration-3)}:d=3','-codec:a','libmp3lame','-q:a','2',str(folder/ready)],check=True)
        if not d.get('ready_file'):
            d['ready_file']=ready; write_json(existing[0],d)
        if not (folder/'CC-BY-4.0-legalcode.html').exists():
            await download(target,'creativecommons','https://creativecommons.org/licenses/by/4.0/legalcode.en',folder/'CC-BY-4.0-legalcode.html')
        (folder/'LICENSE.txt').write_text('Undaunted — Kevin MacLeod\nFuente: '+MUSIC_SOURCE+'\nLicencia Creative Commons Attribution 4.0 International: '+MUSIC_LICENSE+'\nUso comercial y adaptaciones permitidos con atribución. La versión preparada fue recortada y lleva fundido final.\n'+d['attribution']+'\n',encoding='utf-8')
        write_json(target/'music.json',{'asset_id':d['id'],'duration_seconds':duration,'ready_file':ready})
        print(json.dumps({'asset_id':d['id'],'downloads':downloads},ensure_ascii=False)); return 0
    def describe_existing(raw):
        stored=lib.resolve_asset_path('music',raw['asset_id']); sidecar=stored.parent/'resource.json'
        if sidecar.exists(): raise ValueError('la música registrada tiene una ficha incompatible o incompleta')
        info=probe(stored)
        d=dict(id=raw['asset_id'],type='music',category=raw.get('category') or 'stock',name='Undaunted',tags=['instrumental','epic'],description='Música instrumental cinematográfica',source='incompetech',source_url=MUSIC_SOURCE,download_url=MUSIC_URL,author='Kevin MacLeod',license='CC BY 4.0',license_url=MUSIC_LICENSE,attribution='“Undaunted”, Kevin MacLeod (incompetech.com), CC BY 4.0: https://creativecommons.org/licenses/by/4.0/; recortada y con fundido final.',hash=lib.hash_file(stored),query='Undaunted Kevin MacLeod',fetched_at=raw.get('added_at') or None,used_by=[project_id],file=stored.name,ready_file=None,**info)
        validate('resource',d);write_json(sidecar,d);return sidecar,d
    existing=find(root,'music',url=MUSIC_SOURCE)
    if existing: return await reuse(existing,0)
    raw=next((x for x in collection('music_assets').list() if x.get('original_url')==MUSIC_URL),None)
    if raw: return await reuse(describe_existing(raw),0)
    with tempfile.TemporaryDirectory(prefix='nm-music-') as t:
        path=Path(t)/'Undaunted.mp3'; await download(target,'incompetech',MUSIC_URL,path); digest=lib.hash_file(path)
        existing=find(root,'music',digest=digest)
        if existing: return await reuse(existing,1)
        old=lib.find_music_by_hash(digest)
        if old: return await reuse(describe_existing(old.model_dump()),1)
        info=probe(path); duration=float(read_duration(target))
        if not info['duration_seconds'] or info['duration_seconds']<duration: raise ValueError('la pista es más corta que el guion')
        attribution='“Undaunted”, Kevin MacLeod (incompetech.com), CC BY 4.0: https://creativecommons.org/licenses/by/4.0/; recortada y con fundido final.'
        entry=await lib.register_music(path,category='stock',source='url',provider='incompetech',original_url=MUSIC_URL,job_id=project_id,filename='Undaunted.mp3',content_hash=digest,track_name='Undaunted',artist='Kevin MacLeod',duration_seconds=int(info['duration_seconds']),license_note=attribution,description='Música instrumental cinematográfica',tags='instrumental, epic')
        stored=lib.resolve_asset_path('music',entry.asset_id)
        d=dict(id=entry.asset_id,type='music',category='stock',name='Undaunted',tags=['instrumental','epic'],description='Música instrumental cinematográfica',source='incompetech',source_url=MUSIC_SOURCE,download_url=MUSIC_URL,author='Kevin MacLeod',license='CC BY 4.0',license_url=MUSIC_LICENSE,attribution=attribution,hash=digest,query='Undaunted Kevin MacLeod',fetched_at=now(),used_by=[project_id],file=stored.name,ready_file=None,**info)
        validate('resource',d)
        sidecar = stored.parent/'resource.json'
        write_json(sidecar,d)
        return await reuse((sidecar,d),1)

def read_duration(target):
    script=work_script_path(target)
    if script.is_file():
        data=json.loads(script.read_text(encoding='utf-8'))
        if 'duration_seconds' in data:
            duration=float(data['duration_seconds'])
            if not 60 <= duration <= 120:
                raise ValueError('duración de guion fuera de 60–120 segundos')
            return duration
    d=timeline(target)
    return max(float(x['end']) for x in d['segments'])

def link_music(root, target):
    metadata=target/'music.json'
    if metadata.is_symlink() or not metadata.is_file():
        raise ValueError('music.json debe ser un archivo del proyecto, sin enlaces')
    before=metadata.read_bytes()
    data=json.loads(before)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',data['asset_id']):
        raise ValueError('id musical inválido')
    folder=(root/'resources/music'/data['asset_id']).resolve(strict=True)
    source=(folder/data['ready_file']).resolve(strict=True)
    if not source.is_relative_to(folder):
        raise ValueError('el recorte sale de su recurso musical')
    destination=target/'assets/song.mp3'
    if destination.exists() or destination.is_symlink():
        if not destination.is_symlink() or destination.resolve()!=source:
            raise ValueError('no se reemplaza assets/song.mp3 existente')
    # The timing bootstrap precedes build/config. Keep its exact ready-file
    # reference in editorial JSON instead of creating a local media link.
    data['resource_ref']=prepared_reference(root, 'music', data['asset_id'], data['ready_file'])
    fd,name=tempfile.mkstemp(prefix='.music-reference-',suffix='.tmp',dir=target)
    temporary=Path(name)
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as stream:
            stream.write(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            stream.flush()
            os.fsync(stream.fileno())
        if metadata.is_symlink() or metadata.read_bytes()!=before:
            raise ValueError('music.json cambió mientras se preparaba la referencia')
        os.replace(temporary,metadata)
    finally:
        temporary.unlink(missing_ok=True)
