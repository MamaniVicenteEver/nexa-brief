import {cameraConfig} from './config.js';
const signature=s=>JSON.stringify([s.type,s.target,s.targets]);
const subject=s=>JSON.stringify([...(s.targets??(s.target?[s.target]:[]))].sort());
/** Event-driven editorial decisions. Overrides always outrank automatic candidates. */
export function buildShotPlan(scene,lines,settings={}){
 const config=cameraConfig(settings),ids=Object.keys(scene.actors),candidates=[];
 const add=(shot,priority)=>{if(shot.t1>shot.t0)candidates.push({...shot,priority,key:`${priority}:${candidates.length}`,frameAt:shot.t0,motionStart:shot.t0,motionEnd:shot.t1});};
 add({type:'two',targets:ids,move:'hold',t0:scene.t0,t1:scene.t1,auto:true,motivation:'situación inicial'},0);
 for(const [i,line]of lines.entries()){
  if(line.offscreen){add({type:'wide',targets:ids,move:'hold',t0:line.t0,t1:line.t1,auto:true,motivation:'inicio de narración'},20);continue;}
  const intense=line.intent==='exclaim'||['shock','laugh','love','annoyed'].includes(line.faceState?.expression),emotional=intense||line.intent==='whisper'||line.emotion&&line.emotion!=='neutral';
  add({type:intense?'close':'medium',target:line.who,move:emotional?'push':line.t1-line.t0>=4?'drift':'hold',amount:.06,t0:line.t0,t1:line.t1,auto:true,motivation:emotional?'emoción de la línea':'turno de hablante'},30);
 }
 for(const e of scene.events){
  if(e.action==='walk'){
   add({type:'wide',target:e.who,move:'follow',t0:e.t0,t1:e.t1,auto:true,motivation:'acompañar desplazamiento'},80);
   if(scene.t1-e.t1>=config.minShot)add({type:'two',targets:ids,move:'reveal',amount:.06,t0:e.t1,t1:Math.min(scene.t1,e.t1+config.minShot),auto:true,motivation:'llegada al grupo'},25);
  }
  if(e.action==='react'&&(e.intensity??1)>=.7)add({type:'close',target:e.who,move:'push',amount:.06,t0:e.t0,t1:Math.min(scene.t1,Math.max(e.t1,e.t0+config.minShot)),auto:true,motivation:'reacción del oyente'},60);
  if(['give','eat'].includes(e.action))add({type:'insert',target:e.object,move:'follow',t0:Math.max(e.t0,(e.t0+e.t1)/2-2.5),t1:Math.min(e.t1,(e.t0+e.t1)/2+2.5),auto:true,motivation:'detalle de la acción'},100);
 }
 for(const s of scene.shots)add({...s,auto:false,motivation:'override JSON'},s.type==='two'&&!s.locked?10:110);
 const edges=[...new Set([scene.t0,scene.t1,...candidates.flatMap(s=>[s.t0,s.t1])])].sort((a,b)=>a-b),plan=[];
 for(let i=0;i<edges.length-1;i++){
  const start=edges[i],end=edges[i+1],mid=(start+end)/2,s=candidates.filter(s=>mid>=s.t0&&mid<s.t1).sort((a,b)=>a.priority-b.priority).at(-1),last=plan.at(-1);
  if(!s)continue;if(last?.key===s.key)last.t1=end;else plan.push({...s,t0:start,t1:end,frameAt:start,transition:start===s.t0?s.transition:'cut'});
 }
 // Remove short automatic fragments, without moving any explicit editorial boundary.
 for(let i=0;i<plan.length;i++){
  const s=plan[i];if(s.auto===false&&s.priority!==10||s.type==='insert'||s.transition==='whip'||s.t1-s.t0>=config.minShot-1e-9)continue;
  const prev=plan[i-1],next=plan[i+1];
  if(prev?.auto!==false&&prev){prev.t1=s.t1;plan.splice(i--,1);}
  else if(next?.auto!==false&&next){next.t0=s.t0;next.frameAt=s.t0;plan.splice(i--,1);}
  else if(prev){s.type=prev.type;s.target=prev.target;s.targets=prev.targets;s.move='hold';s.holdAt=prev.t1-1e-6;s.transition='move';s.continuation=true;}
 }
 for(let i=1;i<plan.length;i++){
  const a=plan[i-1],b=plan[i];
  if(subject(a)===subject(b)){
   if(signature(a)===signature(b)&&a.auto!==false&&b.auto!==false&&a.move===b.move&&b.t1-a.t0<=6){a.t1=b.t1;plan.splice(i--,1);continue;}
   // Actual optical sizes are view-dependent. A continuous move is safe in both views.
   if((!b.transition||b.transition==='cut')&&(a.type===b.type||!['close','insert'].includes(a.type)&&!['close','insert'].includes(b.type)))b.transition='move';
  }
  if(a.type==='insert'&&b.type!=='insert'&&b.auto!==false){let j=i-2;while(j>=0&&plan[j].type==='insert')j--;if(j>=0){const prior=plan[j];Object.assign(b,{type:prior.type,target:prior.target,targets:prior.targets,move:'hold',resumeAt:prior.t1-1e-6,transition:'cut',motivation:'retorno del detalle'});}}
 }
 let runStart=scene.t0;
 for(let i=0;i<plan.length;i++){const s=plan[i],a=plan[i-1];if(!a||signature(a)!==signature(s))runStart=s.t0;else if(s.auto!==false&&s.t1-runStart>6&&s.type!=='insert'&&!s.continuation){const listener=ids.find(id=>id!==s.target);if(listener){s.target=listener;delete s.targets;s.type='close';s.move='push';s.transition='cut';delete s.resumeAt;s.motivation='reacción del oyente en el siguiente beat';runStart=s.t0;}}}
 for(let i=1;i<plan.length;i++){const a=plan[i-1],b=plan[i];if(a.move==='dolly'&&['fixed','hold',undefined].includes(b.move)&&signature(a)===signature(b)&&(a.to?.zoom??a.zoomTo??a.zoom??1)===(b.zoom??1)){b.holdAt=a.t1-1e-6;b.transition='move';b.continuation=true;}}
 for(const s of plan){if(s.auto!==false&&['medium','close'].includes(s.type)&&s.t1-s.t0>=4&&s.move==='hold')s.move='drift';s.motionStart=s.t0;s.motionEnd=s.t1;}
 for(let i=1;i<plan.length;i++){const a=plan[i-1],b=plan[i];if(subject(a)===subject(b)&&a.type===b.type&&b.auto!==false&&(!b.transition||b.transition==='cut')&&b.resumeAt==null)b.transition='move';}
 return plan;
}
