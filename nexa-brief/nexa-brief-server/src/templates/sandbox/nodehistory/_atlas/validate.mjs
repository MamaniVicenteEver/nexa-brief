import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

export const ATLAS = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES = path.resolve(ATLAS, '../../..');
export const SERVER = path.resolve(TEMPLATES, '../..');
export const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export function episodePath(value) {
  const candidate = path.resolve(value);
  return fs.existsSync(candidate) ? candidate : path.join(TEMPLATES, 'nodehistory', value);
}
export function catalog() { return readJSON(path.join(ATLAS, 'components.json')); }
export function resolveScene(root, selection = '') {
  const cfgPath = ['config.json', 'assets/config.json'].map(p => path.join(root,p)).find(p => fs.existsSync(p));
  if (!cfgPath) throw Error('Falta assets/config.json');
  const config = readJSON(cfgPath).configs?.[0];
  if (!config) throw Error('Config debe contener configs[0] (es el caso que reproduce Proto)');
  const scenePath = path.resolve(root, config.sceneUrl || 'assets/scene.json');
  const raw = readJSON(scenePath), info = fs.existsSync(path.join(root,'info.json')) ? readJSON(path.join(root,'info.json')) : {};
  const warnings = [], sandbox = {window:null,document:{currentScript:null},location:{search:''},URLSearchParams,TextEncoder,console:{warn:(...a)=>warnings.push(a.join(' ')),error:(...a)=>warnings.push(a.join(' '))}};
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.resolve(ATLAS, '../../_proto/proto.js'),'utf8'),sandbox);
  const declared = sandbox.Proto.validateDeclared(info.components || []);
  const chosen = sandbox.Proto.buildSelection(declared, sandbox.Proto.parseComponentQuery(selection));
  const scene = sandbox.Proto.resolveComponents(raw, declared, chosen);
  const lyrics = config.lyricsUrl && fs.existsSync(path.resolve(root, config.lyricsUrl)) ? readJSON(path.resolve(root,config.lyricsUrl)) : null;
  const words = (lyrics?.segments || []).flatMap(s=>s.words || []);
  return {config, scene, raw, scenePath, info, words, lyrics, warnings, timer:sandbox.Proto.makeTimer(words,'atlas check')};
}
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const coordinates = v => Array.isArray(v) && v.length >= 2 && finite(v[0]) && finite(v[1]) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
const http = v => typeof v === 'string' && /^https?:\/\//.test(v);
export function checkEpisode(root, {ready=false, selection=''}={}) {
  root = episodePath(root);
  const errors=[], warnings=[];
  let doc;
  try { doc=resolveScene(root,selection); } catch(error) {return {ok:false,errors:[error.message],warnings,root};}
  warnings.push(...doc.warnings);
  const {scene,config,words,timer:T}=doc;
  const fail = (test,msg) => {if (!test) errors.push(msg);};
  const duration = T(scene.duration ?? scene.end, NaN);
  fail(finite(duration)&&duration>0,'scene.duration/end debe ser positivo y resolverse con la voz');
  fail(scene.format === 'atlas-v1','scene.format debe ser atlas-v1');
  const defs=catalog().components || [];
  const knownLooks = new Set(defs.filter(c=>c.target==='looks').map(c=>c.demo?.look).filter(Boolean));
  fail(knownLooks.has(scene.look || 'satelite-realista'),`Look desconocido: ${scene.look}`);
  const knownTypes = new Set(defs.filter(c=>c.target==='layers').map(c=>c.demo?.type).filter(Boolean));
  // Ambos alias comparten el mismo dibujante del motor.
  knownTypes.add('arc');knownTypes.add('arrow');knownTypes.add('metric');
  const place = (v, label) => {
    const local=typeof v==='string' ? scene.places?.[v] : v;
    const own=object(local) ? (local.coordinates || local.center) : local;
    if (own !== undefined) fail(coordinates(own),`${label}: coordenadas inválidas [lon,lat]`);
    else if (typeof v !== 'string') fail(false,`${label}: se necesita nombre geográfico o coordenadas`);
    // IDs administrativos los verifica GeoData/plan; no se inventan centros.
  };
  function walk(v,p='scene') {
    if(Array.isArray(v)) return v.forEach((x,i)=>walk(x,`${p}[${i}]`));
    if(!object(v)) return;
    if ('$by' in v || '$param' in v || 'when' in v) errors.push(`${p}: selector de componente sin resolver`);
    for(const [k,x] of Object.entries(v)) {
      if(typeof x==='string' && x.startsWith('@')) T(x,NaN);
      if(['t','out','fillAt'].includes(k) && (typeof x==='number' || typeof x==='string'&&x.startsWith('@'))) {
        const t=T(x,NaN); fail(finite(t)&&t>=0&&(k==='out'||t<=duration),`${p}.${k}: tiempo fuera de 0–${duration}`); if(k==='out'&&t>duration)warnings.push(`${p}.out está después del final; no se verá su salida`);
      }
      walk(x,`${p}.${k}`);
    }
  }
  walk(scene);
  fail(Array.isArray(scene.camera)&&scene.camera.length>0,'Falta al menos una key de cámara');
  (scene.camera || []).forEach((k,i)=> {
    place(k.focus??k.center??k.c??[0,20],`camera[${i}]`);
    if(k.span!==undefined) fail(finite(k.span)&&k.span>0,`camera[${i}].span debe ser positivo`);
    if(k.zoom!==undefined) fail(finite(k.zoom)&&k.zoom>=0&&k.zoom<=24,`camera[${i}].zoom fuera de rango`);
  });
  (scene.looks||[]).forEach((k,i)=>fail(knownLooks.has(k.look),`looks[${i}]: look desconocido ${k.look}`));
  const researchPath=path.join(root,'research.json');
  const research=fs.existsSync(researchPath)?readJSON(researchPath):{};
  const sourceIds=new Set((research.sources||[]).filter(s=>s&&typeof s.id==='string'&&s.id.trim()&&http(s.url)).map(s=>s.id));
  const year=v=>finite(v)&&v>=0||typeof v==='string'&&!!v.trim();
  const scope=v=>typeof v==='string'&&!!v.trim();
  for(const [id,data] of Object.entries(scene.data||{})) {
    fail(object(data)&&finite(data.value),`data.${id}.value debe ser numérico`);
    if(!object(data))continue;
    if(data.unit==='%') fail(data.value>=0&&data.value<=100,`data.${id}: porcentaje fuera de 0–100`);
    if(data.illustrative) {if(ready) errors.push(`data.${id}: dato ilustrativo pendiente de investigación`);else warnings.push(`data.${id}: dato ilustrativo, no publicar como real`);}
    else {
      fail(http(data.source)||sourceIds.has(data.source),`data.${id}: falta URL primaria o id de research.sources`);
      fail(year(data.year)&&scope(data.scope),`data.${id}: indicar año y alcance (bienes/servicios, import/export, denominador)`);
    }
  }
  const mediaPaths=[];
  (scene.layers||[]).forEach((l,i)=> {
    fail(knownTypes.has(l.type),`layers[${i}]: tipo desconocido ${l.type}; consultar components.json`);
    if(l.at!==undefined) place(l.at,`layers[${i}].at`);
    if(['arc','arrow'].includes(l.type)) {if(l.from!==null)place(l.from,`layers[${i}].from`);place(l.to,`layers[${i}].to`);}
    if(finite(l.value)&&!l.dataRef) {
      const cited=(http(l.source)||sourceIds.has(l.source))&&year(l.year)&&scope(l.scope);
      if(l.unit==='%')fail(l.value>=0&&l.value<=100,`layers[${i}]: porcentaje fuera de 0–100`);
      if(!cited||l.illustrative)(ready?errors:warnings).push(`layers[${i}]: valor inline sin evidencia definitiva; usar dataRef con source/year/scope`);
    }
    if(l.dataRef) fail(object(scene.data?.[l.dataRef]),`layers[${i}].dataRef inexistente: ${l.dataRef}`);
    for(const k of ['enter','exit']) if(l[k]!==undefined) {
      fail(object(l[k])&&['fade','rise','scale','slide-left','slide-right'].includes(l[k].style)&&finite(l[k].dur)&&l[k].dur>0,`layers[${i}].${k}: style/dur inválido`);
    }
    if(l.focus) fail(Array.isArray(l.focus)&&l.focus.length===2&&l.focus.every(n=>finite(n)&&n>=0&&n<=1),`layers[${i}].focus fuera de 0–1`);
    if(l.src) mediaPaths.push(path.resolve(root,'assets',l.src));
  });
  mediaPaths.forEach(p=>fail(fs.existsSync(p),`Falta imagen local: ${p}`));
  for(const [label,value] of [['audio',config.audio?.src],['transcripción',config.lyricsUrl]]) {
    if(value) fail(!http(value)&&fs.existsSync(path.resolve(root,value))&&fs.statSync(path.resolve(root,value)).size>0,`Falta ${label} local o está vacío: ${value}`);
    else (ready?errors:warnings).push(`Falta ${label}: completar antes de renderizar`);
  }
  let prev=-Infinity;
  words.forEach((w,i)=>{fail(typeof w.word==='string'&&finite(w.start)&&finite(w.end)&&w.start>=prev&&w.end>=w.start,`lyrics.words[${i}]: tiempos inválidos/no ordenados`);prev=w.start;});
  if(ready) {
    fail(sourceIds.size>0,'research.json necesita fuentes primarias con id y URL');
    fail(Array.isArray(research.facts)&&research.facts.length>0&&research.facts.every(f=>typeof f.claim==='string'&&f.claim.trim()&&Array.isArray(f.sourceIds)&&f.sourceIds.length>0&&f.sourceIds.every(id=>sourceIds.has(id))),'research.facts necesita afirmaciones vinculadas a fuentes válidas');
    fail(words.length>0,'Transcripción vacía: generar con audio real, no inventar tiempos');
    if(words.length) fail(words.at(-1).end<=duration+.5,'La escena termina antes de la voz');
    const scriptPath=path.join(root,'assets/script.json');
    fail(fs.existsSync(scriptPath),'Falta assets/script.json');
    if(fs.existsSync(scriptPath)) fail(!/REEMPLAZAR|PENDIENTE|TODO/.test(JSON.stringify(readJSON(scriptPath))),'Guion contiene marcadores pendientes');
  }
  if(!fs.existsSync(researchPath)) warnings.push('Sin research.json: guardar fuentes y evidencia antes de escribir afirmaciones');
  if(T.missing.size) errors.push(`Anclas de voz no resueltas: ${[...T.missing].join(', ')}`);
  return {ok:errors.length===0,root,duration,errors:[...new Set(errors)],warnings:[...new Set(warnings)],layers:(scene.layers||[]).length,words:words.length};
}
