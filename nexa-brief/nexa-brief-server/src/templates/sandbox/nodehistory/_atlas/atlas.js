import * as maplibre from './vendor/maplibre-gl.mjs';
import { Protocol, PMTiles } from './vendor/pmtiles.js';
import { createCamera } from './camera.js';
import { createGeo, cameraKeys } from './geo.js';
import { composeStyle, createLookAt } from './style.js';
import { screenAttribution, paintBackground, drawAttribution } from './attribution.js';
import { apply } from './update.js';

const BASE = new URL('./', import.meta.url).href;
const STYLE_TIMEOUT_MS = 60000;
const QS = new URLSearchParams(location.search);
const json = async url => { const r=await fetch(url); if(!r.ok) throw Error(`${r.status} ${url}`); return r.json(); };
const optional = (url, fallback) => json(url).catch(()=>fallback);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const missing=new Set(), timings=[];
// A server without Range support (including the shared warm server) can still serve
// the archive. Keep the single full response in memory and slice subsequent reads.
class ArchiveSource {
  constructor(url){this.url=url;this.full=null;this.pending=null;}
  getKey(){return this.url;}
  async getBytes(offset,length,signal){
    if(this.full)return {data:this.full.slice(offset,offset+length)};
    if(this.pending){await this.pending;if(this.full)return {data:this.full.slice(offset,offset+length)};}
    let release;this.pending=new Promise(r=>{release=r;});
    try {const response=await fetch(this.url,{headers:{Range:`bytes=${offset}-${offset+length-1}`}});if(!response.ok)throw Error(`PMTiles ${response.status}: ${this.url}`);const data=await response.arrayBuffer();if(response.status===200){this.full=data;return {data:data.slice(offset,offset+length)};}return {data,etag:response.headers.get('etag')||undefined};}
    finally {release();this.pending=null;}
  }
}
const protocol=new Protocol(); maplibre.addProtocol('pmtiles',protocol.tile);
maplibre.setWorkerUrl(new URL('vendor/maplibre-gl-worker.mjs',BASE).href);
const theme={heavy:'900 $px Montserrat',accent:'#ffd21a',introDim:0.35,captions:{color:'#ffd21a',maxWords:4,size:36,y:0.885,yLandscape:0.915},outro:{channel:'NODEHISTORY',handle:'youtube.com/@nodehistory'},word(g,s,x,y,size,col,center){g.save();g.textAlign=center?'center':'left';g.textBaseline='middle';g.shadowColor='rgba(0,0,0,.75)';g.shadowBlur=size*0.25;g.lineJoin='round';g.lineWidth=size*0.12;g.strokeStyle='#000';g.strokeText(s,x,y);g.shadowBlur=0;g.fillStyle=col;g.fillText(s,x,y);g.restore();}};
let readyResolve; const ready = new Promise(resolve=>{readyResolve=resolve;});
window.__atlas={ready,missingTiles:()=>[...missing],stats:()=>({missing:missing.size,frames:timings.length}),fps:()=>{const a=[...timings].sort((x,y)=>x-y);return {frames:a.length,meanMs:a.length?a.reduce((x,y)=>x+y,0)/a.length:0,p95Ms:a.length?a[Math.ceil(a.length*.95)-1]:0};},sweep:async (...args)=>(await ready).sweep(...args)};

function view(c,pose){
  const map=c.map, center=map.project([pose.lon,pose.lat]);
  function local(lon,lat){const p=map.project([lon,lat]), q=map.project([lon+0.001,lat]);return Math.hypot(q.x-p.x,q.y-p.y)/Math.max(.01,Math.cos(lat*Math.PI/180));}
  const scale=local(pose.lon,pose.lat)||1;
  return {W:c.st.W,H:c.st.H,zoom:pose.zoom,pitch:pose.pitch,bearing:pose.bearing,project(lon,lat,altM=0){
    // Map.project's public API accepts only a longitude/latitude. Altitude is ignored.
    const p=map.project([lon,lat]); let occluded=false;
    try { occluded=!!map._camera.transform.isLocationOccluded(new maplibre.LngLat(lon,lat),map.terrain); } catch (_) {}
    return {x:p.x,y:p.y,visible:!occluded&&Number.isFinite(p.x)&&Number.isFinite(p.y),k:clamp(local(lon,lat)/scale,.35,1.5)};
  }};
}
async function waitTiles(c,t){const started=performance.now();while(!(c.map.loaded()&&c.map.areTilesLoaded())){if(performance.now()-started>20000){missing.add(`timeout at ${t.toFixed(2)}s`);break;}await new Promise(r=>setTimeout(r,40));}c.map.redraw();}


export function runAtlas(options = {}) { return Proto.run({
 name:'atlas',sceneOptIn:true,allowSceneQuery:true,missingTiles:()=>[...missing],fonts:['800 40px Montserrat','900 40px Montserrat','italic 900 40px Montserrat','italic 800 40px Montserrat'],theme,
 async setup(c){
  const {scene,T}=c;if(scene.duration!=null&&scene.end==null)scene.end=scene.duration;
  const names=new Set([scene.look||'satelite-realista',...(scene.looks||[]).map(e=>e.look)].filter(v=>typeof v==='string'));
  const [providers,resolved,...results]=await Promise.all([json(BASE+'providers.json'),optional('assets/geo.resolved.json',{}),...['admin0','admin1','admin2-US'].map(n=>json(BASE+'data/geo/'+n+'.geojson')),...[...names].map(n=>json(BASE+'looks/'+encodeURIComponent(n)+'.json'))]);
  c.providers=providers;const collections=results.slice(0,3),looks=Object.fromEntries([...names].map((n,i)=>[n,results[i+3]]));c.geo=createGeo(scene,resolved,collections);c.camera=createCamera(cameraKeys(scene,c.geo,T,c.st.W));c.lookAt=createLookAt(scene,looks,T);c.base=BASE;c.online=QS.get('online')==='1';c.highlights=[];
  for(const id of ['world',...(scene.datasets?.vector?['detail-'+scene.datasets.vector]:[])]){const url=new URL(`cache/vector/${id}.pmtiles`,BASE).href;protocol.add(new PMTiles(new ArchiveSource(url)));}
  const first=c.lookAt(0),detailProviders=[...new Set([first,...Object.values(looks),...(scene.looks||[]).map(e=>c.lookAt(T(e.t,0)+(e.dur||0)))].map(l=>l.sat?.detail).filter(Boolean))];const style=composeStyle(first,{base:BASE,online:QS.get('online')==='1',providers,detail:scene.datasets?.vector,lang:scene.lang||'es',detailProviders,width:c.st.W});c.satIds=['sat-bm','sat-viirs',...detailProviders.map(id=>'sat-detail-'+id)];
  (scene.layers||[]).forEach((ly,i)=>{if(ly.type!=='highlight')return;const resolvedRegion=(resolved.regions||[]).find(r=>r.layer===i&&r.field==='region');const found=collections.flatMap(x=>x.features).find(f=>f.properties?.id===(resolvedRegion?.id||ly.region))||resolvedRegion||c.geo.region(ly.region);if(!found?.geometry){missing.add(`región no encontrada: ${ly.region}`);return;}const id='hl-'+i;style.sources[id]={type:'geojson',data:{type:'Feature',properties:{},geometry:found.geometry}};style.layers.push({id:id+'-fill',type:'fill',source:id,paint:{'fill-color':'#9aa33a','fill-opacity':0}},{id:id+'-glow',type:'line',source:id,paint:{'line-color':'#ffffff','line-width':3,'line-blur':1.5,'line-opacity':0}},{id:id+'-line',type:'line',source:id,paint:{'line-color':'#ffffff','line-width':1.1,'line-opacity':0}});c.highlights.push({...ly,id,t:T(ly.t,0),dur:ly.dur??.35,out:ly.out==null?null:T(ly.out)});});
  const container=document.createElement('div');container.style.cssText=`position:fixed;left:-99999px;top:0;width:${c.st.W}px;height:${c.st.H}px;`;document.body.appendChild(container);c.container=container;
  c.map=new maplibre.Map({container,style,pixelRatio:1,fadeDuration:0,canvasContextAttributes:{preserveDrawingBuffer:true,antialias:true},maxPitch:85,attributionControl:false,interactive:false,renderWorldCopies:false,maxTileCacheSize:8192,maxTileCacheZoomLevels:20});
  c.map.on('error',e=>{const err=e.error;const msg=String(err?.message||err||'');if(/(tile|404|403|fetch|network|pmtiles)/i.test(msg))missing.add(msg);else console.error('[atlas]',err);});
  await new Promise((resolve,reject)=>{c.map.once('load',resolve);setTimeout(()=>reject(Error(`Atlas: no se pudo cargar el estilo en ${STYLE_TIMEOUT_MS / 1000} s`)),STYLE_TIMEOUT_MS);});
  c.baseLayers=style.layers.filter(l=>/^base-(light|dark|grayscale)-/.test(l.id));c.sweepSerial=0;c.sweeping=false;
  const {createOverlays}=await import('./overlays.js');c.overlays=createOverlays(scene,{T,loadImg:c.loadImg,img:c.img,font:'Montserrat, sans-serif',base:new URL('assets/',location.href).href,place:c.geo.place});await c.overlays.ready();
  for (const src of c.overlays.missing()) missing.add(`imagen ausente: ${src}`);
  if(QS.get('online')==='1'){const badge=document.createElement('div');badge.textContent='ONLINE';badge.style.cssText='position:fixed;right:8px;top:8px;background:#b00020;color:white;padding:5px;z-index:20;font:12px sans-serif';document.body.appendChild(badge);}
  const sweep=async(step=.25,progress=()=>{})=>{if(!(step>0))throw Error('step debe ser positivo');const serial=++c.sweepSerial;c.sweeping=true;try{const end=c.END??T(scene.duration??scene.end,16.4),total=Math.ceil(end/step)+1;for(let i=0;i<total&&serial===c.sweepSerial;i++){let t=Math.min(end,i*step);apply(c,t);await waitTiles(c,t);progress((i+1)/total);}return [...missing];}finally{if(serial===c.sweepSerial)c.sweeping=false;}};
  c.sweep=sweep;
  setTimeout(()=>{if(!navigator.webdriver&&QS.get('preload')==='1'&&QS.get('warm')!=='1'){const bar=document.createElement('div');bar.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:30;background:#111c;color:white;padding:10px 16px;font:14px sans-serif;border-radius:4px';document.body.appendChild(bar);sweep(.25,p=>bar.textContent=`Preparando mapa ${Math.round(p*100)} %`).catch(console.error).finally(()=>bar.remove());}},0);
 },
 onReady(c){readyResolve({sweep:c.sweep});},
 async prepare(c,t){c.sweepSerial++;c.sweeping=false;apply(c,t);await waitTiles(c,t);return true;},
 render(c,t){const start=performance.now(),{pose,look}=c.sweeping?{pose:c.camera.at(t),look:c.lookAt(t)}:apply(c,t);c.map.redraw();paintBackground(c.g,c.st.W,c.st.H,look);c.g.drawImage(c.map.getCanvas(),0,0,c.st.W,c.st.H);c.overlays?.draw(c.g,t,view(c,pose));drawAttribution(c.g,c.st.W,c.st.H,c.st.U,screenAttribution(look,pose.zoom));timings.push(performance.now()-start);if(timings.length>120)timings.shift();},
 resize(c){c.container.style.width=c.st.W+'px';c.container.style.height=c.st.H+'px';c.map.resize();c.camera=createCamera(cameraKeys(c.scene,c.geo,c.T,c.st.W));},
 shots:c=>c.camera.keys.map(k=>k.t),avoid:(c,t,W,H)=>[[W/2,H/2]],
 ...options,
}).catch(e=>{console.error('[atlas]',e);readyResolve(Promise.reject(e));throw e;}); }
if (document.documentElement.dataset.atlasManual !== 'true') runAtlas();
