import {writeFile} from 'node:fs/promises';
import '../../../_tactico/components/territory.js';
import '../../../_tactico/components/routes.js';
import {Tactico} from '../../../_tactico/core.js';
const files={territory:['territory.','flag.'],routes:['front.','range.','arrow.','route.'],labels:['label.','text.','badge.','icon.']};
const palette={text:'#f4f1da',dark:'#081e2c',accent:'#f5d86f',success:'#399e58',cyan:'#5be1e8',danger:'#ee695d'};
const base={format:'atlas-v1',duration:6,lang:'es',planoLook:'tactico',intro:false,outro:false,captions:{enabled:false},tiles:{provider:'gibs-bluemarble',manifest:'../bench/cache-inventory.json'},motionBlur:false,defs:{palette,fonts:{display:'AtlasDisplay'}},camera:[{t:0,center:[52.5,29],zoom:5.1}],places:{Ormuz:[56.4,26.5],Bagdad:[44.36,33.31],Teheran:[51.39,35.69],Mascate:[58.41,23.59]},layers:[]};
const items=[
 {id:'iran-fill',type:'territory.flag',region:'IR',flag:'IR',flagMode:'fill',t:0,dur:11.5,out:11},
 {id:'iraq-marker',type:'territory.flag',region:'IQ',flag:'IQ',flagMode:'marker',t:0,dur:11.5,out:11},
 {id:'kuwait-both',type:'territory.flag',region:'KW',flag:'KW',flagMode:'both',t:0,dur:11.5,out:11},
 {id:'oman-none',type:'territory.flag',region:'OM',flag:'OM',flagMode:'none',t:0,dur:11.5,out:11},
 {id:'oman-base',type:'territory.fill',region:'OM',color:'cyan',opacity:.4,t:0,dur:11.5,out:11},
 {id:'modes-title',type:'label.chip',text:'BANDERAS · CUATRO MODOS',screen:[.5,.12],size:34,width:900,t:0,dur:11.5,out:11},
 ...[['IRÁN · fill',[55,34]],['IRAK · marker',[45.2,33]],['KUWAIT · both',[48,28]],['OMÁN · none',[57,21.2]]].map(([text,at],n)=>({id:`mode-label-${n}`,type:'label.chip',text,at,width:400,size:28,t:0,dur:11.5,out:11})),
 {id:'demo-notice',type:'label.chip',text:'DEMOSTRACIÓN GRÁFICA · ESTADOS Y CONTADORES SINTÉTICOS',screen:[.5,.76],size:22,width:980,t:0,dur:200,out:199}
];
const manifest=[];
let cursor=12;
for(const [family,prefixes] of Object.entries(files)) {
 const definitions=Tactico.list().filter(d=>prefixes.some(p=>d.name.startsWith(p)));
 const gallery=[];
 for(const [n,d] of definitions.entries()) {
  const item={...structuredClone(d.demo),id:`demo-${family}-${n}`};
  gallery.push(item);
  const full={...item,t:cursor,out:cursor+5.5};
  if(full.states)full.states=full.states.map(k=>({...k,at:k.at+cursor}));
  items.push(full,{id:`title-${family}-${n}`,type:'label.chip',text:d.name,screen:[.5,.12],size:30,width:900,t:cursor,dur:6,out:cursor+5.5});
  manifest.push({name:d.name,family,item,sceneTime:cursor,times:[.15,2.4,5.65]});
  cursor+=6;
 }
 await writeFile(new URL(`./items-${family}.json`,import.meta.url),JSON.stringify({...base,duration:definitions.length*6,items:definitions.flatMap((d,n)=>{const i={...structuredClone(d.demo),id:`gallery-${family}-${n}`,t:n*6,out:n*6+5.5};if(i.states)i.states=i.states.map(k=>({...k,at:k.at+n*6}));return [i];})},null,2)+'\n');
}
items.find(i=>i.id==='demo-notice').dur=cursor;items.find(i=>i.id==='demo-notice').out=cursor-.5;
await writeFile(new URL('./scene-territorios.json',import.meta.url),JSON.stringify({...base,duration:cursor,items},null,2)+'\n');
await writeFile(new URL('./cases-territorios.json',import.meta.url),JSON.stringify({base,components:manifest},null,2)+'\n');
console.log(`${manifest.length} componentes; escena de ${cursor} s`);
