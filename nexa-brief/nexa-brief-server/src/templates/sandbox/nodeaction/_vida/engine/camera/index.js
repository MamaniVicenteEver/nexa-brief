import { clamp } from '../core/math.js';
import {PROPS} from '../props/index.js';
import {objectBounds} from '../core/composition.js';
export const SHOTS=['wide','two','medium','close','insert'];
export {MOVES} from './config.js';
import {plannedCameraAt} from './planner.js';
export function direct(state){return state.scene.cameraPlan.find(s=>state.t>=s.t0&&state.t<s.t1)??state.scene.cameraPlan.at(-1);}
const selected=direct;
// One optical rectangle for the whole 9:16 frame. All world margins scale with the subject.
const constrain=(r,set)=>{
 const h=Math.max(set.charHeight*.2,r.h),w=h*1080/1920;
 const wantedX=r.cx-w/2,wantedY=r.cy-h/2;
 const x=w<=set.plate.w?clamp(wantedX,0,set.plate.w-w):wantedX;
 let y=h<=set.plate.h?clamp(wantedY,0,set.plate.h-h):wantedY;
 // Stay on the plate unless that would put hands/objects over the subtitle band.
 if(r.safeBottom!=null)y=Math.max(y,r.safeBottom-h*1340/1920);
 return {...r,w,h,x,y,cx:x+w/2,cy:y+h/2,viewportHeight:1920};
};
function rectFor(shot,state,compiled){
 const ids=shot.targets??[shot.target??Object.keys(state.actors)[0]],as=ids.map(id=>state.actors[id]).filter(Boolean),object=state.objects[shot.target];
 const list=as.length?as:Object.values(state.actors),a=list[0],scale=a.rig.scale;
 const subtitles=compiled.episode.ui?.subtitles!==false&&compiled.lines.some(l=>l.scene===state.scene.id);
 let cx,cy,h,safeBottom,minFit=0;
 if(shot.type==='insert'){
  const eating=object&&state.active.find(e=>e.action==='eat'&&e.object===object.id),eater=eating&&state.actors[eating.who];
  const points=object?[object.point,...(eater?[eater.rig.anchors.head]:[])]:list.flatMap(a=>[a.rig.anchors.leftHand,a.rig.anchors.rightHand]);
  const unit=object?.owner.actor?state.actors[object.owner.actor].rig.scale:scale;
  cx=points.reduce((n,p)=>n+p[0],0)/Math.max(1,points.length)+(object?unit*.045:0);cy=points.reduce((n,p)=>n+p[1],0)/Math.max(1,points.length);h=unit*.95;
  if(eater)h=Math.max(h,Math.abs(object.point[1]-eater.rig.anchors.head[1])+eater.rig.scale*.6);
 }else if(shot.type==='close'){
  h=scale*.96;cx=a.rig.anchors.head[0];cy=a.rig.anchors.head[1]+h/6;
 }else if(shot.type==='medium'){
  h=scale*1.32;cx=a.rig.anchors.head[0];cy=a.rig.anchors.head[1]+h*.22;
 }else{
  let b=shot.framing??[Math.min(...list.map(a=>a.bounds[0])),Math.min(...list.map(a=>a.bounds[1])),Math.max(...list.map(a=>a.bounds[2])),Math.max(...list.map(a=>a.bounds[3]))];
  if(shot.type==='wide'){
   for(let pass=0;pass<3;pass++){
    const height=Math.max((b[3]-b[1])/.56,(b[2]-b[0]+scale*.003)*1920/1080)/(shot.move==='dolly'?Math.min(shot.zoomFrom??(shot.zoom??1)/1.2,shot.zoomTo??shot.zoom??1):(shot.zoom??1));
    const test=constrain({cx:(b[0]+b[2])/2,cy:b[3]-height*.4,h:height},state.scene.set);
    for(const o of Object.values(state.objects)){
     if(o.hidden||o.owner.actor&&!ids.includes(o.owner.actor))continue;const ob=objectBounds(o);
     if(ob[0]<0||ob[2]>state.scene.set.plate.w||ob[1]<0||ob[3]>state.scene.set.plate.h)continue;
     if(ob[2]<test.x||ob[0]>test.x+test.w||ob[3]<test.y||ob[1]>test.y+test.h)continue;
     b=[Math.min(b[0],ob[0]),Math.min(b[1],ob[1]),Math.max(b[2],ob[2]),Math.max(b[3],ob[3])];
    }
   }
   minFit=Math.max(b[3]-b[1]+scale*.02,(b[2]-b[0]+scale*.003)*1920/1080);
  }
  cx=(b[0]+b[2])/2;
  h=Math.max((b[3]-b[1])/(shot.type==='wide'?.56:.76),(b[2]-b[0]+scale*(shot.type==='wide'?.003:.035))*1920/1080);
  if(shot.type==='wide'){
   if(shot.move==='dolly')h=Math.max(h,minFit*Math.max(shot.zoomFrom??(shot.zoom??1)/1.2,shot.zoomTo??shot.zoom??1));
   else h=Math.min(h,Math.max(state.scene.set.plate.h,minFit));
  }
  cy=b[3]+h*.10-h/2;
 }
 if(subtitles&&['two','medium'].includes(shot.type)){
  safeBottom=shot.safeBottom??Math.max(...list.flatMap(a=>['leftHand','rightHand'].map(k=>a.rig.anchors[k][1]+a.rig.scale*.035)));
  for(const o of Object.values(state.objects).filter(o=>!o.hidden&&ids.includes(o.owner.actor))){const d=PROPS[o.prop];safeBottom=Math.max(safeBottom,o.point[1]+(d.h/2-d.grip[1])*o.scale);}
  // Enough space between the top of the subject and the last protected hand/object.
  const top=shot.framing?.[1]??Math.min(...list.map(a=>a.bounds[1]));
  h=Math.max(h,(safeBottom-top)/(.698-.035));
 }
 const offset=shot.offset??[0,0];return constrain({cx:cx+offset[0],cy:cy+offset[1],h:Math.max(minFit,h/(shot.zoom??1)),safeBottom},state.scene.set);
}
/** Pure arbitrary-time camera; caches contain only immutable derived trajectories. */
export function cameraAt(compiled,t,state,options={}){return plannedCameraAt(compiled,t,state,options,rectFor,cameraAt);}
export const worldToScreen=(p,c,w=c.view?.w??1080,h=c.view?.h??1920)=>[(p[0]-c.x)*w/c.w,(p[1]-c.y)*h/c.h];
