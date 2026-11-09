import {atlasURL,LOOKS,readJSON,sharedModules} from './paths.js';
import {createView} from './view.js';
import {createTiles} from './tiles.js';
import {createTerritories} from './territories.js';
import {blurSettings,sampleTimes,createBlur} from './blur.js';

let resolveReady,rejectReady,context;
const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
const timings=[];
window.__atlas={
  ready,
  missingTiles:()=>context?[...context.tiles.missingTiles(),...context.missing]:[],
  sweep:async(...args)=>(await ready).sweep(...args),
  stats:()=>context?{...context.tiles.stats(),paths:context.territories.count,blurSamples:context.lastSamples,renderMs:context.renderMs,preloadMs:context.preloadMs,cachedFrames:context.cachedFrames||0}: {},
  fps:()=>{const sorted=[...timings].sort((a,b)=>a-b);return {frames:sorted.length,meanMs:sorted.reduce((a,b)=>a+b,0)/(sorted.length||1),p95Ms:sorted[Math.ceil(sorted.length*.95)-1]||0};},
  view:time=>context?createView(context.camera.at(time),context.st.W,context.st.H):null,
};
function finishLook(g,c){
  const {W,H}=c.st;
  if(!c.vignette||c.vignette.width!==W||c.vignette.height!==H){
    c.vignette=new OffscreenCanvas(W,H);const vg=c.vignette.getContext('2d',{willReadFrequently:true}),v=c.look.vignette||{};
    const r=Math.hypot(W,H)/2,gradient=vg.createRadialGradient(W/2,H/2,r*(v.inner??.2),W/2,H/2,r);
    gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,`rgba(0,0,0,${v.opacity??0})`);
    vg.fillStyle=gradient;vg.fillRect(0,0,W,H);
  }
  g.drawImage(c.vignette,0,0);
  g.save();g.font=`${Math.max(9,11*c.st.U)}px sans-serif`;g.textAlign='right';g.textBaseline='bottom';
  g.fillStyle='#d6dbe0';g.shadowColor='#000';g.shadowBlur=3*c.st.U;g.fillText(c.look.attribution||'',W-8,H-5,W-16);g.restore();
}
function drawSample(g,c,t){
  const {W,H}=c.st,view=createView(c.camera.at(t),W,H);
  g.save();g.resetTransform();g.globalAlpha=1;g.globalCompositeOperation='source-over';
  g.fillStyle=c.look.background;g.fillRect(0,0,W,H);
  let mark=performance.now();c.tiles.draw(g,view);c.phases.tiles+=performance.now()-mark;
  mark=performance.now();c.territories.draw(g,view,c.highlights,t,c.look);c.phases.territories+=performance.now()-mark;
  // GANCHO tactico: items de la biblioteca (../tactico/core.js) se dibujan por muestra, asi se desenfocan con el mapa.
  if(c.tactico)c.tactico.draw(g,view,t,{sample:true});
  g.restore();
}
function stillKey(c,t,W,H){
  const alphas=c.highlights.map(layer=>{
    const dur=Math.max(.001,layer.dur??.35);
    return Math.max(0,Math.min(1,(t-layer.t)/dur))*(layer.out==null?1:Math.max(0,Math.min(1,1-(t-layer.out)/dur)));
  });
  // Solo el bitmap del mapa se reutiliza; intro/captions/media siguen en Proto.
  // El key incluye el contenido visible y la cobertura, nunca el orden del seek.
  return JSON.stringify([W,H,c.camera.at(t),alphas,c.look,c.tiles.stats().loaded,c.tactico?c.tactico.key(t):null]);
}
Proto.run({
  name:'atlas-plano',sceneOptIn:true,allowSceneQuery:true,theme:{},fonts:[],
  missingTiles:()=>window.__atlas.missingTiles(),
  async setup(c){
    context=c;const started=performance.now(),{scene,T}=c;
    if(scene.duration!=null&&scene.end==null)scene.end=scene.duration;
    const [shared,providers,collection,look,inventory]=await Promise.all([
      sharedModules(),readJSON(atlasURL('providers.json')),readJSON(atlasURL('data/geo/admin0.geojson')),
      readJSON(new URL(`${scene.planoLook||'tactico'}.json`,LOOKS)),
      scene.tiles?.manifest?readJSON(new URL(scene.tiles.manifest,location.href)):null,
    ]);
    c.look={...look,...scene.planoLookOverrides};c.shared=shared;c.missing=[];
    const provider=providers.find(p=>p.id===(scene.tiles?.provider||'gibs-bluemarble'));
    if(!provider||provider.kind!=='raster')throw Error('Atlas plano: proveedor raster desconocido');
    // GANCHO tactico: expande camera macros (follow, zoomThrough, reframe) a keys explicitas antes de crear la camara.
    if(scene.items){const tm=await import("../tactico/core.js");tm.expandScene(scene,{T});c.tacticoModule=tm;}
    c.geo=shared.createGeo(scene,{},[collection]);c.camera=shared.createCamera(shared.cameraKeys(scene,c.geo,T,c.st.W));
    c.territories=createTerritories(collection);c.blur=createBlur();c.blurConfig=blurSettings(scene.motionBlur);
    c.tiles=createTiles(provider,c.look,c.territories,inventory);c.highlights=[];
    for(const layer of scene.layers||[]){
      if(!['highlight','territory.fill','fill'].includes(layer.type))continue;
      const parts=c.territories.country(layer.region);
      if(!parts){c.missing.push(`región no encontrada: ${layer.region}`);continue;}
      c.highlights.push({...layer,parts,t:T(layer.t,0),out:layer.out==null?null:T(layer.out)});
    }
    // GANCHO tactico: crea los items (sprites, flags, sonido) despues de territorios y antes del barrido.
    if(c.tacticoModule){c.tactico=await c.tacticoModule.create(c,scene);window.__tactico=c.tactico;c.missing.push(...(c.tactico.missing?c.tactico.missing():[]));}
    c.sweep=async(step=1/30,progress=()=>{})=>{
      if(!(step>0&&Number.isFinite(step)))throw Error('step debe ser positivo y finito');
      // Nunca barrer menos de 30 fps; incluye las N poses del shutter y todos los padres.
      step=Math.min(step,1/c.blurConfig.fps||1/30,1/30);
      const end=T(scene.end,25),count=Math.ceil(end/step);
      for(let i=0;i<=count;i++){
        const t=Math.min(end,i*step),{times}=sampleTimes(c.camera,t,c.st.W,c.st.H,c.blurConfig);
        for(const time of times)c.tiles.plan(createView(c.camera.at(time),c.st.W,c.st.H));
      }
      await c.tiles.preload(progress);return window.__atlas.missingTiles();
    };
    await c.sweep();c.preloadMs=performance.now()-started;
  },
  onReady(c){resolveReady({sweep:c.sweep});},
  async prepare(c,t){if(c.resizeReady)await c.resizeReady;return true;},
  render(c,t){
    const start=performance.now(),{W,H}=c.st;
    c.phases={tiles:0,territories:0,blur:0,look:0,present:0};
    const {times}=sampleTimes(c.camera,t,W,H,c.blurConfig);c.lastSamples=times.length;
    // Skia raster evita la teselación WebGL de miles de costas en SwiftShader.
    // Se conserva resolución completa y se copia un único bitmap al canvas de Proto.
    if(!c.frame||c.frame.width!==W||c.frame.height!==H)c.frame=new OffscreenCanvas(W,H);
    const key=times.length===1?stillKey(c,t,W,H):null;
    if(key&&key===c.frameKey)c.cachedFrames=(c.cachedFrames||0)+1;
    else{
      const g=c.frame.getContext('2d',{willReadFrequently:true});g.resetTransform();g.globalAlpha=1;g.globalCompositeOperation='source-over';
      let mark=performance.now();c.blur.draw(g,times,W,H,(target,time)=>drawSample(target,c,time));
      c.phases.blur=performance.now()-mark-c.phases.tiles-c.phases.territories;
      mark=performance.now();finishLook(g,c);c.phases.look=performance.now()-mark;
    }
    c.frameKey=key;const present=performance.now();c.g.drawImage(c.frame,0,0);c.phases.present=performance.now()-present;
    c.renderMs=performance.now()-start;timings.push(c.renderMs);if(timings.length>120)timings.shift();
  },
  resize(c){
    c.camera=c.shared.createCamera(c.shared.cameraKeys(c.scene,c.geo,c.T,c.st.W));
    c.resizeReady=c.sweep();
  },
  shots:c=>c.camera.keys.map(k=>k.t),
}).catch(error=>{console.error('[atlas-plano]',error);rejectReady(error);});
