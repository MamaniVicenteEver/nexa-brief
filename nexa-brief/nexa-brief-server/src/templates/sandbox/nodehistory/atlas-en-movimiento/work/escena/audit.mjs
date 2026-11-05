import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {timerFromWords} from '../../../_tactico/tools/anchors.js';
import {makePlan} from '../../../_tactico/audio-plan.js';
import {pathAt} from '../../../_tactico/util.js';
import {landIndex,seaCrossings} from '../../../_tactico/tools/geometry.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const scene=read('assets/scene.json'),lyrics=read('assets/lyrics.json'),anchors=read('work/escena/anclas-resueltas.json').anchors,T=timerFromWords(lyrics.segments.flatMap(s=>s.words||[])),mix=read('assets/mix.plan.json'),byId=id=>scene.items.find(i=>i.id===id);
const checks=[];function check(name,fn){try{fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.message});}}
const values=[],references=[];
function walk(x,path='scene'){if(typeof x==='string'&&x.startsWith('@')){values.push(x);references.push({path,value:x,time:T(x,NaN)});}else if(Array.isArray(x))x.forEach((v,i)=>walk(v,`${path}[${i}]`));else if(x&&typeof x==='object')Object.entries(x).forEach(([k,v])=>walk(v,`${path}.${k}`));}
walk(scene);
check('54 anclas reales usadas y resueltas sin fallback',()=>{assert.equal(anchors.length,54);for(const a of anchors){assert.equal(T(a.ref,NaN),a.start);assert(values.some(v=>v.replace(/([+-]\d+(?:\.\d+)?)$/,'')===a.ref),a.id);}assert(references.every(r=>Number.isFinite(r.time)));});
check('7 bloques contiguos: 0–262.84',()=>{assert.equal(scene.blocks.length,7);assert.equal(scene.blocks[0].scene_start,0);for(let n=1;n<7;n++)assert.equal(scene.blocks[n-1].scene_end,scene.blocks[n].scene_start);assert.equal(scene.blocks.at(-1).scene_end,262.84);assert.equal(scene.end,262.84);assert.equal(scene.fps,30);});
check('Supervivientes y hundimientos históricos',()=>{for(const id of ['bridgeton','stark','sabalan','roberts']){assert(byId(id).states.some(s=>s.state==='hit'));assert(!byId(id).states.some(s=>s.state==='sunk'),id);}for(const id of ['sahand','joshan'])assert.deepEqual(byId(id).states.map(s=>s.state),['hit','burning','sunk']);assert.equal(byId('sabalan').path,undefined);assert.equal(byId('sabalan').wake,false);});
const mina=pathAt(byId('bridgeton').path,T('@mina'));
check('Bridgeton en coordenada publicada al ancla de mina',()=>{assert(Math.hypot(mina.lon-scene.places.Farsi[0],mina.lat-scene.places.Farsi[1])<.0001);assert.equal(byId('bridgeton-us').flag,'US');assert.equal(byId('escoltas-inicio').units.length,3);});
check('Dos mercantes con cambio de bandera explícito',()=>{for(const id of ['bridgeton-julio','gas-prince']){assert.equal(byId(id+'-flag-kw').flag,'KW');assert.equal(byId(id+'-flag-us').flag,'US');assert.equal(T(byId(id+'-flag-us').t),137.83);}});
check('Iran Ajr: 1 observador y 2 atacantes desde Jarrett',()=>{const helis=scene.items.filter(i=>i.type==='air.helicopter');assert.equal(helis.length,3);assert(helis.every(i=>i.at==='jarrett'));assert.equal(byId('ajr-foto').src,'assets/media/A05.png');assert(byId('ajr-foto').date.includes('22 sep 1987'));});
check('Enterprise fuera del Golfo; cubierta, escoltas y A-6',()=>{const e=byId('enterprise');assert.equal(e.variant,'supercarrier');assert(e.path.via.every(p=>p[0]>58.5&&p[1]<25));assert.equal(e.escorts.units.length,3);assert.equal(byId('salida-intruder').unit,'air.jet:a6');assert.equal(T(byId('salida-intruder').t),194.05);});
check('Stark: exactamente 2 Exocet y A01 acreditada',()=>{assert.equal(scene.items.filter(i=>i.id.startsWith('stark-exocet-')).length,2);assert.equal(byId('stark-documento').docSrc,'assets/media/A01.png');assert(byId('stark-documento').docCredit.includes('U.S. Navy'));});
check('Resolución A09 y tratamiento civil sin FX ni cues',()=>{assert.equal(byId('resolucion-598').docSrc,'assets/media/A09.png');assert(byId('resolucion-598').date.includes('20 jul 1987'));const civil=scene.items.filter(i=>T(i.t)<236.63&&T(i.out)+i.fade>225.87);assert(!civil.some(i=>/^(fx\.|strike\.|naval\.|air\.)/.test(i.type)));assert(!mix.cues.some(c=>c.at<236.63&&c.at+c.dur>225.87));assert.equal(byId('victimas-civiles').text,'290 personas murieron');});
check('Bandera: un fill, otro marker; frentes rotulados',()=>{assert.equal(byId('iran-bandera').flagMode,'fill');assert.equal(byId('iraq-bandera').flagMode,'marker');assert(byId('frente-aprox').text.includes('aproximado'));});
check('Intro ≤6 s; cierre exactamente últimos 8 s',()=>{assert.equal(byId('intro').t,0);assert(byId('intro').dur<=6);assert.equal(byId('cierre').t,254.84);assert.equal(byId('cierre').dur,8);assert.equal(byId('cierre').out,262.84);});
check('Audio final: duración, LUFS, pico y silencio del cierre',()=>{assert.equal(mix.verification.decoded_duration,262.84);assert(Math.abs(mix.verification.integrated_lufs+16)<.5);assert(mix.verification.true_peak_dbtp<=-1);assert(mix.cues.every(c=>c.at+c.dur<215.67));});
const land=landIndex(read('../_atlas/data/geo/admin0.geojson')),sea=[];
function location(i,seen=new Set()){if(Array.isArray(i))return i;if(typeof i==='string'){if(seen.has(i))return null;seen.add(i);return scene.places[i]||location(byId(i)?.at,seen);}return null;}
for(const i of scene.items.filter(i=>i.type.startsWith('naval.'))){const p=i.path?.via?.[0]||location(i.at);if(!p)continue;const crossings=seaCrossings(i.path?{...i.path,t:T(i.path.t),dur:T(i.path.dur)}:{via:[p,[p[0]+.000001,p[1]]],t:0,dur:1},land);sea.push({id:i.id,crossings});}
check('Rutas y posiciones de unidades navales sobre agua',()=>assert(sea.every(r=>!r.crossings.length),JSON.stringify(sea.filter(r=>r.crossings.length))));
const expected=read('work/escena/protegidos.sha256.json'),changed=Object.entries(expected).filter(([p])=>p.startsWith('engine/')).filter(([p,h])=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==h).map(([p])=>p);
check('Motor original engine/ conservado sin modificaciones',()=>assert.deepEqual(changed,[]));
const currentPlan=await makePlan(scene,read('../_tactico/sfx.json'),{lyrics,duration:scene.duration});
check('Mezcla corresponde a cues de la escena final',()=>assert.deepEqual(currentPlan.cues,mix.cues));
const report={ok:checks.every(x=>x.pass),checks,anchorCount:54,timedReferences:references,navalWater:sea,bridgetonImpact:{actual:[mina.lon,mina.lat],source:scene.places.Farsi},mix:mix.verification};
fs.writeFileSync('work/escena/auditoria.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:checks.length,failures:checks.filter(x=>!x.pass)},null,2));if(!report.ok)process.exitCode=1;
