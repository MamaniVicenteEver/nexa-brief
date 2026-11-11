#!/usr/bin/env python3
"""Contratos Canvas en Chromium: trazos históricos, reserva, seek y precarga."""
import argparse, functools, http.server, json, shutil, socketserver, threading
from pathlib import Path
A=Path(__file__).resolve().parents[2]
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('episodio',type=Path);ap.add_argument('--baseline',type=Path,required=True,help='hud.js anterior al cambio, guardado como evidencia')
args=ap.parse_args();D=args.episodio.resolve();shutil.copyfile(args.baseline,'/tmp/tpl/noticiero-a-hud-before.js')
class Q(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
srv=socketserver.ThreadingTCPServer(('127.0.0.1',0),functools.partial(Q,directory='/tmp/tpl'));threading.Thread(target=srv.serve_forever,daemon=True).start()
from playwright.sync_api import sync_playwright
try:
 with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page();pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/');warnings=[];pg.on('console',lambda m:warnings.append(m.text) if m.type=='warning' else None)
  result=pg.evaluate('''async(base)=>{
   const now=await import('/sandbox/nodehistory/_atlas/hud.js'),old=await import('/noticiero-a-hud-before.js');
   const canvas=document.createElement('canvas');canvas.width=576;canvas.height=1024;const g=canvas.getContext('2d',{willReadFrequently:true});
   const view={W:576,H:1024,project:()=>({x:288,y:512,visible:true})};const env={base,loadImg:src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;})};
   const pixels=()=>new Uint8Array(g.getImageData(0,0,576,1024).data);const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
   const render=(hud,t=2.6)=>{g.clearRect(0,0,576,1024);hud.draw(g,t,view);return pixels();};const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
   let legacy=[];
   for(const name of Object.keys(old.ICONS)){
    const scene={hud:[{type:'chip',icon:name,label:name,size:80,t:0}]};const a=old.createHud(scene,env),b=now.createHud(scene,env);await Promise.all([a.ready(),b.ready()]);assert(eq(render(a),render(b)),'Icono histórico alterado: '+name);legacy.push(name);
   }
   const star=now.createHud({hud:[{type:'chip',icon:'star',t:0}]},env);await star.ready();
   for(const name of ['inexistente','constructor']){const bad=now.createHud({hud:[{type:'chip',icon:name,t:0}]},env);await bad.ready();assert(eq(render(star),render(bad)),'Reserva distinta de star');render(bad);render(bad);}
   const names=['tank','missile','fighter-jet','warship','soldier','cpu','satellite','hospital','handshake','barrel'];
   const scene={hud:names.map((icon,i)=>({type:'chip',icon,label:icon,x:.1+(i%5)*.2,y:.35+Math.floor(i/5)*.25,size:55,t:0}))};const hud=now.createHud(scene,env);await hud.ready();
   const first=render(hud);render(hud,.16);render(hud,4.2);assert(eq(first,render(hud)),'Seek dependiente del orden');
   const defaults=now.createHud({hud:[{type:'icon-grid',t:0}]},env);await defaults.ready();render(defaults);
   const NativePath=window.Path2D;let allocations=0;window.Path2D=class extends NativePath{constructor(...args){super(...args);allocations++;}};
   const grid=now.createHud({hud:[{type:'icon-grid',category:'economia',t:0}]},env);await grid.ready();const prepared=allocations;const times=[];
   for(let i=0;i<150;i++){g.clearRect(0,0,576,1024);const t=performance.now();grid.draw(g,i/10,view);times.push(performance.now()-t);}assert(allocations===prepared,'Path2D creado por cuadro');window.Path2D=NativePath;
   const missing=now.createHud({hud:[{type:'logo-chip',label:'Nexa Brief',t:0},{type:'logo-chip',src:'media/no-existe.png',label:'Nexa Brief',x:.7,t:0}]},env);await missing.ready();render(missing);assert(missing.missing().length===1,'No informa imagen ausente');
   const logo=now.createHud({hud:[{type:'logo-chip',src:'media/noticiero-logo-test.svg',label:'Nexa Brief',t:0}]},env);await logo.ready();assert(logo.missing().length===0,'No carga SVG relativo');const nativeDraw=g.drawImage.bind(g);let fitRatio;g.drawImage=(im,x,y,w,h)=>{fitRatio=w/h;nativeDraw(im,x,y,w,h);};render(logo);assert(Math.abs(fitRatio-360/160)<1e-8,'Logo deformado');g.drawImage=nativeDraw;
   // Los bytes de la imagen rectangular aparecen en la placa sin ocupar todo el alto.
   const data=pixels();let blue=0;for(let i=0;i<data.length;i+=4)if(data[i]===18&&data[i+1]===53&&data[i+2]===91)blue++;assert(blue>100,'Logo vacío');
   return {legacy_exact:legacy,seek_exact:true,unknown_fallback_exact:true,path2d_prepared:prepared,path2d_per_frame:allocations-prepared,grid_150_frames_ms:times.reduce((a,b)=>a+b,0),grid_mean_ms:times.reduce((a,b)=>a+b,0)/times.length,missing_logo_fallback:true,relative_svg:true,contain_ratio:fitRatio,default_grid:true};
  }''',f'http://127.0.0.1:{srv.server_address[1]}/sandbox/nodepolitics/{D.name}/assets/')
  result['warnings']=warnings;out=D/'work/results/comp';out.mkdir(parents=True,exist_ok=True);(out/'contratos-identidad.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2));b.close()
finally:srv.shutdown();srv.server_close()
