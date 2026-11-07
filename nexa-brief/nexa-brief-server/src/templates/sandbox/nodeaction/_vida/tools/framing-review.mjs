import {createCanvas} from '@napi-rs/canvas';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadEpisode,ROOT} from './runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {renderFrame} from '../engine/render.js';
import {compositionAt} from '../engine/core/composition.js';
const source=await loadEpisode(join(ROOT,'../vida-en-escena/assets/episode.json'));
const sheet=createCanvas(3*280,3*530),ctx=sheet.getContext('2d'),canvas=createCanvas(270,480),records=[];
ctx.fillStyle='#f0ece3';ctx.fillRect(0,0,sheet.width,sheet.height);
for(const [row,height]of [400,560,700].entries())for(const [col,type]of ['two','medium','close'].entries()){
 const catalog=structuredClone(source.catalog),set=catalog.sets['escuela-entrada'];set.charHeight=height;set.props=[];
 set.anchors.a={x:768-height*.2,y:960,kind:'stand',facing:'front'};set.anchors.b={x:768+height*.2,y:960,kind:'stand',facing:'front'};
 const episode={version:1,id:'escala',scenes:[{set:set.id,actors:{tomas:{at:'a'},nico:{character:'tomas',at:'b'}},steps:[{say:'L02'}],camera:[{type,target:type==='two'?undefined:'tomas',targets:type==='two'?['tomas','nico']:undefined,locked:true}]}]};
 const c={...compile(episode,source.timing,catalog),resources:source.resources},state=renderFrame(canvas.getContext('2d'),c,.3),result=compositionAt(state,state.camera);
 const ratio=result.subjects.find(s=>s.actor==='tomas').ratio;records.push({charHeight:height,shot:type,ratio,minimum:result.subjects[0].minimum,empty_floor:result.emptyFloor.ratio});
 ctx.drawImage(canvas,col*280+5,row*530+5);ctx.fillStyle='#26363b';ctx.font='17px sans-serif';ctx.fillText(`${type} · charHeight ${height}`,col*280+8,row*530+507);ctx.fillText(`${(100*ratio).toFixed(2)}% ${type==='close'?'cara':'sujeto'}`,col*280+8,row*530+526);
}
const scaleVariation=Object.fromEntries(['two','medium','close'].map(type=>{const values=records.filter(r=>r.shot===type).map(r=>r.ratio);return [type,Math.max(...values)/Math.min(...values)-1];}));
const report={scene:'Mismo episodio anclado; posiciones relativas en alturas de personaje, subtítulos activos.',records,relative_variation:scaleVariation,passed:Object.values(scaleVariation).every(v=>v<=.05)&&records.every(r=>r.ratio>=r.minimum&&r.empty_floor<=.22)};
await writeFile(join(ROOT,'review/framing-scales.jpg'),await sheet.encode('jpeg',94));await writeFile(join(ROOT,'../vida-en-escena/work/results/vida-encuadre-escalas.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
