import {actorBounds,faceBounds,paintedObjectBounds,unionBounds} from './bounds.js';
import {safeArea} from './view.js';

/** Independent verification from actual drawing geometry, not camera's fitted box. */
export function framingAt(state,cam,subtitles=true){
 const safe=safeArea(cam.view,subtitles),close=cam.type==='close',insert=cam.type==='insert';
 let boxes;
 if(close){const a=state.actors[cam.target]??Object.values(state.actors)[0];boxes={[a.id]:faceBounds(a,state.t)};}
 else if(insert){const o=state.objects[cam.target];boxes=o&&!o.hidden?{[o.id]:paintedObjectBounds(o)}:{};const e=state.active.find(e=>e.action==='eat'&&e.object===o?.id);if(e)boxes[e.who]=faceBounds(state.actors[e.who],state.t);}
 else boxes=Object.fromEntries(Object.values(state.actors).map(a=>[a.id,unionBounds([actorBounds(a,state.t),...Object.values(state.objects).filter(o=>!o.hidden&&o.owner.actor===a.id).map(paintedObjectBounds)])]));
 return Object.entries(boxes).map(([id,b])=>{
  const normalized=[(b[0]-cam.x)/cam.w,(b[1]-cam.y)/cam.h,(b[2]-cam.x)/cam.w,(b[3]-cam.y)/cam.h];
  const ok=normalized[0]>=safe.left-1e-8&&normalized[1]>=safe.top-1e-8&&normalized[2]<=safe.right+1e-8&&normalized[3]<=safe.bottom+1e-8;
  return {id,bounds:b,normalized,ok};
 });
}
/** Pixel evidence for continuous padding: opaque textured underlay and zero-alpha
 * plate boundary. Thus the foreground cannot introduce a visible plate edge. */
export function plateIntegrity(plate){
 if(!plate?.backdrop||!plate?.feathered)return {ok:false,reason:'falta relleno precalculado'};
 const {backdrop,feathered}=plate,w=backdrop.width,h=backdrop.height,b=backdrop.getContext('2d').getImageData(0,0,w,h).data,f=feathered.getContext('2d').getImageData(0,0,w,h).data;
 let minAlpha=255,maxEdgeAlpha=0;const colors=new Set();let total=0,total2=0,n=0;
 for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const i=(y*w+x)*4;minAlpha=Math.min(minAlpha,b[i+3]);const l=(b[i]+b[i+1]+b[i+2])/3;total+=l;total2+=l*l;n++;colors.add((b[i]<<16)|(b[i+1]<<8)|b[i+2]);}
 for(let x=0;x<w;x++)for(const y of [0,h-1])maxEdgeAlpha=Math.max(maxEdgeAlpha,f[(y*w+x)*4+3]);
 for(let y=0;y<h;y++)for(const x of [0,w-1])maxEdgeAlpha=Math.max(maxEdgeAlpha,f[(y*w+x)*4+3]);
 if(plate.blurredFeathered){const f=plate.blurredFeathered.getContext('2d').getImageData(0,0,w,h).data;for(let x=0;x<w;x++)for(const y of [0,h-1])maxEdgeAlpha=Math.max(maxEdgeAlpha,f[(y*w+x)*4+3]);for(let y=0;y<h;y++)for(const x of [0,w-1])maxEdgeAlpha=Math.max(maxEdgeAlpha,f[(y*w+x)*4+3]);}
 const variance=total2/n-(total/n)**2;
 return {opaque_min_alpha:minAlpha,plate_edge_max_alpha:maxEdgeAlpha,texture_colors:colors.size,luminance_variance:variance,ok:minAlpha===255&&maxEdgeAlpha<=7&&colors.size>64&&variance>1};
}
