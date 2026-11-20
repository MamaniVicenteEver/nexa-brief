import {compile} from './engine/core/compile.js';
import {renderFrame} from './engine/render.js';
import {preparePlate} from './engine/sets/index.js';
import {viewportView} from './engine/core/view.js';
const engineBase=new URL('./',import.meta.url),qs=new URLSearchParams(location.search);
const fetchJSON=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status}: ${url}`);return r.json();};
const image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
async function boot(){
 let config=JSON.parse(document.getElementById('default-config')?.textContent??'{}');for(const p of ['config.json','assets/config.json']){try{config=await fetchJSON(new URL(p,location.href));break;}catch{}}
 const episodeURL=new URL(qs.get('ep')??config.episode,location.href),episode=await fetchJSON(episodeURL),timing=await fetchJSON(new URL(episode.resources?.timing??'timing.json',episodeURL)),catalog=await fetchJSON(new URL('catalog.json',engineBase));
 const characterIds=[...new Set(episode.scenes.flatMap(s=>(Array.isArray(s.actors)?s.actors.map(a=>[a.id,a]):Object.entries(s.actors)).map(([id,a])=>{const cast=episode.cast?.[id];return a.character??(typeof cast==='string'?cast:cast?.character)??id;})))],setIds=[...new Set(episode.scenes.map(s=>s.set))];
 const characters=Object.fromEntries(await Promise.all(characterIds.map(async id=>[id,await fetchJSON(new URL(`characters/${id}.json`,engineBase))]))),sets=Object.fromEntries(await Promise.all(setIds.map(async id=>[id,await fetchJSON(new URL(`sets/${id}/set.json`,engineBase))])));
 const emotions=await fetchJSON(new URL('data/emotions.json',engineBase));
 const voiceIds=[...new Set([...Object.values(characters).map(c=>c.voice),...Object.values(episode.cast??{}).filter(c=>c?.offscreen).map(c=>c.voice).filter(Boolean)])];
 const voices=Object.fromEntries(await Promise.all(voiceIds.map(async id=>[id,await fetchJSON(new URL(`voices/${id}.json`,engineBase))])));
 const compiled=compile(episode,timing,{...catalog,characters,sets,voices,emotions});for(const w of compiled.warnings)console.warn(w.path+': '+w.message);compiled.resources={plates:{},createCanvas:(w,h)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;}};
 await Promise.all(setIds.map(async id=>{const img=await image(new URL(`sets/${id}/${sets[id].plate.file}`,engineBase));compiled.resources.plates[id]=preparePlate(img,compiled.resources.createCanvas);}));
 const font=new FontFace('VidaAnton',`url(${new URL('assets/fonts/Anton-Regular.ttf',engineBase)})`);await font.load();document.fonts.add(font);await document.fonts.ready;
 const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),audio=document.querySelector('audio'),button=document.getElementById('play');audio.src=new URL(episode.resources?.dialogue??config.audio??'dialogue.mp3',episodeURL);audio.preload='auto';
 let forced=qs.has('t')?Math.max(0,Math.min(compiled.duration,Number(qs.get('t'))||0)):qs.has('headless')?0:null;
 let view;
 const requestedView=qs.get('view')??episode.view??'auto',framing=qs.get('framing')??episode.framing??'fit';
 const render=t=>renderFrame(ctx,compiled,Math.max(0,Math.min(compiled.duration,t)),{view,framing});
 const resize=()=>{view=viewportView(innerWidth,innerHeight,requestedView);if(canvas.width!==view.w||canvas.height!==view.h){canvas.width=view.w;canvas.height=view.h;}
  const width=Math.min(innerWidth,innerHeight*view.w/view.h);canvas.style.width=width+'px';canvas.style.height=width*view.h/view.w+'px';
  document.documentElement.dataset.view=view.orientation;render(forced??audio.currentTime??0);
 };
 addEventListener('resize',resize);resize();
 function frame(){if(forced==null&&!audio.paused)render(audio.currentTime??0);requestAnimationFrame(frame);}
 const seek=async t=>{forced=Math.max(0,Math.min(compiled.duration,Number(t)||0));render(forced);};
 const play=async()=>{if((forced??audio.currentTime)>=compiled.duration-.03){audio.currentTime=0;forced=0;}if(forced!=null)audio.currentTime=forced;forced=null;await audio.play();button.hidden=true;};
 const pause=()=>{audio.pause();return seek(audio.currentTime);};
 const cuts=[...new Set([0,...compiled.scenes.flatMap(s=>[s.t0,...s.shots.map(x=>x.t0)])])].sort((a,b)=>a-b);
 window.__promo={total:compiled.duration,scenes:()=>cuts.map((t0,i)=>({t0,t1:cuts[i+1]??compiled.duration,type:'shot',seg:{text:''}})).concat([{t0:compiled.duration,t1:compiled.duration,type:'end',seg:{text:''}}]),prepare:async()=>true,seek,release(){forced=null;},missingAnchors:()=>[],play,pause};
 window.__nexaProtoControl={setTime:(t,freeze=true)=>freeze?seek(t):(forced=null,render(t)),release(){forced=null;}};
 window.__vida={compiled,render,resize,get view(){return view;},get time(){return forced??audio.currentTime;},frameState:()=>render(forced??audio.currentTime)};
 if(qs.get('controls')==='1'){
  await new Promise((ok,no)=>{const s=document.createElement('script');s.src=new URL('../../../_tools/player/bridge.js',engineBase);s.onload=ok;s.onerror=no;document.head.append(s);});
  window.NexaPlayerBridge.attach({duration:()=>compiled.duration,currentTime:()=>audio.currentTime,play,pause,async seek(t){const playing=!audio.paused;audio.currentTime=Math.max(0,Math.min(compiled.duration,t));await seek(t);if(playing)forced=null;},setVolume(v,m){audio.volume=v;audio.muted=m;},onEnded(cb){audio.addEventListener('ended',cb);}});
 }
 button.addEventListener('click',()=>play().catch(e=>showError(e)));canvas.addEventListener('click',()=>audio.paused?play().catch(e=>showError(e)):pause());
 addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();audio.paused?play().catch(e=>showError(e)):pause();}});
 audio.addEventListener('seeked',()=>{if(forced==null)render(audio.currentTime);});
 audio.addEventListener('ended',()=>{forced=compiled.duration;render(forced);if(qs.get('controls')!=='1')button.hidden=false;});
 audio.addEventListener('error',()=>showError(new Error('No se pudo cargar dialogue.mp3. Ejecutá tools/mix.mjs para este episodio.')));
 render(forced??0);document.documentElement.dataset.ready='true';requestAnimationFrame(frame);
 if(forced==null&&!qs.has('paused')&&qs.get('controls')!=='1')play().catch(()=>{button.hidden=false;});
}
function showError(e){const el=document.getElementById('status');el.textContent=e.message;el.hidden=false;console.error(e);}
boot().catch(showError);
