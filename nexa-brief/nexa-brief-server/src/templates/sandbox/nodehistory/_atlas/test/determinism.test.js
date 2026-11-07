import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {apply} from '../update.js';
import {composeStyle,createLookAt} from '../style.js';
import {spanToZoom} from '../camera.js';
import vm from 'node:vm';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const rawScene=await json('../../atlas-cinematico/assets/scene.json');
const sandbox={document:{currentScript:null},location:{search:''},URLSearchParams,console};sandbox.window=sandbox;
vm.runInNewContext(await readFile(new URL('../../../_proto/proto.js',import.meta.url),'utf8'),sandbox);
const declared=sandbox.Proto.validateDeclared((await json('../../atlas-cinematico/info.json')).components);
const scene=sandbox.Proto.resolveComponents(rawScene,declared,sandbox.Proto.buildSelection(declared,sandbox.Proto.parseComponentQuery(new URLSearchParams())));
const looks=Object.fromEntries(await Promise.all(['satelite-realista','espacio'].map(async name=>[name,await json(`../looks/${name}.json`)])));
const providers=await json('../providers.json');
const copy=x=>structuredClone(x);

function context(){
 const lookAt=createLookAt(scene,looks), style=composeStyle(lookAt(0),{base:'atlas/',providers});
 const highlights=scene.layers.flatMap((h,i)=>h.type==='highlight'?[{...h,id:`hl-${i}`}]:[]);
 for(const h of highlights) for(const suffix of ['fill','line','glow']) style.layers.push({id:`${h.id}-${suffix}`,paint:{},layout:{}});
 const layers=Object.fromEntries(style.layers.map(layer=>[layer.id,copy(layer)]));
 const state={projection:copy(style.projection),sky:copy(style.sky),terrain:copy(style.terrain),tiles:copy(style.sources.dem.tiles)};
 const source={get tiles(){return state.tiles;},setTiles(v){state.tiles=copy(v);}};
 const map={getLayer:id=>layers[id],getSource:()=>source,
  getPaintProperty:(id,key)=>layers[id].paint?.[key],setPaintProperty:(id,key,v)=>{(layers[id].paint??={})[key]=copy(v);},
  getLayoutProperty:(id,key)=>layers[id].layout?.[key],setLayoutProperty:(id,key,v)=>{(layers[id].layout??={})[key]=copy(v);},
  setLayerZoomRange:(id,min,max)=>{layers[id].minzoom=min;layers[id].maxzoom=max;},
  getProjection:()=>state.projection,setProjection:v=>{state.projection=copy(v);},
  getSky:()=>state.sky,setSky:v=>{state.sky=copy(v);},getTerrain:()=>state.terrain,setTerrain:v=>{state.terrain=copy(v);},
  jumpTo:v=>{state.pose=copy(v);}};
 return {map,lookAt,providers,st:{W:1920,H:1080},base:'atlas/',online:false,satIds:['sat-bm','sat-viirs'],highlights,baseLayers:style.layers.filter(l=>/^base-(light|dark|grayscale)-/.test(l.id)),camera:{at:t=>({lon:t,lat:0,zoom:3,pitch:0,bearing:0})},snapshot:()=>copy({state,layers})};
}
function visit(times){const c=context();for(const t of times)apply(c,t);return c.snapshot();}

test('resaltados y look son iguales al llegar directamente o tras saltos',()=>{
 for(const [target,route] of [[20.4,[20.4,2,5,20.4]],[6.5,[6.5,20.4,2,5,6.5]],[22.225,[22.225,2,22.3,22.225]],[20.4,[20.4,22.3,20.4]],[22.3,[22.3,20.4,22.3]]]) assert.deepEqual(visit(route),visit([target]));
 const final=visit([20.4]);assert.ok(final.layers['hl-18-fill'].paint['fill-opacity']>0);assert.ok(visit([21.4]).layers['hl-22-fill'].paint['fill-opacity']>0);
 const pink=visit([6.5]);assert.ok(pink.layers['hl-6-fill'].paint['fill-opacity']>0);assert.ok(pink.layers['hl-7-fill'].paint['fill-opacity']>0);
});
test('repara propiedades cambiadas por fuera de la actualización',()=>{
 const c=context();apply(c,20.4);const expected=c.snapshot();c.map.setPaintProperty('hl-22-fill','fill-opacity',0);c.map.setLayoutProperty('sat-bm','visibility','none');apply(c,20.4);assert.deepEqual(c.snapshot(),expected);
});
test('el estilo desactiva transiciones y fundido ráster',()=>{
 const style=composeStyle(looks['satelite-realista'],{providers});assert.deepEqual(style.transition,{duration:0,delay:0});for(const layer of style.layers.filter(l=>l.type==='raster'))assert.equal(layer.paint['raster-fade-duration'],0);
});

test('proyección por zoom cambia por valor y resiste saltos y cambios externos',()=>{
 const expression=['interpolate',['linear'],['zoom'],1.2,'vertical-perspective',2.6,'mercator'];
 const c=context(), original=c.lookAt;
 c.lookAt=t=>({...original(t),projection:t>=10?expression:'mercator'});
 let calls=0;const set=c.map.setProjection;c.map.setProjection=v=>{calls++;set(v);};
 apply(c,0);assert.equal(calls,0);
 apply(c,12);assert.deepEqual(c.map.getProjection(),{type:expression});assert.equal(calls,1);
 apply(c,12);assert.equal(calls,1);
 const expected=c.snapshot();apply(c,0);assert.deepEqual(c.map.getProjection(),{type:'mercator'});apply(c,12);assert.deepEqual(c.snapshot(),expected);
 c.map.setProjection({type:'globe'});apply(c,12);assert.deepEqual(c.map.getProjection(),{type:expression});
 const direct=context();const directLook=direct.lookAt;direct.lookAt=t=>({...directLook(t),projection:t>=10?expression:'mercator'});apply(direct,12);assert.deepEqual(c.snapshot(),direct.snapshot());
});

test('estilo inicial y actualización recalculan etapas span al cambiar el ancho',()=>{
 const projection={type:['interpolate',['linear'],['zoom'],{span:520},'vertical-perspective',{span:170},'mercator']};
 const c=context(), original=c.lookAt;c.lookAt=t=>({...original(t),projection});c.st={W:1920,H:1080};
 const initial=composeStyle(c.lookAt(0),{providers,width:c.st.W}).projection;
 assert.equal(initial.type[3],spanToZoom(520,1920));
 apply(c,0);assert.deepEqual(c.map.getProjection(),initial);
 c.st.W=1080;apply(c,0);assert.equal(c.map.getProjection().type[3],spanToZoom(520,1080));
 assert.deepEqual(c.map.getProjection(),composeStyle(c.lookAt(0),{providers,width:1080}).projection);
 c.st.W=1920;apply(c,0);assert.deepEqual(c.map.getProjection(),initial);
});
