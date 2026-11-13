#!/usr/bin/env python3
"""Contratos C: datos inválidos, anclas, Canvas, seek y recursos por cuadro."""
import argparse, functools, http.server, importlib.util, json, socketserver, subprocess, sys, tempfile, threading
from pathlib import Path
A=Path(__file__).resolve().parents[2]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def main():
    ap=argparse.ArgumentParser();ap.add_argument('episodio',type=Path);args=ap.parse_args();D=args.episodio.resolve()
    check=module('check',Path(__file__).with_name('check.py'));validator=module('validator',Path(__file__).with_name('validar-mapa-narrativa.py'))
    geo={ft['properties']['id'] for name in ('admin0','admin1') for ft in json.loads((A/f'data/geo/{name}.geojson').read_text())['features']}
    icons=set(json.loads((A/'assets/icons/noticiero-icons.json').read_text()))|check.ICONOS_CLASICOS
    types=check.HUD_MAPA_NARRATIVA|{'choropleth'};entries=[c for c in json.loads((A/'noticiero/componentes.json').read_text())['components'] if c['demo']['type'] in types]
    demos=[c['demo'] for c in entries];scene={k:[c['demo'] for c in entries if c['target']==k] for k in ('hud','layers')}
    R=check.Informe();validator.validar(scene,R,lambda v: v if isinstance(v,(int,float)) else None,geo,icons);assert not R.E,R.E
    invalid=[dict(type='range-ring',at=[0,91],rings=[-3]),dict(type='pulse',at='ausente',period=0),dict(type='route-icon',icon='constructor',**{'from':[0,0],'to':[1,1],'via':['no']}),dict(type='front-line',points=[[0,0],[float('nan'),1]]),dict(type='geo-label',at=[1,1],text=3),dict(type='choropleth',values={'ZZ':1},scale=['red'],domain=[2,1]),dict(type='quote-card',text='',name=''),dict(type='timeline',events=[dict(date='hoy',label='prueba',icon='bad',t='@ausente')]*3)]
    rejected=[]
    for d in invalid:
        R=check.Informe();validator.validar({'layers' if d['type']=='choropleth' else 'hud':[d]},R,lambda v:v if isinstance(v,(int,float)) else None,geo,icons);assert R.E,d;rejected.append(R.E)
    words=[w for s in json.loads((D/'assets/lyrics.json').read_text())['segments'] for w in s.get('words',[])]
    timer=check.make_timer(words);word=next(check.norm(w['word']) for w in words if check.norm(w['word']))
    anchored={'hud':[dict(type='timeline',t='@'+word,events=[dict(date=str(i),label='Hito',t='@'+word+f'+{i}') for i in range(3)])]}
    R=check.Informe();validator.validar(anchored,R,timer,geo,icons);assert not R.E,R.E
    with tempfile.TemporaryDirectory(prefix='noticiero-c-check-',dir='/tmp') as tmp:
        root=Path(tmp);(root/'assets').mkdir();(root/'index.html').symlink_to(D/'index.html')
        for src in (D/'assets').iterdir():
            if src.name!='scene.json':(root/'assets'/src.name).symlink_to(src)
        original=json.loads((D/'assets/scene.json').read_text());extra=json.loads(json.dumps(scene))
        for target,items in extra.items():
            for item in items:
                item['t']='@'+word;item['out']=original['duration']
                for j,event in enumerate(item.get('events',[])):event['t']='@'+word+f'+{j}'
            original[target]+=items
        dest=root/'assets/scene.json';dest.write_text(json.dumps(original))
        command=[sys.executable,str(Path(__file__).with_name('check.py')),str(root)]
        valid=subprocess.run(command,capture_output=True,text=True);assert valid.returncode==0,valid.stdout+valid.stderr
        timeline=next(x for x in original['hud'] if x['type']=='timeline');timeline['events'][0]['t']='@anclainexistentec'
        quote=next(x for x in original['hud'] if x['type']=='quote-card');quote['src']='media/no-existe-c.png'
        dest.write_text(json.dumps(original));invalid_scene=subprocess.run(command,capture_output=True,text=True)
        assert invalid_scene.returncode==1 and 'events[0].t' in invalid_scene.stdout and 'no-existe-c.png' in invalid_scene.stdout,invalid_scene.stdout+invalid_scene.stderr
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    class S(socketserver.ThreadingTCPServer):daemon_threads=True
    srv=S(('127.0.0.1',0),functools.partial(Q,directory='/tmp/tpl'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            b=p.chromium.launch();pg=b.new_page();pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/');result=pg.evaluate((A/'noticiero/test/mapa-narrativa.browser.js').read_text(),demos);b.close()
    finally:srv.shutdown();srv.server_close()
    result.update(invalid=rejected,voiceAnchor='@'+word,fullSceneCheck=valid.stdout,invalidSceneCheck=invalid_scene.stdout);out=D/'work/results/comp/c-contratos.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
