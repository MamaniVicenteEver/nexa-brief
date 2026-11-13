#!/usr/bin/env python3
"""Capturas y recursos del Showcase real; un navegador y una vista por vez."""
import argparse, base64, functools, importlib.util, json, socketserver, subprocess, threading, time
from pathlib import Path

A = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('episodio', type=Path)
    ap.add_argument('--format', choices=('9x16', '16x9'), required=True)
    ap.add_argument('--only', default='')
    ap.add_argument('--cases', action='store_true')
    args = ap.parse_args(); D = args.episodio.resolve(); out = D/'work/results/comp'
    out.mkdir(parents=True, exist_ok=True)
    identity = load('identity', Path(__file__).with_name('qa-identidad.py'))
    smoke = load('smoke', A/'test/smoke.py')

    class Quiet(smoke.Handler):
        def log_message(self, *args): pass

    class Server(socketserver.ThreadingTCPServer):
        daemon_threads = True

    srv = Server(('127.0.0.1', 0), functools.partial(Quiet, directory='/tmp/tpl'))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    data = json.loads((D/'components.json').read_text())
    types = {'bar-compare', 'line-series', 'delta', 'ranking', 'stacked-bar', 'ticker'}
    components = [c for c in data['components'] if c.get('demo', {}).get('type') in types]
    if args.only: components = [c for c in components if c['demo']['type'] in args.only.split(',')]
    if args.cases:
        for c in components:
            # Los cambios se sirven solo en la respuesta de prueba.
            d = c['demo']; typ = d['type']; d['width'] = 1800; d['x'] = .98; d['y'] = .94
            d['scalePortrait'] = 1.4; d['scaleLandscape'] = 1.2
            d['title'] = 'INDICADORES INTERNACIONALES CON UN TÍTULO MUY LARGO PARA PROBAR EL RECORTE'
            if typ == 'bar-compare':
                d['orientation'] = 'vertical'; d.pop('highlight', None)
                d['steps'][0]['bars'] = [dict(label='Exportaciones manufactureras de la región '+str(i), value=1234.5+i*300, color=['blue','red','yellow','green','orange','white'][i]) for i in range(6)]
            elif typ == 'line-series':
                d['series'] = [dict(label='Serie económica de nombre muy extenso '+str(i), color=['blue','yellow','green'][i], points=[[0,1234.5],[1,1235.7],[2,1233.2],[3,1234.5]]) for i in range(3)]
                d.pop('steps', None); d['marker'] = dict(t=1.4, x=2, text='ANUNCIO DE POLÍTICA ECONÓMICA')
            elif typ == 'delta':
                d['steps'] = [dict(t=.2, value=-4.2), dict(t=3.8, value=0)]
                d['good'] = 'down'; d['label'] = 'INDICADOR CON UN NOMBRE EXCESIVAMENTE LARGO PARA EL PANEL'; d['period'] = 'COMPARADO CON EL MISMO PERÍODO DEL AÑO ANTERIOR'
            elif typ == 'ranking':
                d['steps'][0]['items'] = [dict(name='Sector económico con nombre muy largo '+str(i), value=1234.5+i, **({'flag':'US'} if i==0 else {'icon':['bank','oil','cpu','hospital'][i-1]})) for i in range(5)]
            elif typ == 'stacked-bar':
                d['steps'][0]['parts'] = [dict(label='Bloque de nombre especialmente largo '+str(i), value=v, color=['blue','red','green','yellow','orange'][i]) for i,v in enumerate([1234,800,2,.5,.1])]
                d['decimals'] = 1
            elif typ == 'ticker':
                d['steps'][0]['items'] = [dict(label='Cotización de nombre muy largo '+str(i), value=1234.5, change=[-4.2,0,4.2][i%3], unit='USD') for i in range(6)]
    w,h = (576,1024) if args.format == '9x16' else (1280,720)
    report = {'before': identity.sample(), 'captures': []}
    suffix = '-' + args.only.replace(',', '_') if args.only else ''
    path = out/f'qa-datos-{"casos-" if args.cases else ""}{args.format}{suffix}.json'
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            for c in components:
                subprocess.run(['rsync','-a',str(D)+'/', '/tmp/tpl/sandbox/nodepolitics/'+D.name+'/'], check=True)
                page = browser.new_page(viewport={'width':w,'height':h}); page.add_init_script(identity.TEXT_SPY)
                errors=[]; warnings=[]; http=[]
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.on('console', lambda m: warnings.append(m.text) if m.type in ('warning','error') else None)
                page.on('response', lambda r: http.append(r.url) if r.status >= 400 else None)
                if args.cases: page.route('**/components.json', lambda route: route.fulfill(json=data))
                t0=time.monotonic()
                page.goto(f'http://127.0.0.1:{srv.server_address[1]}/sandbox/nodepolitics/{D.name}/showcase.html?only={c["name"]}', wait_until='domcontentloaded')
                page.wait_for_function('window.__atlasPreview', timeout=120000)
                report['settled'] = identity.sample(2)
                page.evaluate('window.__labels=[]'); page.evaluate('__promo.seek(2.6)')
                labels=page.evaluate('window.__labels'); issues=[]
                for l in labels:
                    if min(l['x'],l['y']) < 0 or l['x']+l['w'] > w or l['y']+l['h'] > h*.8:
                        issues.append({'bounds':l})
                for i,a in enumerate(labels):
                    for b in labels[i+1:]:
                        if min(a['x']+a['w'],b['x']+b['w']) > max(a['x'],b['x'])+1 and min(a['y']+a['h'],b['y']+b['h']) > max(a['y'],b['y'])+1:
                            issues.append({'overlap':[a,b]})
                prefix='caso-' if args.cases else ''
                file=out/f'{prefix}{c["name"]}-{args.format}.png'
                encoded=page.evaluate('document.querySelector("#stage > canvas").toDataURL("image/png").split(",")[1]')
                file.write_bytes(base64.b64decode(encoded))
                from PIL import Image
                Image.open(file).convert('RGB').save(file.with_suffix('.webp'), quality=85)
                missing=page.evaluate('__promo.missingTiles()')
                entry=dict(name=c['name'],format=args.format,errors=errors,warnings=warnings,http_errors=http,missing=missing,issues=issues,labels=labels,file=str(file),seconds=round(time.monotonic()-t0,2),fps=page.evaluate('__atlas.fps()'),resources=identity.sample(.5))
                report['captures'].append(entry); page.close(); report['after_view']=identity.sample(2)
                path.write_text(json.dumps(report,ensure_ascii=False,indent=2))
                print(c['name'],args.format,'issues',len(issues),'errors',errors,'missing',missing,'seconds',entry['seconds'],flush=True)
            browser.close()
        report['after_browser']=identity.sample(2)
    finally:
        srv.shutdown();srv.server_close();path.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    if any(c['errors'] or c['http_errors'] or c['missing'] or c['issues'] for c in report['captures']):
        raise SystemExit(1)


if __name__ == '__main__': main()
