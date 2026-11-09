import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../../../_proto/proto.js',import.meta.url),'utf8');
async function run(scene, options={}) {
 const calls=[], requests=[];const canvas=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:(...args)=>{if(k==='fillText'||k==='strokeText')calls.push(args[0]);},set:(o,k,v)=>(o[k]=v,true)});
 const stage={appendChild(){}}, document={currentScript:null,fonts:{load:async()=>{}},getElementById:id=>id==='stage'?stage:null,createElement:tag=>tag==='canvas'?{getContext:()=>canvas}:{style:{}},body:{appendChild(){}}};
 const context={console,document,location:{search:'?t=21&scene=assets/scene-zoom.json',href:'http://localhost/'},URLSearchParams,URL,innerWidth:1920,innerHeight:1080,performance:{now:()=>0},requestAnimationFrame:fn=>fn(0),addEventListener(){},setTimeout,clearTimeout,fetch:async url=>{requests.push(url);let data=url==='config.json'?{configs:[{sceneUrl:'assets/scene.json',lyricsUrl:'words.json'}]}:url==='words.json'?{segments:[{words:[{word:'Prueba',start:20,end:22}]}]}:url==='assets/scene-zoom.json'?scene:null;return {ok:!!data,json:async()=>data};}};context.window=context;vm.runInNewContext(source,context);
 let setup;await context.Proto.run({name:'test',sceneOptIn:true,allowSceneQuery:true,missingTiles:()=>['ausente'],theme:{outro:{channel:'NODEHISTORY'},captions:{},word:(g,text)=>calls.push(text)},async setup(c){setup=c;},render(){},...options});
 return {context,calls,requests,setup};
}
test('Atlas opta por escena, sin cierre ni subtítulos implícitos',async()=>{const r=await run({end:24});assert.ok(r.requests.includes('assets/scene-zoom.json'));assert.equal(r.setup.outroAt,Infinity);assert.deepEqual(r.calls,[]);assert.deepEqual(r.context.__promo.missingTiles(),['ausente']);});
test('el cierre y los subtítulos explícitos siguen disponibles',async()=>{const r=await run({end:24,outro:{channel:'CANAL'},captions:{}});assert.equal(r.setup.outroAt,18);assert.ok(r.calls.length>0);});
test('subtítulos explícitos aparecen sin cierre',async()=>{const r=await run({end:24,captions:{}});assert.ok(r.calls.includes('PRUEBA'));});
test('outro false tiene prioridad incluso si el tema lo habilita',async()=>{const r=await run({end:24,outro:false},{theme:{outro:{enabled:true,channel:'CANAL'},captions:{},word(){}}});assert.equal(r.setup.outroAt,Infinity);assert.deepEqual(r.calls,[]);});
