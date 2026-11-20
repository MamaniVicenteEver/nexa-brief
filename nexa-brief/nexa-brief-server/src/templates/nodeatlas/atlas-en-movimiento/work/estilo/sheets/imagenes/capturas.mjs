import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('../../../../../../nexa-brief-web/package.json')),{chromium}=require('@playwright/test');
const names=['portrait.badge','portrait.cutout','editorial.press','callout.photo','inventory.units','portrait.card','portrait.column','portrait.pair','document.clip','document.stamp','image.frame','image.strip'];
const base='http://127.0.0.1:18765/sandbox/nodehistory/atlas-en-movimiento/';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--num-raster-threads=1','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:480,height:480}});page.on('pageerror',e=>console.error('PAGE',e.message));
for(const fmt of ['movil','escritorio'])for(const name of names){try{await page.goto(`${base}preview/tactico/demo.html?only=${name}&bg=white&bare=1&formato=${fmt}&estilo=v4-atlas`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__animationReady,null,{timeout:45000});await page.screenshot({path:`work/estilo/sheets/imagenes/${name}-${fmt}.png`});console.log('OK',fmt,name);}catch(e){console.error('ERROR',fmt,name,e.message);}}
await browser.close();
