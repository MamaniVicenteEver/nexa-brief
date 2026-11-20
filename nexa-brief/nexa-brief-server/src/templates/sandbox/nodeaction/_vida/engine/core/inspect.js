import {sampleScene} from './sample.js';
import {cameraAt,worldToScreen} from '../camera/index.js';
import {subtitleAt} from '../ui/index.js';
import {PROPS} from '../props/index.js';
import {conversationDistance,headWidth} from './staging.js';

/** Only furniture at a seat actually used in this episode is checked. */
export function seatSurfaceWarnings(compiled) {
 const warnings=[];
 for(const scene of compiled.scenes){
  const uses=[...Object.values(scene.actors).filter(a=>a.seated).map(a=>({who:a.id,seat:scene.set.anchors[a.seated],path:`${scene.path}.actors.${a.id}.start.seated`})),...scene.events.filter(e=>e.action==='sit').map(e=>({who:e.who,seat:{x:e.seat[0],y:e.seat[1]},path:e.path+'.seat'}))];
  const seen=new Set();
  for(const use of uses){
   const chair=scene.set.props.find(p=>['chair','bench'].includes(p.prop)&&Math.abs(p.x-use.seat.x)<=p.w/2&&Math.abs(p.y-use.seat.y)<scene.set.charHeight*.2);
   if(!chair)continue;
   for(const [i,table] of scene.set.props.entries()){
    if(!['table','desk'].includes(table.prop)||Math.abs(table.x-use.seat.x)>table.w/2||Math.abs(table.y-use.seat.y)>scene.set.charHeight*.2)continue;
    const key=use.who+':'+i;if(seen.has(key))continue;seen.add(key);
    const ratio=(chair.params.seatY-(table.params.surfaceY??table.y-table.params.h))/scene.set.charHeight;
    if(ratio<.16-1e-8||ratio>.2+1e-8)warnings.push({path:use.path,code:'seat-surface-height',actor:use.who,table:table.id??table.prop,ratio,message:`${use.who}: ${table.id??table.prop} usado sentado queda a ${ratio.toFixed(3)} × charHeight sobre seatY; rango esperado 0.16–0.20 (${scene.path}.set.props[${i}].params.surfaceY).`});
   }
  }
 }
 return warnings;
}

export function inspectEpisode(compiled,{fps=30,view='portrait',framing}={}) {
 const overlaps=[],running=new Map(),warnings=seatSurfaceWarnings(compiled);
 const knees={samples:0,backward:0},safe={samples:0,max_hand_bottom_px:0,max_object_bottom_px:0,violations:[]};
 const closeRun=(key,t)=>{const r=running.get(key);if(!r)return;const duration=t-r.start;if(duration>.3+1e-6){const item={...r,end:t,duration};overlaps.push(item);warnings.push({path:r.path,code:'head-overlap',message:`cabezas ${r.actors.join(' / ')} solapadas ${duration.toFixed(2)} s (${r.start.toFixed(2)}–${t.toFixed(2)})`});}running.delete(key);};
 for(let frame=0;frame<Math.ceil(compiled.duration*fps);frame++){
  const t=frame/fps,state=sampleScene(compiled,t),cam=cameraAt(compiled,t,state,{view,framing}),actors=Object.values(state.actors),seen=new Set();
  for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
   const a=actors[i],b=actors[j],key=`${state.scene.id}:${a.id}:${b.id}`;
   const exempt=state.active.some(e=>['give','highfive'].includes(e.action)&&[e.who,e.to??e.recipient].includes(a.id)&&[e.who,e.to??e.recipient].includes(b.id));
   const dx=Math.abs(a.rig.anchors.head[0]-b.rig.anchors.head[0]),dy=Math.abs(a.rig.anchors.head[1]-b.rig.anchors.head[1]);
   if(!exempt&&dx<(a.rig.scale+b.rig.scale)*.20&&dy<(a.rig.scale+b.rig.scale)*.22){seen.add(key);if(!running.has(key))running.set(key,{actors:[a.id,b.id],start:t,path:state.scene.path+'.actors'});}
  }
  for(const key of running.keys())if(!seen.has(key))closeRun(key,t);
  for(const e of state.active.filter(e=>e.action==='walk')){
   const a=state.actors[e.who],dir=Math.sign(e.to[0]-e.from[0])||1;
   for(const side of ['left','right']){const leg=a.rig.limbs[side].leg,v=[leg.end[0]-leg.origin[0],leg.end[1]-leg.origin[1]],cross=v[0]*(leg.joint[1]-leg.origin[1])-v[1]*(leg.joint[0]-leg.origin[0]);knees.samples++;if(cross*dir>1e-8)knees.backward++;}
  }
  if(['medium','two'].includes(cam.type)&&!cam.transitioning&&subtitleAt(compiled,t)&&compiled.episode.ui?.subtitles!==false){
   safe.samples++;
   for(const id of cam.targets){const a=state.actors[id];if(!a)continue;for(const side of ['left','right']){const point=a.rig.anchors[side+'Hand'],y=worldToScreen([point[0],point[1]+a.rig.scale*.035],cam)[1];safe.max_hand_bottom_px=Math.max(safe.max_hand_bottom_px,y);if(y>(cam.fit?cam.safe.bottom*cam.view.h:1340)+.5&&safe.violations.length<20)safe.violations.push({t,actor:id,side,y});}}
   for(const o of Object.values(state.objects)){if(o.hidden||!cam.targets.includes(o.owner.actor))continue;const d=PROPS[o.prop],y=worldToScreen([o.point[0],o.point[1]+(d.h/2-d.grip[1])*o.scale],cam)[1];safe.max_object_bottom_px=Math.max(safe.max_object_bottom_px,y);if(y>(cam.fit?cam.safe.bottom*cam.view.h:1340)+.5&&safe.violations.length<20)safe.violations.push({t,object:o.id,y});}
  }
 }
 for(const key of running.keys())closeRun(key,compiled.duration);
 const spans=[];const insertReturns=[];
 for(const scene of compiled.scenes){
  for(const shot of scene.cameraPlan){const key=JSON.stringify([scene.id,shot.type,shot.target,(shot.targets??[]).slice().sort()]),last=spans.at(-1);if(last?.key===key)last.end=shot.t1;else spans.push({key,type:shot.type,target:shot.target,start:shot.t0,end:shot.t1});
   if(shot.resumeAt!=null){const before=cameraAt(compiled,shot.resumeAt,undefined,{view,framing}),after=cameraAt(compiled,shot.t0,undefined,{view,framing});insertReturns.push({at:shot.t0,previousAt:shot.resumeAt,fit_adjusted:before.fit,max_rect_error_px:Math.max(...['x','y','w','h','viewportHeight'].map(k=>Math.abs(before[k]-after[k])))});}
  }
 }
 const stops=compiled.scenes.flatMap(scene=>scene.events.filter(e=>e.action==='walk'&&e.faceTo).map(e=>{const state=sampleScene(compiled,Math.min(e.t1,compiled.duration-1e-6)),a=state.actors[e.who],b=state.actors[e.faceTo];return {actor:e.who,to:e.faceTo,t:e.t1,center_distance_px:Math.abs(a.pose.x-b.pose.x),minimum_center_distance_px:conversationDistance(scene.actors[e.who],scene.actors[e.faceTo],e.spacing??1.15),edge_gap_in_head_widths:(Math.abs(a.pose.x-b.pose.x)-(headWidth(a)+headWidth(b))/2)/((headWidth(a)+headWidth(b))/2)};}));
 return {warnings,head_overlaps:overlaps,knees,subtitle_safe:safe,conversation_stops:stops,camera:{max_same_framing_seconds:Math.max(0,...spans.map(s=>s.end-s.start)),spans:spans.map(({key,...s})=>s),insert_returns:insertReturns},subtitles:{aligned_words:compiled.lines.reduce((n,l)=>n+(l.subtitleWords?.length??0),0),fallbacks:compiled.warnings.filter(w=>w.code==='subtitle-mismatch')}};
}
