import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createFlagFills, flagFillOpacity, flagFillRegion, flagTexturePlan, paintFlagTexture} from '../flag-fill.js';
import {createGeo} from '../geo.js';
import {ATLAS, checkEpisode} from '../validate.mjs';

const ring = (west, south, east, north) => [[west,north],[east,north],[east,south],[west,south],[west,north]];
const geometry = {type:'MultiPolygon',coordinates:[[ring(170,-20,-170,20),ring(175,-10,-175,10)],[ring(-150,-4,-145,4)]]};
const image = {width:1900,height:1000};
const yMercator = lat => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;

function canvas() {
  let current, paths = [];
  const calls = [], paints = [];
  const context = {
    save() {}, restore() {}, beginPath() { paths = []; },
    moveTo(x,y) { current = [[x,y]]; paths.push(current); },
    lineTo(x,y) { current.push([x,y]); }, closePath() {},
    clip(rule) { calls.push(['clip',rule,structuredClone(paths)]); },
    drawImage(...args) { calls.push(['drawImage',...args]); paints.push({args,paths:structuredClone(paths)}); }
  };
  return {getContext:()=>context,calls,paints};
}

// Reconstruye de forma independiente el UV y la cobertura de cada drawImage recortado.
function sampleAt(cv, part, lon, lat) {
  const west=part.coordinates[0][0],east=part.coordinates[1][0];
  if(lon<west||lon>east)return null;
  const x=(lon-west)/(east-west)*cv.width,y=(yMercator(lat)-part.y0)/(part.y1-part.y0)*cv.height;
  if(y<0||y>cv.height)return null;
  for(const paint of [...cv.paints].reverse()) {
    let inside=false;
    for(const ring of paint.paths)for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    const [,dx,dy,width,height]=paint.args,u=(x-dx)/width,v=(y-dy)/height;
    if(inside&&u>=0&&u<=1&&v>=0&&v<=1)return {u,v};
  }
  return null;
}

test('landmass ajusta dos masas separadas dentro del mismo canvas y conserva sus huecos',()=>{
  const shape={type:'MultiPolygon',coordinates:[[ring(-60,0,-50,10),ring(-57,4,-53,6)],[ring(40,0,50,10),ring(43,4,47,6)]]};
  const plan=flagTexturePlan(shape),part=plan.parts[0],fitted=paintFlagTexture(canvas(),image,plan,part,'landmass');
  assert.equal(plan.parts.length,1);assert.equal(fitted.paints.length,2);
  for(const west of [-60,40]) {
    for(const fraction of [.1,.5,.9])assert.ok(Math.abs(sampleAt(fitted,part,west+10*fraction,2).u-fraction)<1e-10);
    assert.equal(sampleAt(fitted,part,west+5,5),null);
  }
  assert.equal(sampleAt(fitted,part,0,5),null);
  assert.equal(sampleAt(fitted,part,-59,11),null);
  assert.ok(fitted.calls.filter(c=>c[0]==='clip').every(c=>c[1]==='evenodd'&&c[2].length===2));
  const omitted=paintFlagTexture(canvas(),image,plan,part),explicit=paintFlagTexture(canvas(),image,plan,part,'global');
  assert.deepEqual(omitted.calls,explicit.calls);assert.equal(omitted.paints.length,1);
  assert.ok(sampleAt(omitted,part,-59,2).u<.1);assert.ok(sampleAt(omitted,part,49,2).u>.9);
  assert.equal(fitted.width,omitted.width);assert.equal(fitted.height,omitted.height);
});

test('landmass conserva UV al cruzar antimeridiano y no pinta huecos ni mar',()=>{
  const plan=flagTexturePlan(geometry),canvases=plan.parts.map(p=>paintFlagTexture(canvas(),image,plan,p,'landmass'));
  const sample=(lon,lat)=>plan.parts.map((p,i)=>sampleAt(canvases[i],p,lon,lat)).find(Boolean)||null;
  assert.equal(plan.parts.length,2);
  assert.ok(Math.abs(sample(179.999,15).u-sample(-179.999,15).u)<.0002);
  assert.equal(sample(179,0),null);assert.equal(sample(-179,0),null);
  assert.equal(sample(-160,0),null);assert.ok(sample(-147,0));
  assert.ok(canvases.every(c=>c.width<=2048&&c.height<=2048));
});

test('Francia real con ultramar muestra los tres colores metropolitanos sin perder territorios',()=>{
  const country=JSON.parse(fs.readFileSync(new URL('../data/geo/admin0.geojson',import.meta.url),'utf8')).features.find(f=>f.properties.id==='FR');
  const plan=flagTexturePlan(country),part=plan.parts[0];
  const global=paintFlagTexture(canvas(),image,plan,part),landmass=paintFlagTexture(canvas(),image,plan,part,'landmass');
  const points=[[-3,48],[2.3,48.85],[5.4,45.3]],stripe=sample=>sample?Math.min(2,Math.floor(sample.u*3)):null;
  assert.deepEqual(points.map(p=>stripe(sampleAt(global,part,...p))),[1,1,1]);
  assert.deepEqual(points.map(p=>stripe(sampleAt(landmass,part,...p))),[0,1,2]);
  assert.ok(sampleAt(landmass,part,-53,4),'Guayana');assert.ok(sampleAt(landmass,part,55.55,-21.1),'Reunión');
  assert.equal(landmass.paints.length,country.geometry.coordinates.length);
  assert.equal(landmass.paints.reduce((n,p)=>n+p.paths.length,0),plan.rings.flat().length);
  assert.equal(plan.parts.length,1);assert.equal(landmass.width,2048);assert.equal(landmass.height,global.height);
});

test('landmass sitúa el cantón de estrellas también sobre EEUU continental, con dos canvas',()=>{
  const country=JSON.parse(fs.readFileSync(new URL('../data/geo/admin0.geojson',import.meta.url),'utf8')).features.find(f=>f.properties.id==='US');
  const plan=flagTexturePlan(country),canvases=plan.parts.map(p=>paintFlagTexture(canvas(),image,plan,p,'landmass'));
  const sample=(lon,lat)=>plan.parts.map((p,i)=>sampleAt(canvases[i],p,lon,lat)).find(Boolean)||null;
  const northwest=sample(-122.3,47.6),south=sample(-97.7,30.3);
  assert.ok(northwest&&northwest.u<.4&&northwest.v<7/13,'Seattle pertenece al UV del cantón');
  assert.ok(south&&south.v>7/13,'Austin pertenece al UV de las franjas');
  assert.equal(plan.parts.length,2);assert.ok(sample(-150,64),'Alaska');
});

test('fit distingue texturas, comparte repeticiones y no crea recursos al hacer seek',async()=>{
  let requests=0;const canvases=[],issues=[],region={geometry};
  const env={region:()=>region,loadImg:async()=>{requests++;return image;},missing:m=>issues.push(m),canvas:()=>{const cv=canvas();canvases.push(cv);return cv;}};
  const base={type:'flag-fill',region:'EX',src:'flag.svg',dur:0};
  const fill=await createFlagFills({layers:[base,{...base,fit:'global'},{...base,fit:'landmass'},{...base,fit:'landmass'}]},env);
  assert.deepEqual(fill.stats(),{layers:4,textures:2,canvases:4});assert.equal(requests,2);
  const style={sources:{},layers:[]};fill.appendTo(style);
  assert.ok(Object.values(style.sources).every(s=>s.animate===false));
  const map={getLayer:()=>true,getPaintProperty:()=>0,setPaintProperty:()=>{}},before=canvases.map(cv=>structuredClone(cv.calls));
  for(const t of [2,0,100,2])fill.apply(map,t);
  assert.deepEqual(canvases.map(cv=>cv.calls),before);assert.equal(requests,2);assert.equal(canvases.length,4);
  const invalid=await createFlagFills({layers:[{...base,fit:'cover'}]},env);
  assert.equal(invalid.stats().canvases,0);assert.ok(issues.some(m=>m.includes('fit debe ser global o landmass')));
  assert.throws(()=>paintFlagTexture(canvas(),image,flagTexturePlan(geometry),flagTexturePlan(geometry).parts[0],'cover'),/fit debe ser/);
});
// Muestreo independiente de la ruta recibida por Canvas2D, con la regla evenodd.
function maskedAt(cv, part, lon, lat) {
  const west=part.coordinates[0][0], east=part.coordinates[1][0];
  if(lon<west||lon>east)return false;
  const x=(lon-west)/(east-west)*cv.width,y=(yMercator(lat)-part.y0)/(part.y1-part.y0)*cv.height;
  if(y<0||y>cv.height)return false;
  let inside=false;
  for(const points of cv.calls.find(c=>c[0]==='clip')[2])for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

test('máscara conserva islas y huecos al cruzar ±180, sin repetir la bandera por isla',()=>{
  const plan=flagTexturePlan(geometry), canvases=plan.parts.map(part=>paintFlagTexture(canvas(),image,plan,part));
  assert.equal(plan.parts.length,2);
  assert.ok((plan.x1-plan.x0)*360<46);
  const covered=(lon,lat)=>plan.parts.some((part,i)=>maskedAt(canvases[i],part,lon,lat));
  assert.equal(covered(172,0),true);assert.equal(covered(-172,0),true);
  assert.equal(covered(179,0),false);assert.equal(covered(-179,0),false);
  assert.equal(covered(-147,0),true);assert.equal(covered(-160,0),false);
  assert.equal(covered(172,25),false);
  for(const cv of canvases) {
    assert.equal(cv.calls.filter(c=>c[0]==='drawImage').length,1);
    assert.equal(cv.calls.find(c=>c[0]==='clip')[1],'evenodd');
    assert.equal(cv.calls.find(c=>c[0]==='clip')[2].length,3);
  }
  // Las dos mitades usan el mismo UV geográfico, sin reiniciar la imagen en la costura.
  const uv=plan.parts.map((part,i)=>{
    const [,,dx,,width]=canvases[i].calls.find(c=>c[0]==='drawImage');
    const boundary=(0-part.x0)/(part.x1-part.x0)*canvases[i].width;
    return (boundary-dx)/width;
  });
  assert.ok(Math.abs(uv[0]-uv[1])<1e-10);
});

test('geometrías reales existentes de EEUU y Rusia tienen dos fuentes acotadas y todos sus anillos',()=>{
  const collection=JSON.parse(fs.readFileSync(new URL('../data/geo/admin0.geojson',import.meta.url),'utf8'));
  for(const id of ['US','RU']) {
    const feature=collection.features.find(f=>f.properties.id===id),plan=flagTexturePlan(feature);
    assert.equal(plan.parts.length,2,id);assert.equal(plan.clamped,false);
    assert.equal(plan.rings.flat().length,feature.geometry.coordinates.flat().length);
    for(const part of plan.parts) {
      assert.ok(part.width>0&&part.width<=2048&&part.height>0&&part.height<=2048);
      assert.ok(part.coordinates.every(p=>p[0]>=-180&&p[0]<=180&&p[1]>=-85.052&&p[1]<=85.052));
    }
    assert.ok((plan.x1-plan.x0)*360<180);
    assert.ok(plan.parts.reduce((n,p)=>n+p.width*p.height,0)<=2048*2049);
  }
});

test('acepta Polygon, no muta coordenadas y rechaza geometría rota o de área nula',()=>{
  const polygon={type:'Polygon',coordinates:[ring(-10,-10,10,10),ring(-2,-2,2,2)]},before=structuredClone(polygon);
  assert.equal(flagTexturePlan(polygon).parts.length,1);assert.deepEqual(polygon,before);
  assert.throws(()=>flagTexturePlan({type:'LineString',coordinates:[]}),/Polygon/);
  assert.throws(()=>flagTexturePlan({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]}),/cerrar/);
  assert.throws(()=>flagTexturePlan({type:'Polygon',coordinates:[ring(0,0,0,1)]}),/área/);
});

test('opacidad y salida por anclas no dependen del orden de seek',()=>{
  const layer={t:'@inicio',dur:1,out:'@fin',fadeOut:.5,opacity:.8},T=(v,f)=>({'@inicio':2,'@fin':5}[v]??f);
  const expected=new Map([[1,0],[2,0],[2.5,.4],[3,.8],[5,.8],[5.25,.4],[5.5,0],[10,0]]);
  for(const t of [5.25,1,10,3,5,2,5.5,2.5,3,1])assert.equal(flagFillOpacity(layer,t,T),expected.get(t));
  assert.equal(flagFillOpacity({t:2,dur:0,out:4,fadeOut:0},2),1);
  assert.equal(flagFillOpacity({t:2,dur:0,out:4,fadeOut:0},4),0);
  assert.equal(flagFillOpacity({t:0,dur:0},100000),1);
});

test('instancia comparte textura, evita animación de canvas y reporta medios/regiones ausentes',async()=>{
  const issues=[],requests=[],region={geometry},canvases=[];
  const env={base:'https://example.test/episode/assets/',region:()=>region,missing:m=>issues.push(m),loadImg:async src=>{requests.push(src);return src.includes('missing')?null:image;},canvas:()=>{const cv=canvas();canvases.push(cv);return cv;}};
  const scene={layers:[{type:'flag-fill',region:'EX',src:'media/flag.svg',t:1,dur:1,out:5,fadeOut:1},{type:'flag-fill',region:'EX',src:'media/flag.svg',t:3,dur:1}]};
  const fill=await createFlagFills(scene,env),style={sources:{},layers:[]};fill.appendTo(style);
  assert.deepEqual(fill.stats(),{layers:2,textures:1,canvases:2});assert.equal(requests.length,1);
  assert.equal(requests[0],'https://example.test/episode/assets/media/flag.svg');
  assert.equal(Object.keys(style.sources).length,2);assert.ok(Object.values(style.sources).every(s=>s.animate===false));
  assert.ok(style.layers.every(l=>l.paint['raster-fade-duration']===0&&l.paint['raster-opacity-transition'].duration===0));
  const paint=new Map(),map={getLayer:id=>style.layers.find(l=>l.id===id),getPaintProperty:id=>paint.get(id),setPaintProperty:(id,key,v)=>paint.set(id,v)};
  fill.apply(map,5.5);const first=[...paint];fill.apply(map,0);assert.ok([...paint.values()].every(v=>v===0));fill.apply(map,5.5);assert.deepEqual([...paint],first);
  assert.equal(canvases.length,2);assert.ok(canvases.every(cv=>cv.calls.filter(c=>c[0]==='drawImage').length===1));
  const absent=await createFlagFills({layers:[{type:'flag-fill',region:'EX',src:'missing.svg'}]},env);
  assert.equal(absent.stats().canvases,0);assert.ok(issues.some(i=>i==='imagen ausente: missing.svg'));
  await createFlagFills({layers:[{type:'flag-fill',region:'unknown',src:'flag.svg'}]},{...env,region:()=>null});
  assert.ok(issues.some(i=>i==='región no encontrada: unknown'));
});

test('resolución respeta el índice de prepare y admite ISO3 y regiones propias',()=>{
  const country={type:'Feature',properties:{id:'EX',iso3:'EXM'},geometry},local={geometry:{type:'Polygon',coordinates:[ring(0,0,1,1)]}};
  const collections=[{features:[country]}],geo=createGeo({regions:{local}},{},collections);
  assert.equal(flagFillRegion({region:'EXM'},0,{collections,region:geo.region}).geometry,geometry);
  assert.equal(flagFillRegion({region:'local'},0,{region:geo.region}),local);
  assert.equal(flagFillRegion({region:'otra'},2,{resolved:{regions:[{layer:2,field:'region',id:'EX'}]},collections,region:geo.region}),country);
});

function episode(run) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-flag-fill-'));
  fs.mkdirSync(path.join(root,'assets/media'),{recursive:true});
  fs.copyFileSync(path.join(ATLAS,'showcase/assets/flags/us.svg'),path.join(root,'assets/media/flag.svg'));
  fs.writeFileSync(path.join(root,'assets/config.json'),JSON.stringify({configs:[{sceneUrl:'assets/scene.json'}]}));
  const scene={format:'atlas-v1',duration:10,look:'satelite-realista',camera:[{t:0,center:[0,0],span:60}],layers:[{type:'flag-fill',region:'USA',src:'media/flag.svg',t:1,dur:1,out:6,fadeOut:.5,opacity:.9}]};
  const check=fn=>{if(fn)fn(scene);fs.writeFileSync(path.join(root,'assets/scene.json'),JSON.stringify(scene));return checkEpisode(root);};
  try{run(check,root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}

test('check valida bandera local, ISO/región real y parámetros; rechaza URL, escapes y geometría inválida',()=>episode((check,root)=>{
  assert.equal(check().ok,true);
  let r=check(s=>{s.layers[0].opacity=2;s.layers[0].fadeOut=-1;s.layers[0].out=.5;});
  assert.ok(r.errors.some(e=>e.includes('opacity')));assert.ok(r.errors.some(e=>e.includes('fadeOut')));assert.ok(r.errors.some(e=>e.includes('posterior')));
  r=check(s=>Object.assign(s.layers[0],{opacity:1,fadeOut:.5,out:6,region:'sin país',src:'https://example.test/flag.svg'}));
  assert.ok(r.errors.some(e=>e.includes('region desconocida')));assert.ok(r.errors.some(e=>e.includes('relativa a assets/')));
  r=check(s=>Object.assign(s.layers[0],{region:'US',src:'../flag.svg'}));assert.ok(r.errors.some(e=>e.includes('relativa a assets/')));
  r=check(s=>Object.assign(s.layers[0],{src:'media/absent.svg'}));assert.ok(r.errors.some(e=>e.includes('Falta imagen local')));
  r=check(s=>{s.layers[0].src='media/flag.svg';s.layers[0].region='local';s.regions={local:{geometry:{type:'Polygon',coordinates:[ring(0,80,10,89)]}}};});
  assert.ok(r.errors.some(e=>e.includes('límite de Mercator')));
  r=check(s=>{s.layers[0].region='US';s.hud=[{type:'portrait',src:'media/portrait.jpg',x:.15,y:.72,size:110}];});
  assert.ok(r.errors.some(e=>e.includes('portrait.jpg')));
  r=check(s=>delete s.hud[0].src);assert.equal(r.ok,true);
}));

test('check admite solo fit global o landmass y el catálogo documenta el valor por defecto',()=>episode(check=>{
  assert.equal(check(s=>{s.layers[0].fit='landmass';}).ok,true);
  assert.equal(check(s=>{s.layers[0].fit='global';}).ok,true);
  for(const fit of ['cover',null,0])assert.ok(check(s=>{s.layers[0].fit=fit;}).errors.some(e=>e.includes('.fit:')));
  const entry=JSON.parse(fs.readFileSync(path.join(ATLAS,'components.json'),'utf8')).components.find(c=>c.name==='atlas.flagFill');
  assert.equal(entry.params.fit.default,'global');assert.match(entry.params.fit.doc,/landmass/);
  assert.equal(entry.demo.fit,undefined); // El ejemplo existente conserva el encuadre original.
  const shared=JSON.parse(fs.readFileSync(new URL('../../../../_tools/design-definitions/atlas-cinematico/catalog.json',import.meta.url),'utf8'));
  assert.deepEqual(shared.entries.find(e=>e.id===entry.name).params.fit,entry.params.fit);
}));
