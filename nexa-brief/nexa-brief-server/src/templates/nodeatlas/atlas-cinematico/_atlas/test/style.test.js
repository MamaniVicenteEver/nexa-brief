import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {composeStyle,mix,createLookAt} from '../style.js';
const load = async n => JSON.parse(await readFile(new URL(`../looks/${n}.json`,import.meta.url)));
test('estilos: JSON, fuentes existentes e identificadores únicos',async()=>{for(const n of ['satelite-realista','satelite-noticiero','oscuro','claro','politico','historico-papel','espacio']){const look=await load(n),style=composeStyle(look,{detail:'texas',detailProvider:'usgs-imagery'});assert.deepEqual(JSON.parse(JSON.stringify(style)),style);assert.equal(new Set(style.layers.map(x=>x.id)).size,style.layers.length);for(const l of style.layers)if(l.source)assert.ok(style.sources[l.source],l.id);}});
test('mezcla extremos, colores y conmutatividad',async()=>{const a=await load('oscuro'),b=await load('claro');assert.deepEqual(mix(a,b,0),a);assert.deepEqual(mix(a,b,1),b);assert.deepEqual(mix(a,b,.25),mix(b,a,.75));assert.equal(mix('#000000','#ffffff',.5),'#808080');});
test('lookAt es puro al interrumpir una transición',async()=>{let a=await load('oscuro'),b=await load('claro'),f=createLookAt({look:'a',looks:[{t:1,look:'b',dur:4},{t:3,look:'a',dur:2}]},{a,b});const first=f(3.5);f(0);f(6);assert.deepEqual(f(3.5),first);assert.deepEqual(f(0),a);assert.deepEqual(f(6),a);});
test('la proyección cambia al empezar la transición',async()=>{const a=await load('oscuro'),b=await load('espacio'),f=createLookAt({look:'a',looks:[{t:2,look:'b',dur:4}]},{a,b});assert.equal(f(1.99).projection,'mercator');assert.equal(f(2).projection,'globe');assert.equal(f(2.1).projection,'globe');});
test('overrides profundos iniciales y por transición sin mutar los looks',async()=>{
 const a=await load('satelite-realista'), snapshot=structuredClone(a);
 const at=createLookAt({look:'a',lookOverrides:{groups:{labels:{visible:true},borders:{admin1:{minzoom:4}}},highlight:{styles:{olive:{fill:'#112233'}}}},looks:[{t:2,look:'a',overrides:{groups:{labels:{visible:false}},highlight:{styles:{olive:{opacity:.2}}}}}]},{a});
 assert.equal(at(0).labels.visible,true);assert.equal(at(0).borders.levels[1].minzoom,4);assert.equal(at(0).highlight.styles.olive.fill,'#112233');assert.equal(at(3).labels.visible,false);assert.equal(at(3).highlight.styles.olive.opacity,.2);assert.equal(at(3).highlight.styles.olive.fill,'#112233');assert.deepEqual(a,snapshot);
});
test('etiquetas únicas de país, jerarquía y detalle limitado a cobertura',async()=>{
 const countries=JSON.parse(await readFile(new URL('../data/geo/labels-admin0.geojson',import.meta.url)));const ids=countries.features.map(f=>f.properties.id);assert.equal(ids.length,new Set(ids).size);assert.ok(countries.features.every(f=>f.geometry.type==='Point'));
 const look=await load('satelite-etiquetado'),providers=JSON.parse(await readFile(new URL('../providers.json',import.meta.url)));const style=composeStyle(look,{providers,detail:'austin'}), get=id=>style.layers.find(l=>l.id===id);
 assert.deepEqual([get('lbl-0').minzoom,get('lbl-0').maxzoom,get('lbl-1').minzoom,get('lbl-1').maxzoom,get('lbl-2').minzoom],[2,5.5,4.8,9,6.2]);assert.equal(get('brd-1').minzoom,4.8);assert.deepEqual(style.sources['sat-detail-usgs-imagery'].bounds,providers.find(p=>p.id==='usgs-imagery').coverage_bbox);assert.equal(get('lbl-places').source,'vec-detail');assert.ok(get('lbl-roads_labels_minor'));
});

test('la proyección del override se sustituye completa y entra al iniciar el evento',async()=>{
 const a=await load('oscuro'), expression=['interpolate',['linear'],['zoom'],1.2,'vertical-perspective',2.6,'mercator'];
 const f=createLookAt({look:'a',lookOverrides:{projection:{type:'globe'}},looks:[{t:2,look:'a',dur:4,overrides:{projection:{type:expression}}}]},{a});
 assert.deepEqual(f(1).projection,{type:'globe'});assert.deepEqual(f(2).projection,{type:expression});assert.deepEqual(f(3).projection,{type:expression});assert.deepEqual(composeStyle(f(2)).projection,{type:expression});
});
