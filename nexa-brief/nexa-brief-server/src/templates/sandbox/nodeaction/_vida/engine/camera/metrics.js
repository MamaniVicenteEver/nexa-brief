/** Camera-only audit. Derivatives never cross an editorial boundary. */
export const DEFAULT_LIMITS={maxZoomRate:.30,maxPan:.35,maxZoomAcceleration:1.2,maxPanAcceleration:1.4,maxZoomJerk:8,maxPanJerk:10};
const percentile=(a,q=.99)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(q*a.length)-1]:0;
const subject=s=>JSON.stringify([...(s.targets??(s.target?[s.target]:[]))].sort());
export function cameraMetrics(traces,limits=DEFAULT_LIMITS){
 const shots=[],jumps=[],continuity=[];
 for(const trace of traces){
  const {shot,scene}=trace,priorTrace=traces[traces.indexOf(trace)-1],continuous=priorTrace?.scene===scene&&['move','dissolve'].includes(shot.transition),frames=continuous?[...priorTrace.frames.slice(-3),...trace.frames]:trace.frames,zoom=[],pan=[],za=[],pa=[],zj=[],pj=[];let oldV,oldA;
  let inversions=0,lastSign=0,lastTurn=-Infinity;
  for(let i=1;i<frames.length;i++){
   const a=frames[i-1],b=frames[i],dt=b.t-a.t;
   const v=[Math.log2(b.h/a.h)/dt,(b.cx-a.cx)/Math.min(a.w,b.w)/dt,(b.cy-a.cy)/Math.min(a.w,b.w)/dt];
   zoom.push(Math.abs(v[0]));pan.push(Math.hypot(v[1],v[2]));
   const sign=Math.abs(v[0])>1e-5?Math.sign(v[0]):0;
   if(sign){if(lastSign&&sign!==lastSign&&b.t-lastTurn<=1)inversions++;lastTurn=b.t;lastSign=sign;}
   if(oldV){const acc=v.map((x,k)=>(x-oldV[k])/dt);za.push(Math.abs(acc[0]));pa.push(Math.hypot(acc[1],acc[2]));if(oldA){const jerk=acc.map((x,k)=>(x-oldA[k])/dt);zj.push(Math.abs(jerk[0]));pj.push(Math.hypot(jerk[1],jerk[2]));}oldA=acc;}oldV=v;
  }
  if(continuous&&trace.entry&&priorTrace.exit)continuity.push({at:shot.t0,error:Math.max(...['h','cx','cy'].map(k=>Math.abs(trace.entry[k]-priorTrace.exit[k])))});
  const h=trace.frames.map(f=>Math.log(f.h)),stationary=['fixed','hold',undefined].includes(shot.move)&&!['move','dissolve','whip'].includes(shot.transition),whip=shot.move==='whip'||shot.transition==='whip';
  const p99={zoom:percentile(zoom),pan:percentile(pan),zoomAcceleration:percentile(za),panAcceleration:percentile(pa),zoomJerk:percentile(zj),panJerk:percentile(pj)};
  shots.push({scene,t0:shot.t0,t1:shot.t1,type:shot.type,target:shot.target,move:shot.move,transition:shot.transition,stationary,whip,p99,inversions,logRange:h.length?Math.max(...h)-Math.min(...h):0,headroomFailures:frames.filter(f=>f.headroomOK===false).length,leadRoomFailures:frames.filter(f=>f.leadRoomOK===false).length});
  const prior=traces[traces.indexOf(trace)-1];
  if(prior&&prior.scene===scene&&subject(prior.shot)===subject(shot)&&!['move','dissolve','whip'].includes(shot.transition)&&shot.move!=='whip'){
   const a=prior.exit??prior.frames.at(-1),b=trace.entry??trace.frames[0];if(a&&b){const change=Math.max(a.h/b.h,b.h/a.h)-1;if(change<.25-1e-6)jumps.push({at:shot.t0,subject:subject(shot),change});}
  }
 }
 const normal=shots.filter(s=>!s.whip),p99=Object.fromEntries(Object.keys(normal[0]?.p99??{zoom:0,pan:0,zoomAcceleration:0,panAcceleration:0,zoomJerk:0,panJerk:0}).map(k=>[k,Math.max(0,...normal.map(s=>s.p99[k]))]));
 const criteria={camara_continuidad:continuity.every(c=>c.error<.01),camara_velocidad:normal.every(s=>s.p99.zoom<=limits.maxZoomRate+1e-6&&s.p99.pan<=limits.maxPan+1e-6),camara_aceleracion:normal.every(s=>s.p99.zoomAcceleration<=limits.maxZoomAcceleration+1e-6&&s.p99.panAcceleration<=limits.maxPanAcceleration+1e-6),camara_jerk:normal.every(s=>s.p99.zoomJerk<=limits.maxZoomJerk+1e-6&&s.p99.panJerk<=limits.maxPanJerk+1e-6),sin_bombeo:shots.filter(s=>s.stationary).every(s=>s.logRange<=.015&&s.inversions===0),plano_minimo:shots.every((s,i)=>{if(s.whip||s.type==='insert')return true;let start=s.t0,end=s.t1;for(let j=i;j>0&&shots[j].scene===shots[j-1].scene&&shots[j].transition==='move';j--)start=shots[j-1].t0;for(let j=i+1;j<shots.length&&shots[j].scene===s.scene&&shots[j].transition==='move';j++)end=shots[j].t1;return end-start>=1.2-1e-6;}),sin_salto:jumps.length===0,margen_headroom:shots.every(s=>!s.headroomFailures),leadRoom:shots.every(s=>!s.leadRoomFailures)};
 return {fps:30,limits,p99,continuity,safetyCorrections:traces.reduce((n,tr)=>n+tr.frames.filter(f=>f.safetyCorrection).length,0),inversions:shots.reduce((n,s)=>n+s.inversions,0),stationaryInversions:shots.filter(s=>s.stationary).reduce((n,s)=>n+s.inversions,0),jumps,shots,criteria,failed:Object.keys(criteria).filter(k=>!criteria[k])};
}
export function collectCameraTrace(c,cameraAt,sampleScene,options={}){
 return c.scenes.flatMap(scene=>scene.cameraPlan.map(shot=>{
  const frames=[];
  for(let f=Math.ceil((shot.t0-1e-9)*30);f/30<shot.t1-1e-9;f++){
   const t=f/30,s=sampleScene(c,t),cam=cameraAt(c,t,s,options);
   frames.push({t,h:cam.h,w:cam.w,cx:cam.cx,cy:cam.cy,headroomOK:cam.composition?.headroomOK,leadRoomOK:cam.composition?.leadRoomOK,safetyCorrection:cam.safetyCorrection});
  }
  const pick=t=>{const r=cameraAt(c,t,undefined,options);return {h:r.h,cx:r.cx,cy:r.cy};};
  return {scene:scene.id,shot,frames,entry:pick(shot.t0),exit:pick(shot.t1-1e-7)};
 }));
}
