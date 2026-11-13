import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolveStyle,merge} from '../style.mjs';
import {arrange,overlaps,wrap} from '../layout.mjs';
import {createNewsHud,hemicyclePoints} from '../hud.mjs';
import {drawNewsIcon,newsIconNames} from '../icons.mjs';
const raw=JSON.parse(await fs.readFile(new URL('../estilos/dynamic-news.json',import.meta.url)));
function canvas(){return new Proxy({globalAlpha:1,font:'',measureText(s){const size=Number(this.font.match(/([\d.]+)px/)?.[1]||16);return {width:[...String(s)].length*size*.46};},arc(x,y,r){assert.ok(r>=0&&Number.isFinite(r));},ellipse(x,y,rx,ry){assert.ok(rx>=0&&ry>=0);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});}
test('preset unifica familia y conserva roles y orientación sin mutar',()=>{
 const a=resolveStyle(raw,{},'movil'),b=resolveStyle(raw,{},'escritorio');
 assert.notEqual(a.layout.safe.bottom,b.layout.safe.bottom);assert.equal(a.fonts.family,'Barlow Condensed');
 assert.equal(a.colors.alert,'#EF3340');assert.equal(a.colors.primary,'#071B36');assert.equal(a.components.headline.width,1);assert.equal(b.components.headline.width,.7);
 assert.equal(raw.formatos.movil.components.headline.width,1);
 assert.throws(()=>merge({},JSON.parse('{"__proto__":{}}')));
});
test('saltos de palabras largas preservan texto y el ancho máximo',()=>{
 const text='ANTICONSTITUCIONALMENTE INFORMACIÓN IMPORTANTE';const lines=wrap(text,12,s=>s.length);
 assert.ok(lines.every(s=>s.length<=12));assert.equal(lines.join('').replaceAll(' ',''),text.replaceAll(' ',''));
});
test('distribución detecta capacidad y nunca devuelve cajas superpuestas',()=>{
 const safe={x:20,y:20,w:300,h:500};const nodes=Array.from({length:20},(_,i)=>({id:String(i),index:i,priority:1,w:140,h:90,preferred:{x:170,y:250}}));
 const result=arrange(nodes,safe,10);assert.ok(result.overflow.length>0);assert.ok(result.boxes.length>1);
 for(const [i,a] of result.boxes.entries())for(const b of result.boxes.slice(i+1))assert.ok(!overlaps(a,b,9.99));
});
test('componentes combinados: lectura mínima, zonas seguras, resize y seek deterministas',()=>{
 const scene={hud:[{type:'topic',text:'ACONTECIMIENTO DE EJEMPLO',t:0,out:6},
 {type:'counter',value:289,label:'DATOS DE EJEMPLO',x:.27,y:.5,t:0,out:6},
 {type:'counter',value:76,label:'SEGUNDO DATO',x:.73,y:.5,t:0,out:6},
 {type:'note',text:'CONTEXTO BREVE',x:.5,y:.7,t:0,out:6}]};
 const hud=createNewsHud(scene,{loadImg:async()=>null},raw),g=canvas();
 for(const [W,H] of [[360,640],[640,360],[360,640]]){
  const view={W,H};hud.draw(g,3,view);const expected=structuredClone(hud.layout());
  assert.equal(expected.overflow.length,0);
  for(const b of expected.boxes){assert.equal(b.font,'Barlow Condensed');assert.ok(b.x>=expected.safe.x-.01&&b.x+b.w<=expected.safe.x+expected.safe.w+.01);assert.ok(b.y>=expected.safe.y-.01&&b.y+b.h<=expected.safe.y+expected.safe.h+.01);}
  hud.draw(g,0,view);hud.draw(g,5,view);hud.draw(g,3,view);assert.deepEqual(hud.layout(),expected);
 }
});
test('los cinco destacados se pueden dibujar en ambos formatos sin tamaños negativos',()=>{
 for(const type of ['alert','headline','key-figure','date-card','message'])for(const [W,H] of [[360,640],[640,360]]){
  const hud=createNewsHud({hud:[{type,text:'UN MENSAJE IMPORTANTE',label:'CONTEXTO',value:72,suffix:' %',t:0,out:6}]},{loadImg:async()=>null},raw);
  hud.draw(canvas(),3,{W,H});assert.equal(hud.layout().overflow.length,0,type);assert.equal(hud.layout().boxes.length,1,type);
 }
});
test('si las posiciones preferidas fragmentan el espacio, reempaca sin perder piezas',()=>{
 const safe={x:20,y:50,w:300,h:448};
 const dimensions=[[300,40],[144,90],[144,87],[144,87],[144,35],[144,56],[144,56]];
 const nodes=dimensions.map(([w,h],i)=>({id:String(i),index:i,priority:100-i,w,h,preferred:{x:170,y:240}}));
 const result=arrange(nodes,safe,7);assert.equal(result.overflow.length,0);assert.equal(result.boxes.length,nodes.length);
});
test('los cintillos agrupados conservan todos los mensajes y el chip conserva su glifo',()=>{
 const painted=[],g=canvas();g.fillText=text=>painted.push(text);
 const hud=createNewsHud({hud:[{type:'topic',text:'PRIMER MENSAJE',t:0,out:6},{type:'topic',text:'SEGUNDO MENSAJE',t:0,out:6},{type:'chip',glyph:'D',x:.5,y:.6,t:0,out:6}]},{loadImg:async()=>null},raw);
 hud.draw(g,3,{W:360,H:640});assert.equal(hud.layout().overflow.length,0);
 assert.equal(hud.layout().boxes.find(b=>b.id==='topic-group').members.length,2);
 assert.ok(painted.includes('PRIMER MENSAJE'));assert.ok(painted.includes('SEGUNDO MENSAJE'));assert.ok(painted.includes('D'));
 const withoutLabel=createNewsHud({hud:[{type:'chip',icon:'chart',t:0,out:6}]},{loadImg:async()=>null},raw);painted.length=0;withoutLabel.draw(g,3,{W:360,H:640});assert.ok(!painted.includes('CHART'));
});

test('hemiciclo mantiene el número exacto y la agrupación de izquierda a derecha',()=>{
 for(const seats of [80,100,435]){const points=hemicyclePoints(seats,7,50);assert.equal(points.length,seats);assert.ok(points.every(p=>p.r>0&&p.r<=50));assert.ok(points.every((p,i)=>i===0||p.angle<=points[i-1].angle));}
});

test('al cambiar de noticia el contenido sale en su ancla, sin ocupar el plano siguiente',()=>{
 const hud=createNewsHud({hud:[{id:'anterior',type:'photo-frame',caption:'PLANO ANTERIOR',t:0,out:1},{id:'siguiente',type:'alert',text:'NUEVA NOTICIA',t:1,out:6}]},{loadImg:async()=>null},raw);
 hud.draw(canvas(),1.05,{W:360,H:640});assert.equal(hud.layout().overflow.length,0);assert.deepEqual(hud.layout().boxes.map(b=>b.id),['siguiente']);
});

test('medios crecen sin cambiar el texto y la foto respeta el ancho seguro móvil',()=>{
 for(const [type,scale] of [['chip',1.3],['portrait',1.4],['photo-frame',1.6]]){
  const scene={hud:[{type,name:'PERSONA',caption:'APOYO',label:'CONTEXTO',t:0,out:6}]};
  const base=structuredClone(raw);base.components[type].mediaScale=1;
  const fonts=[];
  function sample(style,W,H){const g=canvas();g.fillText=(t)=>fonts.push([t,g.font]);const hud=createNewsHud(scene,{loadImg:async()=>null},style);hud.draw(g,3,{W,H});assert.deepEqual(hud.layout().overflow,[]);return hud.layout();}
  const before=sample(base,1920,1080),after=sample(raw,1920,1080);
  const a=before.boxes[0].media,b=after.boxes[0].media,key=type==='photo-frame'?'width':'diameter';
  assert.ok(Math.abs(b[key]/a[key]-scale)<.001,type);
  const half=fonts.length/2;assert.deepEqual(fonts.slice(0,half),fonts.slice(half),type+' keeps label typography');
  const mobile=sample(raw,360,640),box=mobile.boxes[0];assert.ok(box.x+box.w<=mobile.safe.x+mobile.safe.w+.01);
 }
});

test('no hay paneles envolventes ni fondos de iconos y los scrims solo siguen al texto',()=>{
 for(const type of ['topic','counter','city','portrait','photo-frame','chip','hemicycle','alert']){
  const fills=[],rounds=[],g=canvas();g.fillRect=(...args)=>fills.push(args);g.roundRect=(...args)=>rounds.push(args);
  const hud=createNewsHud({hud:[{type,text:'NOTICIA',value:289,label:'CONTEXTO',name:'PERSONA',caption:'APOYO',t:0,out:6}]},{loadImg:async()=>null},raw);
  hud.draw(g,3,{W:640,H:360});assert.equal(fills.length,0,type+' has no enclosing card');
  if(type==='alert'){const box=hud.layout().boxes[0];assert.ok(rounds.length>0);assert.ok(rounds.every(r=>r[3]<box.h),'scrims follow lines only');}
  else assert.equal(rounds.length,0,type+' has no plate');
 }
 assert.ok(parseInt(raw.colors.panel.slice(-2),16)/255<=.2);
});

test('iconos editoriales cubren el catálogo con trazos consistentes y ningún relleno',()=>{
 const g=canvas();g.fill=()=>assert.fail('icon fill');g.fillRect=()=>assert.fail('icon background');
 for(const name of [...newsIconNames,'unknown']){drawNewsIcon(g,name);assert.equal(g.lineWidth,.1);assert.equal(g.lineCap,'round');assert.equal(g.lineJoin,'round');}
 for(const name of ['db','eye','gavel','doc','bolt','drop','drone','shield','chart','lock','ban'])assert.ok(newsIconNames.includes(name));
});


test('foto de apoyo se ajusta al plano denso horizontal sin reducir letras ni omitir piezas',()=>{
 const scene={hud:[{type:'topic',text:'NOTICIA DE EJEMPLO',t:0,out:6},
  {type:'photo-frame',caption:'IMAGEN DE APOYO',aspect:1.5,t:0,out:6},
  ...['db','eye','gavel'].map((icon,index)=>({type:'chip',icon,label:['PRESUPUESTOS','INVESTIGAR','NOMBRAMIENTOS'][index],t:0,out:6}))]};
 const hud=createNewsHud(scene,{loadImg:async()=>null},raw);
 for(const [W,H] of [[640,360],[360,640]]){
  hud.draw(canvas(),3,{W,H});const result=structuredClone(hud.layout());assert.deepEqual(result.overflow,[]);assert.equal(result.boxes.length,5);
  for(const [i,a] of result.boxes.entries())for(const b of result.boxes.slice(i+1))assert.ok(!overlaps(a,b,-.01));
  hud.draw(canvas(),0,{W,H});hud.draw(canvas(),3,{W,H});assert.deepEqual(hud.layout(),result);
 }
});
