import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../components/intros.js',import.meta.url),'utf8');
function rig(portrait=false){
 const registered=new Map(),calls=[],surfaces=[];
 const graphics=()=>new Proxy({fillStyle:'',globalAlpha:1},{get(target,key){if(key in target)return target[key];return (...args)=>{calls.push({key,args,color:target.fillStyle});if(String(key).includes('Gradient'))return {addColorStop(){}};};},set(target,key,value){target[key]=value;return true;}});
 const G=graphics(),st={W:portrait?540:960,H:portrait?960:540,u:5.4,portrait};
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const IM={measure:(text,font)=>String(text).length*(parseFloat(font)||100)*.48,wordFont:fs=>String(fs),world:()=>({ok:true,land:{},fc:{}}),COL:{ocean:'#7f9bab',land:'#d6d7d2',coast:'#4d5a66'},rays(){throw Error('La apertura no debe dibujar rayos');},sun(){throw Error('La apertura no debe dibujar bandera');},mapCache(){throw Error('Las aperturas no deben hornear el mapa físico');}};
 const Kit={imperio:IM,register:def=>registered.set(def.name,def),clamp,lerp:(a,b,q)=>a+(b-a)*q,prog:(t,a,d)=>clamp((t-a)/d),ease:{expoOut:x=>x},hook:{bgParams:()=>({}),cover:(...args)=>calls.push({key:'cover',args})}};
 const ctx={stage:st,g:{main:G,top:G},img:src=>src?{width:1200,height:800}:null};
 const document={createElement(){const canvas={width:0,height:0,getContext:graphics};surfaces.push(canvas);return canvas;}};
 const d3={geoNaturalEarth1:()=>({fitExtent(){return this;}}),geoPath:()=>()=>{}};
 vm.runInNewContext(source,{Kit,document,d3});
 const params=(name,extra)=>({...Object.fromEntries(Object.entries(registered.get(name).params).map(([key,spec])=>[key,spec.default])),...extra});
 return {registered,calls,ctx,surfaces,params};
}
for(const portrait of [false,true]){
 test(`A conserva mundo completo sin bandera ni rayos y libera su canvas (${portrait?'móvil':'desktop'})`,()=>{
  const r=rig(portrait),def=r.registered.get('imperio.introv1'),p=r.params(def.name,{text:'UN ATENTADO\n^CINCO POTENCIAS^',country:'Germany'});
  assert.equal(def.mapWarm(p).length,0);
  const instance=def.create(r.ctx,p);instance.render(4,{dur:9,t0:0},4);
  assert.ok(r.calls.some(c=>c.key==='drawImage'),'el mapa mundial ocupa el fondo');
  assert.ok(r.calls.some(c=>c.key==='fillText'&&c.args[0]==='ATENTADO'));
  assert.ok(r.calls.some(c=>c.key==='fillRect'&&c.color==='#a3122f'),'conserva acento carmesí');
  instance.dispose();assert.ok(r.surfaces.every(canvas=>canvas.width===1&&canvas.height===1));
 });
 test(`B muestra fotografía y palabra clave carmesí con recorte seguro (${portrait?'móvil':'desktop'})`,()=>{
  const r=rig(portrait),def=r.registered.get('imperio.introv2');
  assert.equal(def.params.src.required,true);
  for(const side of ['left','right']){
   const instance=def.create(r.ctx,r.params(def.name,{text:'DOS DISPAROS',src:'archivo.jpg',imageSide:side,focus:[.7,.45]}));
   instance.render(4,{dur:9,t0:0},4);
   const cover=r.calls.findLast(c=>c.key==='cover').args;
   assert.ok(cover[2]>=0&&cover[3]>=0&&cover[2]+cover[4]<=r.ctx.stage.W&&cover[3]+cover[5]<=r.ctx.stage.H);
   assert.deepEqual(Array.from(cover[6]),[.7,.45]);
   assert.ok(r.calls.some(c=>c.key==='fillText'&&c.args[0]==='DISPAROS'&&c.color==='#f6f6f8'));
   assert.ok(r.calls.some(c=>c.key==='fillRect'&&c.color==='#a3122f'));
   instance.dispose();
  }
 });
}
