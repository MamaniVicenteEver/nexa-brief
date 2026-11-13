import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {flagFillOpacity,flagOpacityKeys,createFlagFills} from '../flag-fill.js';
import {createHud} from '../hud.js';
import {createOverlays} from '../overlays.js';
import {ATLAS,checkEpisode} from '../validate.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const polygon={type:'Polygon',coordinates:[[[0,0],[5,0],[5,5],[0,5],[0,0]]]};
function context(){
  const calls=[],state={globalAlpha:1},stack=[];
  return new Proxy(state,{get(o,k){
    if(k==='calls')return calls;
    if(k==='measureText')return str=>({width:String(str).length*(parseFloat(/([\d.]+)px/.exec(o.font||'10px')[1])*.65+parseFloat(o.letterSpacing||0))});
    if(k==='save')return()=>{stack.push({...o});};
    if(k==='restore')return()=>{Object.assign(o,stack.pop());};
    if(k==='fillText')return(...a)=>calls.push([k,...a,{font:o.font,spacing:o.letterSpacing}]);
    if(k in o)return o[k];return(...a)=>calls.push([k,...a]);
  },set(o,k,v){o[k]=v;return true;}});
}

test('curva de bandera conserva fases viva/tenue/mínima y la salida en seeks desordenados',()=>{
  const l={t:2,dur:1,out:12,fadeOut:1,opacity:.8,opacityKeys:[{t:3,value:1},{t:5,value:1},{t:7,value:.1},{t:10,value:.025}]};
  const before=structuredClone(l),expected=new Map([[1,0],[2,0],[2.5,.4],[3,.8],[5,.8],[6,.44],[7,.08],[8.5,.05],[10,.02],[12,.02],[12.5,.01],[13,0]]);
  for(const t of [12.5,6,1,13,7,3,8.5,2,10,2.5,12,5,6])near(flagFillOpacity(l,t),expected.get(t));
  assert.deepEqual(l,before);
  for(const t of [0,2,3,100])assert.equal(flagFillOpacity({t:2,dur:1,opacity:.7},t),flagFillOpacity({t:2,dur:1,opacity:.7,opacityKeys:[]},t));
  const anchors={'@a':3,'@b':5},T=(v,f)=>typeof v==='number'?v:anchors[v]??f;
  near(flagFillOpacity({dur:0,opacityKeys:[{t:'@a',value:1},{t:'@b',value:.1}]},4,T),.55);
});

test('claves rechazan listas inválidas, anclas ausentes, duplicados, desorden y valores fuera de rango',()=>{
  for(const keys of [null,{},[{t:1,value:2}],[{t:-1,value:.5}],[{t:'@ausente',value:.5}],[{t:1,value:1},{t:1,value:0}],[{t:2,value:1},{t:1,value:0}]])assert.throws(()=>flagOpacityKeys({opacityKeys:keys}),/opacityKeys/);
});

test('runtime resuelve claves una vez y reutiliza textura entre curvas sin redibujar canvas',async()=>{
  let keyReads=0,loads=0;const canvases=[],T=(v,f)=>{if(v==='@key'){keyReads++;return 2;}return typeof v==='number'?v:f;};
  const base={type:'flag-fill',region:'EX',src:'flag.svg',dur:0,opacityKeys:[{t:'@key',value:1},{t:4,value:.05}]};
  const fill=await createFlagFills({layers:[base,{...base,opacityKeys:[{t:0,value:.2}]}]},
    {T,region:()=>({geometry:polygon}),loadImg:async()=>{loads++;return {width:90,height:60};},canvas:()=>{const g=context(),cv={getContext:()=>g,g};canvases.push(cv);return cv;}});
  const style={sources:{},layers:[]};fill.appendTo(style);
  assert.deepEqual(fill.stats(),{layers:2,textures:1,canvases:1});assert.equal(keyReads,1);assert.equal(loads,1);
  const before=structuredClone(canvases[0].g.calls),values=new Map(),map={getLayer:()=>true,getPaintProperty:id=>values.get(id),setPaintProperty:(id,k,v)=>values.set(id,v)};
  for(const t of [3,1,20,3]){fill.apply(map,t);near(values.get('flag-fill-0-0'),flagFillOpacity(base,t,T));}
  assert.equal(keyReads,5); // Una resolución de setup; las otras cuatro provienen solo del oráculo puro anterior.
  assert.deepEqual(canvases[0].g.calls,before);assert.ok(Object.values(style.sources).every(s=>s.animate===false));
});

test('retrato ampliado usa foto130 y letras28.8/13.2 dentro de una placa suficiente en ambos formatos',async()=>{
  for(const [W,H,factor] of [[1920,1080,.95],[1080,1920,1]]) {
    const g=context(),hud=createHud({hud:[{type:'portrait',src:'public.svg',name:'EMMANUEL MACRON',role:'Presidente de la República Popular China',x:.2,y:.61,size:130,nameSize:28.8,roleSize:13.2,scaleLandscape:.95,scalePortrait:1}]},{loadImg:async()=>({width:100,height:100})});
    await hud.ready();hud.draw(g,2,{W,H});
    const photo=g.calls.find(c=>c[0]==='drawImage');near(photo[4],260*factor);near(photo[5],260*factor);
    const texts=g.calls.filter(c=>c[0]==='fillText'),plate=g.calls.find(c=>c[0]==='fillRect'&&c[3]>100&&c[4]>30);
    assert.equal(texts.length,2);assert.ok(plate);
    const sizes=[28.8,13.2];
    texts.forEach((c,i)=>{const px=parseFloat(/([\d.]+)px/.exec(c.at(-1).font)[1]);near(px,sizes[i]*factor);assert.ok(c[3]-px/2>=plate[2]);assert.ok(c[3]+px/2<=plate[2]+plate[4]);});
    assert.ok(texts[0][3]+28.8*factor/2<texts[1][3]-13.2*factor/2);
    const old=structuredClone(g.calls);hud.draw(context(),0,{W,H});const again=context();hud.draw(again,2,{W,H});assert.deepEqual(again.calls,old);
  }
});

test('retrato por defecto conserva placa44 y centros14/31; nombre sin cargo también crece',()=>{
  const g=context();createHud({hud:[{type:'portrait',name:'Persona',role:'Cargo',x:.5,y:.5}]},{}).draw(g,2,{W:1920,H:1080});
  const plate=g.calls.find(c=>c[0]==='fillRect'&&c[4]===44),texts=g.calls.filter(c=>c[0]==='fillText');assert.ok(plate);near(texts[0][3]-plate[2],14);near(texts[1][3]-plate[2],31);
  const single=context();createHud({hud:[{type:'portrait',name:'Persona',nameSize:40}]},{}).draw(single,2,{W:1920,H:1080});
  assert.ok(single.calls.some(c=>c[0]==='fillRect'&&c[4]>40));
});

const view=(W=1920,H=1080,p={x:180,y:900,k:.35})=>({W,H,pitch:30,project:()=>({...p,visible:true})});
const env={loadImg:async()=>({width:100,height:100}),place:()=>[0,0]};
const draw=(o,v)=>{const g=context();o.draw(g,2,v);return g.calls;};
const inside=(r,W,H)=>r.x>=0&&r.y>=0&&r.x+r.w<=W+1e-8&&r.y+r.h<=H+1e-8;

test('screen mantiene centro de foto y escala al mover cámara; poste diagonal conserva ancla geográfica',()=>{
  for(const type of ['pole-photo','hex-photo']) {
    const o=createOverlays({layers:[{type,at:[0,0],screen:[.46,.43],label:'Región',title:'Región',fillAt:0}]},env);
    const a=view(),b=view(1920,1080,{x:1700,y:800,k:1.5});
    assert.deepEqual(o.layout(2,a),o.layout(2,b));
    for(const v of [a,b]) {
      const calls=draw(o,v),start=calls.find(c=>c[0]==='moveTo'),end=calls.find(c=>c[0]==='lineTo');
      near(start[1],v.project().x);near(start[2],v.project().y);near(end[1],1920*.46);near(end[2],1080*.43);
    }
  }
});

test('panel screen reserva foto225x140, altura de texto multilínea y padding; centro de toda ficha correcto',()=>{
  for(const anchor of ['left','right']) {
    const o=createOverlays({layers:[{type:'panel',at:[0,0],screen:[.46,.43],anchor,title:'REGIÓN',text:'Descripción',src:'ok'}]},env),v=view();
    const r=o.layout(2,v)[0];near(r.w,536);near(r.h,177.4);near(r.x+r.w/2,1920*.46);near(r.y+r.h/2,1080*.43);
    const calls=draw(o,v),photo=calls.find(c=>c[0]==='fillRect'&&c[3]===225&&c[4]===140);
    assert.ok(photo&&photo[1]>=r.x&&photo[2]>=r.y&&photo[1]+photo[3]<=r.x+r.w&&photo[2]+photo[4]<=r.y+r.h);
  }
});

test('título Renania del Norte-Westfalia ocupa dos líneas25 sin invadir foto; subtítulos quedan debajo',()=>{
  const title='Renania del Norte-Westfalia',body='Descripción regional con un subtítulo suficientemente largo para envolver';
  for(const type of ['panel','pole-photo','hex-photo'])for(const [W,H] of [[1920,1080],[1080,1920]])for(const screen of [[.46,.43],[0,0],[1,1]]) {
    const o=createOverlays({layers:[{type,at:[0,0],screen,title,label:title,text:body,sub:body}]},env),v=view(W,H),r=o.layout(2,v)[0],calls=draw(o,v);
    const texts=calls.filter(c=>c[0]==='fillText'),heads=texts.filter(c=>parseFloat(/([\d.]+)px/.exec(c.at(-1).font)[1])===25),bodyLines=texts.filter(c=>!heads.includes(c));
    assert.equal(heads.length,2);assert.equal(heads.map(c=>c[1]).join(' '),title.toUpperCase());
    assert.ok(bodyLines.length>0);assert.ok(bodyLines[0][3]>=heads[1][3]+25);
    for(const c of heads){const width=c[1].length*25*.65;assert.ok(c[2]>=r.x&&c[2]+width<=r.x+r.w);}
    assert.ok(inside(r,W,H));
    if(type==='panel') {const photo=calls.find(c=>c[0]==='fillRect'&&c[3]===225&&c[4]===140);assert.ok(heads.every(c=>c[2]+c[1].length*25*.65<photo[1]));}
  }
});

test('fichas screen caben en bordes y viewport reducido, con layout finito y seek determinista',()=>{
  for(const [W,H] of [[1920,1080],[1080,1920],[360,640]])for(const screen of [[0,0],[1,1],[0,1],[1,0]]) {
    const o=createOverlays({layers:['panel','pole-photo','hex-photo'].map(type=>({type,at:[0,0],screen,size:300,title:'Una región con un nombre largo',label:'Región'}))},env),v=view(W,H),rects=o.layout(2,v);
    assert.equal(rects.length,3);assert.ok(rects.every(r=>inside(r,W,H)));
    const calls=draw(o,v);draw(o,{...v,project:()=>({x:1,y:2,k:1,visible:true})});assert.deepEqual(draw(o,v),calls);
    for(const call of calls)for(const n of call)if(typeof n==='number')assert.ok(Number.isFinite(n));
  }
  const huge=createOverlays({layers:[{type:'pole-photo',at:[0,0],screen:[.5,.5],size:5000}]},env).layout(2,view(360,640))[0];assert.ok(inside(huge,360,640));
});

test('sin screen conserva colocación geográfica y dimensiones legacy',()=>{
  const p={x:800,y:700,k:.8},v=view(1920,1080,p);
  const panel=createOverlays({layers:[{type:'panel',at:[0,0]}]},env).layout(2,v)[0];near(panel.x,p.x+30*.8);near(panel.y,p.y-230*.8);near(panel.w,275*.8);near(panel.h,130*.8);
  const photo=createOverlays({layers:[{type:'pole-photo',at:[0,0]}]},env),end=draw(photo,v).find(c=>c[0]==='lineTo');near(end[1],p.x);near(end[2],p.y-155*.8);
});

test('screen evita colisiones cuando hay espacio sin desplazar el punto ni mostrar el reverso del globo',()=>{
  const o=createOverlays({layers:['panel','pole-photo','hex-photo'].map(type=>({type,at:[0,0],screen:[.46,.43]}))},env),rects=o.layout(2,view());
  for(let i=0;i<rects.length;i++)for(let j=0;j<i;j++){const a=rects[i],b=rects[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
  assert.equal(o.layout(2,{...view(),project:()=>({visible:false})}).length,0);
});

test('check reconoce claves temporales, screen y tamaños de retrato; rechaza contratos inválidos',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-temporal-ui-'));
  try {
    fs.mkdirSync(path.join(root,'assets/media'),{recursive:true});fs.copyFileSync(path.join(ATLAS,'showcase/assets/flags/us.svg'),path.join(root,'assets/media/flag.svg'));
    fs.writeFileSync(path.join(root,'assets/config.json'),JSON.stringify({configs:[{sceneUrl:'assets/scene.json'}]}));
    const scene={format:'atlas-v1',duration:10,look:'satelite-realista',camera:[{t:0,center:[0,0],span:60}],layers:[{type:'flag-fill',region:'US',src:'media/flag.svg',opacityKeys:[{t:0,value:1},{t:5,value:.05}]},{type:'panel',at:[0,0],screen:[.46,.43]}],hud:[{type:'portrait',size:130,nameSize:28.8,roleSize:13.2}]};
    const check=()=>{fs.writeFileSync(path.join(root,'assets/scene.json'),JSON.stringify(scene));return checkEpisode(root);};
    assert.equal(check().ok,true);
    scene.worldCopies=true;assert.equal(check().ok,true);scene.worldCopies='true';assert.ok(check().errors.some(e=>e.includes('worldCopies')));scene.worldCopies=false;
    scene.layers[1].screen=null;assert.equal(check().ok,true);scene.layers[1].screen=[.46,.43];
    scene.layers[0].opacityKeys[1].t=0;assert.ok(check().errors.some(e=>e.includes('opacityKeys')));scene.layers[0].opacityKeys[1].t=5;
    scene.layers[1].screen=[1.1,0];assert.ok(check().errors.some(e=>e.includes('.screen:')));scene.layers[1].screen=[.46,.43];
    scene.hud[0].roleSize=0;assert.ok(check().errors.some(e=>e.includes('.roleSize')));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
