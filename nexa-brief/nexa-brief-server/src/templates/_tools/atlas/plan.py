"""Estimación conservadora de cobertura de cámara, sin navegador."""
import json
import math
from pathlib import Path
import subprocess
from concurrent.futures import ThreadPoolExecutor
from src.adapters.maps.cache import TileCache, lonlat_to_tile
from src.adapters.maps.providers import ATLAS


def samples(scene_path, step, selection=None, width=1920, height=1080):
    script = r'''
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createCamera} from %s;
import {createGeo,cameraKeys} from %s;
import {createLookAt} from %s;
const rawScene=JSON.parse(fs.readFileSync(process.argv[1]));
const dir=process.argv[2], step=+process.argv[3], width=+process.argv[4], height=+process.argv[5], query=process.argv[6];
const collections=['admin0','admin1','admin2-US'].map(n=>JSON.parse(fs.readFileSync(dir+'/data/geo/'+n+'.geojson')));
let resolved={}; try {resolved=JSON.parse(fs.readFileSync(process.argv[1].replace(/[^/]+$/, 'geo.resolved.json')))} catch {}
const scenePath=process.argv[1], root=path.basename(path.dirname(scenePath))==='assets'?path.dirname(path.dirname(scenePath)):path.dirname(scenePath);
let config={}; for(const name of ['config.json','assets/config.json']) try {config=JSON.parse(fs.readFileSync(path.join(root,name))).configs?.[0]||{};break;} catch {}
let words=[]; if(config.lyricsUrl) {const lyrics=JSON.parse(fs.readFileSync(path.resolve(root,config.lyricsUrl)));words=(lyrics.segments||[]).flatMap(s=>s.words||[]).filter(w=>w&&Number.isFinite(w.start));}
const sandbox={document:{currentScript:null},location:{search:''},URLSearchParams,TextEncoder,console};sandbox.window=sandbox;vm.runInNewContext(fs.readFileSync(path.join(dir,'../../_proto/proto.js'),'utf8'),sandbox);
let declared=[]; try {declared=sandbox.Proto.validateDeclared(JSON.parse(fs.readFileSync(path.join(root,'info.json'))).components||[]);} catch (error) {if(error.code!=='ENOENT')throw error;}
const chosen=sandbox.Proto.buildSelection(declared,sandbox.Proto.parseComponentQuery(query));
const scene=sandbox.Proto.resolveComponents(rawScene,declared,chosen);
const protoTimer=sandbox.Proto.makeTimer(words,'atlas plan');
const timer=(v,f=0)=>{const value=protoTimer(v,f);if(protoTimer.missing.size)throw Error('Ancla de voz no resuelta: '+[...protoTimer.missing].join(', '));return value;};
const camera=createCamera(cameraKeys(scene,createGeo(scene,resolved,collections),timer,width));
const names=[scene.look||'satelite-realista',...(scene.looks||[]).map(e=>e.look)].filter(x=>typeof x==='string');
const looks=Object.fromEntries(names.map(n=>[n,JSON.parse(fs.readFileSync(dir+'/looks/'+n+'.json'))]));
const lookAt=createLookAt(scene,looks,timer), end=timer(scene.duration??scene.end,0);
if(!Number.isFinite(end)||end<=0)throw Error('La escena resuelta debe tener duration/end positivo');
const out=[];for(let i=0;i<=Math.ceil(end/step);i++){const t=Math.min(i*step,end);out.push({pose:camera.at(t),look:lookAt(t),viewport:{width,height}});}console.log(JSON.stringify(out));
''' % tuple(json.dumps((ATLAS / f).as_uri()) for f in ('camera.js','geo.js','style.js'))
    proc = subprocess.run(['node','--input-type=module','-e',script,str(Path(scene_path).resolve()),str(ATLAS),str(step),str(width),str(height),selection or ''],capture_output=True,text=True,check=True)
    return json.loads(proc.stdout)


def footprint(pose, maxdist, width=1920, height=1080):
    """Proyecta esquinas y bordes (incluido el horizonte) en Mercator normalizado."""
    w,h=width,height; d=h*1.5
    pitch=math.radians(pose['pitch']); bearing=math.radians(pose['bearing'])
    cp,sp=math.cos(pitch),math.sin(pitch); alt=d*cp
    lon,lat=pose['lon'],max(-85.05112878,min(85.05112878,pose['lat']))
    cx=(lon+180)/360; cy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2
    scale=512*2**pose['zoom']; points=[(cx,cy)]
    for x,y in [(x,y) for x in (-w/2,0,w/2) for y in (-h/2,0,h/2)]:
        denom=max(1e-9,d*cp-y*sp); right=x*alt/denom
        forward=(d*sp+y*cp)*alt/denom-d*sp
        radius=math.hypot(right,forward)
        if radius>maxdist*d: right*=maxdist*d/radius; forward*=maxdist*d/radius
        dx=right*math.cos(bearing)+forward*math.sin(bearing)
        dy=right*math.sin(bearing)-forward*math.cos(bearing)
        points.append((cx+dx/scale,cy+dy/scale))
    return min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)


def plan(scene_path, providers, step=.25, maxdist=2.6, selection=None, width=1920, height=1080):
    if not math.isfinite(step) or not math.isfinite(maxdist) or step<=0 or maxdist<=0: raise ValueError('step y maxdist deben ser positivos')
    if not all(math.isfinite(v) and v>0 for v in (width,height)): raise ValueError('width y height deben ser positivos')
    result={}
    for sample in samples(scene_path,step,selection,width,height):
        pose,look=sample['pose'],sample['look']; sat=look.get('sat',{}); ids=['terrain-aws' if look.get('dem') == 'raw' else 'terrain-land']
        if sat.get('visible'):
            ids.append('gibs-bluemarble')
            if sat.get('viirs') and pose['zoom']>=7: ids.append('gibs-viirs')
            if sat.get('detail') and pose['zoom']>=8: ids.append(sat['detail'])
        bounds=footprint(pose,maxdist,width,height)
        for name in ids:
            p=providers[name]
            if not p.commercial_ok: raise ValueError(f'{name}: proveedor no comercial')
            levels={max(p.min_zoom,min(p.max_zoom,math.ceil(pose['zoom'])+i)) for i in (0,1)} | set(range(p.min_zoom,min(3,p.max_zoom)+1))
            for z in levels:
                n=2**z; x0,y0,x1,y1=bounds
                if p.coverage_bbox:
                    west,south,east,north=p.coverage_bbox
                    cov=lambda lon,lat: ((lon+180)/360,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2)
                    ax,ay=cov(west,north); bx,by=cov(east,south)
                    x0,x1=max(x0,ax),min(x1,bx); y0,y1=max(y0,ay),min(y1,by)
                    if x0>x1 or y0>y1: continue
                lo_x,hi_x=math.floor(x0*n)-1,math.floor(x1*n)+1
                lo_y,hi_y=max(0,math.floor(y0*n)-1),min(n-1,math.floor(y1*n)+1)
                if p.coverage_bbox:
                    c0=lonlat_to_tile(west,north,z);c1=lonlat_to_tile(east,south,z)
                    lo_x=max(lo_x,c0[0]);hi_x=min(hi_x,c1[0]);lo_y=max(lo_y,c0[1]);hi_y=min(hi_y,c1[1])
                tiles=result.setdefault(name,set())
                for x in range(lo_x,hi_x+1):
                    for y in range(lo_y,hi_y+1): tiles.add((z,x%n,y))
    return result


def report_and_fetch(planned,providers,fetch=False):
    cache=TileCache(); missing={name:[tile for tile in sorted(tiles) if not cache.has(providers[name],*tile)] for name,tiles in planned.items()}
    for name,items in sorted(missing.items()):
        existing=[cache.path_for(providers[name],*tile) for tile in planned[name] if cache.has(providers[name],*tile)]
        avg=sum(p.stat().st_size for p in existing)/len(existing) if existing else 30000
        print(f'{name}: {len(planned[name])} previstas, {len(items)} faltantes, estimación {int(avg*len(items)):,} bytes',flush=True)
    if fetch:
        jobs=[(providers[name],*tile) for name,items in missing.items() for tile in items]
        def get(job):
            try:
                data=cache.get_or_fetch(*job)
                return len(data) if data else 0
            except Exception: return -1
        total=failed=0
        with ThreadPoolExecutor(max_workers=8) as pool:
            for i,size in enumerate(pool.map(get,jobs),1):
                if size<=0: failed+=1
                else: total+=size
                if i%100==0 or i==len(jobs): print(f'Descargas: {i}/{len(jobs)}, bytes: {total:,}, fallos: {failed}',flush=True)
        if failed: raise RuntimeError(f'{failed} teselas no descargadas')
