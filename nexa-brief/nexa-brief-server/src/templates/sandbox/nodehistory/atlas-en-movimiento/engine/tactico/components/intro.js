import {Tactico} from '../core.js';

// Two Atlas HUD components. All motion is evaluated from local time; cached
// text contains no timeline, item id, or prior-frame state.
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x*x*(3-2*x); };
const TAU = Math.PI*2;
const baseURL = new URL('../../../', import.meta.url);
const cache = new Map();
let fontsReady;
async function fonts() {
  if (typeof FontFace === 'undefined') return;
  return fontsReady ||= Promise.all([
    ['AtlasIntroTitle','AtlasIntroTitle.ttf','400'],
    ['AtlasIntroUI','AtlasIntroUI.ttf','900'],
  ].map(async ([name,file,weight]) => {
    const face = new FontFace(name, `url(${new URL(`assets/fonts/${file}`,baseURL)})`, {weight});
    document.fonts.add(await face.load());
  }));
}
function palette(env) {
  const p=env.palette;
  return {dark:p.background, text:p.paper||p.text||p.ink, accent:p.neon||p.accent};
}
function metrics(env) {
  // env.U can be width-based in standalone galleries; keep landscape type
  // the same physical size as the portrait type.
  return {u:Math.min(env.U,env.H/1080), port:env.H>env.W};
}
function family(env,kind) {
  const name=kind==='title'?'introTitle':'introUI', requested=env.font(name);
  return requested===name ? (kind==='title'?'AtlasIntroTitle':'AtlasIntroUI') : requested;
}
function wrap(g,text,width) {
  const lines=[];
  for(const paragraph of String(text).split('\n')) {
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(g.measureText(word).width>width) {
        if(line)lines.push(line);line='';
        for(const char of Array.from(word)) {
          if(line&&g.measureText(line+char).width>width){lines.push(line);line='';}
          line+=char;
        }
      } else if(line&&g.measureText(line+' '+word).width>width) {
        lines.push(line);line=word;
      } else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);
  }
  return lines;
}
function textSprite(text,size,width,height,kind,env,tone='text',neon=false) {
  const p=palette(env),font=family(env,kind),{u}=metrics(env);
  const key=JSON.stringify([text,size,width,height,kind,font,u,p,tone,neon]);
  if(cache.has(key))return cache.get(key);
  const measure=new OffscreenCanvas(1,1).getContext('2d');
  let lines=[];
  for(let pass=0;pass<40;pass++) {
    measure.font=`${kind==='title'?400:900} ${size}px ${font}`;
    lines=wrap(measure,text,width);
    if(lines.length*size*1.19<=height)break;
    size*=.92;
  }
  const pad=Math.ceil(12*u),w=Math.ceil(Math.max(1,...lines.map(l=>measure.measureText(l).width))+pad*2);
  const h=Math.ceil(Math.max(size*1.3,lines.length*size*1.19)+pad*2);
  // CPU-backed reusable text avoids GPU-to-CPU readback for each drawImage
  // when Atlas renders with a software/readback canvas.
  const canvas=new OffscreenCanvas(w,h),g=canvas.getContext('2d',{willReadFrequently:true});
  g.font=measure.font;g.textBaseline='middle';g.textAlign='center';g.lineJoin='round';
  lines.forEach((line,n)=>{
    const y=h/2+(n-(lines.length-1)/2)*size*1.19;
    if(neon){g.strokeStyle=p.accent;g.lineWidth=10*u;g.globalAlpha=.15;g.strokeText(line,w/2,y);g.globalAlpha=1;}
    g.strokeStyle=env.palette?.textOutline||p.dark;g.lineWidth=6*u;g.strokeText(line,w/2,y);
    g.fillStyle=p[tone];g.fillText(line,w/2,y);
  });
  const result=Object.freeze({canvas,w,h,size,lines:Object.freeze(lines)});
  if(cache.size>=96)cache.delete(cache.keys().next().value);
  cache.set(key,result);return result;
}
function stamp(g,sprite,x,y,alpha=1,dy=0,reveal=1) {
  if(alpha<=0||reveal<=0)return;
  g.save();g.globalAlpha*=alpha;
  const x0=x-sprite.w/2,y0=y-sprite.h/2+dy;
  if(reveal<1){g.beginPath();g.rect(x0,y0,sprite.w*reveal,sprite.h);g.clip();}
  g.drawImage(sprite.canvas,x0,y0);g.restore();
}
function inkLine(g,points,color,width,alpha=1) {
  g.save();g.globalAlpha*=alpha;g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';
  g.beginPath();points.forEach(([x,y],n)=>n?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.restore();
}
export function outroSchedule(dur=8) {
  return Object.freeze({thanks:0,channel:.08*dur,like:.23*dur,subscribe:.41*dur,support:.61*dur,handle:.76*dur});
}
function envelope(lt,dur) {return ease(lt/.28)*(1-ease((lt-dur+.42)/.42));}
function validateCommon(i,max,min) {
  const errors=[];
  if(!Number.isFinite(i.dur)||i.dur<min||i.dur>max)errors.push(`dur debe estar entre ${min} y ${max} s, incluida la salida`);
  if(i.path||i.states?.length)errors.push('HUD: no admite path ni states; la secuencia depende de dur');
  return errors;
}
function validateIntro(i,ctx) {
  const errors=validateCommon(i,6,2);
  if(!String(i.title||'').trim())errors.push('title es obligatorio');
  if(!ctx.place(i.focus))errors.push('focus debe ser un lugar o [longitud,latitud] válido');
  if((i.t??0)!==0)errors.push('intro.title debe comenzar en t:0');
  return errors;
}
function validateOutro(i,ctx) {
  const errors=validateCommon(i,8,4);
  for(const field of ['channel','thanks','support','handle'])if(!String(i[field]??'').trim())errors.push(`${field} no puede estar vacío`);
  if(!/^youtube\.com\/@[^\s/]+$/.test(i.handle??''))errors.push('handle debe ser youtube.com/@canal (parámetro; sin inventar identidad)');
  const end=ctx.T(ctx.scene.end??ctx.scene.duration,NaN),start=i.t??0;
  if(Number.isFinite(end)&&Math.abs(start+i.dur-end)>.001)errors.push('outro.channel debe ocupar los últimos dur segundos de la escena');
  // The component dims the map, the scene owns its pose. Reject an actual
  // camera move instead of quietly drawing a moving "still" background.
  if(ctx.camera?.at) {
    const first=JSON.stringify(ctx.camera.at(start));
    for(const dt of [.25,.5,.75,1])if(JSON.stringify(ctx.camera.at(start+i.dur*dt))!==first){errors.push('La cámara debe quedar quieta durante outro.channel (sin deriva)');break;}
  }
  return errors;
}
function dim(g,env,alpha) {
  g.save();g.globalAlpha*=alpha;g.fillStyle=palette(env).dark;g.fillRect(0,0,env.W,env.H);g.restore();
}
function ring(g,p,r,progress,env,style) {
  const {u}=metrics(env),col=palette(env).accent;
  g.save();g.strokeStyle=col;g.lineWidth=3*u;
  g.beginPath();g.arc(p.x,p.y,r,-Math.PI/2,-Math.PI/2+TAU*progress);g.stroke();
  if(style==='meridian') {
    for(const sign of [-1,1])inkLine(g,[[p.x+sign*(r+22*u),p.y],[p.x+sign*(r+7*u),p.y]],col,2*u);
    inkLine(g,[[p.x,p.y-r-22*u],[p.x,p.y-r-7*u]],col,2*u);
  } else {
    for(let n=0;n<4;n++) {
      const a=n*Math.PI/2,cs=Math.cos(a),sn=Math.sin(a);
      inkLine(g,[[p.x+cs*(r+8*u),p.y+sn*(r+8*u)],[p.x+cs*(r+18*u),p.y+sn*(r+18*u)]],col,2*u,.7);
    }
  }
  g.beginPath();g.arc(p.x,p.y,4*u,0,TAU);g.fillStyle=col;g.fill();g.restore();
}
function drawIntro(g,s,view,env) {
  const i=s.item,t=s.lt,dur=i.dur;if(t<0||t>=dur)return;
  const {u,port}=metrics(env),p=palette(env),alpha=envelope(t,dur),speed=dur/6;
  g.save();g.globalAlpha*=alpha;dim(g,env,.28);
  const focus=view.project(...s.internal.focus),q=t/speed,lock=ease(q/1.35);
  const radius=(i.style==='focus'?210-140*lock:i.style==='meridian'?125-55*lock:70)*u;
  ring(g,focus,radius,i.style==='trace'?ease(q/.9):1,env,i.style);
  const titleY=env.H*(port?.615:.61),width=env.W*(port?.84:.72);
  const title=textSprite(i.title.toUpperCase(),(port?132:126)*u,width,env.H*(port?.22:.28),'title',env,'text',true);
  const kicker=textSprite(i.kicker.toUpperCase(),25*u,width,70*u,'ui',env,'accent');
  const year=textSprite(i.year,56*u,width,92*u,'title',env,'accent');
  const subtitle=textSprite(i.subtitle,30*u,width,130*u,'ui',env);
  stamp(g,kicker,env.W/2,env.H*(port?.17:.13),ease((q-.08)/.4));
  stamp(g,year,env.W/2,env.H*(port?.235:.225),ease((q-.2)/.4));
  const enter=ease((q-.35)/.7);
  stamp(g,title,env.W/2,titleY,enter,24*u*(1-enter),i.style==='trace'?enter:1);
  const lineY=titleY+title.h/2+12*u,span=Math.min(width*.48,330*u)*ease((q-.6)/.75);
  inkLine(g,[[env.W/2-span,lineY],[env.W/2+span,lineY]],p.accent,3*u);
  stamp(g,subtitle,env.W/2,lineY+60*u,ease((q-.95)/.5));
  g.restore();
}
function symbol(g,name,x,y,u,color) {
  // Original line icons: no emoji glyphs or platform button assets.
  g.save();g.translate(x,y);g.scale(u,u);g.strokeStyle=color;g.lineWidth=3;g.lineJoin='round';g.lineCap='round';g.beginPath();
  if(name==='like') {
    g.rect(-25,-2,10,28);g.moveTo(-15,0);g.lineTo(-3,-16);g.lineTo(-1,-27);g.quadraticCurveTo(10,-30,8,-11);g.lineTo(25,-11);g.quadraticCurveTo(31,-11,28,1);g.lineTo(22,24);g.lineTo(-15,24);g.closePath();
  } else {
    g.moveTo(-20,16);g.quadraticCurveTo(-14,10,-14,-5);g.bezierCurveTo(-14,-28,14,-28,14,-5);g.quadraticCurveTo(14,10,20,16);g.closePath();g.moveTo(-5,24);g.quadraticCurveTo(0,30,5,24);g.moveTo(-29,-12);g.lineTo(-26,-22);g.moveTo(29,-12);g.lineTo(26,-22);
  }
  g.stroke();g.restore();
}
// El mapa del cierre se precarga una vez y la secuencia depende solo del tiempo local.
let worldImage;
async function prepareOutro() {
  await fonts();
  if (typeof Image === 'undefined') return null;
  worldImage ||= (() => { const image=new Image(); image.src=new URL('assets/media/mapa-mundo-cierre.jpg',baseURL).href; return image; })();
  try { await worldImage.decode(); return {world:worldImage}; }
  catch (error) { console.warn('Mapa del cierre no disponible:',error); return null; }
}
function drawOutro(g,s,view,env) {
  const i=s.item,t=s.lt,dur=i.dur;if(t<0||t>=dur)return;
  const W=env.W,H=env.H,port=H>W,cx=W/2,k=port?W/960*1.65:Math.min(W/960,H/540),q=t*8/dur;
  const show=(start,d=.35)=>clamp((q-start)/d),p=palette(env),fade=envelope(t,dur);
  g.save();g.globalAlpha*=fade;
  if(i.bg!=='none' && s.internal?.world) {
    const zoom=1.13-.13*show(0,1.6),image=s.internal.world;
    if(port){const cover=Math.max(W/image.width,H/image.height);g.save();g.globalAlpha=.35;g.drawImage(image,(W-image.width*cover)/2,(H-image.height*cover)/2,image.width*cover,image.height*cover);g.restore();const scale=W/image.width*zoom;g.drawImage(image,(W-image.width*scale)/2,(H-image.height*scale)/2,image.width*scale,image.height*scale);}
    else g.drawImage(image,(W-W*zoom)/2,(H-H*zoom)/2,W*zoom,H*zoom);
  }
  g.fillStyle=`rgba(10,12,15,${clamp(i.dim+.06*show(4,3))})`;g.fillRect(0,0,W,H);
  function text(value,x,y,size,color,weight=700,thick=0,max=W*.88){
    g.save();g.font=`${weight} ${size}px Arial, sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
    g.lineWidth=Math.max(2,size*.085);g.strokeStyle='#000';g.strokeText(value,x,y,max);
    if(thick){g.strokeStyle=color;g.lineWidth=thick;g.strokeText(value,x,y,max);}
    g.fillStyle=color;g.fillText(value,x,y,max);g.restore();
  }
  const ty=port?.19:.17,ny=port?.31:.335,row=port?.47:.585,sup=port?.76:.78,handle=port?.83:.86;
  g.save();g.globalAlpha*=show(.1,.4);text(i.thanks.toUpperCase(),cx,H*ty,(port?30:22)*k,i.secondaryColor,700);g.restore();
  g.save();g.globalAlpha*=show(.3,.7);text(i.channel.toUpperCase(),cx,H*ny,(port?98:76)*k,i.titleColor,900,2.5*k);
  g.fillStyle=i.secondaryColor;g.fillRect(cx-W*.23,H*(ny+.09),W*.46*show(.3,.7),Math.max(1,3*k));g.restore();
  const like=show(1,.24),lx=W*(port?.24:.20),sy=H*row;
  if(like){g.save();g.globalAlpha*=like;const y=sy-(1-like)*35*k;
    g.fillStyle='#f4f4f4';g.strokeStyle='#090909';g.lineWidth=4*k;g.beginPath();g.arc(lx,y-12*k,30*k,Math.PI,0);g.lineTo(lx,y+35*k);g.closePath();g.fill();g.stroke();
    symbol(g,'like',lx,y-12*k,k*.45,'#20252b');text('ME GUSTA',lx+88*k,y-10*k,25*k,i.textColor);
    g.restore();}
  const subX=port?W*.51:W*.61,subY=port?H*.59:sy,bw=Math.min(W*(port?.54:.36),268*k),bh=74*k;
  if(i.arrow!==false&&q>1.25){g.save();g.strokeStyle=i.textColor;g.lineWidth=3*k;g.setLineDash([10*k,8*k]);g.beginPath();g.moveTo(lx+160*k,sy-16*k);g.lineTo(lx+160*k+(subX-bw/2-lx-160*k)*show(1.25,1.2),sy-16*k+(subY-sy)*show(1.25,1.2));g.stroke();g.restore();}
  if(q>=2.5){g.save();g.globalAlpha*=show(2.5,.2);g.fillStyle='#e8e8e8';g.fillRect(subX-bw/2,subY-bh/2,bw,bh);g.strokeStyle='#151515';g.lineWidth=3*k;g.strokeRect(subX-bw/2,subY-bh/2,bw,bh);g.font=`900 ${30*k}px Arial, sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#171717';g.fillText(i.cta,subX,subY,bw*.9);g.restore();}
  if(q>=3.25){g.save();g.globalAlpha*=show(3.25,.2);symbol(g,'bell',Math.min(W-35*k,subX+bw/2+42*k),subY,k*.55,i.textColor);g.restore();}
  if(q>3.65){text(i.support.slice(0,Math.floor((q-3.65)*45)),cx,H*sup,22*k,i.secondaryColor,700);
    g.save();g.globalAlpha*=show(4,.4);text(i.handle,cx,H*handle,18*k,i.textColor,700);g.fillStyle=i.textColor;g.fillRect(cx-W*.13,H*handle+16*k,W*.26,2*k);g.restore();}
  g.restore();
}
const introDemo={id:'intro-atlas',type:'intro.title',title:'EL GOLFO\nBAJO PRESIÓN',subtitle:'Una ruta. Un punto de tensión.',kicker:'ATLAS EN MOVIMIENTO',year:'1987',focus:'Golfo',style:'focus',t:0,dur:6,fade:0};
Tactico.component('intro.title',{
  layer:90,summary:'Título Atlas: anillo geográfico que enfoca el mapa, año, rótulo neón y tres entradas propias.',
  params:{title:{type:'string',required:true,default:'EL GOLFO\nBAJO PRESIÓN'},subtitle:{type:'string',default:''},kicker:{type:'string',default:'ATLAS EN MOVIMIENTO'},year:{type:'string',default:''},focus:{type:'place',default:[52,26.8]},style:{type:'enum',values:['focus','trace','meridian'],default:'focus'},dur:{type:'number',default:6,min:2,max:6},fade:{type:'number',default:0}},
  states:[],validate:validateIntro,
  async prepare(i,c){await fonts();return Object.freeze({focus:Object.freeze([...c.place(i.focus)])});},
  animated:s=>s.lt<1.6*s.item.dur/6||s.lt>s.item.dur-.42,
  draw:drawIntro,demo:{...introDemo,focus:[52,26.8]},
});
Tactico.component('outro.channel',{
  layer:90,summary:'Cierre Atlas ≤8 s: gracias, canal, me gusta, suscribirse y campana, apoyo y handle sin recuadro.',
  params:{channel:{type:'string',default:'NODEHISTORY'},thanks:{type:'string',default:'GRACIAS POR VER'},support:{type:'string',default:'Apoya el canal. Comparte esta historia.'},handle:{type:'string',default:'youtube.com/@nodehistory'},dim:{type:'number',default:.20,min:0,max:1},bg:{type:'enum',values:['world','none'],default:'world'},titleColor:{type:'string',default:'#e8e8e8'},textColor:{type:'string',default:'#f1f1f1'},secondaryColor:{type:'string',default:'#d6d6d6'},cta:{type:'string',default:'SUSCRÍBETE'},arrow:{type:'boolean',default:true},dur:{type:'number',default:8,min:4,max:8},fade:{type:'number',default:0}},
  states:[],validate:validateOutro,prepare:prepareOutro,
  animated:s=>s.lt<s.item.dur*.80||s.lt>s.item.dur-.42,
  draw:drawOutro,demo:{id:'outro-atlas',type:'outro.channel',t:6,dur:8,fade:0,channel:'NODEHISTORY',handle:'youtube.com/@nodehistory'},
});
