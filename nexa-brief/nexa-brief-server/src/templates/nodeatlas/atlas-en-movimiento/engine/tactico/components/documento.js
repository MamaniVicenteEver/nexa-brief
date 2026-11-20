import {Tactico} from '../core.js';
import {loadMedia,localMedia,media,line,slotBox} from './ficha.js';

export function drawDocument(g,env,item,images,kind='document.clip'){
 const st=env.estilo,d=st.estilos.documento,f=d.foto,unit=Math.min(env.W,env.H)/1080;
 const maxW=env.W/unit-(st.slot('fichaIzq')?.izq??0)-(st.slot('fichaDer')?.der??0),w=Math.min(item.width??d.ancho,maxW),pad=d.relleno??0,inner=w-2*pad;
 const count=(kind==='image.strip'||kind==='editorial.press')?Math.max(1,Math.min(3,images.length)):1, gap=st.estilos.ficha.separacion??0,iw=(inner-gap*(count-1))/count,requestedHeight=(item.height??f.alto)*Math.min(1,inner/f.ancho);
 const title=st.txt('documento.titulo'),source=st.txt('documento.fuenteLinea'),sub=st.txt('documento.subtitulo'),credit=st.txt('ficha.credito');
 const personName=st.txt('ficha.nombre'),personRole=st.txt('ficha.cargo');
 const fields=[[title,item.docText??item.caption??item.label,2],[personName,item.name,2],[personRole,item.role,2],[source,item.source,2],[sub,item.date,1],[credit,item.docCredit??item.credit,2]].filter(([,value])=>value);
 function height(token,value,maxLines){g.save();g.font=token.font;if('fontStretch'in g)g.fontStretch=globalThis.__kw(token.ancho);if('letterSpacing'in g)g.letterSpacing=`${token.espaciado*token.size}px`;let n=1,current='';for(const word of String(value).split(/\s+/)){const next=current?current+' '+word:word;if(current&&g.measureText(next).width>inner){n++;current=word;}else current=next;}g.restore();return Math.min(n,maxLines)*token.size*(token.interlinea||1.15);}
 const textHeight=fields.reduce((sum,[token,value,max])=>sum+height(token,value,max),0)+Math.max(0,fields.length-1)*gap;
 const top=env.W>env.H?140:Math.max((st.slot(item.side==='der'?'fichaDer':'fichaIzq')?.arriba??0)-f.alto/2,(st.slot('titular')?.arriba??0)+(st.estilos.titular?.principal?.tam??0)*4.5+gap), bottom=(st.slot('subtitulo')?.arriba??env.H/unit)-st.txt('ficha.nombre').size*2;
 const ih=Math.max(0,Math.min(requestedHeight,bottom-top-2*pad-textHeight-gap));
 const b=slotBox(env,item.side??'izq',w,ih+2*pad+textHeight+gap,top);g.save();g.scale(b.U,b.U);
 const x=b.x,y=b.y,panel={...st.paneles,...st.paneles?.por?.documento};
 if(panel?.visible){g.save();g.fillStyle=st.col(panel.color);g.globalAlpha*=panel.opacidad??1;g.fillRect(x,y,w,b.h);g.restore();}
 if(kind==='document.stamp'){g.save();const sh=st.sombras?.texto?.[0];if(sh){g.shadowColor=st.col(`${st.sombras.color}@${sh[3]}`);g.shadowBlur=sh[2];g.shadowOffsetY=sh[1];}g.fillStyle=st.col('panel');g.fillRect(x+pad,y+pad,inner,ih);g.restore();}
 images.slice(0,count).forEach((image,i)=>media(g,image,x+pad+i*(iw+gap),y+pad,iw,ih,f.filtro,f.mascara,item.focus));
 const halo={halo:st.col(st.sombras.color),haloWidth:st.sombras.halo?.[0]?.[2]??2};let yy=y+pad+ih+gap;yy=line(g,title,item.docText??item.caption??item.label,x+pad,yy,inner,2,halo);if(item.name){yy+=gap;yy=line(g,personName,item.name,x+pad,yy,inner,2,halo);}if(item.role){yy+=gap;yy=line(g,personRole,item.role,x+pad,yy,inner,2,halo);}if(item.source){yy+=gap;yy=line(g,source,item.source,x+pad,yy,inner,2,halo);}if(item.date){yy+=gap;yy=line(g,sub,item.date,x+pad,yy,inner,1,halo);}if(item.docCredit||item.credit){yy+=gap;line(g,credit,item.docCredit??item.credit,x+pad,yy,inner,2,halo);}g.restore();
}
const params={src:{type:'string',default:''},caption:{type:'string',default:''},source:{type:'string',default:''},credit:{type:'string',default:''},side:{type:'enum',values:['izq','der'],default:'izq'},width:{type:'number',default:null},height:{type:'number',default:null}};
for(const type of ['document.clip','document.stamp','image.frame','image.strip'])Tactico.component(type,{
 layer:80,animated:false,summary:{'document.clip':'Recorte documental recto con fuente y crédito.','document.stamp':'Documento con sombra suave, fuente y crédito.','image.frame':'Imagen libre con pie y crédito.','image.strip':'Tira de dos o tres imágenes con pie y créditos.'}[type],params:{...params,...(type==='image.strip'?{images:{type:'array',default:[]}}:{})},
 validate(item){const sources=type==='image.strip'?item.images:[item];const errors=[];if(!Array.isArray(sources)||(type==='image.strip'&&(sources.length<2||sources.length>3)))return ['images necesita dos o tres imágenes'];for(const p of sources){if(!localMedia(p?.src))errors.push('src debe ser un medio local');if(type==='image.strip'&&!p?.credit)errors.push('Cada imagen necesita crédito');}if(!item.caption)errors.push('caption es obligatorio');if(type!=='image.strip'&&!item.credit)errors.push('credit es obligatorio');if(type.startsWith('document.')&&!item.source)errors.push('source es obligatorio');return errors;},
 async prepare(item,ctx){const records=type==='image.strip'?item.images:[item];return {images:await Promise.all(records.map(p=>loadMedia(p.src,ctx)))};},
 draw(g,s,v,env){const item=type==='image.strip'?{...s.item,credit:s.item.images.map(p=>p.credit).join(' · ')}:s.item;drawDocument(g,env,item,s.internal.images,type);},
 demo:{id:'demo-'+type.replace('.','-'),type,src:'assets/media/A01.png',caption:'USS Stark · daños tras el ataque',source:'U.S. Navy',credit:'DN-ST-89-01562 · dominio público',...(type==='image.strip'?{images:[{src:'assets/media/A01.png',credit:'U.S. Navy · PD'},{src:'assets/media/A04.png',credit:'U.S. Navy · PD'}]}:{}),t:0,dur:8,out:7}
});
