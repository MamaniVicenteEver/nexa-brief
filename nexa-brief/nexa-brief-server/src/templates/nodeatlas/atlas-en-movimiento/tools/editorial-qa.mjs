// Un solo Chromium/página, servidor temporal propio y ninguna grabación de video.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '/home/alfred/.local/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import sharp from '/home/alfred/.local/lib/node_modules/cf/node_modules/sharp/dist/index.mjs';
sharp.concurrency(1);
const project=fileURLToPath(new URL('..',import.meta.url)),templates=path.resolve(project,'../../..');
const output=path.join(project,'work/tactico');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
 try{const file=path.resolve(templates,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(templates+path.sep)){res.writeHead(403);return res.end();}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const errors=[],requests=[],report={viewport:{width:1080,height:1920},renderer:'Chromium ANGLE SwiftShader',samples:60,instances:20,errors,shots:[],determinism:[],performance:[]};
// Reutiliza las capturas terminadas antes de la interrupción. Conserva cada avance.
const resume=process.argv.includes('--resume');
const onlyIndex=process.argv.indexOf('--only'),only=onlyIndex<0?null:process.argv[onlyIndex+1];
if(resume||only){const previous=JSON.parse(await readFile(path.join(output,'editorial-qa.json'),'utf8'));report.shots=previous.shots;if(only){report.determinism=previous.determinism.filter(s=>s.component!==only);report.performance=previous.performance.filter(s=>s.component!==only);report.shots=report.shots.filter(s=>s.component!==only);}}
const checkpoint=()=>writeFile(path.join(output,'editorial-qa.json'),JSON.stringify(report,null,2)+'\n');
let browser;
try{
 browser=await chromium.launch({executablePath:'/home/alfred/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--num-raster-threads=1','--disable-dev-shm-usage','--js-flags=--expose-gc']});
 const page=await browser.newPage({viewport:report.viewport,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/sandbox/nodehistory/atlas-en-movimiento/work/tactico/editorial.new.html?shot=1&items=scene-editorial.json`);
 await page.waitForFunction('window.__editorial?.ready || window.__editorialError',{},{timeout:120000});
 if(await page.evaluate('window.__editorialError'))throw Error(await page.evaluate('window.__editorialError'));
 report.missing=await page.evaluate('__editorial.missing()');const items=(await page.evaluate('__editorial.scene.items')).filter(item=>!only||item.type===only);const requestsAtReady=requests.length;
 const times=[['entrada',.15],['pleno',4.5],['salida',7.8]],cells={sites:[],economy:[],editorial:[]};
 async function pixels(t){return page.evaluate(async t=>{__editorial.draw(t);const d=__editorial.canvas.getContext('2d').getImageData(0,0,1080,1920).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',d))].map(v=>v.toString(16).padStart(2,'0')).join('');},t);}
 for(const item of items){
  const family=item.type.startsWith('site.')?'sites':item.type.startsWith('money.')?'economy':'editorial';await mkdir(path.join(output,'shots',family),{recursive:true});
  if(resume&&!only){for(const shot of report.shots.filter(s=>s.component===item.type)){await stat(path.join(output,shot.file));cells[family].push({file:shot.file,label:item.type+' · '+shot.file.split('-').at(-1).replace('.png','')});}continue;}
   for(const [name,lt] of times){const t=item.t+lt,hash=await pixels(t),file=`shots/${family}/${item.type.replace('.','-')}-${name}.png`;await page.locator('canvas').screenshot({path:path.join(output,file)});await page.evaluate('globalThis.gc?.()');report.shots.push({component:item.type,t,file,hash});cells[family].push({file,label:item.type+' · '+name});}
  console.log('capturas',item.type);
 }
 await writeFile(path.join(output,'editorial-qa.json'),JSON.stringify(report,null,2)+'\n');
 for(const shot of [...report.shots].reverse().filter(s=>!only||s.component===only)){const hash=await pixels(shot.t);await page.evaluate('globalThis.gc?.()');report.determinism.push({component:shot.component,t:shot.t,identical:hash===shot.hash});await checkpoint();}
 console.log('determinismo',report.determinism.every(x=>x.identical));
 for(const item of items){
  const perf=await page.evaluate(async item=>{
   const {create}=await import('../../../_tactico/core.js'),{c,scene,view}=__editorial;
   const clone=structuredClone(item);clone.t=0;clone.out=20;clone.dur=20;clone.fade=0;
   if(clone.states)clone.states=clone.states.map(k=>({...k,at:k.at-item.t}));
   const count=20,instances=Array.from({length:count},(_,i)=>({...structuredClone(clone),id:'stress-'+i}));
   const runtime=await create(c,{...scene,duration:20,items:instances});const canvas=new OffscreenCanvas(1080,1920),g=canvas.getContext('2d',{willReadFrequently:true});
   const read=()=>g.getImageData(0,0,1080,1920).data[0];
   const values=[],draw=[],baseline=[];for(let i=0;i<66;i++){const start=performance.now();g.clearRect(0,0,1080,1920);read();if(i>=6)baseline.push(performance.now()-start);}
   for(let i=0;i<66;i++){g.clearRect(0,0,1080,1920);const start=performance.now();runtime.draw(g,view,4.5+i/120);const end=performance.now();read();if(i>=6){values.push(performance.now()-start);draw.push(end-start);}if(i%8===7)globalThis.gc?.();}
   const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,p95=a=>a.toSorted((a,b)=>a-b)[Math.ceil(a.length*.95)-1];
   return {component:item.type,instances:count,scale:clone.scale??1,mode:'20 instancias a escala predeterminada, superpuestas para estrés de composición',drawMeanMs:mean(draw),drawP95Ms:p95(draw),forcedReadbackMeanMs:mean(values),forcedReadbackP95Ms:p95(values),emptyClearReadbackMeanMs:mean(baseline),incrementalMeanMs:Math.max(0,mean(values)-mean(baseline)),samples:values.length,missing:runtime.missing()};
  },item);
  report.performance.push(perf);await checkpoint();await page.evaluate('globalThis.gc?.()');console.log('rendimiento',item.type,perf.incrementalMeanMs.toFixed(3),'ms; draw',perf.drawMeanMs.toFixed(3));
 }
 report.requestsAfterPreparation=requests.length-requestsAtReady;
 await page.setViewportSize({width:1920,height:1080});await page.reload();await page.waitForFunction('window.__editorial?.ready || window.__editorialError',{},{timeout:120000});
 await page.evaluate('__editorial.draw(84.5)');await page.locator('canvas').screenshot({path:path.join(output,'shots/editorial/landscape.png')});report.landscape={width:1920,height:1080,error:await page.evaluate('window.__editorialError??null')};
 await browser.close();browser=null;
 await mkdir(path.join(output,'sheets'),{recursive:true});
 const xml=s=>s.replace(/[&<>]/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[v]));
 for(const [family,shots] of Object.entries(cells)){
  if(only){shots.length=0;for(const shot of report.shots){const f=shot.component.startsWith('site.')?'sites':shot.component.startsWith('money.')?'economy':'editorial';if(f===family)shots.push({file:shot.file,label:shot.component+' · '+shot.file.split('-').at(-1).replace('.png','')});}shots.sort((a,b)=>report.shots.find(s=>s.file===a.file).t-report.shots.find(s=>s.file===b.file).t);}
  const width=900,cellW=300,cellH=563,rows=shots.length/3;const layers=[];
  for(let i=0;i<shots.length;i++){
   const x=(i%3)*cellW,y=Math.floor(i/3)*cellH;
   layers.push({input:await sharp(path.join(output,shots[i].file)).resize(300,533).png().toBuffer(),left:x,top:y+30});
   layers.push({input:Buffer.from(`<svg width="300" height="30"><rect width="300" height="30" fill="#081e2c"/><text x="9" y="21" font-family="sans-serif" font-size="15" fill="#e9e3ba">${xml(shots[i].label)}</text></svg>`),left:x,top:y});
  }
  await sharp({create:{width,height:rows*cellH,channels:3,background:'#081e2c'}}).composite(layers).jpeg({quality:90}).toFile(path.join(output,'sheets',family+'.jpg'));
 }
 await writeFile(path.join(output,'editorial-qa.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({errors,missing:report.missing,determinism:report.determinism.every(x=>x.identical),requestsAfterPreparation:report.requestsAfterPreparation}));
 if(errors.length||report.missing.tiles.length||report.missing.assets.length||report.determinism.some(x=>!x.identical)||report.requestsAfterPreparation)process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
