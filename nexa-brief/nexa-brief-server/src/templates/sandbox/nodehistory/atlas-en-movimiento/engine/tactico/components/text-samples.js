import {Tactico} from '../core.js';
import {chip, position} from './labels.js';
import {text} from './units.js';

// Independent access to existing embedded type. The video continues to use its
// original parent components, so adding these samples cannot change that scene.
const param = (type, value) => ({type, default:value});
const point = {screen:param('array',[.5,.45])};
const demo = {t:0,dur:6,out:5.5,screen:[.5,.45]};
for (const [name,label,color,width] of [
  ['label.front','FRENTE · aproximado','danger',460],
  ['label.route','ORMUZ','text',430],
]) Tactico.component(name, {
  layer:70,summary:`Rótulo independiente idéntico al integrado en ${name==='label.front'?'front.line':'route.lanes'}.`,
  params:{...point,text:param('string',label),color:param('string',color),size:param('number',24),width:param('number',width)},states:[],
  validate:i=>String(i.text??label).trim()?[]:['text no puede estar vacío'],
  draw(g,s,v,e){chip(g,s.item.text,position(s,v,e),e,s.item);},
  demo:{...demo,type:name,text:label,color,size:24,width},
});
Tactico.component('label.unit', {
  layer:70,summary:'Nombre con el mismo helper que naval (22 px), air (21 px) y unidades (24 px).',
  params:{...point,text:param('string','USS Samuel B. Roberts'),size:param('number',22),color:param('string','#e6e6e6'),outlineColor:param('string','#000000'),font:param('string','AtlasDisplay, sans-serif')},states:[],
  draw(g,s,v,e){const i=s.item,p=position(s,v,e);text(g,i.text,p.x,p.y,i.size*e.U,{...e,font:()=>i.font,palette:{...e.palette,background:i.outlineColor}},i.color);},
  demo:{...demo,type:'label.unit',text:'USS Samuel B. Roberts'},
});
Tactico.component('label.site', {
  layer:70,summary:'Nombre de instalación: mismo trazo 6 U, peso 800 y línea base alfabética de sites.js.',
  params:{...point,text:param('string','Kharg · terminal exportador'),size:param('number',24),color:param('string','#e6e6e6'),outlineColor:param('string','#000000'),outlineWidth:param('number',6),font:param('string','AtlasDisplay, sans-serif'),weight:param('number',800)},states:[],
  draw(g,s,v,e){const i=s.item,p=position(s,v,e);g.save();g.font=`${i.weight} ${i.size*e.U}px ${i.font}`;g.textAlign='center';g.lineJoin='round';g.lineWidth=i.outlineWidth*e.U;g.strokeStyle=i.outlineColor;g.strokeText(i.text,p.x,p.y);g.fillStyle=i.color;g.fillText(i.text,p.x,p.y);g.restore();},
  demo:{...demo,type:'label.site',text:'Kharg · terminal exportador'},
});
// Compatibilidad con escenas antiguas: este componente no dibuja ni se ofrece a productores.
Tactico.component('text.attribution', {
  retired:true,layer:100,summary:'Retirado por decisión de diseño: sin crédito técnico sobre el video.',
  params:{},states:[],animated:false,
  draw(){},
  demo:{type:'text.attribution',t:0,dur:6,fade:0},
});
