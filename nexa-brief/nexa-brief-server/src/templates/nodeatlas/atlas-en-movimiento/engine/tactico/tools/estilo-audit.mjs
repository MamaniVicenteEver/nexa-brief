// QA de canvas: registra texto visible e imágenes de banderas/fotos durante el dibujo.
// No puede ver banderas vectoriales ni contenidos previamente rasterizados en otros canvas.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(resolve('../../../../../../nexa-brief-web/package.json'))('@playwright/test');
const out='work/estilo/sheets/qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--num-raster-threads=1','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:600,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.__qa=[];
 for(const C of [window.CanvasRenderingContext2D,window.OffscreenCanvasRenderingContext2D]){if(!C)continue;const p=C.prototype,ft=p.fillText,di=p.drawImage,clear=p.clearRect;
  p.clearRect=function(x,y,w,h){if(this.canvas.width>=1000&&this.canvas.height>=1000&&x===0&&y===0&&w>=this.canvas.width&&h>=this.canvas.height)window.__qa=[];return clear.apply(this,arguments)};
  function rect(ctx,x,y,w,h){const m=ctx.getTransform(),pts=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));return [Math.min(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.y))];}
  p.fillText=function(s,x,y,max){if(this.globalAlpha>.3&&String(s).trim()){const m=this.measureText(s),w=Math.min(m.width,max??Infinity),h=(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)||parseFloat(this.font)||12;let dx=this.textAlign==='center'?-w/2:['right','end'].includes(this.textAlign)?-w:0;let dy=this.textBaseline==='top'?0:this.textBaseline==='middle'?-h/2:-h;window.__qa.push({kind:'texto',text:String(s).slice(0,60),r:rect(this,x+dx,y+dy,w,h),surface:[this.canvas.width,this.canvas.height]});}return ft.apply(this,arguments)};
  p.drawImage=function(img,...a){const src=img.currentSrc||img.src||'';let kind=/\/flags?\//i.test(src)?'bandera':/\/assets\/media\//i.test(src)?'ficha':null;if(kind&&this.globalAlpha>.3){let x,y,w,h;if(a.length===2){[x,y]=a;w=img.width;h=img.height;}else if(a.length===4)[x,y,w,h]=a;else if(a.length===8)[,,,,x,y,w,h]=a;if(Number.isFinite(w))window.__qa.push({kind,text:src.split('/').pop(),r:rect(this,x,y,w,h),surface:[this.canvas.width,this.canvas.height]});}return di.apply(this,[img,...a])};
 }
});
export function overlaps(items){const out=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];if(a.kind!=='texto'&&b.kind!=='texto')continue;if(a.surface.join()!==b.surface.join())continue;if(a.text===b.text&&a.kind===b.kind)continue;const w=Math.min(a.r[2],b.r[2])-Math.max(a.r[0],b.r[0]),h=Math.min(a.r[3],b.r[3])-Math.max(a.r[1],b.r[1]);if(w>4&&h>4)out.push({a:a.kind+':'+a.text,b:b.kind+':'+b.text,area:Math.round(w*h)});}return out;}
const probe=[{kind:'texto',text:'A',r:[0,0,20,20],surface:[100,100]},{kind:'bandera',text:'B',r:[5,5,15,15],surface:[100,100]},{kind:'ficha',text:'C',r:[5,5,15,15],surface:[100,100]}];
if(overlaps(probe).length!==2)throw Error('La prueba interna de intersecciones falló');
const base='http://127.0.0.1:18766/sandbox/nodehistory/atlas-en-movimiento/preview/tactico/demo.html';
const report={limitaciones:['No detecta banderas vectoriales ni elementos rasterizados en otro canvas.','Los rectángulos son aproximaciones y los recortes no se consideran.','La escena se prueba en un instante; las vistas aisladas no prueban coordinación entre componentes.'],runs:[],errors,advertencia:'Cero incidencias no certifica cobertura: verificar cuántos textos, banderas y fichas se registraron en cada ejecución.'};
try{for(const estilo of ['clasico','v4-atlas','v2-mando','v3-cine'])for(const formato of ['movil','escritorio']){
 const url=`${base}?items=qa-scene.json&bg=white&bare=1&formato=${formato}&estilo=${estilo}`;
 try{await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__animationReady,null,{timeout:60000});await page.evaluate(async()=>{await window.__promo.seek(2.9);await window.__promo.seek(3);});const data=await page.evaluate(()=>({items:window.__qa,missing:window.__animationPreview.missing}));const path=`${out}/escena-${estilo}-${formato}.png`;await page.screenshot({path});report.runs.push({tipo:'escena',t:3,estilo,formato,path,items:data.items,incidencias:overlaps(data.items),missing:data.missing});console.log(estilo,formato,'trazos',data.items.length,'solapes',overlaps(data.items).length,'faltantes',data.missing.length);}catch(e){errors.push(`${estilo}/${formato}: ${e.message}`);console.error(errors.at(-1));}
}
 for(const formato of ['movil','escritorio'])for(const name of ['label.unit','army.advance','portrait.card','arrow.route','site.port','fx.impact','caption.transcript']){
  try{await page.goto(`${base}?only=${name}&bg=white&bare=1&formato=${formato}&estilo=v4-atlas`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__animationReady,null,{timeout:60000});await page.evaluate(async()=>{await window.__promo.seek(2.9);await window.__promo.seek(3);});const data=await page.evaluate(()=>({items:window.__qa,missing:window.__animationPreview.missing}));const path=`${out}/preview-${name}-${formato}.png`;await page.screenshot({path});report.runs.push({tipo:'preview',name,t:3,estilo:'v4-atlas',formato,path,items:data.items,incidencias:overlaps(data.items),missing:data.missing});console.log(name,formato,'solapes',overlaps(data.items).length);}catch(e){errors.push(`${name}/${formato}: ${e.message}`);console.error(errors.at(-1));}
 }
}finally{await writeFile(`${out}/audit.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
if(errors.length)process.exitCode=1;
