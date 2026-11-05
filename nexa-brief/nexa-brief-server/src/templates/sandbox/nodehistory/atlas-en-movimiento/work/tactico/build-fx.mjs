// Datos de demostración; no modifica el núcleo ni el catálogo compartido.
import {writeFile} from 'node:fs/promises';
import {Tactico} from '../../../_tactico/core.js';
import '../../../_tactico/components/fx.js';
import '../../../_tactico/components/strike.js';

const palette={background:'#081e2c',shadow:'#081e2c',smoke:'#18262d',smokeLight:'#e9e3ba',fire:'#ed7334',flash:'#f6edb4',foam:'#f4f5ea',text:'#f4f5ea',missile:'#d1495b',danger:'#d1495b',water:'#42bfd0'};
const support={id:'fx-demo-aircraft',type:'debug.dot',r:7,at:[51.5,27],t:0,dur:8,fade:0,
  path:{via:[[51.5,27],[53,28.6],[55,28.5]],t:0,dur:6,curve:'smooth'}};
const cases=[];
for(const def of Tactico.list()){
  if(!/^(fx\.|strike\.|trail\.)/.test(def.name))continue;
  const item={...structuredClone(def.demo),fade:0};
  if(def.name==='trail.contrail')item.follow=support.id;
  if(def.name==='fx.smoke')item.emitFor=5;
  let times=[.12,item.dur*.38,item.dur*.91];
  if(def.name.startsWith('strike.'))times=[.12,item.flightDur*.7,item.flightDur+(def.name==='strike.salvo'?.8:.4)];
  if(def.name==='trail.contrail')times=[.3,3.8,7.6];
  cases.push({id:def.name,item,times,...(def.name==='trail.contrail'?{support:[support]}:{})});
}
for(const [type,variant] of [['fx.explosion','air'],['fx.explosion','naval'],['fx.impact','water'],['fx.shockwave','water'],['fx.smoke','trail'],['fx.ring','target'],['fx.ring','detection']]){
  const base=structuredClone(cases.find(c=>c.id===type));base.id=`${type}-${variant}`;base.item.id=base.id.replaceAll('.','-');base.item.variant=variant;cases.push(base);
}
const scene={format:'atlas-v1',duration:cases.length*10,planoLook:'tactico',lang:'es',
  places:{Golfo:[54,27]},defs:{palette},
  camera:[{t:0,center:[53.5,27.7],zoom:6.3,bearing:0}],items:[],
  note:'Galería E: cada caso ocupa diez segundos. El punto debug.dot es el soporte de path para follow; no requiere sprites externos.'};
for(const [index,entry] of cases.entries()){
  const offset=index*10,item=structuredClone(entry.item);item.t=offset;
  if(item.path)item.path.t=(item.path.t||0)+offset;
  item.id=`demo-${index}-${item.id}`;
  for(const source of entry.support||[]){const s=structuredClone(source);s.t+=offset;s.path.t+=offset;s.id+=`-${index}`;scene.items.push(s);item.follow=s.id;}
  scene.items.push(item);
}
await writeFile(new URL('cases-fx.json',import.meta.url),JSON.stringify(cases,null,2)+'\n');
await writeFile(new URL('scene-fx.json',import.meta.url),JSON.stringify(scene,null,2)+'\n');
console.log(`${cases.length} casos → scene-fx.json y cases-fx.json`);
