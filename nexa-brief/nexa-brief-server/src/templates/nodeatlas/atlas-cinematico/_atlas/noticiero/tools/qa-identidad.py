#!/usr/bin/env python3
"""QA real del Showcase Original, sin video. Usa servidor temporal con Range."""
import argparse, base64, functools, importlib.util, json, os, socketserver, subprocess, threading, time
from pathlib import Path
A=Path(__file__).resolve().parents[2]

def memory():
 mem={k:int(v.split()[0]) for k,v in (line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines()) if k in ('MemAvailable','SwapFree','SwapTotal')}
 mem['swap_io_pages']={k:int(v) for k,v in (l.split() for l in Path('/proc/vmstat').read_text().splitlines()) if k in ('pswpin','pswpout')}
 return mem

def descendants():
 procs={}
 for p in Path('/proc').glob('[0-9]*/stat'):
  try:
   data=p.read_text().rsplit(')',1)[1].split();procs[int(p.parent.name)]={'ppid':int(data[1]),'ticks':int(data[11])+int(data[12]),'rss_kib':int(data[21])*os.sysconf('SC_PAGE_SIZE')//1024}
  except (OSError,IndexError,ValueError):pass
 ids={os.getpid()}
 while True:
  more={pid for pid,v in procs.items() if v['ppid'] in ids}; new=ids|more
  if new==ids:break
  ids=new
 return {pid:procs[pid] for pid in ids if pid in procs}

def sample(seconds=1):
 before=descendants();t=time.monotonic();time.sleep(seconds);after=descendants();dt=time.monotonic()-t
 return {'rss_tree_mib':round(sum(p['rss_kib'] for p in after.values())/1024,1),'cpu_tree_percent':round(sum(max(0,p['ticks']-before.get(pid,p)['ticks']) for pid,p in after.items())/os.sysconf('SC_CLK_TCK')/dt*100,1),'processes':len(after),'memory':memory()}

TEXT_SPY="""(() => { const old=CanvasRenderingContext2D.prototype.fillText; window.__labels=[]; CanvasRenderingContext2D.prototype.fillText=function(s,x,y,...args){const m=this.measureText(s),tr=this.getTransform(); let left=x;if(this.textAlign==='center')left-=m.width/2;else if(this.textAlign==='right')left-=m.width;const fs=parseFloat(this.font.match(/([\\d.]+)px/)?.[1]||'0'); const p=new DOMPoint(left,y-fs/2).matrixTransform(tr),q=new DOMPoint(left+m.width,y+fs/2).matrixTransform(tr);window.__labels.push({s:String(s),x:p.x,y:p.y,w:q.x-p.x,h:q.y-p.y});return old.call(this,s,x,y,...args);};})();"""

def main():
 ap=argparse.ArgumentParser();ap.add_argument('episodio',type=Path);ap.add_argument('--only',default='');ap.add_argument('--format',choices=('9x16','16x9'));ap.add_argument('--skip',type=int,default=0);ap.add_argument('--limit',type=int,default=0);ap.add_argument('--report',default='qa-identidad.json');args=ap.parse_args();D=args.episodio.resolve();out=D/'work/results/comp';out.mkdir(parents=True,exist_ok=True)
 spec=importlib.util.spec_from_file_location('smoke',A/'test/smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 class Q(m.Handler):
  def log_message(self,*args):pass
 srv=socketserver.ThreadingTCPServer(('127.0.0.1',0),functools.partial(Q,directory='/tmp/tpl'));threading.Thread(target=srv.serve_forever,daemon=True).start()
 src=json.loads((A/'noticiero/componentes.json').read_text())['components']; names=[c['name'] for c in src if c['demo']['type'] in ('icon-grid','flag-chip','logo-chip','flag-fill')]
 if args.only:names=[n for n in names if any(part in n for part in args.only.split(','))]
 names=names[args.skip:]
 if args.limit:names=names[:args.limit]
 report={'before':sample(),'captures':[]}
 from playwright.sync_api import sync_playwright
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for orientation,w,h in [('9x16',576,1024),('16x9',1280,720)]:
    if args.format and args.format!=orientation:continue
    for name in names:
     subprocess.run(['rsync','-a',str(D)+'/', '/tmp/tpl/sandbox/nodepolitics/'+D.name+'/'],check=True)
     page=browser.new_page(viewport={'width':w,'height':h});page.add_init_script(TEXT_SPY);errors=[];warnings=[]
     page.on('pageerror',lambda e: errors.append(str(e)));page.on('console',lambda m:warnings.append(m.text) if m.type in ('error','warning') else None)
     start=time.monotonic();url=f'http://127.0.0.1:{srv.server_address[1]}/sandbox/nodepolitics/{D.name}/showcase.html?only={name}'
     page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.__atlasPreview',timeout=120000)
     if len(report['captures'])==0:report['idle']=sample(2)
     page.evaluate('window.__labels=[]');page.evaluate('__promo.seek(2.6)')
     labels=page.evaluate('window.__labels');issues=[]
     for l in labels:
      if min(l['x'],l['y'])<0 or l['x']+l['w']>w or l['y']+l['h']>h:issues.append({'bounds':l})
     if 'icon-grid' in name:
      for i,a in enumerate(labels):
       for b in labels[i+1:]:
        if min(a['x']+a['w'],b['x']+b['w'])>max(a['x'],b['x'])+1 and min(a['y']+a['h'],b['y']+b['h'])>max(a['y'],b['y'])+1:issues.append({'overlap':[a,b]})
     file=out/f'{name}-{orientation}.png'
     # El canvas final ya contiene mapa y HUD. Evita recomponer el WebGL oculto.
     encoded=page.evaluate('document.querySelector("#stage > canvas").toDataURL("image/png").split(",")[1]')
     file.write_bytes(base64.b64decode(encoded))
     # La miniatura estática usa el mismo cuadro validado, sin motor vivo por tarjeta.
     from PIL import Image
     Image.open(file).convert('RGB').save(out/f'{name}-{orientation}.webp',quality=85)
     entry={'name':name,'format':orientation,'errors':errors,'warnings':warnings,'layout_issues':issues,'missing':page.evaluate('__promo.missingTiles()'),'fps':page.evaluate('__atlas.fps()'),'seconds':round(time.monotonic()-start,2),'labels':labels,'file':str(file),'capture':'canvas final del Showcase'}
     report['captures'].append(entry)
     print(name,orientation,'issues',len(issues),'errors',errors,'missing',entry['missing'],'seconds',entry['seconds'],flush=True)
     report['during']=sample(.3);entry['resources']=report['during'];page.close()
     (out/args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2))
    report['after_views_'+orientation]=sample(2)
   browser.close()
  report['after_browser']=sample(2)
 finally:
  srv.shutdown();srv.server_close();(out/args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('FIN',len(report['captures']),'capturas',flush=True)
if __name__=='__main__':main()
