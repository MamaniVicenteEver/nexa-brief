import {cameraMetrics} from '../engine/camera/metrics.js';
import {cameraConfig} from '../engine/camera/config.js';
import {createCompositionMetrics,recordComposition,objectBounds} from '../engine/core/composition.js';
import {createCanvas} from '@napi-rs/canvas';
import {inspectEpisode} from '../engine/core/inspect.js';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {loadEpisode} from './runtime.mjs';
import {renderFrame,sampleScene,cameraAt} from '../engine/render.js';
import {mouthShape} from '../engine/face/mouth.js';
import {resolveFace} from '../engine/face/face.js';
import {PROPS} from '../engine/props/index.js';
import {framingAt,plateIntegrity} from '../engine/core/framing.js';
import {resolveView} from '../engine/core/view.js';
import {pathToFileURL} from 'node:url';
export async function reviewEpisode(c,outDir,{view='portrait',framing:framingMode='fit',every=.5,times,sheetName}={}){
 const options={view,framing:framingMode},v=resolveView(view);console.error(`Revisión ${c.episode.id} ${view}`);
 times??=[...new Set([0,...c.scenes.flatMap(s=>s.cameraPlan.map(x=>x.t0)),...Array.from({length:Math.ceil(c.duration/every)},(_,i)=>i*every)])].sort((a,b)=>a-b);
 if(times.some(t=>!Number.isFinite(t)||t<0||t>c.duration))throw new Error('Tiempos fuera de duración');
 const tileW=view==='landscape'?320:180,tileH=view==='landscape'?180:320,gap=12,label=30,cols=6,rows=Math.ceil(times.length/cols),sheet=createCanvas(cols*(tileW+gap)+gap,rows*(tileH+label+gap)+gap),sc=sheet.getContext('2d'),canvas=createCanvas(v.w/2,v.h/2),ctx=canvas.getContext('2d');sc.fillStyle='#f0ece3';sc.fillRect(0,0,sheet.width,sheet.height);
 for(const [i,t]of times.entries()){const state=renderFrame(ctx,c,t,options),x=gap+(i%cols)*(tileW+gap),y=gap+Math.floor(i/cols)*(tileH+label+gap);sc.drawImage(canvas,x,y,tileW,tileH);sc.font='15px sans-serif';sc.fillStyle='#26363b';sc.fillText(`${t.toFixed(2)} s · ${state.camera.type}`,x+3,y+tileH+20);}
 const cameraTraces=c.scenes.flatMap(scene=>scene.cameraPlan.map(shot=>({scene:scene.id,shot,frames:[]}))),cameraTraceMap=new Map(cameraTraces.map(trace=>[trace.shot,trace]));
 const composition=createCompositionMetrics(),complete={samples:0,failed_samples:0,violations:[]},overrides=new Set();
 const backgrounds=Object.fromEntries(Object.entries(c.resources.plates).map(([id,p])=>[id,plateIntegrity(p)]));
 const contacts=new Map(),foot={max_slip_px:0,samples:0,worst:null},mouth={silent_actor_frames:0,open_without_voice_frames:0,percent:0},framing={target_crop_frames:0,target_crop_details:[],offscreen_non_targets:0,whip_transition_frames:0,intentional_body_crop_frames:0,offscreen_set_objects:0,hidden_objects:0,object_crop_frames:0,object_crop_details:[]};let maxGrip=0,ownership=0;const previous=new Map();let maxStep=0;
 for(let f=0;f<Math.ceil(c.duration*30);f++){
  if(f%900===0)console.error(`${view}: ${f}/${Math.ceil(c.duration*30)} cuadros`);
  const t=f/30,s=sampleScene(c,t),cam=cameraAt(c,t,s,options);recordComposition(composition,s,cam);
  cameraTraceMap.get(cam.shot).frames.push({t,h:cam.h,w:cam.w,cx:cam.cx,cy:cam.cy,headroomOK:cam.composition?.headroomOK,leadRoomOK:cam.composition?.leadRoomOK,safetyCorrection:cam.safetyCorrection});
  if(cam.overrideAdjusted)overrides.add(cam.shot.path??cam.shot.key);
  for(const b of (cam.fit?framingAt(s,cam,c.episode.ui?.subtitles!==false&&c.lines.some(l=>l.scene===s.scene.id)):[])){complete.samples++;if(!b.ok){complete.failed_samples++;if(complete.violations.length<30)complete.violations.push({t,scene:s.scene.id,shot:cam.type,...b});}}
  for(const [id,a]of Object.entries(s.actors)){
   for(const side of ['left','right']){const sup=a.support[side],p=a.rig.anchors[side+'Foot'];if(sup?.planted){foot.samples++;const key=id+':'+side+':'+sup.contact;if(contacts.has(key)){const start=contacts.get(key),slip=Math.hypot(p[0]-start[0],p[1]-start[1]);if(slip>foot.max_slip_px){foot.max_slip_px=slip;foot.worst={id,side,t,contact:sup.contact,from:start,to:p};}}else contacts.set(key,p);}}
   const shape=mouthShape(a.face,resolveFace(a.character,a.face).mouth);if(!a.speech.voiced&&!a.eating?.open){mouth.silent_actor_frames++;if(shape.h>.015)mouth.open_without_voice_frames++;}
   const old=previous.get(id);if(old)maxStep=Math.max(maxStep,...['leftHand','rightHand','head'].map(k=>Math.hypot(a.rig.anchors[k][0]-old[k][0],a.rig.anchors[k][1]-old[k][1])));previous.set(id,a.rig.anchors);
   if(cam.type==='insert')continue;if(cam.transitioning){framing.whip_transition_frames++;continue;}
   const target=cam.targets.includes(id);const bounds=cam.fit?cam.protectedBounds[id]??a.bounds:(!cam.fit&&['close','medium'].includes(cam.type)||cam.type==='close')?[a.rig.anchors.head[0]-a.rig.scale*.18,a.rig.anchors.head[1]-a.rig.scale*.24,a.rig.anchors.head[0]+a.rig.scale*.18,a.rig.anchors.head[1]+a.rig.scale*.18]:a.bounds;
   const crop=bounds[0]<cam.x-2||bounds[2]>cam.x+cam.w+2||bounds[1]<cam.y-2||bounds[3]>cam.y+cam.h+2;
   if(crop&&target){framing.target_crop_frames++;if(framing.target_crop_details.length<15)framing.target_crop_details.push({t,id,bounds,camera:[cam.x,cam.y,cam.w,cam.h]});}else if(crop)framing.offscreen_non_targets++;
   if(target&&(cam.type==='close'||!cam.fit&&cam.type==='medium'))framing.intentional_body_crop_frames++;
  }
  for(const o of Object.values(s.objects)){ownership++;if(o.owner.actor&&o.owner.hand){const grip=s.actors[o.owner.actor].rig.anchors[o.owner.hand+'Hand'];maxGrip=Math.max(maxGrip,Math.hypot(o.point[0]-grip[0],o.point[1]-grip[1]));}
   if(o.hidden){framing.hidden_objects++;continue;}
   if(cam.fit||cam.type==='insert'||cam.type==='close'||cam.type==='medium')continue;
   const b=objectBounds(o);
   if(b[2]<0||b[0]>s.scene.set.plate.w||b[3]<0||b[1]>s.scene.set.plate.h)continue;
   if(!o.owner.actor&&(b[2]<cam.x||b[0]>cam.x+cam.w||b[3]<cam.y||b[1]>cam.y+cam.h)){framing.offscreen_set_objects++;continue;}
   if((!o.owner.actor||cam.targets.includes(o.owner.actor))&&(b[0]<cam.x||b[2]>cam.x+cam.w||b[1]<cam.y||b[3]>cam.y+cam.h)){framing.object_crop_frames++;if(framing.object_crop_details.length<12)framing.object_crop_details.push({t,id:o.id});}
  }
 }
 mouth.percent=mouth.silent_actor_frames?100*mouth.open_without_voice_frames/mouth.silent_actor_frames:0;
 const hash=t=>{renderFrame(ctx,c,t,options);return createHash('sha256').update(canvas.data()).digest('hex');};
 const seekTimes=Array.from({length:30},(_,i)=>i*(c.duration-1/30)/29),hashes=seekTimes.map(hash),order=seekTimes.map((_,i)=>(i*17+7)%30),mismatches=[];for(const i of order)if(hash(seekTimes[i])!==hashes[i])mismatches.push(i);
 const boundaries=c.scenes.flatMap(s=>s.events.flatMap(e=>[e.t0,e.t1,e.transferAt,...(e.accents??[]).flatMap(a=>[e.t0+a.at-.17,e.t0+a.at+.6])])).filter(t=>t>0&&t<c.duration);let boundaryJump=0;
 for(const t of boundaries){const a=sampleScene(c,t-1e-6),b=sampleScene(c,t+1e-6);if(a.scene.id!==b.scene.id)continue;for(const id of Object.keys(a.actors))for(const key of Object.keys(a.actors[id].rig.anchors)){const p=a.actors[id].rig.anchors[key],q=b.actors[id].rig.anchors[key];boundaryJump=Math.max(boundaryJump,Math.hypot(p[0]-q[0],p[1]-q[1]));}}
 const editorial=inspectEpisode(c,options);
 for(const trace of cameraTraces){const pick=t=>{const r=cameraAt(c,t,undefined,options);return {h:r.h,cx:r.cx,cy:r.cy};};trace.entry=pick(trace.shot.t0);trace.exit=pick(trace.shot.t1-1e-7);}
 const cameraAudit=cameraMetrics(cameraTraces,cameraConfig(c.episode.camera));
 const metrics={...editorial,camera_motion:cameraAudit,view,resolution:[v.w,v.h],framing_mode:framingMode,actores_completos:complete,sin_zona_vacia:{passed:Object.values(backgrounds).every(b=>b.ok),plates:backgrounds},overrides_adjusted:[...overrides],composition,episode:c.episode.id,duration:c.duration,fps:30,foot_slip:foot,mouth,determinism:{frames:30,resolution:[v.w/2,v.h/2],order,mismatches,ok:mismatches.length===0,hashes},objects:{ownership_samples:ownership,max_grip_error_px:maxGrip},framing,pose_motion:{max_boundary_jump_px:boundaryJump,boundary_epsilon_seconds:.000001,max_anchor_step_per_frame_px:maxStep,note:'Desplazamiento bruto a 30 fps; incluye gestos y caminata, no equivale por sí solo a un salto.'},passed:editorial.head_overlaps.length===0&&editorial.knees.backward===0&&editorial.subtitle_safe.violations.length===0&&editorial.camera.max_same_framing_seconds<=6&&editorial.camera.insert_returns.every(r=>r.fit_adjusted||r.max_rect_error_px<.001)&&boundaryJump<.05&&foot.max_slip_px<2&&mouth.percent<2&&mismatches.length===0&&maxGrip<.01&&framing.target_crop_frames===0&&framing.object_crop_frames===0};
 // Lista legible de criterios que fallan (para que cualquier agente sepa qué corregir)
 {const ck={...cameraAudit.criteria,actores_completos:complete.failed_samples===0,sin_zona_vacia:Object.values(backgrounds).every(b=>b.ok),...Object.fromEntries(['sujeto_suficiente','sin_suelo_vacio','objeto_no_tapa_cuerpo'].map(k=>[k,composition[k].failed_samples===0])),sin_solape_de_cabezas:editorial.head_overlaps.length===0,rodillas_hacia_adelante:editorial.knees.backward===0,subtitulos_en_zona_segura:editorial.subtitle_safe.violations.length===0,mismo_encuadre_max_6s:editorial.camera.max_same_framing_seconds<=6,insert_vuelve_al_plano_previo:editorial.camera.insert_returns.every(r=>r.fit_adjusted||r.max_rect_error_px<.001),sin_saltos_en_limites_de_accion:boundaryJump<.05,pies_sin_patinar:foot.max_slip_px<2,boca_cerrada_sin_voz:mouth.percent<2,determinismo:mismatches.length===0,objeto_en_la_mano:maxGrip<.01,sujetos_sin_recorte:framing.target_crop_frames===0,objetos_sin_recorte:framing.object_crop_frames===0};metrics.failed=Object.keys(ck).filter(k=>!ck[k]);metrics.passed=metrics.failed.length===0;if(metrics.failed.length)console.error('Revisión NO aprobada. Criterios que fallan: '+metrics.failed.join(', '));}
 await mkdir(resolve(outDir),{recursive:true});await writeFile(join(outDir,sheetName??`${c.episode.id}-${view}-sheet.jpg`),await sheet.encode('jpeg',92));await writeFile(join(outDir,`${c.episode.id}-${view}-metrics.json`),JSON.stringify(metrics,null,2)+'\n');
 return metrics;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  const [episode,outDir,...flags]=process.argv.slice(2);if(!episode||!outDir)throw new Error('Uso: review.mjs <episodio.json> <outDir> [--view landscape|portrait|both --framing fit|tight --every segundos --times 0,1 --cuts 1 --name vida]');
  const options={view:'both',framing:'fit'};for(let i=0;i<flags.length;i+=2){const k=flags[i].slice(2),value=flags[i+1];if(['view','framing','name'].includes(k))options[k]=value;else if(k==='every')options.every=Number(value);else if(k==='times')options.times=value.split(',').map(Number);else if(k==='cuts')options.cuts=value==='1';else throw new Error('Opción inválida: '+flags[i]);}
  if(!['both','landscape','portrait'].includes(options.view)||!['fit','tight'].includes(options.framing)||options.every!=null&&!(options.every>0))throw new Error('Vista, encuadre o intervalo inválido');
  const c=await loadEpisode(episode),results=[];if(options.cuts)options.times=[...new Set([0,...c.scenes.flatMap(s=>s.cameraPlan.map(x=>x.t0))])].sort((a,b)=>a-b);
  for(const view of options.view==='both'?['landscape','portrait']:[options.view])results.push(await reviewEpisode(c,outDir,{...options,view,sheetName:options.name?`${options.name}-${view}-sheet.jpg`:undefined}));
  const summary={...results.at(-1),views:results.map(r=>({view:r.view,passed:r.passed,failed:r.failed})),passed:results.every(r=>r.passed),failed:[...new Set(results.flatMap(r=>r.failed))]};
  await writeFile(join(outDir,`${c.episode.id}-metrics.json`),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(results.map(r=>({view:r.view,passed:r.passed,failed:r.failed,actores_completos:r.actores_completos,sin_zona_vacia:r.sin_zona_vacia,overrides_adjusted:r.overrides_adjusted,subjects:r.composition.sujeto_suficiente})),null,2));if(!summary.passed)process.exitCode=1;
 }catch(e){console.error(e.stack);process.exitCode=1;}
}
