#!/usr/bin/env python3
"""Casos de aceptación compuestos en el Showcase real; catálogo temporal por route."""
import argparse, base64, functools, importlib.util, json, socketserver, subprocess, threading, time
from pathlib import Path
A=Path(__file__).resolve().parents[2]

def main():
 ap=argparse.ArgumentParser();ap.add_argument('episodio',type=Path);args=ap.parse_args();D=args.episodio.resolve();out=D/'work/results/comp';out.mkdir(parents=True,exist_ok=True)
 spec=importlib.util.spec_from_file_location('smoke',A/'test/smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 class Q(m.Handler):
  def log_message(self,*args):pass
 srv=socketserver.ThreadingTCPServer(('127.0.0.1',0),functools.partial(Q,directory='/tmp/tpl'));threading.Thread(target=srv.serve_forever,daemon=True).start()
 from playwright.sync_api import sync_playwright
 report=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   page=browser.new_page();page.goto(f'http://127.0.0.1:{srv.server_address[1]}/')
   images=page.evaluate('''async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=360;c.height=160;const g=c.getContext('2d');g.drawImage(im,0,0);return {png:c.toDataURL('image/png').split(',')[1],jpg:c.toDataURL('image/jpeg',.9).split(',')[1]};}''',f'/sandbox/nodepolitics/{D.name}/assets/media/noticiero-logo-test.svg')
   for ext,data in images.items():(D/f'assets/media/noticiero-logo-test.{ext}').write_bytes(base64.b64decode(data))
   page.close()
   icons=['tank','missile','fighter-jet','warship','soldier','cpu','satellite','hospital','handshake','barrel']
   chips=[{'type':'chip','icon':name,'label':name,'size':64,'labelSize':19,'x':.12+(i%5)*.19,'y':.32+(i//5)*.28,'color':'blue','t':.2} for i,name in enumerate(icons)]
   flags=[{'type':'flag-chip','code':code,'label':name,'shape':'rect' if i<3 else 'round','size':170,'x':.2+(i%3)*.3,'y':.32+(i//3)*.3,'t':.2} for i,(code,name) in enumerate([('PY','Paraguay'),('ar','Argentina'),('UA','Ucrania'),('US','EE. UU.'),('FR','Francia'),('JP','Japón')])]
   logos=[{'type':'logo-chip','src':f'media/noticiero-logo-test.{ext}','label':label,'size':150,'shape':shape,'plate':plate,'x':.2+(i%3)*.3,'y':.3+(i//3)*.3,'color':'blue','t':.2} for i,(ext,label,shape,plate) in enumerate([('svg','SVG','rect',True),('png','PNG','round',True),('jpg','JPG','rect',False),('svg','Color','round','yellow')])]
   logos += [{'type':'logo-chip','label':'Nexa Brief','x':.5,'y':.6,'size':150,'t':.2},{'type':'logo-chip','src':'media/no-existe.png','label':'Nexa Brief','x':.8,'y':.6,'size':150,'t':.2}]
   cases=[('noticiero.chip','chip-diez',{'hud':chips}),('noticiero.flag-chip','flag-chip-seis',{'hud':flags}),('noticiero.logo-chip','logo-chip-reservas',{'hud':logos}),('noticiero.flag-fill','flag-fill-paraguay',{'camera':[{'t':0,'focus':[-58,-23],'span':25,'pitch':45}],'layers':[{'type':'flag-fill','region':'PY','src':'../../../nodehistory/_atlas/assets/flags/py.svg','fit':'landmass','opacity':.94,'t':0,'out':6}]})]
   for orient,w,h in [('9x16',576,1024),('16x9',1280,720)]:
    for name,suffix,demo in cases:
     subprocess.run(['rsync','-a',str(D)+'/',f'/tmp/tpl/sandbox/nodepolitics/{D.name}/'],check=True)
     page=browser.new_page(viewport={'width':w,'height':h});errors=[];warnings=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:warnings.append(m.text) if m.type in ('warning','error') else None)
     data=json.loads((D/'components.json').read_text())
     for c in data['components']:
      if c['name']==name:c['target']='scene';c['demo']=demo
     page.route('**/components.json',lambda route:route.fulfill(json=data))
     page.goto(f'http://127.0.0.1:{srv.server_address[1]}/sandbox/nodepolitics/{D.name}/showcase.html?only={name}',wait_until='domcontentloaded');page.wait_for_function('window.__atlasPreview',timeout=120000)
     file=out/f'noticiero.{suffix}-{orient}.png';page.screenshot(path=str(file),timeout=180000)
     entry={'name':suffix,'format':orient,'errors':errors,'warnings':warnings,'missing':page.evaluate('__promo.missingTiles()'),'fps':page.evaluate('__atlas.fps()'),'file':str(file)}
     report.append(entry);print(suffix,orient,'errors',errors,'missing',entry['missing'],flush=True);page.close();(out/'qa-identidad-casos.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   browser.close()
 finally:srv.shutdown();srv.server_close()
if __name__=='__main__':main()
