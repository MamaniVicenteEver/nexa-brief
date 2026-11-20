import {drawCharacter,posePreset} from './engine/index.js';
import {drawProp,PROPS} from './engine/props/index.js';
import {drawFX} from './engine/fx/index.js';

const qs=new URLSearchParams(location.search),status=document.getElementById('status');
const json=async file=>{const response=await fetch(new URL(file,import.meta.url));if(!response.ok)throw new Error(`No se pudo cargar ${file} (${response.status}).`);return response.json();};
const image=async file=>{const img=new Image();img.src=new URL(file,import.meta.url);await img.decode();return img;};
const frozen=qs.has('still')||qs.get('autoplay')==='0';
const ready=()=>{status.hidden=true;document.documentElement.dataset.ready='true';parent.postMessage({type:'nexa-animation-ready'},location.origin);};
const motion=(draw,duration=3)=>{const point=qs.get("framePosition");draw(frozen?(point==="middle"?duration/2:point==="last"?Math.max(0,duration-.1):0):0);if(frozen)return;const epoch=performance.now();let previous=epoch;function frame(now){if(now-previous>=1000/30){draw((now-epoch)/1000);previous=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);};

async function boot(){
 const {components}=await json('showcase/components.json');
 const item=components.find(c=>c.name===qs.get('only'));
 if(!item)throw new Error('Componente desconocido.');
 const {section,id}=item.preview;
 if(['actions','shots','ui','castModes','sceneTransitions','initialState'].includes(section)){
  const frame=document.createElement('iframe'),url=new URL(item.preview.url,import.meta.url);
  if(url.origin!==location.origin||!url.pathname.includes('/sandbox/nodeaction/'))throw new Error('Ejemplo fuera del motor.');
  const sample=Number(url.searchParams.get('t'))||0;url.searchParams.set('t',String(sample));
  url.searchParams.set('view',qs.get('aspect')==='9x16'?'portrait':'landscape');
  frame.title=item.name;frame.src=url;document.body.append(frame);
  const deadline=performance.now()+30_000;
  await new Promise((resolve,reject)=>{
   function check(){
    const child=frame.contentWindow;
    if(child?.__vida){resolve();return;}
    const error=child?.document.getElementById('status');
    if(error&&!error.hidden){reject(new Error(error.textContent));return;}
    if(performance.now()>deadline){reject(new Error('El ejemplo tardó demasiado en cargar.'));return;}
    requestAnimationFrame(check);
   }requestAnimationFrame(check);
  });
  const child=frame.contentWindow,total=child.__promo.total;
  let start=Math.max(0,sample-1),duration=Math.min(3,total-start);
  if(section==='actions'){
   const event=child.__vida.compiled.scenes.flatMap(s=>s.events).find(e=>e.action===id&&sample>=e.t0&&sample<=e.t0+e.dur);
   if(event){start=event.t0;duration=Math.max(.1,Math.min(event.dur,total-start));}
  }
  motion(t=>child.__promo.seek(start+t%duration),duration);ready();return;
 }
 if(section==='sets'){
  document.body.append(await image(`sets/${id}/plate.png`));ready();return;
 }
 const canvas=document.createElement('canvas');canvas.width=qs.get('aspect')==='9x16'?1080:1920;canvas.height=qs.get('aspect')==='9x16'?1920:1080;
 document.body.append(canvas);const ctx=canvas.getContext('2d');
 const clear=()=>{ctx.fillStyle='#faf8f2';ctx.fillRect(0,0,canvas.width,canvas.height);};
 if(section==='props'){
  const prop=PROPS[id],scale=Math.min(canvas.width*.65/prop.w,canvas.height*.65/prop.h);
  clear();drawProp(ctx,id,{x:canvas.width/2,y:prop.kind==='hand'?canvas.height/2:canvas.height*.8,scale});ready();return;
 }
 const character=await json(`characters/${section==='characters'?id:'tomas'}.json`);
 if(section==='hair')character.hair={...character.hair,style:id};
 if(section==='outfits')character.outfit={...character.outfit,style:id};
 motion(t=>{
  clear();const scale=Math.min(canvas.height*.75,canvas.width*.85)/character.height;
  const pose=posePreset(section==='hands'?'wave':'idle',{x:canvas.width/2,y:canvas.height*.87,scale,view:Math.sin(t*.6)*.6});
  if(section==='hands')pose.handShapes.right=id;
  const face={expression:section==='expressions'?id:character.face.expression,intensity:1,
   viseme:section==='visemes'?id:'X',open:section==='visemes'?.65+.35*Math.sin(t*4):0};
  const anchors=drawCharacter(ctx,character,pose,face,t);
  if(section==='fx')drawFX(ctx,{type:id,intensity:1},anchors.head,scale,t);
 });ready();
}
boot().catch(error=>{status.hidden=false;status.setAttribute('role','alert');status.textContent=error.message;document.documentElement.dataset.ready='error';parent.postMessage({type:'nexa-animation-error'},location.origin);console.error(error);});
