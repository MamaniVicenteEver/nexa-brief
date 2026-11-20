import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createHash} from 'node:crypto';
import {installedChromium} from './browser.mjs';
import {ROOT,loadEpisode} from './runtime.mjs';
import {renderFrame} from '../engine/render.js';
import {framingAt} from '../engine/core/framing.js';

// No installation or download: use the Playwright package and browser already on disk.
const templates=resolve(ROOT,'../../..'),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const flags=process.argv.slice(2),outDir=resolve(flags[0]&&!flags[0].startsWith('--')?flags.shift():join(ROOT,'../vida-en-escena/review/vista'));
let requested='both';if(flags.length){if(flags.length!==2||flags[0]!=='--view'||!['both','portrait','landscape'].includes(flags[1]))throw new Error('Uso: browser-check.mjs [outDir] [--view both|landscape|portrait]');requested=flags[1];}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let path=resolve(templates,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(templates+sep))throw Error('403');if(url.pathname.endsWith('/'))path=join(path,'index.html');
 const bytes=await readFile(path),headers={'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':bytes.length,'Accept-Ranges':'bytes'};
 if(req.headers.range){const m=req.headers.range.match(/bytes=(\d+)-(\d*)/),start=Number(m[1]),end=m[2]?Number(m[2]):bytes.length-1;res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${bytes.length}`});res.end(bytes.subarray(start,end+1));}else{res.writeHead(200,headers);res.end(bytes);}
 }catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 const {chromium,executablePath}=await installedChromium();browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;await mkdir(outDir,{recursive:true});
 const open=async(folder,t,extra='')=>{await page.goto(`${origin}/sandbox/nodeaction/${folder}/index.html?ep=assets/episode.json&t=${t}${extra}`);await page.waitForSelector('html[data-ready="true"]');};
 for(const folder of ['vida-en-escena','vida-en-escena-heladeria']){
  const c=await loadEpisode(join(ROOT,'..',folder,'assets/episode.json'));
  const times=folder==='vida-en-escena'?[0,1.4,20.1,30,35.5,36,52.1,54.2,75.7,90.821127,94.8,125]:[0,1,2,4,6,8,12,16,20,22,26,c.duration-.1];
  for(const view of requested==='both'?['landscape','portrait']:[requested]){
   const viewport=view==='landscape'?{width:1000,height:563}:{width:390,height:693};await page.setViewportSize(viewport);
   const canvas=createCanvas(view==='landscape'?1920:1080,view==='landscape'?1080:1920),ctx=canvas.getContext('2d'),parity=[];
   for(const t of times){
    console.error(`Navegador ${folder} ${view} @ ${t}`);
    await open(folder,t,'&view=auto&controls=1');
    const remote=await page.evaluate(async()=>{
     const {framingAt}=await import('../_vida/engine/core/framing.js'),s=__vida.frameState(),canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect();
     return {t:s.t,view:__vida.view,resolution:[canvas.width,canvas.height],rect:[r.width,r.height],viewport:[innerWidth,innerHeight],audio:document.querySelectorAll('audio').length,complete:framingAt(s,s.camera,__vida.compiled.episode.ui?.subtitles!==false&&__vida.compiled.lines.some(l=>l.scene===s.scene.id)),png:canvas.toDataURL('image/png').split(',')[1]};
    });
    assert.equal(remote.view.orientation,view);assert.equal(remote.t,t);assert.equal(remote.audio,1);assert.deepEqual(remote.resolution,[canvas.width,canvas.height]);assert.ok(remote.rect.every((v,i)=>Math.abs(v-remote.viewport[i])<1),`Canvas no llena ${view}`);assert.ok(remote.complete.every(b=>b.ok),`${folder} ${view} @ ${t}: actor cortado`);
    const state=renderFrame(ctx,c,t,{view}),local=Buffer.from(canvas.data());assert.ok(framingAt(state,state.camera,c.episode.ui?.subtitles!==false&&c.lines.some(l=>l.scene===state.scene.id)).every(b=>b.ok));
    const decoded=createCanvas(canvas.width,canvas.height);decoded.getContext('2d').drawImage(await loadImage(Buffer.from(remote.png,'base64')),0,0);const bytes=decoded.data();let sum=0;for(let i=0;i<bytes.length;i++)sum+=Math.abs(bytes[i]-local[i]);const mae=sum/bytes.length;
    parity.push({t,mean_absolute_channel_difference:mae,actores_completos:true});
    if((folder==='vida-en-escena'&&t===30)||(folder!=='vida-en-escena'&&t===4))await writeFile(join(outDir,`${folder==='vida-en-escena'?'vida':'heladeria'}-${view}-browser.png`),Buffer.from(remote.png,'base64'));
   }
   checks.push({episode:c.episode.id,view,viewport,resolution:[canvas.width,canvas.height],instants:times.length,parity,max_mae:Math.max(...parity.map(p=>p.mean_absolute_channel_difference))});
  }
 }
 // Resize the same document while frozen, playing and paused; preserve the single audio element.
 await page.setViewportSize({width:1000,height:563});await open('vida-en-escena',30,'&controls=1');await page.evaluate(()=>window.__originalAudio=document.querySelector('audio'));
 const before=await page.evaluate(()=>__vida.time);await page.setViewportSize({width:390,height:693});await page.waitForFunction(()=>__vida.view.orientation==='portrait');assert.equal(await page.evaluate(()=>__vida.time),before);assert.ok(await page.evaluate(()=>__originalAudio===document.querySelector('audio')));
 await page.evaluate(()=>postMessage({type:'nexa-template-seek',time:30},'*'));await page.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-30)<.02);
 await page.evaluate(()=>postMessage({type:'nexa-template-playback',playing:true},'*'));await page.waitForFunction(()=>document.querySelector('audio').currentTime>30.1);
 await page.setViewportSize({width:1000,height:563});await page.waitForFunction(()=>__vida.view.orientation==='landscape');assert.ok(await page.evaluate(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>30.1));
 await page.evaluate(()=>postMessage({type:'nexa-template-playback',playing:false},'*'));await page.waitForFunction(()=>document.querySelector('audio').paused);const paused=await page.evaluate(()=>__vida.time);await page.setViewportSize({width:390,height:693});await page.waitForFunction(()=>__vida.view.orientation==='portrait');assert.equal(await page.evaluate(()=>__vida.time),paused);
 // Explicit orientation is stable across resize; arbitrary seeks give the same pixels.
 for(const view of ['portrait','landscape']){await open('vida-en-escena',30,`&view=${view}`);assert.equal(await page.evaluate(()=>__vida.view.orientation),view);await page.setViewportSize({width:1000,height:563});assert.equal(await page.evaluate(()=>__vida.view.orientation),view);}
 const hashes=[];for(const t of [30,10,30]){await page.evaluate(t=>__promo.seek(t),t);hashes.push(createHash('sha256').update(await page.evaluate(()=>document.querySelector('canvas').toDataURL())).digest('hex'));}assert.equal(hashes[0],hashes[2]);
 await open('vida-en-escena',30,'&paused=1');await page.evaluate(()=>{document.getElementById('play').hidden=false;});await page.click('#play');await page.waitForFunction(()=>!document.querySelector('audio').paused);assert.ok(await page.locator('#play').isHidden());
 await page.evaluate(()=>document.querySelector('audio').dispatchEvent(new Event('error')));assert.ok(await page.locator('#status').isVisible());
 assert.deepEqual(errors.filter(e=>!e.includes('No se pudo cargar dialogue.mp3')),[]);
 const report={browser:await browser.version(),executablePath,downloaded:false,TMPDIR:process.env.TMPDIR,checks,resize:{frozen:true,playing:true,paused:true,audio_identity:true},explicit_view:true,bridge:'play/pause/seek OK',play_button:true,error_message:true,determinism:true,max_mae:Math.max(...checks.map(c=>c.max_mae)),errors:errors.filter(e=>!e.includes('No se pudo cargar dialogue.mp3'))};
 report.passed=report.max_mae<.2;await writeFile(join(outDir,'browser-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));assert.ok(report.passed,`Paridad requiere <0.2/255; resultado ${report.max_mae}`);
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
