// Run with nice -n 15; one Chromium and one page for the whole catalog and contact sheet.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(resolve('../../../../../../nexa-brief-web/package.json'));
const {chromium}=require('@playwright/test');
const base=process.env.ATLAS_PREVIEW_BASE||'http://127.0.0.1:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/';
const root=resolve('.'),out=resolve('work/tactico/thumbs');await mkdir(out,{recursive:true});
const {animations}=JSON.parse(await readFile('engine/tactico/animations/index.json','utf8'));
const requested=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
const selected=requested?animations.filter(a=>requested.includes(a.name)):animations;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--num-raster-threads=1','--disable-dev-shm-usage']});
let previous={errors:[],tiles:[],posters:[]};if(requested){try{previous=JSON.parse(await readFile(`${out}/animaciones-audit.json`,'utf8'));}catch{}}
const audit={errors:[],tiles:[],posters:previous.posters.filter(p=>!selected.some(a=>a.name===p.name))};
try{
  const page=await browser.newPage({viewport:{width:480,height:480},deviceScaleFactor:1});
  page.on('pageerror',e=>audit.errors.push(e.message));page.on('request',r=>{if(/\/tiles\//.test(r.url()))audit.tiles.push(r.url());});
  for(const a of selected){
    try{
      await page.goto(`${base}work/tactico/demo.html?only=${encodeURIComponent(a.name)}&bg=${a.preview.bg}&bare=1`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__animationReady,null,{timeout:60000});
      const info=await page.evaluate(async()=>{const info=window.__animationPreview;await __promo.seek(info.peakTime);return info;});
      await page.screenshot({path:`${out}/${a.name}.jpg`,type:'jpeg',quality:88});
      audit.posters.push(info);console.log(a.name,info.peakTime.toFixed(2),info.peak,info.missing.length);
    }catch(e){audit.errors.push(`${a.name}: ${e.message}`);console.log('FAIL',a.name,e.message);}
  }
  const thumbs=Object.fromEntries(animations.map(a=>[a.name,`${a.name}.jpg`]));await writeFile(`${out}/thumbs.json`,JSON.stringify(thumbs,null,2)+'\n');
  await page.goto('about:blank');await page.setViewportSize({width:1600,height:Math.ceil(animations.length/8)*190});
  const images=await Promise.all(animations.map(async a=>(await readFile(`${out}/${a.name}.jpg`)).toString('base64')));
  await page.setContent(`<style>body{margin:0;background:#c6cbd0;font:12px sans-serif}.grid{display:grid;grid-template-columns:repeat(8,200px)}figure{margin:0;height:190px;display:grid;grid-template-rows:164px 26px;text-align:center}img{width:194px;height:164px;object-fit:contain}figcaption{padding:4px}</style><div class="grid">${animations.map((a,i)=>`<figure><img src="data:image/jpeg;base64,${images[i]}"><figcaption>${a.name}</figcaption></figure>`).join('')}</div>`);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await page.screenshot({path:`${out}/hoja.jpg`,type:'jpeg',quality:90,fullPage:true});
  const dimensions=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({width:i.naturalWidth,height:i.naturalHeight})));
  const coverage=await Promise.all(animations.map(async(a,i)=>({name:a.name,file:`${a.name}.jpg`,bg:a.preview.bg,...dimensions[i],bytes:(await readFile(`${out}/${a.name}.jpg`)).length})));
  if(coverage.some(p=>p.width!==480||p.height!==480||p.bytes<500))throw Error('Póster vacío o con dimensiones incorrectas');
  await writeFile(`${out}/coverage.json`,JSON.stringify({version:2,count:coverage.length,ok:true,posters:coverage},null,2)+'\n');
  await writeFile(`${out}/provenance.json`,JSON.stringify({version:2,generator:'work/tactico/tools/animation-posters.mjs',source:'work/tactico/demo.html',background:'preview.bg de animations/index.json; sin mapa ni teselas',posters:audit.posters},null,2)+'\n');
}finally{await writeFile(`${out}/animaciones-audit.json`,JSON.stringify(audit,null,2)+'\n');await browser.close();}
if(audit.errors.length||audit.tiles.length)process.exitCode=1;
