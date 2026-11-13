import {drawNewsIcon} from './icons.mjs';
import {merge,resolveStyle} from './style.mjs';
import {arrange,safeRect,wrap} from './layout.mjs';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=n=>1-(1-clamp(n))**3;
const up=value=>String(value??'').toLocaleUpperCase('es');
const NEWS_TYPES=new Set(['alert','headline','key-figure','date-card','message']);
export function hemicyclePoints(seats,rows,radius){
 const weights=Array.from({length:rows},(_,j)=>.45+.55*j/(rows-1)),sum=weights.reduce((a,b)=>a+b,0),points=[];
 let drawn=0;
 weights.forEach((weight,j)=>{const count=j===rows-1?seats-drawn:Math.min(seats-drawn,Math.round(seats*weight/sum));for(let k=0;k<count;k++){points.push({angle:Math.PI*(1-k/Math.max(1,count-1)),r:radius*weight});drawn++;}});
 return points.sort((a,b)=>b.angle-a.angle||a.r-b.r);
}
export function createNewsHud(scene,env,raw){
 let style=raw,format=null;
 const T=env.T||((n,d)=>typeof n==='number'?n:d), images=new Map(),failed=new Set(),metrics=new Map();
 const items=(scene.hud||[]).map((item,index)=>({...item,_i:index}));
 const jobs=[...new Set(items.map(i=>i.src).filter(Boolean))].map(async src=>{try{const image=await env.loadImg(new URL(src,env.base).href);if(image)images.set(src,image);else failed.add(src);}catch{failed.add(src);}});
 let diagnostic={boxes:[],overflow:[],safe:null};
 const col=(value,fallback='tertiary')=>style.colors[value]||value||style.colors[fallback];
 function at(item,view){
  if(item.at!=null){const point=Array.isArray(item.at)?item.at:env.place?.(item.at);if(!point)return null;const p=view.project(...point);if(!p?.visible)return null;return {x:p.x,y:p.y};}
  return null;
 }
 function active(item,t){const start=T(item.t,0),out=item.out==null?Infinity:T(item.out,Infinity),exit=item.news?.exit??item.exit??style.components[item.type]?.exit??0,enter=item.news?.enter??item.enter??style.components[item.type]?.enter??.25;
  // The declared out anchor is the cut: no trailing chart from the previous story.
  if(t<start||t>=out+exit)return null;return {start,elapsed:t-start,alpha:(enter>0?ease((t-start)/enter):1)*(exit>0?1-ease((t-out)/exit):1)};}
 function config(item,portrait){const base=style.components[item.type];if(!base)return null;
  // Old prototype sizes cannot force new labels below the style's reading floor.
  const patch=merge(item.news||{},item[portrait?'portrait':'landscape']||{});
  const result=merge(base,patch);result.size=Math.max(result.minSize||style.layout.minText,patch.size??item.size??result.size);
  result.font=patch.font||style.fonts.family;return result;
 }
 function nodeFor(g,item,tm,view,safe,u,photoFit=1){
  const cfg=config(item,view.H>view.W);if(!cfg)return null;
  const point=at(item,view);if(item.at!=null&&!point)return null;
  const pad=(cfg.padding??style.layout.padding)*u;
  const baseWidth=Math.min(safe.w,Math.max(130*u,safe.w*(cfg.width??style.layout.maxWidth)));
  const mediaScale=Math.max(.1,Number(cfg.mediaScale??1))*(item.type==='photo-frame'?photoFit:1);
  const w=item.type==='photo-frame'?Math.min(safe.w,(baseWidth-2*pad)*mediaScale+2*pad):baseWidth,inner=w-2*pad;
  const blocks=[];let height=pad;
  const color=col(cfg.color||item.color||cfg.accent||'tertiary');
  function block(value,size,opts={}){if(value==null||String(value)==='')return;
   const font=`${opts.weight||style.fonts.weight} ${size*u}px '${cfg.font}'`;
   g.font=font;g.letterSpacing='0px';
   const measure=str=>{const key=font+'|'+str;if(!metrics.has(key)){if(metrics.size>=512)metrics.clear();metrics.set(key,g.measureText(str).width);}return metrics.get(key);};
   const lines=wrap(opts.upper===false?value:up(value),inner,measure),step=size*u*style.layout.lineHeight;
   blocks.push({lines,size:size*u,font,step,y:height,color:cfg.color?col(cfg.color):opts.color||style.colors.tertiary,align:opts.align||'left',role:opts.role});height+=step*lines.length+(opts.after??8)*u;
  }
  const small=Math.max(style.layout.minText,cfg.labelSize||style.layout.body),large=cfg.size;
  const graphic={};
  if(NEWS_TYPES.has(item.type)){
   block(item.kicker||cfg.kicker,small,{color:col(cfg.accent||'secondary'),weight:style.fonts.strong});
   if(item.type==='key-figure'){
    block(item.text??`${item.prefix||''}${Number(item.value||0).toLocaleString('es',{maximumFractionDigits:item.decimals??0})}${item.suffix||''}`,large,{color:col(cfg.accent),weight:style.fonts.strong,role:'value'});
    block(item.label,small);
   }else block(item.text,large,{weight:style.fonts.strong});
   if(item.type==='date-card')block(item.label,small,{color:style.colors.muted});
   block(item.detail,small,{upper:false,color:style.colors.muted});
   block(item.source,Math.max(style.layout.minText,small-4),{upper:false,color:style.colors.muted});
  }else if(item.type==='topic'&&item._messages){for(const message of item._messages)block(message.text,cfg.minSize,{weight:style.fonts.strong,after:2});}
  else if(item.type==='topic'||item.type==='note'||item.type==='city')block(item.text,large,{weight:style.fonts.strong});
  else if(item.type==='brand')block(item.text||'NOTICIAS',large,{weight:style.fonts.strong});
  else if(item.type==='lower-title'){
   for(const line of item.lines||[])block(line.text,Math.max(cfg.minSize,line.size||large),{weight:style.fonts.strong,color:line.gradient?style.colors.secondary:style.colors.tertiary});
   block(item.meta,small,{color:style.colors.muted});
  }else if(item.type==='counter'){
   const value=(item.from||0)+((item.value||0)-(item.from||0))*ease(tm.elapsed/(item.count||1));
   const shown=item.text??`${item.prefix||''}${value.toLocaleString('es',{minimumFractionDigits:item.decimals??0,maximumFractionDigits:item.decimals??0})}${item.suffix||''}`;
   // Reserve the final width even while the animated number is still counting.
   block(item.text??`${item.prefix||''}${Number(item.value||0).toLocaleString('es',{maximumFractionDigits:item.decimals??0})}${item.suffix||''}`,large,{color,weight:style.fonts.strong,role:'counter'});
   graphic.counter=shown;block(item.label,small,{color:style.colors.muted});
  }else if(item.type==='portrait'){
   graphic.portrait={y:height,r:Math.min(inner/2,large*u*mediaScale),image:images.get(item.src)};height+=graphic.portrait.r*2+12*u;
   block(item.name,Math.max(style.layout.minText,cfg.nameSize||small),{weight:style.fonts.strong});block(item.role,small,{upper:false,color:style.colors.muted});
  }else if(item.type==='photo-frame'){
   graphic.photo={y:height,w:inner,h:inner/(item.aspect||cfg.aspect||1.6),image:images.get(item.src)};height+=graphic.photo.h+12*u;block(item.caption,small,{upper:false,color:style.colors.muted});
  }else if(item.type==='chip'){
   graphic.icon={y:height,r:Math.min(inner/2,large*u*.55*mediaScale)};height+=graphic.icon.r*2+12*u;block(item.label||'',small,{weight:style.fonts.strong});
  }else if(item.type==='hemicycle'){
   block(item.title,small,{weight:style.fonts.strong});
   const steps=[...(item.steps||[])].filter(s=>tValue(s.t)<=tm.start+tm.elapsed).sort((a,b)=>tValue(a.t)-tValue(b.t)),step=steps.at(-1)||{};
   graphic.hemicycle={y:height,r:Math.min(inner/2,cfg.radius*u),groups:step.groups||[],seats:item.seats||100};height+=graphic.hemicycle.r+10*u;
   for(const stat of step.stats||[])block(`${stat.value} ${stat.label||''}`,small,{color:col(stat.color),weight:style.fonts.strong});
   block(step.note,small,{color:style.colors.muted});
  }else return null;
  const slot=style.layout.slots[cfg.zone]||style.layout.slots.detail;
  const preferred=point&&cfg.x==null&&cfg.y==null?{x:point.x+(item.dx||0)*u,y:point.y+(item.dy||0)*u}:{x:view.W*(cfg.x??item.x??slot[0]),y:view.H*(cfg.y??item.y??slot[1])};
  if(cfg.zone==='topic'){preferred.x=safe.x+w/2;preferred.y=safe.y+height/2+(item.slot||0)*(height+style.layout.gap*u);}
  return {id:item.id||'hud-'+item._i,index:item._i,item,cfg,tm,w,h:height+pad,priority:cfg.priority,preferred,point,blocks,graphic,pad,color};
 }
 const tValue=value=>T(value,0);
 function rounded(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r);}
 function paintLeader(g,box,u){const n=box.node,x=box.x,y=box.y,item=n.item;g.save();g.globalAlpha*=n.tm.alpha;
  if(n.point&&style.layout.leader&&item.type!=='glow'){
   const px=Math.max(x,Math.min(x+box.w,n.point.x)),py=Math.max(y,Math.min(y+box.h,n.point.y));
   g.strokeStyle=style.colors.secondary;g.lineWidth=Math.max(1,2*u);g.beginPath();g.moveTo(n.point.x,n.point.y);g.lineTo(px,py);g.stroke();g.fillStyle=style.colors.secondary;g.beginPath();g.arc(n.point.x,n.point.y,Math.max(2,5*u),0,Math.PI*2);g.fill();
  }
  g.restore();
 }
 function paint(g,box,u){const n=box.node,{item,cfg,tm,blocks,graphic,pad,color}=n,x=box.x,y=box.y;
  g.save();g.globalAlpha*=tm.alpha;
  g.save();g.beginPath();g.rect(x+pad*.5,y,box.w-pad,box.h);g.clip();
  g.textBaseline='top';g.textAlign='left';g.letterSpacing='0px';
  for(const block of blocks){g.font=block.font;g.fillStyle=block.color;
   const lines=block.role==='counter'?wrap(up(graphic.counter),box.w-2*pad,s=>g.measureText(s).width):block.lines;
   lines.forEach((line,index)=>{
    const tx=x+pad,ty=y+block.y+index*block.step;
    // Local text scrims never enclose a photograph, chart or icon.
    if(cfg.textPlate){g.save();g.fillStyle=style.colors.panel;rounded(g,tx-4*u,ty-2*u,Math.min(box.w-2*pad,g.measureText(line).width)+8*u,block.step+2*u,2*u);g.fill();g.restore();}
    g.save();g.shadowColor=style.colors.shadow;g.shadowBlur=(cfg.shadowBlur??style.layout.shadowBlur??4)*u;g.shadowOffsetY=1.5*u;g.fillText(line,tx,ty);g.restore();
   });
  }
  if(graphic.photo){const p=graphic.photo,im=p.image;if(im){const z=Math.max(p.w/im.width,p.h/im.height);g.save();g.beginPath();g.rect(x+pad,y+p.y,p.w,p.h);g.clip();g.drawImage(im,x+pad+(p.w-im.width*z)/2,y+p.y+(p.h-im.height*z)/2,im.width*z,im.height*z);g.restore();}}
  if(graphic.portrait){const p=graphic.portrait,cx=x+box.w/2,cy=y+p.y+p.r;g.save();g.beginPath();for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;(k?g.lineTo:g.moveTo).call(g,cx+p.r*Math.cos(a),cy+p.r*Math.sin(a));}g.closePath();g.clip();if(p.image){const z=Math.max(p.r*2/p.image.width,p.r*2/p.image.height);g.drawImage(p.image,cx-p.image.width*z/2,cy-p.image.height*z/2,p.image.width*z,p.image.height*z);}else{g.fillStyle=style.colors.muted;g.beginPath();g.arc(cx,cy-p.r*.2,p.r*.28,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(cx,cy+p.r*.7,p.r*.65,p.r*.55,0,0,Math.PI*2);g.fill();}g.restore();}
  if(graphic.icon){const p=graphic.icon;g.save();g.translate(x+box.w/2,y+p.y+p.r);g.strokeStyle=color;g.fillStyle=color;
   g.shadowColor=style.colors.shadow;g.shadowBlur=3*u;g.shadowOffsetY=u;
   if(item.glyph){g.font=`${style.fonts.strong} ${p.r*1.5}px '${cfg.font}'`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.fillText(item.glyph,0,0);}
   else{g.scale(p.r*.65,p.r*.65);drawNewsIcon(g,item.icon);}
   g.restore();}
  if(graphic.hemicycle){const p=graphic.hemicycle,seats=Math.max(2,Math.min(500,Math.round(p.seats))),rows=Math.max(3,Math.min(12,item.rows||7)),tones=[];for(const gr of p.groups)for(let k=0;k<Math.max(0,Math.min(seats,gr.n));k++)tones.push(col(gr.color));
   // Exactly the declared number of seats, apportioned across rows.
   hemicyclePoints(seats,rows,p.r).forEach((point,index)=>{g.fillStyle=tones[index]||style.colors.muted;g.beginPath();g.arc(x+box.w/2+Math.cos(point.angle)*point.r,y+p.y+p.r-Math.sin(point.angle)*point.r,Math.max(.8,p.r/(rows*3)),0,Math.PI*2);g.fill();});
  }
  g.restore();g.restore();
 }
 function draw(g,t,view){const orientation=view.H>view.W?'movil':'escritorio';if(format!==orientation){style=resolveStyle(raw,{},orientation);format=orientation;metrics.clear();if(typeof window!=='undefined'&&window.__nexaStyle)window.__nexaStyle.format=orientation;}const u=Math.min(view.W,view.H)/1080,safe=safeRect(view.W,view.H,style.layout),nodes=[];
  const activeItems=items.map(item=>({item,tm:active(item,t)})).filter(row=>row.tm);
  const topics=activeItems.filter(row=>row.item.type==='topic'&&row.item.news?.group!==false);
  const entries=style.layout.groupTopics&&topics.length>1?activeItems.filter(row=>!topics.includes(row)):[...activeItems];
  if(style.layout.groupTopics&&topics.length>1)entries.push({item:{...topics[0].item,id:'topic-group',slot:0,_messages:topics.map(row=>row.item)},tm:{...topics[0].tm,alpha:Math.max(...topics.map(row=>row.tm.alpha))}});
  for(const {item,tm} of entries){
   if(item.type==='glow'){g.save();g.globalAlpha*=tm.alpha*.5;g.strokeStyle=style.colors.important;g.lineWidth=3*u;for(const point of item.points||[item.at]){const p=at({...item,at:point},view);if(p){g.beginPath();g.arc(p.x,p.y,(style.components.glow.size+10*Math.sin(t*2)**2)*u,0,Math.PI*2);g.stroke();}}g.restore();continue;}
   const n=nodeFor(g,item,tm,view,safe,u);if(n)nodes.push(n);
  }
  const brand=nodes.filter(n=>n.item.type==='brand');
  let content=nodes.filter(n=>n.item.type!=='brand'),result=arrange(content,safe,style.layout.gap*u);
  // Enlarge support media up to the safe space available in this particular shot.
  // Never shrink text or drop a component to make the photograph fit.
  if(result.overflow.length&&content.some(n=>n.graphic.photo)){
   for(let step=1;step<=12;step++){
    const fit=1-step*.05;
    const candidates=content.map(n=>n.graphic.photo?nodeFor(g,n.item,n.tm,view,safe,u,fit):n);
    const attempt=arrange(candidates,safe,style.layout.gap*u);
    if(attempt.overflow.length<result.overflow.length){content=candidates;result=attempt;}
    if(!result.overflow.length)break;
   }
  }
  for(const node of brand){const w=Math.min(node.w,safe.w),h=node.h;result.boxes.push({id:node.id,x:safe.x+safe.w-w,y:Math.max(0,safe.y-h-6*u),w,h,node});}
  for(const box of result.boxes)paintLeader(g,box,u);
  for(const box of result.boxes)paint(g,box,u);
  diagnostic={style:style.id,format:view.H>view.W?'9x16':'16x9',safe,boxes:result.boxes.map(({node,...box})=>({...box,type:node.item.type,font:node.cfg.font,media:node.graphic.portrait?{kind:'portrait',diameter:node.graphic.portrait.r*2}:node.graphic.photo?{kind:'photo',width:node.graphic.photo.w,height:node.graphic.photo.h}:node.graphic.icon?{kind:'icon',diameter:node.graphic.icon.r*2}:undefined,members:node.item._messages?.map(m=>m.id||'hud-'+m._i)})),overflow:result.overflow};
 }
 return {items,theme:style,draw,ready:()=>Promise.all(jobs).then(()=>undefined),missing:()=>[...failed],layout:()=>diagnostic,schedule:()=>items.map(i=>({id:i.id||'hud-'+i._i,type:i.type,start:T(i.t,0),end:i.out==null?Infinity:T(i.out,Infinity)}))};
}
