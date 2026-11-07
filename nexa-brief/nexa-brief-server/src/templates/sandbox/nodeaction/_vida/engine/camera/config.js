export const MOVES=['fixed','follow','dolly','pan','punch','move','push','pull','drift','track','reveal','hold','whip'];
export const STYLES={
 estable:{maxZoomRate:.30,maxPan:.35,maxZoomAcceleration:1.2,maxPanAcceleration:1.4,maxZoomJerk:8,maxPanJerk:10,smoothing:.65,anticipation:.8,deadzone:.035,handheld:0,defaultEase:'smoother',minShot:1.2,breath:.02},
 cine:{maxZoomRate:.24,maxPan:.28,maxZoomAcceleration:.9,maxPanAcceleration:1,maxZoomJerk:6,maxPanJerk:8,smoothing:.8,anticipation:1,deadzone:.04,handheld:.12,defaultEase:'smoother',minShot:1.6,breath:.02},
 documental:{maxZoomRate:.30,maxPan:.35,maxZoomAcceleration:1.2,maxPanAcceleration:1.4,maxZoomJerk:8,maxPanJerk:10,smoothing:.55,anticipation:.8,deadzone:.025,handheld:.25,defaultEase:'smoother',minShot:1.2,breath:.015}
};
export const PRESETS={natural:{headroom:.06,leadRoom:.08,eyeLine:.32},tercios:{headroom:.06,leadRoom:.12,thirds:true,eyeLine:1/3},retrato:{headroom:.08,leadRoom:.08,eyeLine:.38}};
export const RANGES={maxZoomRate:[.01,2],maxPan:[.01,2],maxZoomAcceleration:[.05,10],maxPanAcceleration:[.05,10],maxZoomJerk:[.1,100],maxPanJerk:[.1,100],smoothing:[.1,3],anticipation:[0,3],deadzone:[0,.3],handheld:[0,1],seed:[0,2147483647],minShot:[1.2,10],breath:[0,.03]};
export const SHOT_RANGES={zoom:[.5,3],zoomFrom:[.5,3],zoomTo:[.5,3],lens:[.5,3],ramp:[.001,120],settle:[0,30],hold:[0,120],headroom:[0,.35],leadRoom:[0,.35],eyeLine:[.1,.8],amount:[.01,.2],handheld:[0,1]};
export const EASES=['smooth','smoother','linear','gentle','ease-in-out','ease-in','ease-out'];
export const canonicalMove=m=>({fixed:'hold',follow:'track',punch:'push',move:'pan'}[m]??m??'hold');
export function cameraConfig(input={}){return {...STYLES[input.style??'estable'],style:'estable',seed:1,...input};}
export function compositionConfig(shot){return {...(PRESETS[shot.preset]??{}),...shot};}
function curve(v,p,fail){if(typeof v==='string'&&EASES.includes(v))return;if(Array.isArray(v)&&v.length===4&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&v[0]<=v[2]&&v[1]<=v[3])return;fail(p,'debe ser '+EASES.join(' | ')+' o [x1,y1,x2,y2] monótona entre 0 y 1');}
function number(v,range,p,fail){if(!Number.isFinite(v)||v<range[0]||v>range[1])fail(p,`debe estar entre ${range[0]} y ${range[1]}`);}
const object=(v,p,fail)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(p,'debe ser un objeto');};
const point=(v,p,fail)=>{if(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite))fail(p,'debe ser [x, y] finitos');};
export function validateCamera(input,fail){
 if(input===undefined)return;object(input,'$.camera',fail);
 for(const [k,v]of Object.entries(input)){
  const p='$.camera.'+k;
  if(k==='style'){if(!STYLES[v])fail(p,'debe ser estable | cine | documental');}
  else if(k==='defaultEase')curve(v,p,fail);
  else if(RANGES[k]){number(v,RANGES[k],p,fail);if(k==='seed'&&!Number.isInteger(v))fail(p,'debe ser entero');}
  else fail(p,'parámetro de cámara desconocido');
 }
}
export function validateShot(shot,p,scene,fail){
 const known=new Set(['type','at','until','dur','target','targets','fromTarget','move','ease','transition','locked','fit','offset','from','to','preset','thirds',...Object.keys(SHOT_RANGES)]);
 for(const [k,v]of Object.entries(shot)){
  if(!known.has(k))fail(p+'.'+k,'parámetro de plano desconocido');
  if(SHOT_RANGES[k])number(v,SHOT_RANGES[k],p+'.'+k,fail);
 }
 if(!['wide','two','medium','close','insert'].includes(shot.type))fail(p+'.type','plano desconocido; wide | two | medium | close | insert');
 if(!MOVES.includes(shot.move??'fixed'))fail(p+'.move','movimiento desconocido; '+MOVES.join(' | '));
 if(shot.ease!==undefined)curve(shot.ease,p+'.ease',fail);
 if(!['cut','move','whip','dissolve'].includes(shot.transition??'cut'))fail(p+'.transition','debe ser cut | move | whip | dissolve');
 for(const k of ['fit','locked','thirds'])if(shot[k]!=null&&typeof shot[k]!=='boolean')fail(p+'.'+k,'debe ser booleano');
 if(shot.offset!==undefined)point(shot.offset,p+'.offset',fail);
 if(shot.preset!==undefined&&!PRESETS[shot.preset])fail(p+'.preset','debe ser natural | tercios | retrato');
 if(shot.dur!==undefined)number(shot.dur,[.001,120],p+'.dur',fail);
 if(shot.targets!==undefined&&(!Array.isArray(shot.targets)||shot.targets.length<2))fail(p+'.targets','debe contener al menos dos objetivos');
 const target=(id,path)=>{if(typeof id!=='string'||!scene.actors[id]&&!scene.objects[id]&&!scene.set.anchors[id])fail(path,`objetivo desconocido: ${id}`);};
 for(const k of ['target','fromTarget'])if(shot[k]!==undefined)target(shot[k],p+'.'+k);
 for(const id of shot.targets??[])target(id,p+'.targets');
 for(const key of ['from','to'])if(shot[key]!==undefined){const end=shot[key];object(end,p+'.'+key,fail);for(const [k,v]of Object.entries(end)){const path=p+'.'+key+'.'+k;if(k==='zoom')number(v,[.5,3],path,fail);else if(k==='offset')point(v,path,fail);else if(k==='target')target(v,path);else fail(path,'debe ser zoom | offset | target');}}
}
