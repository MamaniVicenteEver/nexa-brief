import { drawCharacter } from './index.js';
import { sampleScene } from './core/sample.js';
import { cameraAt } from './camera/index.js';
import { drawPlate,drawSetProps,drawShadow,drawLight } from './sets/index.js';
import { drawProp } from './props/index.js';
import { drawHand } from './rig/hands.js';
import { drawFX } from './fx/index.js';
import { drawUI } from './ui/index.js';
import {resolveView,resolveFraming} from './core/view.js';
export { sampleScene, cameraAt };
/** Pure renderer. Resource images are preloaded; no clocks, IO or state accumulation. */
function paintWorld(ctx,compiled,t,state,camera,primitiveBlur=false){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,h);ctx.scale(w/camera.w,h/camera.h);ctx.translate(-camera.x,-camera.y);
 if(primitiveBlur&&camera.motionBlur>.1)ctx.filter=`blur(${camera.motionBlur}px)`;
 drawPlate(ctx,state.scene.set,compiled.resources,camera);ctx.save();ctx.beginPath();ctx.rect(camera.x,camera.y,camera.w,camera.h);ctx.clip();drawSetProps(ctx,state.props,'back');
 const actors=Object.values(state.actors).sort((a,b)=>a.pose.y-b.pose.y);
 for(const a of actors)drawShadow(ctx,a);
 const prop=o=>drawProp(ctx,o.prop,{x:o.point[0],y:o.point[1],angle:o.angle,scale:o.scale,params:o.params});
 for(const a of actors){for(const o of Object.values(state.objects).filter(o=>!o.hidden&&o.owner.actor===a.id&&(o.owner.slot==='back'||o.carry==='behind')))prop(o);drawCharacter(ctx,a.character,a.pose,{...a.face,closeUp:camera.type==='close'},t);}
 drawSetProps(ctx,state.props,'front');
 for(const o of Object.values(state.objects).filter(o=>!o.hidden&&o.owner.slot!=='back'&&o.carry!=='behind')){prop(o);if(o.owner.actor&&o.owner.hand){const a=state.actors[o.owner.actor];ctx.save();ctx.translate(...o.point);ctx.scale(a.rig.scale,a.rig.scale);drawHand(ctx,[0,0],0,'hold',a.character.ink.color);ctx.restore();}}
 drawLight(ctx,state.scene.set,camera);
 for(const a of actors)for(const fx of a.fx)drawFX(ctx,fx,a.rig.anchors.head,a.rig.scale,t);
 if(camera.motionBlur>.1){ctx.save();ctx.globalAlpha=.12;ctx.fillStyle='#f8e5d1';ctx.fillRect(camera.x,camera.y,camera.w,camera.h);for(let i=0;i<12;i++){ctx.strokeStyle='rgba(255,249,222,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(camera.x,camera.y+i*camera.h/12);ctx.lineTo(camera.x+camera.motionBlur*7,camera.y+i*camera.h/12);ctx.stroke();}ctx.restore();}
 ctx.restore();ctx.restore();
}

/** Blur the finished world once; filtering every limb is both incorrect compositing and expensive. */
function renderWorld(ctx,compiled,t,options){
 const state=sampleScene(compiled,t),camera=cameraAt(compiled,t,state,options),w=ctx.canvas.width,h=ctx.canvas.height;
 const makeCanvas=compiled.resources?.createCanvas;
 if(camera.motionBlur>.1&&makeCanvas){
  const layer=makeCanvas(w,h);paintWorld(layer.getContext('2d'),compiled,t,state,camera);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(layer,0,0);
  ctx.filter=`blur(${camera.motionBlur*w/1080}px)`;ctx.drawImage(layer,0,0);ctx.restore();
 }else paintWorld(ctx,compiled,t,state,camera,true);
 return {...state,camera};
}

/** Scene transitions are incoming overlays; they do not shift dialogue or scene boundaries. */
export function transitionAt(compiled,t){
 const i=compiled.scenes.findIndex(s=>t>=s.t0&&t<s.t1),scene=compiled.scenes[i];
 if(i<1||scene.transition.type==='cut'||t>=scene.t0+scene.transition.dur)return null;
 return {type:scene.transition.type,progress:(t-scene.t0)/scene.transition.dur,previousTime:scene.t0-1e-6};
}
export function renderFrame(ctx,compiled,t,options={}){
 const view=resolveView(options.view??(ctx.canvas.width>=ctx.canvas.height?'landscape':'portrait'));options={...options,view,framing:resolveFraming(compiled,options)};
 const tr=transitionAt(compiled,t),make=compiled.resources?.createCanvas,w=ctx.canvas.width,h=ctx.canvas.height;
 const completeFrame=(context,time)=>{const state=renderWorld(context,compiled,time,options);context.save();context.setTransform(w/view.w,0,0,h/view.h,0,0);context.globalAlpha=1;drawUI(context,compiled,time,options);context.restore();return state;};
 let state;
 if(tr){
  if(!make)throw new Error('Las transiciones requieren resources.createCanvas para componer cuadros completos.');
  const incoming=make(w,h),outgoing=make(w,h);state=completeFrame(incoming.getContext('2d'),t);completeFrame(outgoing.getContext('2d'),tr.previousTime);
  const q=tr.progress*tr.progress*(3-2*tr.progress);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,h);
  if(tr.type==='dip-white'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.globalAlpha=Math.abs(2*q-1);ctx.drawImage(q<.5?outgoing:incoming,0,0);}
  else {ctx.drawImage(outgoing,0,0);if(tr.type==='fade')ctx.globalAlpha=q;else {ctx.beginPath();ctx.rect(0,0,w*q,h);ctx.clip();}ctx.drawImage(incoming,0,0);}
  ctx.restore();
 }else state=completeFrame(ctx,t);
 return {...state,sceneTransition:tr};
}
