#!/usr/bin/env node
/** Atlas: producir episodios con datos; nunca copiar ni editar el motor. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ATLAS,TEMPLATES,SERVER,readJSON,episodePath,catalog,checkEpisode,resolveScene} from './validate.mjs';

const HELP=`Atlas Cinemático · ejecutar desde nexa-brief-server
  node src/templates/nodeatlas/atlas-cinematico/_atlas/produce.mjs catalog [búsqueda]
  ... example atlas.arrow                         JSON insertable + entradas
  ... profile                                     voces y reglas de guion reutilizables
  ... add <ruta-episodio> atlas.arrow [--input '{"to":[2,49]}']
  ... add <ruta-episodio> atlas.animation --index 0 --out 20 [--input '{"style":"rise"}']
  ... add <ruta-episodio> atlas.outrov2 [--at 412]
  ... check <ruta-episodio> [--ready] [--selection 'c=atlas.outrov2']
  ... voice <ruta-episodio> [--dry] [--voice Orus|Sulafat] [--parts 2] [--force]
  ... transcribe <ruta-episodio> [--force]                    Whisper real por palabra
  ... prepare <ruta-episodio> [--fetch] [--verify] [--size 1920x1080]
  ... render <ruta-episodio> <salida.mp4> [--to 20] [--size 1920x1080] [--fps 30]

prepare sin --fetch solo informa cobertura. --fetch descarga caché; --verify
barre en navegador. render exige audio/transcripción reales y check --ready.
El alta usa el productor host/API. Indica siempre una ruta explícita de episodio.
Ver SKILL.md y PRODUCIR.md. No publica ni toca cuentas.`;
function parse(args) {
  const pos=[],flags={};
  for(let i=0;i<args.length;i++) {
    const a=args[i];if(!a.startsWith('--')) {pos.push(a);continue;}
    const k=a.slice(2);flags[k]=['ready','dry','force','fetch','verify'].includes(k)?true:args[++i];
    if(flags[k]===undefined) throw Error(`Falta valor de --${k}`);
  }
  return {pos,flags};
}
function write(p,data) {fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');}
function python() {const p=process.env.ATLAS_PYTHON || path.join(SERVER,'.venv/bin/python');return fs.existsSync(p)?p:'python3';}
function run(script,args=[],{module=false}={}) {
  const r=spawnSync(python(),['-B',...(module?['-m',script]:[path.join(SERVER,script)]),...args],{cwd:SERVER,stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:[SERVER,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)}});
  if(r.error) throw r.error;
  if(r.status!==0) throw Error(`Falló ${script} (salida ${r.status})`);
}
function requireFile(p) {if(!fs.existsSync(p))throw Error(`No existe: ${p}`);}
function outputCheck(result) {console.log(JSON.stringify(result,null,2));if(!result.ok)throw Error('Corregir los errores antes de continuar');}
function dimensions(v='1920x1080') {if(!/^\d+x\d+$/.test(v))throw Error('size debe ser ancho x alto, por ejemplo 1080x1920');const [w,h]=v.split('x').map(Number);if(w<1||h<1)throw Error('size debe ser positivo');return [w,h];}
// GeoData devuelve índices de layers: conservar huecos, nunca compactar la lista.
export function geographicPreparation(scene) {
  return {layers:(scene.layers||[]).map(l=>['highlight','flag-fill'].includes(l.type)&&!scene.regions?.[l.region]
    ? {region:l.region,...(l.detail?{detail:l.detail}:{})} : {})};
}
export function newEpisode() {
  throw Error('produce.mjs new está deshabilitado: crea el episodio con el productor host/API del perfil activo (scripts/atlas_factory.py init o Crear video), nunca dentro del repositorio');
}
export function addComponent(root,name,input={},flags={}) {
  root=episodePath(root);const c=catalog().components.find(c=>c.name===name);if(!c)throw Error(`Componente desconocido: ${name}`);
  const demo=structuredClone(c.demo);if(!demo||typeof demo!=='object')throw Error('Componente sin demo insertable');
  for(const [k,v] of Object.entries(input)) {
    const spec=c.params?.[k];if(!spec)throw Error(`Entrada desconocida ${name}.${k}; usar example`);
    const types={number:x=>Number.isFinite(x),boolean:x=>typeof x==='boolean',string:x=>typeof x==='string',array:Array.isArray,object:x=>x&&typeof x==='object'&&!Array.isArray(x),time:x=>typeof x==='number'&&Number.isFinite(x)||typeof x==='string'&&x.startsWith('@'),place:x=>typeof x==='string'||Array.isArray(x)||x===null};
    if(types[spec.type]&&!types[spec.type](v))throw Error(`Tipo inválido ${k}: ${spec.type}`);
    const values=spec.values||spec.options;if(values&&!values.includes(v))throw Error(`Valor inválido ${k}: ${values.join(', ')}`);
    if(spec.min!==undefined&&v<spec.min||spec.max!==undefined&&v>spec.max)throw Error(`Fuera de rango: ${k}`);
    demo[k]=v;
  }
  if(c.target==='layers[].enter / layers[].exit') {
    const doc=resolveScene(root),scene=doc.raw,index=Number(flags.index);
    if(!Number.isInteger(index)||index<0||!scene.layers?.[index])throw Error('animation requiere --index N de una capa existente (desde 0)');
    const layer=scene.layers[index],out=flags.out===undefined?layer.out:Number(flags.out);
    if(out===undefined)throw Error('La salida requiere out en la capa o --out SEGUNDO');
    for(const key of ['enter','exit']) layer[key]={...demo[key],...input};
    layer.out=out;write(doc.scenePath,scene);return doc.scenePath;
  }
  const target=c.target;
  if(target.startsWith('config.')) {const p=path.join(root,'assets/config.json'),doc=readJSON(p);doc.configs[0][target.slice(7)]=demo;write(p,doc);return p;}
  const doc=resolveScene(root);const p=doc.scenePath,scene=doc.raw;
  if(target==='scene.dataEntry') {
    const {id,...data}=demo;
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id||''))throw Error('El dato necesita un id alfanumérico');
    if(scene.data?.[id])throw Error(`Ya existe scene.data.${id}; usar otro id o editar el dato existente`);
    (scene.data||={})[id]=data;
  } else if(target==='scene') {
    const total=doc.timer(scene.duration??scene.end,NaN),length=Number(demo.duration),at=flags.at===undefined?total-length:Number(flags.at);
    if(!Number.isFinite(total)||!Number.isFinite(length)||length<=0||!Number.isFinite(at)||at<0||at+length>total+.001)throw Error('El cierre debe caber en duration; usar --at SEGUNDO y adaptar la duración del fragmento');
    const original=Number(c.demo.duration),ratio=length/original;
    const shifted=v=>Array.isArray(v)?v.map(shifted):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,['t','out','fillAt'].includes(k)&&typeof x==='number'?at+x*ratio:k==='dur'&&typeof x==='number'?x*ratio:shifted(x)])):v;
    for(const k of ['camera','layers','looks'])if(Array.isArray(demo[k]))scene[k]=[...(scene[k]||[]),...shifted(demo[k])];
    if(demo.look)(scene.looks||=[]).push({t:at,look:demo.look,dur:0,...(demo.lookOverrides?{overrides:demo.lookOverrides}:{})});
    console.warn(`Cierre insertado en ${at}–${at+length}s; revisar conflictos con cámara y capas previas en ese tramo.`);
  } else if(['layers','camera','looks','hud'].includes(target)) (scene[target]||=[]).push(demo);
  else if(target.startsWith('scene.'))scene[target.slice(6)]=demo;
  else throw Error(`Target no soportado: ${target}`);
  for(const k of ['camera','looks']) if(Array.isArray(scene[k])&&scene[k].every(x=>typeof x.t==='number'))scene[k].sort((a,b)=>a.t-b.t);
  write(p,scene);return p;
}
export function main(args=process.argv.slice(2)) {
  const {pos,flags}=parse(args),[cmd,id,name]=pos;
  if(!cmd||['help','--help','-h'].includes(cmd))return console.log(HELP);
  if(cmd==='profile') {const vocal=readJSON(path.join(ATLAS,'voice.json'));return console.log(JSON.stringify({voice:vocal,narrative:readJSON(path.join(ATLAS,vocal.narrative_profile)),orchestration:readJSON(path.join(ATLAS,'orchestration.json'))},null,2));}
  if(cmd==='catalog') {const data=catalog();const q=(id||'').toLowerCase();return console.log(JSON.stringify({version:data.version,components:data.components.filter(c=>!q||`${c.name} ${c.summary} ${c.group} ${c.family}`.toLowerCase().includes(q)).map(({name,target,summary})=>({name,target,summary}))},null,2));}
  if(cmd==='example') {const c=catalog().components.find(c=>c.name===id);if(!c)throw Error('Componente desconocido');return console.log(JSON.stringify(c,null,2));}
  if(cmd==='new')return console.log(newEpisode(id,flags));
  if(!id)throw Error('Falta id o ruta de episodio');
  const root=episodePath(id);requireFile(root);
  if(cmd==='check')return outputCheck(checkEpisode(root,{ready:!!flags.ready,selection:flags.selection||''}));
  if(cmd==='add')return console.log(addComponent(root,name,flags.input?JSON.parse(flags.input):{},flags));
  if(cmd==='voice') {
    const p=path.join(root,'assets/script.json');requireFile(p);const script=readJSON(p);
    if(!script.segments?.length||script.segments.some(s=>!s.id||!s.tone||!s.text)||/REEMPLAZAR|PENDIENTE|TODO/.test(JSON.stringify(script)))throw Error('Completar el guion investigado antes de generar voz');
    const out=path.join(root,'assets/song');if(!flags.force&&!flags.dry&&fs.existsSync(out+'.mp3'))throw Error('Ya existe song.mp3; --force permite reemplazarlo');
    const extra=['--design',path.join(ATLAS,'voice.json'),'--voice',flags.voice||script.voice||readJSON(path.join(ATLAS,'voice.json')).voice.voice];
    for(const k of ['parts','model','only-part'])if(flags[k]!==undefined)extra.push('--'+k,String(flags[k]));
    if(flags.dry)extra.push('--dry');
    run('src/templates/_tools/explainer-kit/tools/narrate.py',[p,out,...extra]);
    if(!flags.dry) {requireFile(out+'.mp3');const cp=path.join(root,'assets/config.json'),cfg=readJSON(cp);cfg.configs[0].audio={...(cfg.configs[0].audio||{}),src:'assets/song.mp3'};write(cp,cfg);}
    return;
  }
  if(cmd==='transcribe') {
    const doc=resolveScene(root),audio=path.resolve(root,doc.config.audio?.src||'assets/song.mp3'),out=path.join(root,'assets/lyrics.json');requireFile(audio);
    if(!flags.force&&fs.existsSync(out))throw Error('Ya existe lyrics.json; --force permite reemplazarlo');
    run('src/templates/_tools/explainer-kit/tools/transcribe.py',[audio,path.join(root,'assets/script.json'),out]);
    const cp=path.join(root,'assets/config.json'),cfg=readJSON(cp);cfg.configs[0].lyricsUrl='assets/lyrics.json';write(cp,cfg);return;
  }
  if(cmd==='prepare') {
    outputCheck(checkEpisode(root,{selection:flags.selection||''}));const {scenePath}=resolveScene(root,flags.selection||'');
    const [w,h]=dimensions(flags.size);
    // GeoData sólo recibe regiones administrativas. focus de fotos es un recorte 0–1.
    const {scene}=resolveScene(root,flags.selection||'');
    const scratch=path.join(path.dirname(scenePath),`.atlas-geoprep-${process.pid}.json`);
    try {write(scratch,geographicPreparation(scene));run('src.templates._tools.atlas.geo_cli',['geo','scene',scratch],{module:true});}
    finally {fs.rmSync(scratch,{force:true});}
    run('src/templates/_tools/atlas/atlas.py',['plan',scenePath,'--width',String(w),'--height',String(h),...(flags.selection?['--selection',flags.selection]:[]),...(flags.fetch?['--fetch']:[])]);
    if(flags.verify) {
      run('src/templates/_tools/atlas/atlas.py',['warm','--verify',scenePath,'--step',flags.step||'.25','--width',String(w),'--height',String(h),...(flags.selection?['--selection',flags.selection]:[])]);
    }
    return;
  }
  if(cmd==='render') {
    if(!name)throw Error('Falta salida.mp4');if(flags.selection)throw Error('Render usa la escena guardada; resolver selección primero');
    outputCheck(checkEpisode(root,{ready:true}));dimensions(flags.size);
    const relative=path.relative(TEMPLATES,path.join(root,'index.html'));if(relative.startsWith('..'))throw Error('El episodio debe vivir dentro de src/templates');
    const extra=['--size',flags.size||'1920x1080','--fps',flags.fps||'30','--workers',flags.workers||'1'];
    for(const k of ['from','to'])if(flags[k]!==undefined)extra.push('--'+k,String(flags[k]));
    run('src/templates/_tools/nodemotion/promo/compiler/render_promo.py',[relative,path.resolve(name),...extra]);return;
  }
  throw Error(`Comando desconocido: ${cmd}\n${HELP}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {try {main();}catch(error){console.error(error.message);process.exitCode=1;}}
