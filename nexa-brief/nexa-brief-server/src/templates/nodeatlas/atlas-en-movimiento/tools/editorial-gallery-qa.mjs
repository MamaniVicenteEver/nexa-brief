// Integración con el Atlas real; una página, sin video, sin red externa.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '/home/alfred/.local/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
const project=fileURLToPath(new URL('..',import.meta.url)),templates=path.resolve(project,'../../..');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
 try{const file=path.resolve(templates,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(templates+path.sep)){res.writeHead(403);return res.end();}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={errors:[],httpErrors:[],external:[],frames:[],seek:[]};let browser;
try{
 browser=await chromium.launch({executablePath:'/home/alfred/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--num-raster-threads=1','--disable-dev-shm-usage','--js-flags=--expose-gc']});
 const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
 page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({status:r.status(),url:r.url()});});
 await page.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();report.external.push(route.request().url());return route.abort();});
 await page.goto(`http://127.0.0.1:${server.address().port}/sandbox/nodehistory/atlas-en-movimiento/work/tactico/demo.new.html?headless=1&items=scene-editorial.json`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction('window.__promo && window.__tacticoContext',null,{timeout:180000});await page.evaluate('__atlas.ready');
 const hash=async t=>page.evaluate(async t=>{await __promo.seek(t);const c=document.querySelector('#stage canvas'),g=c.getContext('2d');const bytes=g.getImageData(0,0,c.width,c.height).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');},t);
 for(const t of [4.5,52.5,60.5,76.5,84.5,92.5,100.5]){report.frames.push({t,hash:await hash(t)});await page.evaluate('globalThis.gc?.()');console.log('Atlas',t);}
 for(const frame of [...report.frames].reverse()){report.seek.push({t:frame.t,identical:(await hash(frame.t))===frame.hash});await page.evaluate('globalThis.gc?.()');}
 await page.evaluate('__promo.seek(84.5)');await page.locator('#stage canvas').screenshot({path:path.join(project,'work/tactico/shots/editorial/atlas-gallery.png')});
 report.items=await page.evaluate('__tacticoContext.scene.items.map(i=>i.type)');
 report.missingAssets=await page.evaluate('__tactico.missing()');report.missingTiles=await page.evaluate('__atlas.missingTiles()');
 report.ok=report.items.length===13&&report.seek.every(x=>x.identical)&&!report.errors.length&&!report.httpErrors.length&&!report.external.length&&!report.missingAssets.length&&!report.missingTiles.length;
 await writeFile(path.join(project,'work/tactico/editorial-gallery-qa.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
