import {Tactico} from '../core.js';
import {pathAt, textOutlined, stroke} from '../util.js';
const states = ['normal', 'hit'];
const route = {via: [[56.25,26.65],[56.45,26.5],[56.75,26.35]], t: 1, dur: 6, curve: 'smooth', ease: 'inOut'};
Tactico.component('debug.dot', {
  layer: 40, animated: false,
  summary: 'Punto geográfico; sirve como unidad de prueba para trayectorias y estados.',
  params: {r: {type:'number', default:18, min:1, max:200}}, states,
  draw(g, s, view, env) {
    if (!s.pos) return; const p = view.project(s.pos.lon,s.pos.lat); if (!p.visible) return;
    const r = s.item.r * env.U;
    g.beginPath(); g.arc(p.x,p.y,r,0,Math.PI*2); g.fillStyle=env.palette.accent; g.fill();
    if (s.stateWeights.hit > 0) { g.save();g.globalAlpha*=s.stateWeights.hit;g.fillStyle=env.palette.ink;g.fill();g.restore(); }
    stroke(g,null,{color:env.palette.ink,width:2*env.U,outline:env.palette.background,outlineWidth:3*env.U});
  },
  demo: {id:'core-dot',type:'debug.dot',at:[56.25,26.65],t:0,dur:9,path:route,states:[{at:5,state:'hit',dur:.8}]},
});
Tactico.component('debug.path', {
  layer: 15, animated: false,
  summary: 'Trayectoria Mercator con cabeza y tramo recorrido; línea, arco o Catmull-Rom.',
  params: {width:{type:'number',default:4,min:.1,max:30}}, states,
  prepare(item) {
    const path = {...item.path,t:0,dur:1,ease:'linear'};
    return Object.freeze(Array.from({length:129},(_,i)=>Object.freeze(pathAt(path,i/128))));
  },
  validate: item => item.path ? [] : ['debug.path necesita path'],
  draw(g,s,view,env) {
    const points=s.internal.map(p=>view.project(p.lon,p.lat));
    const draw=(until,alpha)=>{
      g.save();g.globalAlpha*=alpha;g.beginPath();g.moveTo(points[0].x,points[0].y);
      for(let i=1;i<=until;i++)g.lineTo(points[i].x,points[i].y);
      stroke(g,null,{color:env.palette.accent,width:s.item.width*env.U,outline:env.palette.background,outlineWidth:2*env.U});g.restore();
    };
    draw(points.length-1,.25);draw(Math.floor((s.pos?.u??0)*(points.length-1)),1);
  },
  demo:{id:'core-path',type:'debug.path',t:0,dur:9,path:route},
});
Tactico.component('debug.label', {
  layer:70,animated:false,
  summary:'Rótulo geográfico con contorno y tipografía declarada.',
  params:{text:{type:'string',required:true},size:{type:'number',default:28,min:1,max:200},font:{type:'string',default:'sans-serif'},dy:{type:'number',default:-42}},states,
  draw(g,s,view,env){
    if(!s.pos)return;const p=view.project(s.pos.lon,s.pos.lat);if(!p.visible)return;
    textOutlined(g,s.item.text,p.x,p.y+s.item.dy*env.U,{size:s.item.size*env.U,font:env.font(s.item.font),color:env.palette.ink,outline:env.palette.background});
  },
  demo:{id:'core-label',type:'debug.label',text:'Núcleo táctico',at:'core-dot',t:0,dur:9},
});
