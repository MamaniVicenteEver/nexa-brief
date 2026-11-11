import { runAtlas } from '/api/v1/explainer/files/sandbox/nodehistory/_atlas/atlas.js';
const status = document.getElementById('status');
try {
  const response = await fetch('./components.json');
  if (!response.ok) throw Error('No se pudo cargar el catálogo.');
  const query = new URLSearchParams(location.search);
  const component = (await response.json()).components.find(item => item.name === query.get('only'));
  if (!component) throw Error('Componente no encontrado.');
  const scene = {format:'atlas-v1', duration:7, lang:'es', look:'noticiero-globo', attribution:false,
    camera:[{t:0,focus:[-77,38.9],span:65,pitch:45}], layers:[], hud:[]};
  const demo = structuredClone(component.demo);
  if (component.target === 'hud') scene.hud.push(demo);
  else if (component.target === 'layers') scene.layers.push(demo);
  else Object.assign(scene, demo);
  await runAtlas({showcase:true,loadData:async()=>({scene,config:{configs:[{}]},lyrics:{segments:[]}})});
  const total=window.__promo.total;
  const position=query.get('framePosition');
  const initial=position==='first'?0:position==='middle'?total/2:position==='last'?total-.1:Number(query.get('t'))>0?Math.min(Number(query.get('t')),total-.01):2.6;
  await window.__promo.seek(initial);
  const missing=window.__promo.missingTiles();
  status.textContent=missing.length?'Faltan recursos del mapa para esta vista.':'';
  window.__atlasPreview={name:component.name,currentTime:initial,missing};
  if(parent!==window)parent.postMessage({type:'nexa-animation-ready'},'*');
  if(query.get('autoplay')==='1') { let start; const tick=now=>{if(start==null)start=now;const t=(initial+(now-start)/1000)%total;window.__atlasPreview.currentTime=t;window.__nexaProtoControl.setTime(t,false);requestAnimationFrame(tick);};requestAnimationFrame(tick); }
} catch(error) {status.textContent=error.message;console.error('[noticiero showcase]',error);if(parent!==window)parent.postMessage({type:'nexa-animation-error'},'*');}
