import {Tactico} from '../core.js';

const baseURL=new URL('../../atlas-en-movimiento/',import.meta.url);
const defaults={ink:'#081e2c',paper:'#e9e3ba',accent:'#f6edb4',metal:'#bac9ca',side:'#47595c',water:'#084c68'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const imageCache=new Map();
const materialCache=new Map();
const colors=ctx=>({...defaults,...ctx.palette,...ctx.scene?.defs?.palette,ink:ctx.scene?.defs?.palette?.ink??ctx.palette?.dark??ctx.palette?.background??defaults.ink});
function cached(item,p,build){const {id,t,dur,out,fade,at,z,layer,offset,scale,states,...visual}=item;const key=JSON.stringify([visual,p]);if(!materialCache.has(key)){if(materialCache.size>=128)materialCache.delete(materialCache.keys().next().value);materialCache.set(key,build());}return materialCache.get(key);}
let fontReady;
function font(){return fontReady??=(async()=>{if(typeof FontFace==='undefined')return;const face=new FontFace('AtlasEditorial',`url(${new URL('../assets/fonts/AtlasEditorial.ttf',import.meta.url).href})`);document.fonts.add(await face.load());})();}
const mk=(w,h)=>typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
function local(src){return typeof src==='string'&&!!src&&!/^(?:[a-z]+:|\/\/|\/)/i.test(src)&&!src.split('/').includes('..');}
async function image(src,base=baseURL){
 if(!src)return null;
 if(!local(src))throw Error('El medio debe ser una ruta local relativa a la plantilla');
 const url=new URL(src,base).href;
 if(!imageCache.has(url))imageCache.set(url,(async()=>{const img=new Image();img.src=url;await img.decode();return img;})());
 return imageCache.get(url);
}
function octagon(g,x,y,r){g.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?g.lineTo(px,py):g.moveTo(px,py);}g.closePath();}
function shape(g,x,y,r,name){if(name==='circle'){g.beginPath();g.arc(x,y,r,0,Math.PI*2);}else octagon(g,x,y,r);}
function cover(g,img,x,y,w,h,focus=[.5,.38]){if(!img)return;const k=Math.max(w/img.width,h/img.height),sw=w/k,sh=h/k,sx=clamp(img.width*focus[0]-sw/2,0,img.width-sw),sy=clamp(img.height*focus[1]-sh/2,0,img.height-sh);g.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
function contain(g,img,x,y,w,h){if(!img)return;const k=Math.min(w/img.width,h/img.height);g.drawImage(img,x+(w-img.width*k)/2,y+(h-img.height*k)/2,img.width*k,img.height*k);}
function wrap(g,text,w){const lines=[];let line='';for(const word of String(text??'').split(/\s+/)){
 if(g.measureText(word).width>w){if(line)lines.push(line);line='';for(const letter of word){if(line&&g.measureText(line+letter).width>w){lines.push(line);line='';}line+=letter;}}
 else if(line&&g.measureText(line+' '+word).width>w){lines.push(line);line=word;}else line+=(line?' ':'')+word;
 }if(line)lines.push(line);return lines;}
function text(g,value,x,y,w,{size=24,color=defaults.paper,weight=700,align='center',maxLines=4}={}){
 let lines;for(let n=0;n<12;n++){g.font=`${weight} ${size}px AtlasEditorial, sans-serif`;lines=wrap(g,value,w);if(lines.length<=maxLines)break;size*=.92;}
 g.textAlign=align;g.fillStyle=color;g.textBaseline='top';const step=size*1.2;for(let i=0;i<lines.length;i++)g.fillText(lines[i],x,y+i*step);return lines.length*step;
}
function material(painter,w,h){const c=mk(w,h);painter(c.getContext('2d'));return c;}
function badge(item,img,p){return material(g=>{
 const cx=210,cy=182,r=150;g.fillStyle=p.ink;shape(g,cx+7,cy+12,r+10,item.shape);g.fill();
 g.save();shape(g,cx,cy,r,item.shape);g.clip();g.fillStyle=p.side;g.fillRect(40,20,340,330);cover(g,img,cx-r,cy-r,r*2,r*2,item.focus);g.restore();
 g.strokeStyle=p.accent;g.lineWidth=12;g.globalAlpha=.15;shape(g,cx,cy,r+6,item.shape);g.stroke();g.globalAlpha=1;g.lineWidth=4;shape(g,cx,cy,r,item.shape);g.stroke();
 g.fillStyle=p.ink;g.fillRect(12,342,396,157);let y=354;
 y+=text(g,item.name??item.label??'',210,y,370,{size:29,color:p.paper,maxLines:2})+8;
 y+=text(g,item.role??'',210,y,370,{size:22,color:p.accent,maxLines:2})+5;
 text(g,item.date??'',210,y,370,{size:19,color:p.paper,maxLines:1});
 text(g,item.credit,210,506,392,{size:21,color:p.paper,maxLines:2});
 },420,568);}
function cutout(item,img,p){return material(g=>{
 g.fillStyle=p.ink;octagon(g,222,242,205);g.fill();g.fillStyle=p.water;octagon(g,212,230,200);g.fill();g.strokeStyle=p.accent;g.lineWidth=4;g.stroke();
 const person=mk(344,405),pg=person.getContext('2d');contain(pg,img,0,0,344,405);
 if(item.mask?.length){
  // Contorno normalizado trazado a mano sobre el original; nunca segmentación generativa.
  const mask=mk(344,405),mg=mask.getContext('2d'),k=Math.min(344/img.width,405/img.height),w=img.width*k,h=img.height*k;
  mg.filter='blur(1px)';mg.fillStyle=p.paper;mg.beginPath();item.mask.forEach(([x,y],i)=>{const px=(344-w)/2+x*w,py=(405-h)/2+y*h;i?mg.lineTo(px,py):mg.moveTo(px,py);});mg.closePath();mg.fill();
  pg.globalCompositeOperation='destination-in';pg.drawImage(mask,0,0);
 }
 const border=mk(344,405),bg=border.getContext('2d');bg.drawImage(person,0,0);bg.globalCompositeOperation='source-in';bg.fillStyle=p.paper;bg.fillRect(0,0,344,405);
 g.save();g.globalAlpha=.5;g.drawImage(border,50,31);g.restore();
 for(const [x,y] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,-2],[-2,2],[2,2]])g.drawImage(border,43+x,21+y);
 g.drawImage(person,43,21);
 g.fillStyle=p.ink;g.fillRect(10,435,410,135);let y=448;
 y+=text(g,item.name??item.label??'',215,y,390,{size:29,color:p.paper,maxLines:2})+8;
 y+=text(g,[item.role,item.date].filter(Boolean).join(' · '),215,y,390,{size:20,color:p.accent,maxLines:2})+6;
 text(g,item.credit,215,y,390,{size:21,color:p.paper,maxLines:2});
 },430,620);}
function press(item,portrait,doc,p){return material(g=>{
 g.save();g.translate(350,208);g.rotate((item.tilt??-7)*Math.PI/180);g.fillStyle=p.ink;g.fillRect(-264,-158,534,344);g.fillStyle=p.paper;g.fillRect(-272,-169,530,340);
 const head=text(g,item.docText,-250,-150,484,{size:33,color:p.ink,align:'left',maxLines:3});
 const creditY=-141+head,creditH=text(g,item.docCredit??item.credit,-250,creditY,484,{size:21,color:p.ink,align:'left',maxLines:2});
 const imageY=creditY+creditH+8;if(doc)contain(g,doc,-245,imageY,470,Math.max(40,146-imageY));g.restore();
 g.fillStyle=p.water;octagon(g,342,485,169);g.fill();
 if(portrait){g.save();g.beginPath();g.roundRect(205,358,270,285,25);g.clip();contain(g,portrait,205,345,270,310);g.restore();g.strokeStyle=p.paper;g.lineWidth=3;g.beginPath();g.roundRect(205,358,270,285,25);g.stroke();}
 g.fillStyle=p.ink;g.fillRect(54,650,582,140);let y=661;
 y+=text(g,[item.name,item.role].filter(Boolean).join(' · '),345,y,550,{size:25,color:p.paper,maxLines:2})+6;
 y+=text(g,item.date??'',345,y,550,{size:22,color:p.accent,maxLines:1})+7;
 text(g,item.credit,345,y,550,{size:22,color:p.paper,maxLines:2});
 },690,805);}
function photo(item,img,p){return material(g=>{
 g.fillStyle=p.ink;g.fillRect(9,12,582,495);g.fillStyle=p.paper;g.fillRect(0,0,582,488);
 g.fillStyle=p.ink;g.fillRect(10,10,562,306);contain(g,img,10,10,562,306);
 let y=332;y+=text(g,item.caption??item.label??'',291,y,546,{size:28,color:p.ink,maxLines:2})+9;
 y+=text(g,item.date??'',291,y,546,{size:21,color:p.side,maxLines:1})+8;
 text(g,item.credit,291,y,546,{size:22,color:p.ink,maxLines:2});
 },600,520);}
function anchor(s,view,env){const a=s.pos??s.item.at;if(Array.isArray(a))return view.project(...a);if(a?.lon!=null)return view.project(a.lon,a.lat);return {x:env.W/2,y:env.H*.5};}
function cardBox(s,view,env,w,h){const point=anchor(s,view,env),scale=(s.item.scale??1)*env.U;
 const width=Math.min(w*scale,env.W-48*env.U,env.H*.72*w/h),height=width*h/w,offset=s.item.offset??[0,-220];
 return {point,width,height,x:clamp(point.x+offset[0]*env.U-width/2,24*env.U,env.W-24*env.U-width),y:clamp(point.y+offset[1]*env.U-height/2,env.H*.08,Math.max(env.H*.08,env.H*.82-height))};
}
const common={src:{type:'string',default:''},credit:{type:'string',default:''},date:{type:'string',default:''},scale:{type:'number',default:1,min:.2,max:2},offset:{type:'array',default:[0,-220]}};
function validate(item,{portrait=false,press=false}={}){
 const e=[];if(!local(item.src))e.push('src debe ser un medio local relativo a la plantilla');if(!item.credit?.trim())e.push('credit es obligatorio y debe ser visible');
 if(portrait){if(!(item.name??item.label)?.trim())e.push('name es obligatorio');if(!item.role?.trim())e.push('role es obligatorio');if(!item.date?.trim())e.push('date es obligatoria');}
 if(press){if(!item.docText?.trim())e.push('docText debe ser provisto por el episodio');if(!item.docCredit?.trim())e.push('docCredit es obligatorio');if(item.docSrc&&!local(item.docSrc))e.push('docSrc debe ser local');}
 if(item.scale!=null&&(!Number.isFinite(item.scale)||item.scale<.2||item.scale>2))e.push('scale debe estar entre .2 y 2');
 if(item.offset&&(!Array.isArray(item.offset)||item.offset.length!==2||item.offset.some(x=>!Number.isFinite(x))))e.push('offset necesita dos números');
 if(item.focus&&(!Array.isArray(item.focus)||item.focus.length!==2||item.focus.some(x=>!Number.isFinite(x)||x<0||x>1)))e.push('focus debe ser [0..1,0..1]');
 if(item.shape&&!['circle','octagon'].includes(item.shape))e.push('shape debe ser circle u octagon');
 if(item.mask?.length&&(!Array.isArray(item.mask)||item.mask.length<3||item.mask.length>80||item.mask.some(point=>!Array.isArray(point)||point.length!==2||point.some(v=>!Number.isFinite(v)||v<0||v>1))))e.push('mask necesita entre 3 y 80 pares normalizados [0..1,0..1]');
 if(item.tilt!=null&&(!Number.isFinite(item.tilt)||Math.abs(item.tilt)>15))e.push('tilt debe estar entre -15 y 15 grados');return e;
}
const portraits={name:{type:'string',default:''},role:{type:'string',default:''},focus:{type:'array',default:[.5,.38]}};
for(const type of ['portrait.badge','portrait.cutout','editorial.press','callout.photo'])Tactico.component(type,{
 animated:false,
 layer:80,summary:{'portrait.badge':'Retrato circular u octogonal con cargo y fecha documentada.','portrait.cutout':'Retrato con máscara suave sobre una forma, borde y sombra.','editorial.press':'Retrato y documento inclinado; solo docText del episodio y atribución explícita.','callout.photo':'Foto/documento con pie y crédito visibles, haz hasta un punto del mapa.'}[type],
 params:{...common,...(type==='callout.photo'?{caption:{type:'string',default:''},beam:{type:'boolean',default:true}}:portraits),...(type==='portrait.badge'?{shape:{type:'enum',values:['circle','octagon'],default:'octagon'}}:{}),...(type==='portrait.cutout'?{mask:{type:'array',default:[]}}:{}),...(type==='editorial.press'?{docText:{type:'string',default:''},docSrc:{type:'string',default:''},docCredit:{type:'string',default:''},tilt:{type:'number',default:-7}}:{})},
 validate:item=>validate(item,{portrait:type.startsWith('portrait'),press:type==='editorial.press'}),
 async prepare(item,ctx){await font();const p=colors(ctx),src=await image(item.src,ctx.base),doc=await image(item.docSrc,ctx.base);
  const bitmap=cached(item,p,()=>type==='portrait.badge'?badge(item,src,p):type==='portrait.cutout'?cutout(item,src,p):type==='editorial.press'?press(item,src,doc,p):photo(item,src,p));return {bitmap,palette:p};
 },
 draw(g,s,view,env){const bitmap=s.internal.bitmap,base=type==='callout.photo'?640:type==='editorial.press'?750:470;const b=cardBox(s,view,env,base,base*bitmap.height/bitmap.width);g.save();
  if(type==='callout.photo'&&s.item.beam!==false){const x=b.point.x,y=b.point.y,top=b.y+b.height*.93;
   if(y>top+12*env.U){const gradient=g.createLinearGradient(x,top,x,y);gradient.addColorStop(0,s.internal.palette.metal);gradient.addColorStop(1,s.internal.palette.water);g.save();g.globalAlpha*=.3;g.fillStyle=gradient;g.beginPath();g.moveTo(b.x+b.width*.2,top);g.lineTo(b.x+b.width*.8,top);g.lineTo(x,y);g.closePath();g.fill();g.restore();
    g.strokeStyle=s.internal.palette.accent;g.lineWidth=2*env.U;g.beginPath();g.arc(x,y,8*env.U,0,Math.PI*2);g.stroke();}
  }
  g.drawImage(bitmap,b.x,b.y,b.width,b.height);g.restore();
 },
 demo:type==='callout.photo'?{id:'demo-photo',type,at:[51,27],src:'assets/media/A04.png',caption:'Iran Ajr · tras la captura',date:'22 sep 1987',credit:'PH3 Henry Cleveland · U.S. Navy · PD',offset:[0,-390],t:0,dur:8,out:7}:type==='editorial.press'?{id:'demo-press',type,at:[51,28],src:'assets/media/P03-soft.png',name:'Ronald Reagan',role:'Presidente de EE. UU.',date:'1987 · foto: 7 feb 1981',credit:'Michael Evans · Casa Blanca · PD',docSrc:'assets/media/A01.png',docText:'USS Stark · daños tras el ataque',docCredit:'U.S. Navy · DN-ST-89-01562 · PD',offset:[0,-100],t:0,dur:8,out:7}:{id:'demo-'+type.replace('.','-'),type,at:[51,28],src:type==='portrait.cutout'?'assets/media/P01-soft.png':'assets/media/P01.png',name:'Ruhollah Jomeini',role:'Líder supremo de Irán',date:'Foto: 6 may 1981',credit:'Ali Kaveh · PD-Iran · Commons',shape:'octagon',...(type==='portrait.cutout'?{mask:[[.28,0],[.73,0],[.85,.04],[.93,.15],[.94,.3],[.9,.43],[.81,.49],[.78,.68],[.97,.76],[1,.99],[0,.99],[.03,.77],[.22,.7],[.19,.48],[.12,.44],[.08,.33],[.09,.22],[.14,.12],[.21,.04]]}:{}),offset:[0,-100],t:0,dur:8,out:7},
});
Tactico.component('inventory.units',{
 animated:false,
 layer:80,summary:'Rejilla de siluetas de unidades con contador explícito; máximo 60 iconos y total independiente.',
 params:{icon:{type:'string',default:'naval.carrier'},useSprites:{type:'boolean',default:false},count:{type:'number',default:11,min:0,max:60},total:{type:'number',default:null,min:0,max:1000000},columns:{type:'number',default:4,min:1,max:10},label:{type:'string',default:'Inventario'},scale:{type:'number',default:1,min:.2,max:2},offset:{type:'array',default:[0,-200]}},
 validate(item){const e=[];for(const [key,min,max] of [['count',0,60],['columns',1,10],['total',0,1000000]])if(item[key]!=null&&(!Number.isInteger(item[key])||item[key]<min||item[key]>max))e.push(`${key} debe ser entero entre ${min} y ${max}`);if(item.total!=null&&item.total<(item.count??11))e.push('total no puede ser menor que count');if(item.scale!=null&&(!Number.isFinite(item.scale)||item.scale<.2||item.scale>2))e.push('scale debe estar entre .2 y 2');return e;},
 async prepare(item,ctx){await font();if(item.useSprites||ctx.scene?.spriteManifest)await ctx.loadSprites?.();const p=colors(ctx),count=item.count??11,cols=item.columns??4,rows=Math.max(1,Math.ceil(count/cols)),w=540,h=145+rows*96;
  const bitmap=cached(item,p,()=>material(g=>{g.fillStyle=p.ink;g.fillRect(0,0,w,h);text(g,item.label??'Inventario',24,15,w-48,{size:28,color:p.paper,align:'left',maxLines:2});
   const sprite=ctx.env?.sprite?.(item.icon??'naval.carrier')??ctx.sprites?.sprite?.(item.icon??'naval.carrier');
   for(let i=0;i<count;i++){const x=35+(i%cols+.5)*(w-70)/cols,y=98+Math.floor(i/cols)*96;
    if(sprite?.available)sprite.draw(g,x,y,{length:78,heading:30,shadow:true});
    else{g.save();g.translate(x,y);g.rotate(-.4);g.fillStyle=p.metal;g.strokeStyle=p.accent;g.lineWidth=1.5;g.beginPath();g.moveTo(-33,-13);g.lineTo(29,-13);g.lineTo(40,0);g.lineTo(28,13);g.lineTo(-33,13);g.closePath();g.fill();g.stroke();g.fillStyle=p.side;g.fillRect(-15,-3,32,5);g.fillRect(1,6,12,5);g.restore();}
   }
   text(g,String(item.total??count),w-26,h-49,w-52,{size:39,color:p.accent,align:'right',maxLines:1});
  },w,h));return {bitmap,palette:p};
 },
 draw(g,s,view,env){const img=s.internal.bitmap,b=cardBox(s,view,env,480,480*img.height/img.width);g.save();g.drawImage(img,b.x,b.y,b.width,b.height);g.restore();},
 demo:{id:'demo-inventory',type:'inventory.units',at:[51,28],icon:'naval.carrier',count:11,total:11,columns:4,label:'Inventario · muestra de biblioteca',offset:[0,-100],t:0,dur:8,out:7,note:'Ejemplo de capacidad; no es una cifra de la guerra del Golfo.'},
});
