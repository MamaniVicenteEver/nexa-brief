#!/usr/bin/env python3
"""Contratos Canvas reales: anclas, seek, cifras, recursos y datos inválidos."""
import argparse, functools, http.server, importlib.util, json, socketserver, subprocess, sys, tempfile, threading
from pathlib import Path

A = Path(__file__).resolve().parents[2]


def main():
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('episodio',type=Path); ap.add_argument('--resources',action='store_true'); args=ap.parse_args()
    spec=importlib.util.spec_from_file_location('check',Path(__file__).with_name('check.py'))
    check=importlib.util.module_from_spec(spec); spec.loader.exec_module(check)
    spec=importlib.util.spec_from_file_location('identity',Path(__file__).with_name('qa-identidad.py'))
    identity=importlib.util.module_from_spec(spec);spec.loader.exec_module(identity)
    resources={'before':identity.sample()} if args.resources else None
    catalog=json.loads((A/'noticiero/componentes.json').read_text())['components']
    demos=[c['demo'] for c in catalog if c['demo']['type'] in check.HUD_DATOS]
    R=check.Informe();check.validar_datos(demos,R);assert not R.E,R.E
    bad=[{'type':'ranking','items':[{'name':str(i),'value':1,'flag':'ZZ','icon':'constructor'} for i in range(3)]},
         {'type':'bar-compare','bars':[{'label':'x','value':-1}],'orientation':'diagonal','decimals':-1},
         {'type':'line-series','series':[{'points':[[2,1],[1,2]]}],'marker':{'label':'ausente'}},
         {'type':'delta','value':float('inf'),'count':-1,'locale':'es_ES','good':'side'},
         {'type':'stacked-bar','parts':[{'label':'x','value':0}]},
         {'type':'ticker','items':[{'label':str(i),'value':1,'change':'mucho'} for i in range(2)]},
         {'type':'delta','steps':[{'value':2}]}]
    rejected=[]
    for item in bad:
        R=check.Informe();check.validar_datos([item],R);assert R.E,item;rejected.append(R.E)

    # Escena completa con anclas reales, conservando todos los datos del demo.
    with tempfile.TemporaryDirectory(prefix='noticiero-b-check-', dir='/tmp') as tmp:
        root=Path(tmp); (root/'assets').mkdir(); (root/'index.html').symlink_to(args.episodio/'index.html')
        for src in (args.episodio/'assets').iterdir():
            if src.name!='scene.json': (root/'assets'/src.name).symlink_to(src)
        lyrics=json.loads((args.episodio/'assets/lyrics.json').read_text())
        word=next(check.norm(w['word']) for seg in lyrics['segments'] for w in seg.get('words',[]) if check.norm(w['word']))
        anchor='@'+word
        scene=json.loads((args.episodio/'assets/scene.json').read_text()); extra=json.loads(json.dumps(demos))
        for d in extra:
            d['t']=anchor;d['out']=scene['duration']
            for step in d.get('steps',[]): step['t']=anchor
            if 'marker' in d: d['marker']['t']=anchor
        scene['hud']+=extra; path=root/'assets/scene.json';path.write_text(json.dumps(scene))
        valid=subprocess.run([sys.executable,str(Path(__file__).with_name('check.py')),str(root)],capture_output=True,text=True)
        assert valid.returncode==0,valid.stdout+valid.stderr
        next(d for d in extra if d['type']=='line-series')['marker']['t']='@anclaquenoexisteb'
        path.write_text(json.dumps(scene))
        invalid=subprocess.run([sys.executable,str(Path(__file__).with_name('check.py')),str(root)],capture_output=True,text=True)
        assert invalid.returncode==1 and 'marker.t' in invalid.stdout,invalid.stdout+invalid.stderr

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    srv=socketserver.ThreadingTCPServer(('127.0.0.1',0),functools.partial(Quiet,directory='/tmp/tpl'))
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch();page=browser.new_page();page.goto(f'http://127.0.0.1:{srv.server_address[1]}/')
            result=page.evaluate('''async demos => {
              const {createHud}=await import('/sandbox/nodehistory/_atlas/hud.js');
              const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});
              const assert=(v,s)=>{if(!v)throw Error(s);};
              const times={'@inicio':1,'@cambio':3.8,'@marca':2.1,'@fin':7};
              let loads=0; const env={T:(v,d)=>typeof v==='number'?v:times[v]??d,loadImg:src=>new Promise(resolve=>{loads++;const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;})};
              let labels=[];const nativeText=g.fillText.bind(g);g.fillText=(s,x,y,...args)=>{
                const width=g.measureText(s).width,fs=Number(g.font.match(/([\\d.]+)px/)[1]),left=x-(g.textAlign==='center'?width/2:g.textAlign==='right'?width:0);
                const a=new DOMPoint(left,y-fs/2).matrixTransform(g.getTransform()),b=new DOMPoint(left+width,y+fs/2).matrixTransform(g.getTransform());
                labels.push({s:String(s),color:g.fillStyle,font:g.font,bounds:[a.x,a.y,b.x,b.y]});nativeText(s,x,y,...args);
              };
              const capture=(hud,t,view)=>{g.clearRect(0,0,canvas.width,canvas.height);labels=[];hud.draw(g,t,view);return canvas.toDataURL();};
              const cases=[],prepared=[];
              for(const demo of demos){
                const d=structuredClone(demo);d.t='@inicio';d.out='@fin';d.count=.7;d.stagger=.1;
                d.steps=d.steps||[];d.steps[0]={...d.steps[0],t:'@inicio'};
                let second=structuredClone(d.steps[0]);second.t='@cambio';
                for(const key of ['bars','items','parts'])if(second[key])for(const r of second[key])r.value*=1.5;
                if(d.type==='delta'){d.good='down';second.value=-2.5;}
                if(d.type==='line-series'){d.marker={...d.marker,t:'@marca'};second.series[0].points.at(-1).value=4.2;}
                d.steps.push(second);
                const hud=createHud({hud:[d]},env);await hud.ready();assert(!hud.missing().length,'Recursos ausentes '+d.type);prepared.push(hud);
                for(const [W,H] of [[576,1024],[1280,720]]){
                  canvas.width=W;canvas.height=H;const view={W,H};
                  const first=capture(hud,2.6,view);assert(labels.length,'Pieza vacía '+d.type);const full=structuredClone(labels);
                  const early=capture(hud,1.08,view);assert(first!==early,'Entrada sin animación '+d.type);
                  const changed=capture(hud,5.8,view);assert(first!==changed,'Step no cambia '+d.type);
                  capture(hud,1.3,view);assert(first===capture(hud,2.6,view),'Seek depende del orden '+d.type);
                  const pixels=g.getImageData(0,Math.ceil(H*.8),W,H-Math.ceil(H*.8)).data;
                  assert(pixels.every((v,i)=>i%4!==3||v===0),'Invade subtítulos '+d.type);
                  capture(hud,0,view);assert(labels.length===0,'Visible antes de t '+d.type);
                  capture(hud,8,view);assert(labels.length===0,'No sale tras out '+d.type);
                  if(d.type==='line-series'){
                    capture(hud,2,view);assert(!labels.some(l=>l.s.startsWith('CAMBIO')),'Marcador antes del ancla');
                    capture(hud,2.6,view);assert(labels.some(l=>l.s.startsWith('CAMBIO')),'Marcador ausente');
                    assert(full.some(l=>l.s==='4,8 %'),'Último valor sin unidad/decimal');
                  }
                  if(d.type==='delta'){
                    assert(full.some(l=>l.s==='+4,2 %'&&l.color==='#ff3b5c'),'good down no invierte subida');
                    capture(hud,5.8,view);assert(labels.some(l=>l.s==='-2,5 %'&&l.color==='#3ddc84'),'good down no invierte caída');
                  }
                  cases.push({type:d.type,format:W+'x'+H,seek_exact:true,animated:true,steps:true,subtitle_safe:true,labels:full});
                }
              }
              for(const [locale,expected] of [['es-ES','1.234,5 %'],['en-US','1,234.5 %']]){
                const hud=createHud({hud:[{type:'delta',value:1234.5,unit:'%',locale,decimals:1,t:0}]},env);await hud.ready();
                capture(hud,2.6,{W:1280,H:720});assert(labels.some(l=>l.s.endsWith(expected)),'Formato '+locale);
              }
              const custom=createHud({hud:[{type:'delta',value:0,unit:'%',t:0}] ,hudTheme:{fonts:{num:'monospace'},colors:{dim:'#123456'}}},env);await custom.ready();capture(custom,2.6,{W:1280,H:720});assert(labels.some(l=>l.s==='0,0 %'&&l.color==='#123456'&&l.font.includes('monospace')),'Tema, cero o fuente numérica');
              const longCases=[];
              for(const demo of demos){
                const d=structuredClone(demo);const long='Texto extraordinariamente largo para verificar los límites de cada columna '.repeat(8);
                d.title=long;d.label=long;d.period=long;d.x=.98;d.y=.94;d.scale=1.4;
                for(const state of [d,...(d.steps||[])]){
                  for(const key of ['bars','items','parts','series'])if(state[key])for(const [i,row] of state[key].entries()){row.label=long+i;if(row.name)row.name=long+i;}
                  if(state.highlight)delete state.highlight;
                }
                const hud=createHud({hud:[d]},env);await hud.ready();
                for(const [W,H] of [[576,1024],[1280,720]]){
                  canvas.width=W;canvas.height=H;capture(hud,2.6,{W,H});
                  assert(labels.some(l=>l.s.includes('…')),'No recorta texto largo '+d.type);
                  assert(labels.every(l=>l.bounds[0]>=0&&l.bounds[1]>=0&&l.bounds[2]<=W&&l.bounds[3]<=H*.8),'Texto fuera del cuadro '+d.type);
                  longCases.push({type:d.type,format:W+'x'+H,ellipsis:true,bounds:true});
                }
              }
              const NativeFormat=Intl.NumberFormat,NativeImage=window.Image,NativePath=window.Path2D,nativeCreate=document.createElement.bind(document);
              let allocations=0;Intl.NumberFormat=class extends NativeFormat{constructor(...a){super(...a);allocations++;}};window.Image=class extends NativeImage{constructor(...a){super(...a);allocations++;}};window.Path2D=class extends NativePath{constructor(...a){super(...a);allocations++;}};document.createElement=(...a)=>{allocations++;return nativeCreate(...a);};
              const durations=[];const start=performance.now();
              for(const hud of prepared){const t0=performance.now();for(let i=0;i<300;i++){labels=[];hud.draw(g,1+(i%180)/30,{W:1280,H:720});}durations.push((performance.now()-t0)/300);}
              const elapsed=performance.now()-start;
              Intl.NumberFormat=NativeFormat;window.Image=NativeImage;window.Path2D=NativePath;document.createElement=nativeCreate;
              assert(allocations===0,'Recursos creados por cuadro');
              window.__dataSoak=seconds=>{const end=performance.now()+seconds*1000;let frames=0;while(performance.now()<end){for(const hud of prepared){labels=[];g.clearRect(0,0,canvas.width,canvas.height);hud.draw(g,1+(frames%180)/30,{W:1280,H:720});frames++;}}return {frames,pixels:g.getImageData(0,0,1,1).data.length};};
              return {cases,long_text_cases:longCases,locale_exact:true,theme_exact:true,ranking_images_loaded:loads,resources_per_frame:allocations,draw_mean_ms:durations,frames:1800,elapsed_ms:elapsed};
            }''',demos)
            if args.resources:
                resources['idle']=identity.sample(2); resources['during']=[]
                sampler=threading.Thread(target=lambda: [resources['during'].append(identity.sample(3)) for _ in range(6)])
                sampler.start(); resources['exercise']=page.evaluate('__dataSoak(18)'); sampler.join()
                resources['after_use']=identity.sample(2);page.close();resources['after_view']=identity.sample(2)
            result['invalid_rejected']=rejected
            result['full_scene_real_anchors']=valid.stdout
            result['unknown_marker_anchor_rejected']=True
            browser.close()
        if args.resources: resources['after_browser']=identity.sample(2);result['resources']=resources
        path=args.episodio/'work/results/comp/contratos-datos.json';path.write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps({k:v for k,v in result.items() if k not in ('cases','invalid_rejected','full_scene_real_anchors','resources')},ensure_ascii=False,indent=2))
    finally: srv.shutdown();srv.server_close()


if __name__=='__main__': main()
