import {drawRig} from '../rig/draw.js';
import {drawHairBack,drawHairFront} from '../rig/hair.js';
import {drawProp} from '../props/index.js';

export const unionBounds=boxes=>[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
const empty=()=>[Infinity,Infinity,-Infinity,-Infinity];
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
/** Canvas geometry recorder: runs the actual rig paths, including hair, rotated hands,
 * shoes and ink. Bezier control hulls and complete ellipses are conservative bounds;
 * clipping is deliberately ignored so the result cannot underestimate painted pixels. */
export function boundsContext(){
 let matrix=[1,0,0,1,0,0],stack=[],path=empty(),result=empty();
 const ctx={lineWidth:1,globalAlpha:1,
  save(){stack.push({matrix:matrix.slice(),lineWidth:this.lineWidth,globalAlpha:this.globalAlpha});},
  restore(){const s=stack.pop();matrix=s.matrix;this.lineWidth=s.lineWidth;this.globalAlpha=s.globalAlpha;},
  translate(x,y){matrix=mul(matrix,[1,0,0,1,x,y]);},scale(x,y){matrix=mul(matrix,[x,0,0,y,0,0]);},rotate(a){matrix=mul(matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
  beginPath(){path=empty();},closePath(){},clip(){},
  moveTo(x,y){this.lineTo(x,y);},lineTo(x,y){const p=[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];path=unionBounds([path,[...p,...p]]);},
  quadraticCurveTo(...p){for(let i=0;i<p.length;i+=2)this.lineTo(p[i],p[i+1]);},
  bezierCurveTo(...p){for(let i=0;i<p.length;i+=2)this.lineTo(p[i],p[i+1]);},
  ellipse(x,y,rx,ry,angle){const c=Math.cos(angle),s=Math.sin(angle),cx=matrix[0]*x+matrix[2]*y+matrix[4],cy=matrix[1]*x+matrix[3]*y+matrix[5],dx=Math.hypot(rx*(matrix[0]*c+matrix[2]*s),ry*(-matrix[0]*s+matrix[2]*c)),dy=Math.hypot(rx*(matrix[1]*c+matrix[3]*s),ry*(-matrix[1]*s+matrix[3]*c));path=unionBounds([path,[cx-dx,cy-dy,cx+dx,cy+dy]]);},
  arc(x,y,r,start,end){this.ellipse(x,y,r,r,0,start,end);},
  rect(x,y,w,h){for(const p of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]])this.lineTo(...p);},
  roundRect(x,y,w,h){this.rect(x,y,w,h);},
  fill(){if(this.globalAlpha>0)result=unionBounds([result,path]);},
  stroke(){if(this.globalAlpha<=0)return;const dx=this.lineWidth/2*Math.hypot(matrix[0],matrix[2]),dy=this.lineWidth/2*Math.hypot(matrix[1],matrix[3]);result=unionBounds([result,[path[0]-dx,path[1]-dy,path[2]+dx,path[3]+dy]]);},
  fillRect(x,y,w,h){this.beginPath();this.rect(x,y,w,h);this.fill();},
  bounds:()=>result
 };
 return ctx;
}
const cache=new WeakMap();
export function actorBounds(a,t){
 if(cache.has(a))return cache.get(a);
 const ctx=boundsContext();drawRig(ctx,a.character,a.rig,a.face,t);const bounds=ctx.bounds();cache.set(a,bounds);return bounds;
}
export function faceBounds(a,t){
 const ctx=boundsContext(),r=a.rig;
 ctx.translate(r.p.x,r.p.y);ctx.scale(r.scale,r.scale);ctx.translate(...r.head);ctx.rotate(r.headAngle);ctx.scale(r.r,r.r);
 ctx.beginPath();ctx.ellipse(0,0,a.character.head?.roundness??1,1,0);ctx.lineWidth=(a.character.ink?.width??.012)/r.r;ctx.fill();ctx.stroke();
 drawHairBack(ctx,a.character,r,t);drawHairFront(ctx,a.character,r,t);return ctx.bounds();
}
export function paintedObjectBounds(o){const ctx=boundsContext();drawProp(ctx,o.prop,{x:o.point[0],y:o.point[1],angle:o.angle,scale:o.scale,params:o.params});return ctx.bounds();}
