"""Inspección de preview y miniaturas sin grabación ni publicación."""
from __future__ import annotations
import json
import os
import re
import subprocess
import time
from pathlib import Path
from src.core.template_config import active_config

def contact_times(segments, full=False):
    if full:
        return tuple(segment['start'] + (segment['end']-segment['start'])*fraction
                     for segment in segments for fraction in (.3,.55,.8))
    count = len(segments)
    indexes = {round(index * (count - 1) / 15) for index in range(16)}
    indexes.update(range(16, count, 17))
    while len(indexes) > 16:
        removable = sorted(indexes - {0, count - 1} - set(range(16, count, 17)))
        closest = min(removable, key=lambda index: min(abs(index - other) for other in indexes if other != index))
        indexes.remove(closest)
    return tuple((segments[index]['start'] + segments[index]['end']) / 2 for index in sorted(indexes))

def memory():
    data=Path('/proc/meminfo').read_text().splitlines()
    return {s.split(':')[0]:s.split(':')[1].strip() for s in data if s.startswith(('MemAvailable:','SwapTotal:','SwapFree:'))}

def evaluate(target, root, read_json, write_json, call, *, full=False):
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageDraw
    ident=read_json(target/'draft.json')['draft_id']
    result={'ready':False,'errors':[],'warnings':[],'screenshots':[],'metrics':[],'draft_id':ident}
    errors=result['errors']; out=target/'work/results/test'; out.mkdir(parents=True,exist_ok=True)
    d=call(target,'GET',f'/drafts/{ident}')
    if d.get('status')!='prepared' or d.get('errors'): errors.append(f"draft: {d.get('status')}, errores: {d.get('errors')}")
    expected=read_json(target/'assets/lyrics.json')['metadata']['audio_duration_sec']
    actual_lyrics=call(target,'GET',f'/drafts/{ident}/preview/assets/lyrics.json')
    if actual_lyrics != read_json(target/'assets/lyrics.json'):
        errors.append('la letra del preview difiere del guion')
    raw_config=call(target,'GET',f'/drafts/{ident}/preview/assets/config.json')
    config=active_config(raw_config)
    inputs=read_json(target/'draft.json')['request']['template_inputs']['media']
    refs={}
    for entry in config.get('media',[]):
        match=re.search(r'/(clips|photos)-(\d+)\.',entry.get('src',''))
        if match:
            values=inputs.get(match.group(1),[]); index=int(match.group(2))-1
            if index < len(values): refs[entry.get('id')]=values[index]
    uses={}
    for scene in config.get('scenes',[]):
        for slot in scene.get('media',[]):
            ident_asset=refs.get(slot)
            if not ident_asset: errors.append('medio de escena no resuelto: '+str(slot))
            else: uses[ident_asset]=uses.get(ident_asset,0)+1
    result['visual_assets_used']=uses
    if (target/'quality.json').is_file():
        quality=read_json(target/'quality.json')
        if len(uses)<quality.get('min_unique_visual_assets',0):
            errors.append(f'solo {len(uses)} medios visuales distintos usados; se requieren {quality["min_unique_visual_assets"]}')
        if any(count>quality.get('max_visual_repetitions',10**9) for count in uses.values()):
            errors.append('un medio supera el máximo de repeticiones')
        for asset, reason in quality.get('rejected_assets',{}).items():
            if asset in uses: errors.append(f'medio no aprobado {asset}: {reason}')
    plan=read_json(target/'media-plan.json')
    # El preview repite el ciclo de escenas para cada segmento de la letra.
    # Conservar las apariciones por hueco permite revisar su sentido editorial.
    segments=actual_lyrics.get('segments',[])
    scenes=config.get('scenes',[])
    result['slot_lines']=[]
    for item in plan['items']:
        slot=item.get('slot')
        appearances=[]
        if scenes and slot:
            for index, segment in enumerate(segments):
                if slot in scenes[index % len(scenes)].get('media',[]):
                    appearances.append({'segment':index+1,'start':segment.get('start'),
                                        'end':segment.get('end'),
                                        'lines':segment.get('lines',[segment.get('text','')])})
        result['slot_lines'].append({'slot':slot,'asset_id':item.get('asset_id'),
                                     'appearances':appearances})
    for item in plan['items']:
        folder='videos' if item['kind']=='video' else 'images'
        meta=read_json(root/'resources'/folder/item['asset_id']/'resource.json')
        if not all(meta.get(k) for k in ('source_url','license','license_url','author','attribution')):
            errors.append('créditos incompletos: '+item['asset_id'])
    music=read_json(target/'music.json'); meta=read_json(root/'resources/music'/music['asset_id']/'resource.json')
    if not all(meta.get(k) for k in ('source_url','license','license_url','author','attribution')): errors.append('créditos incompletos: música')
    for option in ('A','B'):
        try:
            content=call(target,'GET',f'/drafts/{ident}/thumbnails/{option}')
            (out/f'draft-miniatura-{option}.jpg').write_bytes(content)
            with Image.open(out/f'draft-miniatura-{option}.jpg') as im: im.verify()
        except Exception as exc: errors.append(f'miniatura {option}: {exc}')
    result['metrics'].append({'phase':'antes','memory':memory()})
    with sync_playwright() as pw:
      browser=pw.chromium.launch(headless=True,args=['--autoplay-policy=no-user-gesture-required'])
      try:
       for label,w,h in [('16x9',960,540),('9x16',540,960)]:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.on('pageerror',lambda err: errors.append('pageerror: '+str(err)))
        page.on('console',lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
        page.on('response',lambda r: errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 else None)
        page.goto(f'http://localhost:8000/api/v1/drafts/{ident}/preview/index.html?t=0&headless=1',wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function('window.__promo && window.__promo.scenes().length > 0',timeout=45000)
        page.wait_for_function('document.querySelector("audio") && Number.isFinite(document.querySelector("audio").duration)',timeout=30000)
        duration=page.evaluate('document.querySelector("audio").duration')
        if abs(duration-expected)>.2: errors.append(f'duración {duration}, esperada {expected}')
        for i,t in enumerate(contact_times(read_json(target/'assets/lyrics.json')['segments'],full=full)):
            page.evaluate('async t => await window.__promo.seek(t)',t); page.wait_for_timeout(300)
            state=page.evaluate('''() => ({badMedia: [...document.querySelectorAll('img,video,audio')].filter(e => e.error && e.currentSrc).map(e => e.currentSrc),
              viewport: [innerWidth,innerHeight], textOutside: [...document.querySelectorAll('.gx')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(); return s.visibility==='visible' && s.opacity!=='0' && r.width>0 && r.height>0 && (r.right<0 || r.left>innerWidth || r.bottom<0 || r.top>innerHeight)}).map(e=>e.textContent?.slice(0,80)).filter(Boolean)})''')
            if state['badMedia']: errors.append(f'{label} {t}: medios con error {state["badMedia"]}')
            if state['textOutside']: result['warnings'].append(f'{label} {t}: texto totalmente fuera {state["textOutside"]}')
            path=out/f'draft-{label}-{i+1:02d}-{t:g}s.png';page.screenshot(path=str(path)); result['screenshots'].append(str(path))
        result['metrics'].append({'phase':label,'memory':memory()});page.close()
       result['metrics'].append({'phase':'paginas_cerradas','memory':memory()})
      finally: browser.close()
    result['metrics'].append({'phase':'navegador_cerrado','memory':memory()})
    for label in ('16x9','9x16'):
        paths=[Path(x) for x in result['screenshots'] if f'draft-{label}-' in x]
        size=(320,180) if label=='16x9' else (180,320)
        grid=Image.new('RGB',(size[0]*4,(size[1]+24)*((len(paths)+3)//4)),'#222'); draw=ImageDraw.Draw(grid)
        for i,path in enumerate(paths):
            im=Image.open(path).convert('RGB'); im.thumbnail(size); x=(i%4)*size[0]; y=(i//4)*(size[1]+24)
            grid.paste(im,(x,y));draw.text((x+4,y+size[1]+3),path.stem[-8:],fill='white')
        grid.save(out/f'draft-{label}-contacto.jpg',quality=85)
        if full:
            for batch, start in enumerate(range(0,len(paths),24),1):
                selected=paths[start:start+24]
                sheet=Image.new('RGB',(size[0]*4,(size[1]+24)*((len(selected)+3)//4)),'#222')
                draw_sheet=ImageDraw.Draw(sheet)
                for j,path in enumerate(selected):
                    with Image.open(path) as source: thumb=source.convert('RGB');thumb.thumbnail(size)
                    x=(j%4)*size[0];y=(j//4)*(size[1]+24)
                    sheet.paste(thumb,(x,y));draw_sheet.text((x+4,y+size[1]+3),path.stem,fill='white')
                sheet.save(out/f'draft-{label}-contacto-{batch:03d}.jpg',quality=90)
    result['errors']=list(dict.fromkeys(errors));result['warnings']=list(dict.fromkeys(result['warnings']))
    result['ready']=not result['errors'] and not result['warnings']
    result['coverage']={'full':full,'moments_per_scene':3 if full else 1,'scene_count':len(segments),'formats':['16x9','9x16']}
    result['manual_review_required']=True
    write_json(out/'draft-check.json',result)
    return result
