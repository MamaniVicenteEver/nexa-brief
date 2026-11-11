import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHud} from '../hud.js';

test('portrait admite t=0 exacto y seek al origen con radios Canvas no negativos',()=>{
  const hud=createHud({hud:[{type:'portrait',name:'RETRATO DE EJEMPLO',x:.15,y:.72,size:110,t:0,dur:.5,out:6,exit:.35}]},{loadImg:async()=>null});
  for(const [W,H] of [[640,360],[360,640]]) {
    const radii=[],g=new Proxy({globalAlpha:1,measureText:()=>({width:120}),
      arc:(x,y,r)=>{assert.ok(Number.isFinite(r)&&r>=0,`Canvas.arc no admite radio ${r}`);radii.push(r);},
      ellipse:(x,y,rx,ry)=>{assert.ok(Number.isFinite(rx)&&rx>=0&&Number.isFinite(ry)&&ry>=0);radii.push(rx,ry);}
    },{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
    for(const time of [0,.0001,3,6.2,0,3])hud.draw(g,time,{W,H});
    assert.ok(radii.length>0);assert.equal(radii[0],0);
  }
});
