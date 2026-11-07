#!/usr/bin/env python3
"""Prepara y audita los datos locales de Atlas Cinemático."""
import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import http.server
import json
import mimetypes
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from urllib.request import Request, urlopen

SERVER = Path(__file__).resolve().parents[4]
TEMPLATES = SERVER / 'src/templates'
sys.path.insert(0, str(SERVER))
from src.adapters.maps.cache import TileCache, USER_AGENT, terrain_land
from src.adapters.maps.providers import ATLAS, load_providers
from src.adapters.maps.vector import extract, pmtiles_binary
from src.adapters.maps.licensing import LicenseBlocked
from src.templates._tools.http_media import MediaRequestHandler

CACHE = ATLAS / 'cache'

def doctor(providers):
    failures = 0
    try:
        binary = pmtiles_binary()
        version = subprocess.check_output([str(binary), 'version'], text=True).strip()
        print(f'pmtiles: {version} ({binary})')
    except Exception as exc:
        failures += 1
        print(f'pmtiles: ERROR ({type(exc).__name__})')
    usage = shutil.disk_usage(ATLAS)
    print(f'Disco libre: {usage.free / 1024**3:.2f} GiB')
    for p in providers.values():
        if not p.commercial_ok:
            print(f'{p.id}: bloqueado por licencia')
        elif p.kind == 'vector':
            print(f'{p.id}: vector local (ver pmtiles)')
        else:
            try:
                with urlopen(Request(p.tile_url(0,0,0), headers={'User-Agent': USER_AGENT}), timeout=30) as r:
                    if r.status != 200 or not r.read(1): raise RuntimeError('respuesta vacía')
                print(f'{p.id}: disponible')
            except Exception as exc:
                failures += 1
                print(f'{p.id}: ERROR ({type(exc).__name__})')
    return failures

def seed(providers):
    cache = TileCache()
    jobs = [(providers[name], z, x, y) for z in range(6) for x in range(2**z) for y in range(2**z) for name in ('gibs-bluemarble','terrain-aws')]
    def fetch(job):
        p,z,x,y = job
        try:
            return cache.get_or_fetch(p,z,x,y) is not None
        except Exception:
            return False
    failed = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, ok in enumerate(pool.map(fetch, jobs), 1):
            failed += not ok
            if i % 100 == 0 or i == len(jobs): print(f'Teselas: {i}/{len(jobs)}, fallos: {failed}', flush=True)
    if failed: raise RuntimeError(f'{failed} teselas fallaron')
    world = CACHE / 'vector/world.pmtiles'
    valid = False
    if world.is_file():
        try:
            header = json.loads(subprocess.check_output([str(pmtiles_binary()), 'show', str(world), '--header-json'], text=True))
            valid = header.get('minzoom') == 0 and header.get('maxzoom') == 6 and header.get('bounds', [0,0,0,0])[0] <= -180 and header.get('bounds', [0,0,0,0])[2] >= 180
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    if valid: print('Vector mundial z0–6 ya disponible')
    else: extract((-180,-85.05112878,180,85.05112878), 6, world)

def assets():
    vendor = ATLAS / 'vendor'
    with tempfile.TemporaryDirectory(prefix='atlas-assets-', dir='/tmp') as temp:
        tmp = Path(temp)
        subprocess.run(['git','clone','--depth','1','https://github.com/protomaps/basemaps-assets.git',str(tmp/'assets')], check=True)
        for font in ('Noto Sans Regular','Noto Sans Medium','Noto Sans Italic'):
            shutil.copytree(tmp/'assets/fonts'/font, CACHE/'fonts'/font, dirs_exist_ok=True)
        sprites = CACHE/'sprites'
        sprites.mkdir(parents=True, exist_ok=True)
        for name in ('light','dark','white','grayscale','black'):
            for source in (tmp/'assets/sprites/v4').glob(name+'*'):
                if source.is_file(): shutil.copy2(source, sprites/source.name)
        subprocess.run(['npm','install','--prefix',str(tmp/'npm'),'--cache',str(tmp/'npm-cache'),'--no-audit','--no-fund','maplibre-gl@6.16.0','pmtiles','@protomaps/basemaps@5','esbuild'], check=True)
        nm = tmp/'npm/node_modules'
        vendor.mkdir(parents=True, exist_ok=True)
        for name in ('maplibre-gl.mjs','maplibre-gl-worker.mjs','maplibre-gl.css'):
            shutil.copy2(nm/'maplibre-gl/dist'/name, vendor/name)
        shared = nm/'maplibre-gl/dist/maplibre-gl-shared.mjs'
        if shared.exists() and 'maplibre-gl-shared.mjs' in (vendor/'maplibre-gl.mjs').read_text():
            if not shared.stat().st_size: raise RuntimeError('maplibre-gl-shared.mjs importado pero vacío')
            shutil.copy2(shared, vendor/shared.name)
        subprocess.run([str(nm/'.bin/esbuild'), str(nm/'pmtiles/dist/esm/index.js'), '--bundle', '--format=esm', '--platform=browser', '--outfile='+str(vendor/'pmtiles.js')], check=True)
        package = json.loads((nm/'@protomaps/basemaps/package.json').read_text())
        shutil.copy2(nm/'@protomaps/basemaps'/package['module'], vendor/'protomaps-basemaps.js')
        lines = ['# Versiones y licencias', '']
        for name in ('maplibre-gl','pmtiles','@protomaps/basemaps'):
            data = json.loads((nm/name/'package.json').read_text())
            lines.append(f'- {name} {data["version"]}: {data.get("license", "ver paquete original")}')
        lines.append('- Fuentes y sprites: protomaps/basemaps-assets; consultar licencias y atribuciones del repositorio de origen.')
        (vendor/'VERSIONS.md').write_text('\n'.join(lines)+'\n')

def sizes():
    if not CACHE.exists(): print('Caché vacía'); return
    for child in sorted(CACHE.iterdir()):
        total = sum(p.stat().st_size for p in child.rglob('*') if p.is_file()) if child.is_dir() else child.stat().st_size
        print(f'{child.name}: {total:,} bytes ({total/1024**2:.2f} MiB)')

async def warm(scene, step, margin, providers, width=1920, height=1080, selection=""):
    from playwright.async_api import async_playwright
    scene = Path(scene).resolve()
    scene.relative_to(TEMPLATES.resolve())
    if step <= 0 or margin <= 0 or width <= 0 or height <= 0: raise ValueError('step, margin, width y height deben ser positivos')
    page_file = scene.parent.parent / 'index.html' if scene.parent.name == 'assets' else scene.parent / 'index.html'
    if not page_file.is_file(): raise FileNotFoundError('No existe la página de la escena')
    cache = TileCache()
    stats = {}
    handler = partial(MediaRequestHandler, directory=str(TEMPLATES))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            try:
                page = await browser.new_page(viewport={'width':width,'height':height})
                async def route_tile(route):
                    from urllib.parse import unquote, urlsplit
                    path = unquote(urlsplit(route.request.url).path)
                    suffix = path.split('/_atlas/cache/',1)[-1]
                    match = re.fullmatch(r'([^/]+)/(\d+)/(\d+)/(\d+)\.(jpg|png|webp)', suffix)
                    if not match:
                        await route.continue_(); return
                    name,z,x,y,ext = match.groups()
                    p = providers.get(name)
                    if p is None or p.ext != ext:
                        await route.fulfill(status=404); return
                    z,x,y = map(int,(z,x,y))
                    entry = stats.setdefault(name, {'faltantes':0})
                    if cache.has(p,z,x,y):
                        await route.continue_(); return
                    entry['faltantes'] += 1
                    await route.fulfill(status=404)
                await page.route('**/_atlas/cache/**', route_tile)
                path = page_file.relative_to(TEMPLATES).as_posix()
                from urllib.parse import urlencode
                query = urlencode({'warm':'1','scene':scene.relative_to(page_file.parent).as_posix()})
                if selection: query += '&' + selection.lstrip('?')
                await page.goto(f'http://127.0.0.1:{server.server_port}/{path}?{query}')
                missing = await page.evaluate('(step) => window.__atlas.sweep(step)',step)
            finally: await browser.close()
    finally:
        server.shutdown(); server.server_close(); thread.join()
    print(json.dumps({'margin': margin, 'proveedores':stats, 'errores':missing}, ensure_ascii=False, indent=2))
    if missing or any(v['faltantes'] for v in stats.values()): raise RuntimeError('La verificación encontró recursos faltantes')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest='cmd', required=True)
    for cmd in ('doctor','seed','assets','sizes','terrain-land'): subs.add_parser(cmd)
    credits_parser = subs.add_parser('credits'); credits_parser.add_argument('scene')
    fetch = subs.add_parser('fetch'); fetch.add_argument('provider'); fetch.add_argument('z',type=int); fetch.add_argument('x',type=int); fetch.add_argument('y',type=int); fetch.add_argument('--allow-noncommercial',action='store_true')
    vector = subs.add_parser('vector'); vector.add_argument('--bbox',required=True); vector.add_argument('--maxzoom',required=True,type=int); vector.add_argument('--id',required=True)
    plan_parser = subs.add_parser('plan'); plan_parser.add_argument('scene'); plan_parser.add_argument('--step',type=float,default=.25); plan_parser.add_argument('--maxdist',type=float,default=2.6); plan_parser.add_argument('--fetch',action='store_true'); plan_parser.add_argument('--selection',default='',help='Query Proto, por ejemplo c=atlas.outrov2&cx=1'); plan_parser.add_argument('--width',type=int,default=1920); plan_parser.add_argument('--height',type=int,default=1080)
    warm_parser = subs.add_parser('warm'); warm_parser.add_argument('--verify',action='store_true',required=True);  warm_parser.add_argument('scene'); warm_parser.add_argument('--step',type=float,default=5); warm_parser.add_argument('--width',type=int,default=1920); warm_parser.add_argument('--height',type=int,default=1080); warm_parser.add_argument('--selection',default=''); warm_parser.add_argument('--margin',type=float,default=1.25, help='Reservado para la futura interfaz de barrido; aún no modifica la cobertura')
    args = parser.parse_args()
    providers = load_providers()
    try:
        if args.cmd == 'doctor': return bool(doctor(providers))
        if args.cmd == 'seed': seed(providers)
        if args.cmd == 'assets': assets()
        if args.cmd == 'sizes': sizes()
        if args.cmd == 'terrain-land':
            raw = CACHE / 'terrain-aws'; dest = CACHE / 'terrain-land'; count = total = 0
            for source in raw.rglob('*.png'):
                target = dest / source.relative_to(raw)
                if target.exists(): continue
                data = terrain_land(source.read_bytes()); target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
                count += 1; total += len(data)
            print(f'Terreno convertido: {count} teselas, {total:,} bytes')
        if args.cmd == 'credits':
            scene = Path(args.scene).resolve()
            result = subprocess.run(['node', str(ATLAS / 'credits.mjs'), str(scene)], check=True, capture_output=True, text=True)
            print(result.stdout, end='')
        if args.cmd == 'fetch':
            p = providers[args.provider]
            data = TileCache().get_or_fetch(p,args.z,args.x,args.y,args.allow_noncommercial)
            if data is None: raise RuntimeError('Tesela ausente (404)')
            print(f'{TileCache().path_for(p,args.z,args.x,args.y)}: {len(data)} bytes')
        if args.cmd == 'vector':
            if not re.fullmatch(r'[a-zA-Z0-9_-]+',args.id): raise ValueError('id inválido')
            bbox = tuple(map(float,args.bbox.split(',')))
            extract(bbox,args.maxzoom,CACHE/'vector'/f'detail-{args.id}.pmtiles')
        if args.cmd == 'plan':
            from plan import plan, report_and_fetch
            report_and_fetch(plan(args.scene,providers,args.step,args.maxdist,args.selection,args.width,args.height),providers,args.fetch)
        if args.cmd == 'warm': asyncio.run(warm(args.scene,args.step,args.margin,providers,args.width,args.height,args.selection))
        return 0
    except (Exception, KeyboardInterrupt) as exc:
        print(f'Error: {type(exc).__name__}: {exc}' if isinstance(exc, (ValueError, LicenseBlocked)) else f'Error: {type(exc).__name__}', file=sys.stderr)
        return 1

if __name__ == '__main__': sys.exit(main())
