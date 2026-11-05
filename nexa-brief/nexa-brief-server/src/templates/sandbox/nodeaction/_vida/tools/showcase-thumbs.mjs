import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {installedChromium} from './browser.mjs';
import {ROOT} from './runtime.mjs';

// Las tarjetas usan imágenes del motor real; los iframes solo se abren al pulsar ▶.
const templates=resolve(ROOT,'../../..');
const output=join(ROOT,'showcase/thumbs');
const {components}=JSON.parse(await readFile(join(ROOT,'showcase/components.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  let path=resolve(templates,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(templates+sep))throw new Error('Ruta fuera de templates');
  if(url.pathname.endsWith('/'))path=join(path,'index.html');
  const data=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream'});
  res.end(data);
 }catch{res.writeHead(404);res.end();}
});
let browser;
await mkdir(output,{recursive:true});
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const {chromium,executablePath}=await installedChromium();
 browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:480,height:480},deviceScaleFactor:1});
 const base=`http://127.0.0.1:${server.address().port}/sandbox/nodeaction/_vida/`;
 const thumbs={},files=new Set();
 for(const item of components){
  const file=item.name.replace(/[^a-z0-9._-]/gi,c=>`-${c.codePointAt(0).toString(16)}-`)+'.jpg';
  if(files.has(file))throw new Error(`Miniatura duplicada: ${file}`);
  files.add(file);
  const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  await page.goto(base+'showcase.html?'+new URLSearchParams({only:item.name,aspect:'16x9',still:'1'}),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>['true','error'].includes(document.documentElement.dataset.ready),{},{timeout:45_000});
  const state=await page.evaluate(()=>({ready:document.documentElement.dataset.ready,error:document.getElementById('status').textContent}));
  if(state.ready!=='true'||errors.length)throw new Error(`${item.name}: ${errors.join('; ')||state.error}`);
  await page.screenshot({path:join(output,file),type:'jpeg',quality:90});
  page.off('pageerror',onError);
  thumbs[item.name]=file;
  if(files.size%25===0)console.log(`Frames: ${files.size}/${components.length}`);
 }
 // Publicar el índice solo después de completar todas las imágenes.
 await writeFile(join(output,'thumbs.json.tmp'),JSON.stringify(thumbs,null,2)+'\n');
 await rename(join(output,'thumbs.json.tmp'),join(output,'thumbs.json'));
 console.log(JSON.stringify({thumbnails:files.size,width:480,height:480,animatedIframesAtRest:0}));
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
