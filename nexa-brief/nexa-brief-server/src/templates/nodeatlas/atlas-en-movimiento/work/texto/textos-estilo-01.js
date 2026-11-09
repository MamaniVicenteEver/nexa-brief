import {prepareOutros} from './outro-mundo-preview.js?v=5';
import {Tactico,create,loadComponents} from '../../engine/tactico/core.js';
import {ink} from '../../engine/tactico/components/labels.js';
const root=new URL('../../',import.meta.url),grid=document.querySelector('#cards'),status=document.querySelector('#status');
const palette={background:'#20252b',dark:'#20252b',ink:'#20252b',paper:'#e6e6e6',text:'#e6e6e6',accent:'#f4f4f4',neon:'#f4f4f4',success:'#f4f4f4',danger:'#e6e6e6',cyan:'#f4f4f4'};
const types=['badge.count','caption.transcript','icon.badge','intro.title','label.callout','label.chip','label.figure','label.front','label.neon','label.route','label.site','label.unit','outro.channel','text.year'];
const W=1080,H=1080,view={W,H,zoom:6,project:()=>({x:W/2,y:H*.48,k:1,visible:true})};
const visible=new Set(),observer=new IntersectionObserver(entries=>{for(const e of entries)e.isIntersecting?visible.add(e.target):visible.delete(e.target);},{rootMargin:'180px'});
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,origin=performance.now(),pausedAt=0,loaded=0;
const btn=document.querySelector('#toggle');btn.textContent=playing?'Pausar animaciones':'Reproducir animaciones';
btn.onclick=()=>{if(playing){pausedAt=(performance.now()-origin)/1000;playing=false;}else{origin=performance.now()-pausedAt*1000;playing=true;}btn.textContent=playing?'Pausar animaciones':'Reproducir animaciones';};
document.querySelector('#restart').onclick=()=>{origin=performance.now();pausedAt=0;playing=true;btn.textContent='Pausar animaciones';};
function card(type,description){const article=document.createElement('article');article.className='card';const area=document.createElement('div');area.className='sample';const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Vista de '+type);area.append(canvas);const body=document.createElement('div');body.className='body';const name=document.createElement('h2');name.textContent=type;const note=document.createElement('p');note.textContent=description;body.append(name,note);article.append(area,body);grid.append(article);observer.observe(article);return {article,canvas,body};}
function bounds(g){const data=g.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=0,y1=0;for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4)if(data[(y*W+x)*4+3]>35){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+4);y1=Math.max(y1,y+4);}return x1>x0&&y1>y0?[x0,y0,x1,y1]:null;}
function framedCrop(runtime,g,type){if(type==='intro.title'||type==='outro.channel')return [0,0,W,H];let box=null;for(const t of type==='caption.transcript'?[1.5,3,5,7]:[.6,2.4,4]){g.clearRect(0,0,W,H);runtime.draw(g,view,t);const b=bounds(g);if(b)box=box?[Math.min(box[0],b[0]),Math.min(box[1],b[1]),Math.max(box[2],b[2]),Math.max(box[3],b[3])]:b;}return box||[0,0,W,H];}
async function run(){
 const [catalog,lyrics]=await Promise.all(['engine/tactico/animations/index.json','assets/lyrics.json'].map(async path=>{const r=await fetch(new URL(path,root));if(!r.ok)throw Error('No se pudo cargar '+path);return r.json();}));
 await loadComponents();
 // La fecha aprobada se prueba sin la caja de label.chip; el componente original permanece intacto.
 Tactico.component('preview.fecha',{layer:70,params:{},states:[],draw(g,s,v,e){const env={...e,palette:{...e.palette,dark:'#000000'}};ink(g,s.item.text,e.W/2,e.H*.48,36*e.U,env,'text');}});
 const words=(lyrics.segments||[]).flatMap(s=>s.words||[]),entries=[];
 for(const type of types.filter(x=>x!=='outro.channel')){const meta=catalog.animations.find(x=>x.name===type),c=card(type,type==='label.chip'?'Propuesta de fecha sin recuadro, con letras blancas y contorno negro.':meta?.description||'Vista previa del componente.');entries.push({...c,type});}
 await Promise.all(entries.map(async entry=>{try{
  const def=Tactico.get(entry.type);if(!def?.demo)throw Error('El componente no tiene ejemplo');const item=structuredClone(def.demo);item.id='sample-'+entry.type.replace('.','-');item.t=0;item.sfx=false;
  if(entry.type==='outro.channel'){item.dur=8;item.out=8;}
  if(entry.type==='label.unit'||entry.type==='label.site'){item.color='#e6e6e6';item.outlineColor='#000000';}
  if(entry.type==='label.chip'){item.type='preview.fecha';item.text='17 MAY 1987 · USS STARK';}
  const duration=item.dur??6,scene={duration,end:duration,defs:{palette},items:[item]},ctx={st:{W,H,U:1},look:{palette},geo:{place:p=>Array.isArray(p)?p:null},words};
  const runtime=await create(ctx,scene),surface=new OffscreenCanvas(W,H),g=surface.getContext('2d',{willReadFrequently:true});
  // En la propuesta los contornos de texto son negros; el resto del componente conserva su dibujo.
  const strokeText=g.strokeText.bind(g);g.strokeText=(...args)=>{const color=g.strokeStyle;g.strokeStyle='#000000';strokeText(...args);g.strokeStyle=color;};
  const crop=framedCrop(runtime,g,entry.type),margin=40,cx=(crop[0]+crop[2])/2,cy=(crop[1]+crop[3])/2,cw=Math.max(100,crop[2]-crop[0]+margin*2),ch=Math.max(100,crop[3]-crop[1]+margin*2),scale=Math.min(760/cw,460/ch);
  entry.paint=t=>{g.clearRect(0,0,W,H);if(entry.type==='intro.title'||entry.type==='outro.channel'){g.fillStyle='#20252b';g.fillRect(0,0,W,H);}runtime.draw(g,view,t%duration);const out=entry.canvas.getContext('2d');out.clearRect(0,0,800,500);out.fillStyle='#eeeeee';out.fillRect(0,0,800,500);out.drawImage(surface,0,0,W,H,400-cx*scale,250-cy*scale,W*scale,H*scale);};
  entry.paint(entry.type==='caption.transcript'?1.6:entry.type==='outro.channel'?4:2);loaded++;status.textContent=`${loaded} de 14 componentes listos`;
 }catch(e){const p=document.createElement('p');p.className='error';p.textContent='No se pudo cargar esta vista: '+e.message;entry.body.append(p);loaded++;status.textContent=`${loaded} de 14 componentes preparados`;console.error(entry.type,e);}}));
 entries.push(...await prepareOutros(observer));
 status.textContent='14 componentes · previsualización de la paleta 01';
 function frame(){const t=playing?(performance.now()-origin)/1000:pausedAt;for(const entry of entries)if(entry.paint&&visible.has(entry.article))entry.paint(t);requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
run().catch(e=>{status.textContent='No se pudo preparar la vista: '+e.message;console.error(e);});
