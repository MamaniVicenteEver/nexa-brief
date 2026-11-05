// Isolated gallery renderer: imports geometry and components, never the map/tiles player.
import {create,Tactico} from '../../engine/tactico/core.js';
import {createView,mercator} from '../../engine/plano/view.js';
import {createTerritories} from '../../engine/plano/territories.js';
import {atlasURL,sharedModules,readJSON} from '../../engine/plano/paths.js';
import {cachedPreviewLayout} from './preview-layout.js';

export async function preview({query,alternate}) {
  const started=performance.now();
  const name=query.get('only')||query.get('component'),spriteName=query.get('sprite'),bg=query.get('bg')||'white';
  // A lighter slate isolates dark smoke while retaining the original effect palette.
  const darkTone=name?.startsWith('fx.')?'#304653':'#081e2c';
  document.body.style.background=bg==='dark'?darkTone:'#ffffff';
  const W=1080,H=1080,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  canvas.style.cssText='position:static;width:100%;height:100%;object-fit:contain';
  document.querySelector('#stage').append(canvas);
  const g=canvas.getContext('2d'),surface=new OffscreenCanvas(W,H),sg=surface.getContext('2d',{willReadFrequently:true});
  const [shared,collection,look,manifest,layouts]=await Promise.all([sharedModules(),readJSON(atlasURL('data/geo/admin0.geojson')),readJSON(new URL('../../engine/looks/tactico.json',import.meta.url)),readJSON(new URL('../../engine/tactico/sprites/sprites.json',import.meta.url)),readJSON(new URL('./preview-layouts.json',import.meta.url)).catch(()=>null)]);
  const scene=structuredClone(alternate||{duration:8,items:[Tactico.get(name||'fx.explosion').demo]});
  scene.places={Salida:[56.25,26.65],Paso:[56.45,26.5],Llegada:[56.75,26.35]};
  scene.defs={palette:{background:'#081e2c',dark:'#081e2c',ink:'#081e2c',paper:'#e9e3ba',text:'#e9e3ba',accent:'#f6edb4',success:'#399e58',danger:'#c95c48',cyan:'#084c68'},fonts:{label:'sans-serif'}};
  // Crop must describe the whole local sequence, including late-starting HUD demos.
  const start=Math.min(...scene.items.map(i=>i.t||0));
  function shift(value,key=''){if(Array.isArray(value))return value.map(v=>shift(v,key));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v==='number'&&(k==='t'||k==='out'||k==='at'&&['states','actions'].includes(key))?Math.max(0,v-start):shift(v,k)]));return value;}
  scene.items=scene.items.map((i,n)=>({id:`preview-${n}`,t:0,...shift(i)}));
  scene.duration=Math.max(.5,...scene.items.map(i=>(i.out??((i.t||0)+(i.dur??8)))+(i.fade??.35)));
  if (/^air\.(bomber|jet|prop|helicopter)$/.test(name)) scene.items.forEach(i=>{if(i.type===name)i.scale=3;});
  const family=(name||'').split('.')[0],bases=Object.keys(manifest.sprites).filter(k=>manifest.sprites[k].state==='normal');
  const prefixes={air:/^air-/,naval:/^(carrier|warship|cargo|submarine|air-jet-fighter)/,ground:/^(tank|apc|truck|jeep|artillery|missile-launcher|ambulance|engineer)/,army:/^(tank|apc|truck|jeep|artillery|missile-launcher|ambulance|engineer)/};
  const selected=new Set(spriteName?[spriteName]:bases.filter(k=>prefixes[family]?.test(k)||family==='inventory'&&/^carrier-super$/.test(k)));
  for(const k of [...selected])for(const state of Object.values(manifest.sprites[k]?.states||{}))selected.add(state);
  scene.spriteManifest={sprites:Object.fromEntries(Object.entries(manifest.sprites).filter(([k])=>selected.has(k)))};
  if(spriteName){
    const sprite=manifest.sprites[spriteName];if(!sprite)throw Error(`Sprite desconocido: ${spriteName}`);
    const image=new Image();image.src=new URL(`../../engine/tactico/sprites/${sprite.file}`,import.meta.url);await image.decode();
    let current=0;
    const paint=t=>{background(g,bg,W,H,darkTone);g.save();g.translate(W/2+Math.sin(t*.8)*50,H/2);g.rotate(Math.sin(t*.5)*.35);const k=700/Math.max(image.width,image.height);g.shadowColor='#0005';g.shadowBlur=16;g.shadowOffsetY=14;g.drawImage(image,-image.width*k/2,-image.height*k/2,image.width*k,image.height*k);g.restore();current=t;};
    return play({paint,total:8,query,current:()=>current});
  }
  const geo=shared.createGeo(scene,{},[collection]),territories=createTerritories(collection),points=[];
  const collect=v=>{if(Array.isArray(v)){if(v.length===2&&v.every(Number.isFinite)&&Math.abs(v[0])<=180&&Math.abs(v[1])<=85)points.push(v);else v.forEach(collect);}else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))if(['at','from','to','via','path','focus'].includes(k))collect(x);};
  for(const i of scene.items)collect(i);
  let center=points[0]||[56.5,26.5],span=5;
  const region=scene.items.find(i=>i.region)?.region;
  if(region){const parts=territories.country(region)||[],bounds=parts.map(p=>p.bounds);if(bounds.length){const b=[Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))];center=[(b[0]+b[2])/2*360-180,Math.atan(Math.sinh(Math.PI*(1-b[1]-b[3])))*180/Math.PI];span=Math.max(b[2]-b[0],b[3]-b[1])*360*1.5;}}
  else if(points.length){const p=points.map(p=>mercator(...p)),xs=p.map(p=>p[0]),ys=p.map(p=>p[1]);const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;center=[x*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];span=Math.max(3,(Math.max(...xs)-Math.min(...xs))*360*1.7,(Math.max(...ys)-Math.min(...ys))*360*1.7);}
  const view=createView({lon:center[0],lat:center[1],zoom:Math.log2(W*360/(512*span))},W,H);
  const context={st:{W,H,U:1},scene,geo,territories,shared,look,base:location.href};
  const runtime=await create(context,scene);context.tactico=runtime;window.__tacticoContext=context;
  const probe=new OffscreenCanvas(64,64),pg=probe.getContext('2d',{willReadFrequently:true});
  let renderedKey,hasContent=false;
  const raw=t=>{const key=runtime.key(t);if(key===renderedKey)return hasContent;renderedKey=key;sg.resetTransform();sg.clearRect(0,0,W,H);runtime.draw(sg,view,t);pg.clearRect(0,0,64,64);pg.drawImage(surface,0,0,64,64);const pixels=pg.getImageData(0,0,64,64).data;hasContent=false;for(let n=3;n<pixels.length;n+=4)if(pixels[n]>1){hasContent=true;break;}return hasContent;};
  let crop=[W,H,0,0],peak=0,peakTime=.5,lastContent=0;const visibleTimes=[];
  const cached=query.get('layout')==='measure'?null:cachedPreviewLayout(layouts,name,Tactico.get(name)?.demo);
  // One union crop per sequence keeps scale/centering stable during entry, motion and exit.
  if(cached){crop=[...cached.crop];peak=cached.peak;peakTime=cached.peakTime;lastContent=scene.duration;}
  else for(let n=1;n<=16;n++){const t=scene.duration*n/17;raw(t);const a=sg.getImageData(0,0,W,H).data;let count=0;for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4)if(a[(y*W+x)*4+3]>20){count++;crop[0]=Math.min(crop[0],x);crop[1]=Math.min(crop[1],y);crop[2]=Math.max(crop[2],x+4);crop[3]=Math.max(crop[3],y+4);}if(count){lastContent=t;visibleTimes.push(t);}if(count>peak){peak=count;peakTime=t;}}
  if(!peak)throw Error(`Vista vacía: ${name}`);
  // Area alone favors late smoke or an opaque HUD backdrop; select a representative full state.
  const moments={'fx.explosion':.28,'fx.impact':.4,'strike.missile':1.5,'strike.shell':.32,'strike.torpedo':2.4,'intro.title':2.8,'outro.channel':6.5};
  peakTime=moments[name]??peakTime;
  const cw=crop[2]-crop[0],ch=crop[3]-crop[1],scale=Math.min(940/cw,940/ch);
  let current=0;
  const paint=t=>{if(!raw(t)&&query.get('autoplay')==='1'&&query.get('loop')==='1'){
    // Remove silent gaps between caption groups or bursts, retaining every visible phase.
    const candidates=visibleTimes.length?visibleTimes.filter(v=>v>t).concat(visibleTimes):Array.from({length:68},(_,i)=>(t+(i+1)*scene.duration/68)%scene.duration);
    const next=candidates.find(v=>raw(v))??peakTime;let low=Math.max(0,next-scene.duration/(visibleTimes.length?17:68)),high=next;
    for(let n=0;n<5;n++){const mid=(low+high)/2;if(raw(mid))high=mid;else low=mid;}t=high;raw(t);
  }background(g,bg,W,H,darkTone);g.save();g.translate(W/2-(crop[0]+cw/2)*scale,H/2-(crop[1]+ch/2)*scale);g.scale(scale,scale);g.drawImage(surface,0,0);g.restore();current=t;};
  window.__animationPreview={name,bg,crop,peakTime,peak,missing:runtime.missing(),cachedLayout:!!cached,analysisFrames:cached?0:16,prepareMs:performance.now()-started};
  return play({paint,total:name==='air.drop'?Math.min(scene.duration,((scene.items.at(-1).count??3)-1)*(scene.items.at(-1).interval??.3)+(scene.items.at(-1).fallDur??1.4)+.45):Math.min(scene.duration,lastContent+scene.duration/17),query,current:()=>current,initialTime:peakTime});
}
function background(g,bg,W,H,darkTone='#081e2c'){g.resetTransform();g.fillStyle=bg==='dark'?darkTone:'#ffffff';g.fillRect(0,0,W,H);if(bg==='checker'){g.fillStyle='#dce1e5';for(let y=0;y<H;y+=40)for(let x=0;x<W;x+=40)if((x/40+y/40)%2)g.fillRect(x,y,40,40);}}
function play({paint,total,query,current,initialTime=Math.min(.15,total/10)}){
  const slider=document.querySelector('#time'),stamp=document.querySelector('#stamp'),button=document.querySelector('#play');slider.max=total;
  let playing=query.get('autoplay')==='1'||query.get('loop')==='1',last=null;
  const seek=async t=>{t=Number(t);paint(t);slider.value=t;stamp.textContent=`${t.toFixed(2)} s`;};
  slider.oninput=()=>{playing=false;seek(slider.value);};button.onclick=()=>{playing=!playing;last=null;button.textContent=playing?'Pausa':'Reproducir';};
  window.__promo={total,seek,pause:()=>{playing=false;},play:()=>{playing=true;last=null;}};
  window.__atlas={ready:Promise.resolve(),view:()=>null,missingTiles:()=>[]};
  const position=query.get("framePosition");
  seek(position==="first" ? 0 : position==="middle" ? total/2 : position==="last" ? Math.max(0,total-.1) : Number(query.get("t")??Math.min(initialTime,total)));
  function frame(now){if(playing){const dt=last==null?0:(now-last)/1000;last=now;let t=current()+dt;if(t>=total){if(query.get('loop')==='1')t%=total;else{t=total;playing=false;}}seek(t);}requestAnimationFrame(frame);}
  document.addEventListener('visibilitychange',()=>{last=null;});
  window.__animationReady=true;
  requestAnimationFrame(()=>{
    if(parent!==window)parent.postMessage({type:'nexa-animation-ready'},'*');
    requestAnimationFrame(frame);
  });
}
