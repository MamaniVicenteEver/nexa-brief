import { ACTIONS, actionLayers } from '../act/index.js';
import { createPose, VIEWS, pelvisBottom } from '../rig/skeleton.js';
import { EXPRESSIONS } from '../face/face.js';
import { PROPS } from '../props/index.js';
import {objectBounds} from './composition.js';
import {alignScript,emotionFace} from './dialogue.js';
import {conversationTarget} from './staging.js';
import {sampleScene} from './sample.js';
import {buildShotPlan} from '../camera/director.js';
import {validateCamera,validateShot,cameraConfig} from '../camera/config.js';
import {validateCapabilities} from './capabilities.js';
export class EpisodeError extends Error {constructor(path,message){super(`${path}: ${message}`);this.name='EpisodeError';this.path=path;}}
const fail=(p,m)=>{throw new EpisodeError(p,m);};
export const normalizeWord=w=>w.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const keyed=(v)=>Array.isArray(v)?Object.fromEntries(v.map(x=>[x.id??x.name,x])):v??{};
export function resolveTime(value,lines,path='$',base=0) {
 if(typeof value==='number'&&Number.isFinite(value))return base+value;
 if(typeof value!=='string')fail(path,'el tiempo debe ser un número o un ancla @línea.palabra');
 const m=value.match(/^@([A-Za-z0-9_-]+)(?:(:end)|\.([^+]+?))?([+-]\d+(?:\.\d+)?)?$/);
 if(!m)fail(path,`ancla inválida «${value}»`);
 const l=lines.find(l=>l.id===m[1]);if(!l)fail(path,`no existe la línea ${m[1]}`);
 let t=l.t0;if(m[2])t=l.t1;if(m[3]){const wm=m[3].match(/^(.*?)(?:#(\d+))?$/),matches=l.words.filter(w=>normalizeWord(w.w)===normalizeWord(wm[1]));const w=matches[(Number(wm[2])||1)-1];if(!w)fail(path,`palabra «${m[3]}» ausente en Whisper de ${l.id}`);t=l.t0+w.s-l.trimIn;}
 return t+Number(m[4]??0);
}
export function compile(episode,timing,sourceCatalog={}) {
 // Camera has its own richer contract; retain capability checks for every other domain.
 validateCapabilities({...episode,scenes:episode.scenes?.map(s=>({...s,camera:[]}))});
 validateCamera(episode.camera,fail);
 const catalog={...sourceCatalog,characters:keyed(sourceCatalog.characters),sets:keyed(sourceCatalog.sets),voices:keyed(sourceCatalog.voices)};
 if(episode.version!==1)fail('$.version','debe ser 1');
 if(!episode.scenes?.length)fail('$.scenes','debe contener al menos una escena');
 if(episode.format&&(episode.format.width!==1080||episode.format.height!==1920||episode.format.fps!==30))fail('$.format','el contrato de salida es 1080×1920 a 30 fps');
 const result={version:1,episode:structuredClone(episode),catalog,timing,scenes:[],lines:[],warnings:[],duration:0};
 result.camera={config:cameraConfig(episode.camera),warnings:[]};
 const offscreen=id=>episode.cast?.[id]?.offscreen===true || (episode.cast?.[id]==='narrador'&&!catalog.characters.narrador);
 const alternatives=(what,value,choices)=>`${what} desconocido: ${value}. Alternativas válidas: ${choices.join(' | ')}`;
 for(const [id,c] of Object.entries(episode.cast??{}))if(c?.offscreen&&c.voice&&!catalog.voices[c.voice])fail(`$.cast.${id}.voice`,`voz desconocida: ${c.voice}`);
 const script=Object.fromEntries((episode.script??[]).map(l=>[l.id,l]));
 let cursor=0;
 for(const [si,input] of episode.scenes.entries()) {
  const path=`$.scenes[${si}]`, set=catalog.sets[input.set];if(!set?.anchors)fail(`${path}.set`,`escenario desconocido o sin datos: ${input.set}`);
  for(const [i,p]of set.props.entries())if(!PROPS[p.prop])fail(`${path}.set.props[${i}]`,`prop desconocido: ${p.prop}`);
  const scene={id:input.id??`scene-${si}`,path,t0:cursor,t1:cursor,set,actors:{},objects:structuredClone(input.objects??{}),events:[],shots:[],input};
  const resolve=(v,p=path)=>{if(typeof v==='number')return [v,set.floorY];if(Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))return [...v];if(set.anchors[v])return [set.anchors[v].x,set.anchors[v].y];if(scene.actors[v])return [scene.actors[v].pose.x,scene.actors[v].pose.y];fail(p,`ancla/objetivo desconocido: ${v}`);};
  for(const [id,a] of Object.entries(keyed(input.actors))){if(offscreen(id))fail(`${path}.actors.${id}`,'una voz offscreen no tiene cuerpo; quitarla de actors');const cast=episode.cast?.[id];const charId=a.character??(typeof cast==='string'?cast:cast?.character)??id, character=catalog.characters[charId];if(!character)fail(`${path}.actors.${id}`,`personaje desconocido: ${charId}`);if(catalog.voices&&Object.keys(catalog.voices).length&&!catalog.voices[character.voice])fail(`${path}.actors.${id}`,`voz desconocida: ${character.voice}`);
   const [x,y]=resolve(a.start?.seated??a.at??a.x,`${path}.actors.${id}.at`);if(x<set.walk[0]||x>set.walk[1]||y>set.plate.h||y<set.charHeight)fail(`${path}.actors.${id}.at`,'personaje fuera del escenario');
   const initial=a.start??{},view=initial.view??a.view??(initial.seated?(set.anchors[initial.seated]?.facing==='left'?'3q-left':'3q-right'):'front'),expression=initial.expression??a.face??character.face?.expression??'neutral';
   if(!(view in VIEWS))fail(`${path}.actors.${id}.start.view`,alternatives('vista',view,Object.keys(VIEWS)));
   if(!EXPRESSIONS[expression])fail(`${path}.actors.${id}.start.expression`,alternatives('expresión',expression,Object.keys(EXPRESSIONS)));
   const actor=scene.actors[id]={id,character,pose:createPose({x,y,scale:set.charHeight,view}),face:{expression},seated:initial.seated??null,behind:a.behind??set.anchors[a.at]?.behind??null,holding:{}};
   if(actor.behind&&!set.props.some(p=>(p.id??p.prop)===actor.behind&&p.layer==='front'))fail(`${path}.actors.${id}.behind`,'se requiere el id de un prop front existente');
   if(initial.seated){const anchor=set.anchors[initial.seated],seat=set.props.find(o=>['chair','bench'].includes(o.prop)&&Math.abs(o.x-x)<=o.w/2);if(anchor?.kind!=='seat'||!seat)fail(`${path}.actors.${id}.start.seated`,'se requiere un ancla seat con mueble');actor.pose.rootY=(seat.params.seatY-y)/(set.charHeight*character.height)-pelvisBottom(character,view);actor.pose.sitting=1;actor.pose.seatLevel=(seat.params.seatY-y)/(set.charHeight*character.height);actor.pose.knees={left:-1,right:-1};}
   const assign=(object,owner,p)=>{const obj=scene.objects[object];if(!obj)fail(p,`objeto desconocido: ${object}`);if(obj.owner&&(['actor','hand','slot'].some(k=>obj.owner[k]!==owner[k])||obj.owner.anchor!=null))fail(p,'start contradice el dueño inicial del objeto');obj.owner=owner;};
   for(const [hand,value]of Object.entries(initial.holding??{})){if(!['left','right'].includes(hand))fail(`${path}.actors.${id}.start.holding`,'manos válidas: left | right');const hold=typeof value==='string'?{object:value}:value;assign(hold.object,{actor:id,hand},`${path}.actors.${id}.start.holding.${hand}`);actor.holding[hand]={carry:'side',...hold};}
   if(initial.wearing){assign(initial.wearing,{actor:id,slot:'back'},`${path}.actors.${id}.start.wearing`);if(scene.objects[initial.wearing].prop!=='backpack')fail(`${path}.actors.${id}.start.wearing`,'wearing requiere backpack');}

  }
  if(!Object.keys(scene.actors).length)fail(`${path}.actors`,'falta el elenco de la escena');
  for(const [id,o] of Object.entries(scene.objects)){if(!PROPS[o.prop]||PROPS[o.prop].kind!=='hand')fail(`${path}.objects.${id}.prop`,`objeto de mano desconocido: ${o.prop}`);if(!o.owner)fail(`${path}.objects.${id}.owner`,'falta un único dueño inicial');validateOwner(o.owner,`${path}.objects.${id}.owner`,scene);o.history=[{at:cursor,owner:structuredClone(o.owner)}];}
  const raw=[];
  function step(s,start,p){
   if(s.parallel){if(!Array.isArray(s.parallel)||!s.parallel.length)fail(p+'.parallel','grupo vacío');return Math.max(...s.parallel.map((x,i)=>step(x,start,`${p}.parallel[${i}]`)));}
   if(s.say){const id=typeof s.say==='string'?s.say:s.say.line, tm=timing.lines?.[id];if(!tm)fail(p+'.say',`falta timing/audio de ${id}`);if(result.lines.some(l=>l.id===id))fail(p+'.say',`línea repetida: ${id}`);const who=s.who??script[id]?.who??tm.speaker;if(!scene.actors[who]&&!offscreen(who))fail(p+'.who',`hablante fuera del elenco: ${who}`);if(tm.speaker!==who)fail(p+'.who',`audio de ${id} pertenece a ${tm.speaker}`);
    const trimIn=s.trim?.in??0,trimOut=s.trim?.out??tm.dur;if(!(trimIn>=0&&trimOut<=tm.dur&&trimOut>trimIn))fail(p+'.trim','recorte fuera del clip');
    if(tm.words.some(w=>w.s<trimIn-.03||w.e>trimOut+.03))fail(p+'.trim','el recorte elimina palabras de Whisper');
    if(result.lines.some(l=>l.who===who&&l.t1>start&&l.t0<start+trimOut-trimIn))fail(p+'.say','dos voces simultáneas del mismo personaje');
    if(s.intensity!=null&&(!Number.isFinite(s.intensity)||s.intensity<0||s.intensity>1))fail(p+'.intensity','debe estar entre 0 y 1');
    if(s.face&&!EXPRESSIONS[s.face])fail(p+'.face','expresión desconocida');
    const text=script[id]?.text??tm.text;const emotion=script[id]?.emotion??tm.emotion;const faceState=s.face?{expression:s.face,intensity:s.intensity??1}:{...emotionFace(emotion,catalog.emotions),...(s.intensity!=null?{intensity:s.intensity}:{})};
    const subtitleWords=alignScript(tm.words,text,p+'.say',result.warnings);
    const line={...tm,offscreen:offscreen(who),text,emotion,faceState,subtitleWords,id,who,trimIn,trimOut,t0:start,t1:start+trimOut-trimIn,intent:s.intent??'explain',face:s.face,path:p,scene:scene.id};result.lines.push(line);
    if(scene.actors[who])raw.push({who,action:'talk',line:id,intent:line.intent,face:line.face,intensity:s.intensity,t0:start,dur:line.t1-start,auto:true,path:p});
    if(!line.offscreen)for(const other of Object.keys(scene.actors).filter(a=>a!==who))raw.push({who:other,action:'listen',line:id,to:who,react:s.listen?.react,t0:start,dur:line.t1-start,auto:true,path:p});
    if(s.gap!=null&&(!Number.isFinite(s.gap)||s.gap<0))fail(p+'.gap','pausa inválida');
    return line.t1+(s.gap??0);
   }
   if(s.do){const list=Array.isArray(s.do)?s.do:[s.do];let end=start;for(const a of list){let duration=a.dur??s.dur;if(duration==null&&a.action==='walk'){const actor=scene.actors[a.who];if(!actor)fail(p+'.do.who','personaje desconocido');const prev=raw.filter(x=>x.who===a.who&&x.action==='walk'&&x.t0<=start).at(-1),from=prev?resolve(prev.to):[actor.pose.x,actor.pose.y],to=resolve(a.to);duration=Math.max(.65,Math.abs(to[0]-from[0])/(actor.pose.scale*actor.character.height*(a.speed??1))+.4);}duration??=ACTIONS[a.action]?.defaultDur;if(!Number.isFinite(duration))fail(p+'.do.action',alternatives('acción',a.action,Object.keys(ACTIONS)));raw.push({...a,t0:start,dur:duration,path:p+'.do'});end=Math.max(end,start+duration);}return end;}
   if(typeof s.wait==='number'&&s.wait>=0)return start+s.wait;
   fail(p,'se esperaba say, do, parallel o wait');
  }
  for(const [i,s] of (input.steps??[]).entries())cursor=step(s,cursor,`${path}.steps[${i}]`);
  for(const [i,a] of (input.actions??[]).entries()){const p=`${path}.actions[${i}]`;const t0=resolveTime(a.at??0,result.lines,p+'.at',scene.t0);raw.push({...a,t0,path:p});}
  raw.sort((a,b)=>a.t0-b.t0||(a.auto?-1:1));
  for(const [i,a] of raw.entries()){
   const p=a.path, spec=ACTIONS[a.action];if(!spec)fail(p+'.action',alternatives('acción',a.action,Object.keys(ACTIONS)));if(!scene.actors[a.who])fail(p+'.who',`personaje desconocido: ${a.who}`);
   if(a.action==='eat'){if(a.item&&a.object&&a.item!==a.object)fail(p+'.item','item y object deben nombrar el mismo objeto');a.object??=a.item;}
   for(const key of spec.required??[])if(a[key]==null)fail(p+'.'+key,'falta un parámetro obligatorio');
   if(a.line&&!result.lines.some(l=>l.id===a.line))fail(p+'.line','línea no programada en el episodio');
   validateParams(a,spec,p);if(a.face&&!EXPRESSIONS[a.face])fail(p+'.face','expresión desconocida');if(a.t0<scene.t0-1e-6)fail(p+'.at','la acción empieza antes de la escena');
   if(['pick','take','give','put','hold','wear','unwear','stow','unstow','eat'].includes(a.action)&&!scene.objects[a.object])fail(p+'.object',`objeto desconocido: ${a.object}`);
   if(['wear','unwear'].includes(a.action)&&scene.objects[a.object]?.prop!=='backpack')fail(p+'.object','wear requiere una mochila backpack');
   if(a.action==='give'&&!scene.actors[a.to??a.recipient])fail(p+'.to','destinatario desconocido');
   if(a.action==='eat'&&scene.objects[a.object].prop==='spoon'&&scene.objects[a.plate]?.prop!=='plate')fail(p+'.plate','eat con spoon requiere un objeto plate existente');
   if(a.action==='eat'&&scene.objects[a.object].prop==='icecream')a.cycles??=3;
   if(a.action==='highfive'&&!scene.actors[a.to])fail(p+'.to','destinatario desconocido');
   if(a.action==='open'&&!set.props.find(x=>(x.id??x.prop)===a.object&&['door','school-gate'].includes(x.prop)))fail(p+'.object','puerta desconocida');
   for(const key of ['to','seat'])if(typeof a[key]==='string'&&offscreen(a[key]))fail(p+'.'+key,'una voz offscreen no es un objetivo escénico');
   for(const key of ['to','seat'])if(a[key]!=null&&spec.params[key]?.type==='target'&&!scene.objects[a[key]]&&!(a.action==='look'&&a[key]==='camera'))resolve(a[key],p+'.'+key);
   const actor=scene.actors[a.who];let fromPose=actor.pose;
   for(const e of scene.events.filter(e=>e.who===a.who&&['walk','sit','stand','turn'].includes(e.action)&&e.t0<=a.t0)){const patch=ACTIONS[e.action].sample(e,Math.min(a.t0-e.t0,e.dur)).pose;fromPose={...fromPose,...patch};}
   let seatY; if(a.action==='sit'||a.action==='stand'&&a.seat!=null){const anchor=set.anchors[a.seat];if(anchor?.kind!=='seat')fail(p+'.seat','el ancla no es un asiento');const seat=set.props.find(o=>['chair','bench'].includes(o.prop)&&Math.abs(o.x-anchor.x)<=o.w/2);if(!seat)fail(p+'.seat','el asiento no tiene mueble');seatY=seat.params.seatY;}
   let faceTo;const actionResolve=v=>{const target=resolve(v,p);if(a.action!=='walk')return target;const staged=conversationTarget(scene,a.who,[fromPose.x,fromPose.y],target,a.t0+(a.dur??spec.defaultDur),a.spacing??1.15);faceTo=staged.faceTo;return staged.point;};
   const seatView=set.anchors[a.seat]?.facing==='left'?'3q-left':'3q-right';
   const planned=spec.plan({params:a,from:[fromPose.x,fromPose.y],fromView:fromPose.view,fromRoot:fromPose.rootY,fromSitting:fromPose.sitting,resolve:actionResolve,scale:actor.pose.scale*actor.character.height,dur:a.dur,line:result.lines.find(l=>l.id===a.line),seatY,seatView,pelvisDepth:pelvisBottom(actor.character,a.view??seatView)});
   const e={...a,...planned,...(faceTo?{faceTo}:{}),id:`${scene.id}:${i}`,dur:a.dur??planned.dur??spec.defaultDur,t0:a.t0,path:p};e.t1=e.t0+e.dur;e.layers=actionLayers(e);
   if(!(e.dur>=spec.minDur&&e.dur<=120))fail(p+'.dur',`duración fuera de rango [${spec.minDur}, 120]`);
   if(e.action==='walk'&&(e.to[0]<set.walk[0]||e.to[0]>set.walk[1]||e.to[1]<set.charHeight||e.to[1]>set.plate.h))fail(p+'.to','destino fuera del escenario');
   if(e.action==='sit'&&Math.abs(e.from[0]-e.seat[0])>actor.pose.scale*.15)fail(p+'.seat','hay que caminar al asiento antes de sentarse');
   if(!e.auto)for(const prev of scene.events.filter(b=>!b.auto&&b.who===e.who&&b.t1>e.t0+1e-7&&e.t1>b.t0+1e-7)){const layers=e.layers.filter(l=>prev.layers.includes(l));if(layers.length&&!e.blend&&!prev.blend)fail(p,`solape incompatible con ${prev.path} en ${layers.join(', ')}`);if((e.action==='walk'&&prev.action==='sit')||(e.action==='sit'&&prev.action==='walk'))fail(p,'no se puede caminar y sentarse simultáneamente');}
   scene.events.push(e);cursor=Math.max(cursor,e.t1);
  }
  scene.t1=cursor;
  // Each transfer is planned against one sorted ownership ledger, including hidden slots.
  const transfers=['pick','take','give','put','wear','unwear','stow','unstow'];
  for(const e of scene.events.filter(e=>transfers.includes(e.action)).sort((a,b)=>a.t0-b.t0)){
   const obj=scene.objects[e.object],owner=ownerAt(obj,e.t0),hand=e.hand??'right';
   if(['give','put','wear','stow'].includes(e.action)&&(owner.actor!==e.who||owner.hand!==hand))fail(e.path+'.object','el emisor no posee el objeto en esa mano');
   if(e.action==='pick'&&owner.actor)fail(e.path+'.object','pick requiere objeto libre; alternativas: take | unwear | unstow | give');
   if(e.action==='take'&&owner.actor&&!(owner.actor===e.who&&owner.slot==='back'))fail(e.path+'.object','take admite ancla o espalda propia; alternativas: give | unstow');
   if(e.action==='unwear'&&(owner.actor!==e.who||owner.slot!=='back'))fail(e.path+'.object','unwear requiere objeto en la espalda propia');
   if(e.action==='unstow'&&(owner.actor!==e.who||owner.slot!=='pocket'))fail(e.path+'.object','unstow requiere objeto en el bolsillo propio');
   const next=e.action==='give'?{actor:e.to??e.recipient,hand:e.recipientHand??'right'}:e.action==='put'?{anchor:e.to}:['wear','stow'].includes(e.action)?{actor:e.who,slot:e.action==='wear'?'back':'pocket'}:{actor:e.who,hand};
   validateOwner(next,e.path,scene);const at=e.t0+e.dur*(e.action==='give'?.5:.65);e.transferAt=at;e.previousOwner=structuredClone(owner);obj.history.push({at,owner:next,event:e.id});obj.history.sort((a,b)=>a.at-b.at);
  }
  for(const e of scene.events){
   if(['point','wave','highfive','touch-head','cross-arms','hands-hips'].includes(e.action))for(const o of Object.values(scene.objects)){const own=ownerAt(o,e.t0);if(own.actor===e.who&&e.layers.includes('arm.'+own.hand))fail(e.path,'la mano del gesto está ocupada por un objeto');}
   if(e.object&&scene.objects[e.object]&&['hold','eat','wear'].includes(e.action)){const own=ownerAt(scene.objects[e.object],e.t0);if(own.actor!==e.who||own.hand!==(e.hand??'right'))fail(e.path+'.object','la acción requiere poseer el objeto en esa mano');}
   if(transfers.includes(e.action))for(const other of scene.events){if(other===e||other.object!==e.object||!transfers.includes(other.action))continue;if(other.t0<e.t1&&other.t1>e.t0)fail(e.path+'.object','dos transferencias simultáneas del mismo objeto');}
   if(e.action==='give'||e.action==='highfive'){const who=e.to??e.recipient,hand=e.recipientHand??(e.action==='highfive'?'left':'right');if(e.action==='highfive'&&Object.values(scene.objects).some(o=>{const own=ownerAt(o,e.t0);return own.actor===who&&own.hand===hand;}))fail(e.path+'.to','la mano receptora está ocupada');for(const other of scene.events.filter(a=>!a.auto&&a.who===who&&a!==e&&a.t0<e.t1&&a.t1>e.t0)){if(other.layers.includes('arm.'+hand))fail(other.path,'mano reservada por '+e.action+' de '+e.who);}}
  }
  const times=[scene.t0,...Object.values(scene.objects).flatMap(o=>o.history.map(h=>h.at))];
  for(const t of times){const slots=new Map();for(const [id,o] of Object.entries(scene.objects)){const own=ownerAt(o,t);if(!own.actor)continue;const key=`${own.actor}:${own.hand??own.slot}`;if(slots.has(key))fail(path+'.objects',`mano/espalda ocupada por ${slots.get(key)} y ${id} en t=${t.toFixed(3)}`);slots.set(key,id);}}
  for(const [i,shot] of (input.camera??[]).entries()){
   const p=`${path}.camera[${i}]`,t0=resolveTime(shot.at??0,result.lines,p+'.at',scene.t0),t1=shot.until!=null?resolveTime(shot.until,result.lines,p+'.until',scene.t0):shot.dur!=null?t0+shot.dur:scene.t1;
   validateShot(shot,p,scene,fail);
   if(t0<scene.t0||t1<=t0||t1>scene.t1+.001)fail(p,'cámara fuera de duración de escena');scene.shots.push({...shot,t0,t1,path:p});
  }
  if(!['cut','fade','wipe','dip-white'].includes(input.transition??'cut'))fail(path+'.transition',alternatives('transición de escena',input.transition,['cut','fade','wipe','dip-white']));
  const transitionDur=input.dur??Math.min(.6,scene.t1-scene.t0);if(!Number.isFinite(transitionDur)||transitionDur<=0||transitionDur>Math.min(5,scene.t1-scene.t0))fail(path+'.dur','duración de transición debe estar entre 0 y 5 s y caber en la escena');
  scene.transition={type:input.transition??'cut',dur:transitionDur};
  scene.cameraPlan=buildShotPlan(scene,result.lines.filter(l=>l.scene===scene.id),episode.camera);
  result.scenes.push(scene);
 }
 result.duration=cursor;
 // Camera diagnostics are compile-time data, never mutated by cameraAt/seek.
 for(const scene of result.scenes)for(const shot of scene.cameraPlan){
  if(shot.type!=='insert'&&shot.move!=='whip'&&shot.transition!=='whip'&&shot.t1-shot.t0<1.2-1e-6&&!shot.continuation)result.camera.warnings.push({path:shot.path??scene.path+'.camera',code:'plano-corto',message:'El plano dura menos de 1,2 s; se conserva el tiempo editorial explícito.'});
  const z0=shot.from?.zoom??shot.zoomFrom??1,z1=shot.to?.zoom??shot.zoomTo??shot.zoom??1;
  const available=shot.ramp??shot.t1-shot.t0-(shot.hold??0)-(shot.settle??0),minimum=2.1875*Math.abs(Math.log2(z1/z0))/result.camera.config.maxZoomRate;
  if(minimum>available)result.camera.warnings.push({path:shot.path??scene.path+'.camera',code:'duracion-insuficiente',requested:available,minimum,message:'El movimiento excede el límite de zoom; se alarga su trayectoria sin desplazar el corte.'});
 }

 if(episode.framing!=null&&!['fit','tight'].includes(episode.framing))fail('$.framing','debe ser fit o tight');
 if(episode.view!=null&&!['auto','landscape','portrait'].includes(episode.view))fail('$.view','debe ser auto, landscape o portrait');
 const ui=episode.ui?.subtitles??{};
 if(ui.maxWords!=null&&(!Number.isInteger(ui.maxWords)||ui.maxWords<1||ui.maxWords>3))fail('$.ui.subtitles.maxWords','debe ser 1, 2 o 3');
 if(ui.x!=null&&(ui.x<=65||ui.x>=1015))fail('$.ui.subtitles.x','no hay espacio para el texto y su contorno dentro de la zona segura');
 const subtitleY=Math.max((ui.y??1430),(1360+(ui.size??78)*.6+5)),subtitleSize=ui.size??78;
 if(subtitleY-subtitleSize*.6-5<1360||subtitleY+subtitleSize*.6+5>1500)fail('$.ui.subtitles.y','texto y contorno fuera de la zona segura');
 if(ui.x!=null&&(ui.x<60||ui.x>1020)||ui.y!=null&&(ui.y<300||ui.y>1450))fail('$.ui.subtitles','subtítulos fuera de la zona segura (x 60–1020; y 300–1450)');
 return result;
}
function validateOwner(o,path,s){if((!!o.actor)+(o.anchor!=null?1:0)!==1)fail(path,'debe tener exactamente un dueño (actor o anchor)');if(o.actor&&(!s.actors[o.actor]||(!['left','right'].includes(o.hand)&&!['back','pocket'].includes(o.slot))||(o.hand&&o.slot)))fail(path,'dueño/mano inválido');if(o.anchor!=null&&!s.set.anchors[o.anchor]&&!Array.isArray(o.anchor))fail(path,'ancla propietaria desconocida');}
export function ownerAt(obj,t){return [...obj.history].reverse().find(h=>h.at<=t+1e-9)?.owner??obj.owner;}
function validateParams(a,spec,p){const reserved=['who','action','at','t0','t1','dur','path','auto','blend'];for(const [key,v] of Object.entries(a)){if(reserved.includes(key)||v===undefined)continue;const rule=spec.params[key];if(!rule)fail(p+'.'+key,`parámetro desconocido. Alternativas válidas: ${Object.keys(spec.params).join(' | ')}`);if(rule.type==='point'&&(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)))fail(p+'.'+key,'debe ser [x, y] finitos');if(rule.type==='number'&&(!Number.isFinite(v)||v<rule.min||v>rule.max))fail(p+'.'+key,`debe estar entre ${rule.min} y ${rule.max}`);if(rule.enum&&!rule.enum.includes(v))fail(p+'.'+key,`debe ser ${rule.enum.join(' | ')}`);if(rule.type==='boolean'&&typeof v!=='boolean')fail(p+'.'+key,'debe ser booleano');if(rule.type==='string'&&typeof v!=='string')fail(p+'.'+key,'debe ser texto');if(rule.type==='reaction'){if(v!==false&&typeof v!=='string'&&(!v||typeof v!=='object'||Array.isArray(v)))fail(p+'.'+key,'reacción inválida');const kind=typeof v==='string'?v:v?.kind??v?.expression;if(kind&&!EXPRESSIONS[kind]&&kind!=='relief')fail(p+'.'+key,'expresión de reacción desconocida');if(v?.intensity!=null&&(!Number.isFinite(v.intensity)||v.intensity<0||v.intensity>1))fail(p+'.'+key+'.intensity','debe estar entre 0 y 1');}if(rule.type==='array'&&!Array.isArray(v))fail(p+'.'+key,'debe ser una lista');}}
