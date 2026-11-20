import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(resolve('../../../../../../nexa-brief-web/package.json')),{chromium}=require('@playwright/test');
const out=resolve('work/texto/capturas');await mkdir(out,{recursive:true});
const requested=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const report=requested?JSON.parse(await readFile(`${out}/animaciones-audit.json`,'utf8')):{errors:[],httpFailures:[],tiles:[],tabs:[]};
report.ok=false;
if(requested)report.tabs=report.tabs.filter(t=>!requested.includes(t.label.replace(/ \(.*/,''))); 
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--num-raster-threads=1','--disable-dev-shm-usage']});
const hash=v=>createHash('sha256').update(v).digest('hex');
try{
 const page=await browser.newPage({viewport:{width:1440,height:1180},deviceScaleFactor:1});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpFailures.push({url:r.url(),status:r.status()});});
 page.on('request',r=>{if(/\/(tiles|tiles-cache)\//.test(r.url()))report.tiles.push(r.url());});
 await page.goto('http://127.0.0.1:3000/showcase',{waitUntil:'domcontentloaded'});
 if(page.url().includes('/login')){await page.getByRole('button',{name:/Entrar directo/}).click();await page.waitForURL(u=>!u.pathname.includes('/login'));await page.goto('http://127.0.0.1:3000/showcase',{waitUntil:'domcontentloaded'});}
 await page.waitForTimeout(2000);const selector=page.getByRole('combobox',{name:'Diseño',exact:true});await selector.click();await page.getByRole('option',{name:/Atlas en Movimiento|atlas-en-movimiento/}).click();
 await page.getByRole('tab',{name:'Biblioteca (92)',exact:true}).waitFor();
 const tabs=await page.getByRole('tablist',{name:'Contenido del prototipo'}).getByRole('tab').allTextContents();
 for(const label of tabs){
  if(requested&&!requested.includes(label.replace(/ \(.*/,'')))continue;
  console.log('TAB',label);const tab=page.getByRole('tab',{name:label,exact:true});await tab.click();
  await page.getByRole('tablist',{name:'Contenido del prototipo'}).evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-96));
  const panel=page.getByRole('tabpanel');await panel.locator('article').first().waitFor();
  await page.waitForTimeout(500);
  const frames=()=>page.frames().filter(f=>f.url().includes('demo.html'));
  for(let attempt=0;attempt<120;attempt++){
    const fs=frames();if(fs.length&&await Promise.all(fs.map(f=>f.evaluate(()=>!!window.__animationReady).catch(()=>false))).then(r=>r.every(Boolean)))break;
    if(attempt%20===0)console.log('WAIT',label,fs.length,await Promise.all(fs.map(f=>f.evaluate(()=>({ready:!!window.__animationReady,status:document.querySelector('#status')?.textContent,error:document.querySelector('#error')?.textContent})).catch(e=>({error:e.message})))));
    if(attempt===119){await page.screenshot({path:`${out}/animaciones-diagnostico.png`});throw Error(`Animación no lista: ${label}`);}await page.waitForTimeout(500);
  }
  const count=await panel.locator('iframe').count();if(!count||count>6)throw Error(`Presupuesto incorrecto ${label}: ${count}`);
  const bad=await panel.getByText(/Miniatura no disponible|No se pudieron cargar las miniaturas/).count();if(bad||await panel.getByRole('button',{name:/Reproducir/}).count())throw Error(`Control manual o miniatura fallida: ${label}`);
  const states=await Promise.all(frames().map(f=>f.evaluate(()=>({t:Number(document.querySelector('#time').value),preview:window.__animationPreview,ready:window.__animationReady}))));
  const id=label.replace(/ \(.*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll(' ','-');
  const firstShot=await page.screenshot({path:`${out}/animaciones-${id}.png`});
  if(label.startsWith('Efectos')){
    const t0=Date.now();
    await page.waitForTimeout(1500);const betweenCapturesMs=Date.now()-t0;
    const secondShot=await page.screenshot({path:`${out}/animaciones-efectos-1500ms.png`});
    report.motion={requestedIntervalMs:1500,betweenCapturesMs,before:hash(firstShot),after:hash(secondShot),changed:hash(firstShot)!==hash(secondShot)};
    if(!report.motion.changed)throw Error('Efectos inmóviles');
  }
  report.tabs.push({label,active:count,cards:await panel.locator('article').count(),states,capture:`work/texto/capturas/animaciones-${id}.png`});
  // Scroll to exercise removal of offscreen frames and the six-frame budget.
  await panel.locator('article').last().scrollIntoViewIfNeeded();await page.waitForTimeout(500);if(await panel.locator('iframe').count()>6)throw Error('Más de seis animaciones al desplazar');
  await tab.scrollIntoViewIfNeeded();
 }
 await page.getByRole('tab',{name:'Efectos (14)',exact:true}).click();await page.getByRole('heading',{name:'fx.explosion',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'fx.explosion',exact:true});await dialog.waitFor();await page.waitForTimeout(2000);if(await page.locator('iframe').count()!==1)throw Error('Las tarjetas siguen activas detrás del modal');
 report.modal={src:await dialog.locator('iframe').getAttribute('src'),specLoaded:await dialog.getByRole('heading',{name:'JSON de ejemplo'}).count()};
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await page.setViewportSize({width:390,height:844});report.mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));if(report.mobile.scrollWidth>390)throw Error('Desborde horizontal');
 report.ok=!report.errors.length&&!report.httpFailures.length&&!report.tiles.length;
}catch(error){report.errors.push(error.message);throw error;}finally{await writeFile(`${out}/animaciones-audit.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
if(!report.ok)process.exitCode=1;
