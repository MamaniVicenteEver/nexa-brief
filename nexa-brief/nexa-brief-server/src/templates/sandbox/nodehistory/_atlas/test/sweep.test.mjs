import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sweepFrames} from '../sweep.js';
import {createCamera} from '../camera.js';

test('evalúa las 1544 muestras y todo el progreso aunque solo prepare un reposo',async()=>{
  const times=[],prepared=[],progress=[],stats={};let clock=0;
  const returned=await sweepFrames({end:385.6,step:.25,stats,now:()=>++clock,
    evaluate:t=>{times.push(t);return [{lon:0,lat:20,zoom:2,pitch:30,bearing:0,lift:0},{projection:'globe'},1920,1080];},
    prepare:async t=>prepared.push(t),progress:p=>progress.push(p)});
  assert.equal(returned,stats);assert.equal(times.length,1544);assert.equal(times.at(-1),385.6);
  assert.deepEqual(prepared,[0]);assert.equal(progress.length,1544);assert.equal(progress.at(-1),1);
  assert.deepEqual([stats.total,stats.sampled,stats.prepared,stats.skipped],[1544,1544,1,1543]);
  assert.equal(stats.running,false);assert.equal(stats.cancelled,false);assert.equal(stats.error,null);assert.ok(stats.elapsedMs>0);
});

test('cámara real sin deriva conserva exactamente todos los estados de cobertura de la cuadrícula',async()=>{
  const camera=createCamera([{t:0,center:[0,20],zoom:2},{t:2,center:[20,30],zoom:3,dur:2,arc:0},{t:8,center:[-10,15],zoom:2.5,dur:2,arc:0}]);
  const baseline=[],prepared=[],stats={};
  await sweepFrames({end:12,step:.25,stats,evaluate:t=>{
    const state=[camera.at(t),{projection:'mercator',dem:'land',sat:{visible:true,detail:null}},1920,1080];baseline.push(JSON.stringify(state));return state;
  },prepare:async(t,state)=>prepared.push({t,signature:JSON.stringify(state)})});
  assert.equal(stats.sampled,49);assert.equal(stats.prepared,17);assert.equal(stats.skipped,32);
  assert.deepEqual([...new Set(prepared.map(v=>v.signature))].sort(),[...new Set(baseline)].sort());
  assert.deepEqual(prepared.map(v=>v.t),[0,2.25,2.5,2.75,3,3.25,3.5,3.75,4,8.25,8.5,8.75,9,9.25,9.5,9.75,10]);
});

test('look completo detecta DEM, proyección, proveedor, etiquetas, terreno y pintura',async()=>{
  const prepared=[],stats={};
  await sweepFrames({end:8,step:.25,stats,evaluate:t=>[{lon:0,lat:0,zoom:2},
    {dem:t<1?'land':'raw',projection:t<2?'mercator':'globe',sat:{detail:t<3?null:'usgs-imagery'},labels:{visible:t>=4},base:{political:t>=5},terrain:{exaggeration:t<6?1:2},highlight:{fill:t<7?'#fff':'#f00'}},1920,1080],
    prepare:async t=>prepared.push(t)});
  assert.deepEqual(prepared,[0,1,2,3,4,5,6,7]);assert.equal(stats.sampled,33);assert.equal(stats.skipped,25);
});

test('no redondea cambios diminutos ni reutiliza una pose después de visitar otra',async()=>{
  const prepared=[];
  await sweepFrames({end:1,step:.25,evaluate:t=>[{lon:t*1e-13,zoom:2},{}],prepare:async t=>prepared.push(t)});
  assert.deepEqual(prepared,[0,.25,.5,.75,1]);
  prepared.length=0;
  await sweepFrames({end:3,step:1,evaluate:t=>[{lon:t===1?1:0,zoom:2},{},t<3?800:1600,600],prepare:async t=>prepared.push(t)});
  assert.deepEqual(prepared,[0,1,2,3]); // A → B → A y luego un resize requieren preparación.
});

test('espera cada preparación antes de avanzar o notificar progreso',async()=>{
  const calls=[];let active=0;
  await sweepFrames({end:2,step:1,evaluate:t=>[t],prepare:async t=>{
    assert.equal(active++,0);calls.push('begin'+t);await Promise.resolve();calls.push('end'+t);active--;
  },progress:p=>{assert.equal(active,0);calls.push('progress'+p);}});
  assert.deepEqual(calls,['begin0','end0','progress'+1/3,'begin1','end1','progress'+2/3,'begin2','end2','progress1']);
});

test('cancelación conserva estadísticas parciales y no evalúa el resto',async()=>{
  let current=true;const times=[],stats={};
  await sweepFrames({end:10,step:1,stats,isCurrent:()=>current,evaluate:t=>{times.push(t);return ['reposo'];},prepare:async()=>{},progress:p=>{if(p===2/11)current=false;}});
  assert.deepEqual(times,[0,1]);assert.equal(stats.cancelled,true);assert.equal(stats.running,false);
  assert.deepEqual([stats.total,stats.sampled,stats.prepared,stats.skipped],[11,2,1,1]);
});

test('no oculta errores de preparación ni convierte un timeout ya registrado en éxito',async()=>{
  const error=new Error('tesela ausente'),stats={};let progress=0;
  await assert.rejects(sweepFrames({end:2,stats,evaluate:()=>[0],prepare:async()=>{throw error;},progress:()=>progress++}),e=>e===error);
  assert.equal(stats.error,'tesela ausente');assert.equal(stats.running,false);assert.equal(progress,0);
  const missing=new Set(),timedStats={};
  await sweepFrames({end:1,step:.25,stats:timedStats,evaluate:()=>[0],prepare:async t=>{missing.add(`timeout at ${t.toFixed(2)}s`);}});
  assert.deepEqual([...missing],['timeout at 0.00s']);assert.equal(timedStats.prepared,1);assert.equal(timedStats.skipped,4);
});

test('conserva extremos y rechaza pasos o duraciones no finitos',async()=>{
  const times=[];
  await sweepFrames({end:.6,step:.25,evaluate:t=>[t],prepare:async t=>times.push(t)});
  assert.deepEqual(times,[0,.25,.5,.6]);
  for(const step of [0,-1,Infinity,NaN])await assert.rejects(sweepFrames({end:1,step}),/step/);
  for(const end of [-1,Infinity,NaN])await assert.rejects(sweepFrames({end}),/end/);
});
