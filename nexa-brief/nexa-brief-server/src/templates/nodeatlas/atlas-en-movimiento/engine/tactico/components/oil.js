import {Tactico} from '../core.js';

// Blender renders are shared assets; the tactical engine owns their placement and timing.
const root = new URL('../sprites3/', import.meta.url);
const imageCache = new Map();
async function image(name) {
  if (typeof Image === 'undefined') return null;
  if (!imageCache.has(name)) {
    const promise = (async () => { const img = new Image(); img.src = new URL(name, root).href; await img.decode(); return img; })();
    imageCache.set(name, promise);
  }
  return imageCache.get(name);
}
const sequence = slug => Array.from({length:8},(_,i)=>`oil-${slug}-${String(i).padStart(2,'0')}.png`);
const assets = {
  barrel: {summary:'Barril de petróleo con gota naranja, vertical; úsalo para representar reservas, carga o cantidad simbólica de crudo.', files:['oil-barrel.png'], width:200},
  pumpjack: {summary:'Bomba extractora terrestre con balancín animado; úsala para mostrar extracción de petróleo en un pozo.', files:sequence('pump'), width:260},
  derrick: {summary:'Torre terrestre con perforación animada; úsala para ubicar un pozo o una operación de perforación en tierra.', files:sequence('derrick'), width:240},
  platform: {summary:'Plataforma petrolera marina con grúa animada; úsala para representar extracción o perforación en el mar.', files:sequence('platform'), width:300},
};
const params = {
  scale:{type:'number',default:1,min:.15,max:4,doc:'Tamaño del componente en pantalla.'},
  entrance:{type:'number',default:.6,min:0,max:5,doc:'Duración en segundos de la entrada del componente.'},
  animate:{type:'boolean',default:true,doc:'Activa el movimiento propio del componente cuando está disponible.'},
  period:{type:'number',default:2,min:.5,max:20,doc:'Duración en segundos de un ciclo del mecanismo animado.'},
};
function validate(item) {
  const e=[];
  for (const [key,min,max] of [['scale',.15,4],['entrance',0,5],['period',.5,20]])
    if (item[key]!=null && (!Number.isFinite(item[key]) || item[key]<min || item[key]>max)) e.push(`${key} debe estar entre ${min} y ${max}`);
  if (item.animate!=null && typeof item.animate!=='boolean') e.push('animate debe ser booleano');
  return e;
}
for (const [kind, asset] of Object.entries(assets)) Tactico.component(`oil.${kind}`, {
  layer:30, summary:asset.summary, params, validate,
  async prepare() { return {frames:await Promise.all(asset.files.map(image))}; },
  animated:s=>s.lt<(s.item.entrance??.6)||(asset.files.length>1 && s.item.animate!==false),
  draw(g,s,view,env) {
    const pos=s.pos??s.item.at;
    const p=Array.isArray(pos)?view.project(...pos):pos&&Number.isFinite(pos.lon)?view.project(pos.lon,pos.lat):null;
    if(!p||p.visible===false)return;
    const frames=s.internal?.frames||[];
    const index=asset.files.length>1&&s.item.animate!==false ? ((Math.floor(s.lt/(s.item.period??2)*frames.length)%frames.length)+frames.length)%frames.length : 0;
    const frame=frames[index]; if(!frame)return;
    const k=(s.item.scale??1)*env.U,w=asset.width*k;
    const dur=s.item.entrance??.6,reveal=dur<=0?1:Math.max(0,Math.min(1,s.lt/dur)),y=(1-(1-reveal)**3);
    g.save();g.translate(p.x,p.y+(1-y)*18*k);g.globalAlpha*=y;g.drawImage(frame,-w/2,-w,w,w);g.restore();
  },
  demo:{id:`demo-oil-${kind}`,type:`oil.${kind}`,at:[51,28],scale:1,animate:true,period:2,t:0,dur:8,out:7}
});
