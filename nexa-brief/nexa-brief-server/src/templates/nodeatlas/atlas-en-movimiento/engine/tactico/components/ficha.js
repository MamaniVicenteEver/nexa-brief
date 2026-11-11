import {Tactico} from '../core.js';
import {episodeMediaURL} from '../episode-data.js';

const cache=new Map();
export const localMedia=s=>typeof s==='string'&&!!s&&!/^(?:[a-z]+:|\/\/|\/)/i.test(s)&&!s.split('/').includes('..');
export async function loadMedia(src,ctx){
 if(!src)return null;
 if(!localMedia(src))throw Error('El medio debe ser una ruta local relativa a la plantilla');
 const url=episodeMediaURL(src,ctx).href;
 if(!cache.has(url))cache.set(url,(async()=>{const image=new Image();image.src=url;await image.decode();return image;})());
 return cache.get(url);
}
export function media(g,img,x,y,w,h,filter,mask,focus=[.5,.38]){
 if(!img)return;g.save();g.beginPath();
 if(mask===true||mask==='circle')g.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else g.rect(x,y,w,h);
 g.clip();g.filter=filter||'none';const k=Math.max(w/img.width,h/img.height),sw=w/k,sh=h/k;
 const sx=Math.max(0,Math.min(img.width-sw,img.width*focus[0]-sw/2)),sy=Math.max(0,Math.min(img.height-sh,img.height*focus[1]-sh/2));
 g.drawImage(img,sx,sy,sw,sh,x,y,w,h);if(mask&&typeof mask==='object'&&Number.isFinite(mask.desde)){g.globalCompositeOperation='destination-in';const gradient=g.createLinearGradient(0,y,0,y+h);gradient.addColorStop(Math.max(0,Math.min(1,mask.desde/100)), 'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gradient;g.fillRect(x,y,w,h);}g.restore();
}
export function line(g,token,value,x,y,width,maxLines=2,halo){
 if(!value)return y;g.save();g.font=token.font;if('fontStretch'in g)g.fontStretch=globalThis.__kw(token.ancho);if('letterSpacing'in g)g.letterSpacing=`${token.espaciado*token.size}px`;
 const words=String(token.mayusculas?String(value).toLocaleUpperCase():value).split(/\s+/),lines=[];let current='';
 for(const word of words){const next=current?current+' '+word:word;if(current&&g.measureText(next).width>width){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);g.restore();
 if(lines.length>maxLines)lines.splice(maxLines-1,lines.length,lines.slice(maxLines-1).join(' '));const step=token.size*(token.interlinea||1.15);for(const text of lines){token.draw(g,text,x,y,{baseline:'top',maxWidth:width,...(halo||{})});y+=step;}return y;
}
export function slotBox(env,side,w,h,topOverride){
 const U=Math.min(env.W,env.H)/1080,st=env.estilo,slot=st.slot(side==='der'?'fichaDer':'fichaIzq'),other=st.slot(side==='der'?'fichaIzq':'fichaDer');
 const W=env.W/U,H=env.H/U,margin=side==='der'?(slot?.der??0):(slot?.izq??0),x=side==='der'?W-margin-w:margin;
 const subtitle=st.slot('subtitulo'),title=st.slot('titular'),titleSize=st.estilos.titular?.principal?.tam??0,top=topOverride??Math.max(slot?.arriba??0,(title?.arriba??0)+titleSize*4.5+(st.estilos.ficha.separacion??0)),bottom=Math.min(H,subtitle?.arriba??H);
 return {x:Math.max(0,Math.min(W-w,x)),y:Math.max(0,Math.min(top,bottom-h)),w,h,U,mid:(W+(other?.izq??0)-(slot?.der??0))/2};
}
export function drawFicha(g,env,item,img,side='izq',column=false,paired=false){
 const st=env.estilo,f=st.estilos.ficha,photo=f.foto,sep=f.separacion??0,fw=photo.ancho,fh=photo.alto;
 let tw=f.anchoTexto??f.ancho??fw,w=column?Math.max(fw,tw):fw+sep+tw;
 if(paired){const W=env.W/(Math.min(env.W,env.H)/1080),left=st.slot('fichaIzq')?.izq??0,right=st.slot('fichaDer')?.der??0;w=Math.min(w,(W-left-right-sep)/2);tw=column?w:Math.max(0,w-fw-sep);}
 const tokens=['nombre','cargo','pie','credito'].map(p=>st.txt('ficha.'+p));
 const values=[item.name??item.label,item.role,item.date,item.credit],textHeight=values.reduce((a,v,i)=>a+(v?tokens[i].size*(tokens[i].interlinea||1.15)*2+(i?f[['nombre','cargo','pie','credito'][i]]?.margenArriba??0:0):0),0);
 const h=column?fh+sep+textHeight:Math.max(fh,textHeight),b=slotBox(env,side,w,h);
 g.save();g.scale(b.U,b.U);const x=b.x,y=b.y,px=column?x:(side==='der'?x+w-fw:x),tx=column?x:(side==='der'?x:x+fw+sep),ty=column?y+fh+sep:y;
 const panel={...st.paneles,...st.paneles?.por?.ficha}; if(panel.visible){g.save();g.fillStyle=st.col(panel.color);g.globalAlpha*=panel.opacidad??1;g.fillRect(x,y,w,h);g.restore();}
 const focus=item.focus??(photo.posicion?.match(/[\d.]+/g)?.map(n=>Number(n)/100));media(g,img,px,y,fw,fh,photo.filtro,photo.mascara,focus?.length===2?focus:undefined);let yy=ty;
 values.forEach((value,i)=>{if(!value)return;if(i)yy+=f[['nombre','cargo','pie','credito'][i]]?.margenArriba??0;yy=line(g,tokens[i],value,tx,yy,tw,2);});g.restore();return b;
}
const params={src:{type:'string',default:''},name:{type:'string',default:''},role:{type:'string',default:''},date:{type:'string',default:''},credit:{type:'string',default:''},side:{type:'enum',values:['izq','der'],default:'izq'},focus:{type:'array',default:null}};
const person={src:'assets/media/P01.png',name:'Ruhollah Jomeini',role:'Líder supremo de Irán',date:'6 may 1981',credit:'Ali Kaveh · PD-Iran · Commons'};
for(const type of ['portrait.card','portrait.column','portrait.pair'])Tactico.component(type,{
 layer:80,animated:false,summary:type==='portrait.pair'?'Dos fichas enfrentadas, cada una en su ranura.':type==='portrait.column'?'Ficha de persona con foto sobre los datos.':'Ficha horizontal de persona con foto y datos.',
 params:{...params,...(type==='portrait.pair'?{left:{type:'object',default:person},right:{type:'object',default:{...person,src:'assets/media/P03-soft.png',name:'Ronald Reagan',role:'Presidente de EE. UU.',credit:'Michael Evans · Casa Blanca · PD'}}}:{})},
 validate(item){const people=type==='portrait.pair'?[item.left,item.right]:[item];return people.flatMap(p=>!p?['Falta una ficha']:['src','name','role','date','credit'].filter(k=>!p[k]||k==='src'&&!localMedia(p[k])).map(k=>`${k} es obligatorio y src debe ser local`));},
 async prepare(item,ctx){return {images:await Promise.all((type==='portrait.pair'?[item.left,item.right]:[item]).map(p=>loadMedia(p?.src,ctx)))};},
 draw(g,s,v,env){if(type==='portrait.pair'){drawFicha(g,env,s.item.left,s.internal.images[0],'izq',false,true);drawFicha(g,env,s.item.right,s.internal.images[1],'der',false,true);}else drawFicha(g,env,s.item,s.internal.images[0],s.item.side??'izq',type==='portrait.column');},
 demo:{id:'demo-'+type.replace('.','-'),type,...(type==='portrait.pair'?{left:person,right:{...person,src:'assets/media/P03-soft.png',name:'Ronald Reagan',role:'Presidente de EE. UU.',credit:'Michael Evans · Casa Blanca · PD'}}:person),t:0,dur:8,out:7}
});
