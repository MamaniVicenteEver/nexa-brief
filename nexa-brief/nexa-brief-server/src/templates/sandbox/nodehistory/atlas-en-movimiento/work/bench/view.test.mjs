import test from 'node:test';
import assert from 'node:assert/strict';
import {createView,mercator,transform,tileLevels,visibleTiles,multiply,shutterView} from '../../../_atlas/plano/view.js';
import {blurSettings,sampleTimes} from '../../../_atlas/plano/blur.js';
import {ancestor} from '../../../_atlas/plano/tiles.js';
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
test('Mercator coincide con el mundo de 512px y rota alrededor del centro',()=>{
  for(const bearing of [0,35,-90,179]){
    const v=createView({lon:56.5,lat:26.55,zoom:7,bearing,pitch:75},1080,1920);
    const p=v.project(56.5,26.55);near(p.x,540);near(p.y,960);assert.equal(v.pitch,0);
    const m=mercator(60,30),q=transform(v.mercatorToScreen,...m),r=transform(v.screenToMercator,q.x,q.y);
    near(r.x,m[0]);near(r.y,m[1]);
  }
  const v=createView({lon:0,lat:0,zoom:0,bearing:0},512,512);
  near(v.project(180,0).x,512);near(v.project(-180,0).x,0);
});
test('mips: mezcla continua al cruzar enteros y saturación en maxzoom',()=>{
  for(const z of [2,3,4,5,6,7]){
    const before=tileLevels(z-1e-8),after=tileLevels(z);
    assert.equal(before.high,after.low);near(before.alpha,1);near(after.alpha,0);
  }
  assert.equal(tileLevels(3.74).alpha,0);assert.ok(tileLevels(3.9).alpha>0);
  assert.deepEqual(tileLevels(12),{low:8,high:8,alpha:0});
});
test('cobertura de las cuatro esquinas con giro y límites polares',()=>{
  const view=createView({lon:56,lat:26,zoom:5.2,bearing:35},1080,1920);
  const tiles=visibleTiles(view,6),keys=new Set(tiles.map(t=>t.key));
  for(const [x,y] of [[0,0],[1080,0],[1080,1920],[0,1920]]){
    const p=transform(view.screenToMercator,x,y);assert.ok(keys.has(`6/${Math.floor(p.x*64)}/${Math.floor(p.y*64)}`));
  }
  assert.ok(visibleTiles(createView({lon:0,lat:85,zoom:0},1080,1920),0).every(t=>t.x===0&&t.y===0));
});
test('fallback usa el recorte correcto del ancestro más cercano',()=>{
  const image={width:256,height:256};const images=new Map([['2/1/1',image]]);
  const value=ancestor({z:4,x:7,y:6},images);
  assert.deepEqual(value,{image,z:2,sx:192,sy:128,sw:64,sh:64});
  assert.equal(ancestor({z:1,x:0,y:0},images),null);
});
test('shutter puro; sin muestras extra en reposo y sin depender del orden',()=>{
  const camera={at:t=>({lon:t<1?0:30*(t-1),lat:0,zoom:4,bearing:0})},settings=blurSettings();
  assert.equal(sampleTimes(camera,.5,1080,1920,settings).times.length,1);
  const before=sampleTimes(camera,2,1080,1920,settings);
  assert.equal(before.times.length,4);assert.equal(before.times.at(-1),2);
  sampleTimes(camera,10,1080,1920,settings);assert.deepEqual(sampleTimes(camera,2,1080,1920,settings),before);
  assert.equal(sampleTimes(camera,2,1080,1920,blurSettings(false)).times.length,1);
});
test('el bitmap del shutter cubre cada esquina incluso con giro y zoom combinados',()=>{
  for(const [W,H] of [[1080,1920],[1920,1080]]){
    const views=[0,.33,.67,1].map(t=>createView({lon:50+t,lat:27+t*.1,zoom:6+t*.09,bearing:35-t*5},W,H));
    const padded=shutterView(views);
    near(padded.unit,1);near(padded.scale,views.at(-1).scale);
    for(const view of views){
      const matrix=multiply(padded.mercatorToScreen,view.screenToMercator);
      for(const [x,y] of [[0,0],[W,0],[W,H],[0,H]]){
        const p=transform(matrix,x,y);
        assert.ok(p.x>=1&&p.x<=padded.W-1&&p.y>=1&&p.y<=padded.H-1);
        const roundtrip=transform(multiply(view.mercatorToScreen,padded.screenToMercator),p.x,p.y);
        near(roundtrip.x,x);near(roundtrip.y,y);
      }
    }
  }
});
test('la matriz afín conserva coordenadas geográficas y escala de los componentes',()=>{
  const views=[{lon:170,lat:70,zoom:3.9,bearing:179},{lon:172,lat:72,zoom:4.1,bearing:181}].map(p=>createView(p,1080,1920));
  const source=shutterView(views);
  for(const v of views)for(const [lon,lat] of [[172,72],[180,80],[-180,0],[0,-85]]){
    const p=source.project(lon,lat),q=transform(multiply(v.mercatorToScreen,source.screenToMercator),p.x,p.y),want=v.project(lon,lat);
    near(q.x,want.x);near(q.y,want.y);near(p.k,views.at(-1).project(lon,lat).k);
  }
});
test('exact y affine usan las mismas muestras y el mismo umbral en píxeles',()=>{
  const camera={at:t=>({lon:t*20,lat:30,zoom:5+t*.02,bearing:t})};
  assert.equal(blurSettings({mode:'exact'}).mode,'exact');
  assert.equal(blurSettings({mode:'affine'}).mode,'affine');
  assert.equal(blurSettings().mode,'affine');
  assert.equal(blurSettings({mode:'desconocido'}).mode,'exact');
  assert.deepEqual(sampleTimes(camera,2,1080,1920,blurSettings({mode:'affine'})),sampleTimes(camera,2,1080,1920,blurSettings({mode:'exact'})));
});
