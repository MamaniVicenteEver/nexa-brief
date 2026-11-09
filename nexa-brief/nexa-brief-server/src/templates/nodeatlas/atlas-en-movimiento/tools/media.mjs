#!/usr/bin/env node
// Descarga secuencial, licencia contrastada y derivados locales. Sin dependencias nuevas.
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const media=path.join(root,'assets/media');
const candidates=JSON.parse(await readFile(path.join(root,'tools/media-candidates.json'),'utf8'));
const headers={'User-Agent':'AtlasEnMovimiento/1.0 (educational documentary; media provenance verification)'};
const plain=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
// Fechas curatoriales: extmetadata puede incluir sintaxis Wikidata o descripciones erróneas.
const dates={P01:'1981-05-06',P02:'Antes de 1987; publicación iraquí de 1987',P03:'1981-02-07',P04:'Década de 1980; posterior al 10 de agosto de 1981, sin día preciso',A01:'1987-05-17 según la ficha; daños tras el ataque, día de la toma no contrastado independientemente',A02:'1987-08-22',A03:'1987-08-22',A04:'1987-09-22',A05:'1987-09-22',A06:'1988-04-18',A07:'1988-04-18',A08:'1988-04-18',A09:'1987-07-20',A10:'1988-08-09; declaración del 8 de agosto; vigencia del alto el fuego: 20 de agosto de 1988, 03:00 GMT'};
async function fetchFile(url,{width=960}={}){
 const clean=new URL(url);if(clean.hostname==='upload.wikimedia.org')clean.search='';
 let r;for(let attempt=0;attempt<3;attempt++){
  r=await fetch(clean,{headers,signal:AbortSignal.timeout(45000)});
  if(r.status!==429&&r.status<500)break;
  await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
 }
 if(r.status===429&&clean.hostname==='upload.wikimedia.org'){
  // curl respeta el proxy de red del entorno, a diferencia de fetch de Node.
  const curl=target=>new Promise((resolve,reject)=>{const p=spawn('curl',['--fail','--silent','--show-error','--location','--max-time','45',target],{stdio:['ignore','pipe','pipe']});const chunks=[];let err='';p.stdout.on('data',b=>chunks.push(b));p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(Error(err)):resolve(Buffer.concat(chunks)));});
  let bytes,downloadUrl=clean.href,downloadKind='original';
  try{bytes=await curl(downloadUrl);}catch{
   const filename=clean.pathname.split('/').at(-1);downloadUrl=clean.href.replace('/commons/','/commons/thumb/')+`/${width}px-${filename}`;
   bytes=await curl(downloadUrl);downloadKind='Commons thumbnail';
  }
  return {bytes,downloadUrl,downloadKind,type:/\.(jpe?g)(?:$|\?)/i.test(clean.pathname)?'image/jpeg':'image/png'};
 }
 if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);
 return {bytes:Buffer.from(await r.arrayBuffer()),downloadUrl:clean.href,downloadKind:'original',type:r.headers.get('content-type')??''};
}
function run(cmd,args){return new Promise((resolve,reject)=>{
 const p=spawn(cmd,args,{cwd:root,stdio:['ignore','ignore','pipe']});let err='';
 p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',c=>c?reject(Error(err.slice(-1800))):resolve());
});}
let sharp=null;for(const spec of ['sharp','/home/alfred/.local/lib/node_modules/cf/node_modules/sharp/dist/index.mjs'])try{const candidate=(await import(spec)).default;if(typeof candidate==='function'){sharp=candidate;break;}}catch{}
if(sharp)sharp.concurrency(1);
async function encode(src,dest,portrait){
 if(sharp){await sharp(src).rotate().resize({width:portrait?960:1600,height:portrait?1280:1600,fit:'inside',withoutEnlargement:true}).png().toFile(dest);}
 else await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','1','-i',src,'-vf',`scale=w='min(iw,${portrait?960:1600})':h='min(ih,${portrait?1280:1600})':force_original_aspect_ratio=decrease`,'-frames:v','1','-threads','1',dest]);
 if(portrait){
  // Máscara suave de borde y pie; conserva la foto, no simula segmentación del cabello.
  const cut=dest.replace('.png','-soft.png');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','1','-i',dest,'-vf',"format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*min(1,min(X,W-1-X)/12)*min(1,min(Y/8,(H-1-Y)/80))'",'-frames:v','1','-threads','1',cut]);
  return path.relative(root,cut);
 }
 return null;
}
await mkdir(media,{recursive:true});await mkdir(path.join(media,'provenance'),{recursive:true});
let previous=[];try{previous=JSON.parse(await readFile(path.join(media,'credits.json'),'utf8')).assets??[];}catch{}
const assets=[];
for(const c of candidates){
 if(!c.selected){assets.push({...c,status:'unused'});continue;}
 const old=previous.find(x=>x.id===c.id&&x.status==='ready');
 if(old&&!process.argv.includes('--refresh')){
  try{for(const f of [old.file,old.original,old.softMask].filter(Boolean))await stat(path.join(root,f));assets.push({...old,metadataAuthor:old.metadataAuthor??old.author,metadataDate:old.metadataDate??old.date,author:c.author,date:dates[c.id]??old.date});console.log(c.id,'cached');continue;}catch{}
 }
 try{
  let url=c.url,license='Public domain',licenseUrl='',author=c.author,metadata=null,sourceDate=c.dateAndLimits,width=960,sourceSHA1=null;
  if(c.title){
   const api=new URL('https://commons.wikimedia.org/w/api.php');
   api.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata|sha1|size',titles:c.title,redirects:'1'});
   let data;try{if(process.argv.includes('--refresh'))throw Error('Actualizar metadatos');data=JSON.parse(await readFile(path.join(media,'provenance',c.id+'.json'),'utf8'));}catch{data=JSON.parse((await fetchFile(api)).bytes);}
   await writeFile(path.join(media,'provenance',c.id+'.json'),JSON.stringify(data,null,2)+'\n');
   const page=Object.values(data.query?.pages??{})[0];const info=page?.imageinfo?.[0];
   if(!info)throw Error('Commons no devuelve imageinfo');
   metadata=info.extmetadata;license=plain(metadata.LicenseShortName?.value);licenseUrl=plain(metadata.LicenseUrl?.value);
   if(!/^(Public domain|CC0(?: 1\.0)?|CC BY(?:-SA)? [234]\.0)$/i.test(license))throw Error('Licencia fuera de la lista: '+license);
   const expected=c.licenseEvidence.includes('CC BY-SA')?'CC BY-SA':c.licenseEvidence.includes('CC BY')?'CC BY':c.licenseEvidence.includes('CC0')?'CC0':'Public domain';
   if(!license.startsWith(expected))throw Error(`Licencia no coincide: ${license}, esperada ${expected}`);
   url=info.url;width=(info.width??960)<960?250:960;sourceSHA1=info.sha1;sourceDate=plain(metadata.DateTimeOriginal?.value)||sourceDate;
   // P02: el uploader no es el fotógrafo; se conserva la autoría investigada.
   author=c.author;
  }
  const pdf=!c.title;const original=path.join(media,`${c.id}-original.${pdf?'pdf':path.extname(new URL(url).pathname).slice(1)||'jpg'}`);
  let transfer;try{
   if(process.argv.includes('--refresh'))throw Error('Actualizar descarga');
   const bytes=await readFile(original);const isOriginal=!sourceSHA1||createHash('sha1').update(bytes).digest('hex')===sourceSHA1;const clean=new URL(url);clean.search='';
   transfer={bytes,type:pdf?'application/pdf':'image/jpeg',downloadKind:isOriginal?'original':'Commons thumbnail',downloadUrl:isOriginal?clean.href:clean.href.replace('/commons/','/commons/thumb/')+`/${width}px-${clean.pathname.split('/').at(-1)}`};
  }catch{transfer=await fetchFile(url,{width});}
  const {bytes,type,downloadUrl,downloadKind}=transfer;
  if(pdf&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('La ONU no devolvió un PDF, se omite');
  if(!pdf&&!type.startsWith('image/'))throw Error('No es una imagen: '+type);
  await writeFile(original,bytes);const dest=path.join(media,c.id+'.png');let softMask=null;
  if(pdf){
   // PDFium ya está instalado en la caché de herramientas; no se instala nada.
   const pdf=await import('/home/alfred/.local/lib/node_modules/openclaw/node_modules/clawpdf/dist/index.js');
   const doc=await pdf.openPdf(new Uint8Array(bytes));
   try{const page=doc.page(1),render=page.render({scale:1.8});await writeFile(dest,await pdf.encodePng(render.rgba,{width:render.width,height:render.height}));await writeFile(path.join(media,'provenance',c.id+'-text.txt'),doc.text());}finally{doc.destroy();}
   await writeFile(path.join(media,'provenance',c.id+'-license.txt'),'Documento oficial ONU con símbolo. Fundamento: ST/AI/189/Add.9/Rev.2 y A/C.5/48/10, https://digitallibrary.un.org/record/175111/files/A_C-5_48_10-EN.pdf\n');
  }else softMask=await encode(original,dest,c.id.startsWith('P'));
  const record={...c,status:'ready',author,metadataAuthor:plain(metadata?.Artist?.value),metadataDate:sourceDate,license,licenseUrl,url:c.url,sourceOriginalUrl:url,downloadUrl,downloadKind,date:dates[c.id]??sourceDate,verifiedAt:new Date().toISOString().slice(0,10),file:path.relative(root,dest),original:path.relative(root,original),softMask,sha256:sha(bytes),derivativeSha256:sha(await readFile(dest)),modifications:(downloadKind==='Commons thumbnail'?'Miniatura Commons como fuente descargada (original HTTP 429); ':'')+(pdf?'Primera página rasterizada; PDF íntegro conservado.':softMask?'Redimensionado proporcional; PNG adicional con máscara suave de bordes y pie, sin IA.':'Redimensionado proporcional; sin recorte ni alteración del contenido.')};
  assets.push(record);console.log(c.id,'ready',license);
 }catch(e){assets.push({...c,status:'omitted',error:e.message});console.log(c.id,'OMITTED',e.message);}
 // Persiste cada ficha por si se interrumpe la red.
 await writeFile(path.join(media,'credits.json'),JSON.stringify({schema:'atlas-media-v1',assets},null,2)+'\n');
}
await writeFile(path.join(media,'credits.json'),JSON.stringify({schema:'atlas-media-v1',assets},null,2)+'\n');
const lines=['# Créditos documentales · Atlas en Movimiento','','Procesado con `node tools/media.mjs`. Solo se incorporan medios PD, CC0, CC BY o CC BY-SA. Las fechas de la fotografía y del hecho narrado se conservan por separado.','','Los PNG `-soft` tienen una máscara suave del marco y del pie: no son una segmentación de persona. Los originales y la evidencia de licencia se conservan en `assets/media/`.',''];
for(const a of assets){lines.push(`## ${a.id} · ${a.status}`,``,a.use,``);
 if(a.status==='ready')lines.push(`- Autor/crédito: ${a.author}`,`- Licencia: ${a.license}${a.licenseUrl?' — '+a.licenseUrl:''}`,`- Fuente: ${a.url}`,`- Fecha: ${a.date}`,`- Límites: ${a.dateAndLimits}`,`- Archivos: ${a.file}${a.softMask?' · '+a.softMask:''} · ${a.original}`,`- Modificaciones: ${a.modifications}`,`- Verificación: ${a.verifiedAt}; evidencia: assets/media/provenance/${a.id}${a.title?'.json':'-license.txt'}`,'');
 else lines.push(a.error??a.reason,'');
}
lines.push('## Tipografía local','','DejaVu Sans Bold. Copyright y licencia completos: `assets/fonts/LICENSE-DejaVu.txt`. Se usa como AtlasEditorial sin modificar el archivo tipográfico.','');
await writeFile(path.join(root,'CREDITS.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({ready:assets.filter(a=>a.status==='ready').length,omitted:assets.filter(a=>a.status==='omitted').length,unused:assets.filter(a=>a.status==='unused').length}));
