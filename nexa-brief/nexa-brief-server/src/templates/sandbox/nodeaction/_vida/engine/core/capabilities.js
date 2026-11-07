import {ACTIONS} from '../act/index.js';
import {EXPRESSIONS} from '../face/face.js';
import {VIEWS} from '../rig/skeleton.js';
import {MOVES,EASES} from '../camera/config.js';

// Run before schema validation so a typo is not reported as twelve failing oneOf branches.
export function validateCapabilities(episode){
 const check=(value,choices,path)=>{if(value!=null&&!choices.includes(value))throw new Error(`${path}: capacidad desconocida «${value}». Alternativas válidas: ${choices.join(' | ')}`);};
 const action=(a,path)=>{check(a.action,Object.keys(ACTIONS),path+'.action');const spec=ACTIONS[a.action];if(!spec)return;
  for(const [key,rule]of Object.entries(spec.params))if(rule.enum)check(a[key],rule.enum,path+'.'+key);
  check(a.face,Object.keys(EXPRESSIONS),path+'.face');
 };
 const step=(s,path)=>{
  if(s.parallel)s.parallel.forEach((v,i)=>step(v,`${path}.parallel[${i}]`));
  if(s.do)(Array.isArray(s.do)?s.do:[s.do]).forEach((v,i)=>action(v,path+'.do'+(Array.isArray(s.do)?`[${i}]`:'')));
  if(s.say){check(s.intent,ACTIONS.talk.params.intent.enum,path+'.intent');check(s.face,Object.keys(EXPRESSIONS),path+'.face');}
 };
 for(const [i,s]of (episode.scenes??[]).entries()){
  const p=`$.scenes[${i}]`;check(s.transition,['cut','fade','wipe','dip-white'],p+'.transition');
  (s.steps??[]).forEach((v,i)=>step(v,`${p}.steps[${i}]`));(s.actions??[]).forEach((v,i)=>action(v,`${p}.actions[${i}]`));
  for(const [id,a]of Object.entries(s.actors??{})){check(a.view,Object.keys(VIEWS),`${p}.actors.${id}.view`);check(a.start?.view,Object.keys(VIEWS),`${p}.actors.${id}.start.view`);check(a.start?.expression,Object.keys(EXPRESSIONS),`${p}.actors.${id}.start.expression`);}
  for(const [i,c]of (s.camera??[]).entries())for(const [key,choices]of Object.entries({type:['wide','two','medium','close','insert'],move:MOVES,ease:EASES,transition:['cut','move','whip','dissolve']}))if(!(key==='ease'&&Array.isArray(c[key])))check(c[key],choices,`${p}.camera[${i}].${key}`);
 }
}
