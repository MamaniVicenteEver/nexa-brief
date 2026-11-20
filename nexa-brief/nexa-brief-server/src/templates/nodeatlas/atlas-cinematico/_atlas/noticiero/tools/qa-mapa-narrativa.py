#!/usr/bin/env python3
"""Showcase C y regresión por canvas final, con servidor Range y cierre explícito."""
import argparse, base64, functools, importlib.util, json, socketserver, subprocess, threading, time, signal
from pathlib import Path
A = Path(__file__).resolve().parents[2]
TYPES = 'range-ring pulse route-icon front-line geo-label choropleth quote-card timeline'.split()
def module(name, path):
    spec=importlib.util.spec_from_file_location(name,path); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('episodio',type=Path);ap.add_argument('--reference',choices=('antes','despues'));ap.add_argument('--format',choices=('9x16','16x9'),default='9x16');ap.add_argument('--only',default='');ap.add_argument('--limit',type=int,default=0);ap.add_argument('--skip',type=int,default=0);ap.add_argument('--cases',action='store_true');ap.add_argument('--benchmark',action='store_true');ap.add_argument('--gpu-finish',action='store_true');args=ap.parse_args()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(SystemExit('SIGTERM: cierre de QA')))
    D=args.episodio.resolve();out=D/'work/results/comp';out.mkdir(parents=True,exist_ok=True)
    identity=module('identity',Path(__file__).with_name('qa-identidad.py'));smoke=module('smoke',A/'test/smoke.py')
    class Q(smoke.Handler):
        def log_message(self,*args):pass
    class S(socketserver.ThreadingTCPServer):daemon_threads=True
    srv=S(('127.0.0.1',0),functools.partial(Q,directory='/tmp/tpl'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    report={'before':identity.sample(),'captures':[]};path=out/f'c-qa-{args.reference or args.format}-{"casos" if args.cases else "bench-gpu" if args.benchmark and args.gpu_finish else "bench" if args.benchmark else args.only.replace(",","_") or "all"}-{args.skip}.json'
    data=json.loads((D/'components.json').read_text());entries=[c for c in data['components'] if c.get('demo',{}).get('type') in TYPES]
    if args.only:entries=[c for c in entries if c['demo']['type'] in args.only.split(',') or c['name'] in args.only.split(',')]
    if args.cases:
        entries=entries if args.only else []
        for direction in ('este','oeste'):
            items=[]
            for j,(name,color) in enumerate([('plane','yellow'),('warship','blue'),('tank','green')]):
                lat=14+j*16; a,b=[165,lat],[-165,lat]
                if direction=='oeste': a,b=b,a
                items.append({'type':'route-icon','from':a,'via':[[180,lat+4]],'to':b,'icon':name,'t':.2,'out':6.5,'dur':5,'size':42,'lift':0,'color':color})
            entry={'name':'noticiero.route-antimeridiano-'+direction,'target':'scene','demo':{'camera':[{'t':0,'center':[180,32],'span':120,'pitch':20}],'hud':items}}
            entries.append(entry)
        data['components']+=entries
    if args.benchmark:entries=[c for c in entries if c['demo']['type']=='choropleth']
    if args.reference:entries=[{'name':'demo','times':[17.2,114]}]
    entries=entries[args.skip:]
    if args.limit:entries=entries[:args.limit]
    w,h=(576,1024) if args.format=='9x16' else (1280,720)
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            for entry in entries:
                subprocess.run(['rsync','-a',str(D)+'/', '/tmp/tpl/sandbox/nodepolitics/'+D.name+'/'],check=True)
                pg=b.new_page(viewport={'width':w,'height':h});pg.add_init_script(identity.TEXT_SPY);errors=[];warnings=[];http=[]
                pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:warnings.append(m.text) if m.type in ('warning','error') else None);pg.on('response',lambda r:http.append(r.url) if r.status>=400 else None)
                if args.cases:pg.route('**/components.json',lambda route:route.fulfill(json=data))
                if args.benchmark:
                    def instrument(route):
                        response=route.fetch();body=response.text().replace('c.map=new maplibre.Map','c.map=window.__testMap=new maplibre.Map')
                        route.fulfill(response=response,body=body)
                    pg.route('**/_atlas/atlas.js',instrument)
                url='index.html?t=17.2'  if args.reference else 'showcase.html?only='+entry['name']
                print('Abriendo',entry['name'],args.reference or args.format,flush=True)
                pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/sandbox/nodepolitics/{D.name}/'+url,wait_until='domcontentloaded')
                pg.wait_for_function('window.__promo && window.__promo.seek' if args.reference else 'window.__atlasPreview',timeout=120000)
                for t in entry.get('times',[2.6]):
                    pg.evaluate('window.__labels=[]');pg.evaluate('t=>__promo.seek(t)',t)
                    file=out/(f'c-{args.reference}_{t:g}.png' if args.reference else f'{entry["name"]}-{args.format}.png')
                    file.write_bytes(base64.b64decode(pg.evaluate('document.querySelector("#stage > canvas").toDataURL("image/png").split(",")[1]')))
                    from PIL import Image
                    if not args.reference:Image.open(file).convert('RGB').save(file.with_suffix('.webp'),quality=85)
                    capture=dict(name=entry['name'],t=t,file=str(file),errors=list(errors),warnings=list(warnings),http=list(http),missing=pg.evaluate('__promo.missingTiles()'),fps=pg.evaluate('__atlas.fps()'),labels=pg.evaluate('window.__labels'),resources=identity.sample(.5))
                    if args.benchmark:
                        samples=[];running=True
                        def monitor():
                            while running:samples.append(identity.sample(.5))
                        thread=threading.Thread(target=monitor,daemon=True);thread.start()
                        try:
                            report['benchmark']=pg.evaluate(BENCHMARK,args.gpu_finish)
                        finally:running=False;thread.join(timeout=2)
                        report['during_use']=samples
                        pg.evaluate('__promo.seek(2.6)')
                    report['captures'].append(capture);path.write_text(json.dumps(report,ensure_ascii=False,indent=2));print('Guardado',file.name,'errores',errors,'faltantes',capture['missing'],flush=True)
                report['idle']=identity.sample(2);pg.close();report['after_view']=identity.sample(2)
            b.close()
        report['after_browser']=identity.sample(2)
    finally:srv.shutdown();srv.server_close();path.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    if not args.reference and any(c['errors'] or c['http'] or c['missing'] for c in report['captures']):raise SystemExit(1)
BENCHMARK = """async finish => {
 const m=__testMap, id=m.getStyle().layers.find(l=>l.id.startsWith('choro-')).id;
 const src=m.getSource(id), features=src.serialize().data.features;
 const choroLayers=m.getStyle().layers.filter(l=>l.id.startsWith('choro-'));
 let sourceUpdates=0,paintUpdates=0,adds=0;
 const data=src.setData.bind(src),paint=m.setPaintProperty.bind(m),add=m.addSource.bind(m);
 src.setData=(...a)=>{sourceUpdates++;return data(...a);};
 m.setPaintProperty=(...a)=>{if(a[0]===id)paintUpdates++;return paint(...a);};
 m.addSource=(...a)=>{adds++;return add(...a);};
 const gl=m.painter.context.gl, context=document.querySelector('#stage > canvas').getContext('2d');
 const flush=()=>{if(finish){gl.finish();context.getImageData(0,0,1,1);}};
 const batches=[];
 for(let batch=0;batch<(finish?6:8);batch++)for(const visible of (batch%2?[true,false]:[false,true])) {
   m.setLayoutProperty(id,'visibility',visible?'visible':'none');
   for(let j=0;j<5;j++){__nexaProtoControl.setTime(2.6,false);flush();}
   const times=[];
   for(let j=0;j<(finish?12:20);j++){const start=performance.now();__nexaProtoControl.setTime(2.6,false);flush();times.push(performance.now()-start);}
   batches.push({visible,terrainBatches:m.painter.renderToTexture?._stacks?.length ?? 0,meanMs:times.reduce((a,b)=>a+b,0)/times.length,times});
 }
 m.setLayoutProperty(id,'visibility','visible');
 await __promo.seek(2.6);flush();
 const mean=state=>{const a=batches.filter(b=>b.visible===state).flatMap(b=>b.times);return a.reduce((a,b)=>a+b,0)/a.length;};
 const baseline=mean(false),withCountries=mean(true);
 return {countries:features.length,fillLayers:choroLayers.length,sources:new Set(choroLayers.map(l=>l.source)).size,gpuCompletion:finish,frames:finish?204:400,measuredFrames:finish?144:320,sourceUpdates,sourceAdds:adds,settledPaintUpdates:paintUpdates,baselineMs:baseline,withCountriesMs:withCountries,relativePercent:(withCountries/baseline-1)*100,batches};
}"""
if __name__=='__main__':main()
