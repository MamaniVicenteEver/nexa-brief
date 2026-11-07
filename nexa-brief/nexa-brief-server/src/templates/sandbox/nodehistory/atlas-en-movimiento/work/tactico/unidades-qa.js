import {Tactico,create,expandScene,loadComponents} from '../../engine/tactico/core.js';
import {timerFromWords} from '../../engine/tactico/tools/anchors.js';
import {landIndex} from '../../engine/tactico/tools/geometry.js';
import {createView} from '../../engine/plano/view.js';
import {createTerritories} from '../../engine/plano/territories.js';
import {createTiles} from '../../engine/plano/tiles.js';
import {atlasURL,readJSON,sharedModules,LOOKS} from '../../engine/plano/paths.js';
import {prepareMotion,poseAt,angleDelta} from '../../engine/tactico/components/units.js';
import {prepareNaval,formationMembers,navalSprite,carrierDeckPose} from '../../engine/tactico/components/naval.js';
import {actionPose} from '../../engine/tactico/components/air.js';
const canvas=document.querySelector('canvas'),g=canvas.getContext('2d',{willReadFrequently:true}),query=new URLSearchParams(location.search);
if(query.has('headless'))document.body.dataset.headless='';
await loadComponents();
const [shared,collection,look,providers,inventory]=await Promise.all([sharedModules(),readJSON(atlasURL('data/geo/admin0.geojson')),readJSON(new URL('tactico.json',LOOKS)),readJSON(atlasURL('providers.json')),readJSON('../bench/cache-inventory.json')]);
const land=landIndex(collection),territories=createTerritories(collection),tiles=createTiles(providers.find(p=>p.id==='gibs-bluemarble'),look,territories,inventory);
let context=null,runtime=null,camera=null,scene=null;
function viewAt(t){return createView(camera.at(t),1080,1920);}
async function setup(source){
  scene=structuredClone(source);const T=timerFromWords(scene.words||[]);expandScene(scene,{T,width:1080,height:1920});
  const geo=shared.createGeo(scene,{},[collection]);camera=shared.createCamera(shared.cameraKeys(scene,geo,T,1080));
  context={st:{W:1080,H:1920,U:1},T,geo,look,land,scene,territories};runtime=await create(context,scene);
  for(let t=0;t<=(scene.duration||8);t+=.25)tiles.plan(viewAt(t));await tiles.preload();
  document.querySelector('#time').max=scene.duration||8;draw(0);return {missing:runtime.missing(),missingTiles:tiles.missingTiles()};
}
function background(view){g.resetTransform();g.globalAlpha=1;g.fillStyle=look.background;g.fillRect(0,0,1080,1920);tiles.draw(g,view);territories.draw(g,view,[],0,look);}
function draw(t,{label='',view=null}={}){
  const v=view||viewAt(t);background(v);runtime.draw(g,v,t);
  const grad=g.createRadialGradient(540,850,300,540,900,1200);grad.addColorStop(0,'#00000000');grad.addColorStop(1,'#00000055');g.fillStyle=grad;g.fillRect(0,0,1080,1920);
  g.font='700 24px Arial';g.fillStyle='#e9e3ba';g.textAlign='left';g.fillText(label||'UNIDADES · PRUEBA DE COMPONENTES',55,170);g.font='20px Arial';g.fillText(`${t.toFixed(2)} s`,55,203);
  g.font='15px Arial';g.fillText('NASA GIBS / Blue Marble · Natural Earth',55,1880);
  document.querySelector('#stamp').value=`${t.toFixed(2)} s`;document.querySelector('#time').value=t;
}
function hash(){const data=g.getImageData(0,0,1080,1920).data;let h=2166136261;for(const x of data)h=Math.imul(h^x,16777619);return (h>>>0).toString(16);}
async function benchmark(family){
  const allowed={units:['unit.token','unit.group','unit.move','unit.advance','unit.retreat'],naval:['naval.cargo','naval.warship','naval.submarine','naval.carrier','naval.group'],air:['air.bomber','air.jet','air.helicopter','air.prop']},single=family.includes('.'),types=single?[family]:allowed[family],support=[];
  const items=Array.from({length:20},(_,i)=>{
    const item=structuredClone(Tactico.get(types[i%types.length]).demo),x=58.1+(i%4)*.23,y=24.2+Math.floor(i/4)*.3;
    Object.assign(item,{id:`perf-${family}-${i}`,at:[x,y],t:0,dur:12,sfx:false,label:'',scale:family==='air'||family.startsWith('air.')?2:.55});
    item.path={via:[[x,y],[x+.05,y+.04],[x+.03,y+.08]],t:0,dur:10,curve:'smooth'};item.states=[];
    if(family==='naval'&&i%5===0)item.states=[{at:0,state:'burning'}];
    if(['air.launch','air.recover'].includes(item.type)){
      item.carrier=`perf-carrier-${i}`;item.at=item.carrier;item.to=[x+.08,y+.08];item.from=[x-.08,y-.08];delete item.path;
      support.push({id:item.carrier,type:'naval.carrier',at:[x,y],t:0,dur:0,fade:0,sfx:false});
    }
    if(item.type==='air.drop')item.to=[x,y];
    return item;
  });
  await setup({duration:12,defs:{fonts:{label:'Arial, sans-serif'}},items:[...support,...items],camera:[{t:0,center:[58.5,24.9],zoom:8}]});
  const surface=new OffscreenCanvas(1080,1920),g=surface.getContext('2d',{willReadFrequently:true});
  const v=viewAt(3),times=[],submit=[],control=[];
  for(let i=0;i<60;i++){
    g.clearRect(0,0,1080,1920);let start=performance.now();g.getImageData(0,0,1080,1920);const baseline=performance.now()-start;
    g.clearRect(0,0,1080,1920);const t=single?1+i/300:3+i/30;start=performance.now();runtime.draw(g,v,t);const submitted=performance.now()-start;g.getImageData(0,0,1080,1920);
    if(i>=20){times.push(performance.now()-start);submit.push(submitted);control.push(baseline);}
  }
  const stats=a=>({mean:a.reduce((a,b)=>a+b,0)/a.length,p95:[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1]});
  return {family,mode:single?'component':'mixed family',instances:20,referenceOnlyItems:support.length,samples:times.length,renderMs:stats(times),submissionMs:stats(submit),readbackMs:stats(control),netMeanMs:Math.max(0,stats(times).mean-stats(control).mean),includes:'20 drawn instances (groups contain additional hulls/tokens); draw + full RGBA readback, excludes clearRect, base map and encoding; net subtracts empty readback control; reference-only carriers are invisible'};
}
async function motionMetrics(source){
  await setup(source);const item=scene.items.find(i=>i.id==='turning-carrier'),nav=await prepareNaval(item,context),env={W:1080,H:1920,U:1,palette:{},rng:()=>()=>.4,sprite:()=>({available:false,relativeLength:1,draw(){}})},view=createView({lon:60.35,lat:20.5,zoom:7.1,bearing:0},1080,1920);
  let maxHeadingStep=0,minSeparation=Infinity,maxSpacingError=0,previous=null,reference=null;const poses=[];
  for(let i=0;i<=110;i++){
    const t=1+i/10,s={t,item,internal:nav},p=poseAt(nav,item,t),members=formationMembers(s,view,env),center=view.project(p.lon,p.lat),points=[center,...members.map(m=>m.pose)];
    if(previous!=null)maxHeadingStep=Math.max(maxHeadingStep,Math.abs(angleDelta(previous,p.heading)));previous=p.heading;
    const distances=[];for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){const d=Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);distances.push(d);minSeparation=Math.min(minSeparation,d);}
    if(!reference)reference=distances;distances.forEach((d,i)=>maxSpacingError=Math.max(maxSpacingError,Math.abs(d-reference[i])));poses.push({t,heading:p.heading,positions:points.map(p=>[p.x,p.y])});
  }
  const action=nav.actions[0],start=action.item.t+(action.item.deckDur??.75),as={item:action.item,internal:action.internal};
  const before=actionPose({...as,t:start-1e-5},view,env),after=actionPose({...as,t:start+1e-5},view,env);
  const convoyItem=scene.items.find(i=>i.id==='convoy-turn'),convoy=await prepareNaval(convoyItem,context);
  let convoyStep=0,convoyGap=Infinity,lastHeading=null;
  for(let i=0;i<=110;i++){
    const t=1+i/10,p=poseAt(convoy,convoyItem,t),points=[view.project(p.lon,p.lat),...formationMembers({t,item:convoyItem,internal:convoy},view,env).map(m=>m.pose)];
    if(lastHeading!=null)convoyStep=Math.max(convoyStep,Math.abs(angleDelta(lastHeading,p.heading)));lastHeading=p.heading;
    for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)convoyGap=Math.min(convoyGap,Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y));
  }
  return {frames:111,fps:10,maxHeadingStepDegrees:maxHeadingStep,minCenterSeparationPixels:minSeparation,maxFormationDistanceErrorPixels:maxSpacingError,deckReleasePositionGapPixels:Math.hypot(after.x-before.x,after.y-before.y),deckReleaseHeadingGapDegrees:Math.abs(angleDelta(before.angle/RAD,after.angle/RAD)),convoy:{maxHeadingStepDegrees:convoyStep,minCenterSeparationPixels:convoyGap},poses};
}
const RAD=Math.PI/180;
window.__unitsQA={setup,draw,hash,benchmark,motionMetrics,viewAt,get context(){return context;},get runtime(){return runtime;},get scene(){return scene;},get tiles(){return tiles;}};
window.__unitsReady=setup(await readJSON(query.get('items')||'scene-unidades.json'));
await window.__unitsReady;
let playing=false,last=null,current=0;
document.querySelector('#play').onclick=()=>{playing=!playing;last=null;};document.querySelector('#time').oninput=e=>{playing=false;current=Number(e.target.value);draw(current);};
function frame(now){if(playing){if(last!=null)current=(current+(now-last)/1000)%(scene.duration||8);draw(current);last=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
