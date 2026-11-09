// Auditoría estática de texto por ranuras: ¿dos textos de la misma ranura coinciden en el tiempo? ¿hay zonas que chocan?
// Uso: node work/escena/estilo-audit.mjs   (desde la carpeta del prototipo)
import {readFile} from 'node:fs/promises';
import {timerFromWords} from '../../engine/tactico/tools/anchors.js';
const scene=JSON.parse(await readFile(new URL('../../assets/scene.json',import.meta.url)));
const lyrics=JSON.parse(await readFile(new URL('../../assets/lyrics.json',import.meta.url)));
const words=(lyrics.segments||[]).flatMap(s=>s.words||[]);
const T=timerFromWords(words);
const SLOT={'header.date':'encabezado','statement.title':i=>i.slot==='nota'?'nota':'titular','statement.jump':'titular','year.big':'anio','legend.front':'leyenda','label.country':i=>'pais:'+i.text,'portrait.pair':'fichas','portrait.card':'fichas','editorial.press':'documento','callout.photo':'documento','document.clip':'documento'};
// ranuras que comparten espacio vertical en 9:16
const GROUP={encabezado:'A',titular:'B',anio:'B',nota:'C',leyenda:'D',fichas:'E',documento:'E'};
const rows=[];
for(const i of scene.items){const s=SLOT[i.type];if(!s)continue;const slot=typeof s==='function'?s(i):s;const t0=T(i.t,0),t1=i.out!=null?T(i.out,t0+i.dur):t0+(i.dur??5);rows.push({id:i.id,slot,g:GROUP[slot]||slot,t0,t1,text:i.text||i.fecha||''});}
let bad=0;
for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){const x=rows[a],y=rows[b];if(x.g!==y.g)continue;const o=Math.min(x.t1,y.t1)-Math.max(x.t0,y.t0);if(o>.35){bad++;console.log(`CHOQUE ${x.g}: ${x.id} [${x.t0.toFixed(1)}-${x.t1.toFixed(1)}] x ${y.id} [${y.t0.toFixed(1)}-${y.t1.toFixed(1)}] solape ${o.toFixed(1)} s`);}}
// zonas distintas que se pisan: titular con nota y con año
const zones={B:'titular/año',C:'nota'};
console.log(`${rows.length} textos de ranura, ${bad} choques en la misma ranura`);
