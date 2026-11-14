import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('footage pide un tiempo por cuadro y conserva el bucle tras cargar metadatos',()=>{
 const registry=new Map(),requested=[],canvases=[];
 const graphics=new Proxy({},{get:()=>()=>{}});
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const IM={COL:{ray:'#a3122f',title:'#fff',dark:'#000'},fx:{},tone:()=>'',smoke(){},canvas(w,h){const surface={width:w,height:h,getContext:()=>graphics};canvases.push(surface);return surface;},mapScene(ctx,p,options){return {draw(lt,beat,t,after){options.under(graphics,{},lt);after(graphics);},dispose(){}};}};
 const Kit={imperio:IM,fonts:new Set(),register:d=>registry.set(d.name,d),clamp,lerp:(a,b,q)=>a+(b-a)*q,prog:(t,a,d)=>clamp((t-a)/d)};
 vm.runInNewContext(fs.readFileSync(new URL('../components/campaign.js',import.meta.url),'utf8'),{Kit});
 const definition=registry.get('imperio.footage'),params={...Object.fromEntries(Object.entries(definition.params).map(([key,s])=>[key,s.default])),video:'archivo.mp4',start:1,loop:true,caption:''};
 const video={duration:10,videoWidth:1280,videoHeight:720},ctx={stage:{W:960,H:540,u:5.4,portrait:false},beat:{dur:30,t0:0},g:{main:graphics},clip(src,at){requested.push(at);return video;}};
 const instance=definition.create(ctx,params);
 instance.render(2,{dur:30,t0:0},2);assert.deepEqual(requested,[3]);
 instance.render(12,{dur:30,t0:0},12);assert.equal(requested.length,2);assert.ok(requested[1]>=1&&requested[1]<10);
 instance.dispose();assert.ok(canvases.every(surface=>surface.width===1&&surface.height===1));
});
