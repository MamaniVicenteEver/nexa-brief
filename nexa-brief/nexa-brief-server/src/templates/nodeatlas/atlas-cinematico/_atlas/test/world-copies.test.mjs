import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {nearestLongitude} from '../projection.js';

const source=fs.readFileSync(new URL('../atlas.js',import.meta.url),'utf8');
const viewSource=source.slice(source.indexOf('function view(c,pose)'),source.indexOf('async function waitTiles'));
const makeView=vm.runInNewContext(viewSource+';view',{nearestLongitude,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),maplibre:{LngLat:class {constructor(lon,lat){this.lng=lon;this.lat=lat;}}}});

test('nearestLongitude elige copia adyacente a±180 y conserva alias del mismo punto',()=>{
  assert.equal(nearestLongitude(-175,179),185);assert.equal(nearestLongitude(175,-179),-185);
  for(const lon of [-185,175,535])assert.equal(nearestLongitude(lon,-179),-185);
  for(let lon=-1000;lon<=1000;lon+=17)for(const reference of [-179,0,179])assert.ok(Math.abs(nearestLongitude(lon,reference)-reference)<=180);
});

function project({worldCopies,projection='mercator',transitionState=0,reference=179,occluded=false}={}) {
  const requested=[],map={project:([lon,lat])=>(requested.push([lon,lat]),{x:lon*10,y:lat*10}),getProjection:()=>({type:projection}),style:{projection:{transitionState}},
    _camera:{transform:{isLocationOccluded:()=>occluded}}};
  return {view:makeView({map,scene:{worldCopies},st:{W:1920,H:1080}},{lon:reference,lat:0,zoom:3,pitch:60,bearing:0}),requested};
}

test('view proyecta ancla y escala en la copia cercana solo en Mercator opt-in',()=>{
  const enabled=project({worldCopies:true});const p=enabled.view.project(-175,0);assert.equal(p.x,1850);assert.ok(p.visible);assert.ok(Math.abs(p.k-1)<1e-8);
  assert.ok(enabled.requested.some(([lon])=>Math.abs(lon-185.001)<1e-8),'diferencial local en la misma copia');
  assert.equal(project({worldCopies:true,reference:-179}).view.project(175,0).x,-1850);
  for(const worldCopies of [undefined,false,'true'])assert.equal(project({worldCopies}).view.project(-175,0).x,-1750);
  assert.equal(project({worldCopies:true}).view.project(-100,0).x,2600,'ancla EEUU durante vuelo por el Pacífico');
});

test('globo y mezcla parcial conservan longitud y oclusión; expresión en Mercator completo envuelve',()=>{
  const expression=['interpolate',['linear'],['zoom'],1,'vertical-perspective',3,'mercator'];
  for(const opts of [{projection:'globe',transitionState:1},{projection:expression,transitionState:.5}]){
    const p=project({...opts,worldCopies:true,occluded:true}).view.project(-175,0);assert.equal(p.x,-1750);assert.equal(p.visible,false);
  }
  assert.equal(project({worldCopies:true,projection:expression,transitionState:0}).view.project(-175,0).x,1850);
});
