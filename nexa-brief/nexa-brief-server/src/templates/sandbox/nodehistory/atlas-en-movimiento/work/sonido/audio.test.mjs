import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makePlan,collectCues,normalizeCues,speechRanges,duckGain,dbGain,cueGain} from '../../../_tactico/audio-plan.js';
import {timerFromWords} from '../../../_tactico/tools/anchors.js';
import {create,Tactico,loadComponents} from '../../../_tactico/core.js';
const read=async f=>JSON.parse(await readFile(new URL(f,import.meta.url)));
const catalog=await read('../../../_tactico/sfx.json'),scene=await read('./scene-sonido.json'),lyrics=await read('../../assets/lyrics.json');
test('los contratos de FX/unidades y los 14 candidatos tienen archivo, licencia y hash',async()=>{
 const expected=['naval-engine-low','ship-horn','helicopter','jet-pass','bomber-prop','bomber-jet','bomb-whistle','explosion-near','explosion-far','water-impact','missile-pass','torpedo','sonar-ping','industrial-hum','hit-soft','whoosh','riser','ui-tick'];
 for(const id of expected)assert.ok(catalog.sounds.some(s=>s.id===id),id);
 const {createHash}=await import('node:crypto');
 for(const s of catalog.sounds){assert.equal(s.license,'CC0');assert.equal(s.asset_id,'');assert.equal(createHash('sha256').update(await readFile(new URL('../../'+s.file,import.meta.url))).digest('hex'),s.sha256);}
 const units=await read('../../../_tactico/units.json');
 for(const u of Object.values(units.units))if(u.sfx)assert.ok(catalog.sounds.some(s=>s.id===(catalog.aliases[u.sfx]||u.sfx)),u.sfx);
});
test('plan CLI coincide con cues reales del núcleo; sin duplicar explícitas ni sfx:false',async()=>{
 const T=timerFromWords(lyrics.segments.flatMap(s=>s.words));
 const core=await create({T,st:{W:1080,H:1920,U:1},look:{}},scene);
 const direct=await collectCues(scene,{T,lyrics}),derived=core.sfx();
 assert.deepEqual(direct,derived);
 const plan=await makePlan(scene,catalog,{T,lyrics,duration:30});
 const runtime=await makePlan(scene,catalog,{T,lyrics,derived,duration:30});assert.deepEqual(plan,runtime);
 assert.equal(plan.cues.length,7);assert.equal(plan.cues.filter(c=>c.sfx==='jet-pass').length,1);
});
test('anclas, alias, overrides, truncado y errores de datos fallan explícitamente',async()=>{
 const input={duration:10,items:[],sound:{cues:[{sfx:'helicopter-rotor',at:'@rotor:end+0.4',dur:20,gain_db:-14,source_in:1}]}};
 const p=await makePlan(input,catalog,{lyrics:{segments:[{words:[{word:'rotor',start:1,end:2}]}]}});
 assert.equal(p.cues[0].at,2.4);assert.equal(p.cues[0].sfx,'helicopter');assert.equal(p.cues[0].gain_db,-14);assert.ok(p.cues[0].dur<5);
 assert.throws(()=>normalizeCues([{sfx:'unknown',at:0,dur:1}],catalog,10),/desconocido/);
 assert.throws(()=>normalizeCues([{sfx:'whoosh',at:0,dur:1,source_in:99}],catalog,10),/rango/);
 await assert.rejects(makePlan({...input,sound:{cues:[{sfx:'whoosh',at:'@missing',dur:1}]}},catalog),/resolver/);
});
test('ducking -9 dB solo al bus SFX; fades absolutos tras seek y silencios conservados',()=>{
 const ranges=speechRanges({segments:[{words:[{start:1,end:2},{start:2.1,end:3},{start:5,end:6}]}]},10);
 assert.deepEqual(ranges,[[1,3],[5,6]]);
 assert.equal(duckGain(2,ranges),dbGain(-9));assert.equal(duckGain(4,ranges),1);
 const c={at:2,dur:4,fade_in:1,fade_out:1,gain_db:-20};
 assert.equal(cueGain(c,1),0);assert.ok(Math.abs(cueGain(c,2.5)-.05)<1e-8);assert.equal(cueGain(c,4),.1);assert.ok(Math.abs(cueGain(c,5.5)-.05)<1e-8);
});
