const ink='#25242b';
// Bowl center in grip coordinates; shared by drawing and mouth/plate contact.
export const SPOON_BOWL = [-3,-52];
const def=(kind,w,h,grip=[0,0],params={})=>({kind,w,h,grip,params, layers:kind==='scene'?['back','front']:['hand']});
export const PROPS={
 backpack:def('hand',110,155,[0,-12]),notebook:def('hand',108,138,[-44,12]),icecream:def('hand',62,120,[0,30]),phone:def('hand',50,90,[0,12]),spoon:def('hand',23,92,[0,22]),plate:def('hand',115,35,[0,0]),cup:def('hand',64,75,[30,0]),
 'school-gate':def('scene',300,400),desk:def('scene',220,280),counter:def('scene',360,220),chair:def('scene',155,300),bench:def('scene',440,300),table:def('scene',450,280),door:def('scene',250,600),lamp:def('scene',130,440),plant:def('scene',145,220),
 'wall-clock':def('scene',94,94),frame:def('scene',150,120),shelf:def('scene',210,80),rug:def('scene',460,100),poster:def('scene',150,210)
};
export function propBounds(p){const d=PROPS[p.prop??p.type];return [p.x-p.w/2,p.y-(p.params?.h??d.h),p.x+p.w/2,p.y];}
const round=(c,x,y,w,h,r,fill,stroke=ink)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
const line=(c,pts,color=ink,w=4)=>{c.beginPath();c.lineWidth=w;c.strokeStyle=color;pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();};
const oval=(c,x,y,rx,ry,fill,stroke=ink)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}};
export function drawProp(c,type,opts={}) {
 const d=PROPS[type];if(!d)throw new Error(`Objeto desconocido: ${type}`);
 const {x=0,y=0,angle=0,scale=1,params={},layer='all'}=opts;
 c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.lineWidth=3.4;c.lineJoin='round';c.lineCap='round';
 const color=params.color??'#cba383', w=opts.w??d.w,h=params.h??d.h;
 if(d.kind==='hand') {c.translate(-d.grip[0],-d.grip[1]);
  if(type==='notebook'){round(c,-54,-69,108,138,7,'#8eaaa3');round(c,-44,-59,89,117,3,'#fdf4d9');round(c,-55,-69,15,138,3,'#5b7d8d');for(let y=-42;y<54;y+=19)line(c,[[-28,y],[31,y]],'#a8bab5',2);}
  if(type==='backpack'){round(c,-55,-77,110,155,24,params.color??'#a9bd9b');round(c,-42,-6,84,68,14,'#718e86');line(c,[[-26,-74],[-21,-92],[20,-92],[26,-74]]);line(c,[[-52,-52],[-70,-30],[-63,53]],'#536e6d',9);}
  if(type==='phone'){round(c,-25,-45,50,90,8,'#4c596a');round(c,-19,-31,38,61,3,'#bce0dc');line(c,[[-7,-38],[7,-38]],'#d8e4e3',2);}
  if(type==='icecream'){c.beginPath();c.moveTo(-26,0);c.lineTo(0,66);c.lineTo(26,0);c.closePath();c.fillStyle='#dcb479';c.fill();c.stroke();oval(c,0,-18,31,29,'#826052');oval(c,-10,-38,22,20,'#b68b72');}
  if(type==='spoon'){
   c.lineWidth=1.8;
   c.beginPath();c.moveTo(-2,-19);c.bezierCurveTo(-1,-2,-4,23,-5,39);c.quadraticCurveTo(-5,46,0,46);c.quadraticCurveTo(5,46,4,39);c.bezierCurveTo(1,19,3,-2,2,-19);c.closePath();c.fillStyle='#a4b7ba';c.fill();c.strokeStyle='#64777c';c.stroke();
   c.save();c.translate(-3,-30);c.rotate(-.48);oval(c,0,0,9,17,'#b7cbd0','#64777c');
   c.beginPath();c.ellipse(-2,-2,3.2,10,0,0,Math.PI*2);c.fillStyle='#edf3ed';c.fill();c.restore();
  }
  if(type==='plate'){oval(c,0,0,57,17,'#e6eee8');oval(c,0,-2,42,10,'#c8d6c6');}
  if(type==='cup'){oval(c,29,-3,19,22,'#f6e4c9');round(c,-29,-38,57,74,8,'#e6c193');oval(c,0,-35,26,7,'#6c5048');}
 } else {
 const top=-h, left=-w/2, front=layer==='front';
 if(['chair','bench'].includes(type)){const sy=(params.seatY??y-h*.5)-y;if(!front){round(c,left,top,w,h*.4,12,color);for(const dx of [-w*.4,w*.4])line(c,[[dx,sy],[dx,0]],ink,6);}round(c,left,sy,w,14,5,color);}
 else if(type==='counter'){const sy=(params.surfaceY??y-h)-y;round(c,left,sy,w,-sy,4,color);round(c,left-4,sy-8,w+8,16,4,params.topColor??'#f7dcc0');}
 else if(['table','desk'].includes(type)){const sy=(params.surfaceY??y-h)-y;if(front||layer==='all'){for(const dx of [-w*.4,w*.4])line(c,[[dx,sy],[dx,0]],ink,7);round(c,left,sy,w,20,6,color);} }
 else if(type==='door'||type==='school-gate'){round(c,left-8,top-8,w+16,h+8,4,'#597f80');const open=params.open??0, leafW=w*Math.cos(open*1.3);if(type==='door'){round(c,left,top,leafW,h,3,color);round(c,left+leafW*.12,top+30,leafW*.76,h*.56,3,null,'#927260');oval(c,left+leafW*.84,(params.handleY??y-h*.41)-y,6,6,'#e4b969');}else{for(let i=0;i<=8;i++)line(c,[[left+i*leafW/8,top],[left+i*leafW/8,0]],color,7);line(c,[[left,top+h*.2],[left+leafW,top+h*.2]],color,7);line(c,[[left,top+h*.76],[left+leafW,top+h*.76]],color,7);}}
 else if(type==='lamp'){line(c,[[0,top+h*.28],[0,0]],'#705e52',6);oval(c,0,-5,w*.37,12,'#b28c65');c.beginPath();c.moveTo(-w*.32,top);c.lineTo(w*.32,top);c.lineTo(w*.5,top+h*.3);c.lineTo(-w*.5,top+h*.3);c.closePath();c.fillStyle=params.on?'#f4d6a1':color;c.fill();c.stroke();}
 else if(type==='plant'){round(c,-w*.32,-h*.35,w*.64,h*.35,9,'#c28c71');for(let i=0;i<7;i++){const dx=Math.sin(i*2.4)*w*.32,dy=-h*.48-i*h*.06;line(c,[[0,-h*.3],[dx,dy]],'#4b745c',4);oval(c,dx,dy,w*.18,h*.075,color);}}
 else if(type==='wall-clock'){oval(c,0,-h/2,w/2,h/2,'#f7edcf');for(let i=0;i<12;i++){const a=i*Math.PI/6;line(c,[[Math.sin(a)*w*.37,-h/2-Math.cos(a)*h*.37],[Math.sin(a)*w*.42,-h/2-Math.cos(a)*h*.42]],ink,2);}line(c,[[0,-h*.8],[0,-h/2],[w*.23,-h*.4]],ink,3);}
 else if(type==='frame'||type==='poster'){round(c,left,top,w,h,3,color);round(c,left+8,top+8,w-16,h-16,1,'#eee7cc');oval(c,w*.13,-h*.69,w*.13,w*.13,'#d39c75',null);line(c,[[left+18,-18],[-w*.1,-h*.45],[w*.15,-h*.22],[w*.32,-h*.38]],'#8aaba0',12);}
 else if(type==='shelf'){round(c,left,-14,w,14,3,color);for(let i=0;i<5;i++)round(c,left+12+i*24,-h*.8,19,h*.8-14,2,['#b6c4a8','#d9a792','#91aebb'][i%3]);}
 else if(type==='rug'){oval(c,0,-h*.5,w*.5,h*.5,color,null);oval(c,0,-h*.5,w*.43,h*.35,color,'#f0d5ac');}
 }
 c.restore();
}
