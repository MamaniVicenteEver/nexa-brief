import {PROPS,propBounds} from '../props/index.js';

const intersect=(a,b)=>[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
const area=b=>Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1]);
export function objectBounds(o){
 const d=PROPS[o.prop],corners=[[-d.w/2,-d.h/2],[d.w/2,-d.h/2],[d.w/2,d.h/2],[-d.w/2,d.h/2]].map(([x,y])=>{x=(x-d.grip[0])*o.scale;y=(y-d.grip[1])*o.scale;return [o.point[0]+x*Math.cos(o.angle)-y*Math.sin(o.angle),o.point[1]+x*Math.sin(o.angle)+y*Math.cos(o.angle)];});
 return [Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
}
// Painted regions, not the empty rectangle between a table's legs.
export function propRegions(p){
 const h=p.params?.h??PROPS[p.prop].h,sy=p.params?.surfaceY??p.y-h,l=p.x-p.w/2,r=p.x+p.w/2;
 if(p.prop==='counter')return [[l-4,sy-8,r+4,p.y]];
 if(['table','desk'].includes(p.prop))return [[l,sy,r,sy+20],...[-1,1].map(sign=>[p.x+sign*p.w*.4-3.5,sy,p.x+sign*p.w*.4+3.5,p.y])];
 if(['chair','bench'].includes(p.prop)){const seat=p.params?.seatY??p.y-h*.5;return [[l,p.y-h,r,p.y-h*.6],[l,seat,r,seat+14],...[-1,1].map(sign=>[p.x+sign*p.w*.4-3,seat,p.x+sign*p.w*.4+3,p.y])];}
 return [propBounds(p)];
}
function unionArea(boxes){
 const xs=[...new Set(boxes.flatMap(b=>[b[0],b[2]]))].sort((a,b)=>a-b);let sum=0;
 for(let i=1;i<xs.length;i++){const lo=xs[i-1],hi=xs[i],ys=boxes.filter(b=>b[0]<hi&&b[2]>lo).map(b=>[b[1],b[3]]).sort((a,b)=>a[0]-b[0]);let end=-Infinity;for(const [a,b] of ys){sum+=(hi-lo)*Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}}
 return sum;
}
export function compositionAt(state,cam){
 const frame=[cam.x,cam.y,cam.x+cam.w,cam.y+cam.h],subjects=[],occlusions=[],content=[];
 for(const a of Object.values(state.actors)){
  const visible=intersect(a.bounds,frame);if(area(visible)>0)content.push(visible);
  if(cam.targets.includes(a.id)&&['wide','two','medium','close'].includes(cam.type)){
   const head=a.rig.anchors.head,r=(a.character.head?.radius??.17)*a.rig.scale;
   const bounds=cam.type==='close'?[head[0]-r,head[1]-r,head[0]+r,head[1]+r]:a.bounds;
   const b=intersect(bounds,frame),ratio=area(b)>0?Math.max(0,b[3]-b[1])/cam.h:0,minimum=cam.fit?(cam.type==='close'?.25:cam.view.orientation==='portrait'?.18:.28):cam.type==='close'?.25:cam.type==='wide'?.28:.55;
   subjects.push({actor:a.id,ratio,minimum,ok:ratio+1e-8>=minimum});
  }
  const head=a.rig.anchors.head,r=(a.character.head?.radius??.17)*a.rig.scale,hip=a.rig.anchors.hip,neck=a.rig.anchors.neck;
  const regions={face:[head[0]-r,head[1]-r,head[0]+r,head[1]+r],torso:[Math.min(neck[0],hip[0])-a.rig.scale*.08,neck[1],Math.max(neck[0],hip[0])+a.rig.scale*.08,hip[1]+a.rig.scale*.035]};
  for(const p of state.props.filter(p=>p.layer==='front')){
   const id=p.id??p.prop,seat=typeof a.seated==='string'?state.scene.set.anchors[a.seated]:a.seated?{x:a.seated[0],y:a.seated[1]}:null;
   const ownSeat=seat&&['chair','bench'].includes(p.prop)&&Math.abs(p.x-seat.x)<=p.w/2&&Math.abs(p.y-seat.y)<state.scene.set.charHeight*.2;
   if(a.behind===id||ownSeat)continue;
   for(const [region,box]of Object.entries(regions)){
    const visibleRegion=intersect(box,frame);if(area(visibleRegion)<=0)continue;
    const covered=propRegions(p).map(b=>intersect(b,visibleRegion)).filter(b=>area(b)>0),ratio=unionArea(covered)/area(visibleRegion);
    occlusions.push({actor:a.id,prop:id,region,ratio,ok:ratio<=.35+1e-8});
   }
  }
 }
 for(const o of Object.values(state.objects))if(!o.hidden){const b=intersect(objectBounds(o),frame);if(area(b)>0)content.push(b);}
 for(const p of state.props)for(const region of propRegions(p)){const b=intersect(region,frame);if(area(b)>0)content.push(b);}
 const bottom=content.length?Math.max(...content.map(b=>b[3])):cam.y;
 const empty=Math.max(0,(cam.y+cam.h-bottom)/cam.h),opening=cam.fit||cam.type==='wide'&&Math.abs(cam.shot.t0-state.scene.t0)<1e-6;
 return {subjects,occlusions,emptyFloor:{ratio:empty,exempt:opening,ok:opening||empty<=.22+1e-8}};
}
export function createCompositionMetrics(){return {
 sujeto_suficiente:{samples:0,min_ratio_by_shot:{},violations:[],failed_samples:0},
 sin_suelo_vacio:{samples:0,max_ratio:0,opening_wide_samples:0,violations:[],failed_samples:0},
 objeto_no_tapa_cuerpo:{samples:0,max_ratio:0,violations:[],failed_samples:0},
 transition_frames:0
};}
export function recordComposition(metrics,state,cam){
 if(cam.transitioning){metrics.transition_frames++;return;}
 const result=compositionAt(state,cam),t=state.t;
 const record=(m,value)=>{m.samples++;if(!value.ok){m.failed_samples++;if(m.violations.length<20)m.violations.push({t,shot:cam.type,...value});}};
 for(const value of result.subjects){const m=metrics.sujeto_suficiente;record(m,value);m.min_ratio_by_shot[cam.type]=Math.min(m.min_ratio_by_shot[cam.type]??1,value.ratio);}
 const floor=metrics.sin_suelo_vacio;record(floor,result.emptyFloor);if(result.emptyFloor.exempt)floor.opening_wide_samples++;else floor.max_ratio=Math.max(floor.max_ratio,result.emptyFloor.ratio);
 for(const value of result.occlusions){const m=metrics.objeto_no_tapa_cuerpo;record(m,value);m.max_ratio=Math.max(m.max_ratio,value.ratio);}
}
